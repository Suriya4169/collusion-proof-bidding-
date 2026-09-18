import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import List

# Import all our 10 sub-agents
from src.agents.nlp_copilot.pdf_extractor import extract_text_from_pdf
from src.agents.nlp_copilot.rag_retriever import chunk_text, build_hybrid_retriever, retrieve_relevant_chunks
from src.agents.nlp_copilot.neural_extractor import extract_rules_with_gemini
from src.agents.nlp_copilot.symbolic_verifier import verify_eligibility, MSMEProfile
from src.agents.nlp_copilot.tender_simplifier import generate_plain_summary, translate_summary
from src.agents.nlp_copilot.scheme_discoverer import discover_schemes
from src.agents.nlp_copilot.payment_tracker import calculate_payment_penalty
from src.models.schemas import VerificationReport, PaymentPenaltyReport, APIErrorResponse

router = APIRouter()

# Temporary upload directory
UPLOAD_DIR = "test_data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post(
    "/tender/analyze",
    response_model=VerificationReport,
    tags=["1. Tender Intelligence Copilot"],
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


class PaymentTrackRequest(BaseModel):
    invoice_date: str # YYYY-MM-DD
    payment_date: str # YYYY-MM-DD
    principal_amount: float
    company_name: str
    buyer_name: str

@router.post(
    "/payments/track",
    response_model=PaymentPenaltyReport,
    tags=["2. Financial & Legal Trackers"],
    summary="Calculate Section 16 Payment Penalty",
    description="Takes an invoice date and payment date to strictly calculate the compounding MSME Act interest penalty (3x RBI rate) and draft a legal demand notice.",
    responses={
        400: {"model": APIErrorResponse, "description": "Validation Error"},
        500: {"model": APIErrorResponse, "description": "Internal Server Error"}
    }
)
async def track_payment(request: PaymentTrackRequest):
    """
    Runs Sub-Agent 1.10 to calculate MSME payment penalties under Section 16.
    """
    try:
        report = calculate_payment_penalty(
            invoice_date_str=request.invoice_date,
            payment_date_str=request.payment_date,
            principal_amount=request.principal_amount,
            company_name=request.company_name,
            buyer_name=request.buyer_name
        )
        return report
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
