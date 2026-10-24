"""Agent 4 (behavioural biometrics) as wired into the platform: access control, signal storage, degradation.

Uses the real documented examples shipped with Agent 4 (a human, a scripted bot, a too-short session), so the
integrated path is checked against the standalone model's own published output. Isolated in-memory DB.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.api.routes import behavior
from src.core.auth import create_access_token, hash_password
from src.db.database import Base, get_db
from src.db.models import BehaviorReviewEventModel, BehaviorSignalModel, UserModel
from src.services import behavior_signals

BACKEND_DIR = Path(__file__).resolve().parents[1]
AGENT4_ROOT = behavior_signals.find_agent4_root()
assert AGENT4_ROOT is not None, "agent-4-behavioral-biometrics must sit next to backend/ (or set AGENT4_ROOT)"
EXAMPLES = AGENT4_ROOT / "docs" / "examples"

PASSWORD = "Password123!"
USERS = {
    "msme": ("msme@test.in", "msme", "M101"),
    "auditor": ("auditor@test.in", "government_auditor", None),
    "admin": ("admin@test.in", "admin", None),
}


def example(name):
    return json.loads((EXAMPLES / f"{name}.request.json").read_text()), json.loads((EXAMPLES / f"{name}.response.json").read_text())


@pytest.fixture(scope="module")
def session_factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine)
    db = factory()
    hashed = hash_password(PASSWORD)  # bcrypt is slow on purpose: hash once
    for email, role, msme_id in USERS.values():
        db.add(UserModel(email=email, hashed_password=hashed, full_name=role, role=role, msme_id=msme_id, is_active=True))
    db.commit()
    db.close()
    return factory


@pytest.fixture()
def db(session_factory):
    session = session_factory()
    session.query(BehaviorReviewEventModel).delete()
    session.query(BehaviorSignalModel).delete()
    session.commit()
    yield session
    session.close()


@pytest.fixture()
def client(session_factory, db):
    app = FastAPI()
    app.include_router(behavior.router, prefix="/api")

    def override_db():
        s = session_factory()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


def auth(who):
    return {"Authorization": f"Bearer {create_access_token({'sub': USERS[who][0]})}"}


def submit(client, who="msme", **body):
    return client.post("/api/behavior/submit", json=body, headers=auth(who))


def signals(client, **params):
    r = client.get("/api/behavior/signals", params=params, headers=auth("auditor"))
    assert r.status_code == 200, r.text
    return r.json()["signals"]


# ───────────────────────── access control ─────────────────────────

@pytest.mark.parametrize("method,path", [
    ("post", "/api/behavior/analyze"), ("post", "/api/behavior/submit"), ("get", "/api/behavior/signals"),
])
def test_every_endpoint_needs_a_login(client, method, path):
    assert client.request(method.upper(), path).status_code == 401
    assert client.request(method.upper(), path, headers={"Authorization": "Bearer not-a-token"}).status_code == 401


def test_bidders_cannot_read_scores(client):
    req, _ = example("human_full")
    assert client.post("/api/behavior/analyze", json=req, headers=auth("msme")).status_code == 403
    assert client.get("/api/behavior/signals", headers=auth("msme")).status_code == 403


def test_reviewers_cannot_submit_bids_signals(client):
    assert submit(client, who="auditor", reference="BID-1").status_code == 403


def test_health_is_public(client):
    r = client.get("/api/behavior/health")
    assert r.status_code == 200 and r.json()["model_loaded"] is True


# ───────────────────────── analyze (reviewers) ─────────────────────────

@pytest.mark.parametrize("name", ["human_full", "human_flight_only", "automation_full", "adaptive_bot_long", "too_short"])
@pytest.mark.parametrize("who", ["auditor", "admin"])
def test_analyze_matches_the_standalone_model_output(client, name, who):
    req, expected = example(name)
    r = client.post("/api/behavior/analyze", json=req, headers=auth(who))
    assert r.status_code == 200, r.text
    got = r.json()
    for key in ("status", "behavioral_risk_score", "risk_category", "behavioral_anomaly", "reliability", "scoring_mode"):
        assert got[key] == expected[key], key


def test_analyze_response_schema_has_not_drifted_from_agent4():
    from agent4.service import BehaviorResponse
    assert set(behavior.AnalysisResult.model_fields) == set(BehaviorResponse.model_fields)


def test_scripted_bot_is_flagged_and_human_is_not(client):
    bot, _ = example("automation_full")
    human, _ = example("human_full")
    assert client.post("/api/behavior/analyze", json=bot, headers=auth("auditor")).json()["risk_category"] == "HIGH_ANOMALY"
    assert client.post("/api/behavior/analyze", json=human, headers=auth("auditor")).json()["risk_category"] == "LOW_ANOMALY"


# ───────────────────────── the privacy contract ─────────────────────────

@pytest.mark.parametrize("path,body", [
    ("/api/behavior/analyze", {"session_id": "s1", "intervals": [100.0] * 20, "text": "secret"}),
    ("/api/behavior/analyze", {"session_id": "s1", "intervals": [100.0] * 20, "key": "a"}),
    ("/api/behavior/analyze", {"session_id": "jane.doe@example.com", "intervals": [100.0] * 20}),
    ("/api/behavior/analyze", {"session_id": "s1", "intervals": [100.0] * 20, "hold_durations": [90.0] * 19}),
    ("/api/behavior/analyze", {"session_id": "s1", "intervals": [-5.0] * 20}),
    ("/api/behavior/submit", {"reference": "B1", "intervals": [100.0] * 20, "typed_text": "abc"}),
    ("/api/behavior/submit", {"reference": "B1", "hold_durations": [90.0] * 20}),
    ("/api/behavior/submit", {"reference": "bad ref!"}),
])
def test_only_timing_numbers_are_accepted(client, path, body):
    who = "msme" if path.endswith("submit") else "auditor"
    assert client.post(path, json=body, headers=auth(who)).status_code == 422


def test_whole_number_timings_from_the_browser_are_accepted(client):
    """The Bot Detection page's simulated bot sends integers (12 ms / 8 ms), and JSON has no int/float split."""
    body = {"session_id": "ints", "intervals": [12] * 45, "hold_durations": [8] * 45}
    r = client.post("/api/behavior/analyze", json=body, headers=auth("auditor"))
    assert r.status_code == 200 and r.json()["risk_category"] == "HIGH_ANOMALY"
    assert submit(client, reference="BID-7", intervals=[12] * 45, hold_durations=[8] * 45).status_code == 201


