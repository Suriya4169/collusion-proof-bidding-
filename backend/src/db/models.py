import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime
from .database import Base

class MSMEModel(Base):
    __tablename__ = "msmes"

    id = Column(Integer, primary_key=True, index=True)
    msme_id = Column(String, unique=True, index=True, nullable=False) # e.g. M101 or UDYAM-TN-01-0012345
    company_name = Column(String, nullable=False)
    sector = Column(String, nullable=False) # e.g. IT Services, Manufacturing
    annual_turnover_lakhs = Column(Float, nullable=False)
    years_of_experience = Column(Integer, nullable=False)
    certifications_json = Column(Text, default="[]") # JSON list of strings
    is_startup_india_recognized = Column(Boolean, default=False)
    gstin = Column(String, nullable=True)
    email = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def certifications(self):
        try:
            return json.loads(self.certifications_json) if self.certifications_json else []
        except Exception:
            return []

    @certifications.setter
    def certifications(self, val):
        self.certifications_json = json.dumps(val or [])

    def to_dict(self):
        return {
            "msme_id": self.msme_id,
            "company_name": self.company_name,
            "sector": self.sector,
            "annual_turnover_lakhs": self.annual_turnover_lakhs,
            "years_of_experience": self.years_of_experience,
            "certifications": self.certifications,
            "is_startup_india_recognized": self.is_startup_india_recognized,
            "gstin": self.gstin
        }


class TenderModel(Base):
    __tablename__ = "tenders"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(String, unique=True, index=True, nullable=False) # e.g. T2001 or GEM/2026/B/9292805
    title = Column(String, nullable=False)
    department = Column(String, default="Government Department")
    category = Column(String, nullable=False) # IT Services, Manufacturing, Raw Materials
    min_turnover_lakhs = Column(Float, default=0.0)
    min_experience_years = Column(Integer, default=0)
    required_certifications_json = Column(Text, default="[]") # JSON list
    allows_startup_exemption = Column(Boolean, default=False)
    emd_amount_inr = Column(Float, default=0.0)
    estimated_value_inr = Column(String, default="As per RFP")
    submission_deadline = Column(String, default="2026-11-30")
    description = Column(Text, default="")
    status = Column(String, default="Active")
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def required_certifications(self):
        try:
            return json.loads(self.required_certifications_json) if self.required_certifications_json else []
        except Exception:
            return []

    @required_certifications.setter
    def required_certifications(self, val):
        self.required_certifications_json = json.dumps(val or [])

    def to_dict(self):
        return {
            "tender_id": self.tender_id,
            "title": self.title,
            "department": self.department,
            "category": self.category,
            "min_turnover_lakhs": self.min_turnover_lakhs,
            "min_experience_years": self.min_experience_years,
            "required_certifications": self.required_certifications,
            "allows_startup_exemption": self.allows_startup_exemption,
            "emd_amount_inr": self.emd_amount_inr,
            "estimated_value_inr": self.estimated_value_inr,
            "submission_deadline": self.submission_deadline,
            "description": self.description,
            "status": self.status
        }


class DocumentModel(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    msme_id = Column(String, index=True, nullable=False)
    document_type = Column(String, nullable=False) # Udyam Certificate, GST, PAN, ISO 9001, etc.
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=True)
    upload_date = Column(DateTime, default=datetime.utcnow)
    expiry_date = Column(String, nullable=True) # e.g. "2026-12-31" or "No Expiry"
    status = Column(String, default="VALID") # VALID, EXPIRING_SOON, EXPIRED

    def to_dict(self):
        return {
            "id": self.id,
            "msme_id": self.msme_id,
            "document_type": self.document_type,
            "file_name": self.file_name,
            "upload_date": self.upload_date.strftime("%Y-%m-%d %H:%M:%S") if self.upload_date else "",
            "expiry_date": self.expiry_date or "No Expiry",
            "status": self.status
        }
