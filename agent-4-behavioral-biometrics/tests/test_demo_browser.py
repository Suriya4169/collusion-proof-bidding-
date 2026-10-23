"""End to end in a real browser: real Edge, real Playwright, a real server process, the real model.

Skipped automatically where Playwright or Edge/Chrome is not installed. Takes about a minute.
"""

import json
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest

pytest.importorskip("playwright")

from playwright.sync_api import sync_playwright  # noqa: E402

from demo.automation.driver import launch_browser, wait_for  # noqa: E402
from demo.automation.runner import build_tasks, run_plan  # noqa: E402
from demo.jobs import kill_tree  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


def _json(url, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


@pytest.fixture(scope="module")
def browser_available():
    try:
        with sync_playwright() as p:
            launch_browser(p).close()
    except Exception as exc:   # noqa: BLE001
        pytest.skip(f"no usable Edge/Chrome for Playwright: {exc}")


def _start_server(extra_args):
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen([sys.executable, "-u", "-m", "demo", "serve", "--port", str(port), "--no-persist", "--log-level", "warning",
                             *extra_args], cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    deadline = time.time() + 60
    while time.time() < deadline:
        try:
            if _json(f"{base}/demo/api/status")["agent4"]["health"]["model_loaded"]:
                return base, proc
        except Exception:   # noqa: BLE001
            time.sleep(0.4)
    kill_tree(proc)
    pytest.fail("demo server did not start")


@pytest.fixture(scope="module")
def server(browser_available):
    base, proc = _start_server(["--no-bot-lab"])
    try:
        yield base
    finally:
        kill_tree(proc)


@pytest.fixture(scope="module")
def lab_server(browser_available):
    base, proc = _start_server([])
    try:
        yield base
    finally:
        kill_tree(proc)


def test_real_automation_is_scored_by_the_real_model_and_recorded_faithfully(server):
    _json(f"{server}/demo/api/reset", "POST", {})
    tasks = []
    for key, runs in (("pw_instant", 3), ("pw_fill", 2), ("pw_metronome", 1), ("sim_typical", 1)):
        tasks += build_tasks([key], runs, seed=5)[0]
    results = run_plan(server, tasks, workers=2)
    assert len(results) == len(tasks) and all(r["ok"] for r in results), [r["error"] for r in results if not r["ok"]]

    feed = {s["session_id"]: s for s in _json(f"{server}/demo/api/sessions?after=0&limit=500")["sessions"]}
    by_scenario = {}
    for r in results:
        rec = feed[r["session_id"]]
        by_scenario.setdefault(r["scenario"], []).append((r, rec))
        # what the page showed the visitor is what the platform recorded
        assert r["page_outcome"] == rec["outcome"]
        assert r["page_risk"] == rec["risk"]
        # the browser captured exactly the keystrokes that were typed
        assert r["captured_events"] == r["planned_events"], r["scenario"]
        assert rec["bid_submitted"] is True and rec["truth"] in ("bot", "human")

    # naive bots are flagged high; programmatic fill leaves nothing to score
    assert all(rec["flagged"] and rec["high"] for _, rec in by_scenario["pw_instant"])
    assert all(rec["flagged"] for _, rec in by_scenario["pw_metronome"])
    assert all(rec["outcome"] == "no_data" and rec["risk"] is None for _, rec in by_scenario["pw_fill"])
    # the browser reproduced the intended rhythm to within a few milliseconds
    for key in ("pw_metronome", "sim_typical"):
        fid = by_scenario[key][0][0]["fidelity"]
        assert fid["median_abs_hold_error_ms"] < 5 and fid["median_abs_flight_error_ms"] < 5, fid

    ev = _json(f"{server}/demo/api/evaluation")
    rows = {r["key"]: r for r in ev["scenarios"]}
    assert rows["pw_instant"]["summary"]["flagged"] == 3 and rows["pw_fill"]["status"] == "PASS"
    assert ev["bots"]["n"] == 6 and ev["simulated_humans"]["n"] == 2       # one requested run x1.5 for human scenarios


def test_pages_run_without_console_errors_and_the_in_page_script_bot_is_caught(server):
    problems = []
    with sync_playwright() as p:
        browser = launch_browser(p)
        try:
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.on("console", lambda m: problems.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
            page.on("pageerror", lambda e: problems.append(f"pageerror: {e}"))
            page.on("response", lambda r: problems.append(f"http {r.status} {r.url}") if r.status >= 400 else None)

            page.goto(f"{server}/", wait_until="load")
            wait_for(page, "() => !!(window.pipDemo && window.pipDemo.ready === true)")
            page.click('[data-script="instant"]')
            wait_for(page, "() => window.pipDemo.lastBehavior !== null", timeout_ms=30_000)
            risk = page.evaluate("() => window.pipDemo.lastBehavior.behavioral_risk_score")
            assert risk >= 75
            assert page.is_visible("#panel") and "High" in page.inner_text("#risk-label")
            page.click("#submit")
            wait_for(page, "() => window.pipDemo.done === true")
            assert "accepted" in page.inner_text("#bid-note").lower()

            page.goto(f"{server}/dashboard", wait_until="load")
            wait_for(page, "() => document.querySelectorAll('#latest-table tbody tr').length > 0 && "
                           "document.querySelector('#latest-table tbody').innerText.indexOf('inpage instant') >= 0", timeout_ms=15_000)
            assert int(page.inner_text("#k-sessions")) >= 1
            assert page.is_visible("#chart") and page.evaluate("() => document.querySelectorAll('#chart .pt').length") >= 1
            # the bot lab is switched off on this server and says so
            assert page.is_visible("#lab-disabled") and not page.is_visible("#lab")
            page.click("#theme-toggle")                                  # theme switch redraws without errors
            page.wait_for_timeout(300)
        finally:
            browser.close()
    assert problems == [], problems


def test_dashboard_starts_a_real_bot_job_shows_the_result_and_can_cancel_one(lab_server):
    with sync_playwright() as p:
        browser = launch_browser(p)
        try:
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(f"{lab_server}/dashboard", wait_until="load")
            wait_for(page, "() => !!document.querySelector('#lab-grid .lab-item') && !document.querySelector('#lab-grid button[data-key=\"pw_instant\"]').disabled",
                     timeout_ms=15_000)
            assert page.is_visible("#lab") and not page.is_visible("#lab-disabled")

            item = page.locator(".lab-item", has_text="Instant typing")
            item.locator("input[type=number]").fill("3")
            item.locator("button").click()
            wait_for(page, "() => document.getElementById('job-text').textContent.indexOf('Finished') === 0", timeout_ms=90_000)
            wait_for(page, "() => document.getElementById('k-sessions').textContent === '3'", timeout_ms=15_000)
            # the results table refreshes a moment after the counters, so wait for it to catch up
            wait_for(page, "() => Array.prototype.some.call(document.querySelectorAll('#eval-table tbody tr'), "
                           "function (tr) { return tr.innerText.indexOf('Instant typing') >= 0 && tr.innerText.indexOf('3/3') >= 0; })",
                     timeout_ms=15_000)
            row = page.locator("#eval-table tbody tr", has_text="Instant typing").inner_text()
            assert "3/3" in row and "Bot" in row
            jobs = _json(f"{lab_server}/demo/api/bots")["jobs"]
            assert jobs[0]["status"] == "finished" and jobs[0]["done"] == jobs[0]["total"] == 3

            # a long job can be cancelled, and cancelling really stops the browsers (no more sessions arrive)
            page.locator(".lab-item", has_text="Simulated slow human").locator("input[type=number]").fill("20")
            page.locator(".lab-item", has_text="Simulated slow human").locator("button").click()
            wait_for(page, "() => !document.getElementById('cancel-job').hidden", timeout_ms=15_000)
            page.click("#cancel-job")
            wait_for(page, "() => document.getElementById('job-text').textContent.indexOf('Cancelled') === 0", timeout_ms=15_000)
            time.sleep(1.5)
            before = len(_json(f"{lab_server}/demo/api/sessions?after=0&limit=2000")["sessions"])
            time.sleep(4.0)
            after = len(_json(f"{lab_server}/demo/api/sessions?after=0&limit=2000")["sessions"])
            assert after == before
            assert _json(f"{lab_server}/demo/api/bots")["jobs"][0]["status"] == "cancelled"
        finally:
            browser.close()
