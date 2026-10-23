"""Demo website and automated bot test-bench for Agent 4.

This package is *not* part of the deployable scoring service (``agent4``). It stands in for the
rest of the platform so the trained model can be seen working end to end:

    browser (portal + biometrics.js) -> demo "platform backend" -> Agent 4 /behavior/analyze

and it drives real browsers with real automation tooling to check what the model does with them.
"""

DEMO_VERSION = "1.0.0"
