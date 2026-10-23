"""Bot and human-proxy scenarios for the browser test-bench.

Pure planning, no browser: a scenario turns (random generator, number of keystrokes) into an
:class:`Action`, which the Playwright driver then carries out in a real browser.

Honesty about what each scenario is:

* ``pw_*`` scenarios are **real automation**: Playwright drives a real Edge and the timing the
  model sees is whatever that tool really produces in the browser.
* ``sim_*`` scenarios are **simulated humans**: timings drawn from the same generator that
  produced the training data, replayed through the browser. They check that the browser
  pipeline reproduces the timing faithfully and that the false-alarm rate holds there. They
  do not prove anything about real people (the model never saw one).
* ``replay_human`` replays a *real* person's recorded timing (only available once someone has
  typed on the portal); it is a documented blind spot of any timing-only detector.

Every expectation below was written before the first run and is not adjusted to the results.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np

from agent4.config import MAX_FLIGHT_CLIP_MS, MAX_HOLD_CLIP_MS
from agent4.simulation import PROFILES, generate_session_timings

FIELDS: Tuple[str, ...] = ("company", "amount", "justification")  # typing order in the portal form

# Session length classes (keystrokes), matching the model's reliability bands.
LENGTH_CLASSES: Dict[str, Tuple[int, int]] = {"short": (12, 29), "medium": (30, 99), "long": (100, 220)}

# The model discards the first interval (time from focus to the first key), so replaying a
# human's multi-second "reading the form" pause in full would only slow the test down.
HUMAN_ONSET_MS = 400.0
BOT_ONSET_MS = 60.0
# Moving to the next field takes at least this long (a keystroke plan cannot be faster than the focus call).
MIN_FIELD_SWITCH_MS = 40.0

KIND_DETECT = "detect"
KIND_PASS_HUMANS = "pass_humans"
KIND_INFORMATIONAL = "informational"
KIND_NO_VERDICT = "no_verdict"
KIND_KNOWN_LIMITATION = "known_limitation"


@dataclass(frozen=True)
class PlannedKey:
    field: str
    char: str
    flight_ms: float   # release of the previous key -> this key press (the first key: focus -> press)
    hold_ms: float     # this key press -> release


@dataclass
class Action:
    """What the driver should do in the browser. ``mode`` selects the executor."""

    mode: str                                   # "keys" | "type" | "chunks" | "fill"
    texts: Dict[str, str]
    keys: List[PlannedKey] = field(default_factory=list)                # mode == "keys"
    type_delay_ms: float = 0.0                                          # mode == "type"
    chunks: List[Tuple[str, str, float]] = field(default_factory=list)  # mode == "chunks": (field, text, pause_after_ms)

    @property
    def planned_events(self) -> int:
        return sum(len(t) for t in self.texts.values()) if self.mode != "fill" else 0


@dataclass(frozen=True)
class Expectation:
    kind: str
    statement: str


@dataclass(frozen=True)
class Scenario:
    key: str
    title: str
    truth: str                      # "bot" | "human"  (ground truth the harness registers)
    tool: str
    description: str
    expectation: Expectation
    builder: Callable[[np.random.Generator, int, Optional[dict]], Action]
    reference_class: Optional[str] = None   # synthetic class in reports/metrics.json to compare with
    needs_recording: bool = False
    fixed_length: bool = False              # length follows the recording, not a length class
    runs_factor: float = 1.0                # human scenarios need more visits to show a low false-alarm rate


# --------------------------------------------------------------------------------------
# Form text (content never matters to the model; it only has to be the right length)
# --------------------------------------------------------------------------------------
_WORDS = (
    "supply delivery contract tender road bridge school hospital water pipeline equipment "
    "maintenance services technical compliance warranty schedule materials labour quality "
    "inspection transport project phase budget local regional office furniture network "
    "software licence training support warranty penalty clause evaluation criteria"
).split()


def _words(rng: np.random.Generator, length: int) -> str:
    out = ""
    while len(out) < length:
        out += _WORDS[int(rng.integers(len(_WORDS)))] + " "
    return out[:length]


def make_form_text(rng: np.random.Generator, n_keys: int) -> Dict[str, str]:
    """Split ``n_keys`` characters over the three tracked fields (lower-case, digits, spaces only)."""
    if n_keys < 1:
        raise ValueError("n_keys must be positive")
    amount_len = int(min(9, max(4, n_keys // 8)))
    company_len = int(min(28, max(6, n_keys // 4)))
    if amount_len + company_len > n_keys:
        company_len = max(1, n_keys - amount_len)
        amount_len = n_keys - company_len
    just_len = n_keys - amount_len - company_len
    digits = "".join(str(int(d)) for d in rng.integers(0, 10, amount_len))
    if digits.startswith("0"):
        digits = "1" + digits[1:]
    return {"company": _words(rng, company_len), "amount": digits, "justification": _words(rng, just_len)}


def _flat_chars(texts: Dict[str, str]) -> List[Tuple[str, str]]:
    return [(f, c) for f in FIELDS for c in texts.get(f, "")]


def plan_from_timings(texts: Dict[str, str], flights: Sequence[float], holds: Sequence[float],
                      onset_ms: float) -> List[PlannedKey]:
    """Attach timing to each character. Flights beyond the model's own 2 s clip are replayed
    at 2 s (the model clips them anyway, so the scores are identical and the test is shorter)."""
    chars = _flat_chars(texts)
    if not (len(chars) == len(flights) == len(holds)):
        raise ValueError(f"timing length mismatch: {len(chars)} characters, {len(flights)} flights, {len(holds)} holds")
    plan: List[PlannedKey] = []
    for i, ((fld, ch), fl, hd) in enumerate(zip(chars, flights, holds)):
        flight = onset_ms if i == 0 else min(float(fl), MAX_FLIGHT_CLIP_MS)
        if i > 0 and fld != chars[i - 1][0]:
            flight = max(flight, MIN_FIELD_SWITCH_MS)
        plan.append(PlannedKey(fld, ch, round(flight, 1), round(min(max(float(hd), 1.0), MAX_HOLD_CLIP_MS), 1)))
    return plan


# --------------------------------------------------------------------------------------
# Builders
# --------------------------------------------------------------------------------------
def _build_instant(rng, n, _rec) -> Action:
    return Action("type", make_form_text(rng, n), type_delay_ms=0.0)


def _build_fixed_delay(rng, n, _rec) -> Action:
    return Action("type", make_form_text(rng, n), type_delay_ms=120.0)


def _build_metronome(rng, n, _rec) -> Action:
    texts = make_form_text(rng, n)
    return Action("keys", texts, keys=plan_from_timings(texts, [110.0] * n, [60.0] * n, BOT_ONSET_MS))


def _build_burst(rng, n, _rec) -> Action:
    texts = make_form_text(rng, n)
    chunks: List[Tuple[str, str, float]] = []
    for fld in FIELDS:
        text = texts.get(fld, "")
        i = 0
        while i < len(text):
            size = int(rng.integers(5, 15))
            piece = text[i:i + size]
            chunks.append((fld, piece, float(rng.uniform(400.0, 850.0))))
            i += size
    return Action("chunks", texts, chunks=chunks)


def _build_jitter(rng, n, _rec) -> Action:
    """The usual evasion: independent random delays inside the human range."""
    texts = make_form_text(rng, n)
    holds = rng.uniform(45.0, 140.0, n)
    flights = rng.uniform(70.0, 260.0, n)
    pauses = rng.random(n) < 0.03
    flights[pauses] = rng.uniform(300.0, 800.0, int(pauses.sum()))
    return Action("keys", texts, keys=plan_from_timings(texts, flights, holds, BOT_ONSET_MS))


def _build_mimic(rng, n, _rec) -> Action:
    """A bot that copies a human's average and spread, with bell-shaped noise."""
    texts = make_form_text(rng, n)
    holds = np.clip(rng.normal(88.0, 20.0, n), 35.0, 220.0)
    flights = np.clip(rng.normal(170.0, 55.0, n), 45.0, 500.0)
    pauses = rng.random(n) < 0.045
    flights[pauses] = rng.uniform(400.0, 1200.0, int(pauses.sum()))
    return Action("keys", texts, keys=plan_from_timings(texts, flights, holds, BOT_ONSET_MS))


