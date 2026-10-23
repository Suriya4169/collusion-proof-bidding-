"""Behavioural feature extraction.

One implementation is used by training, evaluation and the live API, which removes any
possibility of training/serving skew.

Input conventions
-----------------
``flights``  one value per keystroke event: the release-to-press latency in milliseconds.
             ``flights[0]`` is the *onset latency* (focus/attach to first key press). It
             depends on how long the person read the form, not on how they type, so it is
             excluded from every statistic.
``holds``    optional; one key-down-to-key-up duration per event, in milliseconds.

Design rules for the feature set
--------------------------------
* No feature depends on how many keystrokes the session contains (no counts, totals,
  minima/maxima or ranges), so a 25-key and a 250-key session of the same typist look alike.
* Distribution *shape* (skewness and kurtosis of log timings) is included, because human
  inter-key times are right-skewed (log-normal-like) while scripted random delays are
  typically symmetric or flat.
* Only timing is used. No character, key code or content is ever read.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np

from agent4.config import (
    LONG_FLIGHT_MS,
    LONG_HOLD_MS,
    MAX_FLIGHT_CLIP_MS,
    MAX_HOLD_CLIP_MS,
    MODE_FLIGHT_ONLY,
    MODE_FULL,
    PAUSE_MS,
    SHORT_FLIGHT_MS,
    SHORT_HOLD_MS,
    TECHNICAL_MIN_EVENTS,
)

FLIGHT_FEATURES: List[str] = [
    "flight_mean_ms",
    "flight_std_ms",
    "flight_cv",
    "flight_median_ms",
    "flight_p10_ms",
    "flight_p25_ms",
    "flight_p75_ms",
    "flight_p90_ms",
    "flight_iqr_ms",
    "flight_log_skew",
    "flight_log_kurtosis",
    "flight_lag1_autocorr",
    "short_flight_ratio",
    "long_flight_ratio",
    "pause_ratio",
]

HOLD_FEATURES: List[str] = [
    "hold_mean_ms",
    "hold_std_ms",
    "hold_cv",
    "hold_median_ms",
    "hold_p10_ms",
    "hold_p25_ms",
    "hold_p75_ms",
    "hold_p90_ms",
    "hold_iqr_ms",
    "hold_log_skew",
    "hold_log_kurtosis",
    "short_hold_ratio",
    "long_hold_ratio",
]

CADENCE_FEATURES: List[str] = [
    "median_cycle_ms",
    "typing_speed_kps",
]

FEATURES_BY_MODE: Dict[str, List[str]] = {
    MODE_FULL: FLIGHT_FEATURES + HOLD_FEATURES + CADENCE_FEATURES,
    MODE_FLIGHT_ONLY: list(FLIGHT_FEATURES),
}


class TimingValidationError(ValueError):
    """Raised when raw timing input is malformed (never when it is merely atypical)."""


def validate_timings(
    flights: Sequence[float],
    holds: Optional[Sequence[float]] = None,
) -> Tuple[np.ndarray, Optional[np.ndarray]]:
    """Validate raw timing sequences and return them as float64 arrays."""
    if flights is None or len(flights) == 0:
        raise TimingValidationError("intervals must not be empty.")
    if len(flights) < TECHNICAL_MIN_EVENTS:
        raise TimingValidationError(
            f"At least {TECHNICAL_MIN_EVENTS} timing intervals are required; received {len(flights)}."
        )
    try:
        f = np.asarray(flights, dtype=np.float64)
    except (TypeError, ValueError) as exc:
        raise TimingValidationError(f"intervals must be numeric: {exc}") from exc
    if f.ndim != 1:
        raise TimingValidationError("intervals must be a flat list of numbers.")
    if not np.all(np.isfinite(f)):
        raise TimingValidationError("intervals must be finite numbers (no NaN/Infinity).")
    if np.any(f < 0.0):
        raise TimingValidationError("intervals must be non-negative.")

    h: Optional[np.ndarray] = None
    if holds is not None:
        if len(holds) != len(f):
            raise TimingValidationError(
                f"Mismatched timing lengths: received {len(holds)} hold durations for {len(f)} intervals."
            )
        try:
            h = np.asarray(holds, dtype=np.float64)
        except (TypeError, ValueError) as exc:
            raise TimingValidationError(f"hold_durations must be numeric: {exc}") from exc
        if h.ndim != 1:
            raise TimingValidationError("hold_durations must be a flat list of numbers.")
        if not np.all(np.isfinite(h)):
            raise TimingValidationError("hold_durations must be finite numbers (no NaN/Infinity).")
        if np.any(h <= 0.0):
            raise TimingValidationError("hold_durations must be strictly positive.")
    return f, h


def _log_shape(x: np.ndarray) -> Tuple[float, float]:
    """Skewness and excess kurtosis of log1p(x); (0, 0) for a constant sequence."""
    y = np.log1p(x)
    c = y - y.mean()
    m2 = float(np.mean(c * c))
    if m2 < 1e-12:
        return 0.0, 0.0
    m3 = float(np.mean(c * c * c))
    m4 = float(np.mean(c * c * c * c))
    return m3 / m2 ** 1.5, m4 / (m2 * m2) - 3.0


def _lag1_autocorr(x: np.ndarray) -> float:
    """Lag-1 autocorrelation; 0 for a constant or too-short sequence."""
    if len(x) < 3:
        return 0.0
    c = x - x.mean()
    denom = float(np.dot(c, c))
    if denom < 1e-12:
        return 0.0
    return float(np.dot(c[:-1], c[1:]) / denom)


def _distribution_block(prefix: str, x: np.ndarray) -> Dict[str, float]:
    p10, p25, p50, p75, p90 = np.percentile(x, [10, 25, 50, 75, 90])
    mean = float(np.mean(x))
    std = float(np.std(x))
    skew, kurt = _log_shape(x)
    return {
        f"{prefix}_mean_ms": mean,
        f"{prefix}_std_ms": std,
        f"{prefix}_cv": std / mean if mean > 1e-9 else 0.0,
        f"{prefix}_median_ms": float(p50),
        f"{prefix}_p10_ms": float(p10),
        f"{prefix}_p25_ms": float(p25),
        f"{prefix}_p75_ms": float(p75),
        f"{prefix}_p90_ms": float(p90),
        f"{prefix}_iqr_ms": float(p75 - p25),
        f"{prefix}_log_skew": skew,
        f"{prefix}_log_kurtosis": kurt,
    }


def extract_features(
    flights: np.ndarray,
    holds: Optional[np.ndarray] = None,
) -> Dict[str, float]:
    """Compute the feature dictionary for one validated session.

    ``flights`` and ``holds`` must already be validated float64 arrays of equal length.
    The returned dictionary always contains every flight feature, and also the hold and
    cadence features when ``holds`` is supplied.
    """
    # Drop the onset latency, then cap idle gaps.
    f = np.minimum(flights[1:], MAX_FLIGHT_CLIP_MS)

    out = _distribution_block("flight", f)
    out["flight_lag1_autocorr"] = _lag1_autocorr(f)
    out["short_flight_ratio"] = float(np.mean(f < SHORT_FLIGHT_MS))
    out["long_flight_ratio"] = float(np.mean(f > LONG_FLIGHT_MS))
    out["pause_ratio"] = float(np.mean(f >= PAUSE_MS))

    if holds is not None:
        h_all = np.minimum(holds, MAX_HOLD_CLIP_MS)
        out.update(_distribution_block("hold", h_all))
        out["short_hold_ratio"] = float(np.mean(h_all < SHORT_HOLD_MS))
        out["long_hold_ratio"] = float(np.mean(h_all > LONG_HOLD_MS))
        cycle = h_all[1:] + f
        out["median_cycle_ms"] = float(np.median(cycle))
        total_s = float(np.sum(cycle)) / 1000.0
        out["typing_speed_kps"] = float(len(cycle) / total_s) if total_s > 1e-9 else 0.0
    return out


def to_model_space(matrix: np.ndarray, mode: str) -> np.ndarray:
    """Map raw features to the space the detector is fitted in.

    Millisecond quantities and typing speed are log-transformed (timing noise is
    multiplicative) and the heavy-tailed shape statistics are clipped, so no single odd
    session can dominate the scaling or the likelihood. The transform is deterministic and
    shared by training and serving.
    """
    names = FEATURES_BY_MODE[mode]
    out = np.array(matrix, dtype=np.float64, copy=True)
    if out.ndim == 1:
        out = out[None, :]
    for j, name in enumerate(names):
        if name.endswith("_ms") or name == "typing_speed_kps":
            out[:, j] = np.log1p(np.maximum(out[:, j], 0.0))
        elif name.endswith("kurtosis"):
            out[:, j] = np.clip(out[:, j], -3.0, 25.0)
        elif name.endswith("skew"):
            out[:, j] = np.clip(out[:, j], -5.0, 8.0)
        elif name.endswith("_cv"):
            out[:, j] = np.clip(out[:, j], 0.0, 5.0)
    return out


def feature_vector(features: Dict[str, float], mode: str) -> np.ndarray:
    """Return the (1, n_features) matrix for ``mode`` in the frozen feature order."""
    names = FEATURES_BY_MODE[mode]
    try:
        row = [features[name] for name in names]
    except KeyError as exc:
        raise TimingValidationError(f"Feature {exc.args[0]!r} is unavailable for mode {mode!r}.") from exc
    vec = np.asarray([row], dtype=np.float64)
    if not np.all(np.isfinite(vec)):
        raise TimingValidationError("Feature computation produced a non-finite value.")
    return vec


def feature_matrix(
    flights_list: Sequence[np.ndarray],
    holds_list: Sequence[Optional[np.ndarray]],
    mode: str,
) -> np.ndarray:
    """Vectorise many sessions into an (n_sessions, n_features) matrix (training/evaluation)."""
    names = FEATURES_BY_MODE[mode]
    matrix = np.empty((len(flights_list), len(names)), dtype=np.float64)
    for i, (f, h) in enumerate(zip(flights_list, holds_list)):
        feats = extract_features(f, h if mode == MODE_FULL else None)
        matrix[i] = [feats[name] for name in names]
    if not np.all(np.isfinite(matrix)):
        raise TimingValidationError("Non-finite feature value encountered while building the matrix.")
    return matrix
