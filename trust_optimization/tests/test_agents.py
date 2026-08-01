import math
import pytest
from trust_optimization.schema import Bidder, PriceInput, PerformanceInput, LegalInput, FinancialInput, TechnicalInput
from trust_optimization.agents.price import compute_price_scores
from trust_optimization.agents.performance import compute_performance_score
from trust_optimization.agents.legal import compute_legal_score
from trust_optimization.agents.financial import compute_financial_scores
from trust_optimization.agents.technical import compute_technical_scores

def test_price_agent():
    # Set up some dummy bidders
    bidder_1 = Bidder(
        bidder_id="B1",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5),
        technical=TechnicalInput(qualified_employees=1, equipment_availability=0.5, technology_maturity=1, relevant_experience_years=1)
    )
    bidder_2 = Bidder(
        bidder_id="B2",
        price=PriceInput(bid_amount=200.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5),
        technical=TechnicalInput(qualified_employees=1, equipment_availability=0.5, technology_maturity=1, relevant_experience_years=1)
    )
    
    # B_min = 100.0
    # P_1 = 100.0 / 100.0 = 1.0
    # P_2 = 100.0 / 200.0 = 0.5
    scores = compute_price_scores([bidder_1, bidder_2])
    assert scores["B1"] == pytest.approx(1.0)
    assert scores["B2"] == pytest.approx(0.5)

def test_performance_agent():
    # Sanity check: brand-new company with S_i=0, F_i=0, alpha=1, beta=1 must score 0.5
    score_new = compute_performance_score(0, 0, alpha=1.0, beta=1.0)
    assert score_new == pytest.approx(0.5)
    
    # Custom prior: e.g. success rate prior 90% (alpha=0.9, beta=0.1)
    score_prior = compute_performance_score(0, 0, alpha=0.9, beta=0.1)
    assert score_prior == pytest.approx(0.9)
    
    # Standard update
    score_standard = compute_performance_score(12, 2, alpha=1.0, beta=1.0)
    # (12 + 1) / (12 + 2 + 1 + 1) = 13 / 16 = 0.8125
    assert score_standard == pytest.approx(0.8125)

def test_legal_agent():
    # Sanity check: 2 minor-civil + 1 tax-violation cases
    # Risk = 2 * 0.2 + 1 * 0.3 = 0.7
    # Legal_Trust = e^-0.7
    cases = {
        "minor_civil": 2,
        "tax_violation": 1,
        "labour_law": 0,
        "environmental": 0,
        "blacklisting": 0,
        "corruption_fraud": 0
    }
    score = compute_legal_score(cases)
    assert score == pytest.approx(math.exp(-0.7))

def test_financial_agent():
    bidder_1 = Bidder(
        bidder_id="B1",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.8, credit_rating=0.75, profitability=0.6), # Prod = 0.8 * 0.75 * 0.6 = 0.36
        technical=TechnicalInput(qualified_employees=1, equipment_availability=0.5, technology_maturity=1, relevant_experience_years=1)
    )
    bidder_2 = Bidder(
        bidder_id="B2",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.5, credit_rating=0.4, profitability=0.5), # Prod = 0.5 * 0.4 * 0.5 = 0.1
        technical=TechnicalInput(qualified_employees=1, equipment_availability=0.5, technology_maturity=1, relevant_experience_years=1)
    )
    
    # Products: B1 = 0.36, B2 = 0.1
    # min_prod = 0.1, max_prod = 0.36, diff = 0.26
    # Normalized: B1 = (0.36 - 0.1)/0.26 = 1.0
    # Normalized: B2 = (0.1 - 0.1)/0.26 = 0.0
    scores = compute_financial_scores([bidder_1, bidder_2])
    assert scores["B1"] == pytest.approx(1.0)
    assert scores["B2"] == pytest.approx(0.0)

def test_technical_agent():
    bidder_1 = Bidder(
        bidder_id="B1",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5),
        technical=TechnicalInput(
            qualified_employees=40,
            equipment_availability=0.8,
            technology_maturity=6.0,
            relevant_experience_years=10.0
        )
    )
    bidder_2 = Bidder(
        bidder_id="B2",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5),
        technical=TechnicalInput(
            qualified_employees=80,
            equipment_availability=0.4,
            technology_maturity=3.0,
            relevant_experience_years=5.0
        )
    )
    
    # E_max = 80, M_max = 0.8, T_max = 6.0, X_max = 10.0
    # B1 ratios: E=40/80=0.5, M=0.8/0.8=1.0, T=6.0/6.0=1.0, X=10.0/10.0=1.0
    # B2 ratios: E=80/80=1.0, M=0.4/0.8=0.5, T=3.0/6.0=0.5, X=5.0/10.0=0.5
    # k1=0.3, k2=0.2, k3=0.2, k4=0.3
    # Tech_1 = 0.5^0.3 * 1.0^0.2 * 1.0^0.2 * 1.0^0.3 = 0.5^0.3 = 0.812252396
    # Tech_2 = 1.0^0.3 * 0.5^0.2 * 0.5^0.2 * 0.5^0.3 = 0.5^0.7 = 0.615572206
    scores = compute_technical_scores([bidder_1, bidder_2], k1=0.3, k2=0.2, k3=0.2, k4=0.3)
    assert scores["B1"] == pytest.approx(0.5 ** 0.3)
    assert scores["B2"] == pytest.approx(0.5 ** 0.7)
