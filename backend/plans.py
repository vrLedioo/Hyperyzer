"""Subscription plans and one-time credit packs — the pricing catalog.

This is the single source of truth for what we sell. Prices here are *display
only*; the real charge lives in the matching provider price/variant. Each plan /
pack is linked to a price id supplied via env vars (see config for the active
payment provider — Paddle, Lemon Squeezy, or Stripe).

Monetization model:
  - A subscription grants a monthly bucket of credits (`monthly_credits`) that is
    refilled on every successful renewal payment (it does NOT roll over).
  - A credit pack is a one-time top-up of `credits` that never expires.
  - Both buckets are spent by analyses; subscription credits are spent first
    (use-it-or-lose-it), purchased pack credits second.

Studio (creation tools) is a PLAN-level entitlement, separate from credits:
  - Pro + Agency unlock the "Studio" generators (script writer, ad scripts,
    hooks, one-click optimize). Agency adds team/agency depth (client profiles,
    bulk, white-label PDF, content calendar, team seats).
  - Free / Creator never get Studio, regardless of how many credits they hold.
    Studio calls still SPEND credits — the plan gates access, credits pay.
  - `features` is the set of capability keys a plan unlocks (see studio.py /
    plan_has_feature). Keep these keys in sync with the Studio router.
"""

# Studio capability keys (also referenced by studio.py / studio_router.py).
PRO_FEATURES = {"script", "ad_script", "hooks", "optimize"}
AGENCY_FEATURES = PRO_FEATURES | {"clients", "bulk", "whitelabel_pdf", "calendar", "teams"}

# Plan key -> metadata. Order matters for display (cheapest first).
PLANS: dict[str, dict] = {
    "creator": {
        "name": "Creator",
        "price_eur": 14,
        "monthly_credits": 150,
        "priority": False,
        "team": False,
        "studio": False,
        "features": set(),
        "tagline": "For creators posting every week.",
    },
    "pro": {
        "name": "Pro",
        "price_eur": 39,
        "monthly_credits": 800,
        "priority": True,
        "team": False,
        "studio": True,
        "features": set(PRO_FEATURES),
        "tagline": "Analyze AND create — full script studio for daily creators.",
    },
    "agency": {
        "name": "Agency",
        "price_eur": 99,
        "monthly_credits": 3000,
        "priority": True,
        "team": True,
        "studio": True,
        "features": set(AGENCY_FEATURES),
        "tagline": "For teams and agencies running many client accounts.",
    },
}

# Pack key -> metadata. Packs top up analyzer credits only — they do NOT grant
# Studio access (that is subscription-gated).
PACKS: dict[str, dict] = {
    "small": {"name": "Starter pack", "price_eur": 9, "credits": 50},
    "large": {"name": "Value pack", "price_eur": 29, "credits": 200},
}


def plan_monthly_credits(plan_key: str | None) -> int:
    p = PLANS.get(plan_key or "")
    return int(p["monthly_credits"]) if p else 0


def pack_credits(pack_key: str | None) -> int:
    p = PACKS.get(pack_key or "")
    return int(p["credits"]) if p else 0


def plan_features(plan_key: str | None) -> set[str]:
    """The set of Studio capability keys a plan unlocks ('free'/unknown -> none)."""
    p = PLANS.get(plan_key or "")
    return set(p["features"]) if p else set()


def plan_has_feature(plan_key: str | None, feature: str) -> bool:
    """Whether a plan unlocks a given Studio feature. False for free/unknown."""
    return feature in plan_features(plan_key)
