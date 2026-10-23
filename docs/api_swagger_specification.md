# 📖 ProcureGuard-AI: Unified API Swagger Specification & UI/UX Integration Guide

This document is the **official, production-grade OpenAPI / Swagger reference manual** for the entire **ProcureGuard-AI platform**. It brings together all subsystems into unified functional controllers with **complete request/response schemas, curl examples, and UI/UX developer blueprints**.

---

## 🧭 Master Architecture & System Controllers

```
┌────────────────────────────────────────────────────────────────────────┐
│                   LIST OF UNIFIED SYSTEM CONTROLLERS                   │
├──────────────────────────────────────────┬─────────────────────────────┤
│ 1. Authentication & Access Control (RBAC)│ JWT & Role-Based Access     │
│ 2. Bid Eligibility & Compliance Auditor  │ Neurosymbolic PDF Verifier  │
│ 3. Statutory Payment Recovery Engine     │ Section 16 MSMED Math Engine│
│ 4. Corrigendum Integrity & Tamper Detector│ Agent 5 Anti-Fraud Scorer   │
│ 5. Agent 2C: Cartel & Collusion Graph    │ NetworkX Bipartite Ring GNN │
│ 6. Agent 4: Behavioral Biometrics & Bots │ Keystroke Timing Analyzer   │
│ 7. Autonomous Matchmaker & Coalition     │ Module 2 Solo & JV Engine   │
│ 8. GeM Procurement Repository            │ Live Tender Data Exchange   │
│ 9. Procurement Readiness Vault           │ 71.4% Readiness Audit       │
│ 10. M2M Sovereign Ingestion Gateway      │ API Key Server-to-Server    │
│ 11. Asynchronous Task Queue (Workers)    │ Non-Blocking Background Jobs│
│ 12. Multi-Agent Workflow Orchestrator    │ LangGraph StateGraph Engine │
│ 13. System Health & Telemetry            │ Diagnostics & Module Status │
└──────────────────────────────────────────┴─────────────────────────────┘
```

👉 **Live Interactive Swagger UI:** Available in your browser at `http://localhost:8000/docs`  
👉 **ReDoc Interactive Documentation:** Available at `http://localhost:8000/redoc`

---

## 1. Authentication & Access Control (RBAC)

### `POST /api/auth/register`
* **Controller:** `Authentication & Access Control`
* **Purpose:** Registers a new MSME or Government Auditor user. Hashes passwords using 12-round salted bcrypt.
* **Content-Type:** `application/json`

#### Request Body:
```json
{
  "email": "vendor@bharatprecision.in",
  "password": "SecurePassword123!",
  "full_name": "Rajesh Kumar",
  "role": "msme_vendor",
  "organization_name": "Bharat Precision Engineering Pvt Ltd",
  "udyam_registration": "UDYAM-TN-01-0012345"
}
```

#### Response (`201 Created`):
```json
{
  "user_id": "usr_9f81a7b2",
  "email": "vendor@bharatprecision.in",
  "role": "msme_vendor",
  "message": "User registered successfully."
}
```

---

### `POST /api/auth/login`
* **Purpose:** Authenticates user credentials and issues an RFC 7519 HMAC-SHA256 JWT access token.
* **Content-Type:** `application/json`

#### Request Body:
```json
{
  "email": "vendor@bharatprecision.in",
  "password": "SecurePassword123!"
}
```

