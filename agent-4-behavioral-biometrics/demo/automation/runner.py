"""Plans a set of visits and runs them across several worker processes (one real browser each)."""

from __future__ import annotations

import json
import math
import subprocess
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np

from demo.automation.scenarios import SCENARIOS, draw_length, length_class_for
from demo.jobs import PROJECT_ROOT, kill_tree

# Rough seconds of waiting per keystroke, used only to balance work between workers.
_COST_PER_KEY = {"pw_instant": 0.004, "pw_fixed_delay": 0.13, "pw_metronome": 0.17, "pw_burst": 0.06, "pw_jitter": 0.2,
                 "pw_mimic": 0.27, "pw_fill": 0.0, "replay_human": 0.3, "sim_typical": 0.26, "sim_fast": 0.19, "sim_slow": 0.37}
REPLAY_MAX_EVENTS = 220


def build_tasks(scenario_keys: Sequence[str], runs: int, seed: int,
                recordings: Optional[List[Dict[str, List[float]]]] = None) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Deterministic list of visits. Returns (tasks, scenarios skipped because they need recordings)."""
    tasks: List[Dict[str, Any]] = []
    skipped: List[str] = []
    for position, key in enumerate(scenario_keys):
        scenario = SCENARIOS[key]
        if scenario.needs_recording and not recordings:
            skipped.append(key)
            continue
        for i in range(int(math.ceil(runs * scenario.runs_factor))):
            sequence = np.random.SeedSequence([seed, position, i])
            rng = np.random.default_rng(sequence)
            recording = None
            if scenario.fixed_length:
                source = recordings[i % len(recordings)]
                recording = {"intervals": list(source["intervals"])[:REPLAY_MAX_EVENTS],
                             "hold_durations": list(source["hold_durations"])[:REPLAY_MAX_EVENTS]}
                n_keys, length_class = len(recording["hold_durations"]), "recorded"
            else:
                length_class = length_class_for(i)
                n_keys = draw_length(rng, length_class)
            tasks.append({"scenario": key, "index": i, "n_keys": n_keys, "length_class": length_class,
                          "seed": int(sequence.generate_state(1)[0]), "recording": recording})
    return tasks, skipped


def _balance(tasks: List[Dict[str, Any]], workers: int) -> List[List[Dict[str, Any]]]:
    """Longest-job-first assignment so the workers finish at about the same time."""
    cost = lambda t: t["n_keys"] * _COST_PER_KEY.get(t["scenario"], 0.2) + 1.5   # noqa: E731
    bins: List[List[Dict[str, Any]]] = [[] for _ in range(max(1, workers))]
    loads = [0.0] * len(bins)
    for task in sorted(tasks, key=cost, reverse=True):
        i = loads.index(min(loads))
        bins[i].append(task)
        loads[i] += cost(task)
    return [b for b in bins if b]


def run_plan(base_url: str, tasks: List[Dict[str, Any]], workers: int = 3, headed: bool = False,
             on_progress: Optional[Callable[[int, int], None]] = None) -> List[Dict[str, Any]]:
    """Run every task; returns one result dict per visit."""
    if not tasks:
        return []
    batches = _balance(tasks, workers)
    results: List[Dict[str, Any]] = []
    lock = threading.Lock()
    processes: List[subprocess.Popen] = []
    files: List[Path] = []

    def reader(process: subprocess.Popen) -> None:
        assert process.stdout is not None
        for line in process.stdout:
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                result = json.loads(line)
            except ValueError:
                continue
            with lock:
                results.append(result)
                done = len(results)
            if on_progress:
                on_progress(done, len(tasks))

    threads: List[threading.Thread] = []
    try:
        for batch in batches:
            handle = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
            json.dump(batch, handle)
            handle.close()
            files.append(Path(handle.name))
            cmd = [sys.executable, "-u", "-m", "demo.automation.worker", handle.name, base_url] + (["--headed"] if headed else [])
            process = subprocess.Popen(cmd, cwd=str(PROJECT_ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                       text=True, encoding="utf-8", errors="replace",
                                       start_new_session=(sys.platform != "win32"))
            processes.append(process)
            thread = threading.Thread(target=reader, args=(process,), daemon=True)
            thread.start()
            threads.append(thread)
        for process in processes:
            process.wait()
        for thread in threads:
            thread.join(timeout=5)
    except BaseException:
        for process in processes:
            kill_tree(process)
        raise
    finally:
        for path in files:
            try:
                path.unlink()
            except OSError:
                pass
    crashed = [p.returncode for p in processes if p.returncode not in (0, None)]
    if crashed and len(results) < len(tasks):
        raise RuntimeError(f"{len(crashed)} worker(s) exited abnormally after {len(results)}/{len(tasks)} visits "
                           f"(codes {crashed}). Is Microsoft Edge or Chrome installed, and Playwright (`pip install playwright`)?")
    return results
