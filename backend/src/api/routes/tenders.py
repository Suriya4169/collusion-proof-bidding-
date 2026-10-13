from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from src.db.database import get_db
from src.db.models import TenderModel

router = APIRouter(prefix="/api/tenders", tags=["Tender Marketplace API"])

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
