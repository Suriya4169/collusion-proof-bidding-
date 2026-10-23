# ProcureGuard-AI: System Design & Architecture Document
**Scope:** Author's Individual Scope (Module 1, Module 2, Core Backend Framework, Persistence, and Frontend)  
**Academic Level:** Final Year B.Tech / M.Tech Capstone Project  
**Author:** Kamaladhi  
**Architecture Style:** Decoupled Micro-Tiered Architecture, Neurosymbolic AI, Multi-Agent Orchestration  

---

## 1. System Overview & Scope Definition

This document details the exact system design for the author's primary contributions to the **ProcureGuard-AI** platform. All descriptions strictly exclude peripheral teammate modules (Cartel GNN 2C, Financial Risk Agent 3, Cyber Bot 4, and Government Admin Portal).

### 1.1 In-Scope Subsystems
1. **Module 1 (Autonomous Bid Eligibility & Compliance Auditor):** 10-Sub-Agent pipeline extracting clauses, assessing technical/financial eligibility, computing CDS compliance scores, translating to vernacular languages, and generating actionable defect rectification roadmaps.
2. **Module 1 (Corrigendum Integrity & Tamper Detector - Agent 5):** Semantic redline difference engine tracking temporal modifications and clause dilutions between original tenders and corrigenda.
3. **Module 1 (Statutory Payment Recovery Engine):** Real-time automated calculator enforcing compounding interest penalties (3x RBI repo rate) under Sections 15 & 16 of the MSMED Act 2006, coupled with legal notice generation.
4. **Module 2 (Autonomous Matchmaker & Coalition Builder - Agent 2A & 2B):** Solo tender discovery engine and Joint Venture (JV) coalition builder that algorithmically pairs complementary MSMEs to overcome qualification barriers.
5. **Persistence & Data Pipelines:** Polyglot SQLAlchemy 2.0 ORM engine (PostgreSQL connection pool with SQLite fallback), auto-seeding engine, real-world MSME onboarding, and GeM PDF tender ingestion.
6. **Enterprise Infrastructure & Gateways:** 256-bit JWT authentication with Role-Based Access Control (RBAC), Machine-to-Machine (M2M) Sovereign API Gateway with `X-ProcureGuard-Key` headers, and non-blocking Asynchronous Background Job Queues.
7. **Frontend Application:** High-performance Next.js 16 (Turbopack) dark-mode user interface spanning all 8 core screens.

---

## 2. Multi-Tiered Architectural Hierarchy

ProcureGuard-AI operates on a **4-tier enterprise decoupled architecture**:

```mermaid
graph TD
    subgraph "Tier 1: Presentation Layer (Next.js 16 App Router)"
        UI1["Marketplace (/marketplace)"]
        UI2["Compliance Dashboard (/dashboard)"]
        UI3["Document Vault (/documents)"]
        UI4["Matchmaker (/matchmaker)"]
        UI5["Legal Diff (/legal-diff)"]
        UI6["Payment Tracker (/payment-tracker)"]
        UI7["Enterprise Auth (/login)"]
    end

    subgraph "Tier 2: API Gateway & Security Layer (FastAPI)"
        GW1["JWT & RBAC Security Middleware"]
        GW2["M2M Sovereign API Key Validator"]
        GW3["CORS & Request Normalizer"]
        GW4["Async Task Dispatcher (BackgroundTasks)"]
    end

    subgraph "Tier 3: Multi-Agent Intelligence Layer"
        ORCH["LangGraph StateMachine Orchestrator"]
        AG1["Agent 1: 10-Sub-Agent Compliance Pipeline"]
        AG5["Agent 5: 3-Sub-Agent Semantic Differ"]
        AG2["Agent 2: Solo & JV Coalition Matchmaker"]
        STAT["Statutory MSMED Interest Engine"]
    end

    subgraph "Tier 4: Persistence & Storage Layer"
        ORM["SQLAlchemy 2.0 Engine & Connection Pool"]
        DB[("PostgreSQL 16 (Prod) / SQLite3 (Local)")]
        VFS["Local Encrypted Vault Storage (/vault_storage)"]
        VEC["Ephemeral In-Memory Vectorstore (ChromaDB)"]
    end

    UI1 & UI2 & UI3 & UI4 & UI5 & UI6 & UI7 -->|HTTP / REST JSON| GW1 & GW2 & GW3 & GW4
    GW1 & GW2 & GW3 & GW4 --> ORCH
    ORCH --> AG1 & AG5 & AG2 & STAT
    AG1 --> VEC
    AG1 & AG5 & AG2 & STAT --> ORM
    ORM --> DB
    GW4 --> VFS
```

