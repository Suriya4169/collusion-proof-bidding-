# Integration guide — calling Agent 4 from the Procurement Integrity Platform

For the engineers of the PIP backend. Everything here is exercised by `tests/test_service.py`, and every example payload in `docs/examples/` is compared with the live API by a test.

## 1. Where Agent 4 sits

```
Bid form (browser)                PIP backend                          Agent 4
 biometrics.js  --timing-->   (stores session timing)  --POST /behavior/analyze-->  risk signal
                                      |<------------------ JSON response ------------------|
                                      v
                               audit trail / reviewer queue
```

**Recommended:** the browser sends timing to *your* backend, and your backend calls Agent 4 server-to-server with an API key. Do not put the API key in the browser. Direct browser-to-Agent-4 calls are possible (`AGENT4_CORS_ORIGINS`) but then the key is visible to anyone, so only do that for an unauthenticated internal deployment.

Agent 4 is a **stateless pure function** of the timing you send: no database, no session store. Scale it by adding instances.

## 2. When and what to send

* Send the timing of the **whole session so far** (all tracked fields together), not deltas. Each call is independent.
* A typical moment is bid submission. You may also score earlier and again at submission; each call stands alone.
* Include `hold_durations` whenever you can. It selects the **full** model, which is much stronger. Without it the weaker **flight-only** model is used.
* Fewer than **10** keystrokes cannot be scored reliably; you get `status: "insufficient_data"` (see below). Paste and autofill produce no keystrokes at all, so they contribute no timing.
* Sessions longer than **300** keystrokes are scored on the most recent 300 (`events_scored` tells you).

## 3. `GET /health`

Liveness and readiness. Unauthenticated, so load balancers can probe it.

```json
{ "status": "ok", "service": "agent-4-behavioral-biometrics", "version": "2.0.0",
  "model_version": "2.0.0+…", "model_loaded": true,
  "min_events": {"full": 10, "flight_only": 10}, "max_events_scored": 300 }
```

`status` is `"starting"` (and the model fields are empty) until the model has loaded. The process refuses to start at all if the model files fail their integrity check.

## 4. `POST /behavior/analyze`

### Request

| Field | Type | Required | Rules |
|---|---|---|---|
| `session_id` | string | yes | 1–128 characters from `A–Z a–z 0–9 . _ : -` only. An opaque token; it must not encode personal data (an e-mail address or name is rejected). |
| `intervals` | number[] | yes | One value per keystroke event, milliseconds, each ≥ 0. The **first** value is the *onset latency* (focus to first key press) and is excluded from the statistics. The others are release-to-press gaps. At least 5 values; at most `AGENT4_MAX_EVENTS` (default 2000). |
| `hold_durations` | number[] | no | Same length as `intervals`, milliseconds, each > 0 (key-down to key-up). |

Any other field (for example `key`, `text`, `value`) is **rejected with 422**. Numbers must be real JSON numbers: numeric strings, booleans, `null`, `NaN` and `Infinity` are rejected.

The browser collector `frontend/biometrics.js` produces exactly this shape.

### Response (HTTP 200)

| Field | Type | Meaning |
|---|---|---|
| `session_id` | string | Echo of the request. |
| `status` | `"scored"` \| `"insufficient_data"` | `insufficient_data` means the session was too short to score. It is **not** a "safe" verdict. |
| `scoring_mode` | `"full"` \| `"flight_only"` | Which model was used. |
| `behavioral_risk_score` | number \| null | 0–100. **50 = more atypical than 95% of genuine humans of similar length; 75 = more than 99%.** `null` when not scored. |
| `risk_category` | string \| null | `LOW_ANOMALY` (< 50), `MODERATE_ANOMALY` (50–75), `HIGH_ANOMALY` (≥ 75). |
| `behavioral_anomaly` | boolean \| null | `true` when the risk score is ≥ 50. |
| `reliability` | `"low"` \| `"medium"` \| `"high"` \| null | How much timing evidence the score rests on: `low` < 30 keystrokes, `medium` 30–99, `high` ≥ 100. Subtle bots are caught far more often at high reliability; see `reports/evaluation_report.md`. |
| `behavioral_evidence` | string[] | Plain-language descriptors of timing properties that stand out (see below). Descriptive, not causal. |
| `top_deviations` | `{feature, z}`[] | The three features furthest from a typical human of the nearest typing style, in standard deviations. Sign shows direction. |
| `anomaly_score` | number \| null | Raw score (negative log-likelihood under the human model). **Can be negative; compare it only with `operational_threshold`, never across lengths or model versions.** |
| `operational_threshold` | number \| null | The anomaly score that equals risk 50 *at this session length*. |
| `events_received` / `events_scored` | integer | How many events were sent / used. |
| `model_version` | string | Store this with the result. |
| `message` | string \| null | Human-readable explanation when `status` is `insufficient_data`. |

