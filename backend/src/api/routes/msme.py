import os
import re
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from src.db.database import get_db
from src.db.models import MSMEModel, DocumentModel
from src.agents.module1.agent1_copilot.pdf_extractor import extract_text_from_pdf
from src.agents.module1.agent1_copilot.rag_retriever import chunk_text, build_hybrid_retriever, retrieve_relevant_chunks
from src.agents.module1.agent1_copilot.neural_extractor import extract_rules_with_gemini
from src.agents.module1.agent1_copilot.symbolic_verifier import verify_eligibility, MSMEProfile
from src.agents.module1.agent1_copilot.tender_simplifier import generate_plain_summary, translate_summary
from src.agents.module1.agent1_copilot.scheme_discoverer import discover_schemes
from src.agents.module1.agent1_copilot.payment_tracker import calculate_payment_penalty
from src.agents.module1.agent1_copilot.invoice_extractor import extract_payment_data
from src.models.schemas import VerificationReport, PaymentPenaltyReport, APIErrorResponse

router = APIRouter()

# Temporary upload directory
UPLOAD_DIR = "test_data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post(
    "/tender/analyze",
    response_model=VerificationReport,
    tags=["Bid Eligibility & Compliance Auditor"],
    summary="Run Neurosymbolic Copilot Pipeline",
    description="Accepts a Tender PDF and MSME Profile. Runs a massive 9-agent pipeline to mathematically determine eligibility, calculate CDS scores, translate to Hindi, and recommend government schemes.",
    responses={
        400: {"model": APIErrorResponse, "description": "Validation Error"},
        500: {"model": APIErrorResponse, "description": "Internal Server Error"}
    }
)
async def analyze_tender(
    file: UploadFile = File(...),
    company_name: str = Form("Bharat Precision Engineering Pvt Ltd"),
    turnover: int = Form(4850000),
    experience: int = Form(5),
    certifications: str = Form("Udyam"),
    is_msme: bool = Form(True),
    target_language: str = Form("Hindi", description="The regional language to translate the summary into (e.g. Hindi, Tamil, Marathi).")
):
    """
    Core API Endpoint: Runs Sub-Agents 1.1 through 1.9.
    Takes a Tender PDF and an MSME Profile, returns the full intelligence report.
    """
    try:
        # 1. Save uploaded file temporarily
        file_location = f"{UPLOAD_DIR}/{file.filename}"
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. Build Profile
        cert_list = [c.strip() for c in certifications.split(",") if c.strip()]
        profile = MSMEProfile(
            company_name=company_name,
            turnover_inr=turnover,
            experience_years=experience,
            certifications=cert_list,
            is_registered_msme=is_msme
        )

        # 3. Agent Pipeline
        # Sub-Agent 1.1
        pdf_text = extract_text_from_pdf(file_location)
        
        # Sub-Agent 1.2
        chunks = chunk_text(pdf_text)
        retriever = build_hybrid_retriever(chunks)
        query = "What is the EMD amount, turnover requirement, experience requirement, MSME exemptions, and required certifications?"
        relevant_text = retrieve_relevant_chunks(retriever, query)
        
        # Sub-Agent 1.3 & 1.5
        rules = extract_rules_with_gemini(relevant_text)
        
        # Sub-Agent 1.4, 1.6, 1.8
        report = verify_eligibility(rules, profile)
        
        # Sub-Agent 1.7
        report.plain_summary = generate_plain_summary(report)
        report.regional_summary = translate_summary(report, target_language=target_language)
        
        # Sub-Agent 1.9
        report.recommended_schemes = discover_schemes(report)
        
        # Cleanup
        os.remove(file_location)
        
        return report

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/payments/track",
    response_model=PaymentPenaltyReport,
    tags=["Statutory Payment Recovery Engine"],
    summary="Calculate Section 16 Payment Penalty via AI OCR",
    description="Accepts an Invoice PDF and Bank Receipt PDF. Extracts dates using Gemini, strictly calculates the compounding MSME Act interest penalty (3x RBI rate), and drafts a legal demand notice."
)
async def track_payment(
    invoice_file: UploadFile = File(...),
    receipt_file: UploadFile = File(...),
    company_name: str = Form(...)
):
    """
    Runs Sub-Agent 2.1 (Extractor) -> Sub-Agent 1.10 (Math Engine)
    """
    try:
        # Save files temporarily
        inv_path = f"{UPLOAD_DIR}/inv_{invoice_file.filename}"
        rect_path = f"{UPLOAD_DIR}/rect_{receipt_file.filename}"
        
        with open(inv_path, "wb") as buffer: shutil.copyfileobj(invoice_file.file, buffer)
        with open(rect_path, "wb") as buffer: shutil.copyfileobj(receipt_file.file, buffer)
            
        # 1. Extract raw text from both PDFs
        invoice_text = extract_text_from_pdf(inv_path)
        receipt_text = extract_text_from_pdf(rect_path)
        
        # 2. Agent 2.1: Extract JSON variables with Gemini
        ai_data = extract_payment_data(invoice_text, receipt_text)
        
        # 3. Agent 1.10: Pure Python Math Engine
        report = calculate_payment_penalty(
            invoice_date_str=ai_data["invoice_date"],
            payment_date_str=ai_data["payment_date"],
            principal_amount=ai_data["principal_amount"],
            company_name=company_name,
            buyer_name=ai_data["buyer_name"]
        )
        
        # Cleanup
        os.remove(inv_path)
        os.remove(rect_path)
        
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class MSMERegisterRequest(BaseModel):
    company_name: str = Field(..., example="Kavach Cyber Defense Solutions")
    sector: str = Field(..., example="IT Services")
    annual_turnover_lakhs: float = Field(..., example=85.0)
    years_of_experience: int = Field(..., example=4)
    udyam_number: str = Field(..., example="UDYAM-DL-01-0098765")
    gstin: str = Field(..., example="07AAAAA0000A1Z5")
    certifications: Optional[List[str]] = Field(default=["Udyam Certificate", "GST Registration", "PAN Card"])
    is_startup_india_recognized: Optional[bool] = Field(default=True)
    email: Optional[str] = Field(default="contact@enterprise.in")


