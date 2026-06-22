"""Unified access gate for analysis (idea + video).

An analysis is allowed via exactly one of these paths, checked in order:
  1. BYOK      - caller supplied their own OpenAI key (free, uses OpenAI cloud)
  2. credit    - logged-in user with enough credits for this analysis type.
                 A user has two credit buckets: a monthly subscription allowance
                 (spent first) and purchased pack credits (spent second).
  3. pay-token - a valid single-use token from a paid Stripe checkout

Paths 2-3 use the server's configured LLM provider, which may be a free local
endpoint (Ollama) requiring no key at all.
"""
from dataclasses import dataclass
from typing import Optional

import jwt
from sqlmodel import Session

from auth import PURPOSE_PAY, decode_token
from llm import server_llm_configured
from models import RedeemedSession, User
from studio import pool_user


class AccessDenied(Exception):
    def __init__(self, message: str, status_code: int = 402):
        super().__init__(message)
        self.status_code = status_code


@dataclass
class AccessGrant:
    method: str  # "byok" | "credit" | "pay-token"
    byok_key: Optional[str] = None  # only set for the BYOK path
    user: Optional[User] = None
    session_id: Optional[str] = None
    credits_cost: int = 1  # credits to spend (credit path only)


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
    cost: int = 1,
) -> AccessGrant:
    # 1. BYOK — always free, uses the caller's own OpenAI key.
    if user_api_key:
        return AccessGrant(method="byok", byok_key=user_api_key, credits_cost=cost)

    # Every other path uses the server's configured provider.
    if not server_llm_configured():
        raise AccessDenied(
            "Server has no AI provider configured. Provide your own OpenAI key (BYOK), "
            "or configure a provider (e.g. a local Ollama endpoint) on the server.",
            status_code=503,
        )

    # 2. Account credits — subscription allowance + purchased packs combined.
    # For a team member, the OWNER's buckets are the shared pool; pool_user
    # resolves to the owner so grant.user (and thus the debit) targets the pool.
    payer = pool_user(user, session) if user else None
    if payer and payer.total_credits >= cost:
        return AccessGrant(method="credit", user=payer, credits_cost=cost)

    # 3. Single-use pay token.
    session_id = _valid_pay_session(pay_token, session)
    if session_id:
        return AccessGrant(method="pay-token", session_id=session_id, credits_cost=cost)

    # Helpful message when the (pool) account has some credits but not enough.
    if payer and 0 < payer.total_credits < cost:
        raise AccessDenied(
            f"This analysis needs {cost} credits, but you have {payer.total_credits}. "
            "Buy a credit pack, upgrade your plan, or use your own OpenAI key.",
            status_code=402,
        )

    raise AccessDenied(
        "No usable access. Sign in and use account credits, subscribe to a plan, "
        "buy a credit pack, or provide your own OpenAI key.",
        status_code=402,
    )


def apply_consumption(grant: AccessGrant, session: Session) -> None:
    """Spend the credits / mark the pay token used. Call only after success.

    Subscription (monthly) credits are spent before purchased pack credits, so a
    user's use-it-or-lose-it allowance is consumed first.
    """
    if grant.method == "credit" and grant.user is not None:
        # Lock + reload the (pool) row so concurrent spends on a shared team pool
        # serialize instead of racing into a lost update. FOR UPDATE is a no-op
        # on SQLite (local dev); it matters on Postgres (prod).
        try:
            session.refresh(grant.user, with_for_update=True)
        except Exception:  # noqa: BLE001 — detached/unsupported: proceed unlocked
            pass
        remaining = grant.credits_cost
        from_sub = min(grant.user.subscription_credits, remaining)
        grant.user.subscription_credits -= from_sub
        remaining -= from_sub
        grant.user.credits = max(0, grant.user.credits - remaining)
        session.add(grant.user)
        session.commit()
    elif grant.method == "pay-token" and grant.session_id:
        session.add(RedeemedSession(session_id=grant.session_id))
        session.commit()
    # byok consumes nothing.
