"""
Solvency Verification Agent — FastAPI Application

Entry point for the agent microservice.

Run with:
    python main.py
    # or
    uvicorn main:app --host 0.0.0.0 --port 8001 --reload

Swagger UI:    http://localhost:8001/docs
ReDoc:         http://localhost:8001/redoc
OpenAPI JSON:  http://localhost:8001/openapi.json
Dashboard:     http://localhost:8001/
"""

import logging
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Load .env file if available
try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

from app.routers.api import router as solvency_router

# ─────────────────────────────────────────────────────────────
# Logging Configuration
# ─────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-30s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)

# ─────────────────────────────────────────────────────────────
# FastAPI Application
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Solvency Verification Agent",
    description=(
        "## Audit-Grade Financial Solvency Verification for Public Procurement\n\n"
        "This agent analyzes PDF bank statements to produce a **mathematically rigorous, "
        "tamper-resistant solvency assessment** for tender bidder evaluation.\n\n"
        "### Pipeline\n"
        "1. **PDF Extraction** — Text-layer routing (pdfplumber / PyMuPDF)\n"
        "2. **Layout Mapping** — LLM identifies column semantics (never touches numbers)\n"
        "3. **Ledger Verification** — Row recurrence `B_t = B_{t-1} + C_t - D_t`\n"
        "4. **Page Continuity** — `B_opening^(p+1) == B_closing^(p)`\n"
        "5. **Manipulation Detection** — Window dressing (MAD Z-score), round-trips, Benford's law\n"
        "6. **Financial Metrics** — TWAB, minimum balance, volatility, cash-flow trajectory\n\n"
        "### Multi-Agent Integration\n"
        "This agent is designed to be called by other agents or an orchestrator. "
        "Use `/api/v1/agent/solvency/health` for service discovery and "
        "`/api/v1/agent/solvency/registration` for capability registration.\n\n"
        "---\n"
        "*Agent 3: FinTech Solvency Extraction Module*"
    ),
    version="1.0.0",
    contact={
        "name": "Solvency Verification Agent",
    },
    license_info={
        "name": "Academic Project",
    },
    docs_url="/docs",      # Swagger UI
    redoc_url="/redoc",    # ReDoc
    openapi_url="/openapi.json",
    openapi_tags=[
        {
            "name": "Solvency Verification Agent",
            "description": (
                "Endpoints for analyzing bank statements, verifying ledger integrity, "
                "detecting financial manipulation, and computing solvency metrics."
            ),
        }
    ],
)

# ─────────────────────────────────────────────────────────────
# CORS (allow all origins for development; restrict in production)
# ─────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────────────────────

app.include_router(solvency_router)

# ─────────────────────────────────────────────────────────────
# Static Files & Dashboard
# ─────────────────────────────────────────────────────────────

STATIC_DIR = Path(__file__).parent / "app" / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", include_in_schema=False)
async def serve_dashboard():
    """Serve the interactive results dashboard."""
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "Solvency Verification Agent is running. Visit /docs for Swagger UI."}


# ─────────────────────────────────────────────────────────────
# Run with: python main.py
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
    )
