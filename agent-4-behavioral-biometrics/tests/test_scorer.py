"""The scorer: behaviour, training/serving parity and acceptance checks on the shipped model."""

import numpy as np
import pytest

from agent4.artifacts import load_models
from agent4.dataset import build_table
from agent4.evaluation import risk_scores
from agent4.features import TimingValidationError
from agent4.scorer import STATUS_INSUFFICIENT, STATUS_SCORED, BehaviorScorer
from agent4.simulation import GenerationConfig, generate_dataset

from conftest import make_session


def test_a_short_session_is_reported_as_insufficient_not_scored(shipped_scorer):
    f, h = make_session("HUMAN_LIKE", 6)
    r = shipped_scorer.score("s", f.tolist(), h.tolist())
    assert r.status == STATUS_INSUFFICIENT and r.behavioral_risk_score is None
    assert r.events_received == 6 and r.events_scored == 0 and "needed" in r.message


def test_mode_follows_the_presence_of_hold_durations(shipped_scorer):
    f, h = make_session("HUMAN_LIKE", 80)
    assert shipped_scorer.score("s", f.tolist(), h.tolist()).scoring_mode == "full"
    assert shipped_scorer.score("s", f.tolist()).scoring_mode == "flight_only"


def test_very_long_sessions_are_scored_on_the_most_recent_window(shipped_scorer):
    f, h = make_session("HUMAN_LIKE", 300, seed=9)
    long_f, long_h = np.concatenate([f, f, f, f]), np.concatenate([h, h, h, h])
    r = shipped_scorer.score("s", long_f.tolist(), long_h.tolist())
    assert r.events_received == 1200 and r.events_scored == 300
    same_window = shipped_scorer.score("s", long_f[-300:].tolist(), long_h[-300:].tolist())
    assert r.behavioral_risk_score == same_window.behavioral_risk_score


def test_result_fields_are_consistent(shipped_scorer):
    for cls in ("HUMAN_LIKE", "REGULAR_AUTOMATION", "ADAPTIVE_AUTOMATION"):
        f, h = make_session(cls, 120, seed=3)
        r = shipped_scorer.score("s", f.tolist(), h.tolist())
        assert r.status == STATUS_SCORED
        assert 0.0 <= r.behavioral_risk_score <= 100.0
        assert r.behavioral_anomaly == (r.behavioral_risk_score >= 50.0)
        assert (r.risk_category == "LOW_ANOMALY") == (r.behavioral_risk_score < 50.0)
        assert r.behavioral_evidence and len(r.top_deviations) == 3
        assert r.reliability == "high"


def test_scoring_is_deterministic_and_does_not_mutate_input(shipped_scorer):
    f, h = make_session("FAST_HUMAN_LIKE", 90, seed=4)
    fl, hl = f.tolist(), h.tolist()
    a = shipped_scorer.score("s", fl, hl).to_dict()
    b = shipped_scorer.score("s", fl, hl).to_dict()
    assert a == b and fl == f.tolist() and hl == h.tolist()


def test_typical_humans_get_a_plain_evidence_tag_and_bots_get_specific_ones(shipped_scorer):
    hum = shipped_scorer.score("s", *[x.tolist() for x in make_session("HUMAN_LIKE", 150, 1)])
    bot = shipped_scorer.score("s", *[x.tolist() for x in make_session("REGULAR_AUTOMATION", 150, 1)])
    assert hum.behavioral_evidence == ["typical_human_timing"]
    assert bot.behavioral_anomaly and "typical_human_timing" not in bot.behavioral_evidence
    assert any("regular" in e for e in bot.behavioral_evidence)


def test_malformed_timing_raises(shipped_scorer):
    with pytest.raises(TimingValidationError):
        shipped_scorer.score("s", [100.0] * 9 + [-5.0])


def test_min_events_override_cannot_go_below_the_trained_range(small_run):
    loaded = load_models(small_run["paths"].model_dir)
    with pytest.raises(ValueError, match="below"):
        BehaviorScorer(loaded, min_events_override=3)
    stricter = BehaviorScorer(loaded, min_events_override=40)
    f, h = make_session("HUMAN_LIKE", 25)
    assert stricter.score("s", f.tolist(), h.tolist()).status == STATUS_INSUFFICIENT


def test_serving_path_matches_the_vectorised_evaluation_path(shipped_scorer):
    """No training/serving skew: replaying sessions one by one reproduces the batch risk scores."""
    cfg = GenerationConfig(seed=77, sessions_per_class=40, stress_sessions_per_class=20)
    sessions = generate_dataset(cfg)
    table = build_table(sessions, "full")
    bundle = shipped_scorer.models.bundles["full"]
    _, batch_risk = risk_scores(table, bundle)
    rng = np.random.default_rng(0)
    for i in rng.choice(len(sessions), 120, replace=False):
        s = sessions[i]
        r = shipped_scorer.score(s.session_id, s.flights.tolist(), s.holds.tolist())
        assert r.behavioral_risk_score == pytest.approx(batch_risk[i], abs=0.011), s.session_id


# ---------------------------------------------------------------- acceptance on fresh data


@pytest.fixture(scope="module")
def fresh_scored(shipped_scorer):
    """Sessions from a seed nobody trained, selected or calibrated on."""
    cfg = GenerationConfig(seed=2024, sessions_per_class=500, stress_sessions_per_class=200)
    sessions = generate_dataset(cfg)
    table = build_table(sessions, "full")
    _, risk = risk_scores(table, shipped_scorer.models.bundles["full"])
    return table, risk


def test_acceptance_genuine_humans_are_rarely_flagged(fresh_scored):
    table, risk = fresh_scored
    humans = table.is_human
    assert np.mean(risk[humans] >= 50) < 0.075           # target 5%
    assert np.mean(risk[humans] >= 75) < 0.025           # target 1%


def test_acceptance_scripted_and_burst_automation_is_always_caught(fresh_scored):
    table, risk = fresh_scored
    for cls in ("REGULAR_AUTOMATION", "BURST_AUTOMATION"):
        assert np.mean(risk[table.behavior == cls] >= 50) > 0.995, cls


def test_acceptance_adaptive_bot_detection_grows_with_evidence(fresh_scored):
    table, risk = fresh_scored
    adaptive = table.behavior == "ADAPTIVE_AUTOMATION"
    long = adaptive & (table.n_events >= 150)
    short = adaptive & (table.n_events < 25)
    assert np.mean(risk[long] >= 50) > 0.85
    assert np.mean(risk[long] >= 50) > np.mean(risk[short] >= 50) + 0.4
