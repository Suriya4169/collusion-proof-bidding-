"""Evaluation figures (matplotlib, PNG).

Colour roles follow one rule across every chart: blue = genuine human, orange = automation.
The three categorical slots used (blue, orange, aqua) and the ordinal blue ramp used for risk
bands were validated with the data-viz palette validator (CVD, normal-vision floor, lightness,
contrast). Aqua is below 3:1 on the surface, so every series that uses it is direct-labelled
and the numbers behind every chart are in ``metrics.json`` (the table view).
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.path import Path as MPath
from matplotlib.patches import PathPatch, Rectangle
from sklearn.metrics import roc_curve

from agent4.simulation import ATTACK_CLASSES, NORMAL_CLASSES, STRESS_ATTACK_CLASSES

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
BASELINE = "#c3c2b7"
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
BLUE_250, BLUE_400, BLUE_600 = "#86b6ef", "#3987e5", "#1c5cab"
BLUE_300, BLUE_650 = "#6da7ec", "#104281"

DPI = 100  # figure pixels == CSS-like pixels, so the px-based mark specs below are literal
SAVE_DPI = 200

CLASS_LABELS = {
    "HUMAN_LIKE": "Typical human",
    "FAST_HUMAN_LIKE": "Fast human",
    "SLOW_HUMAN_LIKE": "Slow human",
    "REGULAR_AUTOMATION": "Regular script",
    "BURST_AUTOMATION": "Burst injection",
    "ADAPTIVE_AUTOMATION": "Adaptive bot",
    "MIMIC_BOT": "Mimic bot (stress test)",
}


def _style() -> None:
    plt.rcParams.update({
        "font.family": ["Segoe UI", "DejaVu Sans"],
        "font.size": 11,
        "axes.edgecolor": BASELINE,
        "axes.labelcolor": INK2,
        "xtick.color": MUTED,
        "ytick.color": INK2,
        "text.color": INK,
        "figure.facecolor": SURFACE,
        "axes.facecolor": SURFACE,
        "savefig.facecolor": SURFACE,
    })


def _new_figure(width_in: float, height_in: float, left: float, right: float, top: float, bottom: float):
    _style()
    fig = plt.figure(figsize=(width_in, height_in), dpi=DPI)
    ax = fig.add_axes([left, bottom, 1 - left - right, 1 - top - bottom])
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(BASELINE)
    ax.tick_params(length=0)
    return fig, ax


def _title(fig, title: str, subtitle: str) -> None:
    fig.text(0.02, 0.965, title, fontsize=14, fontweight="semibold", color=INK, va="top")
    fig.text(0.02, 0.92, subtitle, fontsize=10, color=INK2, va="top")


def _px(ax, dx: float, dy: float) -> Tuple[float, float]:
    """Convert a pixel offset to data units on this axes."""
    inv = ax.transData.inverted()
    p0, p1 = inv.transform((0, 0)), inv.transform((dx, dy))
    return abs(p1[0] - p0[0]), abs(p1[1] - p0[1])


def _hbar(ax, y: float, x1: float, thickness_px: float, color: str, radius_px: float = 4.0) -> None:
    """Horizontal bar from the baseline (square) to x1 (4px rounded data-end)."""
    _, h = _px(ax, 0, thickness_px)
    rx, ry = _px(ax, radius_px, radius_px)
    rx = min(rx, abs(x1) / 2) if x1 else 0.0
    ry = min(ry, h / 2)
    y0, y1 = y - h / 2, y + h / 2
    verts = [(0, y0), (x1 - rx, y0), (x1, y0), (x1, y0 + ry), (x1, y1 - ry), (x1, y1), (x1 - rx, y1), (0, y1), (0, y0)]
    codes = [MPath.MOVETO, MPath.LINETO, MPath.CURVE3, MPath.CURVE3, MPath.LINETO,
             MPath.CURVE3, MPath.CURVE3, MPath.LINETO, MPath.CLOSEPOLY]
    ax.add_patch(PathPatch(MPath(verts, codes), facecolor=color, edgecolor="none", zorder=3))


def _percent_axis(ax, upper: float = 100.0) -> None:
    ax.set_xlim(0, upper)
    ticks = np.arange(0, upper + 1, 20 if upper > 60 else 10)
    ax.set_xticks(ticks)
    ax.set_xticklabels([f"{int(t)}%" for t in ticks])
    ax.grid(axis="x", color=GRID, linewidth=1, zorder=0)
    ax.set_axisbelow(True)


def _legend(ax, entries: Sequence[Tuple[str, str]], loc: str = "lower right", ncols: int = 1,
            anchor: Tuple[float, float] = None) -> None:
    handles = [Rectangle((0, 0), 1, 1, facecolor=c, edgecolor="none") for _, c in entries]
    kwargs = {"bbox_to_anchor": anchor} if anchor is not None else {}
    leg = ax.legend(handles, [t for t, _ in entries], loc=loc, frameon=False, fontsize=10, ncols=ncols,
                    handlelength=1.0, handleheight=1.0, columnspacing=1.6, **kwargs)
    for t in leg.get_texts():
        t.set_color(INK2)


# --------------------------------------------------------------------------------------
# 1. Flag rate by class
# --------------------------------------------------------------------------------------
def fig_detection_by_class(metrics: Dict, out: Path) -> Path:
    full = metrics["full"]
    rows: List[Tuple[str, float, float, float, str]] = []
    for style in NORMAL_CLASSES:
        r = full["human_test"]["by_style"][style]
        rows.append((CLASS_LABELS[style], r["rate"], r["ci95"][0], r["ci95"][1], BLUE))
    for cls in ATTACK_CLASSES + STRESS_ATTACK_CLASSES:
        r = full["attacks"][cls]["overall"]
        rows.append((CLASS_LABELS[cls], r["rate"], r["ci95"][0], r["ci95"][1], ORANGE))

    n = len(rows)
    fig, ax = _new_figure(10, 5.6, 0.19, 0.09, 0.20, 0.13)
    ax.set_ylim(n - 0.5, -0.5)
    _percent_axis(ax)
    for i, (label, rate, lo, hi, color) in enumerate(rows):
        _hbar(ax, i, rate * 100, 20, color)
        ax.plot([lo * 100, hi * 100], [i, i], color=INK2, linewidth=1.2, solid_capstyle="butt", zorder=4)
        ax.text(max(hi * 100, rate * 100) + 1.4, i, f"{rate:.1%}", va="center", fontsize=10.5, color=INK, zorder=5)
    ax.set_yticks(range(n))
    ax.set_yticklabels([r[0] for r in rows])
    ax.axvline(5, color=MUTED, linewidth=1, zorder=2)
    ax.text(5.6, -0.78, "5% target false-alarm rate", fontsize=9, color=INK2, va="bottom")
    _legend(ax, [("Genuine human (held-out test sessions)", BLUE), ("Automation (never seen in training)", ORANGE)],
            loc="lower right")
    _title(fig, "Share of sessions flagged (risk score ≥ 50)",
           "Full model (hold + flight timing). Whiskers: 95% Wilson interval. Lower is better for humans, higher for bots.")
    path = out / "01_flag_rate_by_class.png"
    fig.savefig(path, dpi=SAVE_DPI)
    plt.close(fig)
    return path


# --------------------------------------------------------------------------------------
# 2. Flag rate by session length
# --------------------------------------------------------------------------------------
def fig_detection_by_length(metrics: Dict, out: Path) -> Path:
    full = metrics["full"]
    buckets = list(full["human_test"]["by_length"].keys())
    series = [
        ("Genuine human (false alarms)", BLUE, [full["human_test"]["by_length"][b] for b in buckets]),
        ("Adaptive bot", ORANGE, [full["attacks"]["ADAPTIVE_AUTOMATION"]["by_length"][b] for b in buckets]),
        ("Mimic bot (stress test)", AQUA, [full["attacks"]["MIMIC_BOT"]["by_length"][b] for b in buckets]),
    ]
    fig, ax = _new_figure(10, 5.6, 0.08, 0.27, 0.20, 0.17)
    x = np.arange(len(buckets))
    ax.set_xlim(-0.3, len(buckets) - 0.7)
    ax.set_ylim(0, 105)
    ax.set_yticks(range(0, 101, 20))
    ax.set_yticklabels([f"{t}%" for t in range(0, 101, 20)])
    ax.grid(axis="y", color=GRID, linewidth=1, zorder=0)
    ax.set_axisbelow(True)
    ax.set_xticks(x)
    ax.set_xticklabels(buckets)
    ax.set_xlabel("Keystrokes in the session", fontsize=10, color=INK2, labelpad=8)
    for name, color, rows in series:
        rate = np.array([r["rate"] for r in rows]) * 100
        lo = np.array([r["ci95"][0] for r in rows]) * 100
        hi = np.array([r["ci95"][1] for r in rows]) * 100
        ax.fill_between(x, lo, hi, color=color, alpha=0.10, linewidth=0, zorder=1)
        ax.plot(x, rate, color=color, linewidth=2, solid_capstyle="round", solid_joinstyle="round", zorder=3)
        ax.plot(x, rate, linestyle="none", marker="o", markersize=8, markerfacecolor=color,
                markeredgecolor=SURFACE, markeredgewidth=2, zorder=4)
        ax.plot([x[-1] + 0.12, x[-1] + 0.32], [rate[-1]] * 2, color=color, linewidth=2, clip_on=False, zorder=3)
        ax.text(x[-1] + 0.40, rate[-1], f"{name}\n{rate[-1]:.0f}% at 200+ keys", va="center", fontsize=9.5,
                color=INK, clip_on=False)
    ax.axhline(5, color=MUTED, linewidth=1, zorder=2)
    ax.text(2.5, 10.5, "5% target false-alarm rate", fontsize=9, color=INK2, va="bottom", ha="center")
    _legend(ax, [(s[0], s[1]) for s in series], loc="upper left")
    _title(fig, "Detection grows with evidence; false alarms stay flat",
           "Full model. Regular and burst bots are caught 100% at every length. Shaded band: 95% Wilson interval.")
    path = out / "02_flag_rate_by_session_length.png"
    fig.savefig(path, dpi=SAVE_DPI)
    plt.close(fig)
    return path


# --------------------------------------------------------------------------------------
# 3. Risk band mix per class
# --------------------------------------------------------------------------------------
def fig_risk_bands(metrics: Dict, out: Path) -> Path:
    full = metrics["full"]
    h = full["human_test"]
    flagged, high = h["overall"]["rate"], h["high_anomaly_rate"]["rate"]
    rows = [("Genuine human (all styles)", [1 - flagged, flagged - high, high])]
    for cls in ATTACK_CLASSES + STRESS_ATTACK_CLASSES:
        b = full["attacks"][cls]["risk_bands"]
        rows.append((CLASS_LABELS[cls], [b["LOW_ANOMALY"], b["MODERATE_ANOMALY"], b["HIGH_ANOMALY"]]))
    colors = [BLUE_250, BLUE_400, BLUE_600]
    text_colors = [INK, "#ffffff", "#ffffff"]

    n = len(rows)
    fig, ax = _new_figure(10, 4.9, 0.20, 0.05, 0.22, 0.12)
    ax.set_ylim(n - 0.5, -0.5)
    _percent_axis(ax)
    ax.grid(False)
    gap_x, _ = _px(ax, 2, 0)
    for i, (label, shares) in enumerate(rows):
        left = 0.0
        for share, color, tcolor in zip(shares, colors, text_colors):
            width = share * 100
            if width > 0:
                _, h_data = _px(ax, 0, 20)
                ax.add_patch(Rectangle((left + gap_x / 2, i - h_data / 2), max(width - gap_x, 0), h_data,
                                       facecolor=color, edgecolor="none", zorder=3))
                if width >= 9:
                    ax.text(left + width / 2, i, f"{share:.0%}", ha="center", va="center", fontsize=9.5,
                            color=tcolor, zorder=4)
            left += width
    ax.set_yticks(range(n))
    ax.set_yticklabels([r[0] for r in rows])
    _legend(ax, [("LOW (< 50)", BLUE_250), ("MODERATE (50–75)", BLUE_400), ("HIGH (≥ 75)", BLUE_600)],
            loc="lower center", ncols=3, anchor=(0.5, 1.0))
    _title(fig, "How each kind of session is scored",
           "Full model. Risk bands are relative to genuine humans of similar length: 50 = their 95th percentile, 75 = their 99th.")
    path = out / "03_risk_band_mix.png"
    fig.savefig(path, dpi=SAVE_DPI)
    plt.close(fig)
    return path


# --------------------------------------------------------------------------------------
# 4. ROC
# --------------------------------------------------------------------------------------
def fig_roc(metrics: Dict, arrays: Dict[str, Dict[str, np.ndarray]], out: Path) -> Path:
    fig, ax = _new_figure(7.2, 6.4, 0.11, 0.05, 0.19, 0.12)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1.02)
    ax.set_xticks(np.arange(0, 1.01, 0.2))
    ax.set_yticks(np.arange(0, 1.01, 0.2))
    ax.set_xticklabels([f"{t:.0%}" for t in np.arange(0, 1.01, 0.2)])
    ax.set_yticklabels([f"{t:.0%}" for t in np.arange(0, 1.01, 0.2)])
    ax.grid(color=GRID, linewidth=1, zorder=0)
    ax.set_axisbelow(True)
    ax.set_xlabel("False-positive rate (genuine humans flagged)", fontsize=10, color=INK2, labelpad=8)
    ax.set_ylabel("Detection rate (core attacks)", fontsize=10, color=INK2, labelpad=8)
    ax.plot([0, 1], [0, 1], color=BASELINE, linewidth=1, zorder=1)

    specs = [("full", "Full (hold + flight)", BLUE, 3), ("flight_only", "Flight-only fallback", MUTED, 2)]
    names: Dict[str, str] = {}
    for mode, label, color, z in specs:
        a = arrays[mode]
        human = (a["split"] == "test") & np.isin(a["behavior"], NORMAL_CLASSES)
        core = np.isin(a["behavior"], ATTACK_CLASSES)
        y = np.r_[np.zeros(human.sum()), np.ones(core.sum())]
        s = np.r_[a["risk"][human], a["risk"][core]]
        fpr, tpr, _ = roc_curve(y, s)
        auc = metrics[mode]["summary"]["roc_auc_core_attacks_vs_human"]
        ax.plot(fpr, tpr, color=color, linewidth=2, solid_capstyle="round", zorder=z)
        op_fpr = float(np.mean(a["risk"][human] >= 50))
        op_tpr = float(np.mean(a["risk"][core] >= 50))
        ax.plot([op_fpr], [op_tpr], marker="o", markersize=9, markerfacecolor=color, markeredgecolor=SURFACE,
                markeredgewidth=2, zorder=5, linestyle="none")
        names[mode] = f"{label}  ·  AUC {auc:.3f}"
    ax.text(0.36, 1.006, "Full model", fontsize=10, color=INK, va="bottom", ha="center")
    ax.text(0.40, 0.72, "Flight-only fallback", fontsize=10, color=INK, va="top", ha="center")
    ax.text(0.98, 0.04, "Dots mark the operating point (risk score 50)", fontsize=9, color=INK2, va="bottom", ha="right")
    _legend(ax, [(names[s[0]], s[2]) for s in specs], loc="lower right", anchor=(1.0, 0.09))
    _title(fig, "Ranking quality: genuine humans vs. the three core attacks",
           "Held-out test data; bots never used in training. Mimic bot excluded (reported separately).")
    path = out / "04_roc_core_attacks.png"
    fig.savefig(path, dpi=SAVE_DPI)
    plt.close(fig)
    return path


# --------------------------------------------------------------------------------------
# 5. Unseen typing style
# --------------------------------------------------------------------------------------
def fig_unseen_style(metrics: Dict, out: Path) -> Path:
    loso = metrics["leave_one_style_out"]
    styles = list(loso.keys())
    fig, ax = _new_figure(10, 4.6, 0.25, 0.06, 0.22, 0.13)
    n = len(styles)
    ax.set_ylim(n - 0.5, -0.5)
    _percent_axis(ax)
    off = 0.20
    for i, style in enumerate(styles):
        seen = loso[style]["seen_style_test_flagged"]
        held = loso[style]["held_out_style_flagged"]
        _hbar(ax, i - off, seen["rate"] * 100, 18, MUTED)
        _hbar(ax, i + off, held["rate"] * 100, 18, BLUE)
        ax.text(seen["rate"] * 100 + 1.4, i - off, f"{seen['rate']:.1%}", va="center", fontsize=10, color=INK)
        ax.text(held["rate"] * 100 + 1.4, i + off, f"{held['rate']:.1%}", va="center", fontsize=10, color=INK)
    ax.set_yticks(range(n))
    ax.set_yticklabels([f"Withhold: {CLASS_LABELS[s].lower()}" for s in styles])
    _legend(ax, [("Typing styles the model was trained on", MUTED), ("Style withheld from training", BLUE)],
            loc="lower center", ncols=2, anchor=(0.5, 1.0))
    _title(fig, "A genuine typing style the model has never seen is flagged",
           "Share of genuine-human sessions flagged. Retrain and recalibrate on the real bidder population before deployment.")
    path = out / "05_unseen_typing_style.png"
    fig.savefig(path, dpi=SAVE_DPI)
    plt.close(fig)
    return path


# --------------------------------------------------------------------------------------
# 6. Length-aware calibration
# --------------------------------------------------------------------------------------
def fig_length_calibration(calibration, out: Path) -> Path:
    knots = np.exp(calibration.log_n_knots)
    curves = calibration.curves
    fig, ax = _new_figure(10, 5.4, 0.09, 0.25, 0.20, 0.16)
    ax.set_xscale("log")
    ax.set_xlim(knots[0], knots[-1])
    ticks = [10, 20, 30, 50, 100, 200, 300]
    ax.set_xticks(ticks)
    ax.set_xticklabels([str(t) for t in ticks])
    ax.minorticks_off()
    ax.grid(axis="y", color=GRID, linewidth=1, zorder=0)
    ax.set_axisbelow(True)
    ax.set_xlabel("Keystrokes in the session (log scale)", fontsize=10, color=INK2, labelpad=8)
    ax.set_ylabel("Anomaly score (−log-likelihood under the human model)", fontsize=10, color=INK2, labelpad=8)

    spec = [(1, "Median human (risk 25)", BLUE_300), (2, "95th percentile (risk 50)", BLUE), (3, "99th percentile (risk 75)", BLUE_650)]
    for idx, label, color in spec:
        ax.plot(knots, curves[:, idx], color=color, linewidth=2, solid_capstyle="round", zorder=3)
        ax.plot([knots[-1]], [curves[-1, idx]], marker="o", markersize=8, markerfacecolor=color,
                markeredgecolor=SURFACE, markeredgewidth=2, linestyle="none", zorder=4, clip_on=False)
        ax.annotate(label, (knots[-1], curves[-1, idx]), xytext=(12, 0), textcoords="offset points",
                    va="center", fontsize=9.5, color=INK, annotation_clip=False)
    _legend(ax, [(s[1], s[2]) for s in spec], loc="upper right")
    _title(fig, "Why thresholds depend on session length",
           "Genuine-human score quantiles from the held-out calibration split. Short sessions are noisier, so their bar is higher.")
    path = out / "06_length_aware_thresholds.png"
    fig.savefig(path, dpi=SAVE_DPI)
    plt.close(fig)
    return path


def make_all_figures(metrics: Dict, arrays: Dict[str, Dict[str, np.ndarray]], out_dir: Path, full_calibration=None) -> List[Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = [
        fig_detection_by_class(metrics, out_dir),
        fig_detection_by_length(metrics, out_dir),
        fig_risk_bands(metrics, out_dir),
        fig_roc(metrics, arrays, out_dir),
        fig_unseen_style(metrics, out_dir),
    ]
    if full_calibration is not None:
        paths.append(fig_length_calibration(full_calibration, out_dir))
    return paths
