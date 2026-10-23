"""Scenario planning (no browser): every bot and human proxy produces a sound, deterministic plan."""

import numpy as np
import pytest

from agent4.config import MAX_FLIGHT_CLIP_MS, MAX_HOLD_CLIP_MS
from agent4.simulation import PROFILES, generate_session_timings
from demo.automation.scenarios import (
    BOT_ONSET_MS, FIELDS, HUMAN_ONSET_MS, KIND_DETECT, KIND_INFORMATIONAL, KIND_KNOWN_LIMITATION,
    KIND_NO_VERDICT, KIND_PASS_HUMANS, LENGTH_CLASSES, MIN_FIELD_SWITCH_MS, SCENARIOS, build_action,
    draw_length, length_class_for, make_form_text, plan_from_timings,
)

ALLOWED = set("abcdefghijklmnopqrstuvwxyz0123456789 ")
RECORDING = {"intervals": [900.0] + [150.0] * 39, "hold_durations": [85.0] * 40}


def _action(key, n=60, seed=1):
    return build_action(SCENARIOS[key], np.random.default_rng(seed), n, RECORDING if SCENARIOS[key].needs_recording else None)


def test_registry_is_complete_and_every_expectation_is_declared():
    assert list(SCENARIOS) == ["pw_instant", "pw_fixed_delay", "pw_metronome", "pw_burst", "pw_jitter", "pw_mimic",
                               "pw_fill", "replay_human", "sim_typical", "sim_fast", "sim_slow"]
    kinds = {s.expectation.kind for s in SCENARIOS.values()}
    assert kinds == {KIND_DETECT, KIND_PASS_HUMANS, KIND_INFORMATIONAL, KIND_NO_VERDICT, KIND_KNOWN_LIMITATION}
    for s in SCENARIOS.values():
        assert s.truth in ("bot", "human") and s.title and s.description and s.expectation.statement and s.tool
    assert {s.truth for s in SCENARIOS.values() if s.key.startswith("sim_")} == {"human"}
    assert {s.truth for s in SCENARIOS.values() if not s.key.startswith("sim_")} == {"bot"}


@pytest.mark.parametrize("n", [10, 11, 12, 25, 60, 99, 150, 220, 300])
def test_form_text_has_exactly_the_requested_length_and_only_plain_characters(n):
    texts = make_form_text(np.random.default_rng(n), n)
    assert set(texts) == set(FIELDS)
    assert sum(len(t) for t in texts.values()) == n
    assert set("".join(texts.values())) <= ALLOWED
    assert texts["amount"].isdigit() and not texts["amount"].startswith("0")


def test_form_text_rejects_nonsense():
    with pytest.raises(ValueError):
        make_form_text(np.random.default_rng(0), 0)


@pytest.mark.parametrize("key", [k for k in SCENARIOS if k != "pw_fill"])
def test_every_scenario_plans_exactly_the_keystrokes_it_types(key):
    action = _action(key, n=60)
    typed = sum(len(t) for t in action.texts.values())
    assert action.planned_events == typed
    if action.mode == "keys":
        assert len(action.keys) == typed
        assert "".join(k.char for k in action.keys) == "".join(action.texts[f] for f in FIELDS)
    if action.mode == "chunks":
        assert "".join(piece for _, piece, _ in action.chunks) == "".join(action.texts[f] for f in FIELDS)


def test_programmatic_fill_has_no_keystrokes():
    action = _action("pw_fill")
    assert action.mode == "fill" and action.planned_events == 0 and action.texts["company"]


@pytest.mark.parametrize("key", ["pw_metronome", "pw_jitter", "pw_mimic", "replay_human", "sim_typical", "sim_fast", "sim_slow"])
def test_timed_plans_stay_inside_the_models_own_clips(key):
    keys = _action(key, n=120).keys
    for i, k in enumerate(keys):
        assert 0 < k.hold_ms <= MAX_HOLD_CLIP_MS
        assert 0 <= k.flight_ms <= MAX_FLIGHT_CLIP_MS
        if i and k.field != keys[i - 1].field:
            assert k.flight_ms >= MIN_FIELD_SWITCH_MS     # time to move focus between fields