---

## 3. Subsystem Breakdown (Component by Component)

### 3.1 Presentation Layer (Frontend)
* **Framework:** Next.js 16.3.5 with React 19 and Turbopack compiler.
* **Styling Strategy:** Tailwind CSS 4 with custom dark HSL palette (`#0F172A` Slate-900 background, vibrant blue/indigo/emerald accents).
* **State & Routing:** Next.js App Router with Server-Side Rendering (SSR) fallback and dynamic client hydration (`'use client'`).
* **Resilience:** All dynamic search parameters (`useSearchParams()`) are wrapped inside React `<Suspense>` boundaries to guarantee zero client-side de-opt warnings during compilation.

### 3.2 Gateway & Authentication Layer
* **JWT Token Security:** Generates signed 256-bit HMAC-SHA256 tokens upon user verification.
* **Role-Based Access Control (RBAC):** Protects routes with decorators:
  * `require_roles(["msme"])`
  * `require_roles(["government_auditor", "admin"])`
* **M2M Sovereign Gateway:** Exposes programmatic endpoints (`/api/m2m/v1/*`) protected by `X-ProcureGuard-Key` headers for direct integration with external government servers (GeM / CPPP portal daemons).
* **Async Job Worker:** Heavy tender parsing tasks run via non-blocking worker threads, returning `202 Accepted` with a `job_id` and exposing `GET /api/jobs/{job_id}` for real-time progress polling.

### 3.3 Persistence Layer (Polyglot ORM)
* **ORM Engine:** SQLAlchemy 2.0 with connection pooling (`pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`).
* **Polyglot Design:** 
  * If environment variable `DATABASE_URL` is set $\to$ Connects to PostgreSQL 16.
  * If `DATABASE_URL` is unset $\to$ Seamlessly falls back to local SQLite (`procureguard.db`).
* **Core Relational Schemas:**
  1. `msmes` (`MSMEModel`): Enterprise ID, statutory Udyam number, GSTIN, turnover, experience, capability tags.
  2. `tenders` (`TenderModel`): GeM bid ID, title, ministry, category, turnover threshold, EMD amount, deadline.
  3. `documents` (`DocumentModel`): MSME ID, classified document type, encrypted path, expiry date, audit status.
  4. `users` (`UserModel`): Email, bcrypt hash, role, linked enterprise ID.
  5. `async_jobs` (`JobModel`): Task status (`PENDING`, `PROCESSING`, `COMPLETED`), progress percentage, JSON results.
  6. `m2m_clients` (`M2MClientModel`): Client ID, API key hash, permissions.

---

## 4. End-to-End Request Dataflows

