import math
import pytest
from trust_optimization_hardened.schema import Bidder, PriceInput, PerformanceInput, LegalInput, FinancialInput, TechnicalInput, ClientPerformanceRecord
from trust_optimization_hardened.agents.price import compute_price_scores
from trust_optimization_hardened.agents.performance import compute_performance_score
from trust_optimization_hardened.agents.legal import compute_legal_score
from trust_optimization_hardened.agents.financial import compute_financial_score, check_financial_eligibility
from trust_optimization_hardened.agents.technical import compute_technical_scores, compute_uniqueness_penalty

def test_hardened_price_agent():
    # Setup bidders: B1 has reasonable bid, B2 is cover bid (deviates by >40% of B_ref=100.0)
    bidder_1 = Bidder(
        bidder_id="B1",
        price=PriceInput(bid_amount=110.0), # Dev: 10%
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5, registration_age_years=5.0, turnover=200000.0),
        technical=TechnicalInput(qualified_employees=10, equipment_availability=0.5, technology_maturity=5.0, relevant_experience_years=5.0)
    )
    bidder_2 = Bidder(
        bidder_id="B2",
        price=PriceInput(bid_amount=150.0), # Dev: 50% (Excluded from B_min calculation!)
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5, registration_age_years=5.0, turnover=200000.0),
        technical=TechnicalInput(qualified_employees=10, equipment_availability=0.5, technology_maturity=5.0, relevant_experience_years=5.0)
    )
    bidder_3 = Bidder(
        bidder_id="B3",
        price=PriceInput(bid_amount=95.0), # Dev: 5% (Becomes B_min since it's valid and lower than 110.0)
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5, registration_age_years=5.0, turnover=200000.0),
        technical=TechnicalInput(qualified_employees=10, equipment_availability=0.5, technology_maturity=5.0, relevant_experience_years=5.0)
    )
    
    # B_ref = 100.0, delta = 0.5
    # B_min should be 95.0
    # B1 Score: 0.5 * (95 / 110) + 0.5 * (100 / 110) = 0.5 * (0.8636) + 0.5 * (0.9090) = 0.88636
    scores = compute_price_scores([bidder_1, bidder_2, bidder_3], b_ref=100.0, delta=0.5)
    assert scores["B1"] == pytest.approx(0.5 * (95.0/110.0) + 0.5 * (100.0/110.0))
    assert scores["B3"] == pytest.approx(0.5 * (95.0/95.0) + 0.5 * (100.0/95.0))

def test_hardened_performance_agent():
    # Brand new bidder: no records
    score_new = compute_performance_score([], alpha=1.0, beta=1.0)
    assert score_new == pytest.approx(0.5)
    
    # Standard record with weights
    records = [
        ClientPerformanceRecord(client_id="C1", successful_projects=10, failed_projects=2, verification_weight=1.0), # success=10, total=12
        ClientPerformanceRecord(client_id="C2", successful_projects=4, failed_projects=0, verification_weight=0.5)   # success=2, total=2
    ]
    # success = 10*1.0 + 4*0.5 = 12.0
    # failure = 2*1.0 + 0*0.5 = 2.0
    # total = 12*1.0 + 4*0.5 = 14.0
    # score = (12.0 + 1) / (14.0 + 1 + 1) = 13 / 16 = 0.8125
    score = compute_performance_score(records, alpha=1.0, beta=1.0)
    assert score == pytest.approx(0.8125)

