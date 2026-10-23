import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from src.agents.module1.agent5_legal_diff.clause_extractor import extract_for_comparison
from src.agents.module1.agent5_legal_diff.semantic_differ import compute_semantic_diff
from src.agents.module1.agent5_legal_diff.corruption_risk_scorer import score_corruption_risk
from src.models.diff_schemas import DiffReport
from src.models.schemas import APIErrorResponse

router = APIRouter()

UPLOAD_DIR = "test_data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post(
    "/diff",
    response_model=DiffReport,
    tags=["Corrigendum Integrity & Tamper Detector"],
    summary="Run Module 2 Corrigendum Tampering Detection",
    description="Takes an original tender PDF and a corrigendum PDF. Runs 3 Sub-Agents to mathematically diff the semantics of all clauses, flag tampering, and compute a final Corruption Risk score.",
    responses={
        400: {"model": APIErrorResponse, "description": "Validation Error"},
        500: {"model": APIErrorResponse, "description": "Internal Server Error"}
    }
)
async def analyze_legal_diff(
    original_pdf: UploadFile = File(...),
    corrigendum_pdf: UploadFile = File(...),
    days_before_deadline: int = Form(default=7, description="Number of days before the bid deadline this corrigendum was issued.")
):
    """
    Module 2 Core Pipeline:
    Agent 5.1 -> Agent 5.2 -> Agent 5.3
    """
    try:
        # Save files temporarily
        orig_path = f"{UPLOAD_DIR}/diff_orig_{original_pdf.filename}"
        corr_path = f"{UPLOAD_DIR}/diff_corr_{corrigendum_pdf.filename}"
        
        with open(orig_path, "wb") as buffer: shutil.copyfileobj(original_pdf.file, buffer)
        with open(corr_path, "wb") as buffer: shutil.copyfileobj(corrigendum_pdf.file, buffer)
            
        # 1. Agent 5.1: Clause Extractor
        clauses = extract_for_comparison(orig_path, corr_path)
        
        # 2. Agent 5.2: Semantic Differ
        flagged_pairs = compute_semantic_diff(
            original_clauses=clauses["original_clauses"],
            amended_clauses=clauses["amended_clauses"],
            similarity_threshold=0.75
        )
        
        # 3. Agent 5.3: Corruption Risk Scorer
        report_data = score_corruption_risk(
            flagged_pairs=flagged_pairs,
            days_before_deadline=days_before_deadline
        )
        
        # Cleanup
        os.remove(orig_path)
        os.remove(corr_path)
        
        return DiffReport(**report_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
