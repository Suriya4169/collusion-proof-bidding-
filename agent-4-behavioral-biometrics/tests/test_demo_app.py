"""The demo platform backend: forwarding, privacy, failure handling, pages and bot-lab guard rails."""

import json
import re
from html.parser import HTMLParser
from pathlib import Path

import httpx
import pytest
import pytest_asyncio

from agent4.config import Settings
from demo.app import DemoSettings, create_demo_app, platform_note
from conftest import make_session

STATIC = Path(__file__).resolve().parents[1] / "demo" / "static"


def _client(app):
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://demo")


def _timing(cls="HUMAN_LIKE", n=60, seed=0):
    f, h = make_session(cls, n, seed)
    return {"intervals": f.tolist(), "hold_durations": h.tolist()}


@pytest_asyncio.fixture
async def client(shipped_scorer):
    app = create_demo_app(DemoSettings(), scorer=shipped_scorer)
    async with app.router.lifespan_context(app):
        async with _client(app) as c:
            c.app = app
            yield c


async def _post_behavior(c, sid="s1", **timing):
    return await c.post("/demo/api/behavior", json={"session_id": sid, **(timing or _timing())})


# ---------------------------------------------------------------- the end-to-end flow through the real model


async def test_status_reports_the_real_model_and_lists_every_scenario(client):
    j = (await client.get("/demo/api/status")).json()
    assert j["agent4"]["mode"] == "in-process" and j["agent4"]["health"]["model_loaded"] is True
    assert j["agent4"]["health"]["model_version"].startswith("2.0.0+")
    assert [s["key"] for s in j["bot_lab"]["scenarios"]][:3] == ["pw_instant", "pw_fixed_delay", "pw_metronome"]
    assert j["bot_lab"]["enabled"] is False
    replay = next(s for s in j["bot_lab"]["scenarios"] if s["key"] == "replay_human")
    assert replay["available"] is False                                  # nobody has typed on the portal yet


async def test_a_human_like_session_and_a_scripted_one_are_scored_differently(client):
    human = (await _post_behavior(client, "h", **_timing("HUMAN_LIKE", 80))).json()
    bot = (await _post_behavior(client, "b", **_timing("REGULAR_AUTOMATION", 80))).json()
    assert human["status"] == "scored" and human["behavioral_risk_score"] < 50
    assert bot["status"] == "scored" and bot["behavioral_risk_score"] >= 75 and bot["risk_category"] == "HIGH_ANOMALY"


async def test_bid_flow_attaches_the_signal_and_never_blocks(client):
    await _post_behavior(client, "b", **_timing("REGULAR_AUTOMATION", 80))
    bid = (await client.post("/demo/api/bids", json={"session_id": "b"})).json()
    assert bid["accepted"] is True and bid["reference"].startswith("PIP-DEMO-") and bid["outcome"] == "scored"
    assert bid["behavior"]["behavioral_anomaly"] is True and "human review" in bid["platform_note"]
    assert "accepted" in bid["platform_note"]


async def test_a_bid_without_any_timing_is_accepted_and_recorded_as_no_data(client):
    bid = (await client.post("/demo/api/bids", json={"session_id": "no-keys"})).json()
    assert bid["accepted"] is True and bid["outcome"] == "no_data" and bid["behavior"] is None
    assert "no behavioural data" in bid["platform_note"]


async def test_a_too_short_session_is_reported_as_insufficient_not_as_an_error(client):
    short = _timing(n=6)
    r = await _post_behavior(client, "short", **short)
    assert r.status_code == 200 and r.json()["status"] == "insufficient_data"
    bid = (await client.post("/demo/api/bids", json={"session_id": "short"})).json()
    assert bid["outcome"] == "insufficient_data" and bid["accepted"] is True


async def test_sessions_feed_is_incremental_and_carries_the_truth_label(client):
    await client.post("/demo/api/truth", json={"session_id": "t1", "truth": "bot", "scenario": "pw_instant", "tool": "Playwright"})
    await _post_behavior(client, "t1", **_timing("REGULAR_AUTOMATION"))
    await client.post("/demo/api/bids", json={"session_id": "t1"})
    feed = (await client.get("/demo/api/sessions?after=0")).json()
    row = feed["sessions"][0]
    assert row["truth"] == "bot" and row["scenario"] == "pw_instant" and row["flagged"] is True and row["outcome"] == "scored"
    assert (await client.get(f"/demo/api/sessions?after={feed['seq']}")).json()["sessions"] == []


