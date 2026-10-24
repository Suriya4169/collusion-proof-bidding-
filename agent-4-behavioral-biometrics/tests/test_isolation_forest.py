"""The Isolation Forest detector: exact agreement with scikit-learn, bundle round trip, and use through the scorer."""

import json

import numpy as np
import pytest

from agent4.artifacts import ModelIntegrityError, detector_from_dict, load_models, save_models
from agent4.config import DEFAULT_MODEL_DIR, MODES
from agent4.iforest import IsolationForestDetector, average_path_length
from agent4.scorer import BehaviorScorer
from agent4.simulation import GenerationConfig, PROFILES, generate_dataset, generate_session_timings
from agent4.training import train_models

ROOT = DEFAULT_MODEL_DIR.parent
SHIPPED_FOREST_DIR = ROOT / "models_iforest"


@pytest.fixture(scope="module")
def correlated():
    """Correlated features, so that whitening genuinely changes what the forest can see."""
    rng = np.random.default_rng(0)
    A = rng.normal(size=(2000, 6))
    A[:, 1] += 0.8 * A[:, 0]
    probe = np.vstack([rng.normal(size=(400, 6)), rng.normal(loc=4.0, size=(40, 6))])
    return A, probe, [f"f{i}" for i in range(6)]


def reference_scores(train, probe, whiten, trees=100, seed=3):
    """What scikit-learn itself says, with the same preprocessing."""
    from sklearn.decomposition import PCA
    from sklearn.ensemble import IsolationForest

    mean, scale = train.mean(0), np.maximum(train.std(0), 1e-6)
    z = (train - mean) / scale
    if whiten:
        pca = PCA(whiten=True, random_state=0).fit(z)
        transform = lambda q: pca.transform((q - mean) / scale)
    else:
        transform = lambda q: (q - mean) / scale
    forest = IsolationForest(n_estimators=trees, max_samples=256, random_state=seed).fit(transform(train))
    return -forest.score_samples(transform(probe))


@pytest.mark.parametrize("whiten", [False, True])
def test_numpy_scoring_matches_scikit_learn_exactly(correlated, whiten):
    train, probe, names = correlated
    det = IsolationForestDetector.fit(train, names, n_estimators=100, whiten=whiten, random_state=3)
    assert np.allclose(det.score(probe), reference_scores(train, probe, whiten), atol=1e-12)


def test_points_sitting_exactly_on_split_values_agree_with_scikit_learn(correlated):
    """scikit-learn compares float32 copies of the data with float64 thresholds. Random data almost never lands
    within float32 rounding distance of a threshold, so this test puts points exactly on them."""
    train, _, names = correlated
    det = IsolationForestDetector.fit(train, names, n_estimators=100, whiten=False, random_state=3)
    rng = np.random.default_rng(9)
    probe = train[:300].copy()
    internal = np.argwhere(det.feature >= 0)
    for row, (tree, node) in enumerate(internal[rng.choice(len(internal), size=300, replace=False)]):
        column = det.feature[tree, node]
        probe[row, column] = det.threshold[tree, node] * det.scale[column] + det.mean[column]  # lands on the split
    assert np.allclose(det.score(probe), reference_scores(train, probe, whiten=False), atol=1e-12)


def test_the_average_path_length_normaliser():
    c = average_path_length([1, 2, 3, 256])
    assert c[0] == 0.0 and c[1] == 1.0
    assert c[2] == pytest.approx(2 * (np.log(2) + 0.5772156649) - 2 * 2 / 3)
    assert 9.9 < c[3] < 10.5  # the textbook value for 256 samples is about 10.24


@pytest.mark.parametrize("whiten", [False, True])
def test_detector_round_trips_through_plain_dicts(correlated, whiten):
    train, probe, names = correlated
    det = IsolationForestDetector.fit(train, names, n_estimators=40, whiten=whiten, random_state=1)
    back = IsolationForestDetector.from_dict(json.loads(json.dumps(det.to_dict())))
    assert np.array_equal(det.score(probe), back.score(probe))
    assert back.n_trees == 40 and back.whiten is whiten


def test_scores_lie_in_the_unit_interval_and_atypical_points_score_higher(correlated):
    train, probe, names = correlated
    det = IsolationForestDetector.fit(train, names, n_estimators=100, random_state=0)
    scores = det.score(probe)
    assert np.all((scores > 0) & (scores < 1))
    assert scores[400:].mean() > scores[:400].mean()
    assert np.all(np.isfinite(det.score(np.full((1, 6), 1e6))))


def test_scoring_does_not_depend_on_the_batch_size(correlated):
    train, probe, names = correlated
    det = IsolationForestDetector.fit(train, names, n_estimators=30, random_state=0)
    assert np.array_equal(det.mean_path_length(probe, batch=7), det.mean_path_length(probe, batch=10_000))


def test_the_same_seed_gives_the_same_forest(correlated):
    train, probe, names = correlated
    a = IsolationForestDetector.fit(train, names, n_estimators=20, random_state=5)
    b = IsolationForestDetector.fit(train, names, n_estimators=20, random_state=5)
    assert np.array_equal(a.score(probe), b.score(probe))


def test_explain_names_the_most_deviant_features(correlated):
    train, _, names = correlated
    det = IsolationForestDetector.fit(train, names, n_estimators=20, random_state=0)
    x = train[:1].copy()
    x[0, 4] += 12 * train[:, 4].std()
    top = det.explain(x, top_k=2)
    assert top[0]["feature"] == "f4" and top[0]["z"] > 5 and len(top) == 2


