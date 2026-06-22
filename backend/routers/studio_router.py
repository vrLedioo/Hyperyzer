"""Studio endpoints — creation tools gated to Pro/Agency plans.

Every endpoint composes two independent checks:
  1. Entitlement: `Depends(require_feature(...))` — caller's effective plan must
     unlock the feature (team-aware). Anonymous/pay-token callers can't reach
     here (the gate depends on get_current_user).
  2. Payment: `resolve_access(..., pay_token=None, cost=...)` then
     `apply_consumption` AFTER a successful generation. Credits are only spent on
     success; BYOK callers spend nothing but must still be on a Pro/Agency plan.
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlmodel import Session, select

from access import AccessDenied, AccessGrant, apply_consumption, resolve_access
from config import settings
from db import get_session
from limiter import limiter
from models import Client, Generation, User
from services.scoring import ScoringError, score_content
from services.studio import (
    StudioError, generate_calendar, generate_hooks, optimize_script,
    write_ad_script, write_script,
)
from studio import ensure_owned_team, require_feature

router = APIRouter(prefix="/api/studio", tags=["studio"])


# --------------------------------------------------------------------------- #
# Requests
# --------------------------------------------------------------------------- #
class ScriptRequest(BaseModel):
    idea: str
    platform: Optional[str] = None
    audience: Optional[str] = None
    tone: Optional[str] = None
    client_id: Optional[int] = None     # Agency: generate for a brand profile
    user_api_key: Optional[str] = None  # BYOK


class AdScriptRequest(BaseModel):
    product: str
    benefit: Optional[str] = None
    offer: Optional[str] = None
    platform: Optional[str] = None
    audience: Optional[str] = None
    tone: Optional[str] = None
    client_id: Optional[int] = None
    user_api_key: Optional[str] = None


class HooksRequest(BaseModel):
    topic: str
    platform: Optional[str] = None
    audience: Optional[str] = None
    tone: Optional[str] = None
    client_id: Optional[int] = None
    user_api_key: Optional[str] = None


class OptimizeRequest(BaseModel):
    title: str
    script: str
    platform: Optional[str] = None
    audience: Optional[str] = None
    user_api_key: Optional[str] = None


class CalendarRequest(BaseModel):
    niche: str
    days: Optional[int] = 7
    platform: Optional[str] = None
    audience: Optional[str] = None
    tone: Optional[str] = None
    client_id: Optional[int] = None
    user_api_key: Optional[str] = None


class BulkItem(BaseModel):
    title: str
    script: str


class BulkRequest(BaseModel):
    items: list[BulkItem]
    platform: Optional[str] = None
    audience: Optional[str] = None
    user_api_key: Optional[str] = None


class ClientRequest(BaseModel):
    name: str
    audience: Optional[str] = ""
    niche: Optional[str] = ""
    tone: Optional[str] = ""


class ClientOut(BaseModel):
    id: int
    name: str
    audience: str
    niche: str
    tone: str


class GenerationResponse(BaseModel):
    id: int
    kind: str
    output: dict


MAX_BULK_ITEMS = 25


# --------------------------------------------------------------------------- #
# Shared helpers
# --------------------------------------------------------------------------- #
def _gate_payment(user: User, user_api_key: Optional[str], cost: int, session: Session) -> AccessGrant:
    """Resolve the payment path for a Studio call. pay_token is never accepted
    (Studio requires an account); resolve_access handles team-pool routing."""
    try:
        return resolve_access(
            user=user, user_api_key=user_api_key, pay_token=None, session=session, cost=cost,
        )
    except AccessDenied as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


def _generation_failed(grant: AccessGrant, e: Exception) -> HTTPException:
    """Map a generation failure to HTTP. A BYOK failure is almost always a bad key."""
    if grant.method == "byok":
        return HTTPException(
            status_code=401,
            detail="Invalid OpenAI API Key provided. Please check your key and try again.",
        )
    return HTTPException(status_code=502, detail=f"AI generation failed: {e}")


def _save_generation(session: Session, user: User, kind: str, title: str,
                     input_text: str, output: dict, meta: Optional[dict] = None,
                     client_id: Optional[int] = None) -> Generation:
    gen = Generation(
        user_id=user.id,
        team_id=user.team_id,  # attribution; the owner's pool paid (see resolve_access)
        client_id=client_id,
        kind=kind,
        title=title[:200],
        input_text=input_text[:8000],
        output=json.dumps(output, ensure_ascii=False),
        meta=json.dumps(meta or {}, ensure_ascii=False),
    )
    session.add(gen)
    session.commit()
    session.refresh(gen)
    return gen


def _resolve_client(user: User, client_id: Optional[int], session: Session) -> Optional[Client]:
    """Load a brand profile that belongs to the caller's team, or 404."""
    if client_id is None:
        return None
    client = session.get(Client, client_id)
    if not client or not user.team_id or client.team_id != user.team_id:
        raise HTTPException(status_code=404, detail="Client profile not found.")
    return client