async def test_evaluation_endpoint_judges_what_was_recorded(client):
    for i in range(3):
        sid = f"e{i}"
        await client.post("/demo/api/truth", json={"session_id": sid, "truth": "bot", "scenario": "pw_metronome", "tool": "t"})
        await _post_behavior(client, sid, **_timing("REGULAR_AUTOMATION", 60, i))
        await client.post("/demo/api/bids", json={"session_id": sid})
    ev = (await client.get("/demo/api/evaluation")).json()
    row = next(r for r in ev["scenarios"] if r["key"] == "pw_metronome")
    assert row["summary"]["n"] == 3 and row["summary"]["flagged"] == 3
    assert row["status"] == "INCONCLUSIVE"                               # 3 visits cannot prove 90%
    assert row["synthetic_reference_rate"] == pytest.approx(1.0, abs=0.01)


async def test_reset_clears_the_store_and_can_be_disabled(client, shipped_scorer):
    await client.post("/demo/api/bids", json={"session_id": "x"})
    assert (await client.post("/demo/api/reset")).status_code == 200
    assert (await client.get("/demo/api/sessions")).json()["sessions"] == []
    locked = create_demo_app(DemoSettings(allow_reset=False), scorer=shipped_scorer)
    async with locked.router.lifespan_context(locked):
        async with _client(locked) as c:
            assert (await c.post("/demo/api/reset")).status_code == 403


async def test_the_real_agent4_api_is_mounted_for_exploration(client):
    assert (await client.get("/agent4/health")).json()["model_loaded"] is True
    direct = await client.post("/agent4/behavior/analyze", json={"session_id": "d", **_timing()})
    assert direct.status_code == 200


# ---------------------------------------------------------------- privacy and validation


@pytest.mark.parametrize("body", [
    {"session_id": "a", "intervals": [100.0] * 20, "key": "a"},
    {"session_id": "a", "intervals": [100.0] * 20, "text": "hello"},
    {"session_id": "bob@example.com", "intervals": [100.0] * 20},
    {"session_id": "a", "intervals": ["100"] * 20},
    {"session_id": "a", "intervals": [100.0] * 20, "hold_durations": [80.0] * 19},
])
async def test_behavior_endpoint_rejects_anything_but_timing(client, body):
    r = await client.post("/demo/api/behavior", json=body)
    assert r.status_code == 422 and "hello" not in r.text


@pytest.mark.parametrize("path, body", [
    ("/demo/api/truth", {"session_id": "a", "truth": "maybe"}),
    ("/demo/api/truth", {"session_id": "a", "truth": "bot", "extra": 1}),
    ("/demo/api/truth", {"session_id": "a b", "truth": "bot"}),
    ("/demo/api/truth", {"session_id": "a", "truth": "bot", "scenario": "Bad Name!"}),
    ("/demo/api/bids", {"session_id": "a", "text": "typed content"}),
    ("/demo/api/bids", {"session_id": "bob@example.com"}),
])
async def test_other_endpoints_are_just_as_strict(client, path, body):
    r = await client.post(path, json=body)
    assert r.status_code == 422 and "typed content" not in r.text


# ---------------------------------------------------------------- what is forwarded to Agent 4


def _fake_agent4(captured, status=200, boom=False):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok", "model_loaded": True, "model_version": "fake"})
        if boom:
            raise httpx.ConnectError("agent 4 is down")
        captured.append({"body": json.loads(request.content), "headers": dict(request.headers)})
        if status != 200:
            return httpx.Response(status, json={"detail": "nope"})
        return httpx.Response(200, json={
            "session_id": "x", "status": "scored", "scoring_mode": "full", "behavioral_risk_score": 12.0,
            "risk_category": "LOW_ANOMALY", "behavioral_anomaly": False, "reliability": "medium", "events_received": 60,
            "events_scored": 60, "behavioral_evidence": [], "top_deviations": [], "model_version": "fake",
        })
    return httpx.MockTransport(handler)


