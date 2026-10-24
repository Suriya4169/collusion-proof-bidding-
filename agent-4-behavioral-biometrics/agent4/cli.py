"""Command-line interface:  python -m agent4 <command>"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import List, Optional

from agent4.config import DEFAULT_DATA_DIR, DEFAULT_MODEL_DIR, DEFAULT_REPORT_DIR


def _cmd_all(args: argparse.Namespace) -> int:
    from agent4.pipeline import Paths, run_pipeline

    run_pipeline(
        Paths(Path(args.data_dir), Path(args.model_dir), Path(args.report_dir)),
        seed=args.seed,
        sessions_per_class=args.sessions_per_class,
        selection_sessions_per_class=args.selection_sessions_per_class,
        save_raw=not args.no_raw,
        make_figures=not args.no_figures,
    )
    return _cmd_sync_docs(args)


def _cmd_sync_docs(args: argparse.Namespace) -> int:
    from agent4.config import PROJECT_ROOT
    from agent4.docsync import sync_docs

    changed = sync_docs(PROJECT_ROOT, Path(args.report_dir) / "metrics.json")
    print("Updated: " + ", ".join(p.name for p in changed) if changed else "Documentation numbers already match metrics.json.")
    return 0


def _cmd_serve(args: argparse.Namespace) -> int:
    import os
    import uvicorn

    os.environ.setdefault("AGENT4_MODEL_DIR", str(args.model_dir))
    uvicorn.run("agent4.service:create_app", factory=True, host=args.host, port=args.port, workers=args.workers)
    return 0


def _cmd_score(args: argparse.Namespace) -> int:
    from agent4.features import TimingValidationError
    from agent4.scorer import BehaviorScorer

    payload = json.loads(Path(args.file).read_text(encoding="utf-8"))
    scorer = BehaviorScorer.from_dir(Path(args.model_dir))
    try:
        result = scorer.score(str(payload.get("session_id", "cli")), payload["intervals"], payload.get("hold_durations"))
    except TimingValidationError as exc:
        print(f"Invalid timing input: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result.to_dict(), indent=2))
    return 0


def _cmd_verify(args: argparse.Namespace) -> int:
    from agent4.artifacts import ModelIntegrityError, load_models

    try:
        loaded = load_models(Path(args.model_dir))
    except ModelIntegrityError as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1
    print(f"OK: model_version {loaded.model_version}; bundles verified against the manifest SHA-256.")
    return 0


def _cmd_retrain(args: argparse.Namespace) -> int:
    from agent4.retrain import retrain_from_events

    retrain_from_events(Path(args.events), Path(args.out), components=args.components, seed=args.seed)
    return 0


def _cmd_openapi(args: argparse.Namespace) -> int:
    from agent4.config import Settings
    from agent4.service import create_app

    app = create_app(Settings(model_dir=Path(args.model_dir)))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")
    print(f"Wrote {out}")
    return 0


def _cmd_compare_detectors(args: argparse.Namespace) -> int:
    from agent4.comparison import run_comparison, write_comparison_report
    from agent4.pipeline import Paths

    report_dir = Path(args.report_dir)
    if args.render_only:  # rewrite the report from the saved numbers, without retraining
        saved = json.loads((report_dir / "metrics_iforest.json").read_text(encoding="utf-8"))
        write_comparison_report(saved, report_dir / "detector_comparison.md")
        print(f"Rewrote {report_dir / 'detector_comparison.md'} from metrics_iforest.json")
        return 0
    result = run_comparison(Paths(DEFAULT_DATA_DIR, Path(args.model_dir), report_dir), seed=args.seed,
                            sessions_per_class=args.sessions_per_class, iforest_dir=Path(args.iforest_dir))
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "metrics_iforest.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    write_comparison_report(result, report_dir / "detector_comparison.md")
    print(f"Wrote {report_dir / 'detector_comparison.md'} and {report_dir / 'metrics_iforest.json'}")
    return 0


def _cmd_benchmark(args: argparse.Namespace) -> int:
    from agent4.benchmark import run_benchmark

    result = run_benchmark(Path(args.model_dir), Path(args.report_dir), iterations=args.iterations)
    print(f"Worst p95: {result['worst_p95_ms']:.3f} ms -> {result['verdict']} the 15 ms target")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="agent4", description="Agent 4: Behavioral Biometrics")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("all", help="Generate data, select the detector, train, evaluate and write all reports")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--sessions-per-class", type=int, default=6000)
    p.add_argument("--selection-sessions-per-class", type=int, default=3000)
    p.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    p.add_argument("--model-dir", default=str(DEFAULT_MODEL_DIR))
    p.add_argument("--report-dir", default=str(DEFAULT_REPORT_DIR))
    p.add_argument("--no-raw", action="store_true", help="Do not write the raw event CSV")
    p.add_argument("--no-figures", action="store_true")
    p.set_defaults(func=_cmd_all)

    p = sub.add_parser("compare-detectors", help="Train the Isolation Forest and compare it with the mixture on identical data")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--sessions-per-class", type=int, default=6000)
    p.add_argument("--model-dir", default=str(DEFAULT_MODEL_DIR), help="The shipped mixture bundle")
    p.add_argument("--iforest-dir", default=str(DEFAULT_MODEL_DIR.parent / "models_iforest"), help="Where the forest bundle is written")
    p.add_argument("--report-dir", default=str(DEFAULT_REPORT_DIR))
    p.add_argument("--render-only", action="store_true", help="Rewrite detector_comparison.md from the saved metrics_iforest.json")
    p.set_defaults(func=_cmd_compare_detectors)

    p = sub.add_parser("sync-docs", help="Refresh the numbers quoted in README/docs from reports/metrics.json")
    p.add_argument("--report-dir", default=str(DEFAULT_REPORT_DIR))
    p.set_defaults(func=_cmd_sync_docs)

    p = sub.add_parser("serve", help="Run the scoring API")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--workers", type=int, default=1)
    p.add_argument("--model-dir", default=str(DEFAULT_MODEL_DIR))
    p.set_defaults(func=_cmd_serve)

    p = sub.add_parser("score", help="Score one JSON payload from a file")
    p.add_argument("file")
    p.add_argument("--model-dir", default=str(DEFAULT_MODEL_DIR))
    p.set_defaults(func=_cmd_score)

    p = sub.add_parser("verify", help="Verify model artifacts against the manifest SHA-256")
    p.add_argument("--model-dir", default=str(DEFAULT_MODEL_DIR))
    p.set_defaults(func=_cmd_verify)

    p = sub.add_parser("retrain", help="Refit and recalibrate on real genuine-human sessions")
    p.add_argument("--events", required=True, help="CSV/CSV.GZ: session_id,event_index,hold_duration_ms,flight_time_ms")
    p.add_argument("--out", default=str(DEFAULT_MODEL_DIR))
    p.add_argument("--components", type=int, default=None, help="Mixture size (default: chosen by BIC)")
    p.add_argument("--seed", type=int, default=42)
    p.set_defaults(func=_cmd_retrain)

    p = sub.add_parser("export-openapi", help="Write the OpenAPI specification")
    p.add_argument("--out", default=str(DEFAULT_REPORT_DIR / "openapi.json"))
    p.add_argument("--model-dir", default=str(DEFAULT_MODEL_DIR))
    p.set_defaults(func=_cmd_openapi)

    p = sub.add_parser("benchmark", help="Measure scoring and HTTP latency")
    p.add_argument("--iterations", type=int, default=1000)
    p.add_argument("--model-dir", default=str(DEFAULT_MODEL_DIR))
    p.add_argument("--report-dir", default=str(DEFAULT_REPORT_DIR))
    p.set_defaults(func=_cmd_benchmark)
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
