"""Fix-it report extras: cleaning, persistence, and history round-trip."""
import routers.analyze_router as ar
from services.scoring import ScoreResult, _clean_improvements


def test_clean_improvements_normalizes_messy_model_output():
    out = _clean_improvements({
        "verdict": "  Fix the hook first.  ",
        "hook_rewrites": ["  Say this instead ", "", 42, "Another take", "third", "FOURTH-over-cap"],
        "title_suggestions": {"not": "a list"},
        "caption": "Post this 🚀",
        "retention_risks": [
            {"moment": "sec 8-12", "risk": "slow setup", "fix": "cut to the reveal"},
            {"moment": "", "risk": "", "fix": ""},  # dropped: no risk/fix
            "not a dict",
        ],
    })
    assert out["verdict"] == "Fix the hook first."
    assert out["hook_rewrites"] == ["Say this instead", "Another take", "third"]
    assert out["title_suggestions"] == []
    assert out["caption"] == "Post this 🚀"
    assert out["retention_risks"] == [
        {"moment": "sec 8-12", "risk": "slow setup", "fix": "cut to the reveal"},
    ]


def test_clean_improvements_degrades_to_empty_when_absent():
    out = _clean_improvements({"hook_score": 70})
    assert out == {
        "verdict": "", "hook_rewrites": [], "title_suggestions": [],
        "caption": "", "retention_risks": [],
    }


def test_analyze_idea_returns_and_persists_improvements(client, make_user, auth, monkeypatch):
    uid = make_user("fx@t.com", credits=10)
    improvements = {
        "verdict": "Lead with the stakes.",
        "hook_rewrites": ["I bet my channel on this."],
        "title_suggestions": ["I Risked It All"],
        "caption": "Would you do this? 👇",
        "retention_risks": [{"moment": "0-3s", "risk": "flat open", "fix": "start mid-action"}],
    }
    monkeypatch.setattr(ar, "score_content", lambda *a, **kw: ScoreResult(
        hook_score=80, retention_score=70, viral_score=75, feedback="ok",
        improvements=improvements,
    ))

    r = client.post("/api/analyze-idea", json={"title": "t", "script": "s"}, headers=auth(uid))
    assert r.status_code == 200, r.text
    assert r.json()["improvements"] == improvements

    # History round-trips the stored JSON.
    h = client.get("/api/history", headers=auth(uid))
    assert h.status_code == 200
    assert h.json()[0]["improvements"] == improvements


def test_analyze_idea_tolerates_legacy_rows_without_improvements(client, make_user, auth, monkeypatch):
    uid = make_user("legacy@t.com", credits=10)
    monkeypatch.setattr(ar, "score_content", lambda *a, **kw: ScoreResult(
        hook_score=60, retention_score=60, viral_score=60, feedback="ok",
    ))
    r = client.post("/api/analyze-idea", json={"title": "t", "script": "s"}, headers=auth(uid))
    assert r.status_code == 200, r.text
    # Default-constructed ScoreResult -> empty dict, not an error.
    assert r.json()["improvements"] == {}
