"""MCP server for the bot-detection module (Agent 4), so AI assistants and agent frameworks can use it as tools.

Model Context Protocol exposes capabilities to LLM clients (Claude Desktop, Claude Code, LangGraph agents ...).
This server wraps the module's *read-only* functions: it can score a typing-timing session and read the stored
signals, but it cannot record or change a review decision. Agent 4's rule holds here too: a score is a signal for
a human to look at, never a verdict, and nothing it returns should be used to block a bid.

Two ways to run it:

* **Mounted in the platform** at ``/mcp/`` (streamable HTTP). Only signed-in reviewers (``government_auditor`` or
  ``admin``) get through: send the platform's JWT as ``Authorization: Bearer <token>``.
* **Standalone over stdio**, for a desktop assistant on the same machine::

      python -m src.mcp_server        (run from backend/, with the same .env as the API)

  stdio has no network surface: whoever launches the process is trusted, like running the API's own CLI.

Tools: ``analyze_keystroke_timing``, ``list_behavior_signals``, ``get_behavior_signal``, ``behavior_model_status``.
Resource: ``procureguard://agent4/interpretation-guide``. Prompt: ``review_flagged_bid``.
"""
import contextlib
import json
import logging
import os
from typing import Annotated, Any, AsyncIterator, Dict, List, Optional

from pydantic import Field, ValidationError
from sqlalchemy import or_

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations

from src.api.routes.behavior import AnalyzeRequest
from src.core.access import REVIEWERS
from src.core.auth import decode_access_token
from src.db import database
from src.db.models import BehaviorSignalModel, UserModel
from src.services import behavior_signals

logger = logging.getLogger("procureguard.mcp")

MOUNT_PATH = "/mcp"

INSTRUCTIONS = (
    "Tools for ProcureGuard-AI's bot-detection module (Agent 4, keystroke-timing biometrics). "
    "Scores are 0-100 risk SIGNALS relative to genuine humans of similar session length: 50 is the 95th "
    "percentile of humans, 75 the 99th. About 1 in 20 honest users score above 50. A signal is evidence for a "
    "human reviewer; never state or imply that a bidder committed fraud, and never recommend rejecting a bid on "
    "a score. Read the interpretation guide resource before explaining a score."
)

INTERPRETATION_GUIDE = """# Reading an Agent 4 behaviour signal

**What it measures.** Only keystroke timing: the gap between releasing one key and pressing the next, and how long
each key is held. It never sees which keys were pressed or what was typed.

**The score (0-100).** Relative to genuine humans typing sessions of similar length. 50 = the 95th percentile of
humans (about 1 in 20 honest sessions score above it). 75 = the 99th percentile.

| Category | Score | Meaning |
|---|---|---|
| LOW_ANOMALY | below 50 | Within the range of genuine human typing. |
| MODERATE_ANOMALY | 50 to 75 | Unusual; worth a look, common among honest users. |
| HIGH_ANOMALY | 75 and above | Rare for humans; typical of scripted or injected input. |

**Reliability** depends on session length: low under 30 keystrokes, medium 30-99, high 100 or more. Treat a high
score on a low-reliability session with caution.

**Statuses.** `scored`; `insufficient_data` (under 10 keystrokes, not scored); `no_timing` (the bid arrived with no
keystroke timing at all: a script filling the form directly looks like this, but so do voice input and some
assistive tools); `invalid_timing`; `unavailable` (the model could not run: says nothing about the bidder).

**Limits to state when explaining a result.**
* A script that replays a real person's recorded rhythm is indistinguishable by timing alone.
* The model was trained on simulated typing; it must be retrained on real genuine sessions before it carries weight.
* A signal is advisory. It supports a human review; it is not evidence of fraud and must not block a bid.
"""

server = MCPServer("procureguard-bot-detection", instructions=INSTRUCTIONS, version="1.0.0")

_READ_ONLY = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)


@contextlib.contextmanager
def open_session():
    """A database session, resolved at call time so the platform's configured database is always used."""
    session = database.SessionLocal()
    try:
        yield session
    finally:
        session.close()


