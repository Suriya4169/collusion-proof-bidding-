"""
Pydantic Schemas for Solvency Verification Agent API.
These models drive the Swagger/OpenAPI documentation and
provide strict validation for all request/response payloads.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────

class FlagSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class IntegrityVerdict(str, Enum):
    PASSED = "PASSED (AUTHENTIC_AND_CONSISTENT)"
    SUSPICIOUS = "SUSPICIOUS (MANIPULATION_FLAGS_RAISED)"
    FAILED = "FAILED (POTENTIAL_TAMPERING_DETECTED)"
    ABSTAINED = "ABSTAINED (INSUFFICIENT_CONFIDENCE)"


class AgentStatus(str, Enum):
    IDLE = "idle"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


# ─────────────────────────────────────────────────────────────
# Sub-Models
# ─────────────────────────────────────────────────────────────

class TransactionRow(BaseModel):
    tx_id: str
    date: str
    narration: Optional[str] = None
    debit: float = 0.0
    credit: float = 0.0
    balance: float = 0.0


class PageData(BaseModel):
    page_number: int
    opening_balance: float
    closing_balance: float
    transactions: List[TransactionRow]


class AccountInfo(BaseModel):
    name: Optional[str] = None
    account_number: Optional[str] = None
    bank: Optional[str] = None
    period: Optional[str] = None


class StatementData(BaseModel):
    """Structured bank statement data (the intermediate JSON representation)."""
    account_info: AccountInfo = Field(default_factory=AccountInfo)
    pages: List[PageData] = Field(default_factory=list)


class VerificationFlag(BaseModel):
    type: str = Field(..., description="Flag category, e.g., ARITHMETIC_INCONSISTENCY, PAGE_CONTINUITY_BREAK")
    severity: FlagSeverity
    details: str
    tx_id: Optional[str] = None
    date: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class AuditRow(BaseModel):
    tx_id: str
    date: Optional[str] = None
    narration: Optional[str] = None
    debit: float = 0.0
    credit: float = 0.0
    reported_balance: float = 0.0
    verified_balance: float = 0.0
    expected_balance: float = 0.0
    residual: float = 0.0
    status: str = "VALID"
    note: Optional[str] = None


class FinancialMetrics(BaseModel):
    time_weighted_avg_balance: float = Field(..., description="Balance weighted by days held, not by transaction count")
    naive_transaction_avg_balance: float = Field(..., description="Simple arithmetic mean of balance column (for comparison)")
    min_balance: float = Field(..., description="Minimum cash balance reached — the binding liquidity constraint")
    max_balance: float = Field(..., description="Maximum cash balance reached during the period")
    balance_volatility_cv: float = Field(..., description="Coefficient of Variation: σ(B)/μ(B)")
    monthly_cashflow_slope: float = Field(..., description="OLS slope × 30 — net monthly accumulation or burn rate (INR/month)")


class ExtractionMetadata(BaseModel):
    """Metadata about the PDF extraction step."""
    pdf_filename: str
    total_pages: int = 0
    has_text_layer: bool = False
    password_protected: bool = False
    extraction_method: str = "unknown"
    extraction_time_ms: int = 0
    llm_structuring_time_ms: int = 0


# ─────────────────────────────────────────────────────────────
# API Request / Response Models
# ─────────────────────────────────────────────────────────────

class AnalysisRequest(BaseModel):
    """Body parameters accompanying the PDF upload."""
    gemini_api_key: Optional[str] = Field(None, description="Gemini API key for LLM structuring. If not provided, uses server-side env var.")


class VerifyJsonRequest(BaseModel):
    """Direct JSON verification — skip PDF extraction, submit pre-structured statement."""
    statement_data: StatementData


class AnalysisResponse(BaseModel):
    """Complete analysis result returned by the solvency agent."""
    analysis_id: str = Field(..., description="Unique identifier for this analysis run")
    timestamp: str
    agent_name: str = "solvency_verification_agent"
    agent_version: str = "1.0.0"

    # Extraction metadata
    extraction: Optional[ExtractionMetadata] = None

    # Structured data (the intermediate parsed representation)
    structured_statement: Optional[StatementData] = None

    # Verification results
    overall_integrity: IntegrityVerdict
    total_transactions_analyzed: int = 0
    flags_raised_count: int = 0
    flags: List[VerificationFlag] = Field(default_factory=list)

    # Financial metrics
    financial_metrics: Optional[FinancialMetrics] = None
    window_dressing_z_score: Optional[float] = None
    benford_divergence: Optional[float] = None

    # Audit trail
    audit_rows: List[AuditRow] = Field(default_factory=list)

    # Account info (top-level convenience fields)
    account_holder: Optional[str] = None
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    statement_period: Optional[str] = None


class AgentHealthResponse(BaseModel):
    """Health check response — used by orchestrators and other agents."""
    agent_name: str = "solvency_verification_agent"
    agent_version: str = "1.0.0"
    status: AgentStatus = AgentStatus.IDLE
    capabilities: List[str] = [
        "pdf_bank_statement_extraction",
        "ledger_recurrence_verification",
        "page_continuity_check",
        "window_dressing_detection",
        "round_trip_transfer_detection",
        "benfords_law_analysis",
        "solvency_metrics_computation",
    ]
    endpoint_base: str = "/api/v1/agent/solvency"
    accepts: List[str] = ["application/pdf", "application/json"]
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class AgentRegistration(BaseModel):
    """Schema for registering this agent with an orchestrator or gateway."""
    agent_name: str = "solvency_verification_agent"
    agent_version: str = "1.0.0"
    description: str = "Audit-grade solvency verification agent for bank statement analysis in public procurement"
    base_url: str = Field(..., description="The base URL where this agent is hosted, e.g., http://localhost:8001")
    endpoints: Dict[str, str] = {
        "health": "/api/v1/agent/solvency/health",
        "analyze_pdf": "/api/v1/agent/solvency/analyze",
        "verify_json": "/api/v1/agent/solvency/verify-json",
        "results": "/api/v1/agent/solvency/results/{analysis_id}",
    }
    capabilities: List[str] = [
        "pdf_bank_statement_extraction",
        "ledger_recurrence_verification",
        "page_continuity_check",
        "window_dressing_detection",
        "round_trip_transfer_detection",
        "benfords_law_analysis",
        "solvency_metrics_computation",
    ]


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
