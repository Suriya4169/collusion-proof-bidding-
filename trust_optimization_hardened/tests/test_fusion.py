import pytest
from trust_optimization_hardened.schema import Bidder, PriceInput, PerformanceInput, LegalInput, FinancialInput, TechnicalInput, ClientPerformanceRecord
from trust_optimization_hardened.fusion import fuse_trust, generate_random_multipliers

def test_random_multipliers():
    mult1 = generate_random_multipliers("T1")
    mult2 = generate_random_multipliers("T1")
    mult3 = generate_random_multipliers("T2")
    
    # Check determinism
    assert mult1 == mult2
    
    # Check differences across seeds
    assert mult1 != mult3
    
    # Check boundaries
    for agent, value in mult1.items():
        assert 0.85 <= value <= 1.15

def test_hardened_fusion():
    bidder = Bidder(
        bidder_id="B1",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(records=[
            ClientPerformanceRecord(client_id="C1", successful_projects=5, failed_projects=0) # Total projects = 5
        ]),
        legal=LegalInput(verified_cases={"minor_civil": 2}), # Total cases = 2
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5, registration_age_years=5.0, turnover=200000.0),
        technical=TechnicalInput(qualified_employees=10, equipment_availability=0.5, technology_maturity=5.0, relevant_experience_years=5.0)
    )
    
    agent_scores = {
        "price": 0.8,
        "performance": 0.9,
        "legal": 0.7,
        "financial": 0.6,
        "technical": 0.5
    }
    
    # Test fusion with tender ID
    tender_id = "TENDER-101"
    multipliers = generate_random_multipliers(tender_id)
    
    # Confidences:
    # price = 1.0, financial = 1.0, technical = 1.0
    # performance = 5.0
    # legal = 2.0
    
    numerator = 0.0
    denominator = 0.0
    for agent, score in agent_scores.items():
        if agent in ("price", "financial", "technical"):
            c = 1.0
        elif agent == "performance":
            c = 5.0
        elif agent == "legal":
            c = 2.0
        eta = multipliers[agent]
        numerator += c * eta * score
        denominator += c * eta
        
    expected_fused = numerator / denominator
    actual_fused = fuse_trust(bidder, agent_scores, tender_id)
    assert actual_fused == pytest.approx(expected_fused)