Evidence descriptors you may see: `unusually_regular_flight_timing`, `unusually_regular_hold_timing`, `unusually_erratic_flight_timing`, `unusually_variable_hold_timing`, `unusually_short_flight_intervals`, `unusually_long_flight_intervals`, `unusually_short_key_holds`, `unusually_long_key_holds`, `burst_like_timing_pattern`, `many_ultra_short_key_presses`, `many_long_key_holds`, `no_rapid_key_transitions`, `no_short_key_presses`, `no_long_key_holds`, `absence_of_hesitation_pauses`, `frequent_hesitation_pauses`, `absence_of_long_gaps`, `frequent_long_gaps`, `symmetric_flight_time_distribution`, `flat_flight_time_distribution`, `heavy_tailed_flight_time_distribution`, `extremely_skewed_flight_time_distribution`, `atypical_hold_time_distribution_shape`, `flat_hold_time_distribution`, `rapid_typing_cadence`, `slow_typing_cadence`, `sequential_dependence_in_flight_times`, `unusual_combination_of_timing_features` (the session is atypical overall but no single feature is extreme), `typical_human_timing` (not flagged). Treat the list as open: new descriptors may be added in later versions.

### Errors

| HTTP | When | Body |
|---|---|---|
| 401 | An API key is configured and the `X-API-Key` header is missing or wrong | `{"detail": "Missing or invalid API key."}` |
| 413 | Request body larger than `AGENT4_MAX_BODY_BYTES` (default 256 KiB) | `{"detail": "Request body too large."}` |
| 422 | Malformed payload (unknown field, bad number, mismatched lengths, fewer than 5 values, more than `AGENT4_MAX_EVENTS`, bad `session_id`) | `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}` — submitted values are never echoed |
| 503 | The model is not loaded yet | `{"detail": "Scoring model is not loaded yet."}` |
| 500 | Unexpected error | `{"detail": "Internal error.", "request_id": "..."}` |

Every response carries an `X-Request-ID` header (yours is echoed if you send one) and `Cache-Control: no-store`.

## 5. How to use the signal

This is a **statistical signal about timing**, not evidence of fraud. A genuine person using assistive technology, an unusual keyboard, a remote-desktop session or a very different typing style can look atypical.

| Result | Suggested handling |
|---|---|
| `LOW_ANOMALY` | No action from this signal. |
| `MODERATE_ANOMALY` | Add to a review queue only if other signals agree. Roughly one genuine session in twenty lands here or above. |
| `HIGH_ANOMALY` | Priority for human review; combine with other agents' evidence before any action. About one genuine session in a hundred reaches this band. |
| `insufficient_data` | Treat as *no signal*. Do not read it as safe or as suspicious. |

Never block a bid on this score alone. When bots are rare, most flags are false alarms however good the detector (precision tables are in the evaluation report). Prefer `reliability: "high"` results when deciding priority.

Store, with the audit record: the full response, `model_version`, the request id, and a timestamp. Do **not** store the raw timing arrays longer than your retention policy requires.

## 6. Client examples

**Python (server-side)**

```python
import httpx

resp = httpx.post(
    "http://agent4.internal:8000/behavior/analyze",
    json={"session_id": session_token, "intervals": intervals, "hold_durations": holds},
    headers={"X-API-Key": API_KEY},
    timeout=2.0,
)
if resp.status_code == 200:
    result = resp.json()
    if result["status"] == "scored" and result["risk_category"] == "HIGH_ANOMALY":
        queue_for_review(session_token, result)
    audit_log.write(session_token, result)          # includes model_version
else:
    handle_error(resp.status_code, resp.text)        # do not retry 4xx
```

**curl**

```bash
curl -s http://127.0.0.1:8000/behavior/analyze -H "Content-Type: application/json" \
     -H "X-API-Key: $AGENT4_KEY" -d @docs/examples/human_full.request.json
```

## 7. Timeouts, retries, capacity

* In-process scoring takes well under a millisecond and a full HTTP request through the service about three milliseconds at the 95th percentile (`reports/latency_benchmark.md`). Those figures exclude your network, TLS and gateway, so measure the deployed path.
* Use a short timeout (1–2 s). Retry only on connection errors and 503, with backoff. Never retry 4xx. Calls are idempotent (a pure function of the input), so a retry is safe.
* If Agent 4 is unreachable, the bid flow must continue: this signal is advisory.

## 8. Compatibility with version 1

All version 1 response fields are still present with the same names: `session_id`, `behavioral_risk_score`, `risk_category`, `anomaly_score`, `behavioral_anomaly`, `behavioral_evidence`, `operational_threshold`. **Their meaning changed in important ways**, so do not compare numbers across versions:

* The risk score is now relative to genuine humans of *the same session length*.
* `anomaly_score` is now a negative log-likelihood and can be negative.
* Sessions of 5–9 events now return HTTP 200 with `status: "insufficient_data"` instead of being scored; fewer than 5 still return 422.
* Evidence descriptors were renamed (see the list above).
* New fields: `status`, `scoring_mode`, `reliability`, `top_deviations`, `events_received`, `events_scored`, `model_version`, `message`.
* Unknown request fields are now rejected (422), and `session_id` is restricted to opaque-token characters.

## 9. Testing your integration

* `docs/examples/*.request.json` / `*.response.json` — realistic payloads and the exact answers.
* `python scripts/smoke_test_server.py` — starts the real server and exercises it over HTTP.
* `reports/openapi.json` (or `/docs` on a running instance) — the machine-readable contract.

## A working reference of this flow

The demo website (see [demo_guide.md](demo_guide.md)) implements the flow described above end to end: the browser collector on a bid form, a stand-in platform backend that forwards timing to `/behavior/analyze`, joins the answer with the bid, and records "no behavioural data" when a bid arrives without any keystroke timing. Its code is in `demo/app.py` and is short enough to read as a template for the real backend.
