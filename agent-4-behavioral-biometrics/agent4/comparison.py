"""Head-to-head comparison of the Gaussian mixture and the Isolation Forest, on identical data.

Both detectors are fitted on the same human training split, calibrated on the same human calibration split, and
evaluated on the same held-out test split, with the same code (``agent4.evaluation.evaluate_mode``) and the same
5% human false-alarm target. Nothing here is hand-typed: the report is generated from the computed numbers.

The shipped mixture bundle (``models/``) is re-evaluated on the regenerated data and checked against the published
``reports/metrics.json``, so the comparison is anchored to the numbers the rest of the documentation quotes.
"""

from __future__ import annotations

import json
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

from agent4.artifacts import ModelBundle, load_models, save_models
from agent4.config import MODES, MODE_FULL, PROJECT_ROOT
from agent4.dataset import build_table
from agent4.evaluation import LENGTH_BUCKETS, evaluate_mode
from agent4.pipeline import Paths
from agent4.scorer import BehaviorScorer
from agent4.simulation import ATTACK_CLASSES, STRESS_ATTACK_CLASSES, GenerationConfig, generate_dataset
from agent4.training import train_models

DEFAULT_IFOREST_DIR = PROJECT_ROOT / "models_iforest"
SHIPPED_FOREST = "isolation_forest_whitened"  # chosen on the development data, before any held-out number was seen
DETECTORS = {
    "gaussian_mixture": "Gaussian mixture (production)",
    "isolation_forest_whitened": "Isolation Forest, PCA-whitened",
    "isolation_forest": "Isolation Forest, standardised only",
}
ATTACK_TITLES = {
    "REGULAR_AUTOMATION": "Regular script",
    "BURST_AUTOMATION": "Burst injection",
    "ADAPTIVE_AUTOMATION": "Adaptive bot",
    "MIMIC_BOT": "Mimic bot (stress)",
}
EXAMPLE = PROJECT_ROOT / "docs" / "examples" / "human_full.request.json"


def _bundle_bytes(directory: Path) -> int:
    return sum(p.stat().st_size for p in Path(directory).glob("*.json") if p.name != "manifest.json")


def _latency_ms(loaded, repeats: int = 300) -> Optional[Dict[str, float]]:
    """Median and 95th-percentile time to score one 60-keystroke session through the real scorer."""
    if not EXAMPLE.exists():
        return None
    payload = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    scorer = BehaviorScorer(loaded)
    for _ in range(10):  # warm-up
        scorer.score("latency", payload["intervals"], payload["hold_durations"])
    times = []
    for _ in range(repeats):
        t0 = time.perf_counter()
        scorer.score("latency", payload["intervals"], payload["hold_durations"])
        times.append((time.perf_counter() - t0) * 1000.0)
    return {"p50": float(np.percentile(times, 50)), "p95": float(np.percentile(times, 95))}


