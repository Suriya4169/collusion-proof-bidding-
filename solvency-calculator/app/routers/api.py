"""
API Router — Swagger-Documented REST Endpoints for Solvency Agent

Endpoints:
  GET  /api/v1/agent/solvency/health           → Health check (for orchestrator discovery)
  POST /api/v1/agent/solvency/analyze           → Upload PDF → Full analysis
  POST /api/v1/agent/solvency/verify-json       → Submit pre-structured JSON → Verification
  GET  /api/v1/agent/solvency/results/{id}      → Retrieve cached analysis result
  GET  /api/v1/agent/solvency/results           → List all analysis IDs
  GET  /api/v1/agent/solvency/registration      → Agent registration payload for orchestrators

All endpoints produce OpenAPI/Swagger documentation automatically.
"""

import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.agents.solvency_agent import SolvencyVerificationAgent
from app.models.schemas import (
    AgentHealthResponse,
    AgentRegistration,
    AnalysisResponse,
    ErrorResponse,
    VerifyJsonRequest,
)

logger = logging.getLogger("solvency_agent.api")

router = APIRouter(
    prefix="/api/v1/agent/solvency",
    tags=["Solvency Verification Agent"],
    responses={
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)

# ─────────────────────────────────────────────────────────────
# Agent Singleton (shared across all requests)
# ─────────────────────────────────────────────────────────────

_agent: Optional[SolvencyVerificationAgent] = None


def get_agent() -> SolvencyVerificationAgent:
    global _agent
    if _agent is None:
        _agent = SolvencyVerificationAgent()
    return _agent


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────

@router.get(
    "/health",
    response_model=AgentHealthResponse,
    summary="Agent Health Check",
    description=(
        "Returns the agent's status, version, and capabilities. "
        "Used by orchestrators and other agents for service discovery."
    ),
)
async def health_check():
    """Health check endpoint for orchestrator integration."""
    return AgentHealthResponse()


@router.get(
    "/registration",
    response_model=AgentRegistration,
    summary="Agent Registration Payload",
    description=(
        "Returns a structured registration payload containing this agent's "
        "endpoint map, capabilities, and metadata. Other agents or an "
        "orchestrator can call this to discover and integrate with this agent."
    ),
)
async def get_registration(base_url: str = "http://localhost:8001"):
    """Get agent registration payload for multi-agent integration."""
    return AgentRegistration(base_url=base_url)


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    summary="Analyze PDF Bank Statement",
    description=(
        "Upload a PDF bank statement for full end-to-end analysis:\n\n"
        "1. **PDF Decryption** — Automatic handling of password-protected PDFs\n"
        "2. **PDF Text Extraction** — Text-layer routing (pdfplumber → PyMuPDF fallback)\n"
        "3. **Layout Mapping** — LLM identifies column semantics per-page (Gemini, layout-only)\n"
        "4. **Ledger Verification** — Row recurrence, page continuity constraints\n"
        "5. **Manipulation Detection** — Window dressing, round-trips, Benford's law\n"
        "6. **Financial Metrics** — TWAB, min balance, volatility, cash-flow trajectory\n\n"
        "Returns a complete audit report with integrity verdict and flagged anomalies.\n\n"
        "**Password-protected PDFs:** Supply the password via the `password` field.\n"
        "**Long statements (100+ pages):** Fully supported via page-by-page chunked parsing."
    ),
    responses={
        200: {"description": "Complete analysis result with integrity verdict"},
        400: {"model": ErrorResponse, "description": "Invalid input"},
        422: {"model": ErrorResponse, "description": "Unprocessable PDF"},
    },
)
async def analyze_pdf(
    file: UploadFile = File(..., description="PDF bank statement file to analyze"),
    password: Optional[str] = Form(None, description="Password for encrypted/protected PDFs (optional)"),
    gemini_api_key: Optional[str] = Form(None, description="Gemini API key (optional, uses server env var if not provided)"),
):
    """Upload and analyze a PDF bank statement."""
    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    if file.content_type and "pdf" not in file.content_type.lower():
        raise HTTPException(status_code=400, detail=f"Expected application/pdf, got {file.content_type}")

    # Read file bytes
    try:
        pdf_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {e}")

    if len(pdf_bytes) < 100:
        raise HTTPException(status_code=400, detail="File too small to be a valid PDF")

    if len(pdf_bytes) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="File exceeds 50MB size limit")

    # Run the agent pipeline
    agent = get_agent()
    result = agent.analyze_pdf(
        pdf_bytes,
        filename=file.filename,
        gemini_api_key=gemini_api_key,
        password=password,
    )
    return result


@router.post(
    "/verify-json",
    response_model=AnalysisResponse,
    summary="Verify Pre-Structured Statement JSON",
    description=(
        "Submit a pre-structured bank statement JSON for direct verification "
        "(skips PDF extraction and LLM parsing). Useful for:\n\n"
        "- Testing with synthetic/sample statements\n"
        "- When another agent has already extracted and structured the data\n"
        "- Direct integration with other pipeline stages\n\n"
        "Accepts the same JSON format as the sample statements."
    ),
)
async def verify_json(request: VerifyJsonRequest):
    """Verify a pre-structured bank statement JSON directly."""
    agent = get_agent()
    statement_dict = request.statement_data.model_dump()
    result = agent.verify_json(statement_dict)
    return result


@router.get(
    "/results/{analysis_id}",
    response_model=AnalysisResponse,
    summary="Retrieve Analysis Result",
    description="Retrieve a previously computed analysis result by its unique ID.",
    responses={
        404: {"model": ErrorResponse, "description": "Analysis ID not found"},
    },
)
async def get_result(analysis_id: str):
    """Retrieve a cached analysis result by its ID."""
    agent = get_agent()
    result = agent.get_result(analysis_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Analysis ID '{analysis_id}' not found")
    return result


@router.get(
    "/results",
    summary="List All Analysis IDs",
    description="Returns a list of all cached analysis IDs that can be retrieved.",
)
async def list_results():
    """List all cached analysis result IDs."""
    agent = get_agent()
    ids = agent.list_results()
    return {"analysis_ids": ids, "count": len(ids)}
