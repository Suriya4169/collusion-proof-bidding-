"""In-memory session store for the demo "platform backend".

It keeps, per session: the Agent 4 answer, the timing numbers it was computed from, whether a bid
was submitted, and (for test runs only) the ground truth the harness declared. The ground truth is
kept strictly on the platform side: it is never forwarded to Agent 4.

Only timing numbers are stored. No typed content ever reaches this server.
"""

from __future__ import annotations

import json
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from agent4.config import RISK_HIGH_FROM, RISK_MODERATE_FROM

MAX_SESSIONS = 5000
MIN_REPLAY_EVENTS = 30      # a recording shorter than this is not a useful replay source

OUTCOME_TYPING = "typing"                # no bid submitted yet
OUTCOME_SCORED = "scored"
OUTCOME_INSUFFICIENT = "insufficient_data"
OUTCOME_NO_DATA = "no_data"              # bid submitted and the platform holds no timing for it
OUTCOME_ERROR = "error"


@dataclass
class SessionRecord:
    session_id: str
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    seq: int = 0
    truth: Optional[str] = None                 # "human" | "bot" | None (a real visitor, unlabelled)
    scenario: Optional[str] = None
    tool: Optional[str] = None
    bid_submitted: bool = False
    bid_reference: Optional[str] = None
    behavior: Optional[Dict[str, Any]] = None   # Agent 4's answer, unmodified
    agent4_http_status: Optional[int] = None
    agent4_latency_ms: Optional[float] = None
    timing: Optional[Dict[str, List[float]]] = None   # the numbers that were sent to Agent 4

    @property
    def outcome(self) -> str:
        if not self.bid_submitted:
            return OUTCOME_TYPING
        if self.behavior is None:
            return OUTCOME_ERROR if self.agent4_http_status not in (None, 200) else OUTCOME_NO_DATA
        if self.agent4_http_status not in (None, 200):
            return OUTCOME_ERROR
        return OUTCOME_SCORED if self.behavior.get("status") == "scored" else OUTCOME_INSUFFICIENT

    def public(self) -> Dict[str, Any]:
        """The view shown to the dashboard and used for evaluation (no timing arrays)."""
        b = self.behavior or {}
        risk = b.get("behavioral_risk_score")
        return {
            "session_id": self.session_id,
            "seq": self.seq,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "truth": self.truth,
            "scenario": self.scenario,
            "tool": self.tool,
            "bid_submitted": self.bid_submitted,
            "bid_reference": self.bid_reference,
            "outcome": self.outcome,
            "risk": risk,
            "category": b.get("risk_category"),
            "flagged": (risk >= RISK_MODERATE_FROM) if risk is not None else None,
            "high": (risk >= RISK_HIGH_FROM) if risk is not None else None,
            "mode": b.get("scoring_mode"),
            "reliability": b.get("reliability"),
            "events": b.get("events_received"),
            "evidence": b.get("behavioral_evidence", []),
            "top_deviations": b.get("top_deviations", []),
            "model_version": b.get("model_version"),
            "message": b.get("message"),
            "agent4_http_status": self.agent4_http_status,
            "agent4_latency_ms": self.agent4_latency_ms,
        }

    def to_json(self) -> Dict[str, Any]:
        data = {k: getattr(self, k) for k in (
            "session_id", "created_at", "updated_at", "truth", "scenario", "tool", "bid_submitted",
            "bid_reference", "behavior", "agent4_http_status", "agent4_latency_ms", "timing")}
        return data


