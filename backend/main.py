from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from config import settings
from db import create_db_and_tables
from limiter import limiter
from llm import server_llm_configured
from plans import PACKS, PLANS
from routers.auth_router import router as auth_router
from routers.analyze_router import router as analyze_router
from routers.billing_router import router as billing_router
from routers.studio_router import router as studio_router
from routers.team_router import router as team_router
from routers.video_router import router as video_router


def _reconcile_orphaned_jobs():
    """Background jobs run in-process, so any job still non-terminal at startup
    was orphaned by a restart/crash. Fail them and clean up their upload files."""
    import os
    from sqlmodel import Session, select
    from db import engine
    from models import VideoJob

    with Session(engine) as session:
        stuck = session.exec(
            select(VideoJob).where(VideoJob.status.in_(("queued", "transcribing", "scoring")))
        ).all()
        for job in stuck:
            job.status = "error"
            job.error = "Interrupted by a server restart."
            session.add(job)
            if job.filename:
                path = os.path.join(settings.upload_dir, job.filename)
                try:
                    os.remove(path)
                except OSError:
                    pass
        if stuck:
            session.commit()


def _purge_expired_reset_tokens():
    """Delete used or expired password-reset tokens on startup to prevent DB bloat."""
    from datetime import datetime, timezone
    from sqlmodel import Session, select
    from db import engine
    from models import PasswordResetToken

    now = datetime.now(timezone.utc)
    with Session(engine) as session:
        stale = session.exec(
            select(PasswordResetToken).where(
                (PasswordResetToken.used == True) | (PasswordResetToken.expires_at < now)  # noqa: E712
            )
        ).all()
        for t in stale:
            session.delete(t)
        if stale:
            session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    _reconcile_orphaned_jobs()
    _purge_expired_reset_tokens()
    yield


# Auto-generated API docs (/docs, /redoc, /openapi.json) expose the full API
# surface; serve them only outside production.
_docs_on = not settings.is_production
app = FastAPI(
    title="Hyperyzer API",
    lifespan=lifespan,
    docs_url="/docs" if _docs_on else None,
    redoc_url="/redoc" if _docs_on else None,
    openapi_url="/openapi.json" if _docs_on else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers on every response. The API returns JSON (no HTML/scripts in
# prod), so a deny-all CSP + frame-ancestors is safe and blocks clickjacking.
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    for key, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(key, value)
    if settings.is_production:
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
        )
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth_router)
app.include_router(analyze_router)
app.include_router(billing_router)
app.include_router(studio_router)
app.include_router(team_router)
app.include_router(video_router)


@app.get("/")
def read_root():
    return {"message": "Hyperyzer API is running"}


@app.get("/api/health")
def health_check():
    """Liveness + DB connectivity check used by Render's health-check probe."""
    try:
        from sqlmodel import Session, text as sql_text
        from db import engine
        with Session(engine) as s:
            s.exec(sql_text("SELECT 1"))
        return {"status": "ok", "db": "connected"}
    except Exception as exc:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"status": "error", "detail": str(exc)})


class PlanOut(BaseModel):
    key: str
    name: str
    price_eur: int
    monthly_credits: int
    priority: bool
    team: bool
    studio: bool             # unlocks the Studio creation tools
    features: list[str]      # Studio capability keys this plan unlocks
    tagline: str
    available: bool  # the active payment provider has a price configured for this plan


class PackOut(BaseModel):
    key: str
    name: str
    price_eur: int
    credits: int
    available: bool


class ConfigResponse(BaseModel):
    payment_provider: str          # "none" | "paddle" | "stripe" | "lemonsqueezy"
    billing_enabled: bool          # any paid option available
    subscription_enabled: bool     # subscription checkout available
    credits_purchase_enabled: bool # logged-in credit-pack top-up
    pay_per_use_enabled: bool      # anonymous one-off (Stripe)
    byok_enabled: bool             # users may supply their own OpenAI key
    server_llm_ready: bool         # server can analyze without a caller key
    ai_provider: str               # "local" | "openai" | "custom"
    pay_per_use_cents: int
    free_credits_on_signup: int
    idea_credit_cost: int
    video_credit_cost: int
    studio_costs: dict[str, int]   # per-feature Studio credit costs
    plans: list[PlanOut]
    packs: list[PackOut]


@app.get("/api/config", response_model=ConfigResponse)
def get_config():
    """Public capability flags + the pricing catalog so the frontend can render
    plans/packs, the right billing buttons, AI provider, and credit costs."""
    if settings.llm_base_url:
        ai_provider = "local" if "11434" in settings.llm_base_url else "custom"
    else:
        ai_provider = "openai"

    available_plans = settings.available_plan_keys
    available_packs = settings.available_pack_keys
    plans = [
        PlanOut(
            key=k, available=k in available_plans,
            name=p["name"], price_eur=p["price_eur"], monthly_credits=p["monthly_credits"],
            priority=p["priority"], team=p["team"], studio=p["studio"],
            features=sorted(p["features"]), tagline=p["tagline"],
        )
        for k, p in PLANS.items()
    ]
    packs = [
        PackOut(key=k, available=k in available_packs, **p) for k, p in PACKS.items()
    ]

    return ConfigResponse(
        payment_provider=settings.payment_provider,
        billing_enabled=settings.billing_enabled,
        subscription_enabled=settings.subscription_enabled,
        credits_purchase_enabled=settings.credits_purchase_enabled,
        pay_per_use_enabled=settings.pay_per_use_enabled,
        byok_enabled=True,
        server_llm_ready=server_llm_configured(),
        ai_provider=ai_provider,
        pay_per_use_cents=settings.pay_per_use_amount_cents,
        free_credits_on_signup=settings.free_credits_on_signup,
        idea_credit_cost=settings.idea_credit_cost,
        video_credit_cost=settings.video_credit_cost,
        studio_costs=settings.studio_costs,
        plans=plans,
        packs=packs,
    )
