import os
import re
import shutil
import random
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from src.db.database import get_db
from src.db.models import TenderModel
from src.agents.module1.agent1_copilot.pdf_extractor import extract_text_from_pdf

router = APIRouter(prefix="/api/tenders", tags=["GeM Procurement Repository"])

class TenderCreateRequest(BaseModel):
    tender_id: str
    title: str
    department: str = "Government Department"
    category: str
    min_turnover_lakhs: float = 0.0
    min_experience_years: int = 0
    required_certifications: List[str] = []
    allows_startup_exemption: bool = False
    emd_amount_inr: float = 0.0
    estimated_value_inr: str = "As per RFP"
    submission_deadline: str = "2026-11-30"
    description: str = ""

@router.get("", response_model=Dict[str, Any])
async def list_tenders(
    category: Optional[str] = Query(None, description="Filter tenders by category/sector (e.g. 'IT Services', 'Manufacturing')"),
    search: Optional[str] = Query(None, description="Search keyword in title, department, or tender ID"),
    db: Session = Depends(get_db)
):
    """
    Returns active government tenders from the database for the marketplace.
    Supports real-time search, category filters, and statistics.
    """
    query = db.query(TenderModel).filter(TenderModel.status == "Active")

    if category and category != "All":
        query = query.filter(TenderModel.category == category)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (TenderModel.title.ilike(search_filter)) |
            (TenderModel.department.ilike(search_filter)) |
            (TenderModel.tender_id.ilike(search_filter))
        )

    tenders = query.all()
    results = [t.to_dict() for t in tenders]

    # Available categories for frontend filter dropdown
    all_categories = [c[0] for c in db.query(TenderModel.category).distinct().all()]

    return {
        "total_count": len(results),
        "available_categories": all_categories,
        "tenders": results
    }

@router.get("/{tender_id}", response_model=Dict[str, Any])
async def get_tender_detail(tender_id: str, db: Session = Depends(get_db)):
    """
    Retrieves the complete details of a specific tender by its ID.
    """
    # URL decode tender_id if it contains slashes (like GEM/2026/B/9292805)
    tender = db.query(TenderModel).filter(TenderModel.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail=f"Tender {tender_id} not found.")

    return tender.to_dict()

