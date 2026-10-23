"""Judge what the platform recorded against the expectations declared in ``scenarios.py``.

The input is the platform's own session records (what Agent 4 really answered, joined to the
ground truth the test harness registered), not anything the test client claims.
"""

from __future__ import annotations

import math
import statistics
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple

from demo.automation.scenarios import KIND_DETECT, KIND_NO_VERDICT, KIND_PASS_HUMANS, SCENARIOS, Scenario
from demo.store import OUTCOME_NO_DATA, OUTCOME_SCORED

# Decision rules, fixed before any run. Each uses the 95% Wilson interval so that a verdict needs enough
# data: a result is PASS only if the data demonstrate the expectation, FAIL only if they demonstrably
# contradict it, and INCONCLUSIVE otherwise (too few visits to tell).
DETECT_MIN_LOWER = 0.90         # "must detect": PASS if the interval's lower bound >= 90%; FAIL if its upper bound < 90%
HUMAN_PASS_UPPER = 0.15         # "humans must pass": PASS if the upper bound <= 15%
HUMAN_FAIL_LOWER = 0.10         #                    FAIL if the lower bound > 10% (design target is 5%)

PASS, FAIL, INCONCLUSIVE, INFO, PENDING = "PASS", "FAIL", "INCONCLUSIVE", "INFO", "NOT RUN"
BANDS = (("10-29", 10, 29), ("30-99", 30, 99), ("100+", 100, 10 ** 9))


def wilson(successes: int, total: int, z: float = 1.96) -> Tuple[float, float]:
    if total <= 0:
        return (0.0, 1.0)
    p = successes / total
    denom = 1.0 + z * z / total
    centre = (p + z * z / (2 * total)) / denom
    half = z * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denom
    return (max(0.0, centre - half), min(1.0, centre + half))


def _rate(k: int, n: int) -> Dict[str, Any]:
    lo, hi = wilson(k, n)
    return {"n": n, "k": k, "rate": (k / n) if n else None, "ci95": [lo, hi]}


def _band(events: Optional[int]) -> Optional[str]:
    if events is None:
        return None
    for name, lo, hi in BANDS:
        if lo <= events <= hi:
            return name
    return None


def summarize(rows: List[Mapping[str, Any]]) -> Dict[str, Any]:
    n = len(rows)
    scored = [r for r in rows if r["outcome"] == OUTCOME_SCORED]
    flagged = sum(1 for r in scored if r["flagged"])
    high = sum(1 for r in scored if r["high"])
    no_data = sum(1 for r in rows if r["outcome"] == OUTCOME_NO_DATA)
    risks = [r["risk"] for r in scored if r["risk"] is not None]
    by_band: Dict[str, Any] = {}
    for name, _, _ in BANDS:
        band_rows = [r for r in scored if _band(r["events"]) == name]
        if band_rows:
            by_band[name] = _rate(sum(1 for r in band_rows if r["flagged"]), len(band_rows))
    latencies = [r["agent4_latency_ms"] for r in rows if r.get("agent4_latency_ms") is not None]
    return {
        "n": n,
        "scored": len(scored),
        "no_verdict": n - len(scored),
        "no_data": no_data,
        "flagged": flagged,
        "high": high,
        "flagged_rate": _rate(flagged, n),                    # unscored sessions count as "not flagged"
        "flagged_or_no_data_rate": _rate(flagged + no_data, n),
        "median_risk": round(statistics.median(risks), 1) if risks else None,
        "risk_values": [round(x, 1) for x in risks],
        "by_length": by_band,
        "median_agent4_latency_ms": round(statistics.median(latencies), 2) if latencies else None,
    }


def judge(kind: str, summary: Mapping[str, Any]) -> Tuple[str, str]:
    n = summary["n"]
    if n == 0:
        return PENDING, "No sessions recorded for this scenario yet."
    rate = summary["flagged_rate"]
    lo, hi = rate["ci95"]
    shown = f"{rate['k']}/{n} flagged ({rate['rate'] * 100:.0f}%, 95% CI {lo * 100:.0f}-{hi * 100:.0f}%)"
    if kind == KIND_DETECT:
        if lo >= DETECT_MIN_LOWER:
            return PASS, shown
        if hi < DETECT_MIN_LOWER:
            return FAIL, shown + f"; demonstrably below {DETECT_MIN_LOWER * 100:.0f}%"
        return INCONCLUSIVE, shown + f"; not enough visits to show {DETECT_MIN_LOWER * 100:.0f}% or more"
    if kind == KIND_PASS_HUMANS:
        if lo > HUMAN_FAIL_LOWER:
            return FAIL, shown + f"; demonstrably above {HUMAN_FAIL_LOWER * 100:.0f}%"
        if hi <= HUMAN_PASS_UPPER:
            return PASS, shown
        return INCONCLUSIVE, shown + f"; not enough visits to show {HUMAN_PASS_UPPER * 100:.0f}% or less"
    if kind == KIND_NO_VERDICT:
        ok = summary["scored"] == 0
        return (PASS if ok else FAIL), (f"{summary['no_verdict']}/{n} bids had no behavioural data and Agent 4 gave no verdict"
                                         if ok else f"{summary['scored']}/{n} were scored, which was not expected")
    return INFO, shown


def reference_rate(scenario: Scenario, metrics: Optional[Mapping[str, Any]]) -> Optional[float]:
    """The matching synthetic-benchmark rate from reports/metrics.json, if there is one."""
    if not metrics or not scenario.reference_class:
        return None
    full = metrics.get("full", {})
    try:
        if scenario.truth == "human":
            return float(full["human_test"]["by_style"][scenario.reference_class]["rate"])
        return float(full["attacks"][scenario.reference_class]["overall"]["rate"])
    except (KeyError, TypeError):
        return None


def evaluate(records: Iterable[Mapping[str, Any]], metrics: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
    submitted = [r for r in records if r.get("bid_submitted")]
    rows: List[Dict[str, Any]] = []
    for scenario in SCENARIOS.values():
        mine = [r for r in submitted if r.get("scenario") == scenario.key]
        s = summarize(mine)
        status, text = judge(scenario.expectation.kind, s)
        rows.append({
            "key": scenario.key, "title": scenario.title, "truth": scenario.truth, "tool": scenario.tool,
            "description": scenario.description,
            "expectation": {"kind": scenario.expectation.kind, "statement": scenario.expectation.statement},
            "summary": s, "status": status, "detail": text,
            "synthetic_reference_rate": reference_rate(scenario, metrics),
        })

    bots = [r for r in submitted if r.get("truth") == "bot"]
    humans = [r for r in submitted if r.get("truth") == "human"]
    visitors = [r for r in submitted if r.get("truth") is None and r.get("scenario") is None]
    counts = {s: sum(1 for row in rows if row["status"] == s) for s in (PASS, FAIL, INCONCLUSIVE, INFO, PENDING)}
    return {
        "scenarios": rows,
        "bots": summarize(bots),
        "simulated_humans": summarize(humans),
        "real_visitors": summarize(visitors),
        "status_counts": counts,
        "expectations_met": counts[FAIL] == 0 and counts[PASS] > 0,
        "sessions_evaluated": len(submitted),
    }
