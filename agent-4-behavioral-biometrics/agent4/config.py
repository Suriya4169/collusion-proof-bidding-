"""Project-wide constants and runtime settings.

This module is the single source of truth shared by the training pipeline and the
serving API, so the two can never disagree about thresholds or feature definitions.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_DIR = PROJECT_ROOT / "models"
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_REPORT_DIR = PROJECT_ROOT / "reports"

SERVICE_NAME = "agent-4-behavioral-biometrics"
SERVICE_VERSION = "2.0.0"

# --------------------------------------------------------------------------------------
# Timing references (milliseconds). These are recognised keystroke-dynamics bands used to
# *build features*; they are not classification rules.
# --------------------------------------------------------------------------------------
SHORT_FLIGHT_MS = 50.0
LONG_FLIGHT_MS = 300.0
SHORT_HOLD_MS = 45.0
LONG_HOLD_MS = 120.0
PAUSE_MS = 400.0

# Idle gaps (reading the form, switching tabs) carry no typing-rhythm information. Flights
# are capped here before any statistic is computed so one long idle gap cannot dominate.
MAX_FLIGHT_CLIP_MS = 2000.0
# A key held for seconds is a stuck key or auto-repeat, not a typing keystroke.
MAX_HOLD_CLIP_MS = 1000.0

# Minimum number of keystroke events for the feature maths to be defined at all.
TECHNICAL_MIN_EVENTS = 5

# Score modes. "full" uses hold + flight timing; "flight_only" is the fallback for
# clients that can only supply inter-key intervals.
MODE_FULL = "full"
MODE_FLIGHT_ONLY = "flight_only"
MODES = (MODE_FULL, MODE_FLIGHT_ONLY)

# Risk-score category boundaries on the 0-100 scale.
RISK_MODERATE_FROM = 50.0
RISK_HIGH_FROM = 75.0


def _parse_bool(value: Optional[str], default: bool = False) -> bool:
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    """Runtime configuration for the scoring service, read from environment variables."""

    model_dir: Path = DEFAULT_MODEL_DIR
    api_keys: frozenset = frozenset()
    require_api_key: bool = False
    max_events: int = 2000
    max_body_bytes: int = 262_144
    min_events_override: Optional[int] = None
    log_level: str = "INFO"
    cors_origins: tuple = ()

    @classmethod
    def from_env(cls, env: Optional[Mapping[str, str]] = None) -> "Settings":
        env = os.environ if env is None else env
        keys = frozenset(k.strip() for k in env.get("AGENT4_API_KEYS", "").split(",") if k.strip())
        origins = tuple(o.strip() for o in env.get("AGENT4_CORS_ORIGINS", "").split(",") if o.strip())
        min_override = env.get("AGENT4_MIN_EVENTS", "").strip()
        return cls(
            model_dir=Path(env.get("AGENT4_MODEL_DIR", str(DEFAULT_MODEL_DIR))),
            api_keys=keys,
            require_api_key=_parse_bool(env.get("AGENT4_REQUIRE_API_KEY")),
            max_events=int(env.get("AGENT4_MAX_EVENTS", "2000")),
            max_body_bytes=int(env.get("AGENT4_MAX_BODY_BYTES", "262144")),
            min_events_override=int(min_override) if min_override else None,
            log_level=env.get("AGENT4_LOG_LEVEL", "INFO").upper(),
            cors_origins=origins,
        )
