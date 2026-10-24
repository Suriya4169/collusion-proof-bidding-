from pydantic import BaseModel, Field
from typing import Dict, List, Optional

class PriceInput(BaseModel):
    bid_amount: float = Field(..., gt=0.0, description="The bidding price for the tender")

class ClientPerformanceRecord(BaseModel):
    client_id: str = Field(..., description="Identifier of the client verifying the project history")
    successful_projects: int = Field(default=0, ge=0, description="Number of successful projects")
    failed_projects: int = Field(default=0, ge=0, description="Number of failed projects")
    verification_weight: float = Field(default=1.0, gt=0.0, le=1.0, description="Client verification weight [0,1]")

class PerformanceInput(BaseModel):
    records: List[ClientPerformanceRecord] = Field(default_factory=list, description="Performance records per distinct client")

class LegalInput(BaseModel):
    self_declared_cases: Dict[str, int] = Field(default_factory=dict, description="Bidder's self-declared litigation counts")
    verified_cases: Dict[str, int] = Field(default_factory=dict, description="Litigation counts reconciled from external registries")

class FinancialInput(BaseModel):
    liquidity: float = Field(..., ge=0.0, le=1.0, description="Normalized liquidity ratio [0,1]")
    credit_rating: float = Field(..., ge=0.0, le=1.0, description="Normalized credit rating [0,1]")
    profitability: float = Field(..., ge=0.0, le=1.0, description="Normalized profitability ratio [0,1]")
    registration_age_years: float = Field(..., ge=0.0, description="Company age in years")
    turnover: float = Field(..., ge=0.0, description="Annual corporate turnover in USD")

class TechnicalInput(BaseModel):
    qualified_employees: int = Field(..., ge=0)
    equipment_availability: float = Field(..., ge=0.0, le=1.0)
    technology_maturity: float = Field(..., ge=0.0)
    relevant_experience_years: float = Field(..., ge=0.0)
    declared_assets: List[str] = Field(default_factory=list, description="Serials/IDs of equipment/staff/certificates to ensure uniqueness")

class Bidder(BaseModel):
    bidder_id: str
    price: PriceInput
    performance: PerformanceInput
    legal: LegalInput
    financial: FinancialInput
    technical: TechnicalInput
    beneficial_owners: List[str] = Field(default_factory=list, description="List of beneficial owners/directors for collusion checks")

class Weights(BaseModel):
    w1: float = Field(0.2, ge=0.0, description="Price score weight")
    w2: float = Field(0.2, ge=0.0, description="Performance score weight")
    w3: float = Field(0.2, ge=0.0, description="Legal trust weight")
    w4: float = Field(0.2, ge=0.0, description="Financial score weight")
    w5: float = Field(0.2, ge=0.0, description="Technical score weight")

class Thresholds(BaseModel):
    Perf_min: float = Field(0.4, ge=0.0, le=1.0)
    Tech_min: float = Field(0.3, ge=0.0, le=1.0)
    F_min: float = Field(0.3, ge=0.0, le=1.0)
    L_min: float = Field(0.3, ge=0.0, le=1.0)

class TenderConstants(BaseModel):
    B_ref: float = Field(..., gt=0.0, description="Independent reference price (Engineer's Estimate)")
    delta: float = Field(0.5, ge=0.0, le=1.0, description="Blending factor between min bid and reference price")
    min_registration_age: float = Field(2.0, ge=0.0, description="Minimum age requirement for eligibility gate")
    min_turnover: float = Field(100000.0, ge=0.0, description="Minimum annual turnover requirement for eligibility gate")
    F_floor: float = Field(0.1, ge=0.0, description="Financial normalization lower bound")
    F_ceiling: float = Field(0.9, ge=0.0, description="Financial normalization upper bound")
    tender_id: str = Field(..., description="Unique tender ID to seed randomized modifiers")
    mu: float = Field(0.3, ge=0.0, description="Collusion anomaly score penalty multiplier")
    review_margin: float = Field(0.02, ge=0.0, description="Clustering score delta margin for manual review")
    anomaly_threshold: float = Field(0.10, ge=0.0, description="Anomaly score threshold triggering review flags")
    weights: Weights = Field(default_factory=Weights)
    thresholds: Thresholds = Field(default_factory=Thresholds)
