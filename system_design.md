# System Design & Infrastructure Blueprint
## Intelligent Procurement Integrity Platform

---

## 1. Full-Stack Component Architecture

The entire product is built as a **3-Tier Web Application**: Frontend (Client) → Backend (API + AI) → Database (Storage).

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 1: FRONTEND (Client)                     │
│                                                                 │
│   Next.js 14 (React) + TailwindCSS + ShadCN UI Components      │
│                                                                 │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│   │ MSME Portal  │  │  Govt Admin  │  │  Voice Interface     │  │
│   │ (Upload PDF, │  │  Dashboard   │  │  (Mic Button +       │  │
│   │  Bank Stmt,  │  │  (Cartel     │  │   Audio Playback)    │  │
│   │  View Score) │  │   Graphs,    │  │                      │  │
│   │              │  │   Red Flags) │  │                      │  │
│   └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│   + FingerprintJS (Device tracking)                             │
│   + Web Audio API (Microphone capture)                          │
│   + Keystroke Logger (Behavioral biometrics JS)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS REST API Calls (JSON)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 2: BACKEND (Server)                      │
│                                                                 │
│   Python 3.11+ with FastAPI                                     │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              LangGraph Orchestrator                      │   │
│   │  (State Machine: Routes requests to the 5 Major Agents)  │   │
│   └────┬──────┬──────┬──────┬──────┬────────────────────────┘   │
│        │      │      │      │      │                            │
│        ▼      ▼      ▼      ▼      ▼                            │
│   ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐                     │
│   │NLP   ││Graph ││Fin   ││Cyber ││Legal │                     │
│   │Agent ││Agent ││Agent ││Agent ││Agent │                     │
│   └──────┘└──────┘└──────┘└──────┘└──────┘                     │
│                                                                 │
│   + LangChain (LLM orchestration)                               │
│   + ChromaDB / FAISS (Vector store for RAG)                     │
│   + NetworkX (Graph algorithms)                                 │
│   + Scikit-Learn (ML models)                                    │
│   + Sentence-Transformers (Semantic NLP)                        │
│   + PyMuPDF (PDF parsing)                                       │
│   + Tesseract / Google Document AI (OCR)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ SQL Queries / ORM
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 3: DATABASE (Storage)                    │
│                                                                 │
│   ┌──────────────────┐  ┌──────────────────┐                   │
│   │  Supabase        │  │  ChromaDB /      │                   │
│   │  (PostgreSQL)    │  │  FAISS           │                   │
│   │                  │  │                  │                   │
│   │  - User profiles │  │  - PDF text      │                   │
│   │  - Bid records   │  │    embeddings    │                   │
│   │  - IP logs       │  │  - Semantic      │                   │
│   │  - Financial data│  │    search index  │                   │
│   │  - Audit trails  │  │                  │                   │
│   └──────────────────┘  └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Full-Stack Components

### 2.1 Frontend Stack

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Framework | `Next.js` | 14.x | React-based SSR framework with App Router |
| Language | `TypeScript` | 5.x | Type-safe frontend development |
| Styling | `TailwindCSS` | 3.x | Utility-first CSS framework for rapid UI |
| UI Library | `ShadCN/UI` | Latest | Pre-built, accessible React components (buttons, modals, cards) |
| Charts | `Recharts` / `Chart.js` | Latest | Dashboard visualizations (compliance scores, risk meters) |
| Graph Viz | `React Force Graph` / `D3.js` | Latest | Interactive cartel network visualization on admin dashboard |
| Audio | `Web Audio API` (native) | — | Microphone recording for voice queries |
| Fingerprint | `FingerprintJS` | Open Source | Browser/device fingerprinting for bot detection |
| HTTP Client | `Axios` / `fetch` | — | API calls to the FastAPI backend |
| State Mgmt | `Zustand` / `React Context` | — | Client-side state management |

