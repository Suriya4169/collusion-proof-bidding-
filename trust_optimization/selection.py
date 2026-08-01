from typing import Dict, List, Tuple, Optional
from .schema import Thresholds, Weights

def check_constraints(
    scores: Dict[str, float],
    thresholds: Thresholds
) -> bool:
    """
    Checks if a bidder passes the minimum thresholds:
      Perf_i >= Perf_min
      Tech_i >= Tech_min
      F_i    >= F_min
      L_i    >= L_min
    """
    perf = scores.get("performance", 0.0)
    tech = scores.get("technical", 0.0)
    fin = scores.get("financial", 0.0)
    legal = scores.get("legal", 0.0)
    
    return (
        perf >= thresholds.Perf_min and
        tech >= thresholds.Tech_min and
        fin >= thresholds.F_min and
        legal >= thresholds.L_min
    )

def compute_composite_score(
    scores: Dict[str, float],
    weights: Weights
) -> float:
    """
    Z = w1*P_i + w2*Perf_i + w3*L_i + w4*F_i + w5*Tech_i
    """
    # Map weights: w1=price, w2=performance, w3=legal, w4=financial, w5=technical
    return (
        weights.w1 * scores.get("price", 0.0) +
        weights.w2 * scores.get("performance", 0.0) +
        weights.w3 * scores.get("legal", 0.0) +
        weights.w4 * scores.get("financial", 0.0) +
        weights.w5 * scores.get("technical", 0.0)
    )

def select_winner(
    bidders_scores: Dict[str, Dict[str, float]],
    weights: Weights,
    thresholds: Thresholds
) -> Tuple[Optional[str], Dict[str, float], List[str]]:
    """
    Filters bidders failing any minimum threshold,
    computes the weighted composite score for survivors,
    and returns (winner_id, composite_scores, excluded_bidders).
    """
    composite_scores = {}
    excluded_bidders = []
    
    for bidder_id, scores in bidders_scores.items():
        if check_constraints(scores, thresholds):
            composite_scores[bidder_id] = compute_composite_score(scores, weights)
        else:
            excluded_bidders.append(bidder_id)
            
    if not composite_scores:
        return None, {}, excluded_bidders
        
    winner_id = max(composite_scores, key=composite_scores.get)
    return winner_id, composite_scores, excluded_bidders
