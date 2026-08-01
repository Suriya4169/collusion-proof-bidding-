from typing import List, Dict
from ..schema import Bidder

def compute_financial_scores(bidders: List[Bidder]) -> Dict[str, float]:
    """
    Finance_i = Liquidity_i * CreditRating_i * Profitability_i
    Normalize the product into [0,1] across the bidder pool.
    """
    if not bidders:
        return {}
        
    raw_products = {}
    for bidder in bidders:
        fin = bidder.financial
        liquidity = max(0.0, min(1.0, fin.liquidity))
        credit_rating = max(0.0, min(1.0, fin.credit_rating))
        profitability = max(0.0, min(1.0, fin.profitability))
        
        prod = liquidity * credit_rating * profitability
        raw_products[bidder.bidder_id] = prod
        
    min_prod = min(raw_products.values())
    max_prod = max(raw_products.values())
    diff = max_prod - min_prod
    
    scores = {}
    for bidder_id, prod in raw_products.items():
        if diff == 0:
            scores[bidder_id] = 1.0
        else:
            scores[bidder_id] = (prod - min_prod) / diff
            
    return scores