def test_raw_timings_are_never_stored():
    columns = {c.name for c in BehaviorSignalModel.__table__.columns}
    assert not {"intervals", "hold_durations", "text", "key"} & columns


# ───────────────────────── submit and signals ─────────────────────────

def test_bidder_gets_an_acknowledgement_and_no_score(client):
    req, _ = example("automation_full")
    r = submit(client, reference="BID-9", session_id="sess-1", intervals=req["intervals"], hold_durations=req["hold_durations"])
    assert r.status_code == 201
    assert set(r.json()) == {"received", "reference", "session_id", "recorded_at"}
    assert "risk" not in json.dumps(r.json()).lower() and "anomal" not in json.dumps(r.json()).lower()


def test_reviewer_sees_the_scored_signal_with_evidence(client):
    req, expected = example("automation_full")
    submit(client, reference="BID-9", session_id="sess-1", intervals=req["intervals"], hold_durations=req["hold_durations"])
    (row,) = signals(client)
    assert row["status"] == "scored" and row["reference"] == "BID-9" and row["session_id"] == "sess-1"
    assert row["msme_id"] == "M101"
    assert row["behavioral_risk_score"] == expected["behavioral_risk_score"]
    assert row["risk_category"] == "HIGH_ANOMALY" and row["behavioral_anomaly"] is True
    assert row["needs_review"] is True
    assert row["behavioral_evidence"] == expected["behavioral_evidence"]
    assert row["model_version"] == expected["model_version"]


def test_human_bid_is_recorded_without_a_review_flag(client):
    req, _ = example("human_full")
    submit(client, reference="BID-1", intervals=req["intervals"], hold_durations=req["hold_durations"])
    (row,) = signals(client)
    assert row["status"] == "scored" and row["needs_review"] is False
    assert row["session_id"].startswith("srv-")  # generated when the client sends none


@pytest.mark.parametrize("body", [{}, {"intervals": []}, {"intervals": None}])
def test_a_bid_without_timing_is_its_own_signal(client, body):
    assert submit(client, reference="BID-2", **body).status_code == 201
    (row,) = signals(client)
    assert row["status"] == "no_timing" and row["needs_review"] is True
    assert row["behavioral_risk_score"] is None
    assert "assistive" in row["message"]  # reviewers are told this is not proof of automation


def test_a_too_short_session_is_recorded_but_not_scored(client):
    req, _ = example("too_short")
    submit(client, reference="BID-3", intervals=req["intervals"], hold_durations=req["hold_durations"])
    (row,) = signals(client)
    assert row["status"] == "insufficient_data" and row["behavioral_risk_score"] is None
    assert row["needs_review"] is False


