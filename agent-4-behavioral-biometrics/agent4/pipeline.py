"""End-to-end reproducible pipeline: data -> selection -> training -> evaluation -> reports."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict

from agent4.artifacts import load_models, save_models
from agent4.config import (
    DEFAULT_DATA_DIR,
    DEFAULT_MODEL_DIR,
    DEFAULT_REPORT_DIR,
    MODES,
    MODE_FULL,
)
from agent4.dataset import build_table
from agent4.evaluation import evaluate_mode, leave_one_style_out
from agent4.selection import run_selection
from agent4.simulation import GenerationConfig, generate_dataset, save_sessions
from agent4.training import components_from_name, train_models


@dataclass(frozen=True)
class Paths:
    data_dir: Path = DEFAULT_DATA_DIR
    model_dir: Path = DEFAULT_MODEL_DIR
    report_dir: Path = DEFAULT_REPORT_DIR


def _log(verbose: bool, message: str) -> None:
    if verbose:
        print(message, flush=True)


def _write_feature_table(table, path: Path) -> None:
    import pandas as pd

    path.parent.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(table.raw, columns=table.feature_names)
    frame.insert(0, "n_events", table.n_events)
    frame.insert(0, "split", table.split)
    frame.insert(0, "behavior_type", table.behavior)
    frame.insert(0, "session_id", table.session_ids)
    frame.to_csv(path, index=False, float_format="%.6g")


def run_pipeline(
    paths: Paths = Paths(),
    seed: int = 42,
    sessions_per_class: int = 6000,
    selection_sessions_per_class: int = 3000,
    save_raw: bool = True,
    make_figures: bool = True,
    verbose: bool = True,
) -> Dict[str, object]:
    t0 = time.time()
    config = GenerationConfig(
        seed=seed,
        sessions_per_class=sessions_per_class,
        stress_sessions_per_class=sessions_per_class // 2,
    )

    _log(verbose, "[1/5] Generating synthetic keystroke-timing sessions ...")
    sessions = generate_dataset(config)
    _log(verbose, f"      {len(sessions):,} sessions, {sum(s.n_events for s in sessions):,} events (seed {seed})")
    if save_raw:
        raw_path = save_sessions(sessions, paths.data_dir / "raw" / "keystroke_sessions.csv.gz")
        _log(verbose, f"      raw events -> {raw_path}")

    tables = {mode: build_table(sessions, mode) for mode in MODES}
    _write_feature_table(tables[MODE_FULL], paths.data_dir / "processed" / "session_features.csv.gz")

    _log(verbose, "[2/5] Selecting the detector on an independent development dataset ...")
    selection = {}
    for mode in MODES:
        _log(verbose, f"   mode = {mode}")
        selection[mode] = run_selection(paths.report_dir, mode=mode, sessions_per_class=selection_sessions_per_class,
                                        verbose=verbose)
    selected = {mode: selection[mode]["selected"] for mode in MODES}

    _log(verbose, "[3/5] Training and calibrating on genuine-human sessions only ...")
    selection_info = {mode: {"dev_seed": selection[mode]["dev_seed"], "selected": selection[mode]["selected"]}
                      for mode in MODES}
    bundles = train_models(sessions, config, selected, selection_info)
    manifest = save_models(bundles, paths.model_dir, training_seed=seed)
    _log(verbose, f"      model_version = {manifest['model_version']}")

    # Evaluate the artifacts exactly as the service will load them.
    loaded = load_models(paths.model_dir)

    _log(verbose, "[4/5] Held-out evaluation ...")
    metrics: Dict[str, object] = {
        "model_version": loaded.model_version,
        "dataset": {
            "seed": seed,
            "sessions_per_class": sessions_per_class,
            "total_sessions": len(sessions),
            "min_events": config.min_events,
            "max_events": config.max_events,
            "split_fractions": {"train": config.train_fraction, "calibration": config.calibration_fraction,
                                "test": round(1 - config.train_fraction - config.calibration_fraction, 4)},
        },
        "selected_detector": selected,
        # Development-set results (different seed) for the chosen detector and the v1 baseline,
        # kept here so documents can quote them without hand-typing.
        "model_selection": {
            mode: {
                "selected": selected[mode],
                "selected_result": selection[mode]["candidates"][selected[mode]],
                "isolation_forest_result": selection[mode]["candidates"]["isolation_forest"],
            }
            for mode in MODES
        },
    }
    arrays = {}
    for mode in MODES:
        metrics[mode], arrays[mode] = evaluate_mode(tables[mode], loaded.bundles[mode])
        s = metrics[mode]["summary"]
        _log(verbose, f"   {mode:12s} AUC {s['roc_auc_core_attacks_vs_human']:.3f}  macro detection "
                      f"{s['macro_detection_rate_core_attacks']:.1%}  human FPR {s['human_false_positive_rate']:.1%}")
    metrics["leave_one_style_out"] = leave_one_style_out(
        tables[MODE_FULL], components_from_name(selected[MODE_FULL]), config.min_events, config.max_events
    )

    paths.report_dir.mkdir(parents=True, exist_ok=True)
    (paths.report_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    _log(verbose, "[5/5] Writing figures and the evaluation report ...")
    if make_figures:
        from agent4.figures import make_all_figures
        make_all_figures(metrics, arrays, paths.report_dir / "figures",
                         full_calibration=loaded.bundles[MODE_FULL].calibration)
    from agent4.report import write_evaluation_report
    write_evaluation_report(metrics, selection, paths.report_dir / "evaluation_report.md", with_figures=make_figures)

    _log(verbose, f"Done in {time.time() - t0:.0f}s.")
    return metrics
