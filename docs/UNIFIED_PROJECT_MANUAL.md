# ProcureGuard-AI — Unified Project Manual

Final-year project submission and viva guide. Everything below was checked against the code on `main` (commit `f52d5a8` plus the frontend redesign) rather than against earlier planning documents; where the two disagree, this manual follows the code.

---

## 1. Overview and problem statement

### 1.1 The problem

Public procurement in India (GeM, CPPP and state portals) moves several lakh crore rupees a year. Two failures recur:

1. **MSMEs are shut out.** A 100-to-150-page tender buries eligibility rules (EMD, turnover, experience, certificates, exemptions) in dense legal English. Small suppliers misread them, get disqualified or never bid. When a buyer pays late, most cannot afford to invoke their statutory remedy under the **MSMED Act 2006**.
2. **The process is manipulated.** Typical patterns are last-minute corrigenda that rewrite qualification criteria to suit one bidder, cartels of nominally independent bidders sharing owners, IP addresses or bank accounts, and scripted bots that submit bids at machine speed.

### 1.2 The solution: neurosymbolic AI

Pure LLM systems hallucinate numbers and rules, which is unacceptable when a wrong "eligible" verdict costs a supplier its bid security. ProcureGuard-AI splits the work:

| Layer | Responsibility | Examples |
| :-- | :-- | :-- |
| **Neural** | Read unstructured text, extract typed fields, translate | Gemini structured extraction, MiniLM embeddings, Hindi simplification |
| **Symbolic** | Make every decision that has legal or financial consequence | Eligibility verifier, compounding-interest engine, graph algorithms, timing statistics |

The LLM never decides eligibility or computes money. It emits a Pydantic-validated JSON object with a confidence and a source page for each field, and Python code does the arithmetic.

### 1.3 Two audiences, two suites

| MSME Vendor Suite | Government Auditor Suite |
| :-- | :-- |
| Am I eligible? Who pays me late? Was the tender altered? Who can I bid with? | Are these bidders colluding? Is this a bot? Can GeM push tenders to us? What did the pipeline do? |

---

## 2. Multi-agent architecture

```text
                    ┌──────────────── Next.js 16 portal (:3000) ────────────────┐
                    │  MSME Vendor Suite            Government Auditor Suite    │
                    └───────────────────────────┬───────────────────────────────┘
                                                │ HTTP/JSON, multipart
┌───────────────────────────────────────────────▼───────────────────────────────┐
│ FastAPI gateway  backend/src/main.py  (:8000, CORS, JWT/RBAC, /docs)          │
├────────────┬────────────┬────────────┬────────────┬────────────┬──────────────┤
│ msme.py    │ legal.py   │ matchmaker │ cartel.py  │ behavior.py│ m2m.py       │
│ Module 1   │ Agent 5    │ Module 2   │ Agent 2C   │ Agent 4    │ jobs.py auth │
├────────────┴────────────┴────────────┼────────────┼────────────┼──────────────┤
│ SQLAlchemy (SQLite default/Postgres) │ cartel-    │ agent-4-   │ LangGraph    │
│ tenders · MSMEs · documents · jobs   │ graph/     │ behavioral │ orchestrator │
└──────────────────────────────────────┴────────────┴────────────┴──────────────┘
```

### 2.1 Module 1 — MSME Copilot (`backend/src/agents/module1/agent1_copilot/`)

`POST /api/tender/analyze` runs the sub-agents in order. The same chain is compiled as a LangGraph `StateGraph` in `backend/src/orchestrator/graph.py` and served at `POST /api/orchestrator/analyze`.

