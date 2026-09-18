from typing import List, Dict, Optional, Any

from pydantic import BaseModel, Field, validator


class BeneficialOwner(BaseModel):
    name: str = Field(..., min_length=1)


class SubmissionMetadata(BaseModel):
    ip_address: Optional[str] = None
    bank_routing_code: Optional[str] = None

    @validator("ip_address")
    def validate_ip(cls, value):
        if value is not None and not value.strip():
            raise ValueError("ip_address cannot be empty")
        return value

    @validator("bank_routing_code")
    def validate_bank_code(cls, value):
        if value is not None and not value.strip():
            raise ValueError("bank_routing_code cannot be empty")
        return value


class BidderProfile(BaseModel):
    bidder_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    beneficial_owners: List[BeneficialOwner] = Field(default_factory=list)
    submission_metadata: SubmissionMetadata = Field(default_factory=SubmissionMetadata)
    declared_assets: List[str] = Field(default_factory=list)

    @validator("declared_assets")
    def validate_assets(cls, value):
        return [asset.strip() for asset in value if str(asset).strip()]


class BatchBidderRequest(BaseModel):
    bidders: List[BidderProfile]

    @validator("bidders")
    def validate_bidders(cls, value):
        if not value:
            raise ValueError("At least one bidder profile is required")
        return value


class FlaggedNetwork(BaseModel):
    bidders: List[str]
    reason: str


class ComplianceSummary(BaseModel):
    cartel_detected: bool
    flagged_networks: List[FlaggedNetwork]
    anomaly_scores: Dict[str, float]


class GraphRenderPayload(BaseModel):
    bidders: List[Dict[str, str]]
    metadata: List[Dict[str, str]]
    bipartite: List[List[str]]
    anomalyScores: Dict[str, float]
