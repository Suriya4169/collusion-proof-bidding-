"""The simulator: reproducibility, split hygiene (no leakage), privacy and plausibility."""

import numpy as np
import pytest

from agent4.simulation import (
    ATTACK_CLASSES,
    NORMAL_CLASSES,
    PROFILES,
    RAW_COLUMNS,
    STRESS_ATTACK_CLASSES,
    GenerationConfig,
    SPLIT_CALIBRATION,
    SPLIT_STRESS,
    SPLIT_TEST,
    SPLIT_TRAIN,
    generate_dataset,
    load_sessions,
    save_sessions,
)

CFG = GenerationConfig(seed=3, sessions_per_class=200, stress_sessions_per_class=100)


@pytest.fixture(scope="module")
def dataset():
    return generate_dataset(CFG)


def test_generation_is_reproducible_and_seed_sensitive(dataset):
    again = generate_dataset(CFG)
    assert all(np.array_equal(a.flights, b.flights) and np.array_equal(a.holds, b.holds)
               for a, b in zip(dataset, again))
    other = generate_dataset(GenerationConfig(seed=4, sessions_per_class=200, stress_sessions_per_class=100))
    assert not np.array_equal(dataset[0].flights, other[0].flights)


def test_class_counts(dataset):
    counts = {c: sum(s.behavior_type == c for s in dataset) for c in PROFILES}
    assert all(counts[c] == 200 for c in NORMAL_CLASSES + ATTACK_CLASSES)
    assert all(counts[c] == 100 for c in STRESS_ATTACK_CLASSES)


def test_automation_never_appears_in_training_or_calibration(dataset):
    """The core leakage guard: only genuine humans may be used to fit or calibrate."""
    for s in dataset:
        if s.behavior_type in NORMAL_CLASSES:
            assert s.split in (SPLIT_TRAIN, SPLIT_CALIBRATION, SPLIT_TEST)
        elif s.behavior_type in ATTACK_CLASSES:
            assert s.split == SPLIT_TEST
        else:
            assert s.split == SPLIT_STRESS


def test_human_split_proportions_and_disjointness(dataset):
    for cls in NORMAL_CLASSES:
        splits = [s.split for s in dataset if s.behavior_type == cls]
        assert splits.count(SPLIT_TRAIN) == 120 and splits.count(SPLIT_CALIBRATION) == 50 and splits.count(SPLIT_TEST) == 30
    ids = [s.session_id for s in dataset]
    assert len(ids) == len(set(ids))


def test_session_lengths_cover_the_configured_range(dataset):
    n = np.array([s.n_events for s in dataset])
    assert n.min() >= CFG.min_events and n.max() <= CFG.max_events
    assert (n < 30).mean() > 0.15 and (n >= 100).mean() > 0.15   # both short and long sessions are common


def test_timings_are_physically_plausible(dataset):
    for s in dataset:
        assert np.all(s.holds > 0) and np.all(s.flights >= 0)
        assert np.all(np.isfinite(s.holds)) and np.all(np.isfinite(s.flights))
        assert len(s.holds) == len(s.flights)


def test_class_profiles_have_their_defining_characteristics(dataset):
    def cv(name):
        return np.median([np.std(s.flights[1:]) / np.mean(s.flights[1:]) for s in dataset if s.behavior_type == name])
    assert cv("REGULAR_AUTOMATION") < 0.1 < cv("HUMAN_LIKE")
    fast = np.median([np.median(s.flights[1:]) for s in dataset if s.behavior_type == "FAST_HUMAN_LIKE"])
    slow = np.median([np.median(s.flights[1:]) for s in dataset if s.behavior_type == "SLOW_HUMAN_LIKE"])
    assert fast < slow


def test_raw_file_is_timing_only_and_round_trips(tmp_path, dataset):
    small = dataset[:5] + dataset[-5:]
    path = save_sessions(small, tmp_path / "events.csv.gz")
    import pandas as pd
    frame = pd.read_csv(path)
    assert list(frame.columns) == RAW_COLUMNS
    forbidden = ("key", "char", "text", "user", "email", "ip", "content", "password")
    assert not any(any(w in c.lower() for w in forbidden) for c in frame.columns)
    back = load_sessions(path)
    assert [s.session_id for s in back] == [s.session_id for s in small]
    assert all(np.allclose(a.flights, b.flights) and np.allclose(a.holds, b.holds) for a, b in zip(small, back))
