"""Start the real server as a separate process and exercise it over real HTTP.

    python scripts/smoke_test_server.py

Checks: start-up with the shipped model, /health, a human and an automated example, input
rejection, API-key enforcement, and a clean shutdown. Exit code 0 means all checks passed.
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "docs" / "examples"


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _call(url: str, body=None, headers=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read() or b"{}")


def _start(port: int, extra_env: dict) -> subprocess.Popen:
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "AGENT4_LOG_LEVEL": "WARNING", **extra_env}
    proc = subprocess.Popen([sys.executable, "-m", "agent4", "serve", "--port", str(port)], cwd=ROOT, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    deadline = time.time() + 30
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError("server exited during start-up")
        try:
            if _call(f"http://127.0.0.1:{port}/health")[0] == 200:
                return proc
        except (urllib.error.URLError, ConnectionError):
            time.sleep(0.3)
    proc.kill()
    raise RuntimeError("server did not become healthy in 30 s")


def main() -> int:
    failures = []

    def check(name: str, ok: bool) -> None:
        print(("PASS  " if ok else "FAIL  ") + name)
        if not ok:
            failures.append(name)

    human = json.loads((EXAMPLES / "human_full.request.json").read_text())
    bot = json.loads((EXAMPLES / "automation_full.request.json").read_text())

    port = _free_port()
    proc = _start(port, {})
    base = f"http://127.0.0.1:{port}"
    try:
        status, health = _call(f"{base}/health")
        check("health is ok and reports the model version", status == 200 and health["model_loaded"] and health["model_version"])
        status, r = _call(f"{base}/behavior/analyze", human)
        check("human example: scored, LOW_ANOMALY", status == 200 and r["status"] == "scored" and r["risk_category"] == "LOW_ANOMALY")
        status, r = _call(f"{base}/behavior/analyze", bot)
        check("automation example: HIGH_ANOMALY with evidence", status == 200 and r["risk_category"] == "HIGH_ANOMALY" and r["behavioral_evidence"])
        status, _ = _call(f"{base}/behavior/analyze", {**human, "key": "a"})
        check("a payload carrying a content-like field is rejected (422)", status == 422)
        status, _ = _call(f"{base}/behavior/analyze", {"session_id": "me@example.com", "intervals": human["intervals"]})
        check("an e-mail address as session_id is rejected (422)", status == 422)
    finally:
        proc.terminate()
        proc.wait(timeout=10)

    port = _free_port()
    proc = _start(port, {"AGENT4_API_KEYS": "smoke-key", "AGENT4_REQUIRE_API_KEY": "true"})
    base = f"http://127.0.0.1:{port}"
    try:
        check("with auth on: no key -> 401", _call(f"{base}/behavior/analyze", human)[0] == 401)
        check("with auth on: wrong key -> 401", _call(f"{base}/behavior/analyze", human, {"X-API-Key": "nope"})[0] == 401)
        check("with auth on: right key -> 200", _call(f"{base}/behavior/analyze", human, {"X-API-Key": "smoke-key"})[0] == 200)
        check("with auth on: /health stays open", _call(f"{base}/health")[0] == 200)
    finally:
        proc.terminate()
        proc.wait(timeout=10)

    print("\nALL PASSED" if not failures else f"\n{len(failures)} FAILED")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
