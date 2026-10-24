"""The MCP server for the bot-detection module: protocol behaviour, read-only guarantee, and the HTTP guard.

Tool tests use the SDK's own client against the server in-process. The HTTP test mounts nothing new: it drives the
platform app (``src.main``), where the server is mounted, through the SDK's streamable-HTTP client, so it covers
the real mount path, the session manager and the reviewer-only guard together.
"""
import asyncio
import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from tests import _import_stubs

_import_stubs.install()

import httpx2  # noqa: E402  (the SDK's HTTP library)
from mcp import ClientSession  # noqa: E402
from mcp.client import Client  # noqa: E402
from mcp.client.streamable_http import streamable_http_client  # noqa: E402

from src import mcp_server  # noqa: E402
from src.core.auth import create_access_token, hash_password  # noqa: E402
from src.db import database  # noqa: E402
from src.db.database import Base  # noqa: E402
from src.db.models import UserModel  # noqa: E402
from src.services import behavior_signals  # noqa: E402

EXAMPLES = behavior_signals.find_agent4_root() / "docs" / "examples"


def example(name):
    return (json.loads((EXAMPLES / f"{name}.request.json").read_text()),
            json.loads((EXAMPLES / f"{name}.response.json").read_text()))


def run(coro):
    return asyncio.run(coro)


def data(result):
    """The structured payload of a tool result (dict results are wrapped under 'result')."""
    content = result.structured_content
    return content.get("result", content) if isinstance(content, dict) else content


@pytest.fixture(scope="module")
def factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    f = sessionmaker(bind=engine)
    db = f()
    hashed = hash_password("Password123!")
    for email, role in (("aud@t.in", "government_auditor"), ("adm@t.in", "admin"), ("vend@t.in", "msme"), ("off@t.in", "government_auditor")):
        db.add(UserModel(email=email, hashed_password=hashed, full_name=email, role=role, msme_id="M101" if role == "msme" else None,
                         is_active=(email != "off@t.in")))
    db.commit()
    db.close()
    return f


@pytest.fixture()
def db(factory, monkeypatch):
    monkeypatch.setattr(database, "SessionLocal", factory)
    session = factory()
    from src.db.models import BehaviorReviewEventModel, BehaviorSignalModel
    session.query(BehaviorReviewEventModel).delete()
    session.query(BehaviorSignalModel).delete()
    session.commit()
    yield session
    session.close()


# ───────────────────────── tools, resource, prompt (in-process) ─────────────────────────

def test_the_server_offers_only_read_only_tools():
    async def go():
        async with Client(mcp_server.server) as c:
            return (await c.list_tools()).tools
    tools = run(go())
    assert {t.name for t in tools} == {"analyze_keystroke_timing", "list_behavior_signals", "get_behavior_signal", "behavior_model_status"}
    for t in tools:
        assert t.annotations.read_only_hint is True and t.annotations.destructive_hint is False, t.name
    assert not [t.name for t in tools if any(v in t.name for v in ("record", "delete", "update", "decide", "review_", "set_"))]


@pytest.mark.parametrize("name,category", [("automation_full", "HIGH_ANOMALY"), ("human_full", "LOW_ANOMALY")])
def test_analyze_matches_the_standalone_model(name, category):
    req, expected = example(name)

    async def go():
        async with Client(mcp_server.server) as c:
            return await c.call_tool("analyze_keystroke_timing", req)
    result = run(go())
    assert not result.is_error
    got = data(result)
    assert got["risk_category"] == category and got["behavioral_risk_score"] == expected["behavioral_risk_score"]


def test_a_short_session_is_reported_not_scored():
    req, _ = example("too_short")

    async def go():
        async with Client(mcp_server.server) as c:
            return data(await c.call_tool("analyze_keystroke_timing", req))
    got = run(go())
    assert got["status"] == "insufficient_data" and got["behavioral_risk_score"] is None


@pytest.mark.parametrize("bad", [
    {"session_id": "jane.doe@example.com", "intervals": [100.0] * 20},          # an e-mail is not an opaque token
    {"session_id": "s1", "intervals": [-1.0] * 20},                              # negative latency
    {"session_id": "s1", "intervals": [100.0] * 20, "hold_durations": [90.0] * 19},  # length mismatch
    {"session_id": "s1", "intervals": []},
])
def test_invalid_input_comes_back_as_a_tool_error(bad):
    async def go():
        async with Client(mcp_server.server) as c:
            return await c.call_tool("analyze_keystroke_timing", bad)
    result = run(go())
    assert result.is_error


