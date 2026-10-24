import os
from typing import Annotated, Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.core.auth import require_roles
from src.db.database import get_db
from src.db.models import BehaviorSignalModel, UserModel
from src.services import behavior_signals

router = APIRouter(
    prefix="/behavior",
    tags=["Agent 4: Behavioral Biometrics & Bid Rigging Bot Detection"]
)

# Who may do what. Agent 4 returns a signal for reviewers; it is advisory and never blocks a bid.
# Only reviewers see scores: a bidder who could read the score could tune a script against it.
REVIEW_ROLES = ["government_auditor", "admin"]
SUBMIT_ROLES = ["msme", "admin"]

MAX_EVENTS = int(os.getenv("AGENT4_MAX_EVENTS", "2000"))
SESSION_PATTERN = r"^[A-Za-z0-9._:\-]+$"

Interval = Annotated[float, Field(strict=True, ge=0, allow_inf_nan=False)]
HoldDuration = Annotated[float, Field(strict=True, gt=0, allow_inf_nan=False)]


def _check_lengths(intervals: Optional[List[float]], holds: Optional[List[float]]) -> None:
    if holds is not None and intervals is None:
        raise ValueError("hold_durations requires intervals.")
    if holds is not None and intervals is not None and len(holds) != len(intervals):
        raise ValueError(
            f"Mismatched timing lengths: received {len(holds)} hold durations for {len(intervals)} intervals."
        )


class AnalyzeRequest(BaseModel):
    """Timing metadata for one anonymous session. Nothing else is accepted."""
    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(min_length=1, max_length=128, pattern=SESSION_PATTERN,
                            description="Opaque session token. Must not encode personal information.")
    intervals: List[Interval] = Field(min_length=1, max_length=MAX_EVENTS,
                                      description="Per keystroke: release-to-press latency in ms. The first value is the onset latency.")
    hold_durations: Optional[List[HoldDuration]] = Field(default=None, min_length=1, max_length=MAX_EVENTS,
                                                         description="Optional, same length as intervals: key-down to key-up in ms. Enables the full model.")

    @model_validator(mode="after")
    def _lengths_match(self) -> "AnalyzeRequest":
        _check_lengths(self.intervals, self.hold_durations)
        return self


class SubmitRequest(BaseModel):
    """Timing sent with a bid. Leave `intervals` out (or empty) when the browser captured none."""
    model_config = ConfigDict(extra="forbid")

    reference: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._:/\-]+$",
                           description="The bid or tender reference this signal belongs to.")
    session_id: Optional[str] = Field(default=None, min_length=1, max_length=128, pattern=SESSION_PATTERN)
    intervals: Optional[List[Interval]] = Field(default=None, max_length=MAX_EVENTS)
    hold_durations: Optional[List[HoldDuration]] = Field(default=None, max_length=MAX_EVENTS)

    @model_validator(mode="after")
    def _lengths_match(self) -> "SubmitRequest":
        _check_lengths(self.intervals, self.hold_durations)
        return self


class Deviation(BaseModel):
    feature: str
    z: float


class AnalysisResult(BaseModel):
    """Agent 4's response, unchanged (see agent-4-behavioral-biometrics/docs/integration_guide.md)."""
    session_id: str
    status: str = Field(description="`scored`, or `insufficient_data` when the session is too short to score.")
    scoring_mode: str = Field(description="`full` (hold + flight) or `flight_only`.")
    behavioral_risk_score: Optional[float] = Field(None, description="0-100, relative to genuine humans of similar length.")
    risk_category: Optional[str] = Field(None, description="LOW_ANOMALY (<50), MODERATE_ANOMALY (50-75), HIGH_ANOMALY (>=75).")
    behavioral_anomaly: Optional[bool] = Field(None, description="True when the risk score is >= 50.")
    anomaly_score: Optional[float] = None
    operational_threshold: Optional[float] = None
    reliability: Optional[str] = Field(None, description="`low` (<30 keystrokes), `medium` (30-99) or `high` (>=100).")
    events_received: int
    events_scored: int
    behavioral_evidence: List[str]
    top_deviations: List[Deviation]
    model_version: str
    message: Optional[str] = None


class ReviewRequest(BaseModel):
    """A reviewer's decision on a behaviour signal. Advisory bookkeeping: it does not change any bid."""
    model_config = ConfigDict(extra="forbid")

    decision: Literal["cleared", "escalated"] = Field(description="`cleared`: nothing to follow up. `escalated`: needs further checks.")
    note: Optional[str] = Field(default=None, max_length=500, description="Why, in the reviewer's words (shown to other reviewers).")


class SubmitAck(BaseModel):
    """What a bidder gets back: an acknowledgement and nothing about the score."""
    received: bool = True
    reference: str
    session_id: str
    recorded_at: str