#### Response (`200 OK`):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in_seconds": 28800,
  "role": "msme_vendor",
  "profile": {
    "user_id": "usr_9f81a7b2",
    "full_name": "Rajesh Kumar",
    "organization_name": "Bharat Precision Engineering Pvt Ltd"
  }
}
```

---

## 2. Bid Eligibility & Compliance Auditor (Module 1)

### `POST /api/tender/analyze`
* **Controller:** `Bid Eligibility & Compliance Auditor`
* **Purpose:** Executes the 10-Sub-Agent Neurosymbolic pipeline. Extracts criteria from multi-page PDFs, verifies compliance deterministically with zero hallucination, calculates Compliance Distance Scores (CDS), and provides plain Hindi/vernacular summaries.
* **Frontend Screen:** `/dashboard`
* **Content-Type:** `multipart/form-data`

#### Request Parameters (Form-Data):
| Field | Type | Required | Description | Example Value |
| :--- | :---: | :---: | :--- | :--- |
| `file` | `UploadFile` | **Yes** | Tender PDF document | `GeM-Bidding-9292805.pdf` |
| `company_name` | `string` | No | Bidding company name | `Bharat Precision Engineering Pvt Ltd` |
| `turnover` | `integer` | No | MSME annual turnover in INR | `4850000` (₹48.5 Lakhs) |
| `experience` | `integer` | No | Years of business experience | `5` |
| `certifications`| `string` | No | Comma-separated certs | `Udyam, ISO 9001` |
| `is_msme` | `boolean` | No | Startup/MSME registered | `true` |
| `target_language`| `string` | No | Vernacular language | `Hindi` |

#### Sample Response (`200 OK`):
```json
{
  "isEligible": true,
  "overallComplianceScore": 87.5,
  "checks": [
    {
      "ruleName": "Earnest Money Deposit (EMD)",
      "status": "EXEMPTED",
      "requiredValue": "₹50,000",
      "actualValue": "MSME Registered",
      "distancePct": 0.0,
      "confidence": 0.95,
      "sourcePage": 12,
      "message": "EMD exempted under Government MSME procurement policy (Rule 173(i) GFR 2017)."
    },
    {
      "ruleName": "Annual Turnover Requirement",
      "status": "PASS",
      "requiredValue": "₹65,00,000",
      "actualValue": "₹48,50,000",
      "distancePct": -25.38,
      "confidence": 0.91,
      "sourcePage": 47,
      "message": "Turnover criterion satisfied via MSME relaxed norms."
    }
  ],
  "missingDocuments": ["Solvency Certificate"],
  "plainSummary": "You are eligible for this tender! Your MSME status exempts you from EMD rules. Ensure you attach a Solvency Certificate before submission.",
  "regionalSummary": "आप इस निविदा के लिए पात्र हैं! आपकी एमएसएमई स्थिति आपको ईएमडी से छूट देती है। कृपया जमा करने से पहले सॉल्वेंसी प्रमाणपत्र संलग्न करें।"
}
```

---

## 3. Statutory Payment Recovery Engine (Module 2)

### `POST /api/payments/track`
* **Controller:** `Statutory Payment Recovery Engine`
* **Purpose:** Implements Section 15 & 16 of the MSMED Act, 2006. Calculates monthly compound interest at **3x the Reserve Bank of India (RBI) Bank Rate** beyond the 45-day statutory limit and generates a legally admissible demand notice.
* **Frontend Screen:** `/payment-tracker`
* **Content-Type:** `multipart/form-data`

#### Request Parameters:
| Field | Type | Required | Description | Example Value |
| :--- | :---: | :---: | :--- | :--- |
| `invoice_file` | `UploadFile` | **Yes** | Commercial Tax Invoice PDF | `Invoice-INV-2025-089.pdf` |
| `receipt_file` | `UploadFile` | **Yes** | Delivery Challan / Proof PDF | `Challan-ACK-441.pdf` |
| `rbi_bank_rate` | `float` | No | Current benchmark repo rate | `6.50` (Effective: 19.50%) |

#### Sample Response (`200 OK`):
```json
{
  "invoiceNumber": "INV-2025-089",
  "buyerName": "South Western Railway, Hubli Zone",
  "principalAmount": 1250000.0,
  "invoiceDate": "2025-11-10",
  "deliveryDate": "2025-11-15",
  "statutoryDueDate": "2025-12-30",
  "daysOverdue": 315,
  "rbiBankRatePct": 6.5,
  "statutoryInterestRatePct": 19.5,
  "penalInterestAccrued": 224618.42,
  "totalPayableAmount": 1474618.42,
  "legalNoticeDraft": "# FORMAL STATUTORY DEMAND NOTICE\nUnder Section 16 & 17 of MSMED Act, 2006..."
}
```

---

## 4. Corrigendum Integrity & Tamper Detector (Agent 5)

### `POST /api/diff`
* **Controller:** `Corrigendum Integrity & Tamper Detector`
* **Purpose:** Compares original tender documents against published corrigenda. Employs `all-MiniLM-L6-v2` dense embeddings and temporal risk decay to detect sneakily modified qualification criteria.
* **Frontend Screen:** `/legal-diff`
* **Content-Type:** `multipart/form-data`

#### Sample Response (`200 OK`):
```json
{
  "corrigendumId": "CORR-2026-003",
  "tamperRiskIndex": 82.4,
  "riskClassification": "HIGH_SEVERITY_TAMPERING",
  "temporalDecayHours": 18.5,
  "flaggedClauses": [
    {
      "clauseNumber": "3.1.4",
      "clauseTitle": "Financial Liquidity Criteria",
      "originalText": "Bidders must have credit line of ₹20 Lakhs.",
      "modifiedText": "Bidders must have credit line of ₹80 Lakhs from a Schedule-A bank.",
      "semanticSimilarity": 0.58,
      "severity": "CRITICAL",
      "impactSummary": "Turnover threshold arbitrarily quadrupled 18 hours before submission closing."
    }
  ]
}
```

---

## 5. Agent 2C: Cartel & Collusion Graph Intelligence

### `GET /api/cartel/bidders`
* **Controller:** `Agent 2C: Cartel & Collusion Graph Intelligence`
* **Purpose:** Retrieves all registered bidding entities, beneficial owners, and submission metadata.
* **Sample Response:**
```json
{
  "bidders": [
    {
      "bidder_id": "B001",
      "name": "Apex Infrastructure Ltd",
      "beneficial_owners": [{"name": "Vikram Malhotra"}],
      "submission_metadata": {
        "ip_address": "192.168.1.104",
        "bank_routing_code": "SBIN0001234"
      },
      "declared_assets": ["Batching Plant A", "Excavator CAT-320"]
    }
  ],
  "count": 1
}
```

---

### `GET /api/cartel/analyze`
* **Purpose:** Evaluates the active bidding network using NetworkX bipartite graph algorithms to detect shared beneficial owners, co-located IP submissions, and common bank routing codes.
* **Frontend Screen:** `/cartel-graph`

#### Sample Response (`200 OK`):
```json
{
  "cartel_detected": true,
  "flagged_networks": [
    {
      "bidders": ["Apex Infrastructure Ltd", "Crest Buildcon Pvt Ltd"],
      "reason": "Shared beneficial ownership (Vikram Malhotra) and identical submission IP address (192.168.1.104)."
    }
  ],
  "anomaly_scores": {
    "B001": 0.85,
    "B002": 0.85,
    "B003": 0.12
  }
}
```

---

### `GET /api/cartel/graph-render`
* **Purpose:** Generates a structured bipartite graph payload (nodes and links) for direct rendering via D3.js or Vis.js in the browser.

---

## 6. Agent 4: Behavioral Biometrics & Bid Rigging Bot Detection

### `POST /api/behavior/analyze`
* **Controller:** `Agent 4: Behavioral Biometrics & Bid Rigging Bot Detection`
* **Purpose:** Scores keystroke release-to-press latency (`intervals`) and key-down to key-up hold times (`hold_durations`). Differentiates scripted automated bots from genuine humans without inspecting typed characters.
* **Frontend Screen:** `/bot-detection`
* **Content-Type:** `application/json`

#### Request Body:
```json
{
  "session_id": "bid-submission-session-882194",
  "intervals": [100.0, 145.2, 120.4, 180.1, 95.6, 130.8, 160.2, 110.5, 140.0, 175.4],
  "hold_durations": [75.1, 80.4, 68.2, 85.0, 72.1, 79.5, 81.0, 74.3, 78.9, 82.5]
}
```

#### Sample Response (`200 OK`):
```json
{
  "session_id": "bid-submission-session-882194",
  "status": "scored",
  "scoring_mode": "full",
  "behavioral_risk_score": 14.2,
  "risk_category": "LOW_ANOMALY",
  "behavioral_anomaly": false,
  "reliability": "medium",
  "events_received": 10,
  "events_scored": 9,
  "behavioral_evidence": [
    "Human-typical flight duration variance observed (CV = 0.24).",
    "No microsecond robotic timing clustering detected."
  ],
  "model_version": "2.0.0+4f20da5f"
}
```

---

## 7. Autonomous Matchmaker & Coalition Builder (Module 2)

### `GET /api/matchmaker/{msme_id}`
* **Controller:** `Autonomous Matchmaker & Coalition Builder`
* **Purpose:** Recommends tenders where the MSME qualifies solo, and constructs AI-synthesized **Joint Venture (JV) Consortiums** when tenders exceed solo turnover limits.
* **Frontend Screen:** `/matchmaker`

#### Sample Response:
```json
{
  "msme_id": "UDYAM-TN-01-0012345",
  "solo_recommendations": [
    {
      "tender_id": "GEM/2026/B/9292805",
      "title": "Supply of CNC Turned Precision Parts",
      "match_confidence": 0.94
    }
  ],
  "consortium_recommendations": [
    {
      "tender_id": "GEM/2026/B/8811200",
      "tender_title": "Turnkey Sub-station Heavy Fabrication",
      "lead_partner": "Bharat Precision Engineering Pvt Ltd",
      "suggested_partner": "Southern Hydraulics Ltd",
      "combined_turnover_inr": 9200000.0,
      "qualification_status": "QUALIFIED_AS_CONSORTIUM"
    }
  ]
}
```

---

## 8. Procurement Readiness Vault

### `GET /api/documents/{msme_id}`
* **Controller:** `Procurement Readiness Vault`
* **Purpose:** Evaluates MSME certificates against standard tender requirements, calculates the **71.4% Procurement Readiness Gauge**, and issues proactive expiry alerts.
* **Frontend Screen:** `/documents`

---

## 9. Machine-to-Machine (M2M) Sovereign Ingestion Gateway

### `POST /api/m2m/sync-tender`
* **Controller:** `Machine-to-Machine (M2M) Sovereign Gateway`
* **Headers:** `X-API-KEY: pg_live_sovereign_secret_key_2026`
* **Purpose:** Server-to-server webhook allowing the GeM / CPPP portal to automatically push newly published RFPs directly into ProcureGuard-AI.

---

## 10. Asynchronous Task Queue (Background Workers)

### `POST /api/jobs/submit`
* **Controller:** `Asynchronous Task Queue`
* **Purpose:** Submits 150-page tenders for non-blocking asynchronous analysis. Returns HTTP `202 Accepted` with a `job_id`.

### `GET /api/jobs/{job_id}`
* **Purpose:** Polls the status of an active analysis worker (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).

---

## 11. Multi-Agent Workflow Orchestrator

### `POST /api/orchestrator/analyze`
* **Controller:** `Multi-Agent Workflow Orchestrator`
* **Purpose:** Executes the complete multi-agent pipeline through the compiled LangGraph StateGraph engine, returning step-by-step audit logs.

---

## 12. System Health & Telemetry

### `GET /health`
* **Controller:** `System Health & Telemetry`
* **Purpose:** Returns comprehensive operational health status across all active modules.

#### Sample Response (`200 OK`):
```json
{
  "status": "ok",
  "message": "ProcureGuard AI Backend is fully operational",
  "modules": [
    "Module 1: MSME NLP Copilot",
    "Module 2: Proactive Matchmaker & Consortium Builder",
    "Agent 2C: Cartel & Collusion Graph Intelligence",
    "Agent 4: Behavioral Biometrics & Bot Detection",
    "Agent 5: Legal Semantic Diff",
    "Tender Marketplace API",
    "Document Vault API",
    "LangGraph Orchestrator"
  ]
}
```

---

## 💡 Frontend Navigation & Route Blueprint Matrix

| Frontend URL | Title / Role | Primary Backend API Route | Subsystem |
| :--- | :--- | :--- | :--- |
| `/` | Landing Portal | `/health` | Core |
| `/marketplace` | GeM Live Repository | `GET /api/tenders` | Module 1 |
| `/dashboard` | Compliance Auditor | `POST /api/tender/analyze` | Module 1 |
| `/payment-tracker` | Section 16 Recovery | `POST /api/payments/track` | Module 2 |
| `/legal-diff` | Corrigendum Diff | `POST /api/diff` | Agent 5 |
| `/cartel-graph` | Cartel & Collusion GNN | `GET /api/cartel/analyze` | Agent 2C |
| `/bot-detection` | Behavioral Biometrics | `POST /api/behavior/analyze`| Agent 4 |
| `/matchmaker` | Solo & JV Consortium | `GET /api/matchmaker/{id}` | Module 2 |
| `/documents` | Readiness Vault | `GET /api/documents/{id}` | Vault |
| `/login` | Access Control | `POST /api/auth/login` | RBAC |
