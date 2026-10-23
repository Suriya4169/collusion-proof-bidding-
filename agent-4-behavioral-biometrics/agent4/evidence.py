"""Plain-language evidence descriptors.

Descriptors are derived from how far each feature sits from the nearest typical-human
component (a standardised deviation, ``z``). They describe *observable timing properties*;
they are not causal explanations of the model and never assert fraud.
"""

from __future__ import annotations

from typing import Dict, List, Optional

Z_REPORT = 3.0  # |z| at or above this is reported as evidence

_EXACT: Dict[str, Dict[str, str]] = {
    "flight_lag1_autocorr": {"high": "sequential_dependence_in_flight_times", "low": "sequential_dependence_in_flight_times"},
    "flight_log_skew": {"low": "symmetric_flight_time_distribution", "high": "extremely_skewed_flight_time_distribution"},
    "flight_log_kurtosis": {"low": "flat_flight_time_distribution", "high": "heavy_tailed_flight_time_distribution"},
    "hold_log_skew": {"low": "atypical_hold_time_distribution_shape", "high": "atypical_hold_time_distribution_shape"},
    "hold_log_kurtosis": {"low": "flat_hold_time_distribution", "high": "atypical_hold_time_distribution_shape"},
    "short_flight_ratio": {"high": "burst_like_timing_pattern", "low": "no_rapid_key_transitions"},
    "long_flight_ratio": {"low": "absence_of_long_gaps", "high": "frequent_long_gaps"},
    "pause_ratio": {"low": "absence_of_hesitation_pauses", "high": "frequent_hesitation_pauses"},
    "short_hold_ratio": {"high": "many_ultra_short_key_presses", "low": "no_short_key_presses"},
    "long_hold_ratio": {"high": "many_long_key_holds", "low": "no_long_key_holds"},
    "typing_speed_kps": {"high": "rapid_typing_cadence", "low": "slow_typing_cadence"},
    "median_cycle_ms": {"low": "rapid_typing_cadence", "high": "slow_typing_cadence"},
}

# (feature name suffix, low descriptor, high descriptor) for the families of related statistics.
_FAMILIES = [
    ("flight", ("_cv", "_std_ms", "_iqr_ms"), "unusually_regular_flight_timing", "unusually_erratic_flight_timing"),
    ("flight", ("_mean_ms", "_median_ms", "_p10_ms", "_p25_ms", "_p75_ms", "_p90_ms"),
     "unusually_short_flight_intervals", "unusually_long_flight_intervals"),
    ("hold", ("_cv", "_std_ms", "_iqr_ms"), "unusually_regular_hold_timing", "unusually_variable_hold_timing"),
    ("hold", ("_mean_ms", "_median_ms", "_p10_ms", "_p25_ms", "_p75_ms", "_p90_ms"),
     "unusually_short_key_holds", "unusually_long_key_holds"),
]


def describe_feature(feature: str, z: float) -> Optional[str]:
    direction = "high" if z > 0 else "low"
    if feature in _EXACT:
        return _EXACT[feature].get(direction)
    for prefix, suffixes, low_name, high_name in _FAMILIES:
        if feature.startswith(prefix) and feature[len(prefix):] in suffixes:
            return high_name if direction == "high" else low_name
    return f"atypical_{feature}_{direction}"


def build_evidence(deviations: List[Dict[str, float]], anomalous: bool, max_items: int = 3) -> List[str]:
    """Evidence list for a response. Typical sessions never report per-feature extremes."""
    if not anomalous:
        return ["typical_human_timing"]
    names: List[str] = []
    for dev in deviations:
        if abs(dev["z"]) >= Z_REPORT:
            name = describe_feature(dev["feature"], dev["z"])
            if name and name not in names:
                names.append(name)
        if len(names) >= max_items:
            break
    return names or ["unusual_combination_of_timing_features"]
