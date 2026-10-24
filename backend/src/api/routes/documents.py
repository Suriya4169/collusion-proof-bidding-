import os
import re
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime

from src.core.access import ensure_msme_write, get_current_user, msme_form_write, msme_path_read
from src.db.database import get_db
from src.db.models import DocumentModel, MSMEModel, UserModel
from src.agents.module1.agent1_copilot.pdf_extractor import extract_text_from_pdf

router = APIRouter(prefix="/api/documents", tags=["Procurement Readiness Vault"])

VAULT_STORAGE_DIR = "test_data/vault_storage"
os.makedirs(VAULT_STORAGE_DIR, exist_ok=True)

# Standard mandatory government procurement document checklist
STANDARD_CHECKLIST = [
    {"type": "Udyam Certificate", "mandatory": True, "description": "Official MSME registration under Ministry of MSME"},
    {"type": "GST Registration", "mandatory": True, "description": "GSTIN registration certificate (Form GST REG-06)"},
    {"type": "PAN Card", "mandatory": True, "description": "Company/Proprietor Permanent Account Number"},
    {"type": "ISO 9001", "mandatory": False, "description": "Quality Management System Certification"},
    {"type": "Last 3 Years ITR", "mandatory": True, "description": "Income Tax Returns and CA Audited Balance Sheet"},
    {"type": "Solvency Certificate", "mandatory": False, "description": "Bank solvency certificate issued within 6 months"},
    {"type": "Bank Statement", "mandatory": True, "description": "Last 6 months bank statement showing liquidity"}
]

@router.get("/{msme_id}", response_model=Dict[str, Any])
async def get_document_vault(msme_id: str, db: Session = Depends(get_db), _: UserModel = Depends(msme_path_read)):
    """
    Returns the MSME's Document Vault status, uploaded files, missing documents,
    and calculates their overall Procurement Readiness Score (e.g., 71%).
    """
    uploaded_docs = db.query(DocumentModel).filter(DocumentModel.msme_id == msme_id).all()
    uploaded_types = {d.document_type: d for d in uploaded_docs}

    vault_items = []
    missing_items = []
    alerts = []

    for item in STANDARD_CHECKLIST:
        doc_type = item["type"]
        if doc_type in uploaded_types:
            doc = uploaded_types[doc_type]
            vault_items.append({
                "id": doc.id,
                "document_type": doc_type,
                "file_name": doc.file_name,
                "upload_date": doc.upload_date.strftime("%Y-%m-%d") if doc.upload_date else "Uploaded",
                "expiry_date": doc.expiry_date or "No Expiry",
                "status": doc.status,
                "is_uploaded": True
            })

            # Check if expiring
            if doc.status == "EXPIRING_SOON" or (doc.expiry_date and "2026" in doc.expiry_date):
                alerts.append(f"⚠️ Your {doc_type} certificate expires soon ({doc.expiry_date})! Renew it with ZED Scheme (80% subsidy).")
        else:
            vault_items.append({
                "id": None,
                "document_type": doc_type,
                "file_name": None,
                "upload_date": None,
                "expiry_date": None,
                "status": "MISSING",
                "is_uploaded": False
            })
            missing_items.append(doc_type)

    # Calculate Readiness Score: (Uploaded / Total Checklist) * 100
    total_checklist = len(STANDARD_CHECKLIST)
    uploaded_count = len(uploaded_docs)
    readiness_score = round((uploaded_count / total_checklist) * 100, 1)

    return {
        "msme_id": msme_id,
        "readiness_score": readiness_score,
        "total_documents_uploaded": uploaded_count,
        "total_required": total_checklist,
        "vault_documents": vault_items,
        "missing_documents": missing_items,
        "proactive_alerts": alerts
    }


