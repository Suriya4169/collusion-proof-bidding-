import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, UniqueConstraint
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


class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="msme") # "msme", "government_auditor", "admin"
    msme_id = Column(String, nullable=True) # Linked MSME Profile (e.g. "M101")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "msme_id": self.msme_id,
            "is_active": self.is_active,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else ""
        }


class UserEnterpriseModel(Base):
    """An enterprise a vendor account may act for, beyond the one on the account itself (``UserModel.msme_id``).
    A vendor who registers a new enterprise is linked to it here, so they keep access to what they created."""
    __tablename__ = "user_enterprises"
    __table_args__ = (UniqueConstraint("user_id", "msme_id", name="uq_user_enterprise"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    msme_id = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class JobModel(Base):
    __tablename__ = "async_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, unique=True, index=True, nullable=False)
    job_type = Column(String, nullable=False) # e.g. "TENDER_ANALYSIS", "OCR_VERIFICATION"
    status = Column(String, default="PENDING") # "PENDING", "PROCESSING", "COMPLETED", "FAILED"
    progress_percent = Column(Integer, default=0)
    result_json = Column(Text, default="{}")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def result(self):
        try:
            return json.loads(self.result_json) if self.result_json else {}
        except Exception:
            return {}

    @result.setter
    def result(self, val):
        self.result_json = json.dumps(val or {})

    def to_dict(self):
        return {
            "job_id": self.job_id,
            "job_type": self.job_type,
            "status": self.status,
            "progress_percent": self.progress_percent,
            "result": self.result,
            "error_message": self.error_message,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else "",
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M:%S") if self.updated_at else ""
        }


class M2MClientModel(Base):
    __tablename__ = "m2m_clients"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String, unique=True, index=True, nullable=False)
    client_name = Column(String, nullable=False) # e.g. "GeM Central Ingestion Service"
    api_key_hash = Column(String, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "client_id": self.client_id,
            "client_name": self.client_name,
            "is_active": self.is_active,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else ""
        }



class NotificationModel(Base):
    """A proactive tender-match alert pushed to an MSME by the match notifier."""
    __tablename__ = "match_notifications"
    __table_args__ = (UniqueConstraint("msme_id", "tender_id", "kind", name="uq_notification_msme_tender_kind"),)

    id = Column(Integer, primary_key=True, index=True)
    msme_id = Column(String, index=True, nullable=False)
    tender_id = Column(String, index=True, nullable=False)
    kind = Column(String, nullable=False)  # "SOLO" or "JV"
    score = Column(Integer, default=0)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    partner_name = Column(String, nullable=True)  # JV co-partner
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "msme_id": self.msme_id,
            "tender_id": self.tender_id,
            "kind": self.kind,
            "score": self.score,
            "title": self.title,
            "message": self.message,
            "partner_name": self.partner_name,
            "created_at": self.created_at.strftime("%Y-%m-%dT%H:%M:%S") if self.created_at else "",
            "read": self.read_at is not None,
        }


class BehaviorSignalModel(Base):
    """One Agent 4 (behavioural biometrics) signal attached to a bid or tender reference.

    Only derived values are stored (score, category, evidence text). Raw keystroke timings and anything the
    bidder typed are never persisted. A signal is advisory: nothing in the platform blocks on it.
    """
    __tablename__ = "behavior_signals"

    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String, index=True, nullable=False)  # bid / tender reference the signal belongs to
    session_id = Column(String, nullable=False)
    user_id = Column(Integer, nullable=True)
    msme_id = Column(String, index=True, nullable=True)
    # scored | insufficient_data | no_timing | invalid_timing | unavailable
    status = Column(String, index=True, nullable=False)
    scoring_mode = Column(String, nullable=True)  # full | flight_only
    risk_score = Column(Float, nullable=True)  # 0-100
    risk_category = Column(String, nullable=True)  # LOW_ANOMALY | MODERATE_ANOMALY | HIGH_ANOMALY
    anomaly = Column(Boolean, nullable=True)
    reliability = Column(String, nullable=True)  # low | medium | high
    events_received = Column(Integer, default=0)
    evidence_json = Column(Text, default="[]")  # JSON list of plain-language evidence strings
    message = Column(Text, nullable=True)
    model_version = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Human review: set to "pending" when the signal needs a look, then "cleared" or "escalated" by a reviewer.
    # The full history is kept in behavior_review_events; these columns are the latest decision.
    review_state = Column(String, index=True, nullable=True)
    reviewed_by = Column(String, nullable=True)  # reviewer's e-mail
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(Text, nullable=True)

    @property
    def evidence(self):
        try:
            return json.loads(self.evidence_json) if self.evidence_json else []
        except Exception:
            return []

    @evidence.setter
    def evidence(self, val):
        self.evidence_json = json.dumps(list(val or []))

    REVIEW_STATUSES = ("no_timing", "invalid_timing")  # statuses a reviewer should look at even without a score
    REVIEW_DECISIONS = ("cleared", "escalated")

    @property
    def needs_review(self) -> bool:
        """True when a reviewer should look: an anomalous score, or timing that is missing or malformed."""
        return bool(self.anomaly) or self.status in self.REVIEW_STATUSES

    def to_dict(self):
        return {
            "id": self.id,
            "reference": self.reference,
            "session_id": self.session_id,
            "msme_id": self.msme_id,
            "status": self.status,
            "scoring_mode": self.scoring_mode,
            "behavioral_risk_score": self.risk_score,
            "risk_category": self.risk_category,
            "behavioral_anomaly": self.anomaly,
            "reliability": self.reliability,
            "events_received": self.events_received,
            "behavioral_evidence": self.evidence,
            "message": self.message,
            "model_version": self.model_version,
            "needs_review": self.needs_review,
            "review_state": self.review_state,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if self.reviewed_at else None,
            "review_note": self.review_note,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else "",
        }


class BehaviorReviewEventModel(Base):
    """Append-only audit trail of reviewer decisions on behaviour signals. Rows are never updated or deleted."""
    __tablename__ = "behavior_review_events"

    id = Column(Integer, primary_key=True, index=True)
    signal_id = Column(Integer, index=True, nullable=False)
    reviewer = Column(String, nullable=False)  # reviewer's e-mail
    reviewer_role = Column(String, nullable=False)
    decision = Column(String, nullable=False)  # cleared | escalated
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "signal_id": self.signal_id,
            "reviewer": self.reviewer,
            "reviewer_role": self.reviewer_role,
            "decision": self.decision,
            "note": self.note,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else "",
        }
