"""Unified access gate for analysis (idea + video).

An analysis is allowed via exactly one of these paths, checked in order:
  1. BYOK      - caller supplied their own OpenAI key (free, uses OpenAI cloud)
  2. subscription - logged-in user with an active subscription (unlimited)
  3. credit    - logged-in user with >= 1 credit (consumes one on success)
  4. pay-token - a valid single-use token from a paid Stripe checkout

Paths 2-4 use the server's configured LLM provider, which may be a free local
endpoint (Ollama) requiring no key at all.
"""
from dataclasses import dataclass
from typing import Optional

import jwt
from sqlmodel import Session

from auth import PURPOSE_PAY, decode_token
from llm import server_llm_configured
from models import RedeemedSession, User


class AccessDenied(Exception):
    def __init__(self, message: str, status_code: int = 402):
        super().__init__(message)
        self.status_code = status_code


@dataclass
class AccessGrant:
    method: str  # "byok" | "subscription" | "credit" | "pay-token"
    byok_key: Optional[str] = None  # only set for the BYOK path
    user: Optional[User] = None
    session_id: Optional[str] = None


def _valid_pay_session(pay_token: Optional[str], session: Session) -> Optional[str]:
    if not pay_token:
        return None
    try:
        payload = decode_token(pay_token)
    except jwt.PyJWTError:
        return None
    if payload.get("purpose") != PURPOSE_PAY:
        return None
    session_id = payload.get("sub")
    if not session_id:
        return None
    if session.get(RedeemedSession, session_id):  # already spent?
        return None
    return session_id


def resolve_access(
    *,
    user: Optional[User],
    user_api_key: Optional[str],
    pay_token: Optional[str],
    session: Session,
) -> AccessGrant:
    # 1. BYOK — always free, uses the caller's own OpenAI key.
    if user_api_key:
        return AccessGrant(method="byok", byok_key=user_api_key)

    # Every other path uses the server's configured provider.
    if not server_llm_configured():
        raise AccessDenied(
            "Server has no AI provider configured. Provide your own OpenAI key (BYOK), "
            "or configure a provider (e.g. a local Ollama endpoint) on the server.",
            status_code=503,
        )

    # 2. Active subscription — unlimited.
    if user and user.subscription_status == "active":
        return AccessGrant(method="subscription", user=user)

    # 3. Account credits.
    if user and user.credits > 0:
        return AccessGrant(method="credit", user=user)

    # 4. Single-use pay token.
    session_id = _valid_pay_session(pay_token, session)
    if session_id:
        return AccessGrant(method="pay-token", session_id=session_id)

    raise AccessDenied(
        "No usable access. Buy a single analysis, subscribe, use account credits, "
        "or provide your own OpenAI key.",
        status_code=402,
    )


def apply_consumption(grant: AccessGrant, session: Session) -> None:
    """Spend the credit / mark the pay token used. Call only after success."""
    if grant.method == "credit" and grant.user is not None:
        grant.user.credits = max(0, grant.user.credits - 1)
        session.add(grant.user)
        session.commit()
    elif grant.method == "pay-token" and grant.session_id:
        session.add(RedeemedSession(session_id=grant.session_id))
        session.commit()
    # byok / subscription consume nothing.