### Flow 1: Live Tender Analysis Pipeline (Module 1)
```mermaid
sequenceDiagram
    autonumber
    actor User as MSME User
    participant Frontend as Dashboard (/dashboard)
    participant API as FastAPI Gateway
    participant Orchestrator as LangGraph StateGraph
    participant Extractor as PyMuPDF Streamer
    participant Chroma as Ephemeral Vector DB
    participant LLM as Llama-3.1 / Gemini
    participant Symbolic as Symbolic Verifier
    participant DB as SQLite / PostgreSQL

    User->>Frontend: Uploads Tender Notice PDF
    Frontend->>API: POST /api/tender/analyze (File + Profile)
    API->>Orchestrator: Dispatches Execution State
    Orchestrator->>Extractor: Extract raw text from pages
    Extractor-->>Orchestrator: Plaintext document stream
    Orchestrator->>Chroma: Chunk text & index embeddings (all-MiniLM-L6-v2)
    Orchestrator->>Chroma: Query financial & eligibility clauses
    Chroma-->>Orchestrator: High-relevance context chunks
    Orchestrator->>LLM: Structured JSON Extraction with Pydantic schema
    LLM-->>Orchestrator: Extracted Rules (EMD, Turnover, Certs)
    Orchestrator->>Symbolic: Mathematical Evaluation against MSME Profile
    Symbolic-->>Orchestrator: Exact Verification Report (CDS Score, Go/No-Go)
    Orchestrator->>DB: Update MSME audit statistics
    Orchestrator-->>API: Unified Verification Report
    API-->>Frontend: 200 OK with CDS score & Defect Rectification Plan
    Frontend-->>User: Renders visual audit dashboard
```

### Flow 2: Autonomous Document OCR & Readiness Gauge (Module 1 Vault)
```mermaid
sequenceDiagram
    autonumber
    actor User as MSME User
    participant Frontend as Document Vault (/documents)
    participant API as Documents API
    participant OCR as PyMuPDF & Regex Classifier
    participant DB as DocumentModel (SQL)

    User->>Frontend: Drops Certificate PDF (e.g. ISO 9001 / GST)
    Frontend->>API: POST /api/documents/extract-and-verify (File + MSME_ID)
    API->>OCR: Reads text stream from uploaded file
    OCR->>OCR: Pattern Match: Classifies type (ISO 9001) & extracts Expiry (2026-12-31)
    OCR->>DB: Upsert record into documents table
    DB->>DB: Recalculate Readiness: (Verified / 7) * 100
    DB-->>API: Updated Document record & live score (71.4% -> 85.7%)
    API-->>Frontend: 200 OK (Detected Type, Expiry, New Readiness Score)
    Frontend-->>User: Visual gauge animates to 85.7% & row turns green
```

### Flow 3: Machine-to-Machine Automated Ingestion (M2M Gateway)
```mermaid
sequenceDiagram
    autonumber
    actor GeM as External GeM Portal Daemon
    participant Gateway as M2M Router (/api/m2m/v1)
    participant Auth as API-Key Authenticator
    participant DB as TenderModel (SQL)
    participant Marketplace as Frontend Marketplace

    GeM->>Gateway: POST /api/m2m/v1/tenders/push (Header: X-ProcureGuard-Key)
    Gateway->>Auth: Validate API Key hash against master key
    Auth-->>Gateway: Access Authorized
    Gateway->>DB: Insert new Tender record into database
    DB-->>Gateway: Record persisted successfully
    Gateway-->>GeM: 201 Created (Tender ID: GEM/2026/B/9991234)
    Marketplace->>DB: GET /api/tenders
    DB-->>Marketplace: Returns active bids
    Marketplace-->>Marketplace: Displays newly pushed tender card in real-time
```

---

## 5. System Design Principles Adhered To

1. **Separation of Concerns:** Presentation logic, business rules, multi-agent reasoning, and storage engines are completely decoupled.
2. **Deterministic Guardrails on Non-Deterministic AI:** The system never lets an LLM guess numerical eligibility. Generative AI extracts structured rules; the deterministic **Symbolic Verifier** calculates compliance mathematically.
3. **Graceful Degradation & Resilience:** If cloud LLM APIs experience rate limits, the system automatically falls back to regex-based heuristic extractors and offline embeddings without crashing.
4. **Zero-Configuration Portability:** The entire system functions out-of-the-box locally via SQLite, but can be scaled to multi-tenant cloud Kubernetes clusters via Docker Compose and PostgreSQL with zero code changes.