def test_signals_can_be_listed_filtered_and_fetched(db):
    bot, _ = example("automation_full")
    human, _ = example("human_full")
    b = behavior_signals.record_signal(db, reference="BID-1", intervals=bot["intervals"], hold_durations=bot["hold_durations"])
    behavior_signals.record_signal(db, reference="BID-2", intervals=human["intervals"], hold_durations=human["hold_durations"])
    behavior_signals.record_signal(db, reference="BID-3")  # no timing

    async def go():
        async with Client(mcp_server.server) as c:
            everything = data(await c.call_tool("list_behavior_signals", {}))
            flagged = data(await c.call_tool("list_behavior_signals", {"needs_review": True}))
            one_ref = data(await c.call_tool("list_behavior_signals", {"reference": "BID-2"}))
            single = data(await c.call_tool("get_behavior_signal", {"signal_id": b.id}))
            missing = await c.call_tool("get_behavior_signal", {"signal_id": 99999})
            too_many = await c.call_tool("list_behavior_signals", {"limit": 1000})
            return everything, flagged, one_ref, single, missing, too_many
    everything, flagged, one_ref, single, missing, too_many = run(go())
    assert everything["count"] == 3
    assert sorted(s["reference"] for s in flagged["signals"]) == ["BID-1", "BID-3"]
    assert [s["status"] for s in one_ref["signals"]] == ["scored"] and one_ref["signals"][0]["needs_review"] is False
    assert single["risk_category"] == "HIGH_ANOMALY" and single["behavioral_evidence"]
    assert missing.is_error and too_many.is_error


def test_model_status_tool():
    async def go():
        async with Client(mcp_server.server) as c:
            return data(await c.call_tool("behavior_model_status", {}))
    status = run(go())
    assert status["available"] is True and status["model_version"].startswith("2.")


def test_the_guide_resource_states_the_limits():
    async def go():
        async with Client(mcp_server.server) as c:
            res = await c.read_resource("procureguard://agent4/interpretation-guide")
            return res.contents[0].text
    text = run(go())
    for must_say in ("95th percentile", "99th percentile", "no_timing", "must not block a bid", "simulated typing", "assistive"):
        assert must_say in text, must_say


def test_the_review_prompt_tells_the_model_not_to_accuse():
    async def go():
        async with Client(mcp_server.server) as c:
            result = await c.get_prompt("review_flagged_bid", {"reference": "GeM/2026/B/7"})
            return result.messages[0].content.text
    text = run(go())
    assert "GeM/2026/B/7" in text and "list_behavior_signals" in text
    assert "Do not conclude that the bidder acted improperly" in text


# ───────────────────────── the platform endpoint: a full session through the guard ─────────────────────────

def test_http_endpoint_is_reviewers_only_and_serves_a_full_session(db, monkeypatch):
    from src.main import app

    def token(email):
        return create_access_token({"sub": email})

    bot, _ = example("automation_full")
    behavior_signals.record_signal(db, reference="BID-HTTP", intervals=bot["intervals"], hold_durations=bot["hold_durations"])

    async def post(headers):
        async with httpx2.AsyncClient(transport=httpx2.ASGITransport(app=app), base_url="http://testserver", headers=headers) as hc:
            return await hc.post("/mcp/", json={"jsonrpc": "2.0", "id": 1, "method": "ping"})

    async def session_as(email):
        async with httpx2.AsyncClient(transport=httpx2.ASGITransport(app=app), base_url="http://testserver",
                                      headers={"Authorization": f"Bearer {token(email)}"}) as hc:
            async with streamable_http_client("http://testserver/mcp/", http_client=hc) as streams:
                read, write = streams[0], streams[1]
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    tools = [t.name for t in (await session.list_tools()).tools]
                    scored = await session.call_tool("analyze_keystroke_timing", bot)
                    listed = await session.call_tool("list_behavior_signals", {"reference": "BID-HTTP"})
                    return tools, scored, listed

    async def go():
        async with mcp_server.lifespan():  # the session manager runs once per process, so every HTTP check lives here
            outcomes = {
                "no token": (await post({})).status_code,
                "garbage token": (await post({"Authorization": "Bearer not-a-jwt"})).status_code,
                "vendor": (await post({"Authorization": f"Bearer {token('vend@t.in')}"})).status_code,
                "deactivated auditor": (await post({"Authorization": f"Bearer {token('off@t.in')}"})).status_code,
            }
            return outcomes, await session_as("aud@t.in"), await session_as("adm@t.in")

    outcomes, (tools, scored, listed), (admin_tools, _, _) = run(go())
    assert outcomes == {"no token": 401, "garbage token": 401, "vendor": 403, "deactivated auditor": 401}
    assert "analyze_keystroke_timing" in tools and tools == admin_tools
    assert data(scored)["risk_category"] == "HIGH_ANOMALY"
    assert data(listed)["count"] == 1
