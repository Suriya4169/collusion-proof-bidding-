"""Feature extraction: correctness against independent calculations, invariances, validation."""

import numpy as np
import pytest

from agent4.config import MAX_FLIGHT_CLIP_MS, MODE_FLIGHT_ONLY, MODE_FULL
from agent4.features import (
    FEATURES_BY_MODE,
    TimingValidationError,
    extract_features,
    feature_matrix,
    feature_vector,
    to_model_space,
    validate_timings,
)

from conftest import make_session


def _session(n=40, seed=1):
    rng = np.random.default_rng(seed)
    flights = np.concatenate([[1500.0], rng.lognormal(5.1, 0.35, n - 1)])
    holds = rng.lognormal(4.45, 0.22, n)
    return flights, holds


def test_feature_values_match_an_independent_calculation():
    flights, holds = _session()
    feats = extract_features(flights, holds)
    f = np.minimum(flights[1:], MAX_FLIGHT_CLIP_MS)   # onset excluded, idle gaps capped
    assert feats["flight_mean_ms"] == pytest.approx(f.mean())
    assert feats["flight_std_ms"] == pytest.approx(f.std())
    assert feats["flight_cv"] == pytest.approx(f.std() / f.mean())
    assert feats["flight_median_ms"] == pytest.approx(np.median(f))
    assert feats["flight_p10_ms"] == pytest.approx(np.percentile(f, 10))
    assert feats["flight_iqr_ms"] == pytest.approx(np.percentile(f, 75) - np.percentile(f, 25))
    assert feats["short_flight_ratio"] == pytest.approx(np.mean(f < 50))
    assert feats["long_flight_ratio"] == pytest.approx(np.mean(f > 300))
    assert feats["pause_ratio"] == pytest.approx(np.mean(f >= 400))
    assert feats["hold_mean_ms"] == pytest.approx(holds.mean())
    assert feats["short_hold_ratio"] == pytest.approx(np.mean(holds < 45))
    assert feats["long_hold_ratio"] == pytest.approx(np.mean(holds > 120))
    cycle = holds[1:] + f
    assert feats["median_cycle_ms"] == pytest.approx(np.median(cycle))
    assert feats["typing_speed_kps"] == pytest.approx(len(cycle) / (cycle.sum() / 1000.0))
    log_f = np.log1p(f)
    centred = log_f - log_f.mean()
    assert feats["flight_log_skew"] == pytest.approx(np.mean(centred ** 3) / np.mean(centred ** 2) ** 1.5)
    assert feats["flight_log_kurtosis"] == pytest.approx(np.mean(centred ** 4) / np.mean(centred ** 2) ** 2 - 3.0)
    assert feats["flight_lag1_autocorr"] == pytest.approx(
        np.dot(f[:-1] - f.mean(), f[1:] - f.mean()) / np.dot(f - f.mean(), f - f.mean()))


def test_onset_latency_does_not_affect_any_feature():
    flights, holds = _session()
    a = extract_features(flights, holds)
    flights2 = flights.copy()
    flights2[0] = 90_000.0
    b = extract_features(flights2, holds)
    assert a == b


def test_idle_gaps_are_capped():
    flights, holds = _session()
    a, b = flights.copy(), flights.copy()
    a[10], b[10] = 5_000.0, 60_000.0
    assert extract_features(a, holds) == extract_features(b, holds)


def test_flight_only_mode_needs_no_holds_and_has_no_hold_features():
    flights, _ = _session()
    feats = extract_features(flights, None)
    assert set(FEATURES_BY_MODE[MODE_FLIGHT_ONLY]) <= set(feats)
    assert not any(k.startswith("hold_") for k in feats)
    assert feature_vector(feats, MODE_FLIGHT_ONLY).shape == (1, len(FEATURES_BY_MODE[MODE_FLIGHT_ONLY]))


def test_full_vector_follows_the_frozen_order_and_is_finite():
    flights, holds = _session()
    vec = feature_vector(extract_features(flights, holds), MODE_FULL)
    names = FEATURES_BY_MODE[MODE_FULL]
    assert vec.shape == (1, len(names))
    assert np.all(np.isfinite(vec))
    assert vec[0, names.index("flight_mean_ms")] == pytest.approx(extract_features(flights, holds)["flight_mean_ms"])


