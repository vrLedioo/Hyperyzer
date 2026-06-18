"""Video analysis: upload → ffmpeg → Whisper → score, run as a background job."""
import os
import shutil
import uuid
from datetime import datetime
from typing import Optional

from fastapi import (
    APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile,
)
from pydantic import BaseModel
from sqlmodel import Session

from access import AccessDenied, resolve_access
from auth import get_optional_user
from config import settings
from db import engine, get_session
from models import Analysis, RedeemedSession, User, VideoJob
from services.scoring import ScoringError, score_content
from services.transcription import TranscriptionError, transcribe

router = APIRouter(prefix="/api", tags=["video"])


class JobResponse(BaseModel):
    job_id: int
    status: str


class JobStatusResponse(BaseModel):
    job_id: int
    status: str
    error: Optional[str] = None
    title: str
    # populated when status == "done"
    transcript: Optional[str] = None
    hook_score: Optional[int] = None
    retention_score: Optional[int] = None
    viral_score: Optional[int] = None
    feedback: Optional[str] = None
    created_at: datetime


def _apply_consumption_bg(session: Session, method: str, user_id: Optional[int], session_id: Optional[str]):
    if method == "credit" and user_id is not None:
        user = session.get(User, user_id)
        if user:
            user.credits = max(0, user.credits - 1)
            session.add(user)
            session.commit()
    elif method == "pay-token" and session_id:
        session.add(RedeemedSession(session_id=session_id))
        session.commit()


def _process_video(job_id: int, file_path: str, title: str, byok_key: Optional[str],
                   method: str, user_id: Optional[int], session_id: Optional[str]):
    """Runs in the background. Owns its own DB session."""
    with Session(engine) as session:
        job = session.get(VideoJob, job_id)
        if not job:
            return
        try:
            job.status = "transcribing"
            session.add(job)
            session.commit()

            transcript = transcribe(file_path, byok_key=byok_key)

            job.status = "scoring"
            session.add(job)
            session.commit()

            result = score_content(title, transcript, byok_key=byok_key)

            analysis = Analysis(
                user_id=user_id, kind="video", title=title, input_text=transcript,
                hook_score=result.hook_score, retention_score=result.retention_score,
                viral_score=result.viral_score, feedback=result.feedback,
            )
            session.add(analysis)
            session.commit()
            session.refresh(analysis)

            _apply_consumption_bg(session, method, user_id, session_id)

            job.status = "done"
            job.analysis_id = analysis.id
            session.add(job)
            session.commit()
        except (TranscriptionError, ScoringError) as e:
            job.status = "error"
            job.error = str(e)
            session.add(job)
            session.commit()
        except Exception as e:  # noqa: BLE001
            job.status = "error"
            job.error = f"Unexpected error: {e}"
            session.add(job)
            session.commit()
        finally:
            try:
                os.remove(file_path)
            except OSError:
                pass


@router.post("/analyze-video", response_model=JobResponse)
async def analyze_video(
    background: BackgroundTasks,
    title: str = Form(...),
    file: UploadFile = File(...),
    user_api_key: Optional[str] = Form(None),
    pay_token: Optional[str] = Form(None),
    user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session),
):
    # Gate access up front (reject before doing any expensive work).
    try:
        grant = resolve_access(
            user=user, user_api_key=user_api_key, pay_token=pay_token, session=session,
        )
    except AccessDenied as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))

    # Persist the upload.
    os.makedirs(settings.upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".mp4"
    stored_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.upload_dir, stored_name)
    size = 0
    max_bytes = settings.max_upload_mb * 1024 * 1024
    with open(file_path, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > max_bytes:
                out.close()
                os.remove(file_path)
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large (max {settings.max_upload_mb} MB).",
                )
            out.write(chunk)

    job = VideoJob(
        user_id=user.id if user else None, title=title, filename=stored_name, status="queued",
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    background.add_task(
        _process_video, job.id, file_path, title, grant.byok_key,
        grant.method, user.id if user else None, grant.session_id,
    )
    return JobResponse(job_id=job.id, status=job.status)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def job_status(job_id: int, session: Session = Depends(get_session)):
    job = session.get(VideoJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    resp = JobStatusResponse(
        job_id=job.id, status=job.status, error=job.error,
        title=job.title, created_at=job.created_at,
    )
    if job.status == "done" and job.analysis_id:
        analysis = session.get(Analysis, job.analysis_id)
        if analysis:
            resp.transcript = analysis.input_text
            resp.hook_score = analysis.hook_score
            resp.retention_score = analysis.retention_score
            resp.viral_score = analysis.viral_score
            resp.feedback = analysis.feedback
    return resp
