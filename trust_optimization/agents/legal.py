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

def compute_legal_score(cases: Dict[str, int]) -> float:
    """
    Risk_i = sum(case_count_c * weight_c) for each legal case category c
    Legal_Trust_i = e^(-Risk_i)
    """
    risk = 0.0
    for category, weight in CATEGORY_WEIGHTS.items():
        count = cases.get(category, 0)
        risk += count * weight
        
    return math.exp(-risk)