class SessionStore:
    def __init__(self, persist_path: Optional[Path] = None, max_sessions: int = MAX_SESSIONS):
        self._lock = threading.RLock()
        self._records: "OrderedDict[str, SessionRecord]" = OrderedDict()
        self._seq = 0
        self._bids = 0
        self._max = max_sessions
        self._persist_path = Path(persist_path) if persist_path else None
        if self._persist_path and self._persist_path.exists():
            self._load()

    # ---- helpers
    def _touch(self, session_id: str) -> SessionRecord:
        rec = self._records.get(session_id)
        if rec is None:
            rec = SessionRecord(session_id=session_id)
            self._records[session_id] = rec
            while len(self._records) > self._max:
                self._records.popitem(last=False)
        self._seq += 1
        rec.seq = self._seq
        rec.updated_at = time.time()
        return rec

    # ---- writes
    def set_truth(self, session_id: str, truth: str, scenario: Optional[str], tool: Optional[str]) -> SessionRecord:
        with self._lock:
            rec = self._touch(session_id)
            rec.truth, rec.scenario, rec.tool = truth, scenario, tool
            return rec

    def record_behavior(self, session_id: str, response: Optional[Dict[str, Any]], http_status: int,
                        latency_ms: float, timing: Optional[Dict[str, List[float]]]) -> SessionRecord:
        """Keep the answer computed from the most keystrokes (live previews arrive out of order)."""
        with self._lock:
            rec = self._touch(session_id)
            if http_status == 200 and response is not None:
                prior = (rec.behavior or {}).get("events_received", -1)
                if response.get("events_received", 0) >= prior:   # a late, shorter preview never replaces a fuller answer
                    rec.behavior, rec.timing = response, timing
                    rec.agent4_http_status, rec.agent4_latency_ms = 200, round(latency_ms, 2)
            elif rec.behavior is None:                            # Agent 4 failed and there is nothing better to keep
                rec.agent4_http_status, rec.agent4_latency_ms = http_status, round(latency_ms, 2)
            if rec.bid_submitted:
                self._append(rec)
            return rec

    def submit_bid(self, session_id: str) -> SessionRecord:
        with self._lock:
            rec = self._touch(session_id)
            if not rec.bid_submitted:
                self._bids += 1
                rec.bid_reference = f"PIP-DEMO-{self._bids:05d}"
                rec.bid_submitted = True
            self._append(rec)
            return rec

    def reset(self) -> None:
        with self._lock:
            self._records.clear()
            self._seq = 0
            self._bids = 0

    # ---- reads
    def get(self, session_id: str) -> Optional[SessionRecord]:
        with self._lock:
            return self._records.get(session_id)

    def changed_since(self, after: int, limit: int = 500) -> List[Dict[str, Any]]:
        with self._lock:
            rows = sorted((r for r in self._records.values() if r.seq > after), key=lambda r: r.seq)
            return [r.public() for r in rows[:limit]]

    def all_public(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [r.public() for r in sorted(self._records.values(), key=lambda r: r.created_at)]

    def manual_recording_count(self, min_events: int = MIN_REPLAY_EVENTS) -> int:
        with self._lock:
            return sum(1 for r in self._records.values() if _is_manual_recording(r.to_json(), min_events))

    @property
    def seq(self) -> int:
        with self._lock:
            return self._seq

    # ---- persistence (append-only JSON lines; last line per session wins)
    def _append(self, rec: SessionRecord) -> None:
        if not self._persist_path:
            return
        try:
            self._persist_path.parent.mkdir(parents=True, exist_ok=True)
            with self._persist_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(rec.to_json(), separators=(",", ":")) + "\n")
        except OSError:
            pass   # persistence is a convenience; never fail a request over it

    def _load(self) -> None:
        for row in read_persisted(self._persist_path).values():
            rec = SessionRecord(**{k: row.get(k) for k in SessionRecord.__dataclass_fields__ if k in row})
            self._seq += 1
            rec.seq = self._seq
            self._records[rec.session_id] = rec
            if rec.bid_reference:
                self._bids = max(self._bids, int(rec.bid_reference.rsplit("-", 1)[-1] or 0))
        while len(self._records) > self._max:
            self._records.popitem(last=False)


def read_persisted(path: Path) -> "OrderedDict[str, Dict[str, Any]]":
    """Read the JSON-lines file; the last line for each session wins. Tolerates a torn final line."""
    rows: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
    if not Path(path).exists():
        return rows
    with Path(path).open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except ValueError:
                continue
            if isinstance(row, dict) and isinstance(row.get("session_id"), str):
                rows[row["session_id"]] = row
    return rows


def _is_manual_recording(row: Dict[str, Any], min_events: int) -> bool:
    """A submitted session no harness labelled, with full hold + interval timing."""
    timing = row.get("timing") or {}
    holds, intervals = timing.get("hold_durations"), timing.get("intervals")
    return bool(row.get("truth") is None and row.get("scenario") is None and row.get("bid_submitted")
                and holds and intervals and len(holds) == len(intervals) >= min_events)


def load_manual_recordings(path: Path, min_events: int = MIN_REPLAY_EVENTS) -> List[Dict[str, List[float]]]:
    """Timing recorded from people typing on the portal (sessions no harness labelled)."""
    return [{"intervals": list(row["timing"]["intervals"]), "hold_durations": list(row["timing"]["hold_durations"])}
            for row in read_persisted(path).values() if _is_manual_recording(row, min_events)]
