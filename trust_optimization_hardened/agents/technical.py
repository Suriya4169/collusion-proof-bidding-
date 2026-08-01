from typing import List, Dict, Set
from ..schema import Bidder

def compute_uniqueness_penalty(
    bidder_assets: List[str],
    other_bidders_assets: Set[str]
) -> float:
    """
    rho_i = 1 - |Assets_i intersect Assets_-i| / |Assets_i|
    Returns 1.0 if the bidder has declared no assets.
    """
    if not bidder_assets:
        return 1.0
        
    assets_i = set(bidder_assets)
    overlap = assets_i.intersection(other_bidders_assets)
    return 1.0 - (len(overlap) / len(assets_i))

def compute_technical_scores(
    bidders: List[Bidder],
    k1: float = 0.3,
    k2: float = 0.2,
    k3: float = 0.2,
    k4: float = 0.3
) -> Dict[str, float]:
    """
    Tech_i = (E_i^k1 * M_i^k2 * T_i^k3 * X_i^k4) * rho_i
    Where E_max, M_max, T_max, X_max are computed over the pool.
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
        
        # Relative ratios
        e_ratio = (tech.qualified_employees / e_max) if e_max > 0 else 0.0
        m_ratio = (tech.equipment_availability / m_max) if m_max > 0 else 0.0
        t_ratio = (tech.technology_maturity / t_max) if t_max > 0 else 0.0
        x_ratio = (tech.relevant_experience_years / x_max) if x_max > 0 else 0.0
        
        base_score = (e_ratio ** k1) * (m_ratio ** k2) * (t_ratio ** k3) * (x_ratio ** k4)
        
        # Calculate uniqueness penalty rho_i
        other_assets = set()
        for b in bidders:
            if b.bidder_id != bidder.bidder_id:
                other_assets.update(b.technical.declared_assets)
                
        rho = compute_uniqueness_penalty(tech.declared_assets, other_assets)
        
        scores[bidder.bidder_id] = base_score * rho
        
    return scores
