# 🏛️ Intelligent Procurement Integrity Platform (IPIP)
### Module 1: The MSME Compliance & NLP Copilot 🚀

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain.com/)
[![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white)](https://deepmind.google/technologies/gemini/)

Welcome to the central repository for the **Intelligent Procurement Integrity Platform**. 
This README specifically focuses on **Module 1 (Agent 1)**, which is designed to radically simplify the government tender bidding process for Micro, Small, and Medium Enterprises (MSMEs) in India using Neurosymbolic AI.

---

## 📅 Semester 7: The Core Foundation (Finished & Ongoing)

In the 7th semester, the primary focus is building the **Discovery, Verification, and Integrity** engines. We engineered a highly sophisticated Neurosymbolic AI pipeline that bridges the gap between complex government tenders and rural Indian business owners.

### 1️⃣ Module 1: The MSME Compliance & NLP Copilot (✅ Finished)
Instead of relying purely on generative AI (which hallucinates numbers and rules), we implemented a **10-Sub-Agent Neurosymbolic Architecture**:
- **Neural (LLM):** Gemini/Llama used for reading unstructured text and translating languages.
- **Symbolic (Python):** Pure Python logic for mathematical scoring and pass/fail verification (Zero Hallucination).
*(Features include: PDF Extraction, Dense RAG, Llama 3.1 Neural Extraction, Compliance Distance Scoring, Native Regional Translation, Document Vault Checking, and MSME Payment Penalty Tracking).*

### 2️⃣ Module 2: The Proactive Matchmaker & Consortium Builder (⏳ Ongoing)
Small startups don't know how to find tenders. If they do find one, it often requires a ₹10 Crore turnover, but the startup only has ₹4 Crore, so they lose automatically.
- **Matchmaker:** Actively scans a database of tenders and pushes notifications to the MSME: "We found 3 IT tenders you have a 95% chance of winning."
- **Consortium (JV) Builder:** If the startup is too small to bid alone, this AI connects them with another trusted MSME on the platform to pool their turnover and bid together, defeating massive corporate monopolies.

### 3️⃣ Agent 5: Legal Semantic Diff Engine (⏳ Ongoing)
An NLP vault that catches corrupt government officers who make last-minute restrictive amendments to PDF tenders to favor specific contractors. It compares the original tender with its amendment and highlights tampered sentences using Cosine Similarity and temporal penalty mathematics.

---

## 🔮 Semester 8: Advanced AI Integration (Future Roadmap)

In the 8th semester, we will expand the platform from a "Verification Engine" into a full-scale **Autonomous Bidding Ecosystem**. These modules deal with completely different AI domains (GenAI and Computer Vision).

### 4️⃣ Module 3: The Generative Auto-Bidder
Even if Module 1 says they are eligible, MSMEs don't have professional writers to draft the 30-page "Technical Proposal" required to apply. They lose to big companies with dedicated bidding teams.
- **What it does:** Once the MSME decides to bid, this Generative AI agent reads their past projects and automatically writes a flawless, professional 30-page technical proposal formatted exactly to the government's liking.

### 5️⃣ Module 4: The CV Progress Auditor (Anti-Bribery)
An MSME finishes manufacturing goods, but a corrupt government engineer refuses to approve the payment without a 10% cash bribe.
- **What it does:** The MSME uploads a video of their finished factory goods to the app. A Computer Vision (CV) AI mathematically analyzes the video, verifies the goods exist, and logs a tamper-proof cryptographic hash. If the corrupt engineer claims the goods are defective, the MSME has undeniable AI-certified proof to send to the vigilance department.

### 🛡️ Government-Side Expansions (Teammates)
- **Agent 2: Graph Cartel Detection:** Detecting bidding rings and IP-address collision networks among competing MSMEs using Graph Neural Networks (GNNs).

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
