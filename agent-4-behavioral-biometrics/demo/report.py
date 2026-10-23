"""Writes the evaluation report (markdown + JSON + figure) and demo screenshots."""

from __future__ import annotations

import datetime as dt
import importlib.metadata
import json
import platform
import statistics
import sys
from pathlib import Path
from typing import Any, Dict, List

from agent4.config import RISK_HIGH_FROM, RISK_MODERATE_FROM
from demo import DEMO_VERSION


def _pct(x, digits: int = 0) -> str:
    return "-" if x is None else f"{x * 100:.{digits}f}%"


def _browser_version() -> str:
    try:
        from playwright.sync_api import sync_playwright

        from demo.automation.driver import launch_browser
        with sync_playwright() as p:
            browser = launch_browser(p)
            try:
                return browser.version
            finally:
                browser.close()
    except Exception as exc:   # noqa: BLE001
        return f"unknown ({type(exc).__name__})"


def collect_meta(status: Dict[str, Any], *, runs: int, seed: int, workers: int, elapsed_s: float,
                 skipped: List[str], tasks: int, results: int) -> Dict[str, Any]:
    try:
        playwright_version = importlib.metadata.version("playwright")
    except importlib.metadata.PackageNotFoundError:
        playwright_version = "unknown"
    return {
        "generated_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "demo_version": DEMO_VERSION,
        "model_version": status["agent4"]["health"].get("model_version"),
        "agent4_mode": status["agent4"]["mode"],
        "runs_per_scenario": runs, "seed": seed, "workers": workers, "visits_planned": tasks, "visits_completed": results,
        "elapsed_s": round(elapsed_s), "scenarios_skipped": skipped,
        "browser": _browser_version(), "playwright": playwright_version,
        "python": platform.python_version(), "os": f"{platform.system()} {platform.release()}",
    }