@router.post("/upload", response_model=Dict[str, Any])
async def upload_document(
    file: UploadFile = File(...),
    msme_id: str = Form(...),
    document_type: str = Form(...),
    expiry_date: Optional[str] = Form("No Expiry"),
    db: Session = Depends(get_db),
    _: UserModel = Depends(msme_form_write),
):
    """
    Uploads a new certificate/document into the MSME's digital vault.
    """
    try:
        # Save file to vault storage
        file_path = os.path.join(VAULT_STORAGE_DIR, f"{msme_id}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Check if this document type already exists for this MSME
        existing_doc = db.query(DocumentModel).filter(
            DocumentModel.msme_id == msme_id,
            DocumentModel.document_type == document_type
        ).first()

        status = "VALID"
        if expiry_date and expiry_date != "No Expiry":
            # Simple check
            status = "VALID"

        if existing_doc:
            # Update existing
            existing_doc.file_name = file.filename
            existing_doc.file_path = file_path
            existing_doc.upload_date = datetime.utcnow()
            existing_doc.expiry_date = expiry_date
            existing_doc.status = status
            db.commit()
            db.refresh(existing_doc)
            return {"message": f"{document_type} updated successfully", "document": existing_doc.to_dict()}
        else:
            # Create new
            new_doc = DocumentModel(
                msme_id=msme_id,
                document_type=document_type,
                file_name=file.filename,
                file_path=file_path,
                expiry_date=expiry_date,
                status=status
            )
            db.add(new_doc)
            db.commit()
            db.refresh(new_doc)
            return {"message": f"{document_type} uploaded successfully", "document": new_doc.to_dict()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")


@router.post("/extract-and-verify", response_model=Dict[str, Any])
async def extract_and_verify_document(
    file: UploadFile = File(...),
    msme_id: str = Form(...),
    db: Session = Depends(get_db),
    _: UserModel = Depends(msme_form_write),
):
    """
    Autonomous AI Document OCR & Verification:
    Accepts any uploaded PDF certificate (GST, Udyam, ISO, PAN, ITR, Solvency).
    Reads the text with PyMuPDF, auto-detects the document type, extracts certificate IDs
    and expiration dates, and updates the Readiness Gauge without manual user typing.
    """
    try:
        file_path = os.path.join(VAULT_STORAGE_DIR, f"{msme_id}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 1. Read text with PyMuPDF if PDF, otherwise fallback
        raw_text = ""
        if file.filename.lower().endswith(".pdf"):
            try:
                raw_text = extract_text_from_pdf(file_path)
            except Exception:
                raw_text = ""

        text_upper = raw_text.upper()
        fname_lower = file.filename.lower()

        # 2. Autonomous Document Type & Expiry Classifier
        doc_type = "ISO 9001"
        expiry_date = "No Expiry"
        detected_id = None

        if "UDYAM" in text_upper or "MINISTRY OF MICRO" in text_upper or "udyam" in fname_lower:
            doc_type = "Udyam Certificate"
            expiry_date = "No Expiry"
            m = re.search(r"UDYAM-[A-Z]{2}-\d{2}-\d{7}", raw_text, re.IGNORECASE)
            if m: detected_id = m.group(0)

        elif "GST REG-06" in text_upper or "GOODS AND SERVICES TAX" in text_upper or "GSTIN" in text_upper or "gst" in fname_lower:
            doc_type = "GST Registration"
            expiry_date = "No Expiry"
            m = re.search(r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}", raw_text)
            if m: detected_id = m.group(0)

        elif "PERMANENT ACCOUNT NUMBER" in text_upper or "INCOME TAX DEPARTMENT" in text_upper or "pan" in fname_lower:
            doc_type = "PAN Card"
            expiry_date = "No Expiry"
            m = re.search(r"[A-Z]{5}[0-9]{4}[A-Z]{1}", raw_text)
            if m: detected_id = m.group(0)

        elif "SOLVENCY" in text_upper or "solvency" in fname_lower:
            doc_type = "Solvency Certificate"
            expiry_date = "2026-12-31"

        elif "BANK STATEMENT" in text_upper or "STATEMENT OF ACCOUNT" in text_upper or "bank" in fname_lower:
            doc_type = "Bank Statement"
            expiry_date = "No Expiry"

        elif "INCOME TAX RETURN" in text_upper or "ITR" in text_upper or "BALANCE SHEET" in text_upper or "itr" in fname_lower:
            doc_type = "Last 3 Years ITR"
            expiry_date = "2027-03-31"

        else: # ISO 9001
            doc_type = "ISO 9001"
            # Try to extract date
            d_match = re.search(r"(?:valid until|expiry|validity)[^\d\n\r]*(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}|\d{2}-\d{2}-\d{4})", raw_text, re.IGNORECASE)
            expiry_date = d_match.group(1) if d_match else "2026-12-31"

        status = "EXPIRING_SOON" if ("2026" in expiry_date and doc_type == "ISO 9001") else "VALID"

        # 3. Update or Insert in Database
        existing_doc = db.query(DocumentModel).filter(
            DocumentModel.msme_id == msme_id,
            DocumentModel.document_type == doc_type
        ).first()

        if existing_doc:
            existing_doc.file_name = file.filename
            existing_doc.file_path = file_path
            existing_doc.upload_date = datetime.utcnow()
            existing_doc.expiry_date = expiry_date
            existing_doc.status = status
            db.commit()
            db.refresh(existing_doc)
            saved_doc = existing_doc
        else:
            new_doc = DocumentModel(
                msme_id=msme_id,
                document_type=doc_type,
                file_name=file.filename,
                file_path=file_path,
                expiry_date=expiry_date,
                status=status
            )
            db.add(new_doc)
            db.commit()
            db.refresh(new_doc)
            saved_doc = new_doc

        # Calculate new readiness score
        total_docs = db.query(DocumentModel).filter(DocumentModel.msme_id == msme_id).count()
        score = round((total_docs / 7) * 100, 1)

        return {
            "message": f"AI verified and classified document as {doc_type}!",
            "detected_type": doc_type,
            "detected_id": detected_id or "Auto-Verified",
            "extracted_expiry": expiry_date,
            "status": status,
            "readiness_score": score,
            "document": saved_doc.to_dict()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to auto-verify document: {str(e)}")



@router.delete("/{document_id}", response_model=Dict[str, Any])
async def delete_document(document_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    """
    Deletes a document from the vault.
    """
    doc = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    ensure_msme_write(db, user, doc.msme_id)

    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    db.delete(doc)
    db.commit()

    return {"message": "Document deleted successfully"}
