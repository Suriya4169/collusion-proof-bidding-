"""Keep numbers in the documentation equal to ``reports/metrics.json``.

In a Markdown file, wrap a number like this:

    <!--m:full.human_test.overall.rate pct1-->4.6%<!--/m-->

The comments are invisible when rendered. ``python -m agent4 sync-docs`` rewrites the text
between the markers from the metrics file, and ``tests/test_docs.py`` fails if any marker is
out of date, so a retrain can never leave stale figures in the README or the model card.

If ``metrics_iforest.json`` (written by ``python -m agent4 compare-detectors``) sits next to the metrics file, its
contents are available to markers under the ``detector_comparison.`` prefix. It is merged in memory only; the
metrics file itself is never modified.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

MARKER = re.compile(r"<!--m:(?P<path>[\w.\[\]-]+) (?P<fmt>\w+)-->(?P<value>.*?)<!--/m-->", re.S)


def load_metrics(metrics_path: Path) -> Dict[str, object]:
    """The metrics file, plus the detector comparison under ``detector_comparison`` when it exists."""
    metrics_path = Path(metrics_path)
    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
    comparison = metrics_path.with_name("metrics_iforest.json")
    if comparison.exists():
        metrics["detector_comparison"] = json.loads(comparison.read_text(encoding="utf-8"))
    return metrics


def lookup(metrics: Dict[str, object], path: str):
    node = metrics
    for part in path.split("."):
        node = node[int(part)] if isinstance(node, list) else node[part]
    return node


def render(value, fmt: str) -> str:
    if fmt == "pct1":
        return f"{value * 100:.1f}%"
    if fmt == "pct0":
        return f"{value * 100:.0f}%"
    if fmt == "f3":
        return f"{value:.3f}"
    if fmt == "int":
        return f"{int(value):,}"
    if fmt == "str":
        return str(value)
    raise ValueError(f"Unknown number format {fmt!r}")


def sync_text(text: str, metrics: Dict[str, object]) -> str:
    def replace(match: re.Match) -> str:
        value = render(lookup(metrics, match["path"]), match["fmt"])
        return f"<!--m:{match['path']} {match['fmt']}-->{value}<!--/m-->"

    return MARKER.sub(replace, text)


def stale_markers(text: str, metrics: Dict[str, object]) -> List[Tuple[str, str, str]]:
    """Return (path, found, expected) for every marker whose text differs from the metrics."""
    out = []
    for m in MARKER.finditer(text):
        expected = render(lookup(metrics, m["path"]), m["fmt"])
        if m["value"] != expected:
            out.append((m["path"], m["value"], expected))
    return out


def doc_files(root: Path) -> Iterable[Path]:
    files = [root / "README.md"]
    files += sorted((root / "docs").glob("*.md"))
    return [f for f in files if f.exists()]


def sync_docs(root: Path, metrics_path: Path) -> List[Path]:
    metrics = load_metrics(metrics_path)
    changed = []
    for f in doc_files(root):
        old = f.read_text(encoding="utf-8")
        new = sync_text(old, metrics)
        if new != old:
            f.write_text(new, encoding="utf-8")
            changed.append(f)
    return changed
