from pydantic import BaseModel
from typing import List, Optional

class FlaggedClause(BaseModel):
    original_clause: str
    amended_clause: str
    similarity_score: float
    classification: str
    reason: str
    base_risk_score: float

class DiffReport(BaseModel):
    overall_manipulation_probability: float
    risk_level: str
    flagged_clauses: List[FlaggedClause]
    days_before_deadline: int
    temporal_multiplier: float
