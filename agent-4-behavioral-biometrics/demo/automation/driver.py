"""Carries out a planned :class:`Action` in a real browser against the demo portal.

Everything the model later sees was produced by a real browser handling real key events from the
automation tool; the only thing this module adds is *when* to press and release each key.
"""

from __future__ import annotations

import json
import statistics
import time
import urllib.request
from typing import Any, Dict, List, Optional

from demo.automation.clock import enable_high_resolution_timer, sleep_until
from demo.automation.scenarios import FIELDS, Action, Scenario

SELECTORS = {name: f"#{name}" for name in FIELDS}
NAVIGATION_TIMEOUT_MS = 30_000


def post_json(url: str, body: Dict[str, Any], timeout: float = 10.0) -> Dict[str, Any]:
    request = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:   # noqa: S310 - the demo's own loopback server
        return json.loads(response.read().decode())


def launch_browser(playwright, headed: bool = False):
    """Real Microsoft Edge (preferred) or Chrome, whichever is installed; no browser download needed."""
    last: Optional[Exception] = None
    for channel in ("msedge", "chrome"):
        try:
            return playwright.chromium.launch(channel=channel, headless=not headed)
        except Exception as exc:   # noqa: BLE001 - try the next installed browser
            last = exc
    raise RuntimeError("Neither Microsoft Edge nor Google Chrome could be launched by Playwright.") from last


def _focus(page, field: str) -> None:
    page.focus(SELECTORS[field])


def wait_for(page, predicate: str, timeout_ms: int = NAVIGATION_TIMEOUT_MS, poll_s: float = 0.05) -> None:
    """Poll a page condition (a ``() => ...`` function string).

    Playwright's own ``wait_for_function`` evaluates a string inside the page, which the portal's
    content security policy (no ``unsafe-eval``) rightly refuses. Polling ``evaluate`` does not
    need that, so the test runs under the same policy a real visitor gets.
    """
    deadline = time.perf_counter() + timeout_ms / 1000.0
    while time.perf_counter() < deadline:
        if page.evaluate(predicate):
            return
        time.sleep(poll_s)
    raise TimeoutError(f"page condition not met within {timeout_ms} ms: {predicate}")


def _execute(page, action: Action) -> None:
    keyboard = page.keyboard
    if action.mode == "fill":
        for name in FIELDS:
            if action.texts.get(name):
                page.fill(SELECTORS[name], action.texts[name])
    elif action.mode == "type":
        for name in FIELDS:
            if action.texts.get(name):
                _focus(page, name)
                keyboard.type(action.texts[name], delay=action.type_delay_ms)
    elif action.mode == "chunks":
        current = None
        for name, piece, pause_ms in action.chunks:
            if name != current:
                _focus(page, name)
                current = name
            keyboard.type(piece, delay=0)
            sleep_until(time.perf_counter() + pause_ms / 1000.0)
    elif action.mode == "keys":
        keys = action.keys
        _focus(page, keys[0].field)
        current = keys[0].field
        t = time.perf_counter()
        for k in keys:
            t_down = t + k.flight_ms / 1000.0
            if k.field != current:             # move focus inside the gap so the key press is not delayed
                _focus(page, k.field)
                current = k.field
            sleep_until(t_down)
            keyboard.down(k.char)
            t_up = t_down + k.hold_ms / 1000.0
            sleep_until(t_up)
            keyboard.up(k.char)
            t = t_up
    else:
        raise ValueError(f"unknown action mode {action.mode!r}")


def fidelity(action: Action, payload: Optional[Dict[str, List[float]]]) -> Optional[Dict[str, Any]]:
    """How closely the browser-measured timing matches the plan (only meaningful for timed plans)."""
    if action.mode != "keys" or not payload:
        return None
    holds = payload["hold_durations"]
    flights = payload["intervals"][1:]
    planned_h = [k.hold_ms for k in action.keys]
    planned_f = [k.flight_ms for k in action.keys[1:]]
    nh, nf = min(len(holds), len(planned_h)), min(len(flights), len(planned_f))
    if nh == 0:
        return None
    herr = [abs(holds[i] - planned_h[i]) for i in range(nh)]
    ferr = sorted(abs(flights[i] - planned_f[i]) for i in range(nf))
    return {
        "median_abs_hold_error_ms": round(statistics.median(herr), 2),
        "median_abs_flight_error_ms": round(statistics.median(ferr), 2) if ferr else None,
        "p95_abs_flight_error_ms": round(ferr[int(0.95 * (len(ferr) - 1))], 2) if ferr else None,
    }


def run_session(browser, base_url: str, scenario: Scenario, action: Action) -> Dict[str, Any]:
    """One complete visit: open the portal, declare the truth, type, submit, read back the result."""
    enable_high_resolution_timer()
    started = time.perf_counter()
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    try:
        page = context.new_page()
        page.set_default_timeout(NAVIGATION_TIMEOUT_MS)
        page.goto(f"{base_url}/", wait_until="load")
        wait_for(page, "() => !!(window.pipDemo && window.pipDemo.ready === true)")
        session_id = page.evaluate("() => window.pipDemo.sessionId")
        # The truth goes to the platform before any typing and never to Agent 4.
        post_json(f"{base_url}/demo/api/truth", {"session_id": session_id, "truth": scenario.truth,
                                                  "scenario": scenario.key, "tool": scenario.tool})
        _execute(page, action)
        payload = page.evaluate("() => window.pipDemo.collector.getPayload()")
        page.click("#submit")
        wait_for(page, "() => window.pipDemo.done === true")
        seen = page.evaluate("() => ({outcome: window.pipDemo.bid && window.pipDemo.bid.outcome, "
                             "risk: window.pipDemo.bid && window.pipDemo.bid.behavior && window.pipDemo.bid.behavior.behavioral_risk_score})")
        captured = len(payload["hold_durations"]) if payload else 0
        return {
            "scenario": scenario.key, "session_id": session_id, "ok": True, "error": None,
            "planned_events": action.planned_events if action.mode != "fill" else 0,
            "captured_events": captured,
            "page_outcome": seen.get("outcome"), "page_risk": seen.get("risk"),
            "fidelity": fidelity(action, payload),
            "duration_s": round(time.perf_counter() - started, 2),
        }
    except Exception as exc:   # noqa: BLE001 - one failed visit must not abort the batch; it is reported
        return {"scenario": scenario.key, "session_id": None, "ok": False, "error": f"{type(exc).__name__}: {str(exc)[:300]}",
                "planned_events": 0, "captured_events": 0, "page_outcome": None, "page_risk": None,
                "fidelity": None, "duration_s": round(time.perf_counter() - started, 2)}
    finally:
        context.close()
