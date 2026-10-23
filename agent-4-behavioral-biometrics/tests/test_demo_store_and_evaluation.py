"""The platform-side store and the evaluation rules."""

import json

import pytest

from demo.evaluation import (
    DETECT_MIN_LOWER, FAIL, HUMAN_FAIL_LOWER, HUMAN_PASS_UPPER, INCONCLUSIVE, INFO, PASS, PENDING,
    evaluate, judge, reference_rate, summarize, wilson,
)
from demo.automation.scenarios import (
    KIND_DETECT, KIND_INFORMATIONAL, KIND_NO_VERDICT, KIND_PASS_HUMANS, SCENARIOS,
)
from demo.store import (
    OUTCOME_ERROR, OUTCOME_INSUFFICIENT, OUTCOME_NO_DATA, OUTCOME_SCORED, OUTCOME_TYPING, SessionStore,
    load_manual_recordings, read_persisted,
)


def answer(risk=30.0, events=40, status="scored"):
    scored = status == "scored"
    return {
        "session_id": "x", "status": status, "scoring_mode": "full",
        "behavioral_risk_score": risk if scored else None,
        "risk_category": ("HIGH_ANOMALY" if risk >= 75 else "MODERATE_ANOMALY" if risk >= 50 else "LOW_ANOMALY") if scored else None,
        "behavioral_anomaly": risk >= 50 if scored else None, "reliability": "medium" if scored else None,
        "events_received": events, "events_scored": events if scored else 0, "behavioral_evidence": ["typical_human_timing"],
        "top_deviations": [], "model_version": "t", "message": None if scored else "too short",
    }


TIMING = {"intervals": [500.0] + [120.0] * 39, "hold_durations": [80.0] * 40}


# ---------------------------------------------------------------- store


def test_session_lifecycle_and_outcomes():
    store = SessionStore()
    assert store.get("a") is None
    store.record_behavior("a", answer(), 200, 3.2, TIMING)
    assert store.get("a").outcome == OUTCOME_TYPING                     # no bid yet
    store.submit_bid("a")
    rec = store.get("a")
    assert rec.outcome == OUTCOME_SCORED and rec.bid_reference == "PIP-DEMO-00001" and rec.public()["flagged"] is False

    store.submit_bid("b")                                              # a bid with no timing at all
    assert store.get("b").outcome == OUTCOME_NO_DATA

    store.record_behavior("c", answer(status="insufficient_data", events=7), 200, 1.0, None)
    store.submit_bid("c")
    assert store.get("c").outcome == OUTCOME_INSUFFICIENT

    store.record_behavior("d", None, 502, 5.0, None)
    store.submit_bid("d")
    assert store.get("d").outcome == OUTCOME_ERROR


def test_resubmitting_a_bid_does_not_issue_a_second_reference():
    store = SessionStore()
    first = store.submit_bid("a").bid_reference
    assert store.submit_bid("a").bid_reference == first


def test_a_late_shorter_preview_never_replaces_the_fuller_answer():
    store = SessionStore()
    store.record_behavior("a", answer(risk=20, events=80), 200, 1.0, TIMING)
    store.record_behavior("a", answer(risk=90, events=30), 200, 1.0, TIMING)
    assert store.get("a").behavior["events_received"] == 80
    store.record_behavior("a", answer(risk=25, events=90), 200, 1.0, TIMING)
    assert store.get("a").behavior["events_received"] == 90
    store.record_behavior("a", None, 502, 1.0, None)                    # a later failure keeps the good answer
    assert store.get("a").behavior["events_received"] == 90 and store.get("a").agent4_http_status == 200


def test_truth_is_kept_on_the_platform_side_only():
    store = SessionStore()
    store.set_truth("a", "bot", "pw_instant", "Playwright")
    pub = store.get("a").public()
    assert pub["truth"] == "bot" and pub["scenario"] == "pw_instant"
    assert "timing" not in pub                                          # the public view never carries the timing arrays


def test_changed_since_returns_only_newer_records_in_order():
    store = SessionStore()
    store.set_truth("a", "human", None, None)
    mark = store.seq
    store.set_truth("b", "bot", None, None)
    store.record_behavior("a", answer(), 200, 1.0, TIMING)
    rows = store.changed_since(mark)
    assert [r["session_id"] for r in rows] == ["b", "a"] and rows[0]["seq"] < rows[1]["seq"]
    assert store.changed_since(store.seq) == []


