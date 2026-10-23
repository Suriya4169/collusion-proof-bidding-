"""Documentation checks: numbers, links, paths, commands and settings must match the code."""

import json
import re
from pathlib import Path

import pytest

from agent4.cli import build_parser
from agent4.docsync import MARKER, doc_files, stale_markers
from agent4.evidence import describe_feature
from agent4.features import FEATURES_BY_MODE

ROOT = Path(__file__).resolve().parents[1]
METRICS = ROOT / "reports" / "metrics.json"
DOCS = list(doc_files(ROOT))


@pytest.fixture(scope="module")
def metrics():
    if not METRICS.exists():
        pytest.skip("run `python -m agent4 all` first")
    return json.loads(METRICS.read_text(encoding="utf-8"))


@pytest.mark.parametrize("doc", DOCS, ids=lambda p: p.name)
def test_every_quoted_number_matches_metrics_json(doc, metrics):
    stale = stale_markers(doc.read_text(encoding="utf-8"), metrics)
    assert not stale, f"{doc.name} is out of date ({stale[:3]}); run `python -m agent4 sync-docs`."


def test_readme_and_model_card_actually_use_the_markers():
    for name in ("README.md", "docs/model_card.md"):
        assert len(MARKER.findall((ROOT / name).read_text(encoding="utf-8"))) >= 8, name


@pytest.mark.parametrize("doc", DOCS, ids=lambda p: p.name)
def test_relative_markdown_links_resolve(doc):
    text = doc.read_text(encoding="utf-8")
    for target in re.findall(r"\]\((?!https?://|#|mailto:)([^)\s]+)\)", text):
        assert (doc.parent / target.split("#")[0]).exists(), f"{doc.name}: broken link {target}"


@pytest.mark.parametrize("doc", DOCS, ids=lambda p: p.name)
def test_repository_paths_mentioned_in_the_docs_exist(doc):
    text = doc.read_text(encoding="utf-8")
    pattern = r"`((?:docs|reports|frontend|scripts|agent4|models|tests|data|demo)/[\w./-]+\.\w+)`"
    version_1_only = {"models/isolation_forest_baseline.joblib"}   # named in the v1 -> v2 mapping table
    for path in re.findall(pattern, text):
        if "*" in path or (doc.name == "CHANGES_FROM_V1.md" and path in version_1_only):
            continue
        assert (ROOT / path).exists(), f"{doc.name} mentions missing file {path}"


@pytest.mark.parametrize("doc", DOCS, ids=lambda p: p.name)
def test_cli_commands_in_the_docs_exist(doc):
    parser = build_parser()
    commands = set(parser._subparsers._group_actions[0].choices)
    for cmd in re.findall(r"python -m agent4 ([a-z][a-z-]*)", doc.read_text(encoding="utf-8")):
        assert cmd in commands, f"{doc.name} mentions unknown command {cmd!r}"


def test_every_setting_is_documented_in_the_deployment_guide_and_env_example():
    source = (ROOT / "agent4" / "config.py").read_text(encoding="utf-8")
    variables = set(re.findall(r'"(AGENT4_[A-Z_]+)"', source))
    assert variables, "no settings found"
    guide = (ROOT / "docs" / "deployment_guide.md").read_text(encoding="utf-8")
    example = (ROOT / ".env.example").read_text(encoding="utf-8")
    for name in sorted(variables):
        assert name in guide, f"{name} missing from docs/deployment_guide.md"
        assert name in example, f"{name} missing from .env.example"


def test_every_evidence_descriptor_the_model_can_emit_is_documented():
    guide = (ROOT / "docs" / "integration_guide.md").read_text(encoding="utf-8")
    emitted = set()
    for names in FEATURES_BY_MODE.values():
        for feature in names:
            for z in (-5.0, 5.0):
                descriptor = describe_feature(feature, z)
                generic_fallback = f"atypical_{feature}_{'high' if z > 0 else 'low'}"
                assert descriptor and descriptor != generic_fallback, f"no named descriptor for {feature} (z={z})"
                emitted.add(descriptor)
    emitted |= {"typical_human_timing", "unusual_combination_of_timing_features"}
    missing = sorted(d for d in emitted if f"`{d}`" not in guide and d not in guide)
    assert not missing, f"undocumented evidence descriptors: {missing}"


def test_the_documented_response_fields_match_the_schema():
    from agent4.service import BehaviorResponse
    guide = (ROOT / "docs" / "integration_guide.md").read_text(encoding="utf-8")
    for field in BehaviorResponse.model_fields:
        assert f"`{field}`" in guide, f"response field {field} is not documented"
