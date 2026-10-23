"""Held-out evaluation.

Protocol
--------
* Genuine humans: only the *test* split (never used for fitting or calibration).
* Attacks: all sessions of the attack classes (the model never sees any automation).
* Threshold and risk scale come from the calibration split, so the human false-positive rate
  measured here is a genuine out-of-sample estimate, not true by construction.
* Every rate carries a 95% Wilson confidence interval.
* Results are broken down by session length, because reliability grows with evidence.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np
from sklearn.metrics import roc_auc_score

from agent4.artifacts import ModelBundle
from agent4.calibration import categorize
from agent4.config import RISK_MODERATE_FROM
from agent4.dataset import Table
from agent4.simulation import (
    ATTACK_CLASSES,
    NORMAL_CLASSES,
    PROFILES,
    SPLIT_TEST,
    STRESS_ATTACK_CLASSES,
)
from agent4.training import fit_detector_and_calibration

LENGTH_BUCKETS: List[Tuple[int, int]] = [(10, 20), (20, 30), (30, 50), (50, 100), (100, 200), (200, 301)]
PREVALENCES = (0.001, 0.01, 0.05)


def wilson_interval(successes: int, total: int, z: float = 1.96) -> Tuple[float, float]:
    if total == 0:
        return (float("nan"), float("nan"))
    p = successes / total
    denom = 1.0 + z * z / total
    centre = (p + z * z / (2 * total)) / denom
    half = z * np.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denom
    return (float(max(0.0, centre - half)), float(min(1.0, centre + half)))


def _rate(flags: np.ndarray) -> Dict[str, object]:
    k, n = int(flags.sum()), int(len(flags))
    lo, hi = wilson_interval(k, n)
    return {"n": n, "flagged": k, "rate": (k / n) if n else float("nan"), "ci95": [lo, hi]}


def risk_scores(table: Table, bundle: ModelBundle) -> Tuple[np.ndarray, np.ndarray]:
    """Return (anomaly score, 0-100 risk) for every session in the table."""
    scores = bundle.detector.score(table.X)
    risk = np.array([bundle.calibration.risk_score(s, int(n)) for s, n in zip(scores, table.n_events)])
    return scores, np.round(risk, 2)


def _auc(human_risk: np.ndarray, attack_risk: np.ndarray) -> float:
    y = np.r_[np.zeros(len(human_risk)), np.ones(len(attack_risk))]
    return float(roc_auc_score(y, np.r_[human_risk, attack_risk]))


def _bootstrap_auc_ci(human_risk: np.ndarray, attack_risk: np.ndarray, reps: int = 200, seed: int = 0) -> List[float]:
    rng = np.random.default_rng(seed)
    vals = []
    for _ in range(reps):
        h = rng.choice(human_risk, len(human_risk), replace=True)
        a = rng.choice(attack_risk, len(attack_risk), replace=True)
        vals.append(_auc(h, a))
    return [float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))]


def evaluate_mode(table: Table, bundle: ModelBundle) -> Tuple[Dict[str, object], Dict[str, np.ndarray]]:
    """Full held-out evaluation for one scoring mode."""
    scores, risk = risk_scores(table, bundle)
    flagged = risk >= RISK_MODERATE_FROM
    n = table.n_events

    human_test = table.mask(SPLIT_TEST, NORMAL_CLASSES)
    metrics: Dict[str, object] = {"mode": table.mode}

    # ---- genuine humans (held-out)
    human: Dict[str, object] = {"overall": _rate(flagged[human_test]), "by_style": {}, "by_length": {}}
    for style in NORMAL_CLASSES:
        human["by_style"][style] = _rate(flagged[table.mask(SPLIT_TEST, [style])])
    for lo, hi in LENGTH_BUCKETS:
        m = human_test & (n >= lo) & (n < hi)
        human["by_length"][f"{lo}-{hi - 1}"] = _rate(flagged[m])
    human["high_anomaly_rate"] = _rate(risk[human_test] >= 75.0)
    metrics["human_test"] = human

    # ---- attacks
    attacks: Dict[str, object] = {}
    for cls in ATTACK_CLASSES + STRESS_ATTACK_CLASSES:
        m = table.mask(None, [cls])
        entry = {
            "role": PROFILES[cls].role,
            "overall": _rate(flagged[m]),
            "auc_vs_human_test": _auc(risk[human_test], risk[m]),
            "by_length": {},
            "risk_bands": {
                band: float(np.mean([categorize(r) == band for r in risk[m]]))
                for band in ("LOW_ANOMALY", "MODERATE_ANOMALY", "HIGH_ANOMALY")
            },
            "median_risk": float(np.median(risk[m])),
        }
        for lo, hi in LENGTH_BUCKETS:
            mm = m & (n >= lo) & (n < hi)
            entry["by_length"][f"{lo}-{hi - 1}"] = _rate(flagged[mm])
        attacks[cls] = entry
    metrics["attacks"] = attacks

    # ---- pooled core-attack summary
    core = table.mask(None, ATTACK_CLASSES)
    core_auc = _auc(risk[human_test], risk[core])
    macro_tpr = float(np.mean([attacks[c]["overall"]["rate"] for c in ATTACK_CLASSES]))
    fpr = human["overall"]["rate"]
    macro_high = float(np.mean([attacks[c]["risk_bands"]["HIGH_ANOMALY"] for c in ATTACK_CLASSES]))
    fpr_high = human["high_anomaly_rate"]["rate"]

    def _ppv(tpr: float, fp_rate: float, prevalence: float) -> float:
        return float(tpr * prevalence / (tpr * prevalence + fp_rate * (1 - prevalence)))

    metrics["summary"] = {
        "roc_auc_core_attacks_vs_human": core_auc,
        "roc_auc_ci95": _bootstrap_auc_ci(risk[human_test], risk[core]),
        "macro_detection_rate_core_attacks": macro_tpr,
        "human_false_positive_rate": fpr,
        "macro_high_band_rate_core_attacks": macro_high,
        "human_high_band_rate": fpr_high,
        "precision_at_prevalence": {f"{p:.1%}": _ppv(macro_tpr, fpr, p) for p in PREVALENCES},
        "precision_high_band_at_prevalence": {f"{p:.1%}": _ppv(macro_high, fpr_high, p) for p in PREVALENCES},
    }
    arrays = {"risk": risk, "scores": scores, "behavior": table.behavior, "n_events": n, "split": table.split}
    return metrics, arrays


def leave_one_style_out(table: Table, n_components: int, min_events: int, max_events: int) -> Dict[str, object]:
    """How does the model treat a *genuine* typing style it was never trained on?

    For each human style, refit and recalibrate on the other styles only, then measure how
    often every session of the excluded style is flagged. Also reports attack detection for
    the reduced-population model for context.
    """
    out: Dict[str, object] = {}
    for held_out in NORMAL_CLASSES:
        keep = [c for c in NORMAL_CLASSES if c != held_out]
        detector, calibration, _, _ = fit_detector_and_calibration(
            table, n_components, min_events, max_events, train_classes=keep
        )
        scores = detector.score(table.X)
        risk = np.array([calibration.risk_score(s, int(n)) for s, n in zip(scores, table.n_events)])
        flagged = risk >= RISK_MODERATE_FROM
        out[held_out] = {
            "trained_on": keep,
            "held_out_style_flagged": _rate(flagged[table.mask(None, [held_out])]),
            "seen_style_test_flagged": _rate(flagged[table.mask(SPLIT_TEST, keep)]),
            "core_attack_detection": {c: _rate(flagged[table.mask(None, [c])])["rate"] for c in ATTACK_CLASSES},
        }
    return out
