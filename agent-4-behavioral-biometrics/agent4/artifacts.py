"""Model artifacts: JSON bundles plus a hash manifest.

Each scoring mode ships as one human-readable JSON bundle (feature order, detector
parameters, length-aware calibration table, training provenance). ``manifest.json`` records
the SHA-256 of every bundle; the loader refuses to serve a model whose files do not match
the manifest, so a corrupted or tampered artifact fails loudly at start-up.

There is deliberately no pickle/joblib file: loading a pickle can execute arbitrary code,
and a JSON bundle cannot.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

import numpy as np

from agent4.calibration import LengthCalibration
from agent4.config import MODES, SERVICE_VERSION
from agent4.detector import GaussianMixtureDetector
from agent4.features import FEATURES_BY_MODE

SCHEMA_VERSION = 1
MANIFEST_NAME = "manifest.json"


class ModelIntegrityError(RuntimeError):
    """Raised when a model artifact is missing, malformed or does not match the manifest."""


@dataclass
class ModelBundle:
    mode: str
    feature_names: list
    detector: GaussianMixtureDetector
    calibration: LengthCalibration
    target_fpr: float
    provenance: Dict[str, object]

    @property
    def min_events(self) -> int:
        return self.calibration.min_events

    @property
    def max_events(self) -> int:
        return self.calibration.max_events

    def to_dict(self) -> Dict[str, object]:
        return {
            "schema_version": SCHEMA_VERSION,
            "mode": self.mode,
            "feature_names": list(self.feature_names),
            "target_fpr": self.target_fpr,
            "detector": self.detector.to_dict(),
            "calibration": self.calibration.to_dict(),
            "provenance": self.provenance,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "ModelBundle":
        if data.get("schema_version") != SCHEMA_VERSION:
            raise ModelIntegrityError(f"Unsupported bundle schema version: {data.get('schema_version')!r}")
        mode = data["mode"]
        if mode not in MODES:
            raise ModelIntegrityError(f"Unknown scoring mode in bundle: {mode!r}")
        names = list(data["feature_names"])
        if names != FEATURES_BY_MODE[mode]:
            raise ModelIntegrityError(
                f"Feature order in the {mode!r} bundle does not match this code version; "
                "retrain the model or deploy the matching code."
            )
        detector = GaussianMixtureDetector.from_dict(data["detector"])
        if list(detector.feature_names) != names:
            raise ModelIntegrityError("Detector feature order differs from the bundle feature order.")
        return cls(
            mode=mode,
            feature_names=names,
            detector=detector,
            calibration=LengthCalibration.from_dict(data["calibration"]),
            target_fpr=float(data["target_fpr"]),
            provenance=dict(data.get("provenance", {})),
        )


@dataclass
class LoadedModels:
    bundles: Dict[str, ModelBundle]
    model_version: str
    manifest: Dict[str, object]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def save_models(bundles: Dict[str, ModelBundle], model_dir: Path, training_seed: Optional[int] = None) -> Dict[str, object]:
    """Write every bundle and the manifest; returns the manifest."""
    model_dir = Path(model_dir)
    model_dir.mkdir(parents=True, exist_ok=True)
    files: Dict[str, Dict[str, str]] = {}
    for mode, bundle in bundles.items():
        path = model_dir / f"{mode}.json"
        path.write_text(json.dumps(bundle.to_dict(), indent=1), encoding="utf-8")
        files[mode] = {"path": path.name, "sha256": sha256_file(path)}

    combined = hashlib.sha256("".join(files[m]["sha256"] for m in sorted(files)).encode()).hexdigest()
    try:
        import sklearn
        sklearn_version = sklearn.__version__
    except ImportError:  # pragma: no cover - sklearn is a training-time dependency only
        sklearn_version = None
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "service_version": SERVICE_VERSION,
        "model_version": f"{SERVICE_VERSION}+{combined[:8]}",
        "created_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "training_seed": training_seed,
        "library_versions": {"numpy": np.__version__, "scikit-learn": sklearn_version},
        "files": files,
    }
    (model_dir / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def load_models(model_dir: Path) -> LoadedModels:
    """Load and verify every bundle listed in the manifest."""
    model_dir = Path(model_dir)
    manifest_path = model_dir / MANIFEST_NAME
    if not manifest_path.exists():
        raise ModelIntegrityError(f"Model manifest not found: {manifest_path}")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        files = manifest["files"]
    except (json.JSONDecodeError, KeyError) as exc:
        raise ModelIntegrityError(f"Model manifest is malformed: {exc}") from exc

    bundles: Dict[str, ModelBundle] = {}
    for mode in MODES:
        entry = files.get(mode)
        if entry is None:
            raise ModelIntegrityError(f"Manifest has no entry for the {mode!r} model.")
        path = model_dir / entry["path"]
        if not path.exists():
            raise ModelIntegrityError(f"Model file listed in the manifest is missing: {path}")
        actual = sha256_file(path)
        if actual != entry["sha256"]:
            raise ModelIntegrityError(
                f"SHA-256 mismatch for {path.name}: manifest {entry['sha256'][:12]}..., file {actual[:12]}... "
                "The artifact was modified or corrupted."
            )
        try:
            bundles[mode] = ModelBundle.from_dict(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            raise ModelIntegrityError(f"Model file {path.name} is malformed: {exc}") from exc
    return LoadedModels(bundles=bundles, model_version=str(manifest["model_version"]), manifest=manifest)
