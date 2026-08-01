from typing import Dict, Callable
from .schema import Bidder

def default_confidence_calculator(bidder: Bidder, agent_name: str) -> float:
    """
    Default confidence scoring:
    - Performance confidence grows with S_i + F_i
    - Legal confidence grows with number of case records on file (sum of all cases)
    - Price, Financial, and Technical default to a fixed confidence of 1.0
    """
    if agent_name == "performance":
        return float(bidder.performance.successful_projects + bidder.performance.failed_projects)
    elif agent_name == "legal":
        cases = bidder.legal
        total_cases = (
            cases.minor_civil +
            cases.tax_violation +
            cases.labour_law +
            cases.environmental +
            cases.blacklisting +
            cases.corruption_fraud
        )
        return float(total_cases)
    elif agent_name in ("price", "financial", "technical"):
        return 1.0
    return 1.0

def fuse_trust(
    bidder: Bidder,
    agent_scores: Dict[str, float],
    confidence_calculator: Callable[[Bidder, str], float] = default_confidence_calculator
) -> float:
    """
    T_i = sum(C_j * T_ij) / sum(C_j) for j in {price, performance, legal, financial, technical}
    """
    numerator = 0.0
    denominator = 0.0
    
    for agent, score in agent_scores.items():
        conf = confidence_calculator(bidder, agent)
        numerator += conf * score
        denominator += conf
        
    if denominator == 0.0:
        # Fallback to simple average if total confidence is zero
        return sum(agent_scores.values()) / len(agent_scores) if agent_scores else 0.0
        
    return numerator / denominator
