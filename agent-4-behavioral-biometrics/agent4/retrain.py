"""Retrain on real sessions (the step that makes the model fit a real bidder population).

The shipped model is fitted on *synthetic* typing styles. Before production, refit it on real,
representative, genuine-human sessions so that "normal" means the platform's actual users.

Input: a CSV or CSV.GZ with one row per keystroke event and the columns
``session_id, event_index, hold_duration_ms, flight_time_ms`` (timing only; no labels needed).
Every session in the file is assumed to be genuine. Do not include sessions known or
suspected to be automated: they would teach the model that automation is normal.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

from agent4.artifacts import ModelBundle, load_models, save_models
from agent4.config import MODES, TECHNICAL_MIN_EVENTS
from agent4.dataset import build_table
from agent4.features import TimingValidationError, validate_timings
from agent4.simulation import (
    SPLIT_CALIBRATION,
    SPLIT_TEST,
    SPLIT_TRAIN,
    Session,
)
from agent4.training import TARGET_FPR, fit_detector_and_calibration, select_components_bic

REAL_LABEL = "HUMAN_REAL"
REQUIRED_COLUMNS = ["session_id", "event_index", "hold_duration_ms", "flight_time_ms"]
MIN_SESSIONS = 500
RECOMMENDED_SESSIONS = 3000
MIN_EVENTS = 10
MAX_EVENTS = 300


def load_real_sessions(path: Path, min_events: int = MIN_EVENTS, max_events: int = MAX_EVENTS):
    """Read real events into sessions; returns (sessions, skipped_counts)."""
    import pandas as pd

    frame = pd.read_csv(path)
    missing = [c for c in REQUIRED_COLUMNS if c not in frame.columns]
    if missing:
        raise ValueError(f"{path} is missing required columns: {missing}")
    extra = [c for c in frame.columns if c not in REQUIRED_COLUMNS]
    if extra:
        raise ValueError(
            f"{path} has unexpected columns {extra}. Only timing columns are accepted: {REQUIRED_COLUMNS}."
        )

    sessions: List[Session] = []
    skipped = {"too_short": 0, "invalid_timing": 0}
    for sid, g in frame.groupby("session_id", sort=False):
        g = g.sort_values("event_index")
        flights, holds = g["flight_time_ms"].to_numpy(float), g["hold_duration_ms"].to_numpy(float)
        if len(flights) < max(min_events, TECHNICAL_MIN_EVENTS):
            skipped["too_short"] += 1
            continue
        try:
            flights, holds = validate_timings(flights, holds)
        except TimingValidationError:
            skipped["invalid_timing"] += 1
            continue
        sessions.append(Session(str(sid), REAL_LABEL, SPLIT_TRAIN, flights[-max_events:], holds[-max_events:]))
    return sessions, skipped


def retrain_from_events(
    events_path: Path,
    model_dir: Path,
    components: Optional[int] = None,
    seed: int = 42,
    verbose: bool = True,
) -> Dict[str, object]:
    sessions, skipped = load_real_sessions(Path(events_path))
    n = len(sessions)
    if n < MIN_SESSIONS:
        raise ValueError(
            f"Only {n} usable sessions; at least {MIN_SESSIONS} are needed to fit and calibrate a model "
            f"({RECOMMENDED_SESSIONS}+ recommended)."
        )
    if verbose:
        print(f"Loaded {n:,} usable sessions (skipped: {skipped}).")
        if n < RECOMMENDED_SESSIONS:
            print(f"WARNING: fewer than {RECOMMENDED_SESSIONS} sessions; the 99th-percentile (HIGH) boundary will be noisy.")

    rng = np.random.default_rng(seed)
    order = rng.permutation(n)
    n_train, n_cal = int(round(n * 0.60)), int(round(n * 0.25))
    for rank, idx in enumerate(order):
        sessions[idx].split = SPLIT_TRAIN if rank < n_train else SPLIT_CALIBRATION if rank < n_train + n_cal else SPLIT_TEST

    bundles: Dict[str, ModelBundle] = {}
    report: Dict[str, object] = {"sessions": n, "skipped": skipped, "modes": {}}
    for mode in MODES:
        table = build_table(sessions, mode)
        k = components or select_components_bic(table.X[table.mask(SPLIT_TRAIN)])
        detector, calibration, n_tr, n_ca = fit_detector_and_calibration(
            table, k, MIN_EVENTS, MAX_EVENTS, train_classes=[REAL_LABEL]
        )
        scores = detector.score(table.X)
        test = table.mask(SPLIT_TEST)
        flagged = np.array([calibration.risk_score(s, int(m)) >= 50.0 for s, m in zip(scores[test], table.n_events[test])])
        report["modes"][mode] = {"components": k, "test_flag_rate": float(flagged.mean()), "test_sessions": int(test.sum())}
        if verbose:
            print(f"  {mode:12s} components={k}  held-out flag rate {flagged.mean():.1%} "
                  f"(expected ≈ {TARGET_FPR:.0%} for a representative sample)")
        bundles[mode] = ModelBundle(
            mode=mode, feature_names=list(table.feature_names), detector=detector, calibration=calibration,
            target_fpr=TARGET_FPR,
            provenance={
                "detector": f"gaussian_mixture_k{k}",
                "retrained_from": Path(events_path).name,
                "training_seed": seed,
                "n_train_sessions": n_tr,
                "n_calibration_sessions": n_ca,
                "min_events": MIN_EVENTS,
                "max_events": MAX_EVENTS,
                "note": "Fitted on supplied real sessions assumed to be genuine human typing.",
            },
        )
    manifest = save_models(bundles, Path(model_dir), training_seed=seed)
    load_models(Path(model_dir))  # fail now, not at deployment, if the artifact is unusable
    report["model_version"] = manifest["model_version"]
    if verbose:
        print(f"Saved models to {model_dir} (model_version {manifest['model_version']}).")
    return report
