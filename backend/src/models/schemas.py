from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from typing import List, Optional
from enum import Enum


# ═══════════════════════════════════════════════════════════
# Enhanced Base Model (Pydantic v2 camelCase Support)
# ═══════════════════════════════════════════════════════════

class EnhancedBaseModel(BaseModel):
    """
    Base model that automatically converts python snake_case fields
    to camelCase JSON for the React frontend, matching enterprise standards.
    """
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel
    )


# ═══════════════════════════════════════════════════════════
# Sub-Agent 1.3 Output Schema (Neural Extractor)
# Forces Gemini to return strict, typed JSON with confidence
# ═══════════════════════════════════════════════════════════

class TenderRequirements(EnhancedBaseModel):
    """
    Pydantic schema that forces Gemini to return strict, typed JSON.
    This guarantees we never get a string when we need an integer.
    Enhanced with Sub-Agent 1.5 (Confidence Scorer) fields.
    """
    emd_amount: int = Field(
        description="The exact Earnest Money Deposit (EMD) amount required in INR. If no EMD is required or exempted, output 0."
    )
    emd_confidence: float = Field(
        default=0.0,
        description="Your confidence (0.0 to 1.0) that the EMD amount extracted is accurate."
    )
    emd_source_page: int = Field(
        default=0,
        description="The page number in the PDF where the EMD information was found. 0 if unknown."
    )
    turnover_required: int = Field(
        description="The minimum average annual turnover required from the bidder in INR. If not explicitly stated, output 0."
    )
    turnover_confidence: float = Field(
        default=0.0,
        description="Your confidence (0.0 to 1.0) that the turnover requirement extracted is accurate."
    )
    turnover_source_page: int = Field(
        default=0,
        description="The page number in the PDF where the turnover requirement was found. 0 if unknown."
    )
    experience_years: int = Field(
        description="The minimum number of years of past experience required. If not stated, output 0."
    )
    experience_confidence: float = Field(
        default=0.0,
        description="Your confidence (0.0 to 1.0) that the experience requirement extracted is accurate."
    )
    experience_source_page: int = Field(
        default=0,
        description="The page number in the PDF where the experience requirement was found. 0 if unknown."
    )
    required_certifications: List[str] = Field(
        description="Extract a comprehensive list of ALL government documents, certifications, licenses, or authorization letters (e.g., 'OEM Authorization', 'ISO', 'PAN', 'Local Content Certificate') mentioned in the text. Put ALL documents here, even if they say 'if applicable'."
    )
    is_msme_exempted: bool = Field(
        description="True if the document states MSMEs/Startups are exempted from EMD or turnover criteria, False otherwise."
    )
    additional_parameters: List[str] = Field(
        default_factory=list,
        description="Extract ANY other mandatory rules or constraints (e.g., location, employee count, technical specs). EXCLUDE any certificates or government documents, as those belong strictly in required_certifications."
    )


# ═══════════════════════════════════════════════════════════
# MSME Profile (From Frontend / Database / KYC API)
# ═══════════════════════════════════════════════════════════

class MSMEProfile(EnhancedBaseModel):
    """
    The profile of the MSME applying for the tender.
    In production, this is auto-fetched from KYC APIs using the Udyam number.
    """
    company_name: str
    turnover_inr: int
    experience_years: int
    certifications: List[str]
    is_registered_msme: bool


# ═══════════════════════════════════════════════════════════
# Sub-Agent 1.4 & 1.6 Output Schema (Symbolic Verifier + CDS)
# Each rule now has a status, distance %, and confidence
# ═══════════════════════════════════════════════════════════

class RuleStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    EXEMPTED = "EXEMPTED"
    INFO = "INFO"


class RuleVerification(EnhancedBaseModel):
    """
    A single rule's verification result with Compliance Distance Score.
    This is what powers each 'traffic light' row in the UI.
    """
    rule_name: str
    status: RuleStatus
    required_value: str
    actual_value: str
    distance_pct: float = Field(
        description="The Compliance Distance Score (CDS). Positive = exceeds requirement, Negative = falls short. E.g., -40.0 means 40% short."
    )
    confidence: float = Field(
        default=0.0,
        description="AI confidence (0.0 to 1.0) that this rule was correctly extracted from the PDF."
    )
    source_page: int = Field(
        default=0,
        description="The page number in the PDF where this rule was found."
    )
    message: str


class VerificationReport(EnhancedBaseModel):
    """
    The final comprehensive output of the Phase 2 pipeline.
    This single JSON object powers the entire MSMEAnalyzeScreen.tsx UI.
    """
    # Overall Verdict
    is_eligible: bool
    overall_compliance_score: float = Field(
        default=0.0,
        description="The weighted Overall Compliance Distance (OCD) score. 100.0 = perfect match."
    )

    # Rule-by-Rule Breakdown (Agents 1.4, 1.5, 1.6)
    checks: List[RuleVerification]

    # Missing Documents (Agent 1.8)
    missing_documents: List[str] = Field(
        default_factory=list,
        description="Documents required by the tender but missing from the MSME's vault."
    )

    # Plain Language Summary (Agent 1.7)
    plain_summary: str = Field(
        default="",
        description="A plain-language English summary of the eligibility result."
    )
    regional_summary: str = Field(
        default="",
        description="The same summary translated into the user's preferred regional language."
    )

    # Recommended Government Schemes (Agent 1.9)
    recommended_schemes: List[str] = Field(
        default_factory=list,
        description="A list of government schemes recommended to bridge any compliance gaps."
    )

    # Legacy field for backward compatibility
    reasoning: List[str] = Field(
        default_factory=list,
        description="Legacy text reasoning lines."
    )


# ═══════════════════════════════════════════════════════════
# Sub-Agent 1.10 Output Schema (Payment Penalty Tracker)
# ═══════════════════════════════════════════════════════════

class PaymentPenaltyReport(EnhancedBaseModel):
    """
    Output for the Section 16 Payment Delay Tracker.
    Calculates compounding interest penalties using strict Python math.
    """
    days_overdue: int
    is_penalty_applicable: bool
    penalty_amount_inr: float
    demand_notice_draft: str

# ═══════════════════════════════════════════════════════════
# Enterprise Error Handling Schemas
# ═══════════════════════════════════════════════════════════

class ErrorDetail(EnhancedBaseModel):
    field: Optional[str] = None
    message: str

class APIErrorResponse(EnhancedBaseModel):
    """
    Standardized Error Schema for professional frontend consumption.
    """
    error_code: str
    message: str
    details: Optional[List[ErrorDetail]] = None