def harness_summary(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Did the browser record what the tool did? (planned vs captured events, timing fidelity)"""
    by_scenario: Dict[str, Dict[str, Any]] = {}
    for key in sorted({r["scenario"] for r in results}):
        mine = [r for r in results if r["scenario"] == key]
        ok = [r for r in mine if r["ok"]]
        matched = sum(1 for r in ok if r["captured_events"] == r["planned_events"])
        fid = [r["fidelity"] for r in ok if r.get("fidelity")]
        by_scenario[key] = {
            "visits": len(mine), "failed": len(mine) - len(ok), "events_matched": matched,
            "median_abs_hold_error_ms": round(statistics.median(f["median_abs_hold_error_ms"] for f in fid), 2) if fid else None,
            "median_abs_flight_error_ms": round(statistics.median(f["median_abs_flight_error_ms"] for f in fid if f["median_abs_flight_error_ms"] is not None), 2) if fid else None,
            "worst_p95_flight_error_ms": round(max(f["p95_abs_flight_error_ms"] for f in fid if f["p95_abs_flight_error_ms"] is not None), 2) if fid else None,
            "median_duration_s": round(statistics.median(r["duration_s"] for r in ok), 1) if ok else None,
        }
    return by_scenario


# --------------------------------------------------------------------------------------
def write_report(out: Path, evaluation: Dict[str, Any], results: List[Dict[str, Any]], meta: Dict[str, Any]) -> List[Path]:
    out.mkdir(parents=True, exist_ok=True)
    harness = harness_summary(results)
    payload = {"meta": meta, "evaluation": evaluation, "harness": harness, "visits": results}
    json_path = out / "demo_test_results.json"
    json_path.write_text(json.dumps(payload, indent=1), encoding="utf-8")
    figure = _figure(out / "risk_by_scenario.png", evaluation)
    md_path = out / "demo_test_report.md"
    md_path.write_text(_markdown(evaluation, harness, meta, figure.name if figure else None), encoding="utf-8")
    return [p for p in (md_path, json_path, figure) if p]


def _markdown(ev: Dict[str, Any], harness: Dict[str, Any], meta: Dict[str, Any], figure_name: Any) -> str:
    c = ev["status_counts"]
    lines: List[str] = []
    add = lines.append
    add("# Browser bot test: Agent 4 behind a demo platform\n")
    add(f"Generated {meta['generated_utc']} by `python -m demo test`. Model `{meta['model_version']}`, "
        f"Agent 4 running {meta['agent4_mode']}.\n")
    add("Real automated browsers (Playwright driving Microsoft Edge) visited a demo bid portal, typed into the form and submitted. "
        "The portal's collector sent keystroke timing to a stand-in platform backend, which forwarded it to the shipped Agent 4 "
        "model. The table is built from what the platform recorded. The test harness told the platform what each visit really "
        "was (bot or human) before it typed; Agent 4 was never told.\n")

    add("## Result\n")
    add(f"**{c['PASS']} expectations passed, {c['FAIL']} failed, {c['INCONCLUSIVE']} inconclusive** (too few visits to tell). "
        f"{c['INFO']} informational (no target set), {c['NOT RUN']} not run. Expectations and decision rules were written "
        "before the first run and were not changed afterwards.\n")
    b, h, v = ev["bots"], ev["simulated_humans"], ev["real_visitors"]
    add("| Group | Bids | Flagged (risk >= 50) | Flagged or no data | High (risk >= 75) |")
    add("|---|---:|---:|---:|---:|")
    for name, s in (("Bots (all scenarios)", b), ("Simulated humans", h), ("Real visitors", v)):
        if s["n"]:
            lo, hi = s["flagged_rate"]["ci95"]
            add(f"| {name} | {s['n']} | {s['flagged']} ({_pct(s['flagged_rate']['rate'])}, CI {_pct(lo)}-{_pct(hi)}) | "
                f"{_pct(s['flagged_or_no_data_rate']['rate'])} | {s['high']} |")
    add("")

    add("## Per scenario\n")
    add("| Scenario | Is really | Bids | Flagged | Median risk | No verdict | Synthetic benchmark | Result |")
    add("|---|---|---:|---:|---:|---:|---:|---|")
    for row in ev["scenarios"]:
        s = row["summary"]
        if not s["n"]:
            add(f"| {row['title']} | {row['truth']} | 0 | - | - | - | - | {row['status']} |")
            continue
        lo, hi = s["flagged_rate"]["ci95"]
        add(f"| {row['title']} | {row['truth']} | {s['n']} | {s['flagged']}/{s['n']} ({_pct(s['flagged_rate']['rate'])}, CI {_pct(lo)}-{_pct(hi)}) | "
            f"{'-' if s['median_risk'] is None else s['median_risk']} | {s['no_verdict']} | {_pct(row['synthetic_reference_rate'])} | **{row['status']}** |")
    add("")
    add("The *synthetic benchmark* column is the matching held-out rate from `reports/metrics.json` (a different, much larger sample "
        "of simulated sessions) for the scenarios that have an equivalent simulated class.\n")

    add("### What each scenario expected\n")
    for row in ev["scenarios"]:
        add(f"* **{row['title']}** ({row['truth']}; {row['tool']}). {row['expectation']['statement']}  \n  Outcome: {row['detail']}")
    add("")

    banded = [r for r in ev["scenarios"] if r["summary"]["by_length"]]
    if banded:
        add("## Detection by session length\n")
        add("Share of scored bids flagged, by number of keystrokes.\n")
        add("| Scenario | 10-29 keys | 30-99 keys | 100+ keys |")
        add("|---|---|---|---|")
        for row in banded:
            cells = []
            for band in ("10-29", "30-99", "100+"):
                x = row["summary"]["by_length"].get(band)
                cells.append(f"{_pct(x['rate'])} (n={x['n']})" if x else "-")
            add(f"| {row['title']} | " + " | ".join(cells) + " |")
        add("")

    add("## Did the test itself work?\n")
    add("| Scenario | Visits | Failed | Events captured = events typed | Median hold error (ms) | Median gap error (ms) | Worst 95th-pct gap error (ms) |")
    add("|---|---:|---:|---:|---:|---:|---:|")
    for key, s in harness.items():
        fmt = lambda x: "-" if x is None else f"{x}"   # noqa: E731
        add(f"| {key} | {s['visits']} | {s['failed']} | {s['events_matched']}/{s['visits'] - s['failed']} | "
            f"{fmt(s['median_abs_hold_error_ms'])} | {fmt(s['median_abs_flight_error_ms'])} | {fmt(s['worst_p95_flight_error_ms'])} |")
    add("")
    add("Timing error is the difference between the hold or gap the harness asked for and what the browser measured, "
        "for the scenarios that replay a timing plan. It shows how faithfully the browser pipeline reproduces the "
        f"intended rhythm. {meta['visits_completed']} of {meta['visits_planned']} planned visits completed.\n")

    if meta["scenarios_skipped"]:
        add(f"**Skipped:** {', '.join(meta['scenarios_skipped'])} (needs timing recorded from a real person: submit a few bids on the "
            "portal, then run the test again).\n")

    if figure_name:
        add(f"## Figure\n\n![Risk of every bid by scenario]({figure_name})\n")

    add("## What this does and does not show\n")
    add("* **Bots are real automation, but narrow.** Playwright sending Chrome DevTools key events into Edge. Selenium, AutoHotkey, "
        "hardware keyboard emulators, remote-desktop tools and other browsers were not tested.")
    add("* **The human side is simulated.** The simulated humans come from the same generator that produced the training data, so a "
        "low false-alarm rate here shows the browser pipeline reproduces timing faithfully, not that real people pass. The only real "
        "humans are visitors who type on the portal by hand (shown separately).")
    add("* **A replay of a real person's timing is a documented blind spot.** Timing alone cannot separate a replay from the person.")
    add("* **Bids with no keystrokes get no score by design.** The platform must treat 'no behavioural data' as a signal of its own; "
        "the demo backend does, Agent 4 does not.")
    add("* **Small samples.** Intervals are 95% Wilson intervals; with a few dozen visits per scenario they are wide.")
    add(f"\nEnvironment: {meta['os']}, Python {meta['python']}, Playwright {meta['playwright']}, browser {meta['browser']}; "
        f"seed {meta['seed']}, {meta['runs_per_scenario']} visits per scenario, {meta['workers']} workers, {meta['elapsed_s']} s.")
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------------------
def _figure(path: Path, ev: Dict[str, Any]):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np

    from agent4 import figures as fx

    rows = [r for r in ev["scenarios"] if r["summary"]["n"]]
    if not rows:
        return None
    n = len(rows)
    fig, ax = fx._new_figure(11.0, 1.3 + 0.62 * n, left=0.27, right=0.17, top=0.17, bottom=0.12)
    fx._title(fig, "Risk score of every bid, by scenario",
              "Each mark is one bid in a real browser. Right of 50 = flagged, right of 75 = high.")
    rng = np.random.default_rng(0)
    ax.set_xlim(-4, 104)
    ax.set_ylim(n - 0.5, -0.5)
    ax.axvline(RISK_MODERATE_FROM, color=fx.BASELINE, lw=1.5, ls=(0, (5, 4)), zorder=1)
    ax.axvline(RISK_HIGH_FROM, color=fx.BASELINE, lw=1.5, ls=(0, (5, 4)), zorder=1)
    ax.text(RISK_MODERATE_FROM, -0.72, "50 flagged", ha="center", va="bottom", fontsize=9, color=fx.INK2)
    ax.text(RISK_HIGH_FROM, -0.72, "75 high", ha="center", va="bottom", fontsize=9, color=fx.INK2)
    for i, row in enumerate(rows):
        ax.axhline(i, color=fx.GRID, lw=1, zorder=0)
        s = row["summary"]
        color, marker = (fx.ORANGE, "D") if row["truth"] == "bot" else (fx.BLUE, "o")
        risks = np.array(s["risk_values"])
        if len(risks):
            ax.scatter(risks, i + rng.uniform(-0.2, 0.2, len(risks)), s=34, c=color, marker=marker,
                       edgecolors=fx.SURFACE, linewidths=1.2, zorder=3)
        label = f"{s['flagged']}/{s['n']} flagged" + (f", {s['no_verdict']} no verdict" if s["no_verdict"] else "")
        ax.text(106, i, label, va="center", ha="left", fontsize=9, color=fx.INK2, clip_on=False)
    ax.set_yticks(range(n))
    ax.set_yticklabels([r["title"] for r in rows], fontsize=10)
    ax.set_xticks([0, 25, 50, 75, 100])
    ax.set_xlabel("Behavioural risk score")
    fig.text(0.02, 0.025, "Orange diamonds: bots. Blue circles: simulated humans.", fontsize=9, color=fx.INK2)
    fig.savefig(path, dpi=fx.SAVE_DPI)
    plt.close(fig)
    return path


def capture_screenshots(base_url: str, out: Path) -> List[Path]:
    """Dashboard and portal pictures for the documentation (taken after the evaluation is read)."""
    from playwright.sync_api import sync_playwright

    from demo.automation.driver import launch_browser, wait_for

    paths: List[Path] = []
    with sync_playwright() as p:
        browser = launch_browser(p)
        try:
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(f"{base_url}/dashboard", wait_until="load")
            page.wait_for_timeout(2500)
            page.screenshot(path=str(out / "dashboard.png"), full_page=True)
            paths.append(out / "dashboard.png")
            page.close()
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(f"{base_url}/", wait_until="load")
            wait_for(page, "() => !!(window.pipDemo && window.pipDemo.ready === true)")
            page.click('[data-script="random"]')
            wait_for(page, "() => window.pipDemo.lastBehavior !== null", timeout_ms=40000)
            page.wait_for_timeout(500)
            page.screenshot(path=str(out / "portal.png"), full_page=True)
            paths.append(out / "portal.png")
        finally:
            browser.close()
    return paths