def test_oldest_sessions_are_evicted_and_reset_clears_everything():
    store = SessionStore(max_sessions=3)
    for i in range(5):
        store.submit_bid(f"s{i}")
    assert [r["session_id"] for r in store.all_public()] == ["s2", "s3", "s4"]
    store.reset()
    assert store.all_public() == [] and store.seq == 0


def test_persistence_round_trip_and_tolerates_a_torn_last_line(tmp_path):
    path = tmp_path / "s.jsonl"
    store = SessionStore(path)
    store.record_behavior("a", answer(), 200, 2.0, TIMING)
    store.submit_bid("a")
    store.set_truth("b", "bot", "pw_instant", "t")                      # labels alone are not persisted until a bid
    with path.open("a", encoding="utf-8") as fh:
        fh.write('{"session_id": "torn", "bid_subm')                   # a crash mid-write
    reloaded = SessionStore(path)
    assert reloaded.get("a").outcome == OUTCOME_SCORED and reloaded.get("a").bid_reference == "PIP-DEMO-00001"
    assert reloaded.get("torn") is None
    assert reloaded.submit_bid("z").bid_reference == "PIP-DEMO-00002"   # numbering continues
    assert list(read_persisted(path))[0] == "a"


def test_only_unlabelled_hand_typed_sessions_with_full_timing_are_replay_sources(tmp_path):
    path = tmp_path / "s.jsonl"
    store = SessionStore(path)
    store.record_behavior("human", answer(), 200, 1.0, TIMING)
    store.submit_bid("human")
    store.set_truth("bot", "bot", "pw_instant", "t")
    store.record_behavior("bot", answer(), 200, 1.0, TIMING)
    store.submit_bid("bot")
    short = {"intervals": [500.0] * 10, "hold_durations": [80.0] * 10}
    store.record_behavior("short", answer(events=10), 200, 1.0, short)
    store.submit_bid("short")
    flight_only = {"intervals": [500.0] * 40, "hold_durations": []}
    store.record_behavior("flightonly", answer(), 200, 1.0, flight_only)
    store.submit_bid("flightonly")
    assert store.manual_recording_count() == 1
    recordings = load_manual_recordings(path)
    assert len(recordings) == 1 and recordings[0]["hold_durations"] == TIMING["hold_durations"]
    assert load_manual_recordings(tmp_path / "missing.jsonl") == []


def test_persisted_file_holds_timing_numbers_only(tmp_path):
    path = tmp_path / "s.jsonl"
    store = SessionStore(path)
    store.record_behavior("a", answer(), 200, 1.0, TIMING)
    store.submit_bid("a")
    row = json.loads(path.read_text(encoding="utf-8").splitlines()[-1])
    assert set(row["timing"]) == {"intervals", "hold_durations"}
    assert all(isinstance(x, float) for x in row["timing"]["intervals"] + row["timing"]["hold_durations"])


# ---------------------------------------------------------------- evaluation


def test_wilson_interval_matches_known_values():
    lo, hi = wilson(0, 0)
    assert (lo, hi) == (0.0, 1.0)
    lo, hi = wilson(40, 40)
    assert hi == pytest.approx(1.0) and lo == pytest.approx(0.912, abs=0.002)
    lo, hi = wilson(5, 100)
    assert (lo, hi) == pytest.approx((0.0215, 0.1118), abs=0.002)


def _summary(flagged, n, no_data=0):
    rows = [{"outcome": OUTCOME_SCORED, "flagged": i < flagged, "high": False, "risk": 80.0 if i < flagged else 20.0,
             "events": 50, "agent4_latency_ms": 3.0} for i in range(n - no_data)]
    rows += [{"outcome": OUTCOME_NO_DATA, "flagged": None, "high": None, "risk": None, "events": None, "agent4_latency_ms": None}] * no_data
    return summarize(rows)


def test_detection_verdict_needs_enough_visits():
    assert judge(KIND_DETECT, _summary(40, 40))[0] == PASS
    assert judge(KIND_DETECT, _summary(5, 5))[0] == INCONCLUSIVE        # perfect, but too few visits to show 90%
    assert judge(KIND_DETECT, _summary(37, 40))[0] == INCONCLUSIVE
    assert judge(KIND_DETECT, _summary(20, 40))[0] == FAIL
    assert judge(KIND_DETECT, _summary(0, 0))[0] == PENDING
    assert DETECT_MIN_LOWER == 0.90


