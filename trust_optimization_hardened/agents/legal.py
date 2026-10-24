import math
from typing import Dict

# Fixed policy constants
CATEGORY_WEIGHTS = {
    "minor_civil": 0.2,
    "tax_violation": 0.3,
    "labour_law": 0.5,
    "environmental": 0.8,
    "blacklisting": 0.8,
    "corruption_fraud": 1.0
}

def compute_legal_score(
    self_declared_cases: Dict[str, int],
    verified_cases: Dict[str, int],
    gamma: float = 2.0
) -> float:
    """
    Risk_i = sum(case_count_verified * w_c) + gamma * D_i
    Legal_Trust_i = e^(-Risk_i)
    
    Where discrepancy count D_i = sum(max(0, verified_count_c - declared_count_c))
    """
    risk = 0.0
    discrepancies = 0
    
    # Check all potential categories in CATEGORY_WEIGHTS
    for category, weight in CATEGORY_WEIGHTS.items():
        declared = self_declared_cases.get(category, 0)
        verified = verified_cases.get(category, 0)
        
        risk += verified * weight
        if verified > declared:
            discrepancies += (verified - declared)
            
    total_risk = risk + gamma * discrepancies
    return math.exp(-total_risk)
