# Privacy and security

This document says exactly what Agent 4 does and does not do with data, how each claim is enforced, and where the protection ends. It is engineering documentation, not legal advice: confirm the legal basis for collecting behavioural timing with your data-protection officer.

## 1. The zero-content guarantee

> Agent 4 never captures, transmits, stores or logs what a person types.

| Layer | What happens | How it is enforced / verified |
|---|---|---|
| **Browser collector** (`frontend/biometrics.js`) | Records, per keystroke, only a key-down time, a key-up time, and the focus time, as numbers. **By default it never reads `event.key`, `event.code`, `event.keyCode`, `event.charCode`, or any input value.** Key-ups are paired with key-downs in first-in-first-out order, so no key identity is needed. | `frontend/tests/sdk_test.html` traps every read of those properties on the events it dispatches and fails if any occurs; it also asserts the payload contains only numbers. |
| **Opt-in precise pairing** (`precisePairing: true`) | Pairs overlapping keys exactly by using `event.code` *transiently in memory* to match a key-up to its key-down. The code is never stored in the buffer or sent. Off by default. | Test in the same page. Enable only if you accept that the SDK then reads `event.code`. |
| **Ignored fields** | Password fields, read-only/disabled fields, non-text inputs, and anything inside an element marked `data-agent4-ignore` are never tracked. | SDK self-test. |
| **Transport / API schema** | The API accepts only `session_id`, `intervals`, `hold_durations`. Any other field is a 422. `session_id` is limited to opaque-token characters (`A–Z a–z 0–9 . _ : -`), so a name or e-mail address cannot be sent. | `tests/test_service.py` (unknown fields, e-mail as session id, numeric strings, booleans, nested lists). |
| **Service** | Stateless. Nothing is written to disk or a database. Request bodies are never logged. Error responses never echo submitted values. Responses carry `Cache-Control: no-store`. | `tests/test_service.py::test_validation_errors_never_echo_the_submitted_values`; the log line contains only request id, method, path, status and latency. |
| **Training data** | Timing only; the raw-event schema is `session_id, behavior_type, split, event_index, hold_duration_ms, flight_time_ms`. `retrain` rejects any file with extra columns. | `tests/test_simulation.py`, `tests/test_pipeline_cli_retrain.py`. |

**What timing can still reveal.** Keystroke timing is a behavioural biometric: with enough data it can, in principle, help recognise a person. Agent 4 does not build per-person templates, only compares a session with a population model, but the timing arrays themselves should still be treated as personal data by the platform. Recommendations: keep them only as long as the audit process needs them; store the *response* (score, category, evidence, model version) rather than the raw arrays where possible; restrict access.

## 2. Authentication and transport

* **API key.** Set `AGENT4_API_KEYS` (comma-separated). Requests to `/behavior/analyze` must send `X-API-Key`. Comparison is constant-time against every configured key. `/health` stays open for probes. With `AGENT4_REQUIRE_API_KEY=true` the service **refuses to start** if no key is configured.
* **TLS.** The service speaks plain HTTP. Terminate TLS at your gateway / load balancer / ingress. Do not expose the container port directly to the internet.
* **Keep the key out of the browser.** Call Agent 4 from your backend. A key shipped to a browser is public.
* **CORS** is off by default; enable `AGENT4_CORS_ORIGINS` only for explicit origins.
* **Rate limiting** is deliberately not implemented in the process (it would be per-worker and bypassable). Apply it at the gateway.

## 3. Hardening already in place

* Body-size limit (default 256 KiB), enforced on declared and streamed bodies; per-request event cap (default 2000).
* Strict schema: no coercion of strings/booleans to numbers, no `NaN`/`Infinity`, no unknown fields.
* **No pickle.** The model is a JSON bundle verified against a SHA-256 manifest before it is used. A modified, truncated or substituted model fails the start-up check (`python -m agent4 verify`). This closes the classic "poisoned model file runs code on load" risk.
* Serving imports only NumPy, FastAPI and Pydantic (a test asserts that scikit-learn, pandas, matplotlib, scipy and joblib are not imported by the service), which keeps the attack surface small.
* Container: unprivileged user, read-only root filesystem and dropped capabilities in `docker-compose.yml`, health check tied to model readiness.
* No stack traces or internal paths in responses; unexpected errors return a generic body with a request id and are logged server-side.

## 4. Threat model

| Threat | Mitigation in this project | Residual risk / what you must do |
|---|---|---|
| A bot injects text with `element.value = …` (no key events) | The session has no timing, so it yields no score (`insufficient_data` or too few events). | **This is itself a signal.** If a form field has content but the collector saw (almost) no keystrokes, that mismatch is suspicious. The platform must compare "field was filled" with "keystrokes were captured"; Agent 4 cannot see content. Paste and autofill have the same signature, so do not treat it as proof. |
| Script drives the page with fixed delays | Caught (regular script, burst injection: see the evaluation report). | None beyond the stated detection rates. |
| Bot adds random delays to imitate humans | Partly caught; detection grows with session length. | Combine with other evidence. |
| Bot copies human timing statistics (mimic) | Partly caught in the stress test. | Needs richer signals. |
| **Replay of recorded real human timing** | **Not detected.** | Needs sequence-level models or non-timing signals (roadmap). |
| Attacker bypasses the SDK and posts crafted timing straight to the API | The API cannot tell fabricated numbers from real ones. Authentication limits who can call it. | Do not expose the API to the public; derive session ids and timing on the server side of your trust boundary where possible; bind a session token to the bid session. |
| Tampering with `biometrics.js` in the client | Not preventable in a browser. | Serve the script from your own origin with Subresource Integrity / CSP; treat client-side data as untrusted. |
| Probing the model to learn the decision boundary | Responses expose the score. | Return the full response only to internal consumers; do not show scores or evidence to bidders. |
| Poisoned retraining data (bots in the "genuine" file) | `retrain` accepts whatever you give it. | Only retrain on sessions verified as genuine; review the held-out flag rate it prints (should be near 5%). |
| Denial of service | Body and event limits; stateless horizontal scaling. | Gateway rate limits and autoscaling. |
| Leaked API key | Keys are rotated by changing the environment. | Store in your secret manager; rotate on suspicion; support two keys during rotation (comma-separated). |

## 5. Security checklist before go-live

- [ ] `AGENT4_REQUIRE_API_KEY=true` and a long random key from your secret manager
- [ ] TLS terminated in front of the service; port not public
- [ ] Gateway rate limiting configured
- [ ] `python -m agent4 verify` passes in the deployed image/volume; model directory is read-only
- [ ] The platform calls Agent 4 from the backend, not the browser
- [ ] Retention period decided for raw timing arrays; responses stored with `model_version`
- [ ] Accessibility path defined for flagged sessions (no automatic rejection)
- [ ] The model has been **retrained on real genuine sessions** and its held-out flag rate checked
- [ ] Monitoring and alerts in place (deployment guide §6)
- [ ] Data-protection sign-off obtained for collecting behavioural timing
