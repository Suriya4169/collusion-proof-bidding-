"""Platform side of Agent 4 (behavioural biometrics): find the model, score timing, record the signal.

Agent 4 returns a *signal*, never a verdict, and it never blocks anything. This module keeps it that way:

* a bid that arrives with no keystroke timing is recorded as its own signal (``no_timing``): a script that fills
  the form through the page produces no key events at all, and Agent 4 cannot score what it never sees;
* only derived values are stored (score, category, evidence text), never raw timings or typed content;
* if Agent 4 is missing or broken the platform keeps running and the signal is recorded as ``unavailable``.

Agent 4 lives in its own folder (``agent-4-behavioral-biometrics``) and is loaded lazily, so a deployment that
lacks it degrades to ``unavailable`` instead of failing to start. Set ``AGENT4_ROOT`` to point at it explicitly.
"""
import logging
import os
import sys
import threading
import uuid
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, Iterator, Optional, Sequence

from sqlalchemy.orm import Session

from src.db.models import BehaviorReviewEventModel, BehaviorSignalModel

logger = logging.getLogger("procureguard.behavior")

AGENT_DIR_NAME = "agent-4-behavioral-biometrics"
SCORING_MODES = ("full", "flight_only")

STATUS_SCORED = "scored"
STATUS_INSUFFICIENT = "insufficient_data"
STATUS_NO_TIMING = "no_timing"
STATUS_INVALID = "invalid_timing"
STATUS_UNAVAILABLE = "unavailable"

NO_TIMING_MESSAGE = (
    "No keystroke timing was received with this bid. Scripts that fill the form directly produce this; "
    "so do voice input and some assistive tools, so treat it as a reason to look closer, not as proof."
)
UNAVAILABLE_MESSAGE = "Behavioural analysis was unavailable when this bid was submitted."


class Agent4Unavailable(RuntimeError):
    """Agent 4 could not be found or loaded."""


_scorer = None
_timing_error: type = ValueError
_lock = threading.Lock()


def _candidate_roots() -> Iterator[Path]:
    env = os.getenv("AGENT4_ROOT")
    if env:
        yield Path(env)
    parents = list(Path(__file__).resolve().parents)
    # <repo>/backend/src/services/<this file>  ->  <repo>/agent-4-behavioral-biometrics
    if len(parents) > 3:
        yield parents[3] / AGENT_DIR_NAME
    # the agent folder copied inside backend/
    if len(parents) > 2:
        yield parents[2] / AGENT_DIR_NAME


def find_agent4_root() -> Optional[Path]:
    for root in _candidate_roots():
        if (root / "agent4" / "__init__.py").is_file() and (root / "models" / "manifest.json").is_file():
            return root
    return None


def _load_scorer():
    root = find_agent4_root()
    if root is None:
        raise Agent4Unavailable(
            f"Agent 4 was not found. Set AGENT4_ROOT, or place '{AGENT_DIR_NAME}' next to 'backend'."
        )
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    try:
        from agent4.config import Settings
        from agent4.features import TimingValidationError
        from agent4.scorer import BehaviorScorer

        settings = Settings.from_env()
        scorer = BehaviorScorer.from_dir(settings.model_dir, settings.min_events_override)  # verifies the SHA-256 manifest
    except Exception as exc:
        raise Agent4Unavailable(f"Agent 4 could not be loaded ({type(exc).__name__}: {exc})") from exc
    return scorer, TimingValidationError


def get_scorer():
    """The shared, immutable scorer. Raises ``Agent4Unavailable``."""
    global _scorer, _timing_error
    if _scorer is not None:
        return _scorer
    with _lock:
        if _scorer is None:
            scorer, timing_error = _load_scorer()
            _timing_error = timing_error
            _scorer = scorer
    return _scorer


def agent4_status() -> dict:
    """Readiness for the health endpoint."""
    try:
        scorer = get_scorer()
    except Agent4Unavailable as exc:
        return {"available": False, "detail": str(exc)}
    from agent4.config import SERVICE_NAME, SERVICE_VERSION

    return {
        "available": True,
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "model_version": scorer.model_version,
        "min_events": {mode: scorer.min_events(mode) for mode in SCORING_MODES},
        "max_events_scored": scorer.models.bundles["full"].max_events,
    }


def score_timing(
    session_id: str, intervals: Sequence[float], hold_durations: Optional[Sequence[float]] = None
) -> dict:
    """Score one session. Raises ``Agent4Unavailable``, or Agent 4's ``TimingValidationError`` for malformed timing."""
    return get_scorer().score(session_id, intervals, hold_durations).to_dict()


def is_timing_error(exc: BaseException) -> bool:
    return isinstance(exc, _timing_error)


