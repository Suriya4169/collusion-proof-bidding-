from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import msme
from dotenv import load_dotenv

# Load environment variables (e.g. GEMINI_API_KEY)
load_dotenv(dotenv_path="../.env")

app = FastAPI(
    title="Intelligent Procurement Integrity Platform",
    description="""
    ## MSME NLP Compliance Copilot & Government Anti-Corruption Engine
    
    This dual-sided API powers the ultimate MSME bidding copilot and government vigilance dashboard.
    *   **Agent 1 (MSME):** Analyzes tenders, validates rules, calculates CDS, and recommends schemes.
    *   **Agent 2-5 (Govt):** Detects cartels, bots, and semantic corrigendum manipulations.
    """,
    version="1.0.0",
    contact={
        "name": "Platform Architecture Team",
        "email": "admin@procurement-integrity.in",
    },
    license_info={
        "name": "Proprietary",
    },
    openapi_tags=[
        {"name": "1. Tender Intelligence Copilot", "description": "Core NLP pipeline that analyzes government PDFs, calculates eligibility, and recommends schemes."},
        {"name": "2. Financial & Legal Trackers", "description": "Financial penalty trackers and legal demand notice generators."},
        {"name": "3. System Actions", "description": "Platform health and diagnostic endpoints."}
    ]
)

# Allow React Frontend (e.g. localhost:3000) to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(msme.router, prefix="/api")

@app.get("/health", tags=["3. System Actions"])
async def health():
    return {"status": "ok", "message": "MSME Copilot API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
