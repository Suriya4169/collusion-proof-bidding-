# Architecture and design decisions

## 1. Module map

```
agent4/
  config.py        constants shared by training and serving + Settings from environment variables
  features.py      THE feature extractor (used by training, evaluation and the API) and input validation
  simulation.py    synthetic keystroke-timing generator, class roles and train/calibration/test splits
  dataset.py       aligned per-session feature tables
  detector.py      Gaussian-mixture density model; scoring and explanations in plain NumPy
  calibration.py   length-aware score quantiles and the 0-100 risk scale
  evidence.py      plain-language descriptors built from feature deviations
  artifacts.py     JSON bundles + manifest.json (SHA-256) save/load/verify
  scorer.py        BehaviorScorer: timing in, ScoreResult out (the single entry point)
  service.py       FastAPI app factory: schema, auth, limits, middleware
  selection.py     detector comparison on an independent development dataset
  training.py      fitting and calibrating on genuine-human sessions only
  evaluation.py    held-out metrics, confidence intervals, by-length breakdown, leave-one-style-out
  figures.py       evaluation charts
  report.py        evaluation_report.md generated from metrics.json
  docsync.py       keeps numbers in README/docs equal to metrics.json
  pipeline.py      end-to-end: data -> selection -> training -> evaluation -> reports
  retrain.py       refit and recalibrate on real genuine-human sessions
  benchmark.py     latency measurement (the verdict is computed, not typed)
  cli.py           python -m agent4 <command>
frontend/          browser collector, demo page, in-browser self-test
models/            full.json, flight_only.json, manifest.json
tests/             unit, contract, integrity, leakage, browser round-trip, docs-as-tests
```

## 2. Data flow at serving time

```
POST /behavior/analyze  { session_id, intervals, hold_durations? }
   service.py        schema validation (strict types, no unknown fields, opaque session id), auth, size limits
   scorer.py         validate_timings -> choose mode (full if hold_durations else flight_only)
                     if fewer than min events  -> status = insufficient_data (no score)
                     keep the most recent 300 events if longer
   features.py       drop onset latency, cap idle gaps -> 30 (or 15) features
   features.py       to_model_space: log-transform ms features, clip heavy tails
   detector.py       anomaly score = -log-likelihood under the human mixture
   calibration.py    risk = f(score | session length)   (50 = human p95, 75 = human p99)
   evidence.py       top deviations -> evidence descriptors
   <- ScoreResult -> BehaviorResponse (JSON)
```

## 3. Design decisions and why

| Decision | Reason |
|---|---|
| **One feature extractor for training and serving** | Removes training/serving skew by construction. A test replays 120 sessions one by one through the scorer and checks the risk scores equal the batch-evaluation scores. |
| **No length-dependent features (counts, totals, min/max/range)** | A feature that grows with session length lets the model separate "short" from "long" instead of "human" from "bot", and makes short real sessions look anomalous (this was the main defect of version 1). |
| **Shape features (skew, kurtosis of log timings)** | Human inter-key times are right-skewed (log-normal-like); scripted random delays are typically flat or symmetric. This is how the adaptive bot becomes separable. |
| **Onset latency ignored; idle gaps capped at 2 s** | Time spent reading the form says nothing about typing rhythm and would dominate any mean or spread. |
| **Train on the whole human population** | The model defines "normal" as what it was trained on. Version 1 trained on one style and flagged 98% of fast typists. |
| **Detector = Gaussian mixture, not Isolation Forest** | Chosen on a separate development dataset: far better on bots that differ in distribution shape. Also exports to plain arrays. |
| **Length-aware thresholds** | The spread of human scores shrinks as sessions get longer (see `reports/figures/06_length_aware_thresholds.png`). A global threshold is too strict for short sessions and too lax for long ones. Estimated with a kernel over log-length on held-out calibration sessions, then lightly smoothed. |
| **Risk scale anchored to human percentiles** | "50" and "75" have a statistical meaning that survives retraining (95th and 99th human percentile), instead of an arbitrary constant. |
| **Calibration split disjoint from test split** | Makes the reported false-alarm rate an out-of-sample estimate. In version 1 it was true by construction. |
| **Attacks never touch training or calibration** | Enforced in code (only normal-class sessions are ever selected) and by a leakage test that deliberately mislabels attack sessions as training data and checks they are ignored. |
| **Detector choice made on dev data (different seed)** | Test numbers are not used to choose the model. |
| **Two modes (full / flight-only) with separate models** | Version 1 invented hold times when they were missing. Here, missing data is handled by a model trained without it. |
| **`insufficient_data` instead of a score for very short sessions** | A number that looks precise but rests on a handful of keystrokes is worse than no number. |
| **JSON artifacts + SHA-256 manifest, no pickle** | Safe to load, diff-able, version-able; tampering is detected at start-up. |
| **NumPy-only serving** | Small image, no scikit-learn version coupling, fast cold start (about 2 ms to load) and about 0.35 ms to score. |
| **Stateless service** | Horizontal scaling and simple operations; persistence belongs to the platform's audit trail. |
| **Docs generated from the code's outputs** | Examples are produced by the real scorer and compared with the live API by a test; quoted numbers are synced from `metrics.json`. |

## 4. Mixture size and feature count

* Full model: 30 features, mixture size chosen on the development data (see `reports/model_selection_full.json`).
* Flight-only: 15 features, its own mixture size chosen the same way.
* Sizes are *selected*, not assumed: the simplest model within one percentage point of the best macro detection rate on the development data.

## 5. Where the evaluation numbers come from

`python -m agent4 all` → `reports/metrics.json` (everything) → `reports/evaluation_report.md` (tables and charts) and the numbers in the README and model card (via `sync-docs`). Nothing quoted in the documents is typed by hand.
