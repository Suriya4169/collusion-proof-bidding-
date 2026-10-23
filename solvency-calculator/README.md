# FinTech Solvency Verification Agent (Agent 3)

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![Swagger](https://img.shields.io/badge/Swagger-OpenAPI%203.0-85EA2D.svg?logo=swagger)](http://localhost:8001/docs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An autonomous, audit-grade microservice for evaluating financial solvency and detecting fraudulent balance tampering in bank statements. Designed for public procurement and high-stakes tender evaluations, this agent ingests digital or scanned bank statements (including password-encrypted PDFs of arbitrary page lengths), executes layout-aware table extraction, applies mathematically unforgeable ledger-constrained verification laws, and computes key solvency and liquidity metrics.

Equipped with a glassmorphism dark-theme dashboard, OpenAPI/Swagger interactive UI, and standardized REST endpoints ready for multi-agent ensemble orchestration.

---

## Key Capabilities & Upgrades

- **Deterministic Ledger Verification**: Strictly enforces conservation of balance $B_t = B_{t-1} + C_t - D_t$ with an OCR candidate substitution lattice to distinguish scanned OCR errors from malicious tampering.
- **Inter-Page Continuity Audit**: Guarantees zero balance discontinuity across multi-page statements ($B_{\text{opening}}^{(p+1)} \equiv B_{\text{closing}}^{(p)}$).
- **Fraud & Manipulation Detection**:
  - *Window-Dressing Spike Detection*: Robust Z-Score computed via Median Absolute Deviation (MAD) over daily net inflows.
  - *Round-Trip Reversal Matching*: Matches artificial capital inflation where deposits $C_i \approx D_j$ within short transaction windows.
  - *Benford's Law Analysis*: Evaluates first-digit distributions to detect synthetic or falsified numbers.
- **Password-Protected PDF Support**: Seamlessly extracts and analyzes encrypted statements via PyMuPDF in-memory decryption without storing plain text on disk.
- **Page-by-Page Chunked LLM Parsing**: Eliminates LLM token window limits by streaming individual statement pages, merging transaction sequences sequentially, and supporting statements of arbitrary length (50–100+ pages).
- **Multi-Agent Orchestration Ready**: Auto-discovery via `/health`, metadata registration via `/registration`, and direct JSON verification via `/verify-json`.

---

## Architecture

```
                      ┌──────────────────────────────────────┐
                      │    Orchestrator / Other Agents       │
                      │  (Multi-Agent Ensemble Architecture) │
                      └──────────────────┬───────────────────┘
                                         │ Callable REST Endpoints
                                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    Solvency Verification Agent (Port 8001)                 │
│                                                                            │
│  ┌───────────────────────┐   ┌───────────────────┐   ┌──────────────────┐  │
│  │     Interactive       │   │    Swagger UI     │   │      ReDoc       │  │
│  │    Web Dashboard      │   │  /docs (OpenAPI)  │   │      /redoc      │  │
│  │   http://...:8001/    │   │                   │   │                  │  │
│  └───────────┬───────────┘   └─────────┬─────────┘   └────────┬─────────┘  │
│              └─────────────────────────┼──────────────────────┘            │
│                                        ▼                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │               FastAPI Router (/api/v1/agent/solvency)               │  │
│  │  • GET  /health          • GET  /registration                        │  │
│  │  • POST /analyze         • POST /verify-json                         │  │
│  │  • GET  /results/{id}    • GET  /results                             │  │
│  └─────────────────────────────────┬────────────────────────────────────┘  │
│                                    │                                       │
│                                    ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              SolvencyVerificationAgent (Core Pipeline)               │  │
│  │                                                                      │  │
│  │  1. PDF Decryption & Extraction: PyMuPDF + pdfplumber               │  │
│  │  2. Page-Chunked LLM Parsing:    Gemini structured layout-only       │  │
│  │  3. Ledger Verification:         R(k) = B(k-1) + C(k) - D(k) - B(k)  │  │
│  │  4. Fraud Detection:             Window dressing, round-trips, Benford│ │
│  │  5. Solvency Metrics:            TWAB, min balance, volatility, slope│  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Clone the Repository & Setup Environment

```bash
git clone https://github.com/your-username/solvency-agent.git
cd solvency-agent

# Create virtual environment (recommended)
python -m venv .venv

# Activate on Linux/macOS:
source .venv/bin/activate
# Activate on Windows:
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and set your Google Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=8001
HOST=0.0.0.0
```
> **Note**: If `GEMINI_API_KEY` is not provided, the agent automatically falls back to deterministic regex-based table extraction.

### 3. Launch the Service

```bash
python main.py
```
Or run directly via Uvicorn:
```bash
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

The service will be live at:
- **Web Dashboard**: [http://localhost:8001/](http://localhost:8001/)
- **Interactive Swagger UI**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **ReDoc Documentation**: [http://localhost:8001/redoc](http://localhost:8001/redoc)
- **OpenAPI Schema**: [http://localhost:8001/openapi.json](http://localhost:8001/openapi.json)

---

## Callable API Endpoints

All endpoints are self-documenting and interactive in Swagger at `/docs`.

| Method | Endpoint | Description | Typical Consumer |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/agent/solvency/health` | Service health status, uptime, and agent capabilities | Orchestrator discovery |
| `GET` | `/api/v1/agent/solvency/registration` | Agent metadata, input/output schemas, and endpoint registry | Multi-agent registry |
| `POST` | `/api/v1/agent/solvency/analyze` | Upload PDF (with optional password) for end-to-end audit | Web UI / Orchestrator |
| `POST` | `/api/v1/agent/solvency/verify-json` | Submit pre-structured statement JSON for ledger verification | Upstream Parser Agents |
| `GET` | `/api/v1/agent/solvency/results/{id}` | Retrieve cached audit result by report ID | Downstream Aggregator Agents |
| `GET` | `/api/v1/agent/solvency/results` | List all cached analysis IDs | Monitoring / Audit |

---

## Multi-Agent Integration Guide

This agent is built as a self-contained microservice conforming to the **Agent 3 (Solvency Verification Agent)** role in multi-agent financial auditing systems.

### 1. Service Discovery
```python
import requests

resp = requests.get("http://localhost:8001/api/v1/agent/solvency/health")
agent_info = resp.json()
print("Agent Status:", agent_info["status"])
print("Capabilities:", agent_info["capabilities"])
```

### 2. PDF Analysis (with Optional Password)
```python
import requests

with open("bank_statement.pdf", "rb") as f:
    files = {"file": ("bank_statement.pdf", f, "application/pdf")}
    data = {"password": "optional_pdf_password"}  # Omit if not encrypted
    resp = requests.post("http://localhost:8001/api/v1/agent/solvency/analyze", files=files, data=data)

result = resp.json()
print("Verdict:", result["overall_integrity"])  # "PASSED", "FAILED", or "SUSPICIOUS"
print("TWAB:", result["financial_metrics"]["time_weighted_avg_balance"])
print("Window Dressing Detected:", result["fraud_indicators"]["window_dressing"]["detected"])
```

### 3. Direct JSON Verification (Pre-parsed Statements)
If an upstream agent has already extracted structured data:
```python
import requests

payload = {
    "statement_data": {
        "account_holder": "Acme Corp",
        "account_number": "XXXX1234",
        "bank_name": "Standard Bank",
        "statement_period": {"start_date": "2024-01-01", "end_date": "2024-01-31"},
        "opening_balance": 500000.0,
        "closing_balance": 520000.0,
        "transactions": [
            {
                "tx_id": "TXN_001",
                "date": "2024-01-05",
                "narration": "Vendor Payment",
                "debit": 30000.0,
                "credit": 0.0,
                "balance": 470000.0
            }
        ]
    }
}

resp = requests.post("http://localhost:8001/api/v1/agent/solvency/verify-json", json=payload)
audit = resp.json()
print("Passed:", audit["verification_report"]["all_passed"])
```

---

## Directory Structure

```
project/
├── .env.example                           # Sample environment configuration
├── .gitignore                             # Git exclusion rules
├── LICENSE                                # MIT License
├── README.md                              # Documentation and integration guide
├── requirements.txt                       # Production dependencies
├── main.py                                # FastAPI application entry point
├── ledger_verifier.py                     # Core mathematical ledger verification engine
├── app/
│   ├── agents/
│   │   └── solvency_agent.py              # Solvency agent orchestrator & caching
│   ├── models/
│   │   └── schemas.py                     # Pydantic data models & Swagger schemas
│   ├── routers/
│   │   └── api.py                         # REST router with OpenAPI specifications
│   ├── services/
│   │   ├── pdf_extractor.py               # PyMuPDF + pdfplumber text router & decryptor
│   │   └── statement_parser.py            # Page-chunked LLM layout-only parser
│   ├── static/
│   │   └── index.html                     # Glassmorphism dark-theme web dashboard
│   └── uploads/
│       └── .gitkeep                       # Upload directory tracking
├── docs/
│   ├── ledger_constrained_verification_report.md  # Constraint formulation & test report
│   └── solvency_scoring_from_bank_statements.md   # Research methodology document
└── samples/
    ├── generate_sample_pdfs.py            # Script to generate PDF test fixtures from JSON
    ├── sample_legitimate_statement.json   # Test fixture: clean authentic statement
    └── sample_manipulated_statement.json  # Test fixture: tampered statement with 5 fraud flags
```

> **Note**: `samples/*.pdf` files are generated artifacts excluded from git.
> Run `python samples/generate_sample_pdfs.py` to recreate them locally.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
