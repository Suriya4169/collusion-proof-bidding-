# ProcureGuard-AI

**Neurosymbolic AI for MSME tender compliance and public-procurement integrity.**
LLMs read and translate documents; deterministic Python makes every eligibility, interest and risk decision.

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?style=flat&logo=nextdotjs)](https://nextjs.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-StateGraph-1C3C3C?style=flat)](https://langchain-ai.github.io/langgraph/)
[![Gemini](https://img.shields.io/badge/Gemini-structured_extraction-8E75B2?style=flat)](https://deepmind.google/technologies/gemini/)

> Full project manual, architecture, API contract and viva guide: **[docs/UNIFIED_PROJECT_MANUAL.md](docs/UNIFIED_PROJECT_MANUAL.md)**

## What it does

| Suite | Capability | Where |
| :-- | :-- | :-- |
| **MSME Vendor** | Tender eligibility audit with page citations and Hindi summary | Module 1 · `/dashboard` |
| | Statutory payment recovery: MSMED Act §15–17, 3× RBI Bank Rate, monthly compounding, draft demand notice | Module 2 · `/payment-tracker` |
| | Corrigendum tampering detection (semantic diff + temporal risk) | Agent 5 · `/legal-diff` |
| | Solo matches and joint-venture consortium builder | Module 2 · `/matchmaker` |
| | Document vault with readiness score and expiry alerts | `/documents` |
| **Government Auditor** | Cartel & collusion graph (shared owners, IPs, bank codes) | Agent 2C · `/cartel-graph` |
| | Keystroke-dynamics bot detection (0–100 risk) | Agent 4 · `/bot-detection` |
| | M2M sovereign gateway console (`X-ProcureGuard-Key`) | `/m2m-gateway` |
| | LangGraph 6-node pipeline visualizer | `/agent-pipeline` |

## Repository layout

```text
backend/                       FastAPI 2.0 gateway, SQLite/Postgres ORM, Module 1 & 2, Agent 5, LangGraph orchestrator
cartel-graph/                  Agent 2C engine (NetworkX) — imported by backend/src/api/routes/cartel.py
agent-4-behavioral-biometrics/ Agent 4 scorer, model artefacts, evaluation reports — imported by routes/behavior.py
frontend/                      Next.js 16 (Turbopack) dual-portal UI
docs/                          Manual, Swagger reference, design blueprints
docker-compose.yml             Postgres + backend (+ frontend) stack
```

## Quick start

Prerequisites: Python 3.12, Node.js 20+, a Gemini API key.

```bash
# 0. one-time setup (repo root)
cp .env.example .env            # set GEMINI_API_KEY (Windows: copy .env.example .env)
python -m venv backend/venv
backend/venv/Scripts/activate   # Linux/macOS: source backend/venv/bin/activate
pip install -r backend/requirements.txt -r cartel-graph/requirements.txt -r agent-4-behavioral-biometrics/requirements.txt
cd frontend && npm install && cd ..

# 1. backend  (run from the repo root)
uvicorn src.main:app --app-dir backend --reload --port 8000

# 2. frontend (second terminal)
cd frontend
npm run dev
```

| URL | Purpose |
| :-- | :-- |
| http://localhost:3000 | Web console |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/redoc | ReDoc |
| http://localhost:8000/health | Liveness + module list |

The database is seeded on first start. Without `GEMINI_API_KEY`, endpoints that call Gemini (tender analysis, payment OCR, corrigendum classification) return an error; cartel, bot-detection, matchmaker, vault and M2M endpoints work without it.

## Authors

| Contributor | Scope |
| :-- | :-- |
| Jeevakamal K R (`kamaladhi`) | MSME Copilot, Legal engine, persistent database, API gateway, M2M, JWT/RBAC, integration |
| Suriya (`Suriya4169`) | Agent 2C — Cartel & Collusion Graph |
| Darani Karthik | Agent 4 — Behavioural Biometrics & Bot Detection |

## Roadmap (Semester 8)

Module 3 — generative auto-bidder for technical proposals; Module 4 — computer-vision progress auditor for payment-evidence integrity.
