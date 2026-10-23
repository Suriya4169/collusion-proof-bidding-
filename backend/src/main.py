import os
import shutil
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from src.api.routes import msme, legal, matchmaker, tenders, documents, auth, m2m, jobs, cartel, behavior
from src.db.seed import seed_database
from src.orchestrator.graph import procurement_graph

# Load environment variables
load_dotenv(dotenv_path="../.env")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure SQLite/PostgreSQL tables exist and are seeded
    seed_database()
    yield

app = FastAPI(
    title="ProcureGuard AI — Intelligent Procurement Integrity Platform",
    description="""
## Enterprise Multi-Agent & Sovereign Ingestion Backend

This production API powers the ProcureGuard AI platform:
1. **Module 1 (NLP Copilot):** 10-Sub-Agent pipeline with PyMuPDF, Ephemeral RAG, Gemini 1.5, Symbolic Verifier, CDS scoring, Hindi translation, and MSMED Section 16 payment penalty tracker.
2. **Module 2 (Matchmaker & Consortium):** Proactive Solo tender matching and Joint Venture (JV) recommendations.
3. **Agent 2C (Cartel & Collusion Graph):** NetworkX bipartite collusion graph connecting bidders to shared beneficial owners, IPs, and bank routing codes.
4. **Agent 4 (Behavioral Biometrics):** Keystroke dynamics timing analyzer detecting automated bidding bots.
5. **Agent 5 (Legal Semantic Diff):** Corrigendum tampering detection via Sentence-Transformers and temporal risk scoring.
6. **Marketplace & Document Vault:** Dynamic active GeM tenders and MSME certificate readiness auditing.
7. **Authentication & RBAC:** JWT Bearer tokens and role-based access control (MSME vs Government Auditor).
8. **M2M Sovereign Gateway:** Machine-to-Machine API key ingestion for GeM/CPPP portal webhooks.
9. **Asynchronous Job Queue:** Non-blocking background workers for large tender processing.
10. **LangGraph Pipeline:** Multi-agent state machine orchestrator.
""",
    version="2.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "Authentication & Access Control (RBAC)", "description": "JWT authentication, bcrypt password hashing, and role-based access control."},
        {"name": "Bid Eligibility & Compliance Auditor", "description": "Neurosymbolic NLP pipeline analyzing tender PDFs and evaluating compliance."},
        {"name": "Statutory Payment Recovery Engine", "description": "Section 16 MSMED compounding interest penalty tracker and legal demand notice generator."},
        {"name": "Corrigendum Integrity & Tamper Detector", "description": "Agent 5 Corrigendum tampering detection via Cosine Similarity and temporal decay."},
        {"name": "Agent 2C: Cartel & Collusion Graph Intelligence", "description": "NetworkX bipartite collusion graph connecting bidders to shared owners, IPs, bank routing codes, and anomaly scoring."},
        {"name": "Agent 4: Behavioral Biometrics & Bid Rigging Bot Detection", "description": "Keystroke dynamics timing analyzer detecting automated bidding scripts and bots with 0-100 risk signal and plain-language evidence."},
        {"name": "Autonomous Matchmaker & Coalition Builder", "description": "Module 2 Solo tender matchmaker and Joint Venture (JV) coalition builder."},
        {"name": "GeM Procurement Repository", "description": "Live GeM tender repository with sector filtering and search."},
        {"name": "Procurement Readiness Vault", "description": "MSME Certificate Vault, 71.4% readiness scoring, and proactive expiry alerts."},
        {"name": "Machine-to-Machine (M2M) Sovereign Gateway", "description": "API-Key authenticated endpoints and webhooks for direct government server integration."},
        {"name": "Asynchronous Task Queue (Background Workers)", "description": "Background worker queue for non-blocking multi-page tender processing."},
        {"name": "Multi-Agent Workflow Orchestrator", "description": "Compiled LangGraph state machine multi-agent execution pipeline."},
        {"name": "System Health & Telemetry", "description": "Platform health, diagnostics, and active module status."}
    ]
)

# CORS middleware for Next.js Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register All API Routers
app.include_router(auth.router)
app.include_router(msme.router, prefix="/api")
app.include_router(legal.router, prefix="/api")
app.include_router(cartel.router, prefix="/api")
app.include_router(behavior.router, prefix="/api")
app.include_router(matchmaker.router)
app.include_router(tenders.router)
app.include_router(documents.router)
app.include_router(m2m.router)
app.include_router(jobs.router)

UPLOAD_DIR = "test_data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post(
    "/api/orchestrator/analyze",
    tags=["Multi-Agent Workflow Orchestrator"],
    summary="Execute Multi-Agent Pipeline via LangGraph StateGraph"
)
async def orchestrate_tender_analysis(
    file: UploadFile = File(...),
    company_name: str = Form("Bharat Precision Engineering Pvt Ltd"),
    turnover: int = Form(4850000),
    experience: int = Form(5),
    certifications: str = Form("Udyam, ISO 9001"),
    is_msme: bool = Form(True),
    target_language: str = Form("Hindi")
):
    """
    Executes the entire 10-agent pipeline using the LangGraph StateGraph orchestrator.
    Nodes: pdf_extractor -> rag_retriever -> neural_extractor -> symbolic_verifier -> tender_simplifier -> scheme_discoverer.
    """
    temp_path = os.path.join(UPLOAD_DIR, f"orchestrate_{file.filename}")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        cert_list = [c.strip() for c in certifications.split(",") if c.strip()]
        initial_state = {
            "file_path": temp_path,
            "profile": {
                "company_name": company_name,
                "turnover": turnover,
                "experience": experience,
                "certifications": cert_list,
                "is_msme": is_msme
            },
            "target_language": target_language,
            "raw_pdf_text": "",
            "retrieved_context": "",
            "extracted_rules": None,
            "verification_report": None,
            "plain_summary": "",
            "regional_summary": "",
            "recommended_schemes": [],
            "logs": [],
            "error": None
        }

        # Run the compiled LangGraph workflow
        final_state = procurement_graph.invoke(initial_state)

        if final_state.get("error"):
            raise HTTPException(status_code=500, detail=final_state["error"])

        return {
            "verification_report": final_state.get("verification_report"),
            "plain_summary": final_state.get("plain_summary"),
            "regional_summary": final_state.get("regional_summary"),
            "recommended_schemes": final_state.get("recommended_schemes"),
            "orchestration_logs": final_state.get("logs")
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.get("/health", tags=["System Health & Telemetry"])
async def health():
    return {
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
