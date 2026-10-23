"""Shared fixtures.

Two kinds of model are used on purpose:
* the *shipped* model in ``models/`` (tests that guard what actually gets deployed), and
* a *small* model trained from scratch in a temp folder (tests of the pipeline itself).
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agent4.config import DEFAULT_MODEL_DIR  # noqa: E402
from agent4.scorer import BehaviorScorer  # noqa: E402
from agent4.simulation import PROFILES, generate_session_timings  # noqa: E402


@pytest.fixture(scope="session")
def shipped_scorer() -> BehaviorScorer:
    if not (DEFAULT_MODEL_DIR / "manifest.json").exists():
        pytest.skip("No shipped model; run `python -m agent4 all` first.")
    return BehaviorScorer.from_dir(DEFAULT_MODEL_DIR)


@pytest.fixture(scope="session")
def small_run(tmp_path_factory):
    """A complete, small pipeline run (data -> selection -> training -> evaluation -> reports)."""
    from agent4.pipeline import Paths, run_pipeline

    base = tmp_path_factory.mktemp("small_run")
    paths = Paths(base / "data", base / "models", base / "reports")
    metrics = run_pipeline(paths, seed=11, sessions_per_class=500, selection_sessions_per_class=400,
                           save_raw=True, make_figures=True, verbose=False)
    return {"paths": paths, "metrics": metrics}


def make_session(behavior: str, n: int, seed: int = 0):
    rng = np.random.default_rng(seed)
    return generate_session_timings(rng, PROFILES[behavior], n)
