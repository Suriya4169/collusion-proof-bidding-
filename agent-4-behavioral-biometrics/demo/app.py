"""The demo "platform backend": serves the bid portal and the live dashboard, forwards
keystroke *timing* to Agent 4, and records what came back.

    browser --(timing only)--> /demo/api/behavior --(timing only)--> Agent 4 /behavior/analyze

Agent 4 runs in-process by default (the very same app a deployment would run) or remotely via
``agent4_url``. The ground truth that test runs register (human / bot) stays here; Agent 4 never
sees it. Like the real service, nothing here blocks a bid.
"""

from __future__ import annotations

import json
import logging
import time
from contextlib import AsyncExitStack, asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

from agent4.config import DEFAULT_REPORT_DIR, RISK_HIGH_FROM, RISK_MODERATE_FROM, Settings
from agent4.scorer import BehaviorScorer
from agent4.service import BehaviorRequest, create_app as create_agent4_app
from demo import DEMO_VERSION
from demo.automation.scenarios import SCENARIOS
from demo.evaluation import evaluate
from demo.jobs import MAX_RUNS_PER_SCENARIO, JobError, JobManager
from demo.store import OUTCOME_INSUFFICIENT, OUTCOME_NO_DATA, OUTCOME_SCORED, SessionStore

logger = logging.getLogger("demo")

DEMO_DIR = Path(__file__).resolve().parent
STATIC_DIR = DEMO_DIR / "static"
SDK_FILE = DEMO_DIR.parent / "frontend" / "biometrics.js"
SESSION_ID_PATTERN = r"^[A-Za-z0-9._:\-]+$"

# Pages load only same-origin scripts and styles; nothing is fetched from elsewhere.
PAGE_CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
            "connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")


@dataclass(frozen=True)
class DemoSettings:
    agent4_url: Optional[str] = None                 # None = run Agent 4 in-process
    agent4_api_key: Optional[str] = None
    agent4_settings: Settings = field(default_factory=lambda: Settings(log_level="WARNING"))
    persist_path: Optional[Path] = None
    bot_lab: bool = False
    public_url: str = "http://127.0.0.1:8100"
    metrics_path: Path = DEFAULT_REPORT_DIR / "metrics.json"
    allow_reset: bool = True


class TruthRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1, max_length=128, pattern=SESSION_ID_PATTERN)
    truth: Literal["human", "bot"]
    scenario: Optional[str] = Field(None, pattern=r"^[a-z0-9_]{1,40}$")
    tool: Optional[str] = Field(None, max_length=120)


class BidRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1, max_length=128, pattern=SESSION_ID_PATTERN)


class BotJobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenarios: str = Field(pattern=r"^[a-z0-9_]{1,40}$")
    runs: int = Field(ge=1, le=MAX_RUNS_PER_SCENARIO)
    headed: bool = False


def platform_note(outcome: str, behavior: Optional[Dict[str, Any]]) -> str:
    """What the platform does with the signal. The bid is always accepted."""
    if outcome == OUTCOME_SCORED and behavior:
        risk = behavior["behavioral_risk_score"]
        if risk >= RISK_HIGH_FROM:
            return "High behavioural anomaly: queued for human review. The bid was still accepted."
        if risk >= RISK_MODERATE_FROM:
            return "Moderate behavioural anomaly: recorded in the audit trail. The bid was accepted."
        return "Typing looks like a genuine person. No action."
    if outcome == OUTCOME_INSUFFICIENT and behavior:
        return behavior.get("message") or "Too few keystrokes for a calibrated score."
    if outcome == OUTCOME_NO_DATA:
        return ("No keystroke timing was received for this bid. Agent 4 has nothing to score, so the platform "
                "records 'no behavioural data' for review. The bid was accepted.")
    return "The behavioural service could not score this bid. The bid was accepted."