def _apply_client(client: Optional[Client], audience: Optional[str], tone: Optional[str]):
    """Fold a brand profile into the targeting (request values win if provided)."""
    if not client:
        return audience, tone
    eff_aud = (audience or client.audience or "").strip()
    if client.niche:
        eff_aud = f"{eff_aud} | niche: {client.niche}".strip(" |")
    return (eff_aud or None), (tone or client.tone or None)


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@router.post("/script", response_model=GenerationResponse)
@limiter.limit("20/minute")
def studio_script(
    request: Request,
    req: ScriptRequest,
    user: User = Depends(require_feature("script")),
    session: Session = Depends(get_session),
):
    client = _resolve_client(user, req.client_id, session)
    audience, tone = _apply_client(client, req.audience, req.tone)
    grant = _gate_payment(user, req.user_api_key, settings.script_credit_cost, session)
    try:
        output = write_script(req.idea, platform=req.platform, audience=audience,
                              tone=tone, byok_key=grant.byok_key)
    except (StudioError, ScoringError) as e:
        raise _generation_failed(grant, e)
    apply_consumption(grant, session)
    gen = _save_generation(session, user, "script", req.idea, req.idea, output,
                           client_id=client.id if client else None)
    return GenerationResponse(id=gen.id, kind="script", output=output)


@router.post("/ad-script", response_model=GenerationResponse)
@limiter.limit("20/minute")
def studio_ad_script(
    request: Request,
    req: AdScriptRequest,
    user: User = Depends(require_feature("ad_script")),
    session: Session = Depends(get_session),
):
    client = _resolve_client(user, req.client_id, session)
    audience, tone = _apply_client(client, req.audience, req.tone)
    grant = _gate_payment(user, req.user_api_key, settings.ad_script_credit_cost, session)
    try:
        output = write_ad_script(req.product, benefit=req.benefit, offer=req.offer,
                                 platform=req.platform, audience=audience, tone=tone,
                                 byok_key=grant.byok_key)
    except (StudioError, ScoringError) as e:
        raise _generation_failed(grant, e)
    apply_consumption(grant, session)
    gen = _save_generation(session, user, "ad_script", req.product, req.product, output,
                           client_id=client.id if client else None)
    return GenerationResponse(id=gen.id, kind="ad_script", output=output)


@router.post("/hooks", response_model=GenerationResponse)
@limiter.limit("20/minute")
def studio_hooks(
    request: Request,
    req: HooksRequest,
    user: User = Depends(require_feature("hooks")),
    session: Session = Depends(get_session),
):
    client = _resolve_client(user, req.client_id, session)
    audience, tone = _apply_client(client, req.audience, req.tone)
    grant = _gate_payment(user, req.user_api_key, settings.hook_credit_cost, session)
    try:
        output = generate_hooks(req.topic, platform=req.platform, audience=audience,
                                tone=tone, byok_key=grant.byok_key)
    except (StudioError, ScoringError) as e:
        raise _generation_failed(grant, e)
    apply_consumption(grant, session)
    gen = _save_generation(session, user, "hooks", req.topic, req.topic, output,
                           client_id=client.id if client else None)
    return GenerationResponse(id=gen.id, kind="hooks", output=output)


@router.post("/optimize", response_model=GenerationResponse)
@limiter.limit("20/minute")
def studio_optimize(
    request: Request,
    req: OptimizeRequest,
    user: User = Depends(require_feature("optimize")),
    session: Session = Depends(get_session),
):
    grant = _gate_payment(user, req.user_api_key, settings.optimize_credit_cost, session)
    try:
        output = optimize_script(req.title, req.script, platform=req.platform,
                                 audience=req.audience, byok_key=grant.byok_key)
    except (StudioError, ScoringError) as e:
        raise _generation_failed(grant, e)
    # Charged once for the whole optimize (rewrite + two score calls).
    apply_consumption(grant, session)
    gen = _save_generation(session, user, "optimize", req.title, req.script, output)
    return GenerationResponse(id=gen.id, kind="optimize", output=output)