| # | Sub-agent | File | Kind | What it does |
| :-- | :-- | :-- | :-- | :-- |
| 1.1 | PDF extractor | `pdf_extractor.py` | Symbolic | PyMuPDF text extraction, page-aware |
| 1.2 | Ephemeral RAG | `rag_retriever.py` | Neural + lexical | Chunks the tender, builds an in-memory hybrid index (BM25 + MiniLM dense) and retrieves only passages about EMD, turnover, experience, exemptions and certificates. Nothing is persisted, and the LLM sees only the retrieved passages. The orchestrator log prints a fixed "97% token reduction" label; the portal instead recomputes the real figure from the character counts in the same log |
| 1.3 | Neural extractor | `neural_extractor.py` | Neural | Gemini with a strict `TenderRequirements` Pydantic schema: typed integers, never strings |
| 1.5 | Confidence scorer | schema fields | Neural | Each rule carries `*_confidence` and `*_source_page`, which the UI shows as "Page 47 · 91%" |
| 1.4 / 1.6 / 1.8 | Symbolic verifier | `symbolic_verifier.py` | Symbolic | Pure-Python comparison against the Udyam profile. Emits `PASS`, `FAIL`, `EXEMPTED` or `INFO` per rule, a **Compliance Distance Score** (`distancePct`, positive = exceeds the requirement) and a weighted overall score. Lists missing documents |
| 1.7 | Tender simplifier | `tender_simplifier.py` | Neural | Plain-English summary and Hindi (or other regional) translation of the *already decided* verdict |
| 1.9 | Scheme discoverer | `scheme_discoverer.py` | Symbolic rules | Maps compliance gaps to schemes (e.g. ZED certification subsidy) |
| 1.10 | Payment tracker | `payment_tracker.py` | Symbolic | See Module 2 below |

**EMD exemption.** MSEs are exempt from EMD under Rule 173(i) of GFR 2017 and the Public Procurement Policy for MSEs Order 2012. The verifier emits `EXEMPTED` with the rule's message, and the UI footnotes the citation.

### 2.2 Module 2 — Legal and dispute resolution

**Statutory payment recovery** (`payment_tracker.py`, `invoice_extractor.py`, `POST /api/payments/track`):

1. Gemini extracts invoice date, payment date, principal and buyer name from the invoice and receipt PDFs (`invoice_extractor.py`).
2. A deterministic engine applies **MSMED Act 2006**:
   - **§15**: payment is due within 45 days.
   - **§16**: interest is **3 × the RBI Bank Rate**, compounded **monthly**. At the configured rate of 6.5% this is **19.5% p.a.**
   - **§17**: the buyer is liable for the amount and the interest.
3. Computation: `days_overdue = (payment − invoice) − 45`, `m = ceil(days_overdue / 30)`, `total = P·(1 + 0.195/12)^m`, `interest = total − P`. The result is rounded to the paisa.
4. A demand-notice draft is generated from the verified figures.

The frontend re-derives the month-by-month schedule from the principal in the notice and shows "Reconciled with server" only if its total matches the server's to within ₹0.01.

*Known simplification:* the engine counts the 45 days from the invoice date; the Act counts from the day of acceptance or deemed acceptance.

**Agent 5 — Corrigendum tampering diff** (`agent5_legal_diff/`, `POST /api/diff`):

1. `clause_extractor.py` splits the original RFP and the corrigendum into clauses.
2. `semantic_differ.py` embeds clauses with `all-MiniLM-L6-v2` and flags pairs whose cosine similarity is below **0.75**.
3. `corruption_risk_scorer.py` has Gemini label each flagged pair `RESTRICTIVE`, `PERMISSIVE` or neutral and assign a base risk. It then multiplies by a **temporal multiplier**: the closer to bid closing, the higher the weight. It returns `overall_manipulation_probability` (0–1), `risk_level`, `flagged_clauses` and `temporal_multiplier`.

**Matchmaker and consortium builder** (`agent2_matchmaker/`, `GET /api/matchmaker/{msme_id}`): scores every open tender against the MSME on sector (hard gate), turnover, experience and certificates. Startup-exempt tenders bypass turnover and experience. For tenders the MSME fails, `consortium_builder.py` searches for a same-sector partner that fills the exact gap (turnover, certificates, experience) and returns the combined turnover.

**Proactive match notifier (push half of the matchmaker)** (`services/match_notifier.py`, `routes/notifications.py`): an asyncio daemon started in the FastAPI lifespan re-runs the same solo and JV rules over every MSME and every open (Active, not past deadline) tender, then stores one `match_notifications` row per (MSME, tender, kind). A unique constraint makes scans idempotent, so the daemon, event triggers and multiple workers cannot create duplicates. Scans also run immediately after a tender is created (`POST /api/tenders`, `/api/tenders/upload-pdf`, `/api/m2m/v1/tenders/push`) or an MSME registers. Interval: `MATCH_SCAN_INTERVAL_SECONDS` (default 300; `0` disables the daemon). Endpoints: `GET /api/notifications/{msme_id}`, `POST /api/notifications/item/{id}/read`, `POST /api/notifications/{msme_id}/read-all`, `POST /api/notifications/scan`, `GET /api/notifications/daemon/status`. The portal shows a bell with an unread badge (polled every 30 s) in the Vendor Suite navbar. Delivery is in-app only; email/SMS/webhook delivery is not implemented.

