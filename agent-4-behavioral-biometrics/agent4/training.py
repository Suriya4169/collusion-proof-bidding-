"""Fit and calibrate the production models."""

from __future__ import annotations

from typing import Dict, Optional, Sequence

import numpy as np

from agent4.artifacts import ModelBundle
from agent4.calibration import LengthCalibration
from agent4.config import MODES
from agent4.dataset import Table, build_table
from agent4.detector import GaussianMixtureDetector
from agent4.simulation import (
    NORMAL_CLASSES,
    SPLIT_CALIBRATION,
    SPLIT_TRAIN,
    GenerationConfig,
    Session,
)

TARGET_FPR = 0.05


def components_from_name(selected: str) -> int:
    prefix = "gaussian_mixture_k"
    if not selected.startswith(prefix):
        raise ValueError(f"Selected detector {selected!r} is not an exportable mixture model.")
    return int(selected[len(prefix):])


def select_components_bic(X: np.ndarray, grid: Sequence[int] = (1, 2, 3, 4, 5, 6), random_state: int = 0) -> int:
    """Pick the mixture size with the lowest BIC on human-only data (needs no attack labels)."""
    from sklearn.mixture import GaussianMixture

    Xs = (X - X.mean(axis=0)) / np.maximum(X.std(axis=0), 1e-6)
    scores = {}
    for k in grid:
        gm = GaussianMixture(n_components=k, covariance_type="full", reg_covar=1e-3, n_init=2,
                             random_state=random_state).fit(Xs)
        scores[k] = gm.bic(Xs)
    return int(min(scores, key=scores.get))


def fit_detector_and_calibration(
    table: Table,
    n_components: int,
    min_events: int,
    max_events: int,
    train_classes: Sequence[str] = tuple(NORMAL_CLASSES),
    random_state: int = 0,
):
    """Fit on the human training split and calibrate on the *disjoint* human calibration split."""
    train = table.mask(SPLIT_TRAIN, train_classes)
    cal = table.mask(SPLIT_CALIBRATION, train_classes)
    detector = GaussianMixtureDetector.fit(table.X[train], table.feature_names, n_components, random_state)
    calibration = LengthCalibration.fit(detector.score(table.X[cal]), table.n_events[cal], min_events, max_events)
    return detector, calibration, int(train.sum()), int(cal.sum())


def train_models(
    sessions: Sequence[Session],
    config: GenerationConfig,
    selected: Dict[str, str],
    selection_info: Optional[Dict[str, object]] = None,
) -> Dict[str, ModelBundle]:
    """Train one bundle per scoring mode. Only human sessions are ever used."""
    bundles: Dict[str, ModelBundle] = {}
    for mode in MODES:
        table = build_table(sessions, mode)
        k = components_from_name(selected[mode])
        detector, calibration, n_train, n_cal = fit_detector_and_calibration(
            table, k, config.min_events, config.max_events
        )
        bundles[mode] = ModelBundle(
            mode=mode,
            feature_names=list(table.feature_names),
            detector=detector,
            calibration=calibration,
            target_fpr=TARGET_FPR,
            provenance={
                "detector": selected[mode],
                "training_seed": config.seed,
                "training_classes": list(NORMAL_CLASSES),
                "n_train_sessions": n_train,
                "n_calibration_sessions": n_cal,
                "min_events": config.min_events,
                "max_events": config.max_events,
                "selection": selection_info.get(mode) if selection_info else None,
                "note": "Fitted on synthetic genuine-human typing only; no automation sample was used.",
            },
        )
    return bundles
