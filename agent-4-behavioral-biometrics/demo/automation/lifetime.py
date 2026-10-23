"""Make a worker process die with its parent.

Cancelling a bot job kills the process tree, but a worker that is being spawned at that very moment
can escape the kill. Each worker therefore also watches its parent and exits by itself when the
parent is gone, so no orphaned browser keeps submitting bids.
"""

from __future__ import annotations

import os
import sys
import threading
import time


def _parent_alive(parent: int) -> bool:
    if sys.platform == "win32":
        import ctypes

        kernel32 = ctypes.windll.kernel32
        kernel32.OpenProcess.restype = ctypes.c_void_p
        kernel32.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
        kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
        handle = kernel32.OpenProcess(0x00100000, False, parent)       # SYNCHRONIZE
        if not handle:
            return False
        try:
            return kernel32.WaitForSingleObject(handle, 0) == 0x102     # WAIT_TIMEOUT: still running
        finally:
            kernel32.CloseHandle(handle)
    return os.getppid() == parent


def exit_when_parent_dies(poll_s: float = 0.5) -> threading.Thread:
    """Start a daemon thread that ends this process (exit code 3) shortly after its parent ends."""
    parent = os.getppid()

    def loop() -> None:
        while True:
            time.sleep(poll_s)
            if not _parent_alive(parent):
                os._exit(3)

    thread = threading.Thread(target=loop, name="parent-watchdog", daemon=True)
    thread.start()
    return thread