### 2.3 Agent 2C — Cartel and collusion graph (`cartel-graph/`)

Built by a separate contributor as a standalone service (`cartel-graph/main.py`, plus a small HTML/JS demo) and mounted into the gateway by `backend/src/api/routes/cartel.py`, which adds the repository's `cartel-graph/` folder to `sys.path`.

- `graph.py` builds a **NetworkX bipartite graph**: bidder nodes on one side; beneficial owners, submission IP addresses, bank routing codes (IFSC) and declared assets on the other.
- A bidder pair joined through a shared attribute node within two hops is a collusion candidate.
- `scoring.py` assigns every bidder an anomaly score in [0, 1] and `build_cartel_summary` produces `cartel_detected`, `flagged_networks` (bidder groups with an evidence sentence) and `anomaly_scores`.
- `build_graph_render_payload` emits `bidders`, `metadata`, `bipartite` edges and `anomalyScores` for the UI. The portal draws these as an SVG bipartite diagram.

### 2.4 Agent 4 — Behavioural biometrics (`agent-4-behavioral-biometrics/`)

Contributed as a complete package (model artefacts, evaluation reports, demo, tests, model card) and wrapped by `backend/src/api/routes/behavior.py`.

- Input: only **timings**. Flight times (`intervals`, key release → next key press) and dwell times (`hold_durations`, key down → up), both in milliseconds. Typed characters are never sent, which matches the privacy posture in `agent-4-behavioral-biometrics/docs/privacy_and_security.md`.
- `BehaviorScorer` selects a scoring mode (`full` or `flight_only`) by available data and session length, and returns a **0–100 behavioural risk score**, a `risk_category`, a `reliability` rating (`low`/`medium`/`high`), counts of events received and scored, and plain-language `behavioral_evidence` bullets (for example, robotic timing clustering).
- It is advisory: it flags sessions for audit and never blocks a bid.
- Demonstration: the portal's *Simulate automated script bot* button sends 45 events at a fixed 12 ms flight / 8 ms hold. That is zero variance, which no human produces, so the verdict is high risk.

### 2.4b Agent 3 — Solvency and ledger verification (`solvency-calculator/`)

Mounted by `backend/src/main.py` (adds `solvency-calculator/` to `sys.path`, includes `app.routers.api`); endpoints live under `/api/v1/agent/solvency/*` (`analyze`, `verify-json`, `results`, `health`, `registration`).

Pipeline: PDF text extraction (pdfplumber, PyMuPDF fallback, password support) → Gemini maps column layout only → `LedgerConstraintVerifier` (`ledger_verifier.py`):

| Check | Rule |
| :-- | :-- |
| Row recurrence | `B_t = B_{t−1} + C_t − D_t` within ₹0.05; an OCR digit-confusion lattice may repair a row, otherwise `UNEXPLAINABLE_RESIDUAL` (CRITICAL) |
| Page continuity | `opening(p+1) = closing(p)` (CRITICAL) |
| Window dressing | robust Z of last-30-day mean balance vs prior median, using 1.4826·MAD; flag at ≥ 3 (HIGH) |
| Round trips | large credit reversed by a near-equal debit within 7 days with matching narration (HIGH) |
| Benford | max leading-digit deviation; flag above 0.25 with ≥ 30 amounts (LOW); not tested below 20 amounts |
| Metrics | time-weighted average balance, min/max, coefficient of variation, OLS monthly slope |

Verdict: any CRITICAL → `FAILED`; else any HIGH → `SUSPICIOUS`; else `PASSED`. `ABSTAINED` is used when extraction fails.

### 2.5 Enterprise infrastructure