async def test_only_the_three_timing_fields_reach_agent4_and_the_truth_never_does():
    captured = []
    app = create_demo_app(DemoSettings(agent4_url="http://agent4.internal", agent4_api_key="k-123"),
                          agent4_transport=_fake_agent4(captured))
    async with app.router.lifespan_context(app):
        async with _client(app) as c:
            await c.post("/demo/api/truth", json={"session_id": "p1", "truth": "bot", "scenario": "pw_instant", "tool": "Playwright"})
            r = await c.post("/demo/api/behavior", json={"session_id": "p1", **_timing()})
            status = (await c.get("/demo/api/status")).json()
    assert r.status_code == 200 and status["agent4"]["mode"] == "remote"
    sent = captured[0]
    assert set(sent["body"]) == {"session_id", "intervals", "hold_durations"}
    assert "bot" not in json.dumps(sent["body"]) and "pw_instant" not in json.dumps(sent["body"])
    assert sent["headers"]["x-api-key"] == "k-123"


async def test_flight_only_sessions_forward_no_hold_field():
    captured = []
    app = create_demo_app(DemoSettings(agent4_url="http://agent4.internal"), agent4_transport=_fake_agent4(captured))
    async with app.router.lifespan_context(app):
        async with _client(app) as c:
            await c.post("/demo/api/behavior", json={"session_id": "p1", "intervals": [100.0] * 20})
    assert set(captured[0]["body"]) == {"session_id", "intervals"}


async def test_an_unreachable_agent4_never_blocks_the_bid():
    app = create_demo_app(DemoSettings(agent4_url="http://agent4.internal"), agent4_transport=_fake_agent4([], boom=True))
    async with app.router.lifespan_context(app):
        async with _client(app) as c:
            r = await c.post("/demo/api/behavior", json={"session_id": "p1", **_timing()})
            bid = (await c.post("/demo/api/bids", json={"session_id": "p1"})).json()
    assert r.status_code == 502
    assert bid["accepted"] is True and bid["outcome"] == "error" and bid["behavior"] is None


async def test_an_agent4_rejection_is_passed_through_and_recorded_as_an_error():
    app = create_demo_app(DemoSettings(agent4_url="http://agent4.internal"), agent4_transport=_fake_agent4([], status=401))
    async with app.router.lifespan_context(app):
        async with _client(app) as c:
            r = await c.post("/demo/api/behavior", json={"session_id": "p1", **_timing()})
            bid = (await c.post("/demo/api/bids", json={"session_id": "p1"})).json()
    assert r.status_code == 401 and bid["outcome"] == "error" and bid["accepted"] is True


async def test_persisted_sessions_survive_a_restart(tmp_path, shipped_scorer):
    path = tmp_path / "s.jsonl"
    for _ in range(2):
        app = create_demo_app(DemoSettings(persist_path=path), scorer=shipped_scorer)
        async with app.router.lifespan_context(app):
            async with _client(app) as c:
                if not path.exists():
                    await _post_behavior(c, "keep", **_timing())
                    await c.post("/demo/api/bids", json={"session_id": "keep"})
                else:
                    rows = (await c.get("/demo/api/sessions")).json()["sessions"]
                    assert [r["session_id"] for r in rows] == ["keep"] and rows[0]["outcome"] == "scored"
                    assert (await c.get("/demo/api/status")).json()["bot_lab"]["recordings_available"] == 1


# ---------------------------------------------------------------- pages


class _Inspect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inline_scripts, self.inline_style_attrs, self.external = 0, 0, []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "style" in a:
            self.inline_style_attrs += 1
        if tag == "script" and not a.get("src"):
            self.inline_scripts += 1
        for key in ("src", "href"):
            if a.get(key, "").startswith(("http://", "https://", "//")) and tag in ("script", "link", "img"):
                self.external.append(a[key])


@pytest.mark.parametrize("path, file", [("/", "index.html"), ("/dashboard", "dashboard.html")])
async def test_pages_are_served_with_a_strict_content_security_policy(client, path, file):
    r = await client.get(path)
    csp = r.headers["content-security-policy"]
    assert r.status_code == 200 and "script-src 'self'" in csp and "unsafe-inline" not in csp and "unsafe-eval" not in csp
    page = _Inspect()
    page.feed((STATIC / file).read_text(encoding="utf-8"))
    assert page.inline_scripts == 0 and page.inline_style_attrs == 0 and page.external == []   # everything is same-origin


