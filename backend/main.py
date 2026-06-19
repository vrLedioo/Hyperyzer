from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import settings
from db import create_db_and_tables
from llm import server_llm_configured
from routers.auth_router import router as auth_router
from routers.analyze_router import router as analyze_router
from routers.billing_router import router as billing_router
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    _reconcile_orphaned_jobs()
    yield


app = FastAPI(title="SaaS Video Analyzer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(analyze_router)
app.include_router(billing_router)
app.include_router(video_router)


@app.get("/")
def read_root():
    return {"message": "SaaS Video Analyzer API is running"}


class ConfigResponse(BaseModel):
    billing_enabled: bool          # pay-per-use available
    subscription_enabled: bool     # subscription checkout available
    byok_enabled: bool             # users may supply their own OpenAI key
    server_llm_ready: bool         # server can analyze without a caller key
    provider: str                  # "local" | "openai" | "custom"
    pay_per_use_cents: int
    free_credits_on_signup: int


@app.get("/api/config", response_model=ConfigResponse)
def get_config():
    """Public capability flags so the frontend can adapt (e.g. hide billing
    buttons when Stripe is not configured)."""
    if settings.llm_base_url:
        provider = "local" if "11434" in settings.llm_base_url else "custom"
    else:
        provider = "openai"
    return ConfigResponse(
        billing_enabled=bool(settings.stripe_secret_key),
        subscription_enabled=bool(settings.stripe_secret_key and settings.stripe_subscription_price_id),
        byok_enabled=True,
        server_llm_ready=server_llm_configured(),
        provider=provider,
        pay_per_use_cents=settings.pay_per_use_amount_cents,
        free_credits_on_signup=settings.free_credits_on_signup,
    )
