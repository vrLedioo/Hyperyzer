"""Team seats: invite/accept, shared-pool spend, overspend floor, delete cascade."""
from sqlmodel import Session, select

from access import AccessGrant, apply_consumption, resolve_access
from db import engine
from models import Team, TeamMembership, User


def _agency_owner(make_user, credits=3000):
    """Create an Agency owner with a team; return (owner_id, team_id)."""
    owner_id = make_user("owner@t.com", plan="agency", subscription_status="active",
                         subscription_credits=credits)
    with Session(engine) as s:
        team = Team(owner_id=owner_id, name="Acme")
        s.add(team)
        s.commit()
        s.refresh(team)
        o = s.get(User, owner_id)
        o.team_id = team.id
        o.team_role = "owner"
        s.add(o)
        s.commit()
        return owner_id, team.id


def test_member_spends_owner_pool(make_user):
    owner_id, tid = _agency_owner(make_user)
    member_id = make_user("m@t.com", team_id=tid, team_role="member")
    with Session(engine) as s:
        member = s.get(User, member_id)
        grant = resolve_access(user=member, user_api_key=None, pay_token=None, session=s, cost=3)
        assert grant.method == "credit"
        assert grant.user.id == owner_id  # pool routed to the owner
        apply_consumption(grant, s)
    with Session(engine) as s:
        assert s.get(User, owner_id).subscription_credits == 2997
        m = s.get(User, member_id)
        assert m.subscription_credits == 0 and m.credits == 0  # member's own untouched


def test_overspend_is_floored_not_negative(make_user):
    owner_id, _ = _agency_owner(make_user, credits=2)
    with Session(engine) as s:
        owner = s.get(User, owner_id)
        # Construct a grant that would overspend (cost > balance) and ensure the
        # floor holds (defense-in-depth; resolve_access normally blocks this).
        grant = AccessGrant(method="credit", user=owner, credits_cost=5)
        apply_consumption(grant, s)
    with Session(engine) as s:
        owner = s.get(User, owner_id)
        assert owner.subscription_credits == 0 and owner.credits == 0  # never negative


def test_invite_and_accept_flow(client, make_user, auth):
    owner_id, tid = _agency_owner(make_user)
    # Owner invites a new email
    r = client.post("/api/team/invite", json={"email": "newbie@t.com"}, headers=auth(owner_id))
    assert r.status_code == 200, r.text
    assert r.json()["seats_used"] == 1
    # Grab the invite token
    with Session(engine) as s:
        membership = s.exec(select(TeamMembership).where(TeamMembership.email == "newbie@t.com")).first()
        token = membership.invite_token
    # The invitee signs up (verified) and accepts
    member_id = make_user("newbie@t.com")
    r = client.post("/api/team/accept", json={"token": token}, headers=auth(member_id))
    assert r.status_code == 200, r.text
    # Member now inherits agency entitlement + the owner's pool
    me = client.get("/api/auth/me", headers=auth(member_id)).json()
    assert me["effective_plan"] == "agency"
    assert me["pool_credits"] == 3000
    assert "teams" in me["studio_features"]


def test_accept_wrong_email_blocked(client, make_user, auth):
    owner_id, tid = _agency_owner(make_user)
    client.post("/api/team/invite", json={"email": "intended@t.com"}, headers=auth(owner_id))
    with Session(engine) as s:
        token = s.exec(select(TeamMembership).where(TeamMembership.email == "intended@t.com")).first().invite_token
    other_id = make_user("someoneelse@t.com")
    r = client.post("/api/team/accept", json={"token": token}, headers=auth(other_id))
    assert r.status_code == 403  # invite bound to the intended address


def test_personal_subscriber_cannot_accept(client, make_user, auth):
    owner_id, tid = _agency_owner(make_user)
    client.post("/api/team/invite", json={"email": "paying@t.com"}, headers=auth(owner_id))
    with Session(engine) as s:
        token = s.exec(select(TeamMembership).where(TeamMembership.email == "paying@t.com")).first().invite_token
    paying_id = make_user("paying@t.com", plan="pro", subscription_status="active", subscription_credits=800)
    r = client.post("/api/team/accept", json={"token": token}, headers=auth(paying_id))
    assert r.status_code == 409  # would be double-billed


def test_non_agency_cannot_invite(client, make_user, auth):
    pro_id = make_user("pro@t.com", plan="pro", subscription_status="active", subscription_credits=800)
    r = client.post("/api/team/invite", json={"email": "x@t.com"}, headers=auth(pro_id))
    assert r.status_code == 403  # 'teams' is Agency-only


def test_owner_delete_dissolves_team(client, make_user, auth):
    owner_id, tid = _agency_owner(make_user)
    member_id = make_user("m@t.com", team_id=tid, team_role="member")
    with Session(engine) as s:
        s.add(TeamMembership(team_id=tid, user_id=member_id, email="m@t.com", status="active"))
        s.commit()
    # Owner deletes their account (GDPR)
    r = client.delete("/api/auth/account", headers=auth(owner_id))
    assert r.status_code == 204
    with Session(engine) as s:
        assert s.get(Team, tid) is None                 # team gone
        assert s.get(User, owner_id) is None             # owner gone
        member = s.get(User, member_id)
        assert member is not None                        # member survives
        assert member.team_id is None and member.team_role is None  # detached
