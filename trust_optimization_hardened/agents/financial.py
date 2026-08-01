from ..schema import Bidder

def check_financial_eligibility(
    bidder: Bidder,
    min_registration_age: float,
    min_turnover: float
) -> bool:
    """
    Returns True if the bidder passes the eligibility gate, False otherwise.
    """
    fin = bidder.financial
    return (
        fin.registration_age_years >= min_registration_age and
        fin.turnover >= min_turnover
    )

def compute_financial_score(
    bidder: Bidder,
    f_floor: float,
    f_ceiling: float
) -> float:
    """
    Raw_Finance = Liquidity * CreditRating * Profitability
    Finance_i = clip((Raw_Finance - F_floor) / (F_ceiling - F_floor), 0, 1)
    """
    fin = bidder.financial
    liq = max(0.0, min(1.0, fin.liquidity))
    cr = max(0.0, min(1.0, fin.credit_rating))
    prof = max(0.0, min(1.0, fin.profitability))
    
    raw = liq * cr * prof
    
    if f_ceiling <= f_floor:
        return 1.0
        
    normalized = (raw - f_floor) / (f_ceiling - f_floor)
    return max(0.0, min(1.0, normalized))
