from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import settings
from db import create_db_and_tables
from llm import server_llm_configured
from plans import PACKS, PLANS
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


app = FastAPI(title="Hyperyzer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
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
    return {"message": "Hyperyzer API is running"}


class PlanOut(BaseModel):
    key: str
    name: str
    price_eur: int
    monthly_credits: int
    priority: bool
    team: bool
    tagline: str
    available: bool  # a Lemon Squeezy variant is configured for this plan


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
    credits_purchase_enabled: bool # logged-in credit-pack top-up (Lemon Squeezy)
    pay_per_use_enabled: bool      # anonymous one-off (Stripe)
    byok_enabled: bool             # users may supply their own OpenAI key
    server_llm_ready: bool         # server can analyze without a caller key
    ai_provider: str               # "local" | "openai" | "custom"
    pay_per_use_cents: int
    free_credits_on_signup: int
    idea_credit_cost: int
    video_credit_cost: int
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
        PlanOut(key=k, available=k in available_plans, **p) for k, p in PLANS.items()
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
        plans=plans,
        packs=packs,
    )