async def test_static_assets_and_the_sdk_are_served(client):
    for path in ("/static/app.css", "/static/portal.js", "/static/dashboard.js", "/static/theme.js", "/sdk/biometrics.js"):
        assert (await client.get(path)).status_code == 200, path
    sdk = (await client.get("/sdk/biometrics.js")).text
    assert "Agent4Biometrics" in sdk


def test_page_scripts_never_use_innerhtml_or_eval():
    for name in ("portal.js", "dashboard.js", "theme.js"):
        text = (STATIC / name).read_text(encoding="utf-8")
        assert not re.search(r"innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function", text), name


def test_the_portal_never_sends_typed_content():
    text = (STATIC / "portal.js").read_text(encoding="utf-8")
    assert not re.search(r"\.value\s*[,)]|JSON\.stringify\([^)]*value", text.replace("target.value += k.ch", ""))
    html = (STATIC / "index.html").read_text(encoding="utf-8")
    assert 'type="password"' in html and "data-track" in html


# ---------------------------------------------------------------- the bot lab


async def test_bot_lab_is_off_unless_enabled(client):
    assert (await client.get("/demo/api/bots")).status_code == 403
    assert (await client.post("/demo/api/bots", json={"scenarios": "pw_instant", "runs": 1})).status_code == 403


class _FakeJobs:
    def __init__(self, *_):
        self.started = []

    def start(self, scenarios, runs, headed):
        self.started.append((scenarios, runs, headed))

        class _J:
            def public(self_inner):
                return {"id": "job1", "scenarios": scenarios, "runs": runs, "headed": headed, "status": "running"}
        return _J()

    def list(self):
        return []

    def shutdown(self):
        pass


async def test_bot_lab_only_accepts_registered_scenarios_and_sane_run_counts(monkeypatch, shipped_scorer):
    monkeypatch.setattr("demo.app.JobManager", _FakeJobs)
    app = create_demo_app(DemoSettings(bot_lab=True), scorer=shipped_scorer)
    async with app.router.lifespan_context(app):
        async with _client(app) as c:
            ok = await c.post("/demo/api/bots", json={"scenarios": "pw_instant", "runs": 3, "headed": True})
            assert ok.status_code == 200 and app.state.jobs.started == [("pw_instant", 3, True)]
            assert (await c.post("/demo/api/bots", json={"scenarios": "all", "runs": 2})).status_code == 200
            for bad in ({"scenarios": "rm -rf /", "runs": 1}, {"scenarios": "nope", "runs": 1}, {"scenarios": "pw_instant", "runs": 0},
                        {"scenarios": "pw_instant", "runs": 1000}, {"scenarios": "pw_instant", "runs": 1, "cmd": "calc"}):
                assert (await c.post("/demo/api/bots", json=bad)).status_code == 422, bad
            # replaying a recorded person is refused until someone has typed on the portal
            assert (await c.post("/demo/api/bots", json={"scenarios": "replay_human", "runs": 1})).status_code == 409
    assert len(app.state.jobs.started) == 2


def test_job_manager_rejects_unknown_scenarios_and_runs_before_starting_anything():
    from demo.jobs import JobError, JobManager
    manager = JobManager("http://127.0.0.1:1", ["pw_instant"])
    for scenarios, runs in (("evil", 1), ("pw_instant", 0), ("pw_instant", 101)):
        with pytest.raises(JobError):
            manager.start(scenarios, runs, False)
    assert manager.list() == []


def test_platform_note_never_blocks():
    assert "accepted" in platform_note("scored", {"behavioral_risk_score": 90.0}).lower()
    assert "accepted" in platform_note("scored", {"behavioral_risk_score": 60.0}).lower()
    assert platform_note("scored", {"behavioral_risk_score": 10.0}).startswith("Typing looks like a genuine person")
    assert "accepted" in platform_note("no_data", None).lower() and "accepted" in platform_note("error", None).lower()
