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
    # Purchased credit-pack balance; never expires, consumed per analysis.
    credits: int = 0
    # Monthly subscription allowance; refilled on each renewal (does NOT roll
    # over), and spent BEFORE purchased `credits`.
    subscription_credits: int = 0
    # "none" | "active" | "canceled"
    subscription_status: str = "none"
    # Active plan key ("creator" | "pro" | "agency"), or "free".
    plan: str = "free"
    stripe_customer_id: Optional[str] = Field(default=None, index=True)
    # Provider subscription id (Paddle / Lemon Squeezy / Stripe) for cancel matching.
    subscription_id: Optional[str] = Field(default=None, index=True)
    # New signups must confirm ownership of their email before they can log in
    # or spend credits. Existing rows are grandfathered to True by the migration.
    email_verified: bool = False
    # Team membership (Agency teams). `team_id` set => this user belongs to a team;
    # `team_role` is "owner" or "member". A member spends the OWNER's credit pool
    # and inherits the owner's (Agency) Studio capabilities. Null => solo user.
    # NB: intentionally NOT a DB-level foreign key — team<->user would form a
    # constraint cycle, and the prod migration adds this as a plain INTEGER
    # column. The relationship is resolved in code (studio.team_owner/pool_user).
    team_id: Optional[int] = Field(default=None, index=True)
    team_role: Optional[str] = None  # "owner" | "member" | None
    created_at: datetime = Field(default_factory=_utcnow)

    @property
    def total_credits(self) -> int:
        return self.subscription_credits + self.credits


class Analysis(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    # "idea" | "video"
    kind: str = "idea"
    title: str
    # The hook/script text (idea) or the transcript (video).
    input_text: str = ""
    # Target platform for hashtag/timing tuning ("tiktok" | "youtube" | ...).
    platform: str = ""
    hook_score: int = 0
    retention_score: int = 0
    viral_score: int = 0
    feedback: str = ""
    # JSON-encoded optimization extras (see services/scoring.py for the shapes):
    #   hashtags    -> {"primary": [...], "niche": [...], "broad": [...]}
    #   best_times  -> {"timezone_note": str, "summary": str,
    #                   "slots": [{"day","time","why"}]}
    #   improvements-> {"verdict": str, "hook_rewrites": [...], "title_suggestions": [...],
    #                   "caption": str, "retention_risks": [{"moment","risk","fix"}]}
    hashtags: str = ""
    best_times: str = ""
    improvements: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


class Generation(SQLModel, table=True):
    """A Studio creation (script, ad script, hooks, optimize, calendar). Kept
    separate from Analysis (which is score-shaped) — generations are free-form
    text with heterogeneous structure stored as JSON in `output`."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    # Set when produced by a team member (for attribution); owner's pool paid.
    team_id: Optional[int] = Field(default=None, foreign_key="team.id", index=True)
    # Agency: which brand/client profile this was generated for (optional).
    client_id: Optional[int] = Field(default=None, foreign_key="client.id", index=True)
    # "script" | "ad_script" | "hooks" | "optimize" | "calendar"
    kind: str = ""
    title: str = ""
    input_text: str = ""        # the prompt/topic/source script
    output: str = ""            # JSON-encoded result (see studio_router for shapes)
    meta: str = ""              # JSON-encoded extras (e.g. optimize before/after)
    created_at: datetime = Field(default_factory=_utcnow)


class Team(SQLModel, table=True):
    """An Agency team. The owner's User row holds the shared credit pool and the
    (Agency) subscription; members draw on it and inherit its capabilities."""
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    name: str = ""
    seat_limit: int = 5
    created_at: datetime = Field(default_factory=_utcnow)


class TeamMembership(SQLModel, table=True):
    """A seat on a team — an invited or active member. `user_id` is null until
    the invite is accepted; `invite_token` is the single-use accept handle."""
    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    email: str = Field(index=True)        # invited address
    role: str = "member"                  # "owner" | "member"
    status: str = "invited"               # "invited" | "active" | "removed"
    invite_token: str = Field(default_factory=_new_token, index=True, unique=True)
    invited_at: datetime = Field(default_factory=_utcnow)
    accepted_at: Optional[datetime] = None


class Client(SQLModel, table=True):
    """An Agency brand/client profile. Generation can target a profile so the
    output matches that client's audience, niche, and tone of voice."""
    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    name: str = ""
    audience: str = ""
    niche: str = ""
    tone: str = ""
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


class PasswordResetToken(SQLModel, table=True):
    """Single-use password reset tokens, valid for 1 hour."""
    id: Optional[int] = Field(default=None, primary_key=True)
    token: str = Field(index=True, unique=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    expires_at: datetime
    used: bool = False
    created_at: datetime = Field(default_factory=_utcnow)


class EmailVerificationToken(SQLModel, table=True):
    """Single-use email-verification tokens, valid for 24 hours."""
    id: Optional[int] = Field(default=None, primary_key=True)
    token: str = Field(index=True, unique=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    expires_at: datetime
    used: bool = False
    created_at: datetime = Field(default_factory=_utcnow)
