from typing import List, Dict
from ..schema import Bidder

def compute_technical_scores(
    bidders: List[Bidder],
    k1: float = 0.3,
    k2: float = 0.2,
    k3: float = 0.2,
    k4: float = 0.3
) -> Dict[str, float]:
    """
    Tech_i = E_i^k1 * M_i^k2 * T_i^k3 * X_i^k4
    Where:
      E_i = qualified_employees / E_max
      M_i = equipment_availability / M_max
      T_i = technology_maturity / T_max
      X_i = relevant_experience / X_max
    """
    if not bidders:
        return {}
        
    e_max = max(b.technical.qualified_employees for b in bidders)
    m_max = max(b.technical.equipment_availability for b in bidders)
    t_max = max(b.technical.technology_maturity for b in bidders)
    x_max = max(b.technical.relevant_experience_years for b in bidders)
    
    scores = {}
    for bidder in bidders:
        tech = bidder.technical
        
        e_ratio = (tech.qualified_employees / e_max) if e_max > 0 else 0.0
        m_ratio = (tech.equipment_availability / m_max) if m_max > 0 else 0.0
        t_ratio = (tech.technology_maturity / t_max) if t_max > 0 else 0.0
        x_ratio = (tech.relevant_experience_years / x_max) if x_max > 0 else 0.0
        
        score = (e_ratio ** k1) * (m_ratio ** k2) * (t_ratio ** k3) * (x_ratio ** k4)
        scores[bidder.bidder_id] = score
        
    return scores
