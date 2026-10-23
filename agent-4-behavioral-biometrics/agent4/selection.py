"""Detector selection on a *development* dataset.

The final reported numbers must come from data that played no part in choosing the model.
This module therefore generates a separate development dataset (different random seed),
fits several detector families on its human training split, calibrates each one with the
same length-aware procedure on its human calibration split, and compares how many attacks
each catches at the same ~5% human false-alarm rate.

The selection criterion is the macro-average detection rate over the three core attack
classes. MIMIC_BOT is reported for information but is never used to choose the model.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Dict

import numpy as np

from agent4.calibration import LengthCalibration
from agent4.config import MODE_FULL
from agent4.dataset import Table, build_table
from agent4.detector import GaussianMixtureDetector
from agent4.simulation import (
    ATTACK_CLASSES,
    NORMAL_CLASSES,
    STRESS_ATTACK_CLASSES,
    GenerationConfig,
    SPLIT_CALIBRATION,
    SPLIT_TEST,
    SPLIT_TRAIN,
    generate_dataset,
)

DEV_SEED = 7
GMM_COMPONENT_GRID = (1, 2, 3, 4, 6, 8)
MAX_ELIGIBLE_FPR = 0.075
SELECTION_TOLERANCE = 0.01


def _isolation_forest_scorer(whiten: bool) -> Callable[[np.ndarray, np.ndarray], Callable[[np.ndarray], np.ndarray]]:
    from sklearn.decomposition import PCA
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler

    def build(X_train: np.ndarray, _names) -> Callable[[np.ndarray], np.ndarray]:
        if whiten:
            ss = StandardScaler().fit(X_train)
            pca = PCA(whiten=True, random_state=0).fit(ss.transform(X_train))
            transform = lambda X: pca.transform(ss.transform(X))
        else:
            transform = lambda X: X
        model = IsolationForest(n_estimators=300, random_state=42, n_jobs=-1).fit(transform(X_train))
        return lambda X: -model.score_samples(transform(X))

    return build


def _mahalanobis_scorer(X_train: np.ndarray, _names) -> Callable[[np.ndarray], np.ndarray]:
    from sklearn.covariance import LedoitWolf
    from sklearn.preprocessing import StandardScaler

    ss = StandardScaler().fit(X_train)
    lw = LedoitWolf().fit(ss.transform(X_train))
    return lambda X: lw.mahalanobis(ss.transform(X))


def _gmm_scorer(k: int) -> Callable[[np.ndarray, list], Callable[[np.ndarray], np.ndarray]]:
    def build(X_train: np.ndarray, names) -> Callable[[np.ndarray], np.ndarray]:
        det = GaussianMixtureDetector.fit(X_train, names, n_components=k)
        return det.score

    return build


def candidates() -> Dict[str, Callable]:
    """Candidate detectors, ordered from simplest to most complex."""
    out: Dict[str, Callable] = {"mahalanobis": _mahalanobis_scorer}
    for k in GMM_COMPONENT_GRID:
        out[f"gaussian_mixture_k{k}"] = _gmm_scorer(k)
    out["isolation_forest"] = _isolation_forest_scorer(whiten=False)
    out["isolation_forest_whitened"] = _isolation_forest_scorer(whiten=True)
    return out


def evaluate_candidate(table: Table, build: Callable, min_events: int, max_events: int) -> Dict[str, object]:
    train = table.mask(SPLIT_TRAIN, NORMAL_CLASSES)
    cal = table.mask(SPLIT_CALIBRATION, NORMAL_CLASSES)
    scorer = build(table.X[train], table.feature_names)
    scores = scorer(table.X)
    calib = LengthCalibration.fit(scores[cal], table.n_events[cal], min_events, max_events)
    thr = np.array([calib.threshold(int(n)) for n in table.n_events])
    flagged = scores > thr

    human_test = table.mask(SPLIT_TEST, NORMAL_CLASSES)
    result: Dict[str, object] = {
        "human_test_fpr": float(flagged[human_test].mean()),
        "detection_rate": {},
    }
    for cls in ATTACK_CLASSES + STRESS_ATTACK_CLASSES:
        m = table.behavior == cls
        result["detection_rate"][cls] = float(flagged[m].mean())
    result["macro_detection_core_attacks"] = float(np.mean([result["detection_rate"][c] for c in ATTACK_CLASSES]))
    return result


def run_selection(
    out_dir: Path,
    mode: str = MODE_FULL,
    sessions_per_class: int = 3000,
    verbose: bool = True,
) -> Dict[str, object]:
    """Compare detector families on the development dataset and write the comparison."""
    cfg = GenerationConfig(
        seed=DEV_SEED,
        sessions_per_class=sessions_per_class,
        stress_sessions_per_class=sessions_per_class // 2,
    )
    sessions = generate_dataset(cfg)
    table = build_table(sessions, mode)

    results: Dict[str, Dict[str, object]] = {}
    for name, build in candidates().items():
        results[name] = evaluate_candidate(table, build, cfg.min_events, cfg.max_events)
        if verbose:
            r = results[name]
            print(f"  {name:28s} human FPR {r['human_test_fpr']:6.1%}  "
                  + "  ".join(f"{c.split('_')[0][:4]} {r['detection_rate'][c]:6.1%}" for c in ATTACK_CLASSES)
                  + f"  macro {r['macro_detection_core_attacks']:6.1%}")

    # Only mixture models can be exported to the NumPy-only serving format, so the Isolation
    # Forest and Mahalanobis candidates are reported as baselines but are not selectable.
    # Candidates must respect the false-alarm budget. Among those, take the simplest one whose
    # macro detection is within SELECTION_TOLERANCE of the best: tiny gaps between
    # neighbouring model sizes are noise and do not justify extra complexity.
    eligible = {k: v for k, v in results.items()
                if k.startswith("gaussian_mixture_k") and v["human_test_fpr"] <= MAX_ELIGIBLE_FPR}
    top = max(v["macro_detection_core_attacks"] for v in eligible.values())
    best = next(k for k, v in eligible.items()
                if v["macro_detection_core_attacks"] >= top - SELECTION_TOLERANCE)
    summary = {
        "mode": mode,
        "dev_seed": DEV_SEED,
        "sessions_per_class": sessions_per_class,
        "criterion": (
            "simplest detector whose macro-average detection rate over REGULAR/BURST/ADAPTIVE is "
            f"within {SELECTION_TOLERANCE:.0%} of the best, at ~5% human false-alarm rate "
            f"(candidates with human FPR above {MAX_ELIGIBLE_FPR:.1%} are ineligible)"
        ),
        "selected": best,
        "candidates": results,
    }
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"model_selection_{mode}.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    if verbose:
        print(f"  -> selected: {best}")
    return summary
