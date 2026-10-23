"""Length-aware calibration and the 0-100 risk scale.

Why length-aware: the statistics of a genuine human session are noisy when it is short and
tight when it is long. A single global threshold is therefore too strict for short sessions
and far too lax for long ones (a bot that is obvious over 200 keystrokes would pass). The
anomaly-score quantiles of *held-out human sessions* are estimated as a smooth function of
session length and stored as a small table.

Risk scale (all relative to genuine human sessions of similar length)
--------------------------------------------------------------------
    risk  0  ->  1st percentile of human scores   (most typical)
    risk 25  ->  median human score
    risk 50  ->  95th percentile   (human false-alarm rate = target_fpr = 5%)
    risk 75  ->  99th percentile   (human false-alarm rate = 1%)
    risk -> 100 asymptotically above the 99th percentile

Categories: LOW_ANOMALY < 50 <= MODERATE_ANOMALY < 75 <= HIGH_ANOMALY.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

import numpy as np

from agent4.config import RISK_HIGH_FROM, RISK_MODERATE_FROM

# Quantile anchors stored in the table, in this order.
QUANTILES = (0.01, 0.50, 0.95, 0.99)
RISK_AT_ANCHOR = (0.0, 25.0, 50.0, 75.0)

N_KNOTS = 14
KERNEL_BANDWIDTH = 0.30  # in log(n_events)


def _weighted_quantile(x: np.ndarray, w: np.ndarray, q: float) -> float:
    order = np.argsort(x)
    x, w = x[order], w[order]
    cum = (np.cumsum(w) - 0.5 * w) / np.sum(w)
    return float(np.interp(q, cum, x))


@dataclass
class LengthCalibration:
    """Human score quantiles as a smooth function of session length."""

    log_n_knots: np.ndarray   # (n_knots,)
    curves: np.ndarray        # (n_knots, len(QUANTILES))
    min_events: int
    max_events: int
    n_calibration_sessions: int

    @classmethod
    def fit(cls, scores: np.ndarray, n_events: np.ndarray, min_events: int, max_events: int) -> "LengthCalibration":
        scores = np.asarray(scores, dtype=np.float64)
        log_n = np.log(np.asarray(n_events, dtype=np.float64))
        knots = np.linspace(np.log(min_events), np.log(max_events), N_KNOTS)
        curves = np.empty((N_KNOTS, len(QUANTILES)))
        for i, k in enumerate(knots):
            w = np.exp(-0.5 * ((log_n - k) / KERNEL_BANDWIDTH) ** 2)
            for j, q in enumerate(QUANTILES):
                curves[i, j] = _weighted_quantile(scores, w, q)
        # Tail quantiles rest on few sessions and are noisy, so smooth each curve along the
        # length axis with a 3-tap filter. The two end knots are left untouched: the curves
        # are steep and convex at short lengths, and averaging there would bias the thresholds.
        smoothed = curves.copy()
        smoothed[1:-1] = 0.25 * curves[:-2] + 0.5 * curves[1:-1] + 0.25 * curves[2:]
        curves = smoothed
        # Enforce a strictly increasing anchor ladder at every knot (numerical safety).
        for j in range(1, len(QUANTILES)):
            curves[:, j] = np.maximum(curves[:, j], curves[:, j - 1] + 1e-6)
        return cls(knots, curves, int(min_events), int(max_events), int(len(scores)))

    def anchors(self, n_events: int) -> np.ndarray:
        """Quantile anchors (q01, q50, q95, q99) of the human score at this session length."""
        log_n = float(np.log(np.clip(n_events, self.min_events, self.max_events)))
        return np.array([np.interp(log_n, self.log_n_knots, self.curves[:, j]) for j in range(len(QUANTILES))])

    def threshold(self, n_events: int) -> float:
        """Anomaly-score threshold at the target false-positive rate for this length."""
        return float(self.anchors(n_events)[2])

    def risk_score(self, score: float, n_events: int) -> float:
        """Map an anomaly score to the 0-100 risk scale for a session of this length."""
        q = self.anchors(n_events)
        if score >= q[3]:
            tau = max(q[3] - q[2], 1e-6)
            risk = RISK_AT_ANCHOR[3] + (100.0 - RISK_AT_ANCHOR[3]) * (1.0 - np.exp(-(score - q[3]) / tau))
        else:
            risk = float(np.interp(score, q, RISK_AT_ANCHOR))  # clamps to 0 below q01
        return float(np.clip(risk, 0.0, 100.0))

    def to_dict(self) -> Dict[str, object]:
        return {
            "quantiles": list(QUANTILES),
            "risk_at_anchor": list(RISK_AT_ANCHOR),
            "kernel_bandwidth_log_n": KERNEL_BANDWIDTH,
            "log_n_knots": self.log_n_knots.tolist(),
            "curves": self.curves.tolist(),
            "min_events": self.min_events,
            "max_events": self.max_events,
            "n_calibration_sessions": self.n_calibration_sessions,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "LengthCalibration":
        if list(data["quantiles"]) != list(QUANTILES):
            raise ValueError("Calibration table was produced with different quantile anchors.")
        return cls(
            log_n_knots=np.asarray(data["log_n_knots"], dtype=np.float64),
            curves=np.asarray(data["curves"], dtype=np.float64),
            min_events=int(data["min_events"]),
            max_events=int(data["max_events"]),
            n_calibration_sessions=int(data["n_calibration_sessions"]),
        )


def categorize(risk_score: float) -> str:
    if risk_score < RISK_MODERATE_FROM:
        return "LOW_ANOMALY"
    if risk_score < RISK_HIGH_FROM:
        return "MODERATE_ANOMALY"
    return "HIGH_ANOMALY"


def reliability_band(n_events: int) -> str:
    """How much timing evidence the score rests on (see the model card for measured rates)."""
    if n_events < 30:
        return "low"
    if n_events < 100:
        return "medium"
    return "high"