def run_comparison(
    paths: Paths = Paths(),
    seed: int = 42,
    sessions_per_class: int = 6000,
    iforest_dir: Path = DEFAULT_IFOREST_DIR,
    verbose: bool = True,
) -> Dict[str, object]:
    def log(message: str) -> None:
        if verbose:
            print(message, flush=True)

    config = GenerationConfig(seed=seed, sessions_per_class=sessions_per_class, stress_sessions_per_class=sessions_per_class // 2)
    log("[1/4] Generating the evaluation dataset (same seed and size as the production pipeline) ...")
    sessions = generate_dataset(config)
    tables = {mode: build_table(sessions, mode) for mode in MODES}

    result: Dict[str, object] = {
        "dataset": {"seed": seed, "sessions_per_class": sessions_per_class, "total_sessions": len(sessions),
                    "min_events": config.min_events, "max_events": config.max_events},
        "shipped_forest": SHIPPED_FOREST,
        "detectors": {},
    }

    log("[2/4] Evaluating the production mixture (models/) ...")
    mixture = load_models(paths.model_dir)
    result["detectors"]["gaussian_mixture"] = _evaluate(mixture, tables, paths.model_dir, label="mixture", log=log)

    published = Path(paths.report_dir) / "metrics.json"
    if published.exists():
        reported = json.loads(published.read_text(encoding="utf-8"))
        same_data = reported["dataset"]["seed"] == seed and reported["dataset"]["sessions_per_class"] == sessions_per_class
        result["reproduces_published_metrics"] = bool(
            same_data and all(
                abs(result["detectors"]["gaussian_mixture"][mode]["summary"]["roc_auc_core_attacks_vs_human"]
                    - reported[mode]["summary"]["roc_auc_core_attacks_vs_human"]) < 1e-9
                for mode in MODES
            )
        )

    log("[3/4] Training and evaluating the Isolation Forest variants ...")
    for name in (SHIPPED_FOREST, "isolation_forest"):
        bundles = train_models(sessions, config, {mode: name for mode in MODES})
        target = Path(iforest_dir) if name == SHIPPED_FOREST else Path(tempfile.mkdtemp(prefix="agent4_if_"))
        save_models(bundles, target, training_seed=seed, indent=None)
        loaded = load_models(target)  # evaluated exactly as the service would load it
        result["detectors"][name] = _evaluate(loaded, tables, target, label=name, log=log)
    log(f"      shipped forest bundle -> {iforest_dir}")
    return result


def _evaluate(loaded, tables, directory: Path, label: str, log) -> Dict[str, object]:
    out: Dict[str, object] = {
        "model_version": loaded.model_version,
        "bundle_bytes": _bundle_bytes(directory),
        "latency_ms": _latency_ms(loaded),
    }
    for mode in MODES:
        out[mode], _ = evaluate_mode(tables[mode], loaded.bundles[mode])
        s = out[mode]["summary"]
        log(f"   {label:28s} {mode:12s} AUC {s['roc_auc_core_attacks_vs_human']:.3f}  macro detection "
            f"{s['macro_detection_rate_core_attacks']:.1%}  human FPR {s['human_false_positive_rate']:.1%}")
    return out


# ───────────────────────────────────────── report ─────────────────────────────────────────

def _pct(rate: Dict[str, object]) -> str:
    lo, hi = rate["ci95"]
    return f"{rate['rate']:.1%} ({lo:.0%}–{hi:.0%})"


def write_comparison_report(result: Dict[str, object], path: Path) -> None:
    detectors: Dict[str, Dict[str, object]] = result["detectors"]
    names = [n for n in DETECTORS if n in detectors]
    data = result["dataset"]
    lines: List[str] = [
        "# Gaussian mixture or Isolation Forest?",
        "",
        "Generated by `python -m agent4 compare-detectors`; every number below is computed, none is typed by hand.",
        "",
        "The original design of this module used an Isolation Forest. The shipped model is a Gaussian mixture. Both are "
        "implemented here and served the same way (a JSON bundle scored with NumPy only), so they can be compared "
        "directly. `models/` holds the mixture; `models_iforest/` holds the forest, and either can be served with "
        "`AGENT4_MODEL_DIR`.",
        "",
        "## Protocol",
        "",
        f"* Data: the same simulated sessions for every detector (seed {data['seed']}, {data['sessions_per_class']:,} per "
        f"class, {data['total_sessions']:,} sessions). Detectors are fitted on genuine-human sessions only and never see an attack.",
        "* Calibration: each detector is calibrated on the same disjoint human calibration split to the same scale "
        "(risk 50 = the 95th percentile of humans of similar length), so every detector is held to the same ~5% false-alarm budget.",
        "* Evaluation: held-out human test split and every attack session, with 95% Wilson intervals, by the same "
        "code that produced `reports/metrics.json`.",
        f"* The forest variant that ships (`{DETECTORS[result['shipped_forest']]}`) was chosen on a separate development "
        "dataset before these held-out numbers were computed (`reports/model_selection_full.json`).",
    ]
    if "reproduces_published_metrics" in result:
        lines.append("* The mixture re-evaluated here " + ("reproduces" if result["reproduces_published_metrics"] else
                     "does NOT reproduce") + " the published `reports/metrics.json`.")

    for mode in MODES:
        lines += ["", f"## {'Full model (hold and flight times)' if mode == MODE_FULL else 'Flight-only model'}", "",
                  "| Detector | Human false alarms | " + " | ".join(ATTACK_TITLES[c] for c in ATTACK_CLASSES + STRESS_ATTACK_CLASSES)
                  + " | Macro detection | AUC |",
                  "|---|---|" + "---|" * (len(ATTACK_CLASSES) + len(STRESS_ATTACK_CLASSES)) + "---|---|"]
        for name in names:
            m = detectors[name][mode]
            cells = [_pct(m["attacks"][c]["overall"]) for c in ATTACK_CLASSES + STRESS_ATTACK_CLASSES]
            s = m["summary"]
            lines.append(f"| {DETECTORS[name]} | {_pct(m['human_test']['overall'])} | " + " | ".join(cells)
                         + f" | {s['macro_detection_rate_core_attacks']:.1%} | {s['roc_auc_core_attacks_vs_human']:.3f} |")
        lines += ["", "Detection of the adaptive bot by session length (keystrokes):", "",
                  "| Detector | " + " | ".join(f"{lo}–{hi - 1}" for lo, hi in LENGTH_BUCKETS) + " |",
                  "|---|" + "---|" * len(LENGTH_BUCKETS)]
        for name in names:
            by_len = detectors[name][mode]["attacks"]["ADAPTIVE_AUTOMATION"]["by_length"]
            lines.append(f"| {DETECTORS[name]} | " + " | ".join(f"{by_len[f'{lo}-{hi - 1}']['rate']:.0%}" for lo, hi in LENGTH_BUCKETS) + " |")

    lines += ["", "## Cost", "", "| Detector | Bundle size (both modes) | Time to score one 60-keystroke session (median / 95th percentile) |",
              "|---|---|---|"]
    for name in names:
        d = detectors[name]
        lat = d["latency_ms"]
        lines.append(f"| {DETECTORS[name]} | {d['bundle_bytes'] / 1024:,.0f} KB | "
                     + (f"{lat['p50']:.2f} ms / {lat['p95']:.2f} ms |" if lat else "n/a |"))

    def rate(name: str, cls: str) -> float:
        return detectors[name][MODE_FULL]["attacks"][cls]["overall"]["rate"]

    def macro(name: str) -> float:
        return detectors[name][MODE_FULL]["summary"]["macro_detection_rate_core_attacks"]

    forest = result["shipped_forest"]
    mixture_t = detectors["gaussian_mixture"]["latency_ms"]
    forest_t = detectors[forest]["latency_ms"]
    cost = ""
    if mixture_t and forest_t:
        cost = (f" Scoring a session takes {forest_t['p50'] / mixture_t['p50']:.1f} times as long with the forest "
                f"({forest_t['p50']:.2f} ms against {mixture_t['p50']:.2f} ms) and its bundle is "
                f"{detectors[forest]['bundle_bytes'] / detectors['gaussian_mixture']['bundle_bytes']:.1f} times as large; "
                "both are small enough not to matter.")
    lines += ["", "## Reading", "",
              f"At the same human false-alarm budget, the full model's macro detection over the three core attack classes is "
              f"{macro('gaussian_mixture'):.1%} for the mixture, {macro(forest):.1%} for the whitened forest and "
              f"{macro('isolation_forest'):.1%} for the forest as originally built. The differences sit in the attacks "
              f"designed to look human. Adaptive bot: {rate('gaussian_mixture', 'ADAPTIVE_AUTOMATION'):.1%} (mixture), "
              f"{rate(forest, 'ADAPTIVE_AUTOMATION'):.1%} (whitened forest), {rate('isolation_forest', 'ADAPTIVE_AUTOMATION'):.1%} "
              f"(plain forest). Mimic bot: {rate('gaussian_mixture', 'MIMIC_BOT'):.1%}, {rate(forest, 'MIMIC_BOT'):.1%} and "
              f"{rate('isolation_forest', 'MIMIC_BOT'):.1%}." + cost,
              "",
              f"What the numbers support: whitening the features before the forest raises adaptive-bot detection from "
              f"{rate('isolation_forest', 'ADAPTIVE_AUTOMATION'):.1%} to {rate(forest, 'ADAPTIVE_AUTOMATION'):.1%}. These bots keep each "
              "feature inside the human range and get the *combination* of features wrong; a forest that splits one feature at a "
              "time is poorly placed to see that until the features are decorrelated. A mixture of full-covariance Gaussians models the joint "
              "distribution directly, and it still detects more of the adaptive and the mimic bots. That is the reason the mixture is the "
              "production detector. It is an interpretation of these results, not a separate experiment.",
              "", "## What this does and does not show", "",
              "* Every number comes from simulated typing. It compares the two methods under one set of assumptions; it does "
              "not say how either performs on real bidders. Retrain on real genuine sessions (`python -m agent4 retrain`) before relying on either.",
              "* The comparison is for this feature set and these attack classes. A different attacker, or different features, "
              "could change it.",
              ""]
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text("\n".join(lines), encoding="utf-8")