def test_the_first_interval_is_a_short_onset_so_tests_do_not_wait_for_it():
    assert _action("sim_typical").keys[0].flight_ms == HUMAN_ONSET_MS
    assert _action("pw_metronome").keys[0].flight_ms == BOT_ONSET_MS


def test_simulated_humans_use_the_training_generator_timing_unchanged():
    rng = np.random.default_rng(5)
    flights, holds = generate_session_timings(rng, PROFILES["HUMAN_LIKE"], 80)
    action = _action("sim_typical", n=80, seed=5)
    assert [k.hold_ms for k in action.keys] == pytest.approx(np.minimum(holds, MAX_HOLD_CLIP_MS), abs=0.11)
    expected = np.minimum(flights[1:], MAX_FLIGHT_CLIP_MS)
    got = np.array([k.flight_ms for k in action.keys[1:]])
    same_field = np.array([action.keys[i].field == action.keys[i + 1].field for i in range(79)])
    assert got[same_field] == pytest.approx(expected[same_field], abs=0.11)


def test_metronome_is_perfectly_regular_and_instant_typing_has_no_delay():
    keys = _action("pw_metronome", n=50).keys
    assert {k.hold_ms for k in keys} == {60.0}
    assert {k.flight_ms for k in keys[1:] if k.flight_ms < MIN_FIELD_SWITCH_MS + 1 or k.flight_ms == 110.0} <= {110.0, MIN_FIELD_SWITCH_MS}
    assert _action("pw_instant").type_delay_ms == 0.0 and _action("pw_fixed_delay").type_delay_ms == 120.0


def test_burst_chunks_are_small_and_separated_by_pauses():
    chunks = _action("pw_burst", n=120).chunks
    assert all(1 <= len(piece) <= 14 for _, piece, _ in chunks)
    assert all(400.0 <= pause <= 850.0 for _, _, pause in chunks)


def test_plans_are_deterministic_per_seed_and_differ_across_seeds():
    a, b, c = _action("pw_jitter", seed=3), _action("pw_jitter", seed=3), _action("pw_jitter", seed=4)
    assert a.keys == b.keys and a.texts == b.texts
    assert a.keys != c.keys


def test_replay_uses_the_recorded_timing_and_needs_a_recording():
    action = _action("replay_human")
    assert [k.hold_ms for k in action.keys] == [85.0] * 40
    assert [k.flight_ms for k in action.keys[1:] if k.field == action.keys[0].field][:5] == [150.0] * 5
    with pytest.raises(ValueError):
        build_action(SCENARIOS["replay_human"], np.random.default_rng(0), 40, None)
    assert SCENARIOS["replay_human"].needs_recording and SCENARIOS["replay_human"].fixed_length


def test_plan_from_timings_checks_lengths():
    with pytest.raises(ValueError):
        plan_from_timings({"company": "abc", "amount": "", "justification": ""}, [1, 2], [1, 2, 3], 100.0)


def test_length_classes_cover_all_reliability_bands_and_cycle():
    assert [length_class_for(i) for i in range(6)] == ["short", "medium", "long"] * 2
    rng = np.random.default_rng(0)
    for name, (lo, hi) in LENGTH_CLASSES.items():
        assert lo >= 10                                      # always long enough to be scored
        assert all(lo <= draw_length(rng, name) <= hi for _ in range(50))


def test_human_scenarios_run_more_visits_to_show_a_low_false_alarm_rate():
    assert all(SCENARIOS[k].runs_factor > 1 for k in ("sim_typical", "sim_fast", "sim_slow"))
    assert all(SCENARIOS[k].runs_factor == 1 for k in SCENARIOS if not k.startswith("sim_"))
