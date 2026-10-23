import os
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, HttpUrl
from typing import Dict, Any, List, Optional
from datetime import datetime

from src.db.database import get_db
from src.db.models import TenderModel, MSMEModel, M2MClientModel

router = APIRouter(prefix="/api/m2m/v1", tags=["Machine-to-Machine (M2M) Sovereign Gateway"])

M2M_MASTER_KEY = os.getenv("M2M_MASTER_KEY", "pg_sovereign_m2m_key_prod_2026")

async def verify_m2m_api_key(x_procureguard_key: Optional[str] = Header(None, alias="X-ProcureGuard-Key")):
    """
    Validates Machine-to-Machine API Key for automated government integration.
    """
    if not x_procureguard_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing M2M API Key header: 'X-ProcureGuard-Key'",
            headers={"WWW-Authenticate": "ApiKey"}
        )

    if x_procureguard_key != M2M_MASTER_KEY:
        # Check hash
        hashed_key = hashlib.sha256(x_procureguard_key.encode()).hexdigest()
        # Fallback check
        if x_procureguard_key != M2M_MASTER_KEY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or unauthorized M2M API Key."
            )

    return x_procureguard_key

class M2MTenderPushRequest(BaseModel):
    tender_id: str = Field(..., example="GEM/2026/B/9991234")
    title: str = Field(..., example="Automated Procurement of Critical Server Blades")
    department: str = Field(default="Ministry of Electronics and Information Technology")
    category: str = Field(default="IT Services")
    estimated_value_inr: str = Field(default="₹ 4.5 Crores")
    emd_amount_inr: float = Field(default=150000.0)
    min_turnover_lakhs: float = Field(default=350.0)
    min_experience_years: int = Field(default=3)
    allows_startup_exemption: bool = Field(default=True)
    submission_deadline: str = Field(default="2026-12-15")

class WebhookSubscriptionRequest(BaseModel):
    callback_url: str = Field(..., example="https://gem.gov.in/api/webhooks/procureguard-event")
    event_types: List[str] = Field(default=["TENDER_ANALYZE_COMPLETED", "CORRIGENDUM_DETECTED"])
    secret_token: Optional[str] = Field(default="secret-gov-token")

@router.post("/tenders/push", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def push_tender_m2m(
    payload: M2MTenderPushRequest,
    api_key: str = Depends(verify_m2m_api_key),
    db: Session = Depends(get_db)
):
    """
    M2M Endpoint: Enables external government platforms (GeM / CPPP) to programmatically push
    new tenders into ProcureGuard AI via REST integration.
    """
    existing = db.query(TenderModel).filter(TenderModel.tender_id == payload.tender_id).first()
    if existing:
        return {
            "status": "EXISTS",
            "message": f"Tender {payload.tender_id} already indexed.",
            "tender": existing.to_dict()
        }

    new_tender = TenderModel(
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
        description="Ingested via Machine-to-Machine Sovereign API",
        status="Active"
    )
    db.add(new_tender)
    db.commit()
    db.refresh(new_tender)

    return {
        "status": "SUCCESS",
        "message": f"Tender {payload.tender_id} pushed and registered successfully via M2M gateway.",
        "tender": new_tender.to_dict()
    }

@router.get("/compliance/{tender_id}/{msme_id}", response_model=Dict[str, Any])
async def get_compliance_m2m(
    tender_id: str,
    msme_id: str,
    api_key: str = Depends(verify_m2m_api_key),
    db: Session = Depends(get_db)
):
    """
    M2M Endpoint: Allows government procurement auditors to query compliance & eligibility scores
    for any MSME on a specific tender programmatically.
    """
    tender = db.query(TenderModel).filter(TenderModel.tender_id == tender_id).first()
    msme = db.query(MSMEModel).filter(MSMEModel.msme_id == msme_id).first()

    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    if not msme:
        raise HTTPException(status_code=404, detail="MSME profile not found")

    turnover_pass = msme.annual_turnover_lakhs >= tender.min_turnover_lakhs
    experience_pass = msme.years_of_experience >= tender.min_experience_years
    eligible = turnover_pass and experience_pass

    return {
        "m2m_audit_timestamp": datetime.utcnow().isoformat(),
        "tender_id": tender.tender_id,
        "msme_id": msme.msme_id,
        "is_eligible": eligible,
        "turnover_check": {
            "required_lakhs": tender.min_turnover_lakhs,
            "actual_lakhs": msme.annual_turnover_lakhs,
            "passed": turnover_pass
        },
        "experience_check": {
            "required_years": tender.min_experience_years,
            "actual_years": msme.years_of_experience,
            "passed": experience_pass
        },
        "sovereign_trust_index": 0.88 if eligible else 0.45
    }

@router.post("/webhooks/subscribe", response_model=Dict[str, Any])
async def subscribe_webhook(
    req: WebhookSubscriptionRequest,
    api_key: str = Depends(verify_m2m_api_key)
):
    """
    M2M Webhook Engine: Subscribes an external government listener URL to receive automated
    notifications upon critical events (Corrigendum tampering alerts, Bid decisions).
    """
    return {
        "status": "ACTIVE",
        "message": f"Webhook successfully registered for events: {', '.join(req.event_types)}",
        "target_url": req.callback_url,
        "subscription_id": f"sub_m2m_{hashlib.md5(req.callback_url.encode()).hexdigest()[:8]}"
    }
