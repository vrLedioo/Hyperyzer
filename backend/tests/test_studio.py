"""Studio entitlement + credit-spend behavior."""
import routers.studio_router as sr
from sqlmodel import Session, select

from db import engine
from models import Generation, User

DUMMY_SCRIPT = {"title": "T", "hook": "H", "beats": [], "cta": "C", "caption": "", "hashtags": []}


def _pro(make_user):
    return make_user("pro@t.com", plan="pro", subscription_status="active", subscription_credits=800)


def test_free_user_blocked(client, make_user, auth):
    uid = make_user("free@t.com")  # plan defaults to free
    r = client.post("/api/studio/script", json={"idea": "x"}, headers=auth(uid))
    assert r.status_code == 403


def test_creator_user_blocked(client, make_user, auth):
    uid = make_user("creator@t.com", plan="creator", subscription_status="active", subscription_credits=150)
    r = client.post("/api/studio/script", json={"idea": "x"}, headers=auth(uid))
    assert r.status_code == 403


def test_pro_user_generates_and_spends(client, make_user, auth, monkeypatch):
    monkeypatch.setattr(sr, "write_script", lambda *a, **k: dict(DUMMY_SCRIPT))
    uid = _pro(make_user)
    r = client.post("/api/studio/script", json={"idea": "100 days hardcore"}, headers=auth(uid))
    assert r.status_code == 200, r.text
    assert r.json()["output"]["hook"] == "H"
    with Session(engine) as s:
        u = s.get(User, uid)
        assert u.subscription_credits == 800 - 3  # script cost
        assert len(s.exec(select(Generation)).all()) == 1


def test_byok_does_not_spend_credits(client, make_user, auth, monkeypatch):
    monkeypatch.setattr(sr, "write_script", lambda *a, **k: dict(DUMMY_SCRIPT))
    uid = _pro(make_user)
    r = client.post("/api/studio/script",
                    json={"idea": "x", "user_api_key": "sk-user-byok"}, headers=auth(uid))
    assert r.status_code == 200
    with Session(engine) as s:
        assert s.get(User, uid).subscription_credits == 800  # unchanged on BYOK


def test_optimize_charged_once(client, make_user, auth, monkeypatch):
    monkeypatch.setattr(sr, "optimize_script", lambda *a, **k: {
        "before": {"hook_score": 40, "retention_score": 40, "viral_score": 40},
        "after": {"hook_score": 80, "retention_score": 75, "viral_score": 70},
        "rewritten_title": "Better", "rewritten_script": "Better script", "changes": ["tighter hook"],
    })
    uid = _pro(make_user)
    r = client.post("/api/studio/optimize",
                    json={"title": "t", "script": "weak script"}, headers=auth(uid))
    assert r.status_code == 200
    out = r.json()["output"]
    assert out["after"]["hook_score"] > out["before"]["hook_score"]
    with Session(engine) as s:
        assert s.get(User, uid).subscription_credits == 800 - 4  # optimize cost, charged once


def test_insufficient_credits_402(client, make_user, auth, monkeypatch):
    monkeypatch.setattr(sr, "write_script", lambda *a, **k: dict(DUMMY_SCRIPT))
    uid = make_user("broke@t.com", plan="pro", subscription_status="active", subscription_credits=1)
    r = client.post("/api/studio/script", json={"idea": "x"}, headers=auth(uid))
    assert r.status_code == 402  # entitled (pro) but not enough credits for cost=3