# --------------------------------------------------------------------------- #
# Agency: content calendar
# --------------------------------------------------------------------------- #
@router.post("/calendar", response_model=GenerationResponse)
@limiter.limit("10/minute")
def studio_calendar(
    request: Request,
    req: CalendarRequest,
    user: User = Depends(require_feature("calendar")),
    session: Session = Depends(get_session),
):
    client = _resolve_client(user, req.client_id, session)
    audience, tone = _apply_client(client, req.audience, req.tone)
    grant = _gate_payment(user, req.user_api_key, settings.calendar_credit_cost, session)
    try:
        output = generate_calendar(req.niche, days=req.days or 7, platform=req.platform,
                                   audience=audience, tone=tone, byok_key=grant.byok_key)
    except (StudioError, ScoringError) as e:
        raise _generation_failed(grant, e)
    apply_consumption(grant, session)
    gen = _save_generation(session, user, "calendar", f"Calendar: {req.niche}", req.niche, output,
                           client_id=client.id if client else None)
    return GenerationResponse(id=gen.id, kind="calendar", output=output)


# --------------------------------------------------------------------------- #
# Agency: bulk analyze (charge only successful items)
# --------------------------------------------------------------------------- #
@router.post("/bulk", response_model=GenerationResponse)
@limiter.limit("10/minute")
def studio_bulk(
    request: Request,
    req: BulkRequest,
    user: User = Depends(require_feature("bulk")),
    session: Session = Depends(get_session),
):
    items = req.items[:MAX_BULK_ITEMS]
    if not items:
        raise HTTPException(status_code=400, detail="Provide at least one idea to analyze.")
    per = settings.bulk_per_item_cost
    # Gate up front on the full batch cost; we'll only charge for what succeeds.
    grant = _gate_payment(user, req.user_api_key, per * len(items), session)

    results = []
    succeeded = 0
    for it in items:
        try:
            r = score_content(it.title, it.script, platform=req.platform, audience=req.audience,
                              byok_key=grant.byok_key)
            results.append({
                "title": it.title, "ok": True,
                "hook_score": r.hook_score, "retention_score": r.retention_score,
                "viral_score": r.viral_score, "feedback": r.feedback,
                "hashtags": r.hashtags, "best_times": r.best_times,
            })
            succeeded += 1
        except (ScoringError, StudioError) as e:
            results.append({"title": it.title, "ok": False, "error": str(e)})

    if succeeded == 0:
        # Nothing worked — don't charge. A BYOK failure is almost always a bad key.
        raise _generation_failed(grant, RuntimeError("All items failed to analyze."))

    # Charge only for the items that actually produced a result.
    grant.credits_cost = succeeded * per
    apply_consumption(grant, session)
    output = {"items": results, "succeeded": succeeded, "charged_credits": succeeded * per}
    gen = _save_generation(session, user, "bulk", f"Bulk analyze: {len(items)} ideas", "", output)
    return GenerationResponse(id=gen.id, kind="bulk", output=output)


# --------------------------------------------------------------------------- #
# Agency: client / brand profiles
# --------------------------------------------------------------------------- #
def _client_out(c: Client) -> ClientOut:
    return ClientOut(id=c.id, name=c.name, audience=c.audience, niche=c.niche, tone=c.tone)


@router.post("/clients", response_model=ClientOut)
def create_client(
    req: ClientRequest,
    user: User = Depends(require_feature("clients")),
    session: Session = Depends(get_session),
):
    # Members add to their existing team; owners (or team-less agency users) get
    # a team created on demand.
    if user.team_role == "member" and user.team_id:
        team_id = user.team_id
    else:
        team_id = ensure_owned_team(user, session).id
    client = Client(team_id=team_id, name=req.name[:120], audience=(req.audience or "")[:600],
                    niche=(req.niche or "")[:200], tone=(req.tone or "")[:200])
    session.add(client)
    session.commit()
    session.refresh(client)
    return _client_out(client)


@router.get("/clients", response_model=list[ClientOut])
def list_clients(
    user: User = Depends(require_feature("clients")),
    session: Session = Depends(get_session),
):
    if not user.team_id:
        return []
    rows = session.exec(
        select(Client).where(Client.team_id == user.team_id).order_by(Client.created_at)
    ).all()
    return [_client_out(c) for c in rows]


@router.put("/clients/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int,
    req: ClientRequest,
    user: User = Depends(require_feature("clients")),
    session: Session = Depends(get_session),
):
    client = _resolve_client(user, client_id, session)
    client.name = req.name[:120]
    client.audience = (req.audience or "")[:600]
    client.niche = (req.niche or "")[:200]
    client.tone = (req.tone or "")[:200]
    session.add(client)
    session.commit()
    session.refresh(client)
    return _client_out(client)


@router.delete("/clients/{client_id}", status_code=204)
def delete_client(
    client_id: int,
    user: User = Depends(require_feature("clients")),
    session: Session = Depends(get_session),
):
    client = _resolve_client(user, client_id, session)
    session.delete(client)
    session.commit()
    return Response(status_code=204)