@router.post("", response_model=Dict[str, Any], status_code=201)
async def create_tender(payload: TenderCreateRequest, db: Session = Depends(get_db)):
    """
    Allows publishing a new tender into the platform database.
    """
    existing = db.query(TenderModel).filter(TenderModel.tender_id == payload.tender_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Tender with ID {payload.tender_id} already exists.")

    tender = TenderModel(
        tender_id=payload.tender_id,
        title=payload.title,
        department=payload.department,
        category=payload.category,
        min_turnover_lakhs=payload.min_turnover_lakhs,
        min_experience_years=payload.min_experience_years,
        allows_startup_exemption=payload.allows_startup_exemption,
        emd_amount_inr=payload.emd_amount_inr,
        estimated_value_inr=payload.estimated_value_inr,
        submission_deadline=payload.submission_deadline,
        description=payload.description,
        status="Active"
    )
    tender.required_certifications = payload.required_certifications
    db.add(tender)
    db.commit()
    db.refresh(tender)

    return {"message": "Tender created successfully", "tender": tender.to_dict()}


@router.post("/upload-pdf", response_model=Dict[str, Any], status_code=201)
async def upload_tender_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Real-World GeM Tender Ingestion:
    Accepts any official GeM or CPPP public tender notice PDF.
    Extracts text using PyMuPDF and parses tender metadata (Bid ID, Ministry, EMD, Turnover, Category)
    directly into SQLite database.
    """
    temp_dir = "test_data/uploads"
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"tender_{file.filename}")

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 1. Extract raw text with PyMuPDF
        raw_text = extract_text_from_pdf(temp_path)
        if not raw_text or len(raw_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="Uploaded PDF contains insufficient or unreadable text.")

        # 2. Extract Bid/Tender ID
        bid_match = re.search(r"GEM/\d{4}/[A-Z]/\d+", raw_text, re.IGNORECASE)
        if not bid_match:
            bid_match = re.search(r"(?:Bid Number|Tender ID|Tender Ref No|NIT No)[:\s]+([\w\-/]+)", raw_text, re.IGNORECASE)
        
        tender_id = bid_match.group(0).strip() if bid_match else f"GEM/2026/B/{random.randint(9100000, 9999999)}"

        # 3. Extract Ministry / Department
        dept_match = re.search(r"(Ministry of [A-Za-z\s&,]+|Department of [A-Za-z\s&,]+|Directorate of [A-Za-z\s&,]+|[\w\s]+Procurement Directorate)", raw_text, re.IGNORECASE)
        department = dept_match.group(1).strip() if dept_match else "Central Public Procurement Portal"

        # 4. Extract Title / Item Category
        title_match = re.search(r"(?:Item Title|Name of Work|Title|Subject)[:\s]+([^\n\r.]+)", raw_text, re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()
        else:
            # Fallback to file name without extension
            base_name = os.path.splitext(file.filename)[0].replace("_", " ").title()
            title = f"Procurement of {base_name}"

        # 5. Classify Category based on keywords
        text_lower = raw_text.lower()
        if any(w in text_lower for w in ["software", "cloud", "portal", "hosting", "cyber", "it support", "developer"]):
            category = "IT Services"
        elif any(w in text_lower for w in ["machinery", "fabrication", "lathe", "precision", "components", "aerospace"]):
            category = "Manufacturing"
        elif any(w in text_lower for w in ["steel", "alloy", "copper", "iron", "chemicals", "cement", "pipes"]):
            category = "Raw Materials"
        else:
            category = "Infrastructure"

        # 6. Extract Turnover Requirement
        turnover_match = re.search(r"(?:Turnover|Annual Turnover)[^\d\n\r]*(\d+(?:\.\d+)?)\s*(Lakh|Crore|Cr)?", raw_text, re.IGNORECASE)
        min_turnover_lakhs = 25.0
        if turnover_match:
            val = float(turnover_match.group(1))
            unit = (turnover_match.group(2) or "").lower()
            if "crore" in unit or "cr" in unit:
                min_turnover_lakhs = val * 100.0
            else:
                min_turnover_lakhs = val

        # 7. Extract Experience Requirement
        exp_match = re.search(r"(?:Experience)[^\d\n\r]*(\d+)\s*(?:years?|yrs?)", raw_text, re.IGNORECASE)
        min_experience_years = int(exp_match.group(1)) if exp_match else 2

        # 8. Extract EMD Amount
        emd_match = re.search(r"(?:EMD Amount|Earnest Money Deposit|EMD)[^\d\n\r]*(?:Rs\.?|INR|₹)?\s*([\d,]+)", raw_text, re.IGNORECASE)
        emd_amount_inr = 50000.0
        if emd_match:
            clean_emd = emd_match.group(1).replace(",", "")
            try:
                emd_amount_inr = float(clean_emd)
            except Exception:
                pass

        # 9. Startup Exemption
        allows_startup = bool(re.search(r"(?:startup exemption|exemption for msme|relaxed for startup)", raw_text, re.IGNORECASE))

        # 10. Estimated Value
        val_match = re.search(r"(?:Estimated Value|Estimated Bid Value|Contract Value)[^\d\n\r]*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:Lakh|Crore|Cr)?)", raw_text, re.IGNORECASE)
        estimated_val = f"₹ {min_turnover_lakhs} Lakhs" if min_turnover_lakhs < 100 else f"₹ {round(min_turnover_lakhs/100, 2)} Crores"
        if val_match:
            estimated_val = f"₹ {val_match.group(1).strip()}"

        # 11. Submission Deadline
        date_match = re.search(r"(?:Bid End Date|Due Date|Submission Deadline)[^\d\n\r]*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})", raw_text, re.IGNORECASE)
        submission_deadline = date_match.group(1) if date_match else "2026-11-30"

        # Persist or update in SQLite
        existing = db.query(TenderModel).filter(TenderModel.tender_id == tender_id).first()
        if existing:
            existing.title = title
            existing.department = department
            existing.category = category
            existing.min_turnover_lakhs = min_turnover_lakhs
            existing.min_experience_years = min_experience_years
            existing.allows_startup_exemption = allows_startup
            existing.emd_amount_inr = emd_amount_inr
            existing.estimated_value_inr = estimated_val
            existing.submission_deadline = submission_deadline
            existing.description = f"Autonomous GeM Ingestion from {file.filename}"
            db.commit()
            db.refresh(existing)
            created_tender = existing
        else:
            new_tender = TenderModel(
                tender_id=tender_id,
                title=title,
                department=department,
                category=category,
                min_turnover_lakhs=min_turnover_lakhs,
                min_experience_years=min_experience_years,
                allows_startup_exemption=allows_startup,
                emd_amount_inr=emd_amount_inr,
                estimated_value_inr=estimated_val,
                submission_deadline=submission_deadline,
                description=f"Autonomous GeM Ingestion from {file.filename}",
                status="Active"
            )
            db.add(new_tender)
            db.commit()
            db.refresh(new_tender)
            created_tender = new_tender

        return {
            "message": f"Successfully ingested tender '{title}' from GeM PDF!",
            "tender": created_tender.to_dict()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest tender PDF: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

