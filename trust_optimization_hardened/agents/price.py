from typing import List, Dict, Set
from ..schema import Bidder

def compute_price_scores(
    bidders: List[Bidder],
    b_ref: float,
    delta: float = 0.5
) -> Dict[str, float]:
    """
    P_i = delta * (B_min / B_i) + (1 - delta) * (B_ref / B_i)
    
    Safeguard: Any bid that deviates more than +/- 40% from B_ref is excluded from B_min.
    If all bids are excluded, we fall back to taking the minimum of all bids.
    """
    if not bidders:
        return {}
        
    # Filter bids that do not deviate more than +/- 40% from B_ref
    valid_bids_for_min = []
    for bidder in bidders:
        bid = bidder.price.bid_amount
        deviation = abs(bid - b_ref) / b_ref
        if deviation <= 0.40:
            valid_bids_for_min.append(bid)
            
    if not valid_bids_for_min:
        # Fallback if all bids deviate by > 40%
        valid_bids_for_min = [b.price.bid_amount for b in bidders]
        
    b_min = min(valid_bids_for_min)
    
    scores = {}
    for bidder in bidders:
        b_i = bidder.price.bid_amount
        if b_i <= 0:
            scores[bidder.bidder_id] = 0.0
        else:
            scores[bidder.bidder_id] = delta * (b_min / b_i) + (1.0 - delta) * (b_ref / b_i)
            
    return scores
