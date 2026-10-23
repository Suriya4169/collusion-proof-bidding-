"""Pipeline, CLI, retraining on real data, and the benchmark."""

import json

import pandas as pd
import pytest

from agent4.cli import build_parser, main
from agent4.retrain import MIN_SESSIONS, load_real_sessions, retrain_from_events
from agent4.simulation import NORMAL_CLASSES, GenerationConfig, generate_dataset


# ---------------------------------------------------------------- the pipeline (small run)


def test_pipeline_writes_every_artifact(small_run):
    paths = small_run["paths"]
    for rel in ("data/raw/keystroke_sessions.csv.gz", "data/processed/session_features.csv.gz",
                "reports/metrics.json", "reports/evaluation_report.md",
                "reports/model_selection_full.json", "reports/model_selection_flight_only.json"):
        assert (paths.data_dir.parent / rel).exists(), rel
    assert len(list((paths.report_dir / "figures").glob("*.png"))) == 6


def test_pipeline_metrics_are_sane_and_honest(small_run):
    m = small_run["metrics"]["full"]
    fpr = m["human_test"]["overall"]["rate"]
    assert 0.02 < fpr < 0.10                                 # out-of-sample, near the 5% target
    assert m["attacks"]["REGULAR_AUTOMATION"]["overall"]["rate"] > 0.98
    assert m["attacks"]["BURST_AUTOMATION"]["overall"]["rate"] > 0.98
    lo, hi = m["human_test"]["overall"]["ci95"]
    assert lo <= fpr <= hi
    assert set(small_run["metrics"]["leave_one_style_out"]) == set(NORMAL_CLASSES)


def test_the_selected_detector_is_recorded_and_exportable(small_run):
    assert small_run["metrics"]["selected_detector"]["full"].startswith("gaussian_mixture_k")


def test_report_numbers_come_from_the_metrics_file(small_run):
    text = (small_run["paths"].report_dir / "evaluation_report.md").read_text(encoding="utf-8")
    m = small_run["metrics"]["full"]
    assert f"{m['human_test']['overall']['rate'] * 100:.1f}%" in text
    assert "synthetic" in text.lower() and "Limitations" in text


# ---------------------------------------------------------------- CLI


def test_cli_parser_knows_every_command():
    parser = build_parser()
    for cmd in ("all", "serve", "score", "verify", "retrain", "export-openapi", "benchmark"):
        assert parser.parse_args([cmd] + (["x.json"] if cmd == "score" else ["--events", "e.csv"] if cmd == "retrain" else []))


def test_cli_score_and_verify(shipped_scorer, tmp_path, capsys):
    from agent4.config import DEFAULT_MODEL_DIR
    example = DEFAULT_MODEL_DIR.parent / "docs" / "examples" / "automation_full.request.json"
    assert main(["verify"]) == 0
    assert main(["score", str(example)]) == 0
    out = json.loads(capsys.readouterr().out.split("\n", 1)[1])
    assert out["status"] == "scored" and out["risk_category"] == "HIGH_ANOMALY"
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"intervals": [1, 2, 3]}))
    assert main(["score", str(bad)]) == 2


def test_cli_verify_fails_for_a_broken_model_dir(tmp_path):
    assert main(["verify", "--model-dir", str(tmp_path)]) == 1


def test_cli_export_openapi(tmp_path, shipped_scorer):
    out = tmp_path / "openapi.json"
    assert main(["export-openapi", "--out", str(out)]) == 0
    assert "/behavior/analyze" in json.loads(out.read_text())["paths"]


# ---------------------------------------------------------------- retraining on real sessions


@pytest.fixture(scope="module")
def real_events(tmp_path_factory):
    """Stand-in for a production export: genuine-human timing only, no labels."""
    cfg = GenerationConfig(seed=21, sessions_per_class=400, stress_sessions_per_class=10)
    sessions = [s for s in generate_dataset(cfg) if s.behavior_type in NORMAL_CLASSES]
    rows = []
    for s in sessions:
        for i in range(s.n_events):
            rows.append((s.session_id, i, s.holds[i], s.flights[i]))
    frame = pd.DataFrame(rows, columns=["session_id", "event_index", "hold_duration_ms", "flight_time_ms"])
    path = tmp_path_factory.mktemp("real") / "events.csv.gz"
    frame.to_csv(path, index=False)
    return path


def test_retrain_produces_a_loadable_calibrated_model(real_events, tmp_path):
    report = retrain_from_events(real_events, tmp_path / "m", verbose=False)
    assert report["sessions"] >= MIN_SESSIONS
    for mode in ("full", "flight_only"):
        assert 0.02 < report["modes"][mode]["test_flag_rate"] < 0.10
    from agent4.scorer import BehaviorScorer
    scorer = BehaviorScorer.from_dir(tmp_path / "m")
    from conftest import make_session
    f, h = make_session("REGULAR_AUTOMATION", 80)
    assert scorer.score("s", f.tolist(), h.tolist()).behavioral_anomaly is True


def test_retrain_rejects_files_with_content_columns(tmp_path):
    p = tmp_path / "bad.csv"
    pd.DataFrame({"session_id": ["a"], "event_index": [0], "hold_duration_ms": [80.0], "flight_time_ms": [100.0],
                  "key": ["a"]}).to_csv(p, index=False)
    with pytest.raises(ValueError, match="unexpected columns"):
        load_real_sessions(p)


def test_retrain_rejects_files_with_missing_columns_or_too_few_sessions(tmp_path, real_events):
    p = tmp_path / "missing.csv"
    pd.DataFrame({"session_id": ["a"], "event_index": [0]}).to_csv(p, index=False)
    with pytest.raises(ValueError, match="missing required columns"):
        load_real_sessions(p)
    frame = pd.read_csv(real_events)
    keep = frame["session_id"].unique()[:50]
    small = tmp_path / "small.csv"
    frame[frame["session_id"].isin(keep)].to_csv(small, index=False)
    with pytest.raises(ValueError, match="usable sessions"):
        retrain_from_events(small, tmp_path / "m2", verbose=False)


def test_retrain_skips_invalid_and_short_sessions(tmp_path):
    rows = [("ok", i, 80.0, 120.0) for i in range(30)]
    rows += [("short", i, 80.0, 120.0) for i in range(4)]
    rows += [("bad", i, 80.0, -5.0 if i == 3 else 120.0) for i in range(30)]
    p = tmp_path / "e.csv"
    pd.DataFrame(rows, columns=["session_id", "event_index", "hold_duration_ms", "flight_time_ms"]).to_csv(p, index=False)
    sessions, skipped = load_real_sessions(p)
    assert [s.session_id for s in sessions] == ["ok"] and skipped == {"too_short": 1, "invalid_timing": 1}


# ---------------------------------------------------------------- benchmark


def test_benchmark_computes_its_verdict_from_measurements(shipped_scorer, tmp_path):
    from agent4.benchmark import run_benchmark
    from agent4.config import DEFAULT_MODEL_DIR
    result = run_benchmark(DEFAULT_MODEL_DIR, tmp_path, iterations=30)
    text = (tmp_path / "latency_benchmark.md").read_text(encoding="utf-8")
    assert result["verdict"] in ("WITHIN", "OUTSIDE") and f"{result['worst_p95_ms']:.3f}" in text
    assert "in-process scoring" in text and "HTTP request via ASGI" in text