def test_perfectly_regular_input_gives_finite_features():
    feats = extract_features(np.full(30, 100.0), np.full(30, 60.0))
    assert all(np.isfinite(v) for v in feats.values())
    assert feats["flight_cv"] == 0.0 and feats["flight_log_skew"] == 0.0 and feats["flight_lag1_autocorr"] == 0.0


def test_no_feature_is_a_count_total_or_extreme_of_the_session():
    keys = set(extract_features(*make_session("HUMAN_LIKE", 30, 0)).keys())
    assert not keys & {"num_events", "total_duration_ms", "flight_max_ms", "flight_min_ms",
                       "flight_range_ms", "hold_max_ms", "hold_min_ms", "hold_range_ms", "pause_count"}


def test_robust_statistics_are_stable_across_session_lengths():
    """The same typist's median timing and speed look the same at 30 and 300 keystrokes."""
    names = list(extract_features(*make_session("HUMAN_LIKE", 30, 0)).keys())
    short = np.array([[*extract_features(*make_session("HUMAN_LIKE", 30, s)).values()] for s in range(150)])
    long = np.array([[*extract_features(*make_session("HUMAN_LIKE", 300, 1000 + s)).values()] for s in range(150)])
    for name in ("flight_median_ms", "hold_median_ms", "typing_speed_kps"):
        j = names.index(name)
        assert abs(short[:, j].mean() - long[:, j].mean()) < 0.12 * abs(long[:, j].mean()), name


def test_dispersion_statistics_are_noisier_in_short_sessions():
    """Why the threshold must depend on length: the spread of a human's cv shrinks as evidence grows."""
    names = list(extract_features(*make_session("HUMAN_LIKE", 30, 0)).keys())
    j = names.index("flight_cv")
    short = [extract_features(*make_session("HUMAN_LIKE", 20, s))["flight_cv"] for s in range(200)]
    long = [extract_features(*make_session("HUMAN_LIKE", 300, 5000 + s))["flight_cv"] for s in range(200)]
    assert np.std(short) > 1.5 * np.std(long) and j >= 0


def test_model_space_transform_is_deterministic_and_clips():
    flights, holds = _session()
    raw = feature_vector(extract_features(flights, holds), MODE_FULL)
    assert np.array_equal(to_model_space(raw, MODE_FULL), to_model_space(raw, MODE_FULL))
    wild = raw.copy()
    names = FEATURES_BY_MODE[MODE_FULL]
    wild[0, names.index("flight_log_kurtosis")] = 1e9
    wild[0, names.index("flight_cv")] = 1e9
    out = to_model_space(wild, MODE_FULL)
    assert out[0, names.index("flight_log_kurtosis")] == 25.0
    assert out[0, names.index("flight_cv")] == 5.0


@pytest.mark.parametrize("flights, holds, fragment", [
    ([], None, "empty"),
    ([100.0] * 3, None, "At least"),
    ([100.0] * 9 + [-1.0], None, "non-negative"),
    ([100.0] * 9 + [float("nan")], None, "finite"),
    ([100.0] * 9 + [float("inf")], None, "finite"),
    ([100.0] * 10, [80.0] * 9, "Mismatched"),
    ([100.0] * 10, [80.0] * 9 + [0.0], "strictly positive"),
    ([100.0] * 10, [80.0] * 9 + [float("nan")], "finite"),
    (["a"] * 10, None, "numeric"),
])
def test_validation_rejects_malformed_timing(flights, holds, fragment):
    with pytest.raises(TimingValidationError, match=fragment):
        validate_timings(flights, holds)


def test_validation_accepts_clean_input():
    f, h = validate_timings([1, 2, 3, 4, 5, 6], [10, 11, 12, 13, 14, 15])
    assert f.dtype == np.float64 and h.dtype == np.float64


def test_feature_matrix_matches_single_session_extraction():
    sessions = [make_session("HUMAN_LIKE", 50, s) for s in range(5)]
    M = feature_matrix([f for f, _ in sessions], [h for _, h in sessions], MODE_FULL)
    for i, (f, h) in enumerate(sessions):
        assert np.allclose(M[i], feature_vector(extract_features(f, h), MODE_FULL)[0])
