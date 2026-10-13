import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime

from src.db.database import get_db
from src.db.models import DocumentModel, MSMEModel

router = APIRouter(prefix="/api/documents", tags=["Document Vault API"])

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
async def get_document_vault(msme_id: str, db: Session = Depends(get_db)):
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
    db: Session = Depends(get_db)
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


@router.delete("/{document_id}", response_model=Dict[str, Any])
async def delete_document(document_id: int, db: Session = Depends(get_db)):
    """
    Deletes a document from the vault.
    """
    doc = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    db.delete(doc)
    db.commit()

    return {"message": "Document deleted successfully"}
