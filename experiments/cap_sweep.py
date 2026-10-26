"""Sensitivity of the cartel engine to the public-infrastructure degree cap.
Run from D:/fed-learning/ProcureGuard-AI :  python ../thesis_amrita/experiments/cap_sweep.py
Uses the same synthetic pools as rq2_experiments.py (seed 5)."""
import json, os, sys, importlib
sys.path.insert(0, "."); sys.path.insert(0, "../thesis/experiments")
out = {}
for cap in (2, 3, 4, 5, 6, 8):
    os.environ["AEGIS_PUBLIC_DEGREE_CAP"] = str(cap)
    for m in [m for m in sys.modules if m.startswith("engines")]: del sys.modules[m]
    import rq2_experiments as rq; importlib.reload(rq)
    out[cap] = rq.cartel_experiment()
    print(cap, out[cap], flush=True)
json.dump(out, open("../thesis_amrita/experiments/cap_sweep.json", "w"), indent=2)
