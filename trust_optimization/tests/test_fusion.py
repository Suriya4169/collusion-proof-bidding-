import pytest
from trust_optimization.schema import Bidder, PriceInput, PerformanceInput, LegalInput, FinancialInput, TechnicalInput
from trust_optimization.fusion import fuse_trust

def test_fusion_uniform_confidence():
    bidder = Bidder(
        bidder_id="B1",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(successful_projects=1, failed_projects=0), # S+F = 1
        legal=LegalInput(minor_civil=1), # case count = 1
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5),
        technical=TechnicalInput(qualified_employees=1, equipment_availability=0.5, technology_maturity=1, relevant_experience_years=1)
    )
    
    agent_scores = {
        "price": 0.8,
        "performance": 0.6,
        "legal": 0.9,
        "financial": 0.5,
        "technical": 0.7
    }
    
    # Under default calculator:
    # C_price = 1.0
    # C_perf = 1.0 (S+F = 1)
    # C_legal = 1.0 (total cases = 1)
    # C_finance = 1.0
    # C_tech = 1.0
    # All confidences are 1.0 (uniform)!
    # Fused score should be simple average: (0.8 + 0.6 + 0.9 + 0.5 + 0.7) / 5 = 3.5 / 5 = 0.7
    score = fuse_trust(bidder, agent_scores)
    assert score == pytest.approx(0.7)

def test_fusion_skewed_confidence():
    bidder = Bidder(
        bidder_id="B1",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(successful_projects=8, failed_projects=2), # S+F = 10 -> C_perf = 10
        legal=LegalInput(minor_civil=0), # case count = 0 -> C_legal = 0
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5),
        technical=TechnicalInput(qualified_employees=1, equipment_availability=0.5, technology_maturity=1, relevant_experience_years=1)
    )
    
    agent_scores = {
        "price": 0.8,       # C = 1
        "performance": 0.6, # C = 10
        "legal": 0.9,       # C = 0
        "financial": 0.5,   # C = 1
        "technical": 0.7    # C = 1
    }
    
    # Fused Trust = (1*0.8 + 10*0.6 + 0*0.9 + 1*0.5 + 1*0.7) / (1 + 10 + 0 + 1 + 1)
    #             = (0.8 + 6.0 + 0.0 + 0.5 + 0.7) / 13
    #             = 8.0 / 13 = 0.6153846
    score = fuse_trust(bidder, agent_scores)
    assert score == pytest.approx(8.0 / 13.0)

def test_fusion_zero_confidence_fallback():
    bidder = Bidder(
        bidder_id="B1",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(successful_projects=0, failed_projects=0), # S+F = 0
        legal=LegalInput(), # case count = 0
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5),
        technical=TechnicalInput(qualified_employees=1, equipment_availability=0.5, technology_maturity=1, relevant_experience_years=1)
    )
    
    # We will test a custom confidence calculator that returns 0 for all agents
    def zero_conf_calculator(bidder, agent_name):
        return 0.0
        
    agent_scores = {
        "price": 0.8,
        "performance": 0.6,
        "legal": 0.9,
        "financial": 0.5,
        "technical": 0.7
    }
    
    # Should fallback to simple average
    score = fuse_trust(bidder, agent_scores, confidence_calculator=zero_conf_calculator)
    assert score == pytest.approx(0.7)
