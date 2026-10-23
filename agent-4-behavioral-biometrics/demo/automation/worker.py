"""One worker process: runs a batch of planned visits in a single browser and prints one JSON
result per line. Usage (started by ``runner.py``):  python -m demo.automation.worker TASKS.json BASE_URL [--headed]
"""

from __future__ import annotations

import json
import sys
from typing import Any, Dict, List

import numpy as np

from demo.automation.driver import launch_browser, run_session
from demo.automation.lifetime import exit_when_parent_dies
from demo.automation.scenarios import SCENARIOS, build_action


def run_batch(tasks: List[Dict[str, Any]], base_url: str, headed: bool = False) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = launch_browser(playwright, headed)
        try:
            for task in tasks:
                scenario = SCENARIOS[task["scenario"]]
                rng = np.random.default_rng(task["seed"])
                action = build_action(scenario, rng, task["n_keys"], task.get("recording"))
                result = run_session(browser, base_url, scenario, action)
                result.update({"index": task["index"], "length_class": task["length_class"], "n_keys": task["n_keys"]})
                print(json.dumps(result), flush=True)
        finally:
            browser.close()


def main(argv: List[str]) -> int:
    if len(argv) < 3:
        print("usage: worker TASKS.json BASE_URL [--headed]", file=sys.stderr)
        return 2
    exit_when_parent_dies()
    with open(argv[1], "r", encoding="utf-8") as fh:
        tasks = json.load(fh)
    run_batch(tasks, argv[2], headed="--headed" in argv[3:])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
