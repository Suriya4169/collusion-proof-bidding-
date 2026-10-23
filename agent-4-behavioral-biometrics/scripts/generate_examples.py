"""Regenerate docs/examples/*.json from the shipped model.

The examples used in the documentation are produced by the real scorer on sessions from the
simulator, and tests/test_service.py asserts that the live API still returns exactly these
responses. That is what keeps the documentation from drifting away from the code.

    python scripts/generate_examples.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from agent4.config import DEFAULT_MODEL_DIR  # noqa: E402
from agent4.scorer import BehaviorScorer  # noqa: E402
from agent4.simulation import PROFILES, generate_session_timings  # noqa: E402

EXAMPLES = [
    # name, behaviour class, events, include hold durations
    ("human_full", "HUMAN_LIKE", 60, True),
    ("automation_full", "REGULAR_AUTOMATION", 40, True),
    ("adaptive_bot_long", "ADAPTIVE_AUTOMATION", 200, True),
    ("human_flight_only", "HUMAN_LIKE", 60, False),
    ("too_short", "HUMAN_LIKE", 6, True),
]


def main() -> None:
    out_dir = ROOT / "docs" / "examples"
    out_dir.mkdir(parents=True, exist_ok=True)
    scorer = BehaviorScorer.from_dir(DEFAULT_MODEL_DIR)
    rng = np.random.default_rng(20261014)
    for name, cls, n, with_holds in EXAMPLES:
        flights, holds = generate_session_timings(rng, PROFILES[cls], n)
        request = {"session_id": f"example-{name}", "intervals": flights.tolist()}
        if with_holds:
            request["hold_durations"] = holds.tolist()
        result = scorer.score(request["session_id"], request["intervals"], request.get("hold_durations"))
        (out_dir / f"{name}.request.json").write_text(json.dumps(request), encoding="utf-8")
        (out_dir / f"{name}.response.json").write_text(json.dumps(result.to_dict(), indent=2), encoding="utf-8")
        print(f"{name:20s} -> {result.status} {result.behavioral_risk_score} {result.risk_category}")


if __name__ == "__main__":
    main()
