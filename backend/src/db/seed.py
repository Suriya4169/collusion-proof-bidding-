import os
import json
from .database import engine, SessionLocal, Base
from .models import MSMEModel, TenderModel, DocumentModel

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "test_data", "databases")
MSME_JSON = os.path.join(DB_DIR, "msme_database.json")
TENDER_JSON = os.path.join(DB_DIR, "tender_database.json")

def seed_database():
    """Initializes tables and seeds initial mock/real data if empty."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Seed MSMEs
        if db.query(MSMEModel).count() == 0:
            msmes_data = []
            if os.path.exists(MSME_JSON):
                with open(MSME_JSON, "r", encoding="utf-8") as f:
                    msmes_data = json.load(f)
            
            for item in msmes_data:
                msme = MSMEModel(
                    msme_id=item["msme_id"],
                    company_name=item["company_name"],
                    sector=item["sector"],
                    annual_turnover_lakhs=float(item["annual_turnover_lakhs"]),
                    years_of_experience=int(item["years_of_experience"]),
                    is_startup_india_recognized=item.get("is_startup_india_recognized", False),
                    gstin="33AABCU9603R1ZM"
                )
                msme.certifications = item.get("certifications", [])
                db.add(msme)

            # Also seed default enterprise profile for login testing
            default_profile = MSMEModel(
                msme_id="UDYAM-TN-01-0012345",
                company_name="Bharat Precision Engineering Pvt Ltd",
                sector="Manufacturing",
                annual_turnover_lakhs=48.5,
                years_of_experience=5,
                is_startup_india_recognized=True,
                gstin="33AABCU9603R1ZM"
            )
            default_profile.certifications = ["Udyam", "ISO 9001", "Make In India"]
            db.add(default_profile)
            db.commit()

        # 2. Seed Tenders
        if db.query(TenderModel).count() == 0:
            tenders_data = []
            if os.path.exists(TENDER_JSON):
                with open(TENDER_JSON, "r", encoding="utf-8") as f:
                    tenders_data = json.load(f)

            for t in tenders_data:
                tender = TenderModel(
                    tender_id=t["tender_id"],
                    title=t["title"],
                    department="State Procurement Directorate",
                    category=t["category"],
                    min_turnover_lakhs=float(t.get("min_turnover_lakhs", 0)),
                    min_experience_years=int(t.get("min_experience_years", 0)),
                    allows_startup_exemption=t.get("allows_startup_exemption", False),
                    emd_amount_inr=50000.0,
                    estimated_value_inr=f"₹ {t.get('min_turnover_lakhs', 50)} Lakhs",
                    submission_deadline="2026-11-20",
                    description=f"Official government procurement for {t['title']} under {t['category']} sector.",
                    status="Active"
                )
                tender.required_certifications = t.get("required_certifications", [])
                db.add(tender)

            # Add GeM Real Portal Tenders
            gem_tenders = [
                {
                    "tender_id": "GEM/2026/B/9292805",
                    "title": "Supply of Precision Machined Components for Aerospace Division",
                    "department": "Ministry of Defence (HAL)",
                    "category": "Manufacturing",
                    "min_turnover_lakhs": 250.0,
                    "min_experience_years": 3,
                    "required_certifications": ["ISO 9001", "OEM Authorization"],
                    "allows_startup_exemption": True,
                    "emd_amount_inr": 50000.0,
                    "estimated_value_inr": "₹ 2.5 Crores",
                    "submission_deadline": "2026-10-15",
                    "description": "High precision CNC machined parts for aircraft structural mounts."
                },
                {
                    "tender_id": "GEM/2026/B/9394343",
                    "title": "Procurement of High-Grade Steel Alloy Sheets (Grade 304)",
                    "department": "Ministry of Railways",
                    "category": "Raw Materials",
                    "min_turnover_lakhs": 120.0,
                    "min_experience_years": 2,
                    "required_certifications": ["BIS", "Make In India"],
                    "allows_startup_exemption": True,
                    "emd_amount_inr": 25000.0,
                    "estimated_value_inr": "₹ 1.2 Crores",
                    "submission_deadline": "2026-10-22",
                    "description": "Cold rolled stainless steel sheets for coach fabrication."
                },
                {
                    "tender_id": "GEM/2026/B/9472132",
                    "title": "Annual Maintenance Contract for IT Infrastructure",
                    "department": "Ministry of Finance",
                    "category": "IT Services",
                    "min_turnover_lakhs": 85.0,
                    "min_experience_years": 3,
                    "required_certifications": ["ISO 27001"],
                    "allows_startup_exemption": True,
                    "emd_amount_inr": 0.0,
                    "estimated_value_inr": "₹ 85 Lakhs",
                    "submission_deadline": "2026-11-05",
                    "description": "Comprehensive IT infrastructure and server maintenance support."
                },
                {
                    "tender_id": "GEM/2026/B/9558683",
                    "title": "Installation of Solar Panels (50KW) in Government Quarters",
                    "department": "Ministry of New and Renewable Energy",
                    "category": "Infrastructure",
                    "min_turnover_lakhs": 340.0,
                    "min_experience_years": 4,
                    "required_certifications": ["MNRE Approved", "ISO 9001"],
                    "allows_startup_exemption": False,
                    "emd_amount_inr": 100000.0,
                    "estimated_value_inr": "₹ 3.4 Crores",
                    "submission_deadline": "2026-11-12",
                    "description": "Rooftop solar photovoltaic power plant design and commissioning."
                }
            ]

            for gt in gem_tenders:
                tender = TenderModel(
                    tender_id=gt["tender_id"],
                    title=gt["title"],
                    department=gt["department"],
                    category=gt["category"],
                    min_turnover_lakhs=gt["min_turnover_lakhs"],
                    min_experience_years=gt["min_experience_years"],
                    allows_startup_exemption=gt["allows_startup_exemption"],
                    emd_amount_inr=gt["emd_amount_inr"],
                    estimated_value_inr=gt["estimated_value_inr"],
                    submission_deadline=gt["submission_deadline"],
                    description=gt["description"],
                    status="Active"
                )
                tender.required_certifications = gt["required_certifications"]
                db.add(tender)

            db.commit()

        # 3. Seed Sample Documents for Document Vault
        if db.query(DocumentModel).count() == 0:
            sample_docs = [
                # For M101
                {"msme_id": "M101", "document_type": "Udyam Certificate", "file_name": "udyam_registration_m101.pdf", "expiry_date": "No Expiry", "status": "VALID"},
                {"msme_id": "M101", "document_type": "GST Registration", "file_name": "gstin_certificate.pdf", "expiry_date": "No Expiry", "status": "VALID"},
                {"msme_id": "M101", "document_type": "PAN Card", "file_name": "company_pan.pdf", "expiry_date": "No Expiry", "status": "VALID"},
                {"msme_id": "M101", "document_type": "ISO 9001", "file_name": "iso_9001_quality_cert.pdf", "expiry_date": "2026-12-31", "status": "EXPIRING_SOON"},
                {"msme_id": "M101", "document_type": "Last 3 Years ITR", "file_name": "itr_acknowledgement_3yrs.pdf", "expiry_date": "2027-03-31", "status": "VALID"},

                # For UDYAM-TN-01-0012345
                {"msme_id": "UDYAM-TN-01-0012345", "document_type": "Udyam Certificate", "file_name": "udyam_tn_cert.pdf", "expiry_date": "No Expiry", "status": "VALID"},
                {"msme_id": "UDYAM-TN-01-0012345", "document_type": "GST Registration", "file_name": "gst_33AABCU.pdf", "expiry_date": "No Expiry", "status": "VALID"},
                {"msme_id": "UDYAM-TN-01-0012345", "document_type": "PAN Card", "file_name": "pan_bharat.pdf", "expiry_date": "No Expiry", "status": "VALID"},
                {"msme_id": "UDYAM-TN-01-0012345", "document_type": "ISO 9001", "file_name": "iso_qms_2026.pdf", "expiry_date": "2026-12-15", "status": "EXPIRING_SOON"},
                {"msme_id": "UDYAM-TN-01-0012345", "document_type": "Last 3 Years ITR", "file_name": "itr_audited_reports.pdf", "expiry_date": "2027-03-31", "status": "VALID"},
            ]
            for doc in sample_docs:
                d = DocumentModel(
                    msme_id=doc["msme_id"],
                    document_type=doc["document_type"],
                    file_name=doc["file_name"],
                    file_path=f"vault/{doc['file_name']}",
                    expiry_date=doc["expiry_date"],
                    status=doc["status"]
                )
                db.add(d)
            db.commit()

        # 4. Seed Default RBAC Users for Authentication
        from .models import UserModel
        from src.core.auth import hash_password

        if db.query(UserModel).count() == 0:
            default_users = [
                UserModel(
                    email="msme@apex.in",
                    hashed_password=hash_password("Password123!"),
                    full_name="Rajesh Sharma (Apex Tools)",
                    role="msme",
                    msme_id="M101",
                    is_active=True
                ),
                UserModel(
                    email="auditor@gem.gov.in",
                    hashed_password=hash_password("Password123!"),
                    full_name="Dr. Vikram Patel (GeM Auditor)",
                    role="government_auditor",
                    msme_id=None,
                    is_active=True
                ),
                UserModel(
                    email="admin@procureguard.in",
                    hashed_password=hash_password("Password123!"),
                    full_name="System Administrator",
                    role="admin",
                    msme_id=None,
                    is_active=True
                )
            ]
            db.add_all(default_users)
            db.commit()

    finally:
        db.close()