def test_malformed_timing_is_recorded_and_never_blocks(db):
    row = behavior_signals.record_signal(db, reference="BID-4", intervals=[1.0, 2.0, 3.0], hold_durations=[1.0, 2.0])
    assert row.status == "invalid_timing" and row.needs_review is True and row.id is not None


def test_signal_filters(client):
    bot, _ = example("automation_full")
    human, _ = example("human_full")
    submit(client, reference="A", intervals=human["intervals"], hold_durations=human["hold_durations"])
    submit(client, reference="B", intervals=bot["intervals"], hold_durations=bot["hold_durations"])
    submit(client, reference="C")
    assert len(signals(client)) == 3
    assert [s["reference"] for s in signals(client, needs_review=True)] == ["C", "B"]  # newest first; human A excluded
    assert [s["reference"] for s in signals(client, reference="A")] == ["A"]
    assert len(signals(client, limit=1)) == 1
    assert client.get("/api/behavior/signals", params={"limit": 0}, headers=auth("auditor")).status_code == 422


# ───────────────────────── degradation: Agent 4 missing or broken ─────────────────────────

@pytest.fixture()
def agent4_missing(monkeypatch):
    monkeypatch.setattr(behavior_signals, "_scorer", None)
    monkeypatch.setattr(behavior_signals, "find_agent4_root", lambda: None)


def test_a_bid_is_still_accepted_when_agent4_is_missing(client, agent4_missing):
    req, _ = example("human_full")
    assert submit(client, reference="BID-5", intervals=req["intervals"], hold_durations=req["hold_durations"]).status_code == 201
    (row,) = signals(client)
    assert row["status"] == "unavailable" and row["needs_review"] is False


def test_analyze_and_health_report_503_when_agent4_is_missing(client, agent4_missing):
    req, _ = example("human_full")
    assert client.post("/api/behavior/analyze", json=req, headers=auth("auditor")).status_code == 503
    r = client.get("/api/behavior/health")
    assert r.status_code == 503 and r.json()["model_loaded"] is False


