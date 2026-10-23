"""The HTTP contract: validation, privacy, auth, limits, and documentation examples."""

import json
from pathlib import Path

import httpx
import pytest
import pytest_asyncio

from agent4.config import Settings
from agent4.service import create_app

from conftest import make_session

EXAMPLES = Path(__file__).resolve().parents[1] / "docs" / "examples"


def _client(app):
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


@pytest_asyncio.fixture(scope="module")
async def client(shipped_scorer):
    app = create_app(Settings(log_level="WARNING"), scorer=shipped_scorer)
    async with app.router.lifespan_context(app):
        async with _client(app) as c:
            yield c


def _payload(cls="HUMAN_LIKE", n=60, holds=True, seed=0):
    f, h = make_session(cls, n, seed)
    body = {"session_id": "sess-1", "intervals": f.tolist()}
    if holds:
        body["hold_durations"] = h.tolist()
    return body


async def test_health(client):
    r = await client.get("/health")
    j = r.json()
    assert r.status_code == 200 and j["status"] == "ok" and j["model_loaded"] is True
    assert j["service"] == "agent-4-behavioral-biometrics" and j["model_version"].startswith("2.0.0+")
    assert j["min_events"] == {"full": 10, "flight_only": 10} and j["max_events_scored"] == 300


async def test_scored_response_has_the_documented_shape(client):
    r = await client.post("/behavior/analyze", json=_payload())
    j = r.json()
    assert r.status_code == 200 and j["status"] == "scored"
    expected = {"session_id", "status", "scoring_mode", "behavioral_risk_score", "risk_category",
                "behavioral_anomaly", "anomaly_score", "operational_threshold", "reliability",
                "events_received", "events_scored", "behavioral_evidence", "top_deviations",
                "model_version", "message"}
    assert set(j) == expected
    assert r.headers["x-request-id"] and r.headers["cache-control"] == "no-store"


async def test_request_id_is_echoed(client):
    r = await client.post("/behavior/analyze", json=_payload(), headers={"X-Request-ID": "abc-123"})
    assert r.headers["x-request-id"] == "abc-123"


async def test_flight_only_payload_is_accepted(client):
    r = await client.post("/behavior/analyze", json=_payload(holds=False))
    assert r.status_code == 200 and r.json()["scoring_mode"] == "flight_only"


async def test_short_session_gets_a_clear_non_error_answer(client):
    r = await client.post("/behavior/analyze", json=_payload(n=6))
    j = r.json()
    assert r.status_code == 200 and j["status"] == "insufficient_data"
    assert j["behavioral_risk_score"] is None and j["behavioral_anomaly"] is None and j["message"]


async def test_integer_timings_are_accepted(client):
    r = await client.post("/behavior/analyze", json={"session_id": "i", "intervals": [200, 180, 220, 190, 210, 205, 195, 215, 185, 225, 200, 190]})
    assert r.status_code == 200


@pytest.mark.parametrize("name, body", [
    ("unknown field (key)", {"session_id": "a", "intervals": [100.0] * 20, "key": "a"}),
    ("unknown field (text)", {"session_id": "a", "intervals": [100.0] * 20, "text": "hello"}),
    ("email as session id", {"session_id": "bob@example.com", "intervals": [100.0] * 20}),
    ("space in session id", {"session_id": "a b", "intervals": [100.0] * 20}),
    ("empty session id", {"session_id": "", "intervals": [100.0] * 20}),
    ("missing intervals", {"session_id": "a"}),
    ("negative interval", {"session_id": "a", "intervals": [100.0] * 19 + [-1.0]}),
    ("numeric strings", {"session_id": "a", "intervals": ["100"] * 20}),
    ("booleans", {"session_id": "a", "intervals": [True] * 20}),
    ("nulls", {"session_id": "a", "intervals": [None] * 20}),
    ("length mismatch", {"session_id": "a", "intervals": [100.0] * 20, "hold_durations": [80.0] * 19}),
    ("zero hold", {"session_id": "a", "intervals": [100.0] * 20, "hold_durations": [0.0] * 20}),
    ("empty intervals", {"session_id": "a", "intervals": []}),
    ("too few intervals", {"session_id": "a", "intervals": [100.0] * 3}),
    ("nested lists", {"session_id": "a", "intervals": [[100.0]] * 20}),
])
async def test_malformed_payloads_are_rejected_with_422(client, name, body):
    r = await client.post("/behavior/analyze", json=body)
    assert r.status_code == 422, name


async def test_non_finite_json_tokens_are_rejected_not_crashed(client):
    for token in ("NaN", "Infinity", "-Infinity"):
        raw = ('{"session_id":"a","intervals":[%s,1,2,3,4,5,6,7,8,9,10]}' % token).encode()
        r = await client.post("/behavior/analyze", content=raw, headers={"content-type": "application/json"})
        assert r.status_code == 422, token


async def test_validation_errors_never_echo_the_submitted_values(client):
    r = await client.post("/behavior/analyze", json={"session_id": "a", "intervals": ["secret-typed-text"] * 20})
    assert r.status_code == 422 and "secret-typed-text" not in r.text


