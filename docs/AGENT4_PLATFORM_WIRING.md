# Agent 4 on the platform: how a bid carries a behavioural signal

Agent 4 (`agent-4-behavioral-biometrics/`) scores keystroke **timing** and returns a 0–100 risk signal with evidence. On the platform it feeds a **human review workflow**: signals that need a look wait in a queue, a reviewer clears or escalates each one, and every decision is kept in an audit trail. Nothing blocks a bid automatically (see [Why there is no automatic blocking](#why-there-is-no-automatic-blocking)). This page is the platform side: who may call what, how a bid handler records a signal, the review workflow, the MCP server, and how it behaves when Agent 4 is missing. Access rules for the whole platform are in [ACCESS_CONTROL.md](ACCESS_CONTROL.md).

## Endpoints (`/api/behavior/*`)

| Endpoint | Who | What it does |
| :-- | :-- | :-- |
| `POST /submit` | `msme`, `admin` | Scores the timing sent with a bid and stores the signal. Returns an acknowledgement only, never the score. |
| `POST /analyze` | `government_auditor`, `admin` | Scores one session and returns the full signal with evidence (the Bot Detection page). |
| `GET /signals` | reviewers | Lists stored signals. Filters: `reference`, `needs_review=true`, `review_state=pending\|cleared\|escalated`, `limit`. |
| `GET /signals/{id}` | reviewers | One signal with its full review history. |
| `POST /signals/{id}/review` | reviewers | Record a decision: `{"decision": "cleared" \| "escalated", "note": "..."}`. |
| `GET /summary` | reviewers | Counts by status and category, the queue sizes, and the flag rate against the 5% expected for genuine users. |
| `GET /health` | public | `200` when the model is loaded, `503` when Agent 4 is unavailable. |

Bidders never see a score: a bidder who could read it could tune a script against it. All endpoints except `/health` need a login (`Authorization: Bearer <token>`); the frontend attaches the token to every API call (`frontend/src/lib/api.ts`).

## Recording a signal when a bid is submitted

The bid form collects timing with the Agent 4 collector (`agent-4-behavioral-biometrics/frontend/biometrics.js`, timing only, never the keys) and sends it with the bid:

```js
const collector = Agent4Biometrics.createCollector({ sessionId: crypto.randomUUID() });
collector.start();
// on submit:
const timing = collector.getPayload();      // null when no key was pressed at all
await fetch("/api/behavior/submit", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ reference: bidReference, ...(timing ?? {}) }),
}).catch(() => {});                          // advisory: never block the submission on this
```

If the platform grows a bid-submission endpoint, call the service function instead of the HTTP route:

```python
from src.services.behavior_signals import record_signal

bid = create_bid(db, payload, user)          # the bid is accepted first
record_signal(db, reference=bid.reference, user=user, session_id=payload.session_id,
              intervals=payload.intervals, hold_durations=payload.hold_durations)
```

`record_signal` never raises because of scoring and never blocks the bid.

## What gets recorded

| `status` | Meaning | `needs_review` |
| :-- | :-- | :-- |
| `scored` | Scored. `risk_score` ≥ 50 sets `anomaly`. | when `anomaly` |
| `insufficient_data` | Fewer than 10 keystrokes. Not scored. | no |
| `no_timing` | The bid arrived with no timing at all. A script that fills the form through the page produces exactly this, so it is a signal of its own. Voice input and some assistive tools also produce it: treat it as a reason to look closer, not as proof. | yes |
| `invalid_timing` | Timing was malformed. | yes |
| `unavailable` | Agent 4 was missing or failed. Say nothing about the bidder. | no |

Only derived values are stored (score, category, evidence text). Raw timings and anything typed are never persisted.

## Human review

A signal with `needs_review` starts as `pending`. In the **Bot Detection** page (auditor and admin) the *Review queue* lists pending signals with their evidence; the reviewer writes an optional note and chooses **Clear** (nothing to follow up) or **Escalate** (needs further checks). A decision can be changed; each one is appended to `behavior_review_events` with the reviewer, role, decision, note and time, and earlier decisions are never edited or removed. A review changes nothing about the measurement or about any bid.

## Why there is no automatic blocking

The design is advisory on purpose, and the review workflow is the active part. The calibration puts about 1 in 20 genuine users above the moderate threshold, by design. Automated bids are rare in comparison, so at any realistic rate most flagged bids would belong to honest bidders (`precision_at_prevalence` in `agent-4-behavioral-biometrics/reports/metrics.json`). Rejecting or holding bids on that basis would turn away real bidders in a public procurement system, and the model was trained on simulated typing. A hold is available without changing Agent 4: `record_signal` returns the stored signal, so a bid handler may route `needs_review` bids to a human queue before award. Rejecting a bid on a score alone is not supported.

## MCP server

`backend/src/mcp_server.py` exposes the module to AI assistants and agent frameworks through the Model Context Protocol. It is deliberately **read-only**: it can score a typing-timing session and read stored signals and their review history, but it cannot record or change a decision.

| Piece | Name |
| :-- | :-- |
| Tools | `analyze_keystroke_timing`, `list_behavior_signals`, `get_behavior_signal`, `behavior_model_status` |
| Resource | `procureguard://agent4/interpretation-guide` (how to read a signal and what to say about its limits) |
| Prompt | `review_flagged_bid` (summarise one bid's signals cautiously for a human reviewer) |

* **Mounted in the platform** at `/mcp/` (streamable HTTP). Only signed-in reviewers get through: send the platform JWT as `Authorization: Bearer <token>`. The endpoint only answers requests addressed to hosts listed in `MCP_ALLOWED_HOSTS` (default: localhost), which protects against DNS-rebinding.
* **Standalone over stdio** for a desktop assistant on the same machine: run `python -m src.mcp_server` from `backend/` with the same `.env` as the API. Whoever launches the process is trusted.
* Requires the `mcp` package (in `backend/requirements.txt`). If it is not installed the platform still starts without the endpoint.

## Choosing the detector

The shipped model is a Gaussian mixture. The Isolation Forest of the original design is implemented too (`agent-4-behavioral-biometrics/agent4/iforest.py`) and its trained bundle is in `models_iforest/`. Point `AGENT4_MODEL_DIR` at it to serve it; the platform needs no change. On identical simulated data the mixture detects more of the bots designed to look human; `agent-4-behavioral-biometrics/reports/detector_comparison.md` has the full comparison.

## Deployment

* `main.py` loads Agent 4 lazily. If the folder is missing the platform still starts, `/health` reports `503`, `/analyze` returns `503`, and bids are recorded as `unavailable`.
* Agent 4 is found in this order: `AGENT4_ROOT`, `<repo>/agent-4-behavioral-biometrics`, `<repo>/backend/agent-4-behavioral-biometrics`.
* The backend image must contain the sibling folders (`agent-4-behavioral-biometrics/`, `cartel-graph/`, `solvency-calculator/`), because the route modules locate them relative to their own path. `docker-compose.yml` therefore builds with the **repository root** as context and `backend/Dockerfile`.
* Loading the model verifies a SHA-256 manifest. Do not re-save or hand-edit anything in `agent-4-behavioral-biometrics/models/` or `models_iforest/`.

## Tests

```bash
cd backend
pytest tests/test_behavior_integration.py tests/test_mcp_server.py tests/test_access_control.py -q
```

They cover access control per role, the documented Agent 4 examples scored through the platform, the privacy contract (extra fields rejected, nothing stored raw), the review workflow and its audit trail, degradation when Agent 4 is missing, a regression test that starts the backend from a copy that has no Agent 4 folder next to it, and a complete MCP session over HTTP through the reviewer guard.

## Limits

* The model was trained on synthetic typing only. Before relying on scores, retrain on real genuine sessions (`python -m agent4 retrain`; see `agent-4-behavioral-biometrics/docs/limitations_and_roadmap.md`).
* Timing cannot tell a replay of a real person's rhythm from that person.
* The platform has no bid form or bid record yet, so signals are keyed by a free-text reference. When bids exist, pass the bid's reference to `record_signal`.