@pytest.mark.parametrize("data", [{"type": "gaussian_mixture"}, {"type": "something_else"}])
def test_a_forest_refuses_another_detectors_data(data):
    with pytest.raises(ValueError):
        IsolationForestDetector.from_dict(data)


def test_a_whitened_forest_needs_its_pca_parameters(correlated):
    train, _, names = correlated
    blob = IsolationForestDetector.fit(train, names, n_estimators=5, whiten=True).to_dict()
    blob["pca_components"] = None
    with pytest.raises(ValueError, match="PCA"):
        IsolationForestDetector.from_dict(blob)


def test_the_bundle_loader_chooses_the_detector_by_type_and_rejects_the_rest(correlated):
    train, _, names = correlated
    blob = IsolationForestDetector.fit(train, names, n_estimators=5).to_dict()
    assert isinstance(detector_from_dict(blob), IsolationForestDetector)
    with pytest.raises(ModelIntegrityError):
        detector_from_dict({"type": "pickle", "payload": "..."})


# ───────────────────────── a complete bundle, served through the real scorer ─────────────────────────

@pytest.fixture(scope="module")
def forest_bundle(tmp_path_factory):
    config = GenerationConfig(seed=5, sessions_per_class=400, stress_sessions_per_class=200)
    sessions = generate_dataset(config)
    bundles = train_models(sessions, config, {mode: "isolation_forest_whitened" for mode in MODES})
    directory = tmp_path_factory.mktemp("forest_models")
    save_models(bundles, directory, training_seed=5, indent=None)
    return directory, load_models(directory)


def test_a_forest_bundle_saves_verifies_and_loads(forest_bundle):
    directory, loaded = forest_bundle
    for mode in MODES:
        assert type(loaded.bundles[mode].detector).__name__ == "IsolationForestDetector"
        assert loaded.bundles[mode].provenance["detector"] == "isolation_forest_whitened"
    assert loaded.model_version.startswith("2.")


def test_a_tampered_forest_bundle_is_refused(forest_bundle, tmp_path):
    directory, _ = forest_bundle
    copy = tmp_path / "copy"
    copy.mkdir()
    for f in directory.glob("*.json"):
        (copy / f.name).write_bytes(f.read_bytes())
    path = copy / "full.json"
    path.write_text(path.read_text(encoding="utf-8").replace('"c_psi":', '"c_psi": 1.0, "x":', 1), encoding="utf-8")
    with pytest.raises(ModelIntegrityError, match="SHA-256"):
        load_models(copy)


def test_compact_json_keeps_the_forest_bundle_small(forest_bundle, tmp_path):
    directory, loaded = forest_bundle
    compact = (directory / "full.json").stat().st_size
    indented = len(json.dumps(loaded.bundles["full"].to_dict(), indent=1))
    assert compact < indented / 2


def test_the_scorer_serves_a_forest_and_separates_a_script_from_a_person(forest_bundle):
    _, loaded = forest_bundle
    scorer = BehaviorScorer(loaded)
    rng = np.random.default_rng(1)
    flights, holds = generate_session_timings(rng, PROFILES["REGULAR_AUTOMATION"], 60)
    bot = scorer.score("bot", flights.tolist(), holds.tolist())
    assert bot.status == "scored" and bot.risk_category == "HIGH_ANOMALY"
    risks = []
    for i in range(60):
        f, h = generate_session_timings(np.random.default_rng(100 + i), PROFILES["HUMAN_LIKE"], 60)
        risks.append(scorer.score(f"h{i}", f.tolist(), h.tolist()).behavioral_risk_score)
    assert np.mean(np.array(risks) >= 50) < 0.20  # most simulated people pass; the calibrated budget is about 5%
    assert bot.model_version == loaded.model_version and bot.behavioral_evidence


def test_a_short_session_is_still_not_scored(forest_bundle):
    _, loaded = forest_bundle
    result = BehaviorScorer(loaded).score("short", [100.0] * 5, [90.0] * 5)
    assert result.status == "insufficient_data"


# ───────────────────────── the shipped forest bundle ─────────────────────────

def test_the_shipped_forest_bundle_verifies_and_can_be_served():
    if not (SHIPPED_FOREST_DIR / "manifest.json").exists():
        pytest.skip("run `python -m agent4 compare-detectors` to create models_iforest/")
    loaded = load_models(SHIPPED_FOREST_DIR)
    assert all(type(b.detector).__name__ == "IsolationForestDetector" for b in loaded.bundles.values())
    from agent4.config import Settings
    from agent4.service import create_app
    from fastapi.testclient import TestClient

    body = json.loads((ROOT / "docs" / "examples" / "automation_full.request.json").read_text(encoding="utf-8"))
    with TestClient(create_app(Settings(model_dir=SHIPPED_FOREST_DIR))) as client:  # the model loads at start-up
        response = client.post("/behavior/analyze", json=body)
        assert response.status_code == 200 and response.json()["risk_category"] == "HIGH_ANOMALY"
        assert client.get("/health").json()["model_version"] == loaded.model_version


def test_the_production_mixture_bundle_is_untouched_by_the_forest_work():
    from agent4.artifacts import sha256_file

    manifest = json.loads((DEFAULT_MODEL_DIR / "manifest.json").read_text(encoding="utf-8"))
    for mode in MODES:
        entry = manifest["files"][mode]
        assert sha256_file(DEFAULT_MODEL_DIR / entry["path"]) == entry["sha256"]
    assert manifest["model_version"] == "2.0.0+4f20da5f"
