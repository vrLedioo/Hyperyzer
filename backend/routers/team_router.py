"""Team (Agency seats) endpoints.

An Agency owner invites members who share the owner's credit pool and inherit
Agency Studio capabilities (see studio.py / access.py). The owner's User row IS
the pool and holds the subscription, so nothing here touches billing.

Entitlement: the "teams" feature is Agency-only, enforced via require_feature.
Only the owner may invite/revoke. Members accept an emailed single-use link.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from auth import get_current_user
from config import settings
from db import get_session
from limiter import limiter
from models import Team, TeamMembership, User
from services.email import send_team_invite
from studio import ensure_owned_team, require_feature

router = APIRouter(prefix="/api/team", tags=["team"])

_OPEN_STATUSES = ("invited", "active")  # statuses that occupy a seat


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #
class InviteRequest(BaseModel):
    email: EmailStr


class AcceptRequest(BaseModel):
    token: str


class MemberOut(BaseModel):
    membership_id: int
    email: str
    role: str
    status: str


class TeamOut(BaseModel):
    team_id: int
    name: str
    role: str               # the caller's role: "owner" | "member"
    owner_email: str
    seat_limit: int
    seats_used: int         # members occupying a seat (excludes owner)
    members: list[MemberOut]


class MessageResponse(BaseModel):
    message: str


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _seats_used(team_id: int, session: Session) -> int:
    rows = session.exec(
        select(TeamMembership).where(
            TeamMembership.team_id == team_id,
            TeamMembership.status.in_(_OPEN_STATUSES),
        )
    ).all()
    return len(rows)


def _team_out(team: Team, caller: User, session: Session) -> TeamOut:
    owner = session.get(User, team.owner_id)
    members = session.exec(
        select(TeamMembership).where(
            TeamMembership.team_id == team.id,
            TeamMembership.status.in_(_OPEN_STATUSES),
        ).order_by(TeamMembership.invited_at)
    ).all()
    return TeamOut(
        team_id=team.id,
        name=team.name,
        role=caller.team_role or ("owner" if owner and owner.id == caller.id else "member"),
        owner_email=owner.email if owner else "",
        seat_limit=team.seat_limit,
        seats_used=len(members),
        members=[
            MemberOut(membership_id=m.id, email=m.email, role=m.role, status=m.status)
            for m in members
        ],
    )


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@router.post("/invite", response_model=TeamOut)
@limiter.limit("20/minute")
def invite_member(
    request: Request,
    req: InviteRequest,
    user: User = Depends(require_feature("teams")),
    session: Session = Depends(get_session),
):
    if user.team_id and user.team_role == "member":
        raise HTTPException(status_code=403, detail="Only the team owner can invite members.")

    team = ensure_owned_team(user, session)
    email = req.email.lower().strip()

    if email == user.email.lower():
        raise HTTPException(status_code=400, detail="You're already the team owner.")

    # Already invited/active on this team?
    existing = session.exec(
        select(TeamMembership).where(
            TeamMembership.team_id == team.id,
            TeamMembership.email == email,
            TeamMembership.status.in_(_OPEN_STATUSES),
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="That email is already invited or on the team.")

    if _seats_used(team.id, session) >= team.seat_limit:
        raise HTTPException(
            status_code=403,
            detail=f"Your team is full ({team.seat_limit} seats). Remove a member to free a seat.",
        )

    membership = TeamMembership(team_id=team.id, email=email, role="member", status="invited")
    session.add(membership)
    session.commit()
    session.refresh(membership)

    accept_url = f"{settings.frontend_url}/team/accept?token={membership.invite_token}"
    send_team_invite(email, accept_url, team.name, user.email)
    return _team_out(team, user, session)


@router.get("", response_model=TeamOut)
def get_team(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not user.team_id:
        raise HTTPException(status_code=404, detail="You're not part of a team.")
    team = session.get(Team, user.team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    return _team_out(team, user, session)


@router.delete("/members/{membership_id}", response_model=TeamOut)
def remove_member(
    membership_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Owner removes a member or revokes a pending invite."""
    if not (user.team_id and user.team_role == "owner"):
        raise HTTPException(status_code=403, detail="Only the team owner can remove members.")
    team = session.get(Team, user.team_id)
    membership = session.get(TeamMembership, membership_id)
    if not team or not membership or membership.team_id != team.id:
        raise HTTPException(status_code=404, detail="Membership not found.")
    if membership.role == "owner":
        raise HTTPException(status_code=400, detail="The owner can't be removed.")

    # Detach the member's account from the team so they revert to their own plan.
    if membership.user_id:
        member = session.get(User, membership.user_id)
        if member and member.team_id == team.id:
            member.team_id = None
            member.team_role = None
            session.add(member)
    membership.status = "removed"
    session.add(membership)
    session.commit()
    return _team_out(team, user, session)


@router.post("/accept", response_model=MessageResponse)
@limiter.limit("10/minute")
def accept_invite(
    request: Request,
    req: AcceptRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    membership = session.exec(
        select(TeamMembership).where(TeamMembership.invite_token == req.token)
    ).first()
    if not membership or membership.status != "invited":
        raise HTTPException(status_code=400, detail="Invalid or already-used invite link.")
    if membership.email.lower() != user.email.lower():
        raise HTTPException(
            status_code=403,
            detail="This invite was sent to a different email. Log in with that address to accept.",
        )
    if user.team_id:
        raise HTTPException(status_code=409, detail="You're already part of a team.")
    # Avoid silent double-billing: a personal subscriber would keep paying while
    # spending the team's pool. Make them cancel first.
    if user.subscription_status == "active":
        raise HTTPException(
            status_code=409,
            detail="Cancel your personal subscription before joining a team (you'd be billed twice otherwise).",
        )

    team = session.get(Team, membership.team_id)
    if not team:
        raise HTTPException(status_code=400, detail="That team no longer exists.")

    user.team_id = team.id
    user.team_role = "member"
    membership.user_id = user.id
    membership.status = "active"
    membership.accepted_at = datetime.now(timezone.utc)
    session.add(user)
    session.add(membership)
    session.commit()
    return MessageResponse(message=f"You've joined {team.name}. The Studio is now unlocked.")


@router.post("/leave", response_model=MessageResponse)
@limiter.limit("10/minute")
def leave_team(
    request: Request,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not (user.team_id and user.team_role == "member"):
        raise HTTPException(status_code=400, detail="You're not a team member.")
    membership = session.exec(
        select(TeamMembership).where(
            TeamMembership.team_id == user.team_id,
            TeamMembership.user_id == user.id,
            TeamMembership.status == "active",
        )
    ).first()
    if membership:
        membership.status = "removed"
        session.add(membership)
    user.team_id = None
    user.team_role = None
    session.add(user)
    session.commit()
    return MessageResponse(message="You've left the team.")