def test_hardened_legal_agent():
    # Scenario A: honest disclosure, no discrepancy
    # Risk = 2 * 0.2 + 1 * 0.3 = 0.7. Legal Trust = e^-0.7
    self_declared = {"minor_civil": 2, "tax_violation": 1}
    verified = {"minor_civil": 2, "tax_violation": 1}
    score_honest = compute_legal_score(self_declared, verified, gamma=2.0)
    assert score_honest == pytest.approx(math.exp(-0.7))
    
    # Scenario B: undisclosed cases (declared 0, verified 2 civil, 1 tax)
    # Discrepancies D_i = (2 - 0) + (1 - 0) = 3
    # Risk = (2 * 0.2 + 1 * 0.3) + 2.0 * 3 = 0.7 + 6.0 = 6.7
    # Legal Trust = e^-6.7
    self_declared_dishonest = {"minor_civil": 0, "tax_violation": 0}
    score_dishonest = compute_legal_score(self_declared_dishonest, verified, gamma=2.0)
    assert score_dishonest == pytest.approx(math.exp(-6.7))

def test_hardened_financial_agent():
    bidder = Bidder(
        bidder_id="B1",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(
            liquidity=0.8, credit_rating=0.75, profitability=0.6, # Prod = 0.36
            registration_age_years=1.5, turnover=120000.0
        ),
        technical=TechnicalInput(qualified_employees=10, equipment_availability=0.5, technology_maturity=5.0, relevant_experience_years=5.0)
    )
    
    # Gate check
    assert not check_financial_eligibility(bidder, min_registration_age=2.0, min_turnover=100000.0) # age is 1.5 < 2.0
    
    # Absolute reference normalization
    # Raw_Finance = 0.36. F_floor = 0.1, F_ceiling = 0.6
    # Score = (0.36 - 0.1) / (0.6 - 0.1) = 0.26 / 0.5 = 0.52
    score = compute_financial_score(bidder, f_floor=0.1, f_ceiling=0.6)
    assert score == pytest.approx(0.52)
    
    # Clamping tests
    # Raw_Finance = 0.36, ceiling = 0.3 -> Score clipped to 1.0
    score_clamped_high = compute_financial_score(bidder, f_floor=0.1, f_ceiling=0.3)
    assert score_clamped_high == 1.0
    
    # Raw_Finance = 0.36, floor = 0.4 -> Score clipped to 0.0
    score_clamped_low = compute_financial_score(bidder, f_floor=0.4, f_ceiling=0.8)
    assert score_clamped_low == 0.0

def test_hardened_technical_agent():
    # Asset uniqueness penalty tests
    assert compute_uniqueness_penalty(["A", "B", "C"], {"D", "E"}) == 1.0
    assert compute_uniqueness_penalty(["A", "B", "C"], {"A", "E"}) == pytest.approx(1.0 - 1/3)
    assert compute_uniqueness_penalty(["A", "B"], {"A", "B"}) == 0.0
    assert compute_uniqueness_penalty([], {"A", "B"}) == 1.0
    
    bidder_1 = Bidder(
        bidder_id="B1",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5, registration_age_years=5.0, turnover=200000.0),
        technical=TechnicalInput(
            qualified_employees=10,
            equipment_availability=0.8,
            technology_maturity=6.0,
            relevant_experience_years=10.0,
            declared_assets=["Asset_Shared"]
        )
    )
    bidder_2 = Bidder(
        bidder_id="B2",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5, registration_age_years=5.0, turnover=200000.0),
        technical=TechnicalInput(
            qualified_employees=20, # Max employees
            equipment_availability=0.4,
            technology_maturity=3.0,
            relevant_experience_years=5.0,
            declared_assets=["Asset_Shared"] # Overlap!
        )
    )
    
    # E_max = 20, M_max = 0.8, T_max = 6.0, X_max = 10.0
    # B1 Ratios: E=0.5, M=1.0, T=1.0, X=1.0. Base score = 0.5^0.3 = 0.812252
    # B1 shares "Asset_Shared" with B2. |Assets_1| = 1, overlap = 1. rho_1 = 0.0.
    # Score for B1 should be 0.0
    scores = compute_technical_scores([bidder_1, bidder_2], k1=0.3, k2=0.2, k3=0.2, k4=0.3)
    assert scores["B1"] == 0.0
    assert scores["B2"] == 0.0