### 2.2 Backend Stack

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Framework | `FastAPI` | 0.100+ | High-performance async Python API server |
| Language | `Python` | 3.11+ | Core language for all AI/ML logic |
| Agent Framework | `LangGraph` | Latest | Defines the Multi-Agent DAG workflow |
| LLM Orchestration | `LangChain` | 0.2+ | Manages LLM prompts, chains, and RAG pipelines |
| PDF Parsing | `PyMuPDF` (fitz) | Latest | Extracts raw text from uploaded PDF files |
| OCR | `Tesseract` / `Google Document AI` | — | Extracts text from scanned bank statement images |
| Data Processing | `Pandas` + `NumPy` | Latest | Data cleaning, financial ratio calculations |
| Validation | `Pydantic` v2 | Latest | Input/output schema validation for all API endpoints |
| Auth | `Supabase Auth` / `JWT` | — | User authentication (MSME vs Govt Admin roles) |
| Task Queue | `Celery` + `Redis` (optional) | — | Background processing for heavy AI tasks |

### 2.3 Database Stack

| Component | Technology | Purpose |
|---|---|---|
| Primary DB | `Supabase` (hosted PostgreSQL) | Stores user profiles, bid records, IP logs, financial data, audit trails |
| Vector DB | `ChromaDB` (dev) / `Pinecone` (prod) | Stores PDF text embeddings for RAG semantic search |
| Cache | `Redis` (optional) | Caches LLM responses and agent state for faster re-queries |

---

## 3. System Design: Request Flow

When an MSME user opens the web app and submits a bid, here is the exact sequence of events:

```
User (Browser)
    │
    ├── 1. Uploads Tender PDF + Bank Statement
    ├── 2. Frontend JS silently captures: keystroke timing, device fingerprint, IP address
    │
    ▼
Next.js Frontend
    │
    ├── 3. Sends POST /api/submit-bid to FastAPI backend
    │      Body: { pdf_file, bank_stmt, user_profile, behavioral_data, device_hash }
    │
    ▼
FastAPI Backend
    │
    ├── 4. Creates a new LangGraph Session (SessionState)
    │
    ├── 5. STEP 1: Routes behavioral_data + device_hash → Cybersecurity Agent
    │      │
    │      ├── If Bot detected → Return 403 "Submission Blocked" → END
    │      └── If Human → Continue to Step 2
    │
    ├── 6. STEP 2: Routes pdf_file → NLP Copilot Agent
    │      │
    │      └── Returns: { emd: "₹50,000", deadline: "Aug 10", turnover_req: "₹1 Cr" }
    │
    ├── 7. STEP 3: Routes bank_stmt → FinTech Solvency Agent
    │      │
    │      └── Returns: { liquidity_ratio: 0.72, solvency_risk: "LOW" }
    │
    ├── 8. STEP 4: Routes { user_ip, director_name, udyam_no } → Graph Cartel Agent
    │      │
    │      └── Returns: { cartel_flag: false, uniqueness_penalty: 0.95 }
    │
    ├── 9. STEP 5: If corrigendum exists → Routes to Legal Diff Agent
    │      │
    │      └── Returns: { manipulation_probability: 0.12 }
    │
    ├── 10. STEP 6: Bayesian Trust Fusion (combines all 5 scores)
    │
    ├── 11. STEP 7: Final Selection (applies thresholds + jitter)
    │
    └── 12. Returns final JSON response to Frontend
           { composite_score: 0.78, compliance: "PASS", risks: [...] }
```

---

## 4. Cloud Hosting & Deployment Strategy

We use a **cost-effective, student-friendly** cloud architecture with free tiers wherever possible:

### 4.1 Cloud Components

| Component | Cloud Provider | Plan | Monthly Cost |
|---|---|---|---|
| **Frontend Hosting** | `Vercel` | Free (Hobby) | ₹0 |
| **Backend Hosting** | `Render.com` | Free tier (750 hrs/month) | ₹0 |
| **Database** | `Supabase` | Free tier (500 MB, 50K rows) | ₹0 |
| **Vector Database** | `ChromaDB` (self-hosted on Render) | Free | ₹0 |
| **LLM API** | `Google Gemini API` | Free tier (60 requests/min) | ₹0 |
| **Speech API** | `OpenAI Whisper API` | Pay-per-use (~$0.006/min) | ~₹50/month |
| **OCR** | `Tesseract` (self-hosted) | Free (open source) | ₹0 |
| **Monitoring** | `Vercel Analytics` + `Render Logs` | Free | ₹0 |

