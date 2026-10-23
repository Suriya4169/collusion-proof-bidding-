"""Behavioral Biometrics scoring service (FastAPI).

Privacy contract, enforced by the schema: the service accepts *only* timing numbers. Any
unexpected field (``key``, ``text``, ``value`` ...) is rejected, ``session_id`` may contain
only opaque-token characters (so an e-mail address or a name cannot be sent), and request
payloads are never logged.

Operational contract: the service returns a risk *signal*. It never blocks a bid and never
asserts fraud.

Run:  python -m agent4 serve          (or)  uvicorn agent4.service:create_app --factory
"""

from __future__ import annotations

import hmac
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Annotated, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

from agent4.config import SERVICE_NAME, SERVICE_VERSION, Settings
from agent4.features import TimingValidationError
from agent4.scorer import BehaviorScorer

logger = logging.getLogger("agent4")

# Hard schema ceiling; the operator-configurable limit (AGENT4_MAX_EVENTS) is checked in the handler.
SCHEMA_MAX_EVENTS = 20_000

Interval = Annotated[float, Field(strict=True, ge=0, allow_inf_nan=False)]
HoldDuration = Annotated[float, Field(strict=True, gt=0, allow_inf_nan=False)]


# --------------------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------------------
class BehaviorRequest(BaseModel):
    """Timing metadata for one anonymous session. Nothing else is accepted."""

    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(
        min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._:\-]+$",
        description="Opaque session token. Must not encode personal information.",
    )
    intervals: List[Interval] = Field(
        min_length=1, max_length=SCHEMA_MAX_EVENTS,
        description="Per keystroke event: release-to-press latency in ms. The first value is the onset "
                    "latency (focus to first key press) and is excluded from the timing statistics.",
    )
    hold_durations: Optional[List[HoldDuration]] = Field(
        default=None, min_length=1, max_length=SCHEMA_MAX_EVENTS,
        description="Optional, same length as `intervals`: key-down to key-up duration in ms. "
                    "Enables the full model (recommended).",
    )

    @model_validator(mode="after")
    def _lengths_match(self) -> "BehaviorRequest":
        if self.hold_durations is not None and len(self.hold_durations) != len(self.intervals):
            raise ValueError(
                f"Mismatched timing lengths: received {len(self.hold_durations)} hold durations "
                f"for {len(self.intervals)} intervals."
            )
        return self


class Deviation(BaseModel):
    feature: str
    z: float


class BehaviorResponse(BaseModel):
    session_id: str
    status: str = Field(description="`scored`, or `insufficient_data` when the session is too short to score.")
    scoring_mode: str = Field(description="`full` (hold + flight) or `flight_only`.")
    behavioral_risk_score: Optional[float] = Field(None, description="0-100, relative to genuine humans of similar length.")
    risk_category: Optional[str] = Field(None, description="LOW_ANOMALY (<50), MODERATE_ANOMALY (50-75), HIGH_ANOMALY (>=75).")
    behavioral_anomaly: Optional[bool] = Field(None, description="True when the risk score is >= 50.")
    anomaly_score: Optional[float] = None
    operational_threshold: Optional[float] = Field(None, description="Anomaly-score threshold at this session length (risk 50).")
    reliability: Optional[str] = Field(None, description="`low` (<30 keystrokes), `medium` (30-99) or `high` (>=100).")
    events_received: int
    events_scored: int
    behavioral_evidence: List[str]
    top_deviations: List[Deviation]
    model_version: str
    message: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    model_version: str
    model_loaded: bool
    min_events: dict
    max_events_scored: int


# --------------------------------------------------------------------------------------
# Middleware
# --------------------------------------------------------------------------------------
class _TooLarge(Exception):
    pass


