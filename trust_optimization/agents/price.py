from typing import List, Dict
from ..schema import Bidder

def compute_price_scores(bidders: List[Bidder]) -> Dict[str, float]:
    """
    P_i = B_min / B_i
    B_min = min(B_i across all bidders in this tender)
    """
    if not bidders:
        return {}
    
    bids = [b.price.bid_amount for b in bidders]
    b_min = min(bids)
    
    scores = {}
    for bidder in bidders:
        b_i = bidder.price.bid_amount
        if b_i <= 0:
            scores[bidder.bidder_id] = 0.0
        else:
            scores[bidder.bidder_id] = b_min / b_i
            
    return scores
