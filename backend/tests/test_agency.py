"""Agency depth: client profiles, bulk (charge only successes), calendar, gating."""
import routers.studio_router as sr
from sqlmodel import Session

from db import engine
from models import User
from services.scoring import ScoreResult, ScoringError


def _agency(make_user, credits=3000):
    return make_user("ag@t.com", plan="agency", subscription_status="active",
                     subscription_credits=credits)


def _pro(make_user):
    return make_user("pro@t.com", plan="pro", subscription_status="active", subscription_credits=800)


def test_clients_are_agency_only(client, make_user, auth):
    pro_id = _pro(make_user)
    r = client.post("/api/studio/clients", json={"name": "Acme"}, headers=auth(pro_id))
    assert r.status_code == 403  # 'clients' is Agency-only


def test_client_crud_and_targeting(client, make_user, auth, monkeypatch):
    ag_id = _agency(make_user)
    # create
    r = client.post("/api/studio/clients",
                    json={"name": "Acme", "audience": "Gen Z gamers", "niche": "speedruns", "tone": "hype"},
                    headers=auth(ag_id))
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    # list
    r = client.get("/api/studio/clients", headers=auth(ag_id))
    assert r.status_code == 200 and len(r.json()) == 1
    # a script generation targeting the client passes the client's targeting through
    captured = {}

    def fake_script(idea, **kw):
        captured.update(kw)
        return {"title": "T", "hook": "H", "beats": [], "cta": "", "caption": "", "hashtags": []}

    monkeypatch.setattr(sr, "write_script", fake_script)
    r = client.post("/api/studio/script", json={"idea": "x", "client_id": cid}, headers=auth(ag_id))
    assert r.status_code == 200
    assert "Gen Z gamers" in (captured.get("audience") or "")
    assert "speedruns" in (captured.get("audience") or "")
    assert captured.get("tone") == "hype"
    # delete
    r = client.delete(f"/api/studio/clients/{cid}", headers=auth(ag_id))
    assert r.status_code == 204
    assert client.get("/api/studio/clients", headers=auth(ag_id)).json() == []


def test_bulk_charges_only_successful_items(client, make_user, auth, monkeypatch):
    ag_id = _agency(make_user, credits=100)

    def flaky_score(title, script, **kw):
        if "boom" in script:
            raise ScoringError("model exploded")
        return ScoreResult(hook_score=70, retention_score=60, viral_score=50, feedback="ok")

    monkeypatch.setattr(sr, "score_content", flaky_score)
    r = client.post("/api/studio/bulk", json={"items": [
        {"title": "a", "script": "good one"},
        {"title": "b", "script": "boom fails"},
        {"title": "c", "script": "also good"},
    ]}, headers=auth(ag_id))
    assert r.status_code == 200, r.text
    body = r.json()["output"]
    assert body["succeeded"] == 2
    assert body["charged_credits"] == 2  # only the 2 successes, at 1 credit each
    with Session(engine) as s:
        assert s.get(User, ag_id).subscription_credits == 100 - 2


def test_calendar_generates(client, make_user, auth, monkeypatch):
    monkeypatch.setattr(sr, "generate_calendar", lambda *a, **k: {
        "summary": "week plan", "posts": [{"day": "Day 1", "idea": "i", "hook": "h", "format": "f", "best_time": "6 PM"}],
    })
    ag_id = _agency(make_user)
    r = client.post("/api/studio/calendar", json={"niche": "fitness", "days": 7}, headers=auth(ag_id))
    assert r.status_code == 200, r.text
    assert r.json()["output"]["posts"][0]["day"] == "Day 1"
    with Session(engine) as s:
        assert s.get(User, ag_id).subscription_credits == 3000 - 8  # calendar cost


def test_pro_cannot_use_calendar(client, make_user, auth):
    pro_id = _pro(make_user)
    r = client.post("/api/studio/calendar", json={"niche": "fitness"}, headers=auth(pro_id))
    assert r.status_code == 403