| Component | Files | Notes |
| :-- | :-- | :-- |
| **JWT + RBAC** | `routes/auth.py`, `core/auth.py` | bcrypt (12 rounds) password hashing; HS256 JWT; roles `msme`, `government_auditor`, `admin`; a `require_roles([...])` dependency is provided. Secret from `JWT_SECRET`. **Current limitation:** only `GET /api/auth/me` enforces a token; the business endpoints are open and `require_roles` is not yet applied to any route |
| **M2M Sovereign Gateway** | `routes/m2m.py` | Prefix `/api/m2m/v1`. Authenticated by the `X-ProcureGuard-Key` header, compared with `M2M_MASTER_KEY`. Missing key → 401; wrong key → 403 |
| **Async job queue** | `routes/jobs.py` | `POST /api/jobs/tender-analyze` returns 202 with a `job_id`; `GET /api/jobs/{job_id}` reports status and progress. Used for 150-page tenders |
| **Persistence** | `db/database.py`, `db/models.py`, `db/seed.py` | SQLAlchemy. SQLite file by default; Postgres when `DATABASE_URL` is set. Seeded on startup |
| **Orchestrator** | `orchestrator/graph.py`, `state.py` | LangGraph `StateGraph`, six nodes, linear edges, errors short-circuit via `state["error"]` |
| **Containers** | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` | Postgres 16 + backend + frontend |

---

## 3. Frontend (Next.js 16, Turbopack)

`frontend/` uses the App Router, React 19, Tailwind CSS 4 and `lucide-react`. All API access goes through `frontend/src/lib/api.ts` (base URL `http://localhost:8000`, typed response interfaces, friendly offline errors). Shared UI primitives are in `frontend/src/components/ui.tsx`.

The visual language is deliberately sober: slate canvas, IBM Plex Mono for IDs and figures, ₹ in Indian digit grouping, statute citations in each page header, and a raw-JSON drawer with copy and export on every result.

### 3.1 Dual-portal navigation

The navbar has a segmented switcher: **MSME Vendor Suite** and **Government Auditor Suite**. The route decides the persona (`/cartel-graph` is auditor, `/dashboard` is vendor); neutral routes remember the last choice in `localStorage`. A pulsing dot polls `GET /health` every 15 s and shows latency.

### 3.2 Routes

