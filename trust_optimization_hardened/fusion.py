import random
from typing import Dict, Callable
from .schema import Bidder

def default_confidence_calculator(bidder: Bidder, agent_name: str) -> float:
    """
    Default confidence scoring:
    - Performance confidence: sum of successful and failed projects across all client records.
    - Legal confidence: sum of verified cases on record across all categories.
    - Price, Financial, and Technical default to a fixed confidence of 1.0.
    """
    if agent_name == "performance":
        total_projects = sum(
            record.successful_projects + record.failed_projects
            for record in bidder.performance.records
        )
        return float(total_projects)
    elif agent_name == "legal":
        cases = bidder.legal.verified_cases
        total_cases = sum(cases.values())
        return float(total_cases)
    elif agent_name in ("price", "financial", "technical"):
        return 1.0
    return 1.0

def generate_random_multipliers(
    tender_id: str,
    low: float = 0.85,
    high: float = 1.15
) -> Dict[str, float]:
    """
    Generates deterministic but randomized multipliers for each agent using the tender ID as seed.
    """
    rng = random.Random(tender_id)
    agents = ["price", "performance", "legal", "financial", "technical"]
    return {agent: rng.uniform(low, high) for agent in agents}

def fuse_trust(
    bidder: Bidder,
    agent_scores: Dict[str, float],
    tender_id: str,
    confidence_calculator: Callable[[Bidder, str], float] = default_confidence_calculator,
    low_mult: float = 0.85,
    high_mult: float = 1.15
) -> float:
    """
    T_i = sum(C_j * eta_j * T_ij) / sum(C_j * eta_j)
    """
    multipliers = generate_random_multipliers(tender_id, low_mult, high_mult)
    
    numerator = 0.0
    denominator = 0.0
    
    for agent, score in agent_scores.items():
        conf = confidence_calculator(bidder, agent)
        eta = multipliers.get(agent, 1.0)
        
        numerator += conf * eta * score
        denominator += conf * eta
        
    if denominator == 0.0:
        return sum(agent_scores.values()) / len(agent_scores) if agent_scores else 0.0
        
    return numerator / denominator