def create_demo_app(settings: Optional[DemoSettings] = None, scorer: Optional[BehaviorScorer] = None,
                    agent4_transport: Optional[httpx.AsyncBaseTransport] = None) -> FastAPI:
    """``agent4_transport`` lets tests stand in for a remote Agent 4 (used together with ``agent4_url``)."""
    cfg = settings or DemoSettings()
    store = SessionStore(cfg.persist_path)
    agent4_app = None if cfg.agent4_url else create_agent4_app(cfg.agent4_settings, scorer=scorer)
    jobs = JobManager(cfg.public_url, list(SCENARIOS)) if cfg.bot_lab else None
    reference_metrics: Dict[str, Any] = {}
    if cfg.metrics_path.exists():
        try:
            reference_metrics = json.loads(cfg.metrics_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            reference_metrics = {}

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        async with AsyncExitStack() as stack:
            if agent4_app is not None:
                await stack.enter_async_context(agent4_app.router.lifespan_context(agent4_app))
                client = httpx.AsyncClient(transport=httpx.ASGITransport(app=agent4_app), base_url="http://agent4", timeout=10.0)
            else:
                client = httpx.AsyncClient(base_url=cfg.agent4_url.rstrip("/"), timeout=10.0, transport=agent4_transport)
            stack.push_async_callback(client.aclose)
            app.state.client = client
            yield
            if jobs:
                jobs.shutdown()

    app = FastAPI(title="PIP demo (Agent 4 integration)", version=DEMO_VERSION, lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)
    app.state.store = store
    app.state.jobs = jobs
    app.state.settings = cfg
    if agent4_app is not None:
        app.mount("/agent4", agent4_app)            # the real Agent 4 API, with its own /docs

    headers_out = {"X-API-Key": cfg.agent4_api_key} if cfg.agent4_api_key else {}

    @app.middleware("http")
    async def hardening(request: Request, call_next):
        response = await call_next(request)
        if not request.url.path.startswith("/agent4"):
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            response.headers.setdefault("Referrer-Policy", "no-referrer")
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        detail = [{"loc": list(e.get("loc", ())), "msg": e.get("msg", "invalid"), "type": e.get("type", "invalid")}
                  for e in exc.errors()]
        return JSONResponse(status_code=422, content={"detail": detail})

    # ---- pages ----------------------------------------------------------------------
    def page(name: str) -> FileResponse:
        return FileResponse(STATIC_DIR / name, media_type="text/html", headers={"Content-Security-Policy": PAGE_CSP})

    @app.get("/", include_in_schema=False)
    async def portal() -> FileResponse:
        return page("index.html")

    @app.get("/dashboard", include_in_schema=False)
    async def dashboard() -> FileResponse:
        return page("dashboard.html")

    @app.get("/sdk/biometrics.js", include_in_schema=False)
    async def sdk() -> FileResponse:
        return FileResponse(SDK_FILE, media_type="text/javascript")

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    # ---- the platform API -------------------------------------------------------------
    @app.post("/demo/api/behavior")
    async def behavior(body: BehaviorRequest, request: Request):
        """What the browser SDK posts to. Forwards exactly the three timing fields to Agent 4."""
        payload: Dict[str, Any] = {"session_id": body.session_id, "intervals": body.intervals}
        if body.hold_durations is not None:
            payload["hold_durations"] = body.hold_durations
        timing = {"intervals": list(body.intervals), "hold_durations": list(body.hold_durations or [])}
        started = time.perf_counter()
        try:
            response = await request.app.state.client.post("/behavior/analyze", json=payload, headers=headers_out)
        except httpx.HTTPError:
            store.record_behavior(body.session_id, None, 502, (time.perf_counter() - started) * 1000.0, None)
            raise HTTPException(status_code=502, detail="Behavioural service unreachable.")
        latency = (time.perf_counter() - started) * 1000.0
        if response.status_code != 200:
            store.record_behavior(body.session_id, None, response.status_code, latency, None)
            return JSONResponse(status_code=response.status_code, content=response.json())
        data = response.json()
        store.record_behavior(body.session_id, data, 200, latency, timing)
        return data

    @app.post("/demo/api/bids")
    async def submit_bid(body: BidRequest):
        """A bid arrives. It is always accepted; the behavioural signal is attached for reviewers."""
        rec = store.submit_bid(body.session_id)
        info = rec.public()
        return {
            "accepted": True,
            "reference": rec.bid_reference,
            "session_id": rec.session_id,
            "outcome": info["outcome"],
            "behavior": rec.behavior,
            "platform_note": platform_note(info["outcome"], rec.behavior),
        }

    @app.post("/demo/api/truth")
    async def declare_truth(body: TruthRequest):
        """Test harnesses (and the portal's built-in script bot) declare what a session really is."""
        store.set_truth(body.session_id, body.truth, body.scenario, body.tool)
        return {"ok": True}

    @app.get("/demo/api/sessions")
    async def sessions(after: int = Query(0, ge=0), limit: int = Query(500, ge=1, le=2000)):
        return {"seq": store.seq, "sessions": store.changed_since(after, limit)}

    @app.get("/demo/api/export")
    async def export():
        return {"sessions": store.all_public()}

    @app.get("/demo/api/evaluation")
    async def evaluation():
        return evaluate(store.all_public(), reference_metrics)

    @app.get("/demo/api/status")
    async def status(request: Request):
        health: Dict[str, Any]
        try:
            health = (await request.app.state.client.get("/health")).json()
        except (httpx.HTTPError, ValueError):
            health = {"status": "unreachable", "model_loaded": False}
        recordings = store.manual_recording_count()
        return {
            "demo_version": DEMO_VERSION,
            "agent4": {"mode": "remote" if cfg.agent4_url else "in-process", "health": health},
            "store": {"sessions": len(store.all_public()), "seq": store.seq},
            "bot_lab": {
                "enabled": jobs is not None,
                "max_runs": MAX_RUNS_PER_SCENARIO,
                "recordings_available": recordings,
                "scenarios": [
                    {"key": s.key, "title": s.title, "truth": s.truth, "tool": s.tool, "description": s.description,
                     "expectation": {"kind": s.expectation.kind, "statement": s.expectation.statement},
                     "available": (recordings > 0) if s.needs_recording else True}
                    for s in SCENARIOS.values()
                ],
            },
        }

    @app.post("/demo/api/reset")
    async def reset():
        if not cfg.allow_reset:
            raise HTTPException(status_code=403, detail="Reset is disabled.")
        store.reset()
        return {"ok": True}

    # ---- bot lab ---------------------------------------------------------------------
    def require_lab() -> JobManager:
        if jobs is None:
            raise HTTPException(status_code=403, detail="The bot lab is disabled on this server.")
        return jobs

    @app.get("/demo/api/bots")
    async def list_jobs():
        return {"jobs": require_lab().list()}

    @app.post("/demo/api/bots")
    async def start_job(body: BotJobRequest):
        manager = require_lab()
        if body.scenarios != "all" and body.scenarios not in SCENARIOS:
            raise HTTPException(status_code=422, detail="Unknown scenario.")
        if body.scenarios == "replay_human" and store.manual_recording_count() == 0:
            raise HTTPException(status_code=409, detail="No recorded human sessions yet: submit a bid on the portal first.")
        try:
            return manager.start(body.scenarios, body.runs, body.headed).public()
        except JobError as exc:
            raise HTTPException(status_code=409, detail=str(exc))

    @app.post("/demo/api/bots/{job_id}/cancel")
    async def cancel_job(job_id: str):
        try:
            return require_lab().cancel(job_id).public()
        except JobError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

    return app