def test_false_alarm_verdict_needs_enough_visits_too():
    assert judge(KIND_PASS_HUMANS, _summary(3, 60))[0] == PASS
    assert judge(KIND_PASS_HUMANS, _summary(0, 5))[0] == INCONCLUSIVE   # nothing flagged, but 5 visits prove little
    assert judge(KIND_PASS_HUMANS, _summary(20, 60))[0] == FAIL
    assert HUMAN_FAIL_LOWER < HUMAN_PASS_UPPER


def test_unscored_bids_count_as_not_flagged_and_are_reported_separately():
    s = _summary(0, 10, no_data=10)
    assert s["flagged"] == 0 and s["no_data"] == 10 and s["flagged_or_no_data_rate"]["rate"] == 1.0
    assert judge(KIND_NO_VERDICT, s)[0] == PASS
    assert judge(KIND_NO_VERDICT, _summary(0, 10))[0] == FAIL            # scored when it should not have been
    assert judge(KIND_INFORMATIONAL, _summary(4, 10))[0] == INFO


def test_summary_breaks_detection_down_by_session_length():
    rows = [{"outcome": OUTCOME_SCORED, "flagged": f, "high": False, "risk": 60.0 if f else 10.0, "events": e, "agent4_latency_ms": 1.0}
            for f, e in [(True, 15), (False, 20), (True, 50), (True, 60), (True, 150), (True, 200)]]
    by = summarize(rows)["by_length"]
    assert by["10-29"]["k"] == 1 and by["10-29"]["n"] == 2 and by["30-99"]["k"] == 2 and by["100+"]["k"] == 2


def _records():
    def rec(sid, scenario, truth, risk, events=60, outcome="scored", submitted=True):
        flagged = None if risk is None else risk >= 50
        return {"session_id": sid, "scenario": scenario, "truth": truth, "bid_submitted": submitted, "outcome": outcome,
                "risk": risk, "flagged": flagged, "high": None if risk is None else risk >= 75, "events": events,
                "agent4_latency_ms": 3.0}
    out = [rec(f"i{i}", "pw_instant", "bot", 100.0) for i in range(40)]
    out += [rec(f"h{i}", "sim_typical", "human", 80.0 if i < 2 else 20.0) for i in range(60)]
    out += [rec(f"f{i}", "pw_fill", "bot", None, events=None, outcome=OUTCOME_NO_DATA) for i in range(5)]
    out += [rec("v1", None, None, 30.0), rec("v2", None, None, 70.0), rec("typing", "pw_instant", "bot", 100.0, submitted=False)]
    out += [rec("x1", "inpage_instant", "bot", 100.0)]                  # a bot the registry does not know: still counted as a bot
    return out


def test_evaluate_groups_bots_humans_and_visitors_separately():
    ev = evaluate(_records(), {"full": {"human_test": {"by_style": {"HUMAN_LIKE": {"rate": 0.049}}},
                                        "attacks": {"REGULAR_AUTOMATION": {"overall": {"rate": 1.0}}}}})
    rows = {r["key"]: r for r in ev["scenarios"]}
    assert rows["pw_instant"]["summary"]["n"] == 40 and rows["pw_instant"]["status"] == PASS     # the unsubmitted one is ignored
    assert rows["sim_typical"]["status"] == PASS and rows["sim_typical"]["summary"]["flagged"] == 2
    assert rows["pw_fill"]["status"] == PASS and rows["pw_metronome"]["status"] == PENDING
    assert ev["bots"]["n"] == 40 + 5 + 1 and ev["simulated_humans"]["n"] == 60
    assert ev["real_visitors"]["n"] == 2 and ev["real_visitors"]["flagged"] == 1
    assert ev["sessions_evaluated"] == 40 + 60 + 5 + 2 + 1
    assert ev["status_counts"][PASS] == 3 and ev["expectations_met"] is True
    assert rows["sim_typical"]["synthetic_reference_rate"] == pytest.approx(0.049)
    assert rows["pw_instant"]["synthetic_reference_rate"] is None


def test_reference_rate_handles_missing_metrics():
    assert reference_rate(SCENARIOS["sim_typical"], None) is None
    assert reference_rate(SCENARIOS["sim_typical"], {"full": {}}) is None
    assert reference_rate(SCENARIOS["pw_instant"], {"full": {}}) is None
