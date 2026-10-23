"""Browser SDK: self-test plus a round-trip proving it emits what the model was trained on.

These tests drive a real headless Chromium-family browser (Edge or Chrome). They are skipped
automatically when none is installed.
"""

import html
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import pytest

from agent4.simulation import PROFILES, generate_session_timings

ROOT = Path(__file__).resolve().parents[1]
SDK = ROOT / "frontend" / "biometrics.js"
SELF_TEST = ROOT / "frontend" / "tests" / "sdk_test.html"


def _find_browser():
    names = ["msedge", "microsoft-edge", "google-chrome", "chromium", "chromium-browser", "chrome"]
    for n in names:
        found = shutil.which(n)
        if found:
            return found
    for base in filter(None, [os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles")]):
        for rel in ("Microsoft/Edge/Application/msedge.exe", "Google/Chrome/Application/chrome.exe"):
            p = Path(base) / rel
            if p.exists():
                return str(p)
    mac = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    return str(mac) if mac.exists() else None


BROWSER = _find_browser()
pytestmark = pytest.mark.skipif(BROWSER is None, reason="no headless browser available")


def _dump_result(page: Path) -> str:
    """Load ``page`` in a headless browser and return the text of its <pre id="out"> element."""
    if os.name == "nt":
        # On Windows a directly launched Edge/Chrome returns before writing its DOM dump; the
        # PowerShell runner (Start-Process -Wait) is the reliable way to drive it.
        runner = ROOT / "frontend" / "tests" / "run_sdk_tests.ps1"
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(runner), "-Page", str(page), "-Raw"],
            capture_output=True, timeout=180,
        )
        assert proc.returncode == 0, proc.stderr.decode(errors="replace")[:400]
        return proc.stdout.decode("utf-8", errors="replace")
    profile = tempfile.mkdtemp(prefix="agent4-sdk-")
    try:
        proc = subprocess.run(
            [BROWSER, "--headless", "--disable-gpu", "--no-sandbox", f"--user-data-dir={profile}",
             "--virtual-time-budget=8000", "--dump-dom", page.as_uri()],
            capture_output=True, timeout=120,
        )
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    match = re.search(r'<pre id="out">(.*?)</pre>', proc.stdout.decode("utf-8", errors="replace"), re.S)
    assert match, "the test page produced no result block"
    return html.unescape(match.group(1))


def test_sdk_self_test_passes_in_a_real_browser():
    report = _dump_result(SELF_TEST)
    assert "ALL PASSED" in report, report


def test_sdk_output_is_exactly_what_the_model_was_trained_on(shipped_scorer, tmp_path):
    """Replay simulator sessions through the real JS collector, then score what it produced."""
    rng = np.random.default_rng(99)
    sessions = []
    for cls in ("HUMAN_LIKE", "FAST_HUMAN_LIKE", "REGULAR_AUTOMATION", "ADAPTIVE_AUTOMATION"):
        f, h = generate_session_timings(rng, PROFILES[cls], 120)
        sessions.append({"cls": cls, "flights": f.tolist(), "holds": h.tolist()})

    page = tmp_path / "replay.html"
    page.write_text(f"""<!doctype html><meta charset="utf-8"><body><input id="t" type="text"><pre id="out">running</pre>
<script src="{SDK.as_uri()}"></script>
<script>
var sessions = {json.dumps(sessions)};
var clock = 0;
function fire(type, t) {{ clock = t; document.getElementById("t").dispatchEvent(new KeyboardEvent(type, {{bubbles: true}})); }}
var results = sessions.map(function (s) {{
  var c = Agent4Biometrics.createCollector({{sessionId: "replay", now: function () {{ return clock; }}, minEvents: 1}});
  c.start();
  clock = 0; document.getElementById("t").dispatchEvent(new FocusEvent("focusin", {{bubbles: true}}));
  var prevUp = 0;
  for (var i = 0; i < s.flights.length; i++) {{
    var down = prevUp + s.flights[i], up = down + s.holds[i];
    fire("keydown", down); fire("keyup", up); prevUp = up;
  }}
  var p = c.getPayload(); c.stop(); return p;
}});
document.getElementById("out").textContent = JSON.stringify(results);
</script>""", encoding="utf-8")

    produced = json.loads(_dump_result(page))
    for session, payload in zip(sessions, produced):
        assert np.allclose(payload["intervals"], session["flights"], atol=0.051), session["cls"]
        assert np.allclose(payload["hold_durations"], session["holds"], atol=0.051), session["cls"]
        direct = shipped_scorer.score("x", session["flights"], session["holds"])
        via_sdk = shipped_scorer.score("x", payload["intervals"], payload["hold_durations"])
        assert via_sdk.behavioral_risk_score == pytest.approx(direct.behavioral_risk_score, abs=0.5), session["cls"]
        assert via_sdk.behavioral_anomaly == direct.behavioral_anomaly
