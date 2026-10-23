# Deployment guide

## 1. What you are deploying

A single stateless HTTP service (`agent4.service`) plus its model folder (`models/`: two JSON bundles and `manifest.json`). No database, no queue, no GPU. A running worker uses about 60 MB of memory (measured: 58 MB working set after 300 requests, one worker, Windows, Python 3.10) and scoring takes well under a millisecond (`reports/latency_benchmark.md`).

Serving needs only `requirements.txt` (NumPy, FastAPI, Starlette, Pydantic, Uvicorn). Training, evaluation and the tests need `requirements-dev.txt` as well.

## 2. Before you deploy: fit the model to your real users

The shipped model was trained on **synthetic** typing styles. A genuine style that the training population does not cover gets flagged (see the model card), so do this first:

1. **Collect** timing-only sessions from genuine bidders that you have good reason to trust (for example, a pilot period reviewed by staff). Do **not** include sessions you know or suspect are automated: the model would learn that automation is normal. Aim for **3,000+ sessions** (500 is the hard minimum) covering your real devices and form types.
2. **Export** them as one CSV or CSV.GZ, one row per keystroke event, with exactly these columns and nothing else (the tool refuses any other column, such as a key or text column):

   ```
   session_id,event_index,hold_duration_ms,flight_time_ms
   s-0001,0,84.2,610.5
   s-0001,1,79.9,132.0
   ...
   ```

   `flight_time_ms` is the release-to-press gap before that key (for `event_index` 0, the time from focus to first press). `hold_duration_ms` must be > 0 and `flight_time_ms` ≥ 0.
3. **Retrain**:

   ```bash
   python -m agent4 retrain --events real_sessions.csv.gz --out models_candidate
   ```

   It picks the mixture size by BIC, fits on 60% of the sessions, calibrates on a separate 25%, prints the flag rate on the remaining 15% (this should be **close to 5%**; if it is far off, your sample is not representative or contains automation), and writes a verified model.
4. **Check** the candidate (`python -m agent4 verify --model-dir models_candidate`), run it against known-good and known-bad examples, then promote it (see §7).

## 3. Run it

**Local / bare metal**

```bash
pip install -r requirements.txt
export AGENT4_API_KEYS="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
export AGENT4_REQUIRE_API_KEY=true
python -m agent4 serve --host 0.0.0.0 --port 8000 --workers 2
# or:  uvicorn agent4.service:create_app --factory --host 0.0.0.0 --port 8000 --workers 2
```

**Docker**

```bash
cp .env.example .env        # edit it: set AGENT4_API_KEYS
docker compose up --build
```

> **Honesty note.** The `Dockerfile` and `docker-compose.yml` were written to the standard pattern and reviewed, but they were **not built or run** in the environment where this project was developed (no Docker available there). Build and smoke-test the image once before relying on it: `docker compose up --build`, then `python scripts/smoke_test_server.py` against it (adjust the port), or call `/health`. The service itself *was* started and exercised as a real process over HTTP (`scripts/smoke_test_server.py`).

## 4. Configuration

All settings are environment variables.

| Variable | Default | Meaning |
|---|---|---|
| `AGENT4_MODEL_DIR` | `<project>/models` (`/app/models` in the image) | Folder with `manifest.json` and the bundles |
| `AGENT4_API_KEYS` | empty (auth off) | Comma-separated keys accepted in `X-API-Key` |
| `AGENT4_REQUIRE_API_KEY` | `false` | `true` = refuse to start without a key (use in production) |
| `AGENT4_MAX_EVENTS` | `2000` | Largest `intervals` array accepted per request |
| `AGENT4_MAX_BODY_BYTES` | `262144` | Largest request body |
| `AGENT4_MIN_EVENTS` | trained minimum (10) | Require more keystrokes before scoring; cannot go below the trained minimum |
| `AGENT4_CORS_ORIGINS` | empty (no CORS) | Comma-separated browser origins allowed to call the API |
| `AGENT4_LOG_LEVEL` | `INFO` | Python log level |

## 5. Health, readiness, start-up

* `GET /health` → `200` with `"status": "ok"` and `"model_loaded": true` once ready (`"starting"` before). Use it for liveness and readiness probes. The container `HEALTHCHECK` fails if the model is not loaded.
* If the model files are missing, corrupted or do not match the manifest, **the process exits at start-up** with a clear error. This is deliberate: a service that silently serves a wrong model is worse than one that does not start.
* Scale by adding instances; there is no shared state.

## 6. Monitoring

Log lines contain request id, method, path, status and latency only (never timing data). Track:

| Signal | Why | Alert when |
|---|---|---|
| Latency p95 of `/behavior/analyze` | Regression | Well above the benchmark for your hardware, or above your 15 ms target |
| 5xx rate | Faults | > 0 sustained |
| 4xx rate (422) | A client sending malformed data (e.g. an SDK bug) | A sudden step change |
| Share of `insufficient_data` | The collector is not capturing keystrokes (SDK broken, field not tracked, autofill/paste) | Step change |
| **Share of scored sessions with `behavioral_anomaly = true`** | **Drift and bot campaigns.** For a representative genuine population this stays near 5% (HIGH near 1%). | Sustained far above ~5%: either an attack wave, or real users changed (new device mix / form) so the model needs recalibration. Sustained far below: investigate the collector. |
| `model_version` in responses | Confirm a rollout landed everywhere | Mixed versions after a rollout window |

## 7. Rolling out and rolling back a model

1. Build the candidate (`retrain` or `agent4 all`) into a new folder.
2. `python -m agent4 verify --model-dir <folder>` (SHA-256 check) and run `python scripts/smoke_test_server.py` with `AGENT4_MODEL_DIR=<folder>`.
3. Deploy the folder with the new image or mount, rolling instance by instance. Every response carries `model_version`, so you can see which instances run which model.
4. **Roll back** by pointing `AGENT4_MODEL_DIR` (or the image tag) back to the previous folder. Keep the previous model folder; models are tiny (about 140 KB for both bundles).
5. Re-generate `docs/examples/*.json` (`python scripts/generate_examples.py`) after a model change, so the docs-as-tests keep matching.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Process exits at start with `SHA-256 mismatch` | A model file was edited, truncated or copied without `manifest.json` | Redeploy the folder as a unit; run `python -m agent4 verify` |
| Process exits with `AGENT4_REQUIRE_API_KEY is set but AGENT4_API_KEYS is empty` | Auth required but no key supplied | Set `AGENT4_API_KEYS` |
| `401` | Missing/wrong `X-API-Key` | Check the header and the configured keys |
| `422` on every call from the SDK | Payload has extra fields, `session_id` with a space/@, or numbers sent as strings | Compare with `docs/examples/*.request.json` |
| Everything is `insufficient_data` | Sessions have fewer than 10 keystrokes, or the collector is not attached to the fields | Check the SDK is started and the fields are text inputs |
| Most genuine sessions flagged | Training population does not match real users | Retrain on real genuine sessions (§2) |
| `503` right after start | Model still loading | Wait for `/health` to report `ok` |

## 9. Regenerating everything from scratch

```bash
python -m agent4 all          # data -> model selection -> training -> evaluation -> figures -> reports -> doc numbers
python scripts/generate_examples.py
python -m pytest
python scripts/smoke_test_server.py
```

`python -m agent4 all` is deterministic for a given seed and library versions. It also refreshes the numbers quoted in the README and the model card from `reports/metrics.json`.
