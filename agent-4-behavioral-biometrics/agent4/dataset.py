"""Feature tables built from simulated sessions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

import numpy as np

from agent4.features import FEATURES_BY_MODE, feature_matrix, to_model_space
from agent4.simulation import PROFILES, ROLE_NORMAL, Session


@dataclass
class Table:
    """Aligned per-session arrays for one scoring mode."""

    mode: str
    feature_names: list
    session_ids: np.ndarray
    behavior: np.ndarray
    split: np.ndarray
    n_events: np.ndarray
    raw: np.ndarray     # raw feature values, (n_sessions, n_features)
    X: np.ndarray       # model-space values, same shape

    def __len__(self) -> int:
        return len(self.session_ids)

    def mask(self, split: Optional[str] = None, classes: Optional[Sequence[str]] = None) -> np.ndarray:
        m = np.ones(len(self), dtype=bool)
        if split is not None:
            m &= self.split == split
        if classes is not None:
            m &= np.isin(self.behavior, list(classes))
        return m

    @property
    def is_human(self) -> np.ndarray:
        humans = [n for n, p in PROFILES.items() if p.role == ROLE_NORMAL]
        return np.isin(self.behavior, humans)


def build_table(sessions: Sequence[Session], mode: str) -> Table:
    raw = feature_matrix([s.flights for s in sessions], [s.holds for s in sessions], mode)
    return Table(
        mode=mode,
        feature_names=list(FEATURES_BY_MODE[mode]),
        session_ids=np.array([s.session_id for s in sessions]),
        behavior=np.array([s.behavior_type for s in sessions]),
        split=np.array([s.split for s in sessions]),
        n_events=np.array([s.n_events for s in sessions]),
        raw=raw,
        X=to_model_space(raw, mode),
    )
