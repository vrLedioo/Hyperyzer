"""Analysis endpoints: idea scoring + history. (Video lives in video_router.)"""
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from access import AccessDenied, apply_consumption, resolve_access
from auth import get_current_user, get_optional_user
from config import settings
from db import get_session
from limiter import limiter
from models import Analysis, User
from services.scoring import ScoringError, score_content

router = APIRouter(prefix="/api", tags=["analyze"])


class AnalyzeRequest(BaseModel):
    title: str
    script: str
    platform: Optional[str] = None      # target platform for hashtags/timing
    audience: Optional[str] = None      # target audience (region / who)
    language: Optional[str] = None      # output language ("" = match input)
    user_api_key: Optional[str] = None  # BYOK
    pay_token: Optional[str] = None     # single-use pay-per-use token


class AnalyzeResponse(BaseModel):
    hook_score: int
    retention_score: int
    viral_score: int
    feedback: str
    hashtags: dict = {}
    best_times: dict = {}
    improvements: dict = {}
    pay_token_consumed: bool = False


class AnalysisOut(BaseModel):
    id: int
    kind: str
    title: str
    platform: Optional[str] = None
    transcript: Optional[str] = None
    hook_score: int
    retention_score: int
    viral_score: int
    feedback: str
    hashtags: dict = {}
    best_times: dict = {}
    improvements: dict = {}
    created_at: datetime


def _loads(raw: str) -> dict:
    """Decode a stored JSON blob; tolerate empty/legacy rows."""
    if not raw:
        return {}
    try:
        v = json.loads(raw)
        return v if isinstance(v, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def save_analysis(
    session: Session,
    *,
    user: Optional[User],
    kind: str,
    title: str,
    input_text: str,
    result,
    platform: str = "",
) -> Analysis:
    record = Analysis(
        user_id=user.id if user else None,
        kind=kind,
        title=title,
        input_text=input_text,
        platform=platform or "",
        hook_score=result.hook_score,
        retention_score=result.retention_score,
        viral_score=result.viral_score,
        feedback=result.feedback,
        hashtags=json.dumps(getattr(result, "hashtags", {}) or {}),
        best_times=json.dumps(getattr(result, "best_times", {}) or {}),
        improvements=json.dumps(getattr(result, "improvements", {}) or {}),
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.post("/analyze-idea", response_model=AnalyzeResponse)
@limiter.limit("30/minute")
def analyze_idea(
    request: Request,
    req: AnalyzeRequest,
    user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session),
):
    try:
        grant = resolve_access(
            user=user,
            user_api_key=req.user_api_key,
            pay_token=req.pay_token,
            session=session,
            cost=settings.idea_credit_cost,
        )
    except AccessDenied as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))

    try:
        result = score_content(
            req.title, req.script,
            platform=req.platform, audience=req.audience, language=req.language,
            byok_key=grant.byok_key,
        )
    except ScoringError as e:
        if grant.method == "byok":
            raise HTTPException(
                status_code=401,
                detail="Invalid OpenAI API Key provided. Please check your key and try again.",
            )
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    # Only spend the credit / pay token after a successful analysis.
    apply_consumption(grant, session)
    save_analysis(
        session, user=user, kind="idea", title=req.title,
        input_text=req.script, result=result, platform=req.platform or "",
    )

    return AnalyzeResponse(
        hook_score=result.hook_score,
        retention_score=result.retention_score,
        viral_score=result.viral_score,
        feedback=result.feedback,
        hashtags=result.hashtags,
        best_times=result.best_times,
        improvements=result.improvements,
        pay_token_consumed=(grant.method == "pay-token"),
    )


@router.get("/history", response_model=list[AnalysisOut])
def history(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    limit: int = 50,
    offset: int = 0,
):
    rows = session.exec(
        select(Analysis)
        .where(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc())
        .limit(min(limit, 200))
        .offset(max(offset, 0))
    ).all()
    return [
        AnalysisOut(
            id=r.id, kind=r.kind, title=r.title, platform=r.platform or None,
            transcript=r.input_text if r.kind == "video" else None,
            hook_score=r.hook_score, retention_score=r.retention_score,
            viral_score=r.viral_score, feedback=r.feedback,
            hashtags=_loads(r.hashtags), best_times=_loads(r.best_times),
            improvements=_loads(r.improvements),
            created_at=r.created_at,
        )
        for r in rows
    ]
