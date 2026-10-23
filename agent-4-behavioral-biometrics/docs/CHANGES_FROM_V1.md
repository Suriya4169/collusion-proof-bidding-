# What changed from version 1, and why

Version 1 is the project in `Final_year/`. Version 2 (this folder) is a rebuild, not a patch. This file records what was wrong in version 1 — each point was checked by running the version 1 code — and what replaced it.

## 1. Problems found in version 1

| # | Problem | Evidence (from running v1) |
|---|---|---|
| 1 | **Short sessions were always flagged as anomalous.** The model was trained on sessions of 50–150 keystrokes and had `num_events` and `total_duration_ms` as inputs, but the API accepted 5 or more. | The v1 test fixtures for human, fast human, regular, adaptive and a documented example all scored HIGH (raw score ≈ 0.63–0.65) at 10–25 keystrokes, whatever the behaviour. Replaying real human sessions cut to their first 30 events gave a **30% false-positive rate** against the 5% target. |
| 2 | **The documented "human" example did not match the real output.** | Docs claimed risk 18.42, LOW, raw score 0.4125. The real v1 result was **85.8 (HIGH)**; 89.9 with hold times. |
| 3 | **Fast typists were treated as bots.** Trained on one human style only. | v1's own results: `FAST_HUMAN_LIKE` flagged **97.9%**. The headline ROC-AUC of 0.9728 *excluded* that class; including it, v1's results file gives ROC-AUC **0.7143** and a false-positive rate of **82%**. |
| 4 | **Adaptive bots were mostly missed.** | 36.9% in v1's own results; 28% when replayed through the live API. |
| 5 | **The 5% false-positive rate was true by construction.** | The threshold was set at the 95th percentile of 200 validation humans and the same 200 were used to report the false-positive rate. No held-out humans existed. |
| 6 | **Intervals-only mode invented hold times.** | Missing holds were filled with a fixed seeded random draw (identical for every request of the same length); adaptive-bot detection fell from 28% to 13%. |
| 7 | **The tests would not have caught problems 1–4.** | The human, fast-human and adaptive API tests only asserted that the answer was one of the three category names. |
| 8 | **Some reports contained hard-coded claims.** | The benchmark script wrote "PASSED" from a template regardless of the measurement and called an 8.5 ms inference "sub-millisecond". |
| 9 | **The README described parts that were not in the folder.** | A `biometrics.js` browser collector, a `backend/app` tree, SQLite repositories and `/api/v1/...` endpoints. Only `/health` and `/behavior/analyze` existed. |
| 10 | **Two parallel scoring schemes** (a 0–1 score with LOW/MONITOR/ELEVATED/HIGH, and a 0–100 score with LOW/MODERATE/HIGH_ANOMALY) and a pickled model artifact. | `src/inference.py` vs `src/risk_scoring.py`; `joblib` load of a pickle. |

## 2. What replaced it

| Area | Version 1 | Version 2 |
|---|---|---|
| Features | 36, including counts, totals, minima, maxima, ranges (length-dependent) | 30 (15 flight-only), none length-dependent, plus distribution-shape features; onset ignored, idle gaps capped |
| Training population | One human style | Three human styles (typical, fast, slow) |
| Detector | Isolation Forest, 200 trees | Gaussian mixture density; Isolation Forest kept as a measured baseline in the model selection |
| Thresholds | One global threshold | Length-aware thresholds from held-out humans |
| Risk scale | Arbitrary anchors (θ = 0.536 → 50, τ = 0.08) | 50 = human 95th percentile, 75 = human 99th, per session length |
| False-alarm estimate | In-sample, 200 sessions | Out-of-sample, ~2,700 held-out sessions, 95% CI |
| Detector choice | Fixed in advance | Compared on an independent development dataset, with a written criterion |
| Evaluation | Two scenarios, point estimates | Per class, per length, CIs, precision at base rates, leave-one-style-out, stress test, flight-only mode |
| Short sessions | Scored (wrongly) | `insufficient_data` below 10 keystrokes; `reliability` field above |
| Missing hold times | Imputed | Separate flight-only model |
| Model artifact | Pickle (`joblib`) | JSON bundles + SHA-256 manifest verified at start-up |
| Serving dependencies | scikit-learn, pandas, … | NumPy only (+ FastAPI/Pydantic/Uvicorn) |
| API | Permissive; 400/422 mix; extra fields ignored | Strict schema, unknown fields rejected, opaque `session_id`, API key, size limits, request ids, no input echo |
| Browser collector | Described, absent | `frontend/biometrics.js`, tested in a real browser engine, never reads key identity by default |
| Documentation | Hand-written numbers | Numbers synced from `metrics.json`; examples compared with the live API by tests |
| Tests | 32 (several vacuous) | 100+ including leakage guards, train/serve parity, artifact tamper tests, browser round-trip |
| Benchmark | Template with hard-coded verdict | Verdict computed from measurements |
| Retraining on real data | Not possible | `python -m agent4 retrain` |
| Deployment | None | Dockerfile, compose, env template, deployment guide (image not built in the dev environment) |

## 3. Where things moved

| Version 1 | Version 2 |
|---|---|
| `ml/data_generation/` | `agent4/simulation.py` (same five behaviour classes and parameters, plus slow human and mimic bot; variable lengths) |
| `ml/feature_engineering/` | `agent4/features.py` |
| `src/preprocessing.py`, `src/feature_selection.py` | `agent4/dataset.py`, `agent4/training.py`, `agent4/selection.py` |
| `src/isolation_forest.py` | `agent4/detector.py`, `agent4/artifacts.py`, `agent4/calibration.py` |
| `src/evaluation.py` | `agent4/evaluation.py`, `agent4/figures.py`, `agent4/report.py` |
| `src/inference.py`, `src/realtime_extractor.py`, `src/risk_scoring.py` | `agent4/scorer.py`, `agent4/features.py`, `agent4/calibration.py`, `agent4/evidence.py` |
| `src/api.py` | `agent4/service.py` |
| `src/benchmark.py` | `agent4/benchmark.py` |
| `models/isolation_forest_baseline.joblib` | `models/full.json`, `models/flight_only.json`, `models/manifest.json` |
| `reports/*.md` | `docs/*.md` and generated `reports/` |

## 4. For teammates integrating with the old API

See `docs/integration_guide.md` §8: field names are preserved but their meaning changed, short sessions behave differently, evidence descriptors were renamed, and unknown fields are now rejected.

## 5. What was deliberately kept

The project goal; the five behaviour classes and their parameters; the zero-content privacy principle; the advisory, never-blocking design; the `/health` and `/behavior/analyze` endpoints and their core field names; the 0–100 risk scale with LOW/MODERATE/HIGH categories at 50 and 75; the sub-15 ms target (now measured at a fraction of it).