`npm run build` produces **13 application routes** (14 entries counting Next's built-in `/_not-found`).

| Route | Suite | Backend call | Highlights |
| :-- | :-- | :-- | :-- |
| `/` | Both | – | Operations index of both suites |
| `/login` | Both | `POST /api/auth/login` | Role selector (Vendor / Auditor); the account's server role sets the persona in `localStorage` and the landing page |
| `/marketplace` | Vendor | `GET /api/tenders` | Typed sector filters and search, deadline countdown, ingest-PDF modal; shows an error with Retry when the API is down (no fabricated offline data) |
| `/dashboard` | Vendor | `POST /api/tender/analyze` | Compliance gauge; PASS/EXEMPTED/FAIL counts; per-rule table with page citation and confidence; English/हिन्दी tabs |
| `/payment-tracker` | Vendor | `POST /api/payments/track` | 45-day timeline, month-by-month interest at 19.5% p.a., reconciliation badge, Copy Markdown and Print notice |
| `/legal-diff` | Vendor | `POST /api/diff` | Tampering risk gauge, "modified N days before bid closing" badge, word-level redline |
| `/matchmaker` | Vendor | `GET /api/matchmaker/{id}`, `GET /api/msme/all` | Solo-qualified data grid; JV cards with lead, co-partner, combined turnover and indicative equity split |
| `/documents` | Vendor | `GET /api/documents/{id}`, `POST …/extract-and-verify`, `POST …/upload`, `DELETE …/{id}` | Readiness gauge; certificate checklist; expiry and renewal alerts |
| `/cartel-graph` | Auditor | `GET /api/cartel/bidders`, `/analyze`, `/graph-render` | SVG bipartite graph, cluster alerts with evidence, bidder table, graph JSON export |
| `/solvency` | Auditor | `POST /api/v1/agent/solvency/analyze`, `…/verify-json` | Verdict banner, Z-score / Benford / TWAB / CV cards, flags, row-level audit ledger, sample statements |
| `/bot-detection` | Auditor | `POST /api/behavior/analyze` | Live keystroke sandbox, flight/dwell charts, bot simulation, risk meter, reliability, evidence |
| `/m2m-gateway` | Auditor | `/api/m2m/v1/*` | Request composer with `X-ProcureGuard-Key`, transaction stream with status, latency and a client-computed HMAC SHA-256 digest |
| `/agent-pipeline` | Auditor | `POST /api/orchestrator/analyze` | Six-node graph, node log, context-reduction telemetry from the node logs |

### 3.3 Honest limits of the UI

- The M2M "HMAC SHA-256" column is computed in the browser over the request body, keyed with the entered key. The server does not issue or verify signatures; the key header is the only credential.
- The orchestrator returns its logs once the graph finishes, without per-node timestamps, so `/agent-pipeline` resolves node states after completion instead of streaming.
- The JV equity split is derived from relative turnover; the backend does not compute one.

---

## 4. Reconciled API contract

Interactive reference: `http://localhost:8000/docs`. JSON field casing differs per module, which is a real feature of the code and is reflected in the TypeScript interfaces.

| Method and path | Auth | Request | Response (casing) |
| :-- | :-- | :-- | :-- |
| `GET /health` | – | – | `{status, message, modules[]}` |
| `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` | – / – / Bearer | JSON | login returns `access_token`, `role`, `profile` |
| `POST /api/tender/analyze` | – | multipart: `file`, `company_name`, `turnover`, `experience`, `certifications`, `is_msme`, `target_language` | **camelCase** `VerificationReport`: `isEligible`, `overallComplianceScore`, `checks[{ruleName,status,requiredValue,actualValue,distancePct,confidence,sourcePage,message}]`, `missingDocuments`, `plainSummary`, `regionalSummary`, `recommendedSchemes` |
| `POST /api/payments/track` | – | multipart: `invoice_file`, `receipt_file`, `company_name` | **camelCase** `{daysOverdue, isPenaltyApplicable, penaltyAmountInr, demandNoticeDraft}` |
| `POST /api/diff` | – | multipart: `original_pdf`, `corrigendum_pdf`, `days_before_deadline` | **snake_case** `{overall_manipulation_probability, risk_level, flagged_clauses[], days_before_deadline, temporal_multiplier}` |
| `GET /api/cartel/bidders` · `GET/POST /api/cartel/analyze` · `GET/POST /api/cartel/graph-render` · `POST /api/cartel/bidders` · `GET /api/cartel/health` | – | POST variants take `{bidders:[…]}` | `{bidders,count}`; `{cartel_detected,flagged_networks,anomaly_scores}`; `{bidders,metadata,bipartite,anomalyScores}` |
| `POST /api/behavior/analyze` · `GET /api/behavior/health` | – | `{session_id, intervals[], hold_durations[]}` (ms) | `{session_id,status,scoring_mode,behavioral_risk_score,risk_category,behavioral_anomaly,reliability,events_received,events_scored,behavioral_evidence[],model_version}` |
| `GET /api/matchmaker/{msme_id}` | – | – | `{msme_profile, solo_opportunities{count,tenders[{tender,score}]}, joint_venture_opportunities{count,tenders[{tender,recommended_partner}]}, missed_opportunities}` |
| `GET /api/msme/all` · `POST /api/msme/register` | – | register: JSON, Udyam `UDYAM-XX-00-0000000` and 15-char GSTIN validated | list / created profile |
| `GET /api/tenders` · `GET /api/tenders/{id}` · `POST /api/tenders` · `POST /api/tenders/upload-pdf` | – | – | tender records |
| `GET /api/documents/{msme_id}` · `POST /api/documents/upload` · `POST /api/documents/extract-and-verify` · `DELETE /api/documents/{id}` | – | multipart | vault with `readiness_score`, `vault_documents`, `missing_documents`, `proactive_alerts` |
| `POST /api/jobs/tender-analyze` (202) · `GET /api/jobs/{job_id}` | – | multipart | `job_id`; status `PENDING/PROCESSING/COMPLETED/FAILED`, progress |
| `POST /api/orchestrator/analyze` | – | multipart as tender analyze | `{verification_report, plain_summary, regional_summary, recommended_schemes, orchestration_logs[]}` |
| `POST /api/m2m/v1/tenders/push` (201) | `X-ProcureGuard-Key` | JSON `M2MTenderPushRequest` (`tender_id`, `title`, `department`, `category`, `estimated_value_inr`, `emd_amount_inr`, `min_turnover_lakhs`, `min_experience_years`, `allows_startup_exemption`, `submission_deadline`) | `{status: SUCCESS\|EXISTS, message, tender}` |
| `GET /api/m2m/v1/compliance/{tender_id}/{msme_id}` | `X-ProcureGuard-Key` | – | `{is_eligible, turnover_check, experience_check, sovereign_trust_index, …}` |
| `POST /api/m2m/v1/webhooks/subscribe` | `X-ProcureGuard-Key` | `{callback_url, event_types[], secret_token}` | `{status: ACTIVE, subscription_id, …}` |

### Corrections to `docs/api_swagger_specification.md`

That earlier reference was written ahead of the code. It is wrong in these places; this manual and `/docs` take precedence.

| Swagger guide says | Code does |
| :-- | :-- |
| `POST /api/m2m/sync-tender`, header `X-API-KEY` | `POST /api/m2m/v1/tenders/push`, header `X-ProcureGuard-Key` |
| `POST /api/jobs/submit` | `POST /api/jobs/tender-analyze` |
| Tender and payment keys such as `invoiceNumber`, `buyerName`, `principalAmount`, `tamperRiskIndex` | Payment returns only `daysOverdue`, `isPenaltyApplicable`, `penaltyAmountInr`, `demandNoticeDraft`; diff returns `overall_manipulation_probability` and snake_case keys |
| `GET /api/matchmaker` returns `solo_recommendations`, `consortium_recommendations` | Returns `solo_opportunities`, `joint_venture_opportunities`, `missed_opportunities` |
| Temporal decay in hours | Diff takes `days_before_deadline` |

---

## 5. One-command startup

Prerequisites: Python 3.12, Node.js 20+, a Gemini API key.

```bash
# one-time (repo root)
cp .env.example .env                 # set GEMINI_API_KEY  (Windows: copy)
python -m venv backend/venv && backend/venv/Scripts/activate      # Linux/macOS: source backend/venv/bin/activate
pip install -r backend/requirements.txt -r cartel-graph/requirements.txt -r agent-4-behavioral-biometrics/requirements.txt
cd frontend && npm install && cd ..

# terminal 1 — API on :8000 (run from the repo root)
uvicorn src.main:app --app-dir backend --reload --port 8000

# terminal 2 — UI on :3000
cd frontend
npm run dev
```

PowerShell users can chain with `;` and activate the venv with `backend\venv\Scripts\Activate.ps1`.

| Check | URL |
| :-- | :-- |
| Web console | `http://localhost:3000` |
| **Swagger UI** | **`http://localhost:8000/docs`** |
| Health | `http://localhost:8000/health` |

Environment variables:

| Variable | Purpose | Default |
| :-- | :-- | :-- |
| `GEMINI_API_KEY` | Gemini extraction, OCR dates, clause classification | required for those endpoints |
| `M2M_MASTER_KEY` | Value expected in `X-ProcureGuard-Key` | development default in `m2m.py`; **set your own** |
| `JWT_SECRET` | JWT signing | development default; **set your own** |
| `DATABASE_URL` | Postgres URL | SQLite file `backend/procureguard.db` |

Docker alternative: `docker compose up --build` starts Postgres, the API and the frontend. `docker-compose.yml` contains placeholder development secrets, so replace them before any shared deployment.

Production check for the frontend: `cd frontend && npm run build`.

Troubleshooting: the navbar dot turns red when the API is not running; every page then shows a "Cannot reach the ProcureGuard API" banner with a Retry button.

---

## 6. Repository audit (state of `main`)

**Provenance.** `main` (`f52d5a8`) was assembled by `8c5bf5c`, a merge of `integration-main`, which carries the `msme-copilot` history. The `Cartel-graph` and `agent-4-behavioral-biometrics` remote branches were **copied in as files** (commit `a7efec6`), not merged. Their commits are therefore not ancestors of `main`: file content is byte-identical (cartel-graph 14/14 files; agent-4 114/114) but `git log` on `main` attributes those files to the integrator. Contributors' own commits remain on their branches.

**Candidates for cleanup (not yet removed):**

| Item | Why |
| :-- | :-- |
| `backend/src/agents/cartel_graph/` | Byte-identical duplicate of top-level `cartel-graph/`; nothing imports it (the router uses `cartel-graph/`) |
| `legacy_vite_ui/`, `metadata.json` | Superseded Vite/AI-Studio prototype; replaced by `frontend/`. `.env.example` is also the AI Studio template |
| `backend/src/routers/` (`diff.py`, `extract.py`), `backend/src/services/gemini_service.py` | Zero-byte files, unreferenced |
| `backend/src/orchestrator/mock_agents.py`, `…/agent5_legal_diff/corruption_scorer.py`, `backend/scripts/setup_env.py` | Zero-byte files, unreferenced |
| `backend/scripts/temp_extract.py` | Scratch script |
| `docs/system_architecture_my_part.md`, `learning_roadmap.md`, `execution_roadmap.md`, `implementation_plan.md` and other planning docs | Early planning material, partly superseded by this manual |
| `frontend/README.md` | `create-next-app` boilerplate |

`.gitignore` already excludes `__pycache__`, `*.db`, `node_modules`, `.next` and upload folders, and no tracked build artefacts or secrets files were found. `backend/venv/` and `backend/procureguard.db` exist locally but are untracked.

---

## 7. Viva guide

### 7.1 Two-minute pitch

> "Small suppliers lose government tenders because they cannot parse 150-page documents, and public buyers lose money to altered tenders, bidder cartels and bots. ProcureGuard-AI is a multi-agent system with one rule: the language model reads, but code decides. Gemini extracts typed fields with page citations; a symbolic verifier produces the eligibility verdict and a compliance distance score; a deterministic engine computes MSMED Act interest at 3× the RBI rate; graph algorithms and timing statistics expose collusion and automation."

### 7.2 Likely questions

| Question | Answer |
| :-- | :-- |
| Why not just use an LLM end to end? | LLMs hallucinate numbers and cannot be audited. We confine the LLM to extraction and translation, validate output against a Pydantic schema, and put all decisions in tested Python. |
| How do you handle a wrong extraction? | Every field carries a confidence and source page, so a human can verify against the cited page. Low confidence is visible in the UI. |
| What is the Compliance Distance Score? | `(actual − required) / required × 100` per rule: negative means a shortfall. It is more informative than a pass/fail flag because it shows how far from eligible a bidder is. |
| How is interest computed? | §16 MSMED Act: 3 × RBI Bank Rate (6.5% → 19.5% p.a.), monthly rests, after the 45-day limit: `P·(1 + 0.195/12)^⌈days_overdue/30⌉ − P`. |
| Why a graph for cartels? | Collusion shows up as shared structure: owners, IPs, banks. A bipartite graph makes pairs of "independent" bidders connected through a shared node directly queryable. |
| Can the bot detector be fooled? | A sophisticated attacker could replay human-like timing; see `agent-4-behavioral-biometrics/docs/limitations_and_roadmap.md`. It is a risk signal for auditors, not a gate, and it uses only timing, which limits privacy exposure. |
| How is data privacy handled? | RAG indices are ephemeral and in-memory; the biometrics agent receives no characters; secrets come from environment variables. |
| What would you improve next? | Count the 45 days from deemed acceptance; add webhook delivery with real HMAC verification; per-node timestamps from the orchestrator; Module 3 (auto-bidder) and Module 4 (CV progress auditor); enforce `require_roles` on the business endpoints (JWT is issued but only `/api/auth/me` checks it); per-client hashed M2M keys (`M2MClientModel` exists but is unused and the gateway compares one master key). |

### 7.3 Demo script (8 minutes)

1. `/` — show both suites; point at the health dot.
2. `/dashboard` — upload `backend/test_data/GeM-Bidding-9292805.pdf`; show gauge, citations, Hindi tab, raw JSON.
3. `/legal-diff` — upload `GeM-Bidding-9292805.pdf` and `GeM-Bidding-9292805-CORRIGENDUM.pdf` with 2 days; explain the redline and temporal weighting.
4. `/payment-tracker` — upload invoice and receipt; show the 45-day timeline and the reconciled schedule; print the notice.
5. `/matchmaker` — switch enterprise; show a JV card.
6. Switch to **Government Auditor**: `/cartel-graph` (hover a cluster), `/bot-detection` (type, then *Simulate bot*), `/m2m-gateway` (send without a key → 401, then with the key), `/agent-pipeline` (execute, show context reduction).