@router.get("/health", summary="Agent 4 Model Readiness & Health")
def health():
    state = behavior_signals.agent4_status()
    if not state["available"]:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unavailable", "model_loaded": False, "detail": state["detail"]},
        )
    return {
        "status": "ok",
        "service": f"{state['service']} (integrated)",
        "version": state["version"],
        "model_version": state["model_version"],
        "model_loaded": True,
        "min_events": state["min_events"],
        "max_events_scored": state["max_events_scored"],
    }


@router.post(
    "/analyze",
    response_model=AnalysisResult,
    summary="Analyze Keystroke Timing Dynamics for Automated Bid Bots (reviewers)",
)
def analyze_behavior(payload: AnalyzeRequest, _: UserModel = Depends(require_roles(REVIEW_ROLES))):
    """
    Scores one timing session and returns the full signal with evidence. Reviewer roles only
    (`government_auditor`, `admin`). Does NOT block bids; it provides evidence for human review.
    """
    try:
        return behavior_signals.score_timing(payload.session_id, payload.intervals, payload.hold_durations)
    except behavior_signals.Agent4Unavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        if behavior_signals.is_timing_error(exc):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
        raise


@router.post(
    "/submit",
    response_model=SubmitAck,
    status_code=status.HTTP_201_CREATED,
    summary="Record the keystroke-timing signal for a submitted bid (bidders)",
)
def submit_behavior(
    payload: SubmitRequest,
    user: UserModel = Depends(require_roles(SUBMIT_ROLES)),
    db: Session = Depends(get_db),
):
    """
    Called when a bid is submitted. The timing is scored and the signal is stored for reviewers; the bidder
    gets an acknowledgement only. A bid with no timing is recorded as `no_timing`. This never rejects a bid
    because of its score, and never fails because Agent 4 is unavailable.
    """
    row = behavior_signals.record_signal(
        db,
        reference=payload.reference,
        user=user,
        session_id=payload.session_id,
        intervals=payload.intervals,
        hold_durations=payload.hold_durations,
    )
    return SubmitAck(
        reference=row.reference,
        session_id=row.session_id,
        recorded_at=row.created_at.strftime("%Y-%m-%d %H:%M:%S"),
    )


@router.get("/signals", summary="List recorded behaviour signals (reviewers)")
def list_signals(
    reference: Optional[str] = Query(default=None, max_length=64, description="Only signals for this bid or tender reference."),
    needs_review: bool = Query(default=False, description="Only anomalous, no-timing or malformed-timing signals."),
    review_state: Optional[Literal["pending", "cleared", "escalated"]] = Query(default=None, description="Only signals in this review state."),
    limit: int = Query(default=100, ge=1, le=500),
    _: UserModel = Depends(require_roles(REVIEW_ROLES)),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    query = db.query(BehaviorSignalModel)
    if reference:
        query = query.filter(BehaviorSignalModel.reference == reference)
    if needs_review:
        query = query.filter(or_(
            BehaviorSignalModel.anomaly.is_(True),
            BehaviorSignalModel.status.in_(BehaviorSignalModel.REVIEW_STATUSES),
        ))
    if review_state:
        query = query.filter(BehaviorSignalModel.review_state == review_state)
    rows = query.order_by(BehaviorSignalModel.id.desc()).limit(limit).all()
    return {"count": len(rows), "signals": [r.to_dict() for r in rows]}


@router.get("/summary", summary="Counts for the reviewer overview (reviewers)")
def signals_summary(_: UserModel = Depends(require_roles(REVIEW_ROLES)), db: Session = Depends(get_db)) -> Dict[str, Any]:
    return behavior_signals.summary(db)


@router.get("/signals/{signal_id}", summary="One signal with its review history (reviewers)")
def get_signal(signal_id: int, _: UserModel = Depends(require_roles(REVIEW_ROLES)), db: Session = Depends(get_db)) -> Dict[str, Any]:
    try:
        return behavior_signals.signal_with_history(db, signal_id)
    except behavior_signals.SignalNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/signals/{signal_id}/review", summary="Record a review decision on a signal (reviewers)")
def review_signal(
    signal_id: int,
    payload: ReviewRequest,
    reviewer: UserModel = Depends(require_roles(REVIEW_ROLES)),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Mark a signal `cleared` or `escalated`, with an optional note. Every decision is kept in an audit trail
    (see `GET /signals/{id}`). This never blocks, rejects or changes a bid.
    """
    try:
        behavior_signals.review_signal(db, signal_id, reviewer, payload.decision, payload.note)
        return behavior_signals.signal_with_history(db, signal_id)
    except behavior_signals.SignalNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