### 4.2 Deployment Architecture

```
┌───────────────────────────────────────────────────────┐
│                    INTERNET                            │
└───────────┬───────────────────────────┬───────────────┘
            │                           │
            ▼                           ▼
   ┌─────────────────┐       ┌─────────────────────┐
   │   Vercel CDN    │       │   Render.com         │
   │                 │       │                     │
   │  Next.js App    │ ───── │  FastAPI + LangGraph │
   │  (Static +SSR)  │ API   │  + All AI Agents     │
   │                 │ Calls │  + ChromaDB           │
   └─────────────────┘       └──────────┬──────────┘
                                        │
                              ┌─────────┴─────────┐
                              │                   │
                              ▼                   ▼
                     ┌──────────────┐    ┌──────────────┐
                     │  Supabase    │    │ External APIs│
                     │  (PostgreSQL)│    │              │
                     │  - Users     │    │ - Gemini API │
                     │  - Bids      │    │ - Whisper API│
                     │  - Logs      │    │ - Tofler API │
                     └──────────────┘    └──────────────┘
```

### 4.3 How We Host This (Step by Step)
1. **Frontend:** Push your Next.js code to GitHub. Connect the GitHub repo to Vercel. Every time you push code, Vercel automatically deploys it to a `.vercel.app` URL.
2. **Backend:** Push your FastAPI Python code to a separate GitHub repo. Connect it to Render.com. Render automatically builds and deploys your Python server to a `.onrender.com` URL.
3. **Database:** Create a free Supabase project. Copy the connection string into your FastAPI `.env` file. Your backend now reads/writes to the cloud database.
4. **Custom Domain (Optional):** Buy a domain (e.g., `procureai.in`) for ₹500/year and point it to your Vercel frontend.

---

## 5. Target Audience

This platform serves **two distinct user groups** (the "Dual-Sided" model):

### 5.1 Side A: MSME Users (The Free/Low-Cost Product)

| Attribute | Detail |
|---|---|
| **Who they are** | Micro, Small, and Medium Enterprise owners who want to bid for government contracts |
| **Pain point** | They cannot understand 100-page tender PDFs and get rejected for clerical errors |
| **What we give them** | A free AI Copilot that reads the PDF for them, checks their compliance, and lets them ask questions via voice |
| **Market size** | 63+ million MSMEs registered in India; ~2 million actively bidding on government portals |
| **Revenue model** | Freemium: Basic compliance check is free; advanced features (multi-tender tracking, priority support) for ₹999/month |

### 5.2 Side B: Government / Enterprise Auditors (The Premium Product)

| Attribute | Detail |
|---|---|
| **Who they are** | CAG auditors, CVC officers, State Vigilance departments, and Private sector procurement heads |
| **Pain point** | They manually audit only 3-5% of tenders and miss cartels, bots, and financial fraud |
| **What we give them** | A real-time Admin Dashboard showing cartel networks, bot alerts, solvency risks, and corrigendum manipulation flags |
| **Market size** | Central + 28 State Governments + 100+ large private companies with procurement departments |
| **Revenue model** | Enterprise SaaS: ₹5-50 Lakh/year per government department or corporate client |

---

## 6. AI, ML & Models Beyond Agentic AI

Beyond the Agentic AI framework (LangGraph + LangChain), the project uses a rich variety of AI/ML techniques and models across multiple domains:

### 6.1 Natural Language Processing (NLP)

