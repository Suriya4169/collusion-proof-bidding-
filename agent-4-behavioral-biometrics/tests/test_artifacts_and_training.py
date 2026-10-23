"""Model artifacts (integrity) and training (no leakage)."""

import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

from agent4.artifacts import MANIFEST_NAME, ModelIntegrityError, load_models, sha256_file
from agent4.config import DEFAULT_MODEL_DIR, MODES
from agent4.dataset import build_table
from agent4.simulation import (
    ATTACK_CLASSES,
    NORMAL_CLASSES,
    GenerationConfig,
    SPLIT_CALIBRATION,
    SPLIT_TRAIN,
    generate_dataset,
)
from agent4.training import components_from_name, fit_detector_and_calibration

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture()
def copied_models(small_run, tmp_path):
    dst = tmp_path / "models"
    shutil.copytree(small_run["paths"].model_dir, dst)
    return dst


def test_models_load_and_verify(small_run):
    loaded = load_models(small_run["paths"].model_dir)
    assert set(loaded.bundles) == set(MODES)
    assert loaded.model_version.startswith("2.0.0+")


def test_shipped_artifacts_match_their_manifest():
    if not (DEFAULT_MODEL_DIR / MANIFEST_NAME).exists():
        pytest.skip("no shipped model")
    manifest = json.loads((DEFAULT_MODEL_DIR / MANIFEST_NAME).read_text())
    for mode in MODES:
        entry = manifest["files"][mode]
        assert sha256_file(DEFAULT_MODEL_DIR / entry["path"]) == entry["sha256"]


def test_a_tampered_bundle_is_refused(copied_models):
    target = copied_models / "full.json"
    data = json.loads(target.read_text())
    data["calibration"]["curves"][0][2] += 1.0
    target.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ModelIntegrityError, match="SHA-256 mismatch"):
        load_models(copied_models)


def test_missing_manifest_or_bundle_is_refused(copied_models):
    (copied_models / "flight_only.json").unlink()
    with pytest.raises(ModelIntegrityError, match="missing"):
        load_models(copied_models)
    (copied_models / MANIFEST_NAME).unlink()
    with pytest.raises(ModelIntegrityError, match="manifest not found"):
        load_models(copied_models)


def test_a_bundle_with_a_different_feature_order_is_refused(copied_models):
    manifest_path = copied_models / MANIFEST_NAME
    target = copied_models / "full.json"
    data = json.loads(target.read_text())
    data["feature_names"][0], data["feature_names"][1] = data["feature_names"][1], data["feature_names"][0]
    target.write_text(json.dumps(data), encoding="utf-8")
    manifest = json.loads(manifest_path.read_text())
    manifest["files"]["full"]["sha256"] = sha256_file(target)   # a "consistent" but wrong artifact
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(ModelIntegrityError, match="Feature order"):
        load_models(copied_models)


def test_artifacts_are_json_not_pickle(small_run):
    for path in small_run["paths"].model_dir.iterdir():
        assert path.suffix == ".json"
        json.loads(path.read_text())


def test_serving_never_imports_the_training_stack():
    """The production image needs only numpy, fastapi, pydantic, uvicorn."""
    code = ("import sys; import agent4.service, agent4.scorer; "
            "bad=[m for m in ('sklearn','pandas','matplotlib','scipy','joblib') if m in sys.modules]; "
            "assert not bad, bad")
    result = subprocess.run([sys.executable, "-c", code], cwd=ROOT, capture_output=True, text=True,
                            env={**__import__("os").environ, "PYTHONDONTWRITEBYTECODE": "1"})
    assert result.returncode == 0, result.stderr


# ---------------------------------------------------------------- training hygiene


@pytest.fixture(scope="module")
def table():
    cfg = GenerationConfig(seed=5, sessions_per_class=300, stress_sessions_per_class=100)
    return build_table(generate_dataset(cfg), "full")


def test_fit_uses_only_genuine_human_training_sessions(table):
    # Even if automation sessions are (wrongly) labelled as training data, they must be ignored.
    poisoned = table
    poisoned.split = poisoned.split.copy()
    poisoned.split[np.isin(poisoned.behavior, ATTACK_CLASSES)] = SPLIT_TRAIN
    _, _, n_train, n_cal = fit_detector_and_calibration(poisoned, 2, 10, 300)
    humans = np.isin(poisoned.behavior, NORMAL_CLASSES)
    assert n_train == int(np.sum(humans & (poisoned.split == SPLIT_TRAIN)))
    assert n_cal == int(np.sum(humans & (poisoned.split == SPLIT_CALIBRATION)))


def test_provenance_records_only_human_training(small_run):
    bundle = load_models(small_run["paths"].model_dir).bundles["full"]
    assert bundle.provenance["training_classes"] == NORMAL_CLASSES
    assert "no automation" in bundle.provenance["note"].lower()


def test_components_from_name():
    assert components_from_name("gaussian_mixture_k4") == 4
    with pytest.raises(ValueError):
        components_from_name("isolation_forest")