class BodySizeLimitMiddleware:
    """Reject request bodies larger than ``max_bytes`` (declared or streamed)."""

    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        for name, value in scope.get("headers", []):
            if name == b"content-length" and value.isdigit() and int(value) > self.max_bytes:
                await self._reject(send)
                return

        received = 0
        started = False

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _TooLarge()
            return message

        async def tracking_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _TooLarge:
            if not started:
                await self._reject(send)

    async def _reject(self, send) -> None:
        body = b'{"detail":"Request body too large."}'
        await send({"type": "http.response.start", "status": 413,
                    "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})


# --------------------------------------------------------------------------------------
# App factory
# --------------------------------------------------------------------------------------
def create_app(settings: Optional[Settings] = None, scorer: Optional[BehaviorScorer] = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s %(message)s")
        if settings.require_api_key and not settings.api_keys:
            raise RuntimeError("AGENT4_REQUIRE_API_KEY is set but AGENT4_API_KEYS is empty; refusing to start.")
        app.state.scorer = scorer or BehaviorScorer.from_dir(settings.model_dir, settings.min_events_override)
        logger.info("model loaded: version=%s auth=%s", app.state.scorer.model_version,
                    "on" if settings.api_keys else "off")
        yield
        app.state.scorer = None

    app = FastAPI(
        title="Behavioral Biometrics API (Agent 4)",
        description=(
            "Scores keystroke *timing* metadata for the Procurement Integrity Platform and returns a risk signal "
            "(0-100) with plain-language evidence. It never receives typed characters, never blocks a bid and "
            "never asserts fraud."
        ),
        version=SERVICE_VERSION,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.scorer = None

    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_body_bytes)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware, allow_origins=list(settings.cors_origins), allow_methods=["POST", "GET"],
            allow_headers=["Content-Type", "X-API-Key", "X-Request-ID"], max_age=600,
        )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:  # last-resort guard: never leak internals
            logger.exception("unhandled error request_id=%s path=%s", request_id, request.url.path)
            response = JSONResponse(status_code=500, content={"detail": "Internal error.", "request_id": request_id})
        response.headers["X-Request-ID"] = request_id
        response.headers["Cache-Control"] = "no-store"
        logger.info("request_id=%s method=%s path=%s status=%s ms=%.2f", request_id, request.method,
                    request.url.path, response.status_code, (time.perf_counter() - started) * 1000.0)
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Report where and why, but never echo the submitted values back (they may be non-finite
        # numbers that cannot be serialised, and nothing in a rejected payload should be reflected).
        detail = [{"loc": list(e.get("loc", ())), "msg": e.get("msg", "invalid"), "type": e.get("type", "invalid")}
                  for e in exc.errors()]
        return JSONResponse(status_code=422, content={"detail": detail})

    def require_api_key(x_api_key: Annotated[Optional[str], Header()] = None) -> None:
        if not settings.api_keys:
            return
        supplied = (x_api_key or "").encode()
        # Compare against every key without short-circuiting on the first match.
        ok = False
        for key in settings.api_keys:
            ok |= hmac.compare_digest(supplied, key.encode())
        if not ok:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid API key.")

    def get_scorer() -> BehaviorScorer:
        current = app.state.scorer
        if current is None:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                detail="Scoring model is not loaded yet.")
        return current

    @app.get("/health", response_model=HealthResponse, summary="Liveness and model readiness")
    async def health() -> HealthResponse:
        current = app.state.scorer
        loaded = current is not None
        return HealthResponse(
            status="ok" if loaded else "starting",
            service=SERVICE_NAME,
            version=SERVICE_VERSION,
            model_version=current.model_version if loaded else "",
            model_loaded=loaded,
            min_events={m: current.min_events(m) for m in ("full", "flight_only")} if loaded else {},
            max_events_scored=current.models.bundles["full"].max_events if loaded else 0,
        )

    @app.post(
        "/behavior/analyze",
        response_model=BehaviorResponse,
        summary="Score one session's keystroke timing",
        dependencies=[Depends(require_api_key)],
        responses={401: {"description": "Missing or invalid API key"}, 413: {"description": "Body too large"}},
    )
    async def analyze(body: BehaviorRequest, scorer_: BehaviorScorer = Depends(get_scorer)) -> BehaviorResponse:
        if len(body.intervals) > settings.max_events:
            raise HTTPException(
                status_code=422,
                detail=f"At most {settings.max_events} events per request; received {len(body.intervals)}.",
            )
        try:
            result = scorer_.score(body.session_id, body.intervals, body.hold_durations)
        except TimingValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        return BehaviorResponse(**result.to_dict())

    return app