def _build_fill(rng, n, _rec) -> Action:
    return Action("fill", make_form_text(rng, n))


def _build_replay(rng, n, rec) -> Action:
    if not rec:
        raise ValueError("replay_human needs a recorded session")
    flights, holds = list(rec["intervals"]), list(rec["hold_durations"])
    texts = make_form_text(rng, len(holds))
    return Action("keys", texts, keys=plan_from_timings(texts, flights, holds, BOT_ONSET_MS))


def _sim_builder(profile: str) -> Callable[[np.random.Generator, int, Optional[dict]], Action]:
    def build(rng, n, _rec) -> Action:
        flights, holds = generate_session_timings(rng, PROFILES[profile], n)
        texts = make_form_text(rng, n)
        return Action("keys", texts, keys=plan_from_timings(texts, flights, holds, HUMAN_ONSET_MS))
    return build


# --------------------------------------------------------------------------------------
# Registry (order = order shown in the dashboard and the report)
# --------------------------------------------------------------------------------------
_PLAYWRIGHT = "Playwright (real Edge, CDP key events)"
_SIM = "Simulated human (training-data generator) replayed in Edge"

_SCENARIOS = [
    Scenario(
        "pw_instant", "Instant typing", "bot", _PLAYWRIGHT,
        "keyboard.type(text) with no delay: the most common way to automate a form.",
        Expectation(KIND_DETECT, "Keys arrive about a millisecond apart and are held for under a millisecond. "
                    "PASS needs the 95% lower bound of the flagged rate to reach 90%."),
        _build_instant),
    Scenario(
        "pw_fixed_delay", "Fixed-delay typing", "bot", _PLAYWRIGHT,
        "keyboard.type(text, delay=120): the 'slow it down' option of the same call.",
        Expectation(KIND_DETECT, "Every key is held exactly as long as the delay and keys follow one another "
                    "instantly. PASS needs the 95% lower bound of the flagged rate to reach 90%."),
        _build_fixed_delay),
    Scenario(
        "pw_metronome", "Metronome script", "bot", _PLAYWRIGHT,
        "Key down, wait 60 ms, key up, wait 110 ms, repeat.",
        Expectation(KIND_DETECT, "Identical hold and gap on every key. PASS needs the 95% lower bound of the flagged rate to reach 90%."),
        _build_metronome, reference_class="REGULAR_AUTOMATION"),
    Scenario(
        "pw_burst", "Burst injection", "bot", _PLAYWRIGHT,
        "Chunks of 5-14 characters typed instantly, 0.4-0.85 s apart.",
        Expectation(KIND_DETECT, "Rapid clusters separated by fixed gaps. PASS needs the 95% lower bound of the flagged rate to reach 90%."),
        _build_burst, reference_class="BURST_AUTOMATION"),
    Scenario(
        "pw_jitter", "Random-delay bot", "bot", _PLAYWRIGHT,
        "Independent random hold (45-140 ms) and gap (70-260 ms) per key, 3% longer pauses.",
        Expectation(KIND_INFORMATIONAL, "The standard evasion. No target is set: detection is expected to grow "
                    "with session length (the synthetic benchmark shows 13% at 10-19 keys up to 98% at 200+)."),
        _build_jitter, reference_class="ADAPTIVE_AUTOMATION"),
    Scenario(
        "pw_mimic", "Human-statistics mimic", "bot", _PLAYWRIGHT,
        "Copies a typical human's mean and spread with bell-shaped noise, plus pauses.",
        Expectation(KIND_INFORMATIONAL, "The hard case. Partial detection is the documented outcome "
                    "(the synthetic benchmark shows 45%)."),
        _build_mimic, reference_class="MIMIC_BOT"),
    Scenario(
        "pw_fill", "Programmatic fill (no keystrokes)", "bot", _PLAYWRIGHT,
        "page.fill(): sets the field values with no key events at all.",
        Expectation(KIND_NO_VERDICT, "With no keystrokes there is nothing to score. Agent 4 correctly returns no "
                    "verdict, so the platform has to treat 'bid submitted with no behavioural data' as a signal of its own."),
        _build_fill),
    Scenario(
        "replay_human", "Replay of a recorded person", "bot", "Playwright replaying real human timing",
        "Replays the exact keystroke timing a real person produced on the portal.",
        Expectation(KIND_KNOWN_LIMITATION, "A replay of genuine human timing is genuine human timing. A timing-only "
                    "detector cannot catch it (documented limitation); most should pass as human."),
        _build_replay, needs_recording=True, fixed_length=True),
    Scenario(
        "sim_typical", "Simulated typical human", "human", _SIM,
        "Timing from the training generator's typical-human profile.",
        Expectation(KIND_PASS_HUMANS, "False-alarm rate consistent with the 5% design target: PASS needs the 95% upper bound "
                    "of the flagged rate to be at most 15%; FAIL if its lower bound is above 10%."),
        _sim_builder("HUMAN_LIKE"), reference_class="HUMAN_LIKE", runs_factor=1.5),
    Scenario(
        "sim_fast", "Simulated fast human", "human", _SIM,
        "Timing from the fast-typist profile.",
        Expectation(KIND_PASS_HUMANS, "False-alarm rate consistent with the 5% design target: PASS needs the 95% upper bound "
                    "of the flagged rate to be at most 15%; FAIL if its lower bound is above 10%."),
        _sim_builder("FAST_HUMAN_LIKE"), reference_class="FAST_HUMAN_LIKE", runs_factor=1.5),
    Scenario(
        "sim_slow", "Simulated slow human", "human", _SIM,
        "Timing from the slow, deliberate typist profile.",
        Expectation(KIND_PASS_HUMANS, "False-alarm rate consistent with the 5% design target: PASS needs the 95% upper bound "
                    "of the flagged rate to be at most 15%; FAIL if its lower bound is above 10%."),
        _sim_builder("SLOW_HUMAN_LIKE"), reference_class="SLOW_HUMAN_LIKE", runs_factor=1.5),
]

SCENARIOS: Dict[str, Scenario] = {s.key: s for s in _SCENARIOS}


def length_class_for(index: int) -> str:
    """Cycle short / medium / long so every scenario sees all three session lengths."""
    return ("short", "medium", "long")[index % 3]


def draw_length(rng: np.random.Generator, length_class: str) -> int:
    lo, hi = LENGTH_CLASSES[length_class]
    return int(rng.integers(lo, hi + 1))


def build_action(scenario: Scenario, rng: np.random.Generator, n_keys: int, recording: Optional[dict] = None) -> Action:
    return scenario.builder(rng, n_keys, recording)
