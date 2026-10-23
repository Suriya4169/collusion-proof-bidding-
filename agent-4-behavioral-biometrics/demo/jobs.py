"""Runs bot scenarios on behalf of the dashboard.

Security posture (this launches browsers, so it is deliberately narrow):
* it exists only when the demo server was started with the bot lab enabled, which the CLI allows
  only for a loopback address;
* the scenario is chosen from the fixed registry, never a free-form command;
* run counts are capped and only one job runs at a time;
* the work happens in a separate process that talks to the server like any other client.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import threading
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAX_RUNS_PER_SCENARIO = 100
_PROGRESS = re.compile(r"^PROGRESS (\d+)/(\d+)")


class JobError(Exception):
    pass


class Job:
    def __init__(self, scenarios: str, runs: int, headed: bool):
        self.id = uuid.uuid4().hex[:10]
        self.scenarios = scenarios
        self.runs = runs
        self.headed = headed
        self.status = "starting"
        self.started_at = time.time()
        self.finished_at: Optional[float] = None
        self.done = 0
        self.total = 0
        self.returncode: Optional[int] = None
        self.log: Deque[str] = deque(maxlen=25)
        self.process: Optional[subprocess.Popen] = None

    def public(self) -> Dict[str, Any]:
        return {"id": self.id, "scenarios": self.scenarios, "runs": self.runs, "headed": self.headed,
                "status": self.status, "started_at": self.started_at, "finished_at": self.finished_at,
                "done": self.done, "total": self.total, "returncode": self.returncode, "log": list(self.log)}


def kill_tree(process: subprocess.Popen) -> None:
    """Stop a process and every browser it started."""
    if process.poll() is not None:
        return
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True, check=False)
    else:  # pragma: no cover - POSIX path
        import signal
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        except ProcessLookupError:
            pass


class JobManager:
    def __init__(self, base_url: str, valid_scenarios: List[str]):
        self._base_url = base_url
        self._valid = set(valid_scenarios) | {"all"}
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()

    def start(self, scenarios: str, runs: int, headed: bool) -> Job:
        if scenarios not in self._valid:
            raise JobError(f"unknown scenario {scenarios!r}")
        if not 1 <= runs <= MAX_RUNS_PER_SCENARIO:
            raise JobError(f"runs must be between 1 and {MAX_RUNS_PER_SCENARIO}")
        with self._lock:
            if any(j.status in ("starting", "running") for j in self._jobs.values()):
                raise JobError("a bot job is already running; wait for it to finish or cancel it")
            job = Job(scenarios, runs, headed)
            cmd = [sys.executable, "-u", "-m", "demo", "bots", "--base-url", self._base_url,
                   "--scenarios", scenarios, "--runs", str(runs), "--workers", "2"]
            if headed:
                cmd.append("--headed")
            env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUNBUFFERED="1")
            job.process = subprocess.Popen(cmd, cwd=str(PROJECT_ROOT), env=env, stdout=subprocess.PIPE,
                                           stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                                           start_new_session=(sys.platform != "win32"))
            job.status = "running"
            self._jobs[job.id] = job
            # keep the table small: forget the oldest finished jobs
            for old in sorted((j for j in self._jobs.values() if j.finished_at), key=lambda j: j.finished_at)[:-10]:
                self._jobs.pop(old.id, None)
        threading.Thread(target=self._watch, args=(job,), daemon=True).start()
        return job

    def _watch(self, job: Job) -> None:
        assert job.process is not None and job.process.stdout is not None
        for line in job.process.stdout:
            line = line.rstrip()
            match = _PROGRESS.match(line)
            if match:
                job.done, job.total = int(match.group(1)), int(match.group(2))
            elif line:
                job.log.append(line[:300])
        code = job.process.wait()
        job.returncode = code
        job.finished_at = time.time()
        if job.status != "cancelled":
            job.status = "finished" if code == 0 else "failed"

    def list(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [j.public() for j in sorted(self._jobs.values(), key=lambda j: -j.started_at)]

    def cancel(self, job_id: str) -> Job:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise JobError("no such job")
            if job.status == "running" and job.process is not None:
                job.status = "cancelled"
                kill_tree(job.process)
            return job

    def shutdown(self) -> None:
        with self._lock:
            for job in self._jobs.values():
                if job.process is not None and job.status == "running":
                    job.status = "cancelled"
                    kill_tree(job.process)
