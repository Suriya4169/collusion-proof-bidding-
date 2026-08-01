from pydantic import BaseModel, Field
from typing import Dict, List, Optional

class PriceInput(BaseModel):
    bid_amount: float = Field(..., gt=0.0, description="The bidding price for the tender")

class PerformanceInput(BaseModel):
    successful_projects: int = Field(default=0, ge=0, description="Number of successful projects")
    failed_projects: int = Field(default=0, ge=0, description="Number of failed projects")

class LegalInput(BaseModel):
    minor_civil: int = Field(default=0, ge=0)
    tax_violation: int = Field(default=0, ge=0)
    labour_law: int = Field(default=0, ge=0)
    environmental: int = Field(default=0, ge=0)
    blacklisting: int = Field(default=0, ge=0)
    corruption_fraud: int = Field(default=0, ge=0)

class FinancialInput(BaseModel):
    liquidity: float = Field(..., ge=0.0, le=1.0, description="Normalized liquidity ratio [0,1]")
    credit_rating: float = Field(..., ge=0.0, le=1.0, description="Normalized credit rating [0,1]")
    profitability: float = Field(..., ge=0.0, le=1.0, description="Normalized profitability ratio [0,1]")

class TechnicalInput(BaseModel):
    qualified_employees: int = Field(..., ge=0)
    equipment_availability: float = Field(..., ge=0.0, le=1.0)
    technology_maturity: float = Field(..., ge=0.0)
    relevant_experience_years: float = Field(..., ge=0.0)

class Bidder(BaseModel):
    bidder_id: str
    price: PriceInput
    performance: PerformanceInput
    legal: LegalInput
    financial: FinancialInput
    technical: TechnicalInput

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
    B_min: float
    E_max: float
    M_max: float
    T_max: float
    X_max: float
    weights: Weights = Field(default_factory=Weights)
    thresholds: Thresholds = Field(default_factory=Thresholds)