async def test_malformed_json_is_a_client_error(client):
    r = await client.post("/behavior/analyze", content=b"{not json", headers={"content-type": "application/json"})
    assert r.status_code == 422


async def test_oversized_bodies_are_refused(client):
    r = await client.post("/behavior/analyze", content=b"x" * 300_000, headers={"content-type": "application/json"})
    assert r.status_code == 413


async def test_too_many_events_for_this_deployment_are_refused(shipped_scorer):
    app = create_app(Settings(max_events=50, log_level="WARNING"), scorer=shipped_scorer)
    async with app.router.lifespan_context(app):
        async with _client(app) as c:
            ok = await c.post("/behavior/analyze", json=_payload(n=50))
            too_many = await c.post("/behavior/analyze", json=_payload(n=51))
    assert ok.status_code == 200 and too_many.status_code == 422


async def test_wrong_method_and_unknown_route(client):
    assert (await client.get("/behavior/analyze")).status_code == 405
    assert (await client.get("/nope")).status_code == 404


# ---------------------------------------------------------------- CORS


async def test_cors_is_off_by_default(client):
    r = await client.options("/behavior/analyze", headers={"Origin": "https://evil.example",
                                                            "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in r.headers


async def test_cors_allows_only_the_configured_origins(shipped_scorer):
    app = create_app(Settings(cors_origins=("https://bids.example.gov", "null"), log_level="WARNING"), scorer=shipped_scorer)
    async with app.router.lifespan_context(app):
        async with _client(app) as c:
            ok = await c.options("/behavior/analyze", headers={"Origin": "https://bids.example.gov",
                                                                "Access-Control-Request-Method": "POST",
                                                                "Access-Control-Request-Headers": "content-type,x-api-key"})
            null_origin = await c.options("/behavior/analyze", headers={"Origin": "null",
                                                                         "Access-Control-Request-Method": "POST"})
            other = await c.options("/behavior/analyze", headers={"Origin": "https://evil.example",
                                                                   "Access-Control-Request-Method": "POST"})
    assert ok.headers["access-control-allow-origin"] == "https://bids.example.gov"
    assert null_origin.headers["access-control-allow-origin"] == "null"   # a page opened from disk (demo.html)
    assert "access-control-allow-origin" not in other.headers


# ---------------------------------------------------------------- authentication


async def test_api_key_is_enforced_when_configured(shipped_scorer):
    app = create_app(Settings(api_keys=frozenset({"key-one", "key-two"}), log_level="WARNING"), scorer=shipped_scorer)
    async with app.router.lifespan_context(app):
        async with _client(app) as c:
            body = _payload()
            assert (await c.post("/behavior/analyze", json=body)).status_code == 401
            assert (await c.post("/behavior/analyze", json=body, headers={"X-API-Key": "wrong"})).status_code == 401
            assert (await c.post("/behavior/analyze", json=body, headers={"X-API-Key": ""})).status_code == 401
            assert (await c.post("/behavior/analyze", json=body, headers={"X-API-Key": "key-two"})).status_code == 200
            assert (await c.get("/health")).status_code == 200   # probes stay open


async def test_startup_refuses_to_run_without_keys_when_auth_is_required(shipped_scorer):
    app = create_app(Settings(require_api_key=True, log_level="WARNING"), scorer=shipped_scorer)
    with pytest.raises(RuntimeError, match="AGENT4_API_KEYS"):
        async with app.router.lifespan_context(app):
            pass


async def test_service_reports_unavailable_when_no_model_is_loaded():
    app = create_app(Settings(log_level="WARNING"))
    async with _client(app) as c:       # lifespan not started -> no scorer
        assert (await c.post("/behavior/analyze", json=_payload())).status_code == 503
        assert (await c.get("/health")).json()["status"] == "starting"


async def test_startup_fails_loudly_when_the_model_is_missing(tmp_path):
    app = create_app(Settings(model_dir=tmp_path, log_level="WARNING"))
    from agent4.artifacts import ModelIntegrityError
    with pytest.raises(ModelIntegrityError):
        async with app.router.lifespan_context(app):
            pass


# ---------------------------------------------------------------- contract & documentation


async def test_openapi_describes_exactly_the_public_endpoints(client):
    spec = (await client.get("/openapi.json")).json()
    assert set(spec["paths"]) == {"/health", "/behavior/analyze"}
    request = spec["components"]["schemas"]["BehaviorRequest"]
    assert request["additionalProperties"] is False and set(request["properties"]) == {"session_id", "intervals", "hold_durations"}


@pytest.mark.parametrize("name", ["human_full", "automation_full", "adaptive_bot_long", "human_flight_only", "too_short"])
async def test_documentation_examples_are_what_the_api_really_returns(client, name):
    """Docs-as-tests: the examples in docs/examples must match the live service byte for byte."""
    request = json.loads((EXAMPLES / f"{name}.request.json").read_text())
    expected = json.loads((EXAMPLES / f"{name}.response.json").read_text())
    r = await client.post("/behavior/analyze", json=request)
    assert r.status_code == 200
    assert r.json() == expected, "Documentation example is stale; run `python scripts/generate_examples.py`."
