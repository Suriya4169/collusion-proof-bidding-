# 🏛️ Intelligent Procurement Integrity Platform (IPIP)
### Module 1: The MSME Compliance & NLP Copilot 🚀

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain.com/)
[![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white)](https://deepmind.google/technologies/gemini/)

Welcome to the central repository for the **Intelligent Procurement Integrity Platform**. 
This README specifically focuses on **Module 1 (Agent 1)**, which is designed to radically simplify the government tender bidding process for Micro, Small, and Medium Enterprises (MSMEs) in India using Neurosymbolic AI.

---

## 📅 Semester 7: What We Built (Currently Finished)

In the 7th semester, the primary focus was building the **Foundation & Architecture** of the MSME NLP Copilot. We engineered a highly sophisticated, 10-step Neurosymbolic AI pipeline that bridges the gap between complex government tenders and rural Indian business owners.

### 🧠 The Neurosymbolic Architecture
Instead of relying purely on generative AI (which hallucinates numbers and rules), we implemented a **Neurosymbolic Architecture**:
1. **Neural (LLM):** Used for reading unstructured text and translating languages.
2. **Symbolic (Python):** Used for hard mathematical logic, scoring, and pass/fail verification.

### 🤖 The 10 Sub-Agents (Fully Working API)
We have successfully implemented and wired up **Agent 1** via FastAPI:
- **[Sub-Agent 1.1] PDF Extractor:** Ingests 100+ page government PDFs using `pdfplumber`.
- **[Sub-Agent 1.2] Dense RAG Retriever:** Chunks text and uses `ChromaDB` (Vector DB) to retrieve only paragraphs containing EMD, Turnover, and Experience rules.
- **[Sub-Agent 1.3] Neural Extractor:** Forces Gemini 3.6 Flash to output strict Pydantic JSON for required financial metrics.
- **[Sub-Agent 1.4] Symbolic Verifier:** Pure Python engine that checks the extracted rules against the MSME's actual profile (Turnover, MSME exemptions, etc.).
- **[Sub-Agent 1.5] Self-Reflective Confidence Scorer:** LLM outputs a 0.0 to 1.0 confidence score on its own extractions.
- **[Sub-Agent 1.6] CDS Calculator:** Calculates a Compliance Distance Score (CDS). E.g., if you have 5 years experience but 3 is required, you score `+66.7%`.
- **[Sub-Agent 1.7] Tender Simplifier & Translator:** Translates the complex Verification Report into highly readable, encouraging Hindi.
- **[Sub-Agent 1.8] Document Vault Checker:** Identifies which specific certificates (e.g., ISO, OEM Authorization) are missing.
- **[Sub-Agent 1.9] Scheme Discoverer:** If an MSME fails an eligibility check, it recommends exact government schemes (like CGTMSE or Mudra) to bridge the gap.
- **[Sub-Agent 1.10] Payment Penalty Tracker:** Automatically calculates Section 16 MSME Act compound interest (3x RBI rate) for delayed government payments and drafts legal notices.

### 🌐 API Infrastructure
- Built a **FastAPI** backend to expose these agents.
- Standardized `camelCase` schemas for enterprise-ready frontend integration.
- Integrated a live **Swagger UI** (`/docs`) for flawless mentor demonstrations.

---

## 🔮 Semester 8: Future Roadmap

In the 8th semester, we will expand the platform from a "Copilot" into a full-scale **Integrity and Bidding Ecosystem**. The work will be split into Advanced MSME features and the Government-Side Anti-Corruption Engine.

### 🏢 Government Side (Anti-Corruption & Vigilance)
- **Agent 2: Graph Cartel Detection (Assigned to Suriya):** Detecting bidding rings and IP-address collision networks among competing MSMEs using Graph Neural Networks (GNNs).
- **Agent 5: Semantic Diff Engine (Corrigendum Tracker):** An NLP vault that tracks sneaky last-minute changes to PDF tenders (e.g., quietly changing "3 years" to "5 years" experience) to favor specific contractors.

### 🏭 MSME Side (Proactive Bidding)
- **Agent 3: Matchmaker & Consortium Builder:** If an MSME is too small to bid alone, this AI will pair them with another local MSME so they can bid jointly as a legal consortium.
- **Agent 4: Generative Auto-Bidder:** One-click automated form filling. The AI will take the MSME's saved vault data and dynamically generate the final PDF application exactly how the government requires it.
- **Computer Vision (CV) Auditor:** A future mobile app feature allowing MSMEs to snap photos of physical infrastructure (e.g., "Pillars constructed") to verify milestone completion for payments.

---

## 🚀 How to Run the Project

### 1. Run the Raw Python Pipeline (Terminal Mode)
Perfect for testing logic without a web server.
```bash
cd backend
python test_flow.py
```

### 2. Start the FastAPI Server (Swagger UI Mode)
Perfect for Mentor presentations and Frontend integration.
```bash
cd backend
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```
👉 Once running, open your browser and go to: **http://localhost:8000/docs**
