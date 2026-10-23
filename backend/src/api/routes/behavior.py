import sys
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, status

# Add agent-4-behavioral-biometrics to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[4]
AGENT4_ROOT = PROJECT_ROOT / "agent-4-behavioral-biometrics"
if str(AGENT4_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENT4_ROOT))

from agent4.config import SERVICE_NAME, SERVICE_VERSION, Settings
from agent4.features import TimingValidationError
from agent4.scorer import BehaviorScorer
from agent4.service import BehaviorRequest, BehaviorResponse, HealthResponse

router = APIRouter(
    prefix="/behavior",
    tags=["Agent 4: Behavioral Biometrics & Bid Rigging Bot Detection"]
)

_scorer: Optional[BehaviorScorer] = None

def get_scorer() -> BehaviorScorer:
    global _scorer
    if _scorer is None:
        settings = Settings.from_env()
        model_dir = AGENT4_ROOT / "models"
        _scorer = BehaviorScorer.from_dir(model_dir, settings.min_events_override)
    return _scorer

@router.get("/health", response_model=HealthResponse, summary="Agent 4 Model Readiness & Health")
def health():
    scorer = get_scorer()
    return HealthResponse(
        status="ok",
        service=f"{SERVICE_NAME} (integrated)",
        version=SERVICE_VERSION,
        model_version=scorer.model_version,
        model_loaded=True,
        min_events={m: scorer.min_events(m) for m in ("full", "flight_only")},
        max_events_scored=scorer.models.bundles["full"].max_events,
    )

@router.post(
    "/analyze",
    response_model=BehaviorResponse,
    summary="Analyze Keystroke Timing Dynamics for Automated Bid Bots"
)
def analyze_behavior(payload: BehaviorRequest):
    """
    Evaluates keystroke timing intervals (ms) and hold durations (ms).
    Returns an anomaly risk signal (0-100) with explainable human-readable audit evidence.
    Does NOT block bids directly; provides telemetry for fraud auditing.
    """
    try:
        scorer = get_scorer()
        result = scorer.score(payload.session_id, payload.intervals, payload.hold_durations)
        return BehaviorResponse(**result.to_dict())
    except TimingValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Behavioral analysis failed: {str(e)}"
        )
