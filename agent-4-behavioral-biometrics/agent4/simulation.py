"""Synthetic keystroke-timing generator.

Why synthetic: real bidder keystroke biometrics cannot be collected without consent, and
real bot attacks are rare and unlabelled. The generator therefore produces anonymous,
timing-only sessions whose ground truth is known.

Zero-content guarantee: only ``hold_duration_ms`` and ``flight_time_ms`` are generated. No
characters, key codes or text exist anywhere in the data.

Class roles
-----------
normal          HUMAN_LIKE, FAST_HUMAN_LIKE, SLOW_HUMAN_LIKE. Three genuine typing styles that
                together define the "normal human" population. These are the only sessions the
                model is trained on or calibrated with; each class is split
                train/calibration/test.
attack          REGULAR_AUTOMATION, BURST_AUTOMATION, ADAPTIVE_AUTOMATION. Never seen during
                training or calibration; used only to measure detection.
stress_attack   MIMIC_BOT. A bot that copies the human mean/spread and pause rate with
                symmetric (Gaussian) noise. A deliberately hard case, reported separately.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np

ROLE_NORMAL = "normal"
ROLE_ATTACK = "attack"
ROLE_STRESS_ATTACK = "stress_attack"

SPLIT_TRAIN = "train"
SPLIT_CALIBRATION = "calibration"
SPLIT_TEST = "test"
SPLIT_STRESS = "stress"

RAW_COLUMNS = ["session_id", "behavior_type", "split", "event_index", "hold_duration_ms", "flight_time_ms"]


@dataclass(frozen=True)
class Profile:
    """Statistical description of one behavioural class (all times in milliseconds)."""

    name: str
    role: str
    description: str
    hold_mean: float
    hold_std: float
    hold_min: float
    hold_max: float
    hold_dist: str
    flight_mean: float
    flight_std: float
    flight_min: float
    flight_max: float
    flight_dist: str
    pause_prob: float = 0.0
    pause_min: float = 0.0
    pause_max: float = 0.0
    pause_dist: str = "lognormal"
    session_hold_shift_std: float = 0.0
    session_flight_shift_std: float = 0.0
    idle_gap_prob: float = 0.0
    burst_min: int = 0
    burst_max: int = 0
    inter_burst_min: float = 0.0
    inter_burst_max: float = 0.0
    onset_range: Tuple[float, float] = (300.0, 4000.0)


PROFILES: Dict[str, Profile] = {
    p.name: p
    for p in [
        Profile(
            name="HUMAN_LIKE", role=ROLE_NORMAL,
            description="Natural typing with biological variance and cognitive pauses.",
            hold_mean=88.0, hold_std=20.0, hold_min=35.0, hold_max=220.0, hold_dist="lognormal",
            flight_mean=170.0, flight_std=55.0, flight_min=45.0, flight_max=500.0, flight_dist="lognormal",
            pause_prob=0.045, pause_min=400.0, pause_max=1200.0, pause_dist="lognormal",
            session_hold_shift_std=8.0, session_flight_shift_std=18.0, idle_gap_prob=0.004,
        ),
        Profile(
            name="FAST_HUMAN_LIKE", role=ROLE_NORMAL,
            description="Skilled fast typist: shorter latencies, biological variance preserved.",
            hold_mean=68.0, hold_std=15.0, hold_min=30.0, hold_max=160.0, hold_dist="lognormal",
            flight_mean=115.0, flight_std=38.0, flight_min=35.0, flight_max=380.0, flight_dist="lognormal",
            pause_prob=0.025, pause_min=300.0, pause_max=800.0, pause_dist="lognormal",
            session_hold_shift_std=5.0, session_flight_shift_std=12.0, idle_gap_prob=0.004,
        ),
        Profile(
            name="REGULAR_AUTOMATION", role=ROLE_ATTACK,
            description="Loop-based script with a fixed cadence and minimal variance.",
            hold_mean=52.0, hold_std=2.5, hold_min=42.0, hold_max=65.0, hold_dist="normal",
            flight_mean=105.0, flight_std=3.5, flight_min=90.0, flight_max=125.0, flight_dist="normal",
            pause_prob=0.001, pause_min=150.0, pause_max=250.0, pause_dist="uniform",
            session_hold_shift_std=1.0, session_flight_shift_std=1.5,
            onset_range=(5.0, 100.0),
        ),
        Profile(
            name="BURST_AUTOMATION", role=ROLE_ATTACK,
            description="Programmatic burst injection: rapid clusters separated by fixed gaps.",
            hold_mean=32.0, hold_std=4.0, hold_min=18.0, hold_max=50.0, hold_dist="normal",
            flight_mean=24.0, flight_std=5.0, flight_min=10.0, flight_max=45.0, flight_dist="normal",
            session_hold_shift_std=1.5, session_flight_shift_std=2.0,
            burst_min=5, burst_max=14, inter_burst_min=400.0, inter_burst_max=850.0,
            onset_range=(5.0, 100.0),
        ),
        Profile(
            name="ADAPTIVE_AUTOMATION", role=ROLE_ATTACK,
            description="Evasive bot adding flat random delays to imitate the human range.",
            hold_mean=78.0, hold_std=22.0, hold_min=40.0, hold_max=130.0, hold_dist="uniform",
            flight_mean=150.0, flight_std=45.0, flight_min=70.0, flight_max=240.0, flight_dist="uniform",
            pause_prob=0.035, pause_min=350.0, pause_max=700.0, pause_dist="uniform",
            session_hold_shift_std=3.0, session_flight_shift_std=5.0,
            onset_range=(5.0, 100.0),
        ),
        Profile(
            name="SLOW_HUMAN_LIKE", role=ROLE_NORMAL,
            description="Deliberate, slower typist.",
            hold_mean=105.0, hold_std=24.0, hold_min=45.0, hold_max=260.0, hold_dist="lognormal",
            flight_mean=260.0, flight_std=90.0, flight_min=70.0, flight_max=800.0, flight_dist="lognormal",
            pause_prob=0.06, pause_min=500.0, pause_max=1800.0, pause_dist="lognormal",
            session_hold_shift_std=10.0, session_flight_shift_std=25.0, idle_gap_prob=0.005,
        ),
        Profile(
            name="MIMIC_BOT", role=ROLE_STRESS_ATTACK,
            description="Bot copying human mean/spread/pause rate with Gaussian noise (hard case).",
            hold_mean=88.0, hold_std=20.0, hold_min=35.0, hold_max=220.0, hold_dist="normal",
            flight_mean=170.0, flight_std=55.0, flight_min=45.0, flight_max=500.0, flight_dist="normal",
            pause_prob=0.045, pause_min=400.0, pause_max=1200.0, pause_dist="uniform",
            session_hold_shift_std=8.0, session_flight_shift_std=18.0,
            onset_range=(5.0, 100.0),
        ),
    ]
}

NORMAL_CLASSES = [n for n, p in PROFILES.items() if p.role == ROLE_NORMAL]
ATTACK_CLASSES = [n for n, p in PROFILES.items() if p.role == ROLE_ATTACK]
STRESS_ATTACK_CLASSES = [n for n, p in PROFILES.items() if p.role == ROLE_STRESS_ATTACK]


@dataclass(frozen=True)
class GenerationConfig:
    seed: int = 42
    sessions_per_class: int = 6000
    stress_sessions_per_class: int = 3000
    min_events: int = 10
    max_events: int = 300
    train_fraction: float = 0.60
    calibration_fraction: float = 0.25  # remainder of normal sessions is the test split


@dataclass
class Session:
    session_id: str
    behavior_type: str
    split: str
    flights: np.ndarray  # flights[0] is the onset latency
    holds: np.ndarray

    @property
    def n_events(self) -> int:
        return int(len(self.flights))

    @property
    def is_attack(self) -> bool:
        return PROFILES[self.behavior_type].role != ROLE_NORMAL


def _sample(rng: np.random.Generator, dist: str, mean: float, std: float,
            lo: float, hi: float, size: int) -> np.ndarray:
    if dist == "lognormal":
        sigma = np.sqrt(np.log(1.0 + max(std, 1e-3) ** 2 / mean ** 2))
        mu = np.log(mean) - 0.5 * sigma ** 2
        x = rng.lognormal(mu, sigma, size)
    elif dist == "normal":
        x = rng.normal(mean, std, size)
    elif dist == "uniform":
        half = np.sqrt(3.0) * std
        a, b = max(lo, mean - half), min(hi, mean + half)
        if a >= b:
            a, b = lo, hi
        x = rng.uniform(a, b, size)
    else:
        raise ValueError(f"Unsupported distribution: {dist}")
    return np.clip(x, lo, hi)


def _burst_flights(rng: np.random.Generator, p: Profile, n: int, mean: float) -> np.ndarray:
    flights = np.empty(n)
    idx = 0
    while idx < n:
        length = int(rng.integers(p.burst_min, p.burst_max + 1))
        end = min(idx + length, n)
        flights[idx:end] = np.clip(rng.normal(mean, p.flight_std, end - idx), p.flight_min, p.flight_max)
        if idx > 0:  # the gap *before* a burst's first event is the programmatic inter-burst pause
            flights[idx] = rng.uniform(p.inter_burst_min, p.inter_burst_max)
        idx = end
    return flights


def generate_session_timings(rng: np.random.Generator, p: Profile, n: int) -> Tuple[np.ndarray, np.ndarray]:
    """Generate (flights, holds) for one session of ``n`` events."""
    hold_shift = rng.normal(0.0, p.session_hold_shift_std) if p.session_hold_shift_std else 0.0
    flight_shift = rng.normal(0.0, p.session_flight_shift_std) if p.session_flight_shift_std else 0.0
    hold_mean = max(p.hold_min, p.hold_mean + hold_shift)
    flight_mean = max(p.flight_min, p.flight_mean + flight_shift)

    holds = _sample(rng, p.hold_dist, hold_mean, p.hold_std, p.hold_min, p.hold_max, n)

    if p.burst_min:
        flights = _burst_flights(rng, p, n, flight_mean)
    else:
        flights = _sample(rng, p.flight_dist, flight_mean, p.flight_std, p.flight_min, p.flight_max, n)
        if p.pause_prob > 0.0:
            mask = rng.random(n) < p.pause_prob
            mask[0] = False
            k = int(mask.sum())
            if k:
                if p.pause_dist == "lognormal":
                    pm = (p.pause_min + p.pause_max) / 2.0
                    ps = (p.pause_max - p.pause_min) / 4.0
                    vals = _sample(rng, "lognormal", pm, ps, p.pause_min, p.pause_max * 1.5, k)
                else:
                    vals = rng.uniform(p.pause_min, p.pause_max, k)
                flights[mask] = vals
        if p.idle_gap_prob > 0.0:
            idle = rng.random(n) < p.idle_gap_prob
            idle[0] = False
            k = int(idle.sum())
            if k:
                flights[idle] = rng.uniform(2000.0, 12000.0, k)

    flights[0] = rng.uniform(*p.onset_range)
    return np.round(flights, 1), np.round(holds, 1)


def _draw_length(rng: np.random.Generator, lo: int, hi: int) -> int:
    """Log-uniform session length: many short sessions, some long ones."""
    n = int(np.exp(rng.uniform(np.log(lo), np.log(hi + 1))))
    return int(min(max(n, lo), hi))


def generate_dataset(config: GenerationConfig = GenerationConfig()) -> List[Session]:
    """Generate the full labelled dataset deterministically from ``config.seed``."""
    streams = np.random.SeedSequence(config.seed).spawn(len(PROFILES) * 2)
    sessions: List[Session] = []
    for class_index, (name, profile) in enumerate(PROFILES.items()):
        gen_rng = np.random.default_rng(streams[2 * class_index])
        split_rng = np.random.default_rng(streams[2 * class_index + 1])
        is_stress = profile.role == ROLE_STRESS_ATTACK
        count = config.stress_sessions_per_class if is_stress else config.sessions_per_class

        if profile.role == ROLE_NORMAL:
            order = split_rng.permutation(count)
            n_train = int(round(count * config.train_fraction))
            n_cal = int(round(count * config.calibration_fraction))
            split_of = np.empty(count, dtype=object)
            split_of[order[:n_train]] = SPLIT_TRAIN
            split_of[order[n_train:n_train + n_cal]] = SPLIT_CALIBRATION
            split_of[order[n_train + n_cal:]] = SPLIT_TEST
        else:
            split_of = np.full(count, SPLIT_STRESS if is_stress else SPLIT_TEST, dtype=object)

        for i in range(count):
            n = _draw_length(gen_rng, config.min_events, config.max_events)
            flights, holds = generate_session_timings(gen_rng, profile, n)
            sessions.append(Session(
                session_id=f"s{class_index}-{i:05d}",
                behavior_type=name,
                split=str(split_of[i]),
                flights=flights,
                holds=holds,
            ))
    return sessions


def select(sessions: Sequence[Session], *, split: Optional[str] = None,
           classes: Optional[Sequence[str]] = None) -> List[Session]:
    return [
        s for s in sessions
        if (split is None or s.split == split) and (classes is None or s.behavior_type in classes)
    ]


# --------------------------------------------------------------------------------------
# Persistence (raw event table: timing only)
# --------------------------------------------------------------------------------------

def save_sessions(sessions: Sequence[Session], path: Path) -> Path:
    """Write the raw event table (one row per keystroke event) as CSV or CSV.GZ."""
    import pandas as pd

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    lengths = [s.n_events for s in sessions]
    frame = pd.DataFrame({
        "session_id": np.repeat([s.session_id for s in sessions], lengths),
        "behavior_type": np.repeat([s.behavior_type for s in sessions], lengths),
        "split": np.repeat([s.split for s in sessions], lengths),
        "event_index": np.concatenate([np.arange(n) for n in lengths]),
        "hold_duration_ms": np.concatenate([s.holds for s in sessions]),
        "flight_time_ms": np.concatenate([s.flights for s in sessions]),
    })[RAW_COLUMNS]
    frame.to_csv(path, index=False)
    return path


def load_sessions(path: Path) -> List[Session]:
    import pandas as pd

    frame = pd.read_csv(path)
    missing = set(RAW_COLUMNS) - set(frame.columns)
    if missing:
        raise ValueError(f"Raw event file is missing columns: {sorted(missing)}")
    sessions: List[Session] = []
    for sid, g in frame.groupby("session_id", sort=False):
        g = g.sort_values("event_index")
        sessions.append(Session(
            session_id=str(sid),
            behavior_type=str(g["behavior_type"].iloc[0]),
            split=str(g["split"].iloc[0]),
            flights=g["flight_time_ms"].to_numpy(dtype=np.float64),
            holds=g["hold_duration_ms"].to_numpy(dtype=np.float64),
        ))
    return sessions
