"""The density detector and the length-aware calibration / risk scale."""

import numpy as np
import pytest

from agent4.calibration import (
    N_KNOTS,
    QUANTILES,
    LengthCalibration,
    categorize,
    reliability_band,
)
from agent4.detector import GaussianMixtureDetector


@pytest.fixture(scope="module")
def mixture_data():
    rng = np.random.default_rng(0)
    A = rng.normal(size=(6, 6))
    X = np.vstack([rng.normal(size=(800, 6)) @ A, rng.normal(size=(800, 6)) @ A + 6.0])
    return X, [f"f{i}" for i in range(6)]


def test_numpy_scoring_matches_scikit_learn_exactly(mixture_data):
    from sklearn.mixture import GaussianMixture

    X, names = mixture_data
    det = GaussianMixtureDetector.fit(X, names, n_components=2)
    gm = GaussianMixture(n_components=2, covariance_type="full", reg_covar=1e-3, n_init=3, random_state=0)
    gm.fit(det.standardise(X))
    probe = np.random.default_rng(1).normal(size=(60, 6)) * 5
    assert np.allclose(det.score(probe), -gm.score_samples(det.standardise(probe)), atol=1e-9)


def test_detector_round_trips_through_plain_dicts(mixture_data):
    X, names = mixture_data
    det = GaussianMixtureDetector.fit(X, names, n_components=2)
    import json
    back = GaussianMixtureDetector.from_dict(json.loads(json.dumps(det.to_dict())))
    probe = X[:20] * 1.1
    assert np.array_equal(det.score(probe), back.score(probe))


def test_atypical_points_score_higher_and_extremes_stay_finite(mixture_data):
    X, names = mixture_data
    det = GaussianMixtureDetector.fit(X, names, n_components=2)
    typical, far = det.score(X[:200]).mean(), det.score(X[:200] + 40.0).mean()
    assert far > typical
    assert np.all(np.isfinite(det.score(np.full((1, 6), 1e6))))


def test_rejects_an_unknown_detector_type():
    with pytest.raises(ValueError):
        GaussianMixtureDetector.from_dict({"type": "something_else"})


def test_explain_names_the_most_deviant_feature(mixture_data):
    X, names = mixture_data
    det = GaussianMixtureDetector.fit(X, names, n_components=2)
    x = X[:1].copy()
    x[0, 3] += 50.0
    top = det.explain(x, top_k=2)
    assert top[0]["feature"] == "f3" and top[0]["z"] > 3 and len(top) == 2


# ---------------------------------------------------------------- calibration


@pytest.fixture(scope="module")
def calibration():
    rng = np.random.default_rng(2)
    n = np.exp(rng.uniform(np.log(10), np.log(300), 6000)).astype(int)
    scores = rng.normal(0, 1, 6000) * (3.0 / np.sqrt(n)) * 10 + 50.0 / n  # noisier when short
    return LengthCalibration.fit(scores, n, 10, 300), scores, n


def test_curves_have_the_expected_shape_and_ordering(calibration):
    cal, *_ = calibration
    assert cal.curves.shape == (N_KNOTS, len(QUANTILES))
    assert np.all(np.diff(cal.curves, axis=1) > 0)   # q01 < q50 < q95 < q99 at every length


def test_threshold_tracks_the_human_95th_percentile_at_every_length(calibration):
    cal, scores, n = calibration
    for lo, hi in [(10, 20), (20, 40), (40, 90), (90, 300)]:
        m = (n >= lo) & (n < hi)
        rate = np.mean(scores[m] > np.array([cal.threshold(int(k)) for k in n[m]]))
        assert 0.025 < rate < 0.08, (lo, hi, rate)


def test_risk_scale_anchors(calibration):
    cal, *_ = calibration
    for n in (10, 40, 150, 300):
        q = cal.anchors(n)
        assert cal.risk_score(q[0] - 5, n) == 0.0
        assert cal.risk_score(q[1], n) == pytest.approx(25.0)
        assert cal.risk_score(q[2], n) == pytest.approx(50.0)
        assert cal.risk_score(q[3], n) == pytest.approx(75.0)
        assert cal.risk_score(q[3] + 1e6, n) <= 100.0


def test_risk_is_monotone_and_bounded(calibration):
    cal, *_ = calibration
    grid = np.linspace(-5, 5, 400)
    for n in (10, 50, 300):
        risk = np.array([cal.risk_score(s, n) for s in grid])
        assert np.all(np.diff(risk) >= -1e-9)
        assert risk.min() >= 0.0 and risk.max() <= 100.0


def test_lengths_outside_the_trained_range_are_clamped(calibration):
    cal, *_ = calibration
    assert cal.threshold(3) == cal.threshold(10)
    assert cal.threshold(5000) == cal.threshold(300)


def test_calibration_round_trips(calibration):
    cal, *_ = calibration
    import json
    back = LengthCalibration.from_dict(json.loads(json.dumps(cal.to_dict())))
    assert np.array_equal(back.curves, cal.curves) and back.min_events == 10


def test_calibration_refuses_a_table_with_different_anchors(calibration):
    cal, *_ = calibration
    data = cal.to_dict()
    data["quantiles"] = [0.05, 0.5, 0.9, 0.99]
    with pytest.raises(ValueError):
        LengthCalibration.from_dict(data)


@pytest.mark.parametrize("risk, expected", [
    (0.0, "LOW_ANOMALY"), (49.99, "LOW_ANOMALY"), (50.0, "MODERATE_ANOMALY"),
    (74.99, "MODERATE_ANOMALY"), (75.0, "HIGH_ANOMALY"), (100.0, "HIGH_ANOMALY"),
])
def test_category_boundaries(risk, expected):
    assert categorize(risk) == expected


@pytest.mark.parametrize("n, expected", [(10, "low"), (29, "low"), (30, "medium"), (99, "medium"), (100, "high"), (300, "high")])
def test_reliability_bands(n, expected):
    assert reliability_band(n) == expected
