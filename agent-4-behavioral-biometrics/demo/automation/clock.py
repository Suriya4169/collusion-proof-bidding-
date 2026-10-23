"""Accurate waiting for replaying keystroke timing.

On Windows ``time.sleep`` only wakes on the system timer tick (about 15.6 ms), which would
quantise every bot and every replayed human to that grid. Raising the timer resolution to 1 ms
and spinning for the last few milliseconds keeps the replay within about a millisecond.
"""

from __future__ import annotations

import atexit
import sys
import time

_SPIN_S = 0.004
_enabled = False


def enable_high_resolution_timer() -> None:
    """Ask Windows for a 1 ms timer for this process (no-op elsewhere). Safe to call repeatedly."""
    global _enabled
    if _enabled or sys.platform != "win32":
        return
    try:
        import ctypes

        winmm = ctypes.WinDLL("winmm")
        if winmm.timeBeginPeriod(1) == 0:
            _enabled = True
            atexit.register(lambda: winmm.timeEndPeriod(1))
    except Exception:  # pragma: no cover - best effort; the spin loop still keeps most of the accuracy
        pass


def sleep_until(deadline: float) -> None:
    """Block until ``time.perf_counter()`` reaches ``deadline`` (seconds)."""
    while True:
        remaining = deadline - time.perf_counter()
        if remaining <= 0.0:
            return
        if remaining > _SPIN_S:
            time.sleep(remaining - _SPIN_S)
