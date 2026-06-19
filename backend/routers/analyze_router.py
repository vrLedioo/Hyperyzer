"""Analysis endpoints: idea scoring + history. (Video lives in video_router.)"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from access import AccessDenied, apply_consumption, resolve_access
from auth import get_current_user, get_optional_user
from db import get_session
from models import Analysis, User
from services.scoring import ScoringError, score_content

router = APIRouter(prefix="/api", tags=["analyze"])


class AnalyzeRequest(BaseModel):
    title: str
    script: str
    user_api_key: Optional[str] = None  # BYOK
    pay_token: Optional[str] = None     # single-use pay-per-use token


class AnalyzeResponse(BaseModel):
    hook_score: int
    retention_score: int
    viral_score: int
    feedback: str
    pay_token_consumed: bool = False


class AnalysisOut(BaseModel):
    id: int
    kind: str
    title: str
    transcript: Optional[str] = None
    hook_score: int
    retention_score: int
    viral_score: int
    feedback: str
    created_at: datetime


def save_analysis(
    session: Session,
    *,
    user: Optional[User],
    kind: str,
    title: str,
    input_text: str,
    result,
) -> Analysis:
    record = Analysis(
        user_id=user.id if user else None,
        kind=kind,
        title=title,
        input_text=input_text,
        hook_score=result.hook_score,
        retention_score=result.retention_score,
        viral_score=result.viral_score,
        feedback=result.feedback,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.post("/analyze-idea", response_model=AnalyzeResponse)
def analyze_idea(
    request: AnalyzeRequest,
    user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session),
):
    try:
        grant = resolve_access(
            user=user,
            user_api_key=request.user_api_key,
            pay_token=request.pay_token,
            session=session,
        )
    except AccessDenied as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))

    try:
        result = score_content(request.title, request.script, byok_key=grant.byok_key)
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
        session, user=user, kind="idea", title=request.title,
        input_text=request.script, result=result,
    )

    return AnalyzeResponse(
        hook_score=result.hook_score,
        retention_score=result.retention_score,
        viral_score=result.viral_score,
        feedback=result.feedback,
        pay_token_consumed=(grant.method == "pay-token"),
    )


@router.get("/history", response_model=list[AnalysisOut])
def history(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(Analysis)
        .where(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc())
    ).all()
    return [
        AnalysisOut(
            id=r.id, kind=r.kind, title=r.title,
            transcript=r.input_text if r.kind == "video" else None,
            hook_score=r.hook_score, retention_score=r.retention_score,
            viral_score=r.viral_score, feedback=r.feedback, created_at=r.created_at,
        )
        for r in rows
    ]