def record_signal(
    db: Session,
    *,
    reference: str,
    user=None,
    session_id: Optional[str] = None,
    intervals: Optional[Sequence[float]] = None,
    hold_durations: Optional[Sequence[float]] = None,
) -> BehaviorSignalModel:
    """Score the timing sent with a bid and store the signal. Never raises because of scoring.

    This is the function the bid-submission handler calls. ``intervals`` empty or ``None`` means the bid arrived
    without any timing, which is recorded as ``no_timing``.
    """
    row = BehaviorSignalModel(
        reference=reference,
        session_id=session_id or f"srv-{uuid.uuid4().hex[:16]}",
        user_id=getattr(user, "id", None),
        msme_id=getattr(user, "msme_id", None),
        events_received=0,
    )
    if not intervals:
        row.status = STATUS_NO_TIMING
        row.message = NO_TIMING_MESSAGE
    else:
        try:
            result = score_timing(row.session_id, intervals, hold_durations)
        except Agent4Unavailable as exc:
            logger.warning("Agent 4 unavailable while recording a signal for %s: %s", reference, exc)
            row.status, row.message = STATUS_UNAVAILABLE, UNAVAILABLE_MESSAGE
        except Exception as exc:  # a scoring problem must never lose or block the bid
            if is_timing_error(exc):
                row.status, row.message = STATUS_INVALID, f"The timing data was malformed: {exc}"
            else:
                logger.exception("Agent 4 failed while scoring a signal for %s", reference)
                row.status, row.message = STATUS_UNAVAILABLE, UNAVAILABLE_MESSAGE
        else:
            row.status = result["status"]
            row.scoring_mode = result["scoring_mode"]
            row.events_received = result["events_received"]
            row.model_version = result["model_version"]
            row.risk_score = result["behavioral_risk_score"]
            row.risk_category = result["risk_category"]
            row.anomaly = result["behavioral_anomaly"]
            row.reliability = result["reliability"]
            row.evidence = result["behavioral_evidence"]
            row.message = result["message"]
    row.review_state = "pending" if row.needs_review else None
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# ───────────────────────── human review ─────────────────────────

class SignalNotFound(LookupError):
    """No behaviour signal has that id."""


def review_signal(db: Session, signal_id: int, reviewer, decision: str, note: Optional[str] = None) -> BehaviorSignalModel:
    """Record a reviewer's decision on a signal: ``cleared`` (nothing to follow up) or ``escalated`` (needs
    further checks). The decision is advisory bookkeeping: it changes nothing about any bid. Every decision is
    appended to the audit trail, so a changed mind never erases the earlier decision."""
    if decision not in BehaviorSignalModel.REVIEW_DECISIONS:
        raise ValueError(f"decision must be one of: {', '.join(BehaviorSignalModel.REVIEW_DECISIONS)}")
    row = db.query(BehaviorSignalModel).filter(BehaviorSignalModel.id == signal_id).first()
    if row is None:
        raise SignalNotFound(f"No behaviour signal with id {signal_id}.")
    now = datetime.utcnow()
    note = (note or "").strip() or None
    row.review_state, row.reviewed_by, row.reviewed_at, row.review_note = decision, reviewer.email, now, note
    db.add(BehaviorReviewEventModel(signal_id=row.id, reviewer=reviewer.email, reviewer_role=reviewer.role,
                                    decision=decision, note=note, created_at=now))
    db.commit()
    db.refresh(row)
    return row


def signal_with_history(db: Session, signal_id: int) -> Dict[str, Any]:
    """A signal plus its full review history, oldest decision first."""
    row = db.query(BehaviorSignalModel).filter(BehaviorSignalModel.id == signal_id).first()
    if row is None:
        raise SignalNotFound(f"No behaviour signal with id {signal_id}.")
    events = (db.query(BehaviorReviewEventModel).filter(BehaviorReviewEventModel.signal_id == signal_id)
              .order_by(BehaviorReviewEventModel.id).all())
    return {**row.to_dict(), "reviews": [e.to_dict() for e in events]}


def summary(db: Session) -> Dict[str, Any]:
    """Counts for a reviewer's overview. ``flag_rate`` is the share of *scored* signals with a score of 50 or more;
    for genuine users about 5% is expected, so a rate far above that is worth investigating (an attack, or a model
    that no longer fits the real users)."""
    rows = db.query(BehaviorSignalModel).all()
    scored = [r for r in rows if r.status == STATUS_SCORED]
    by_status: Dict[str, int] = {}
    by_category: Dict[str, int] = {}
    for r in rows:
        by_status[r.status] = by_status.get(r.status, 0) + 1
    for r in scored:
        by_category[r.risk_category] = by_category.get(r.risk_category, 0) + 1
    flagged = sum(1 for r in scored if r.anomaly)
    return {
        "total": len(rows),
        "by_status": by_status,
        "by_category": by_category,
        "scored": len(scored),
        "flagged": flagged,
        "flag_rate": round(flagged / len(scored), 4) if scored else None,
        "expected_flag_rate_for_genuine_users": 0.05,
        "pending_review": sum(1 for r in rows if r.review_state == "pending"),
        "escalated": sum(1 for r in rows if r.review_state == "escalated"),
        "cleared": sum(1 for r in rows if r.review_state == "cleared"),
    }
