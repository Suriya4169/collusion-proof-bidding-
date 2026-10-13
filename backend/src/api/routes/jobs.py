import os
import uuid
import json
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from sqlalchemy.orm import Session
from typing import Dict, Any

from src.db.database import get_db, SessionLocal
from src.db.models import JobModel
from src.agents.module1.agent1_copilot.pdf_extractor import extract_text_from_pdf
from src.agents.module1.agent1_copilot.rag_retriever import chunk_text, build_hybrid_retriever, retrieve_relevant_chunks
from src.agents.module1.agent1_copilot.neural_extractor import extract_rules_with_gemini
from src.agents.module1.agent1_copilot.symbolic_verifier import verify_eligibility, MSMEProfile
from src.agents.module1.agent1_copilot.tender_simplifier import generate_plain_summary

router = APIRouter(prefix="/api/jobs", tags=["Asynchronous Task Queue (Background Workers)"])

UPLOAD_DIR = "test_data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def run_background_tender_analysis(job_id: str, file_path: str, profile_dict: dict):
    """
    Background worker function running in a non-blocking execution thread.
    Updates JobModel progress and status in SQLite/PostgreSQL.
    """
    db = SessionLocal()
    try:
        job = db.query(JobModel).filter(JobModel.job_id == job_id).first()
        if not job:
            return

        job.status = "PROCESSING"
        job.progress_percent = 25
        db.commit()

        # Step 1: Extract Text
        pdf_text = extract_text_from_pdf(file_path)
        job.progress_percent = 50
        db.commit()

        # Step 2: Ephemeral Vectorstore RAG
        chunks = chunk_text(pdf_text)
        retriever = build_hybrid_retriever(chunks)
        query = "What is the EMD amount, turnover requirement, experience requirement, MSME exemptions, and required certifications?"
        relevant_text = retrieve_relevant_chunks(retriever, query)
        job.progress_percent = 75
        db.commit()

        # Step 3: Neural & Symbolic Verification
        rules = extract_rules_with_gemini(relevant_text)
        profile = MSMEProfile(
            company_name=profile_dict.get("company_name", "Enterprise"),
            turnover_inr=profile_dict.get("turnover", 4800000),
            experience_years=profile_dict.get("experience", 4),
            certifications=profile_dict.get("certifications", ["Udyam"]),
            is_registered_msme=True
        )
        report = verify_eligibility(rules, profile)
        report.plain_summary = generate_plain_summary(report)

        # Step 4: Mark Complete
        job.status = "COMPLETED"
        job.progress_percent = 100
        job.result = report.model_dump()
        db.commit()

    except Exception as e:
        if job:
            job.status = "FAILED"
            job.error_message = str(e)
            db.commit()
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        db.close()


@router.post("/tender-analyze", response_model=Dict[str, Any], status_code=status.HTTP_202_ACCEPTED)
async def submit_async_tender_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    company_name: str = Form("Bharat Precision Engineering Pvt Ltd"),
    turnover: int = Form(4850000),
    experience: int = Form(5),
    certifications: str = Form("Udyam, GST, ISO 9001"),
    db: Session = Depends(get_db)
):
    """
    Submits a heavy multi-page tender analysis task to the background worker queue.
    Returns 202 Accepted immediately with a unique job_id for client polling.
    """
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    file_path = os.path.join(UPLOAD_DIR, f"{job_id}_{file.filename}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    cert_list = [c.strip() for c in certifications.split(",") if c.strip()]
    profile_dict = {
        "company_name": company_name,
        "turnover": turnover,
        "experience": experience,
        "certifications": cert_list
    }

    # Create job in database
    new_job = JobModel(
        job_id=job_id,
        job_type="TENDER_ANALYSIS",
        status="PENDING",
        progress_percent=0
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    # Dispatch to background task worker
    background_tasks.add_task(run_background_tender_analysis, job_id, file_path, profile_dict)

    return {
        "job_id": job_id,
        "status": "PENDING",
        "message": "Tender analysis dispatched to background worker queue.",
        "poll_url": f"/api/jobs/{job_id}"
    }


@router.get("/{job_id}", response_model=Dict[str, Any])
async def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """
    Polls the real-time status and result of an asynchronous background job.
    """
    job = db.query(JobModel).filter(JobModel.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")

    return job.to_dict()
