from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import msme, legal, matchmaker
from dotenv import load_dotenv

# Load environment variables (e.g. GEMINI_API_KEY)
load_dotenv(dotenv_path="../.env")

app = FastAPI(
    title="MSME Procurement Copilot API",
    description="""
## Neurosymbolic NLP Pipeline
    
This API powers the MSME Bidding Copilot, utilizing a 10-Agent pipeline to extract tender rules, mathematically validate eligibility (CDS), and automatically track payment delays.
""",
    version="1.0.0",
    openapi_tags=[
        {"name": "1. Tender Intelligence Copilot", "description": "Core NLP pipeline that analyzes government PDFs, calculates eligibility, and recommends schemes."},
        {"name": "2. Financial & Legal Trackers", "description": "Financial penalty trackers and legal demand notice generators."},
        {"name": "Module 2. Legal Semantic Diff", "description": "Corrigendum tampering detection."},
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
app.include_router(legal.router, prefix="/api")
app.include_router(matchmaker.router)

@app.get("/health", tags=["3. System Actions"])
async def health():
    return {"status": "ok", "message": "MSME Copilot API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
