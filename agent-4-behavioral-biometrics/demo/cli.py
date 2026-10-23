"""Command line for the demo.

    python -m demo serve                 start the website (portal + dashboard) and the bot lab
    python -m demo bots --scenarios all  run bot scenarios against a running demo server
    python -m demo test                  start a clean server, run every scenario, write the evaluation report
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import List, Optional

from demo.jobs import PROJECT_ROOT, kill_tree

DEFAULT_PORT = 8100
DEFAULT_PERSIST = PROJECT_ROOT / "demo" / "runtime" / "sessions.jsonl"
DEFAULT_REPORT_DIR = PROJECT_ROOT / "reports" / "demo"
LOOPBACK = {"127.0.0.1", "localhost", "::1"}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m demo", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    serve = sub.add_parser("serve", help="Start the demo website")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=DEFAULT_PORT)
    serve.add_argument("--no-bot-lab", action="store_true", help="Do not allow the dashboard to start browsers")
    serve.add_argument("--agent4-url", default=None, help="Use a running Agent 4 service instead of running it in-process")
    serve.add_argument("--agent4-api-key", default=os.environ.get("DEMO_AGENT4_API_KEY"), help="X-API-Key for a remote Agent 4")
    serve.add_argument("--model-dir", default=None, help="Model folder for the in-process Agent 4 (default: models/)")
    serve.add_argument("--persist", default=str(DEFAULT_PERSIST), help="JSON-lines file where submitted sessions are kept")
    serve.add_argument("--no-persist", action="store_true", help="Keep sessions in memory only")
    serve.add_argument("--log-level", default="info")

    bots = sub.add_parser("bots", help="Run bot scenarios against a running demo server")
    bots.add_argument("--base-url", default=f"http://127.0.0.1:{DEFAULT_PORT}")
    bots.add_argument("--scenarios", default="all", help="Comma-separated scenario keys, or 'all'")
    bots.add_argument("--runs", type=int, default=5, help="Visits per scenario")
    bots.add_argument("--workers", type=int, default=2)
    bots.add_argument("--seed", type=int, default=2026)
    bots.add_argument("--headed", action="store_true", help="Show the browser windows")
    bots.add_argument("--recordings", default=str(DEFAULT_PERSIST), help="Sessions file to take recorded human timing from")

    test = sub.add_parser("test", help="Run every scenario against a clean server and write the evaluation report")
    test.add_argument("--base-url", default=None, help="Use this running server instead of starting one (it is cleared first)")
    test.add_argument("--runs", type=int, default=40, help="Visits per scenario")
    test.add_argument("--quick", action="store_true", help="A small smoke run (6 visits per scenario)")
    test.add_argument("--workers", type=int, default=4)
    test.add_argument("--seed", type=int, default=2026)
    test.add_argument("--headed", action="store_true")
    test.add_argument("--out", default=str(DEFAULT_REPORT_DIR))
    test.add_argument("--recordings", default=str(DEFAULT_PERSIST))
    test.add_argument("--no-screenshots", action="store_true")
    return parser


# --------------------------------------------------------------------------------------
def _http_json(url: str, method: str = "GET", body: Optional[dict] = None, timeout: float = 15.0) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:   # noqa: S310 - the demo's own loopback server
        return json.loads(response.read().decode())


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_ready(base_url: str, timeout: float = 60.0) -> dict:
    deadline = time.time() + timeout
    last: Optional[Exception] = None
    while time.time() < deadline:
        try:
            status = _http_json(f"{base_url}/demo/api/status", timeout=3.0)
            if status["agent4"]["health"].get("model_loaded"):
                return status
        except (urllib.error.URLError, OSError, ValueError, KeyError) as exc:
            last = exc
        time.sleep(0.4)
    raise RuntimeError(f"The demo server at {base_url} did not become ready: {last}")


def _scenario_keys(spec: str, have_recordings: bool) -> List[str]:
    from demo.automation.scenarios import SCENARIOS
    if spec == "all":
        return [k for k, s in SCENARIOS.items() if have_recordings or not s.needs_recording]
    keys = [k.strip() for k in spec.split(",") if k.strip()]
    unknown = [k for k in keys if k not in SCENARIOS]
    if unknown:
        raise SystemExit(f"unknown scenario(s): {', '.join(unknown)}. Choose from: {', '.join(SCENARIOS)}")
    return keys


# --------------------------------------------------------------------------------------
def cmd_serve(args) -> int:
    import uvicorn

    from agent4.config import Settings
    from demo.app import DemoSettings, create_demo_app

    loopback = args.host in LOOPBACK
    bot_lab = loopback and not args.no_bot_lab
    if not loopback:
        print(f"Note: bound to {args.host}; the bot lab (which starts browsers) is disabled for non-loopback addresses.")
    a4 = Settings.from_env()
    if args.model_dir:
        a4 = Settings(**{**a4.__dict__, "model_dir": Path(args.model_dir)})
    public_host = "127.0.0.1" if args.host in ("0.0.0.0", "::") else args.host
    settings = DemoSettings(
        agent4_url=args.agent4_url, agent4_api_key=args.agent4_api_key,
        agent4_settings=Settings(**{**a4.__dict__, "log_level": "WARNING"}),
        persist_path=None if args.no_persist else Path(args.persist),
        bot_lab=bot_lab, public_url=f"http://{public_host}:{args.port}",
    )
    print(f"Portal:     http://{public_host}:{args.port}/\nDashboard:  http://{public_host}:{args.port}/dashboard\n"
          f"Agent 4:    {'remote ' + args.agent4_url if args.agent4_url else 'in-process, models from ' + str(a4.model_dir)}\n"
          f"Bot lab:    {'on' if bot_lab else 'off'}", flush=True)
    uvicorn.run(create_demo_app(settings), host=args.host, port=args.port, log_level=args.log_level)
    return 0


def cmd_bots(args) -> int:
    from demo.automation.runner import build_tasks, run_plan
    from demo.store import load_manual_recordings

    recordings = load_manual_recordings(Path(args.recordings)) if args.recordings else []
    keys = _scenario_keys(args.scenarios, bool(recordings))
    tasks, skipped = build_tasks(keys, args.runs, args.seed, recordings)
    for key in skipped:
        print(f"Skipping {key}: no recorded human sessions yet (submit a bid on the portal first).", flush=True)
    print(f"Running {len(tasks)} visits over {args.workers} browser(s)...", flush=True)
    print(f"PROGRESS 0/{len(tasks)}", flush=True)
    results = run_plan(args.base_url, tasks, args.workers, args.headed,
                       on_progress=lambda done, total: print(f"PROGRESS {done}/{total}", flush=True))
    failed = [r for r in results if not r["ok"]]
    for r in failed[:5]:
        print(f"FAILED {r['scenario']}: {r['error']}", flush=True)
    print(f"Finished: {len(results) - len(failed)} ok, {len(failed)} failed.", flush=True)
    return 1 if failed or len(results) < len(tasks) else 0


def cmd_test(args) -> int:
    from demo import report as report_module
    from demo.automation.runner import build_tasks, run_plan
    from demo.store import load_manual_recordings

    runs = 6 if args.quick else args.runs
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    server: Optional[subprocess.Popen] = None
    base_url = args.base_url
    try:
        if base_url is None:
            port = _free_port()
            base_url = f"http://127.0.0.1:{port}"
            cmd = [sys.executable, "-u", "-m", "demo", "serve", "--port", str(port), "--no-persist", "--no-bot-lab", "--log-level", "warning"]
            server = subprocess.Popen(cmd, cwd=str(PROJECT_ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                      start_new_session=(sys.platform != "win32"))
        status = _wait_ready(base_url)
        _http_json(f"{base_url}/demo/api/reset", "POST", {})
        recordings = load_manual_recordings(Path(args.recordings)) if args.recordings else []
        keys = _scenario_keys("all", bool(recordings))
        tasks, skipped = build_tasks(keys, runs, args.seed, recordings)
        print(f"Model {status['agent4']['health']['model_version']} | {len(tasks)} browser visits, {args.workers} workers"
              + (f" | skipped (no recordings): {', '.join(skipped)}" if skipped else ""), flush=True)
        started = time.time()
        last = [0.0]

        def progress(done: int, total: int) -> None:
            if time.time() - last[0] > 5 or done == total:
                last[0] = time.time()
                print(f"  {done}/{total} visits  ({time.time() - started:.0f}s)", flush=True)

        results = run_plan(base_url, tasks, args.workers, args.headed, progress)
        elapsed = time.time() - started

        evaluation = _http_json(f"{base_url}/demo/api/evaluation")
        meta = report_module.collect_meta(status, runs=runs, seed=args.seed, workers=args.workers, elapsed_s=elapsed,
                                          skipped=skipped, tasks=len(tasks), results=len(results))
        paths = report_module.write_report(out, evaluation, results, meta)
        if not args.no_screenshots:
            try:
                report_module.capture_screenshots(base_url, out)
            except Exception as exc:   # noqa: BLE001 - screenshots are a nicety
                print(f"(screenshots skipped: {exc})", flush=True)
        failed = [r for r in results if not r["ok"]]
        counts = evaluation["status_counts"]
        print(f"\nEvaluation: {counts['PASS']} passed, {counts['FAIL']} failed, {counts['INCONCLUSIVE']} inconclusive, {counts['INFO']} informational, "
              f"{counts['NOT RUN']} not run; {len(failed)} harness failures.", flush=True)
        for p in paths:
            print(f"  wrote {p}", flush=True)
        if failed:
            return 2
        return 0 if counts["FAIL"] == 0 else 1
    finally:
        if server is not None:
            kill_tree(server)


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    return {"serve": cmd_serve, "bots": cmd_bots, "test": cmd_test}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