| Technique | Where Used | Model/Library |
|---|---|---|
| **Zero-Shot Prompting** | NLP Copilot (extracting EMD, deadlines from PDFs) | Google Gemini / GPT-4o |
| **Retrieval-Augmented Generation (RAG)** | NLP Copilot (searching 100-page PDFs for specific answers) | LangChain + ChromaDB + Embedding Model |
| **Text Embeddings** | RAG pipeline (converting text to vectors for semantic search) | `text-embedding-004` (Google) |
| **Semantic Similarity** | Legal Diff Agent (comparing original vs amended tender clauses) | `Sentence-Transformers` (`all-MiniLM-L6-v2`) |
| **Named Entity Recognition (NER)** | Extracting company names, amounts, dates from unstructured text | Gemini / spaCy (fallback) |

### 6.2 Machine Learning (ML)

| Technique | Where Used | Model/Library |
|---|---|---|
| **Isolation Forest** (Unsupervised) | Cybersecurity Agent (detecting bot vs human behavior) | `sklearn.ensemble.IsolationForest` |
| **XGBoost / Random Forest** (Supervised) | Predictive Risk Agent (predicting low-bid project failure) | `xgboost` / `sklearn.ensemble.RandomForestClassifier` |
| **Bayesian Beta-Binomial Estimation** | Performance Agent (calculating trust from past project success/failure) | Custom Python (NumPy) |
| **Exponential Risk Decay** | Legal Agent (calculating legal trust from violation history) | Custom Python ($e^{-Risk}$) |

### 6.3 Graph Data Science

| Technique | Where Used | Model/Library |
|---|---|---|
| **Shortest Path Analysis** | Graph Cartel Agent (detecting 1-hop connections between bidders) | `NetworkX` (`nx.shortest_path`) |
| **Connected Components** | Graph Cartel Agent (identifying cartel clusters) | `NetworkX` (`nx.connected_components`) |
| **Community Detection** | Graph Cartel Agent (finding hidden groups of colluding companies) | `NetworkX` (Louvain algorithm) |
| **Cobb-Douglas Geometric Mean** | Technical Agent (scoring technical capability) | Custom Python |

### 6.4 Computer Vision & OCR

| Technique | Where Used | Model/Library |
|---|---|---|
| **Optical Character Recognition (OCR)** | FinTech Agent (extracting text from scanned bank statement images) | `Tesseract` / `Google Document AI` |

### 6.5 Speech Processing

| Technique | Where Used | Model/Library |
|---|---|---|
| **Automatic Speech Recognition (ASR)** | Voice Interface (converting user voice to text) | `OpenAI Whisper API` |
| **Text-to-Speech (TTS)** | Voice Interface (speaking the AI's answer back to the user) | `Google Cloud TTS` / `Web Speech API` |

### 6.6 Mathematical / Statistical Models

| Model | Where Used | Formula |
|---|---|---|
| **Bayesian Trust Fusion** | Orchestrator (combining 5 agent scores into one) | $T_i = \frac{\sum C_{i,j} \eta_j T_{i,j}}{\sum C_{i,j} \eta_j}$ |
| **Anchor-Blended Price Score** | Price Agent (anti-cartel pricing) | $P_i = \delta \cdot \frac{B_{min}}{B_i} + (1-\delta) \cdot \frac{B_{ref}}{B_i}$ |
| **Uniqueness Penalty** | Technical Agent (penalizing shared assets) | $\rho_i = 1 - \frac{\|Assets_i \cap Assets_{-i}\|}{\|Assets_i\|}$ |
| **Non-Disclosure Penalty** | Legal Agent (punishing hidden violations) | $Risk_i = \sum(w_c \cdot cases_{verified}) + \gamma \cdot D_i$ |
| **Dynamic Trust Update** | Post-award learning | $T_{new} = \lambda T_{old} + (1-\lambda) \cdot observed$ |
| **Absolute-Reference Normalization** | Financial Agent (anti-decoy scoring) | $F_i = clip(\frac{Raw_i - F_{floor}}{F_{ceiling} - F_{floor}}, 0, 1)$ |
| **Randomized-Threshold Jitter** | Final Selection (anti-gaming) | $Perf_i \geq Perf_{min} \pm \epsilon$ |