@server.tool(annotations=_READ_ONLY)
def analyze_keystroke_timing(
    session_id: Annotated[str, Field(description="Opaque session token (letters, digits, . _ : -). Never a name or e-mail address.")],
    intervals: Annotated[List[float], Field(description="Per keystroke: release-to-press latency in ms. The first value is the onset latency.")],
    hold_durations: Annotated[Optional[List[float]], Field(description="Optional, same length: key-down to key-up in ms. Enables the full model.")] = None,
) -> Dict[str, Any]:
    """Score one typing-timing session with Agent 4 and return the full signal: risk score, category, reliability
    and plain-language evidence. Needs at least 10 keystrokes. The result is a signal, not a verdict."""
    try:
        request = AnalyzeRequest(session_id=session_id, intervals=intervals, hold_durations=hold_durations)
    except ValidationError as exc:
        raise ValueError("; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors())) from exc
    try:
        return behavior_signals.score_timing(request.session_id, request.intervals, request.hold_durations)
    except behavior_signals.Agent4Unavailable as exc:
        raise RuntimeError(str(exc)) from exc
    except Exception as exc:
        if behavior_signals.is_timing_error(exc):
            raise ValueError(str(exc)) from exc
        raise


@server.tool(annotations=_READ_ONLY)
def list_behavior_signals(
    reference: Annotated[Optional[str], Field(max_length=64, description="Only signals for this bid or tender reference.")] = None,
    needs_review: Annotated[bool, Field(description="Only anomalous, no-timing or malformed-timing signals.")] = False,
    limit: Annotated[int, Field(ge=1, le=200)] = 50,
) -> Dict[str, Any]:
    """List stored behaviour signals, newest first. Each has the status, risk score and category, reliability,
    evidence text and a `needs_review` flag."""
    with open_session() as db:
        query = db.query(BehaviorSignalModel)
        if reference:
            query = query.filter(BehaviorSignalModel.reference == reference)
        if needs_review:
            query = query.filter(or_(
                BehaviorSignalModel.anomaly.is_(True),
                BehaviorSignalModel.status.in_(BehaviorSignalModel.REVIEW_STATUSES),
            ))
        rows = query.order_by(BehaviorSignalModel.id.desc()).limit(limit).all()
        return {"count": len(rows), "signals": [r.to_dict() for r in rows]}


@server.tool(annotations=_READ_ONLY)
def get_behavior_signal(signal_id: Annotated[int, Field(ge=1)]) -> Dict[str, Any]:
    """One stored behaviour signal by id with its review history, or an error if there is none."""
    with open_session() as db:
        try:
            return behavior_signals.signal_with_history(db, signal_id)
        except behavior_signals.SignalNotFound as exc:
            raise ValueError(str(exc)) from exc


@server.tool(annotations=_READ_ONLY)
def behavior_model_status() -> Dict[str, Any]:
    """Whether the Agent 4 model is loaded, its version and the minimum number of keystrokes it scores."""
    return behavior_signals.agent4_status()


@server.resource("procureguard://agent4/interpretation-guide", name="interpretation-guide", mime_type="text/markdown",
                 description="How to read an Agent 4 behaviour signal, and what to say about its limits.")
def interpretation_guide() -> str:
    return INTERPRETATION_GUIDE


@server.prompt(description="Review the behaviour signals recorded for one bid and write a cautious summary for a human reviewer.")
def review_flagged_bid(reference: str) -> str:
    return (
        f"Review the behaviour signals recorded for bid reference {reference!r}.\n"
        f"1. Read the resource procureguard://agent4/interpretation-guide.\n"
        f"2. Call list_behavior_signals with reference={reference!r}.\n"
        f"3. For each signal, report the status, score, category, reliability and the evidence text.\n"
        f"4. Explain what the signal does and does not show, including the session length and reliability.\n"
        f"5. Suggest what a human reviewer could check next. Do not conclude that the bidder acted improperly and "
        f"do not recommend rejecting the bid."
    )


# ───────────────────────── mounting in the platform ─────────────────────────

class ReviewerBearerGuard:
    """ASGI wrapper: only a signed-in reviewer reaches the wrapped app.

    Reads ``Authorization: Bearer <platform JWT>``, checks the signature and that the account exists, is active
    and has a reviewer role. Anything else gets 401 (no valid login) or 403 (wrong role)."""

    def __init__(self, app, roles=None):
        self.app = app
        self.roles = list(roles or REVIEWERS)

    @staticmethod
    def _token(scope) -> Optional[str]:
        for name, value in scope.get("headers", []):
            if name == b"authorization":
                scheme, _, token = value.decode("latin-1").partition(" ")
                if scheme.lower() == "bearer" and token.strip():
                    return token.strip()
        return None

    def _user_role(self, token: str) -> Optional[str]:
        payload = decode_access_token(token)
        email = payload.get("sub") if payload else None
        if not email:
            return None
        with open_session() as db:
            user = db.query(UserModel).filter(UserModel.email == email).first()
            return user.role if user is not None and user.is_active else None

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        token = self._token(scope)
        role = self._user_role(token) if token else None
        if role is None:
            await self._reject(send, 401, "A valid login is required: send the platform JWT as a Bearer token.",
                               {b"www-authenticate": b"Bearer"})
        elif role not in self.roles:
            await self._reject(send, 403, f"Operation not permitted. Required role: {', '.join(self.roles)}.")
        else:
            await self.app(scope, receive, send)

    @staticmethod
    async def _reject(send, status: int, detail: str, extra: Optional[Dict[bytes, bytes]] = None):
        body = json.dumps({"detail": detail}).encode()
        headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]
        headers += list((extra or {}).items())
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})


_mounted = False

DEFAULT_ALLOWED_HOSTS = "localhost:*,127.0.0.1:*,[::1]:*"
DEFAULT_ALLOWED_ORIGINS = "http://localhost:*,http://127.0.0.1:*,http://[::1]:*"


def _csv(name: str, default: str) -> List[str]:
    return [item.strip() for item in (os.getenv(name) or default).split(",") if item.strip()]


def transport_security() -> TransportSecuritySettings:
    """DNS-rebinding protection: the endpoint only answers requests addressed to a host it expects. The default is
    this machine; list the names clients really use in ``MCP_ALLOWED_HOSTS`` (for example
    ``api.example.org,backend:8000``) and browser origins in ``MCP_ALLOWED_ORIGINS``."""
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=_csv("MCP_ALLOWED_HOSTS", DEFAULT_ALLOWED_HOSTS),
        allowed_origins=_csv("MCP_ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS),
    )


def mount(app) -> None:
    """Serve the MCP endpoint at ``/mcp/`` on a FastAPI app, behind the reviewer guard."""
    global _mounted
    inner = server.streamable_http_app(streamable_http_path="/", transport_security=transport_security())
    app.mount(MOUNT_PATH, ReviewerBearerGuard(inner))
    _mounted = True
    logger.info("MCP server mounted at %s/ (reviewers only)", MOUNT_PATH)


@contextlib.asynccontextmanager
async def lifespan() -> AsyncIterator[None]:
    """Run the MCP session manager for as long as the platform runs (a mounted app's own lifespan is not run
    by FastAPI). Does nothing when ``mount`` was not called."""
    if not _mounted:
        yield
        return
    async with server.session_manager.run():
        yield


if __name__ == "__main__":  # python -m src.mcp_server
    logging.basicConfig(level=logging.INFO)
    server.run("stdio")
