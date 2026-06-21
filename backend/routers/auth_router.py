"""Auth endpoints: signup, login, current user, password reset, account deletion, GDPR export."""
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from auth import create_access_token, get_current_user, hash_password, verify_password
from config import settings
from db import get_session
from limiter import limiter
from models import Analysis, EmailVerificationToken, PasswordResetToken, User, VideoJob
from services.email import send_account_exists, send_password_reset, send_verification_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    credits: int
    subscription_credits: int
    total_credits: int
    plan: str
    subscription_status: str


class MessageResponse(BaseModel):
    message: str


def _user_out(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        credits=user.credits,
        subscription_credits=user.subscription_credits,
        total_credits=user.total_credits,
        plan=user.plan,
        subscription_status=user.subscription_status,
    )


def _issue_verification(session: Session, user: User) -> None:
    """Replace any outstanding verification tokens for this user with a fresh
    one and email the confirmation link."""
    old_tokens = session.exec(
        select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
    ).all()
    for t in old_tokens:
        session.delete(t)

    token_str = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    session.add(EmailVerificationToken(token=token_str, user_id=user.id, expires_at=expires))
    session.commit()

    verify_url = f"{settings.frontend_url}/verify-email?token={token_str}"
    send_verification_email(user.email, verify_url)


@router.post("/signup", response_model=MessageResponse)
@limiter.limit("10/minute")
def signup(request: Request, req: SignupRequest, session: Session = Depends(get_session)):
    # Password-length validation is independent of the email, so it leaks
    # nothing about account existence.
    if len(req.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    # Enumeration-safe: every branch returns the SAME generic response. We never
    # reveal via the HTTP response whether the email is already registered.
    existing = session.exec(select(User).where(User.email == req.email)).first()
    if existing is None:
        user = User(
            email=req.email,
            hashed_password=hash_password(req.password),
            credits=settings.free_credits_on_signup,
            email_verified=False,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        _issue_verification(session, user)
    elif not existing.email_verified:
        # Account exists but never confirmed — resend the verification link.
        _issue_verification(session, existing)
    else:
        # Verified account already exists — nudge the real owner by email
        # instead of disclosing it in the response.
        send_account_exists(
            existing.email,
            login_url=f"{settings.frontend_url}/login",
            reset_url=f"{settings.frontend_url}/forgot-password",
        )

    return MessageResponse(
        message="If that email is new, check your inbox for a verification link to activate your account."
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, req: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == req.email)).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in. Check your inbox (and spam) for the link.",
        )
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/verify-email", response_model=TokenResponse)
@limiter.limit("10/minute")
def verify_email(request: Request, req: VerifyEmailRequest, session: Session = Depends(get_session)):
    """Consume a verification token, mark the account verified, and log the user in."""
    now = datetime.now(timezone.utc)
    vtoken = session.exec(
        select(EmailVerificationToken).where(EmailVerificationToken.token == req.token)
    ).first()

    if not vtoken or vtoken.used:
        raise HTTPException(
            status_code=400,
            detail="Invalid or already-used verification link. Request a new one below.",
        )
    expires = vtoken.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now:
        raise HTTPException(
            status_code=400,
            detail="This verification link has expired. Request a new one below.",
        )

    user = session.get(User, vtoken.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification link.")

    user.email_verified = True
    vtoken.used = True
    session.add(user)
    session.add(vtoken)
    session.commit()
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("5/hour")
def resend_verification(
    request: Request,
    req: ResendVerificationRequest,
    session: Session = Depends(get_session),
):
    """Re-send the verification email. Always returns 200 to avoid leaking which
    addresses are registered/unverified."""
    user = session.exec(select(User).where(User.email == req.email)).first()
    if user and not user.email_verified:
        _issue_verification(session, user)
    return MessageResponse(
        message="If that address needs verification, a new link has been sent."
    )


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return _user_out(user)


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("5/hour")
def forgot_password(
    request: Request,
    req: ForgotPasswordRequest,
    session: Session = Depends(get_session),
):
    """Request a password-reset email. Always returns 200 to prevent email enumeration."""
    user = session.exec(select(User).where(User.email == req.email)).first()
    if user:
        # Invalidate any previous tokens for this user.
        old_tokens = session.exec(
            select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
        ).all()
        for t in old_tokens:
            session.delete(t)

        token_str = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        session.add(PasswordResetToken(token=token_str, user_id=user.id, expires_at=expires))
        session.commit()

        reset_url = f"{settings.frontend_url}/reset-password?token={token_str}"
        send_password_reset(user.email, reset_url)

    return MessageResponse(message="If that email is registered, a reset link has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("10/minute")
def reset_password(
    request: Request,
    req: ResetPasswordRequest,
    session: Session = Depends(get_session),
):
    """Consume a reset token and set a new password."""
    if len(req.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    now = datetime.now(timezone.utc)
    reset_token = session.exec(
        select(PasswordResetToken).where(PasswordResetToken.token == req.token)
    ).first()

    if not reset_token or reset_token.used:
        raise HTTPException(status_code=400, detail="Invalid or already-used reset link. Please request a new one.")
    # Make expires_at timezone-aware for comparison if it isn't already.
    expires = reset_token.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now:
        raise HTTPException(status_code=400, detail="This reset link has expired. Please request a new one.")

    user = session.get(User, reset_token.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset link.")

    user.hashed_password = hash_password(req.new_password)
    reset_token.used = True
    session.add(user)
    session.add(reset_token)
    session.commit()
    return MessageResponse(message="Password updated. You can now log in with your new password.")


@router.delete("/account", status_code=204)
def delete_account(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Permanently delete the account and all associated data (GDPR Art. 17)."""
    for j in session.exec(select(VideoJob).where(VideoJob.user_id == user.id)).all():
        session.delete(j)
    session.flush()
    for a in session.exec(select(Analysis).where(Analysis.user_id == user.id)).all():
        session.delete(a)
    for t in session.exec(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)).all():
        session.delete(t)
    for t in session.exec(select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)).all():
        session.delete(t)
    session.flush()
    session.delete(user)
    session.commit()
    return Response(status_code=204)


@router.get("/export")
def export_data(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Export all personal data as JSON (GDPR Art. 20)."""
    analyses = session.exec(
        select(Analysis).where(Analysis.user_id == user.id).order_by(Analysis.created_at)
    ).all()
    jobs = session.exec(
        select(VideoJob).where(VideoJob.user_id == user.id).order_by(VideoJob.created_at)
    ).all()

    def _loads(raw: str) -> dict:
        try:
            v = json.loads(raw or "")
            return v if isinstance(v, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}

    data = {
        "account": {
            "id": user.id,
            "email": user.email,
            "plan": user.plan,
            "subscription_status": user.subscription_status,
            "credits": user.credits,
            "subscription_credits": user.subscription_credits,
            "created_at": user.created_at.isoformat(),
        },
        "analyses": [
            {
                "id": a.id,
                "kind": a.kind,
                "title": a.title,
                "platform": a.platform,
                "input_text": a.input_text,
                "hook_score": a.hook_score,
                "retention_score": a.retention_score,
                "viral_score": a.viral_score,
                "feedback": a.feedback,
                "hashtags": _loads(a.hashtags),
                "best_times": _loads(a.best_times),
                "created_at": a.created_at.isoformat(),
            }
            for a in analyses
        ],
        "video_jobs": [
            {
                "token": j.token,
                "title": j.title,
                "status": j.status,
                "method": j.method,
                "created_at": j.created_at.isoformat(),
            }
            for j in jobs
        ],
    }

    content = json.dumps(data, indent=2, ensure_ascii=False)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=hyperyzer-data-export.json"},
    )
