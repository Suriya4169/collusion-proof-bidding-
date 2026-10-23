"""The scoring entry point used by the API, the CLI and the tests.

raw timing -> validation -> features -> human-density score -> length-aware risk scale.
Nothing here touches the network, the disk (after start-up) or any content: only timing.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Sequence

from agent4.artifacts import LoadedModels, ModelBundle, load_models
from agent4.calibration import categorize, reliability_band
from agent4.config import MODE_FLIGHT_ONLY, MODE_FULL, RISK_MODERATE_FROM
from agent4.evidence import build_evidence
from agent4.features import extract_features, feature_vector, to_model_space, validate_timings

STATUS_SCORED = "scored"
STATUS_INSUFFICIENT = "insufficient_data"


@dataclass
class ScoreResult:
    session_id: str
    status: str
    scoring_mode: str
    events_received: int
    events_scored: int
    model_version: str
    behavioral_risk_score: Optional[float] = None
    risk_category: Optional[str] = None
    behavioral_anomaly: Optional[bool] = None
    anomaly_score: Optional[float] = None
    operational_threshold: Optional[float] = None
    reliability: Optional[str] = None
    behavioral_evidence: List[str] = field(default_factory=list)
    top_deviations: List[Dict[str, float]] = field(default_factory=list)
    message: Optional[str] = None

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)


class BehaviorScorer:
    """Scores one session at a time. Immutable after construction, so it is thread-safe."""

    def __init__(self, models: LoadedModels, min_events_override: Optional[int] = None):
        self.models = models
        self.model_version = models.model_version
        self._min_events: Dict[str, int] = {}
        for mode, bundle in models.bundles.items():
            minimum = bundle.min_events
            if min_events_override is not None:
                if min_events_override < minimum:
                    raise ValueError(
                        f"min_events override ({min_events_override}) is below the {minimum} events the "
                        f"{mode!r} model was trained on; scores below that length are not calibrated."
                    )
                minimum = min_events_override
            self._min_events[mode] = minimum

    @classmethod
    def from_dir(cls, model_dir: Path, min_events_override: Optional[int] = None) -> "BehaviorScorer":
        return cls(load_models(Path(model_dir)), min_events_override)

    def min_events(self, mode: str = MODE_FULL) -> int:
        return self._min_events[mode]

    def score(
        self,
        session_id: str,
        intervals: Sequence[float],
        hold_durations: Optional[Sequence[float]] = None,
    ) -> ScoreResult:
        """Score one session. Raises ``TimingValidationError`` for malformed timing."""
        flights, holds = validate_timings(intervals, hold_durations)
        mode = MODE_FULL if holds is not None else MODE_FLIGHT_ONLY
        bundle: ModelBundle = self.models.bundles[mode]
        received = len(flights)

        if received < self._min_events[mode]:
            return ScoreResult(
                session_id=session_id,
                status=STATUS_INSUFFICIENT,
                scoring_mode=mode,
                events_received=received,
                events_scored=0,
                model_version=self.model_version,
                message=(
                    f"At least {self._min_events[mode]} keystroke events are needed for a calibrated score; "
                    f"received {received}. Send more of the session before scoring."
                ),
            )

        # Very long sessions are scored on their most recent window (the trained range).
        if received > bundle.max_events:
            flights = flights[-bundle.max_events:]
            holds = holds[-bundle.max_events:] if holds is not None else None
        scored = len(flights)

        features = extract_features(flights, holds)
        x = to_model_space(feature_vector(features, mode), mode)
        score = float(bundle.detector.score(x)[0])
        risk = round(bundle.calibration.risk_score(score, scored), 2)
        anomalous = risk >= RISK_MODERATE_FROM
        deviations = bundle.detector.explain(x, top_k=3)

        return ScoreResult(
            session_id=session_id,
            status=STATUS_SCORED,
            scoring_mode=mode,
            events_received=received,
            events_scored=scored,
            model_version=self.model_version,
            behavioral_risk_score=risk,
            risk_category=categorize(risk),
            behavioral_anomaly=anomalous,
            anomaly_score=round(score, 4),
            operational_threshold=round(bundle.calibration.threshold(scored), 4),
            reliability=reliability_band(scored),
            behavioral_evidence=build_evidence(deviations, anomalous),
            top_deviations=[{"feature": d["feature"], "z": round(d["z"], 2)} for d in deviations],
        )
