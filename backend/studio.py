"""Studio entitlement — plan-level capability gating, team-aware.

Entitlement (which plan unlocks a feature) is ORTHOGONAL to payment (who pays,
handled by access.resolve_access). A Studio endpoint composes the two:

    user = Depends(require_feature("script"))          # entitlement (this module)
    grant = resolve_access(user=user, ..., pay_token=None, cost=...)  # payment

Because the gate depends on get_current_user, the anonymous pay-token path can
never reach Studio (no account => 401). BYOK is gated by plan but still allowed
for payment — a Pro/Agency user may run Studio for free on their own key; a
Creator with a key is still blocked.

Team handling: an Agency owner's credit pool and subscription back the whole
team. A member's *effective* plan + credit pool resolve to the owner's while the
owner's Agency subscription is active; otherwise the member falls back to their
own (possibly free) plan and credits. This keeps capability and billing in sync.
"""
from typing import Optional

from fastapi import Depends, HTTPException
from sqlmodel import Session

from auth import get_current_user
from db import get_session
from models import Team, User
from plans import plan_features, plan_has_feature


def team_owner(user: User, session: Session) -> Optional[User]:
    """The owner User backing this member's team, or None for a non-member."""
    if user.team_id and user.team_role == "member":
        team = session.get(Team, user.team_id)
        if team and team.owner_id != user.id:
            return session.get(User, team.owner_id)
    return None


def pool_user(user: User, session: Session) -> User:
    """The User whose credit buckets back this caller's spend.

    For a team member with an active-subscription owner, that's the owner (shared
    pool). Otherwise it's the caller themselves.
    """
    owner = team_owner(user, session)
    if owner and owner.subscription_status == "active":
        return owner
    return user


def effective_plan(user: User, session: Session) -> str:
    """The plan key whose capabilities this caller actually has.

    Active team backing wins; else the caller's own active subscription; else
    'free'. (A non-active subscription confers no Studio capability.)
    """
    owner = team_owner(user, session)
    if owner and owner.subscription_status == "active":
        return owner.plan
    return user.plan if user.subscription_status == "active" else "free"


def effective_features(user: User, session: Session) -> set[str]:
    """The Studio feature keys this caller can use right now (team-aware)."""
    return plan_features(effective_plan(user, session))


def require_feature(feature: str):
    """FastAPI dependency factory: 403 unless the caller's effective plan unlocks
    `feature`. Returns the (member) User on success."""
    def dep(
        user: User = Depends(get_current_user),
        session: Session = Depends(get_session),
    ) -> User:
        plan = effective_plan(user, session)
        if not plan_has_feature(plan, feature):
            # Distinguish "team plan lapsed" from "needs upgrade" for a clearer UX.
            if user.team_id and user.team_role == "member":
                raise HTTPException(
                    status_code=403,
                    detail="Your team's Agency plan is no longer active. Ask the team owner to renew.",
                )
            raise HTTPException(
                status_code=403,
                detail="This tool requires an active Pro or Agency plan. Upgrade to unlock the Studio.",
            )
        return user
    return dep


def ensure_owned_team(user: User, session: Session) -> Team:
    """Return the team this user owns, creating one on demand for an Agency owner
    who has none yet. Rejects a user who is a member of someone else's team."""
    if user.team_id and user.team_role == "member":
        raise HTTPException(
            status_code=409,
            detail="You're a member of another team. Leave it before managing your own.",
        )
    if user.team_id and user.team_role == "owner":
        team = session.get(Team, user.team_id)
        if team:
            return team
    team = Team(owner_id=user.id, name=f"{user.email.split('@')[0]}'s team")
    session.add(team)
    session.commit()
    session.refresh(team)
    user.team_id = team.id
    user.team_role = "owner"
    session.add(user)
    session.commit()
    return team