def test_an_unexpected_scoring_crash_never_loses_the_bid(db, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("model exploded")
    monkeypatch.setattr(behavior_signals, "score_timing", boom)
    row = behavior_signals.record_signal(db, reference="BID-6", intervals=[100.0] * 20, hold_durations=[90.0] * 20)
    assert row.status == "unavailable" and "exploded" not in row.message  # no internals leaked to reviewers or bidders


# ───────────────────────── the container layout (regression for the Docker crash) ─────────────────────────

PROBE = (
    "import json; import src.api.routes.behavior; "
    "from src.services import behavior_signals as s; print(json.dumps(s.agent4_status()))"
)


def run_probe(app_dir, extra_env=None):
    env = {k: v for k, v in os.environ.items() if k not in ("AGENT4_ROOT", "PYTHONPATH")}
    env.update(extra_env or {})
    done = subprocess.run([sys.executable, "-c", PROBE], cwd=app_dir, env=env, capture_output=True, text=True, timeout=120)
    assert done.returncode == 0, done.stderr[-800:]
    return json.loads(done.stdout.strip().splitlines()[-1])


@pytest.fixture(scope="module")
def container_app(tmp_path_factory):
    """backend/src copied where the backend image puts it, with no agent-4 folder anywhere near it."""
    app_dir = tmp_path_factory.mktemp("container") / "app"
    shutil.copytree(BACKEND_DIR / "src", app_dir / "src", ignore=shutil.ignore_patterns("__pycache__", "agents"))
    return app_dir


def test_backend_starts_without_agent4_present(container_app):
    state = run_probe(container_app)
    assert state["available"] is False and "AGENT4_ROOT" in state["detail"]


def test_agent4_root_variable_points_a_container_at_the_model(container_app):
    state = run_probe(container_app, {"AGENT4_ROOT": str(AGENT4_ROOT)})
    assert state["available"] is True and state["model_version"].startswith("2.")


# ───────────────────────── human review: queue, decisions, audit trail ─────────────────────────

def review(client, signal_id, who="auditor", **body):
    return client.post(f"/api/behavior/signals/{signal_id}/review", json=body, headers=auth(who))


def flagged_signal(client):
    bot, _ = example("automation_full")
    submit(client, reference="BID-R", intervals=bot["intervals"], hold_durations=bot["hold_durations"])
    return signals(client)[0]


def test_signals_that_need_a_look_start_in_the_pending_queue(client):
    bot, _ = example("automation_full")
    human, _ = example("human_full")
    submit(client, reference="A", intervals=human["intervals"], hold_durations=human["hold_durations"])
    submit(client, reference="B", intervals=bot["intervals"], hold_durations=bot["hold_durations"])
    submit(client, reference="C")
    state = {s["reference"]: s["review_state"] for s in signals(client)}
    assert state == {"A": None, "B": "pending", "C": "pending"}
    assert sorted(s["reference"] for s in signals(client, review_state="pending")) == ["B", "C"]


def test_a_reviewer_clears_a_signal_and_it_leaves_the_queue(client):
    sig = flagged_signal(client)
    r = review(client, sig["id"], decision="cleared", note="Bidder confirmed they pasted from a template.")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["review_state"] == "cleared" and body["reviewed_by"] == "auditor@test.in"
    assert body["review_note"] == "Bidder confirmed they pasted from a template."
    assert [e["decision"] for e in body["reviews"]] == ["cleared"]
    assert signals(client, review_state="pending") == []


def test_every_decision_is_kept_in_the_audit_trail(client):
    sig = flagged_signal(client)
    review(client, sig["id"], who="auditor", decision="cleared", note="looked fine")
    review(client, sig["id"], who="admin", decision="escalated", note="second look: replayed rhythm suspected")
    history = client.get(f"/api/behavior/signals/{sig['id']}", headers=auth("auditor")).json()
    assert history["review_state"] == "escalated" and history["reviewed_by"] == "admin@test.in"
    assert [(e["reviewer"], e["reviewer_role"], e["decision"]) for e in history["reviews"]] == [
        ("auditor@test.in", "government_auditor", "cleared"), ("admin@test.in", "admin", "escalated")]


def test_a_review_changes_nothing_about_the_measurement(client):
    sig = flagged_signal(client)
    review(client, sig["id"], decision="cleared")
    after = client.get(f"/api/behavior/signals/{sig['id']}", headers=auth("auditor")).json()
    for field in ("status", "behavioral_risk_score", "risk_category", "behavioral_anomaly", "behavioral_evidence", "reference"):
        assert after[field] == sig[field], field


def test_only_reviewers_can_review(client):
    sig = flagged_signal(client)
    assert client.post(f"/api/behavior/signals/{sig['id']}/review", json={"decision": "cleared"}).status_code == 401
    assert review(client, sig["id"], who="msme", decision="cleared").status_code == 403
    assert client.get(f"/api/behavior/signals/{sig['id']}", headers=auth("msme")).status_code == 403
    assert client.get("/api/behavior/summary", headers=auth("msme")).status_code == 403


@pytest.mark.parametrize("body", [
    {"decision": "approved"}, {"decision": "cleared", "note": "x" * 501}, {"decision": "cleared", "extra": 1}, {},
])
def test_bad_review_requests_are_rejected(client, body):
    sig = flagged_signal(client)
    assert review(client, sig["id"], **body).status_code == 422
    assert signals(client, review_state="pending")  # still pending


def test_reviewing_or_reading_an_unknown_signal_is_a_404(client):
    assert review(client, 424242, decision="cleared").status_code == 404
    assert client.get("/api/behavior/signals/424242", headers=auth("auditor")).status_code == 404


def test_the_overview_counts_and_the_expected_flag_rate(client):
    bot, _ = example("automation_full")
    human, _ = example("human_full")
    submit(client, reference="A", intervals=human["intervals"], hold_durations=human["hold_durations"])
    submit(client, reference="B", intervals=bot["intervals"], hold_durations=bot["hold_durations"])
    submit(client, reference="C")
    review(client, signals(client, reference="B")[0]["id"], decision="escalated")
    s = client.get("/api/behavior/summary", headers=auth("auditor")).json()
    assert s["total"] == 3 and s["scored"] == 2 and s["flagged"] == 1 and s["flag_rate"] == 0.5
    assert s["by_status"] == {"scored": 2, "no_timing": 1}
    assert s["pending_review"] == 1 and s["escalated"] == 1 and s["cleared"] == 0
    assert s["expected_flag_rate_for_genuine_users"] == 0.05


def test_the_overview_of_an_empty_system_has_no_rate(client):
    s = client.get("/api/behavior/summary", headers=auth("auditor")).json()
    assert s["total"] == 0 and s["flag_rate"] is None


def test_review_decisions_cannot_be_rewritten_through_the_database_model():
    """The audit trail table has no update path in the service: reviewing always appends."""
    import inspect
    source = inspect.getsource(behavior_signals.review_signal)
    assert "BehaviorReviewEventModel(" in source and "delete(" not in source