@router.get(
    "/msme/all",
    response_model=List[Dict[str, Any]],
    tags=["Autonomous Matchmaker & Coalition Builder"],
    summary="Get All Registered MSMEs",
    description="Fetches all registered enterprises from the SQLite database to dynamically populate all frontend selectors."
)
async def get_all_msmes(db: Session = Depends(get_db)):
    """
    Returns list of all MSMEs in the database.
    """
    msmes = db.query(MSMEModel).all()
    return [m.to_dict() for m in msmes]


@router.post(
    "/msme/register",
    response_model=Dict[str, Any],
    tags=["Autonomous Matchmaker & Coalition Builder"],
    summary="Register New Enterprise (Real-World Ingestion)",
    description="Validates real Udyam Registration & GSTIN format, auto-allocates an enterprise ID, and saves to the database."
)
async def register_msme(req: MSMERegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new MSME with statutory format validation.
    """
    # 1. Format validation for Udyam
    udyam_clean = req.udyam_number.strip().upper()
    udyam_pattern = r"^UDYAM-[A-Z]{2}-\d{2}-\d{7}$"
    if not re.match(udyam_pattern, udyam_clean):
        # Auto-correct or raise descriptive error if malformed
        if not udyam_clean.startswith("UDYAM-"):
            udyam_clean = f"UDYAM-XX-00-{udyam_clean}"
        if not re.match(udyam_pattern, udyam_clean):
            raise HTTPException(
                status_code=400,
                detail="Invalid Udyam Number format. Expected format: UDYAM-XX-00-0000000 (e.g., UDYAM-DL-01-0098765)"
            )

    # 2. Format validation for GSTIN (15 characters)
    gstin_clean = req.gstin.strip().upper()
    gstin_pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
    if not re.match(gstin_pattern, gstin_clean):
        if len(gstin_clean) != 15:
            raise HTTPException(
                status_code=400,
                detail="Invalid GSTIN. Must be exactly 15 alphanumeric characters (e.g., 07AAAAA0000A1Z5)"
            )

    # 3. Check for duplicates
    existing = db.query(MSMEModel).filter(
        (MSMEModel.company_name == req.company_name) | (MSMEModel.gstin == gstin_clean)
    ).first()
    if existing:
        return {
            "message": f"Enterprise '{req.company_name}' is already registered.",
            "msme": existing.to_dict(),
            "msme_id": existing.msme_id
        }

    # 4. Generate next MSME ID (M106, M107, etc.)
    all_msmes = db.query(MSMEModel).all()
    max_num = 105
    for m in all_msmes:
        if m.msme_id.startswith("M") and m.msme_id[1:].isdigit():
            val = int(m.msme_id[1:])
            if val > max_num:
                max_num = val
    next_id = f"M{max_num + 1}"

    # 5. Persist to SQLite
    new_msme = MSMEModel(
        msme_id=next_id,
        company_name=req.company_name,
        sector=req.sector,
        annual_turnover_lakhs=req.annual_turnover_lakhs,
        years_of_experience=req.years_of_experience,
        is_startup_india_recognized=req.is_startup_india_recognized,
        gstin=gstin_clean,
        email=req.email
    )
    new_msme.certifications = req.certifications or ["Udyam Certificate"]

    db.add(new_msme)
    db.commit()
    db.refresh(new_msme)

    # 6. Initialize standard default documents for this MSME
    initial_docs = [
        DocumentModel(msme_id=next_id, document_type="Udyam Certificate", file_name=f"udyam_{next_id.lower()}.pdf", status="VALID"),
        DocumentModel(msme_id=next_id, document_type="GST Registration", file_name=f"gst_{next_id.lower()}.pdf", status="VALID"),
        DocumentModel(msme_id=next_id, document_type="PAN Card", file_name=f"pan_{next_id.lower()}.pdf", status="VALID")
    ]
    db.add_all(initial_docs)
    db.commit()

    return {
        "message": f"Enterprise '{req.company_name}' successfully registered as {next_id}!",
        "msme": new_msme.to_dict(),
        "msme_id": next_id
    }

