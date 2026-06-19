"""Database models (SQLModel). Used for SQLite locally; Postgres-ready."""
import secrets
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_token() -> str:
    return secrets.token_urlsafe(24)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    # Credits from pay-per-use credit packs; consumed per analysis.
    credits: int = 0
    # "none" | "active" | "canceled"
    subscription_status: str = "none"
    stripe_customer_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=_utcnow)


class Analysis(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    # "idea" | "video"
    kind: str = "idea"
    title: str
    # The hook/script text (idea) or the transcript (video).
    input_text: str = ""
    hook_score: int = 0
    retention_score: int = 0
    viral_score: int = 0
    feedback: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


class RedeemedSession(SQLModel, table=True):
    """Tracks Stripe pay-per-use sessions already spent, so a single-use
    pay token can only buy one analysis."""
    session_id: str = Field(primary_key=True)
    redeemed_at: datetime = Field(default_factory=_utcnow)


class VideoJob(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # Unguessable public handle used for polling (sequential ids would be an IDOR).
    token: str = Field(default_factory=_new_token, index=True, unique=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    title: str = ""
    filename: str = ""
    # "queued" | "transcribing" | "scoring" | "done" | "error"
    status: str = "queued"
    error: Optional[str] = None
    # Access path used ("byok" | "subscription" | "credit" | "pay-token").
    method: Optional[str] = None
    analysis_id: Optional[int] = Field(default=None, foreign_key="analysis.id")
    created_at: datetime = Field(default_factory=_utcnow)
