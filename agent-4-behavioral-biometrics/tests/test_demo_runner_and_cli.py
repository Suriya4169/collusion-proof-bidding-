"""Run planning, the command line, and the guarantees about what the demo does NOT touch."""

import re
import subprocess
import sys
from pathlib import Path

import pytest

from demo.automation.runner import REPLAY_MAX_EVENTS, _balance, build_tasks
from demo.automation.scenarios import LENGTH_CLASSES, SCENARIOS
from demo.cli import _scenario_keys, build_parser

ROOT = Path(__file__).resolve().parents[1]
RECORDING = {"intervals": [800.0] + [140.0] * 59, "hold_durations": [90.0] * 60}


def test_task_plan_is_deterministic_and_covers_every_length_class():
    a, skipped = build_tasks(["pw_jitter", "sim_typical"], runs=6, seed=1)
    b, _ = build_tasks(["pw_jitter", "sim_typical"], runs=6, seed=1)
    c, _ = build_tasks(["pw_jitter", "sim_typical"], runs=6, seed=2)
    assert a == b and a != c and skipped == []
    jitter = [t for t in a if t["scenario"] == "pw_jitter"]
    assert [t["length_class"] for t in jitter] == ["short", "medium", "long"] * 2
    for t in jitter:
        lo, hi = LENGTH_CLASSES[t["length_class"]]
        assert lo <= t["n_keys"] <= hi
    assert len({t["seed"] for t in a}) == len(a)                        # no two visits share a random stream


def test_human_scenarios_get_more_visits():
    tasks, _ = build_tasks(["pw_instant", "sim_typical"], runs=40, seed=1)
    assert sum(t["scenario"] == "pw_instant" for t in tasks) == 40
    assert sum(t["scenario"] == "sim_typical" for t in tasks) == 60


def test_replay_is_skipped_without_recordings_and_uses_them_when_present():
    tasks, skipped = build_tasks(["pw_instant", "replay_human"], runs=3, seed=1, recordings=None)
    assert skipped == ["replay_human"] and {t["scenario"] for t in tasks} == {"pw_instant"}
    tasks, skipped = build_tasks(["replay_human"], runs=2, seed=1, recordings=[RECORDING])
    assert skipped == [] and all(t["recording"]["hold_durations"] == [90.0] * 60 and t["n_keys"] == 60 for t in tasks)
    long_one = {"intervals": [1.0] * 500, "hold_durations": [80.0] * 500}
    (task,), _ = build_tasks(["replay_human"], runs=1, seed=1, recordings=[long_one])
    assert task["n_keys"] == REPLAY_MAX_EVENTS


def test_work_is_split_across_workers_without_losing_or_duplicating_visits():
    tasks, _ = build_tasks(list(SCENARIOS)[:6], runs=9, seed=3)
    bins = _balance(tasks, 4)
    flat = [(t["scenario"], t["index"]) for b in bins for t in b]
    assert len(bins) == 4 and sorted(flat) == sorted((t["scenario"], t["index"]) for t in tasks)
    sizes = [sum(t["n_keys"] for t in b) for b in bins]
    assert max(sizes) < 2.5 * min(sizes)
    assert len(_balance(tasks[:2], 8)) == 2                              # never more workers than work


def test_cli_parser_and_scenario_selection():
    parser = build_parser()
    assert parser.parse_args(["serve"]).port == 8100 and parser.parse_args(["serve"]).host == "127.0.0.1"
    assert parser.parse_args(["bots", "--scenarios", "pw_instant", "--runs", "2"]).runs == 2
    assert parser.parse_args(["test", "--quick"]).quick is True
    assert _scenario_keys("all", have_recordings=False) == [k for k in SCENARIOS if k != "replay_human"]
    assert "replay_human" in _scenario_keys("all", have_recordings=True)
    assert _scenario_keys("pw_instant, pw_fill", True) == ["pw_instant", "pw_fill"]
    with pytest.raises(SystemExit):
        _scenario_keys("nope", True)


def test_documented_demo_commands_exist():
    commands = set(build_parser()._subparsers._group_actions[0].choices)
    mentioned = set()
    for doc in [ROOT / "README.md", *sorted((ROOT / "docs").glob("*.md"))]:
        mentioned |= set(re.findall(r"python -m demo ([a-z][a-z-]*)", doc.read_text(encoding="utf-8")))
    assert mentioned <= commands, f"docs mention unknown demo commands: {mentioned - commands}"


def test_the_demo_server_does_not_need_playwright_or_the_training_stack():
    code = ("import sys; import demo.app, demo.evaluation, demo.store; "
            "bad = [m for m in ('playwright', 'sklearn', 'pandas', 'matplotlib', 'scipy') if m in sys.modules]; "
            "sys.exit(1 if bad else 0)")
    result = subprocess.run([sys.executable, "-c", code], cwd=str(ROOT), capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


def test_the_production_image_and_package_do_not_include_the_demo():
    assert "demo" not in (ROOT / "Dockerfile").read_text(encoding="utf-8")
    assert 'include = ["agent4*"]' in (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert "demo/" in (ROOT / ".dockerignore").read_text(encoding="utf-8")
    assert "demo/runtime/" in (ROOT / ".gitignore").read_text(encoding="utf-8")


def test_the_scoring_service_does_not_import_the_demo():
    code = "import sys; import agent4.service, agent4.scorer; sys.exit(1 if any(m == 'demo' or m.startswith('demo.') for m in sys.modules) else 0)"
    assert subprocess.run([sys.executable, "-c", code], cwd=str(ROOT)).returncode == 0


def test_a_worker_exits_by_itself_when_its_parent_is_killed(tmp_path):
    """Cancelling a job can miss a worker that is being spawned at that moment; the worker must not outlive its parent."""
    import os
    import textwrap
    import time

    beat, pid_file = tmp_path / "beat.txt", tmp_path / "pid.txt"
    child = tmp_path / "child.py"
    child.write_text(textwrap.dedent(f"""
        import os, sys, time
        sys.path.insert(0, {str(ROOT)!r})
        from demo.automation.lifetime import exit_when_parent_dies
        exit_when_parent_dies(0.2)
        open({str(pid_file)!r}, "w").write(str(os.getpid()))
        while True:
            open({str(beat)!r}, "w").write(str(time.time()))
            time.sleep(0.1)
    """), encoding="utf-8")
    parent = tmp_path / "parent.py"
    parent.write_text(textwrap.dedent(f"""
        import subprocess, sys, time
        subprocess.Popen([sys.executable, {str(child)!r}])
        time.sleep(120)
    """), encoding="utf-8")
    proc = subprocess.Popen([sys.executable, str(parent)])
    try:
        deadline = time.time() + 15
        while not (beat.exists() and pid_file.exists()) and time.time() < deadline:
            time.sleep(0.1)
        assert beat.exists(), "child did not start"
        time.sleep(0.5)
        proc.kill()                                                    # the parent dies without cleaning up its child
        proc.wait()
        time.sleep(2.5)                                                # the watchdog polls every 0.2 s
        last = beat.stat().st_mtime
        time.sleep(1.0)
        assert beat.stat().st_mtime == last, "the child kept running after its parent was killed"
    finally:
        if pid_file.exists():
            pid = pid_file.read_text().strip()
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/PID", pid, "/F"], capture_output=True)
            else:
                try:
                    os.kill(int(pid), 9)
                except OSError:
                    pass
