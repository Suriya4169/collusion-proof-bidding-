import pytest
from trust_optimization_hardened.schema import Bidder, PriceInput, PerformanceInput, LegalInput, FinancialInput, TechnicalInput, Weights, Thresholds
from trust_optimization_hardened.selection import calculate_anomaly_scores, select_winner, generate_threshold_jitters

def test_anomaly_calculations():
    # Setup colluding bidders
    bidder_a = Bidder(
        bidder_id="B_A",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5, registration_age_years=5.0, turnover=200000.0),
        technical=TechnicalInput(
            qualified_employees=10, equipment_availability=0.5, technology_maturity=5.0, relevant_experience_years=5.0,
            declared_assets=["Shared_Truck"]
        ),
        beneficial_owners=["Owner_X"]
    )
    bidder_b = Bidder(
        bidder_id="B_B",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.5, credit_rating=0.5, profitability=0.5, registration_age_years=5.0, turnover=200000.0),
        technical=TechnicalInput(
            qualified_employees=10, equipment_availability=0.5, technology_maturity=5.0, relevant_experience_years=5.0,
            declared_assets=["Shared_Truck"]
        ),
        beneficial_owners=["Owner_X"] # Beneficial owner overlap + technical asset overlap + identical scores
    )
    
    bidders_scores = {
        "B_A": {"price": 1.0, "performance": 0.8, "legal": 0.9, "financial": 0.7, "technical": 0.6},
        "B_B": {"price": 1.0, "performance": 0.8, "legal": 0.9, "financial": 0.7, "technical": 0.6}
    }
    
    anomalies = calculate_anomaly_scores([bidder_a, bidder_b], bidders_scores)
    # B_A:
    # - Shared asset overlap: shares Shared_Truck. rho = 0, Sa = 1.0
    # - Beneficial owner: shares Owner_X. Oi = 1.0
    # - Clustering: identical profiles (distance 0.0 < 0.05). Sc = 1.0
    # Total A_i = (1.0 + 1.0 + 1.0)/3.0 = 1.0
    assert anomalies["B_A"] == pytest.approx(1.0)
    assert anomalies["B_B"] == pytest.approx(1.0)

def test_jittered_constraints():
    jitters = generate_threshold_jitters("TENDER-X1")
    for name, val in jitters.items():
        assert -0.02 <= val <= 0.02

def test_select_winner_hardened():
    bidder_1 = Bidder(
        bidder_id="B1",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.8, credit_rating=0.8, profitability=0.8, registration_age_years=5.0, turnover=200000.0),
        technical=TechnicalInput(qualified_employees=10, equipment_availability=0.8, technology_maturity=6.0, relevant_experience_years=10.0)
    )
    # Bidder 2: ineligible (age = 1.0 < min_age=2.0)
    bidder_2 = Bidder(
        bidder_id="B2",
        price=PriceInput(bid_amount=100.0),
        performance=PerformanceInput(),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.8, credit_rating=0.8, profitability=0.8, registration_age_years=1.0, turnover=200000.0),
        technical=TechnicalInput(qualified_employees=10, equipment_availability=0.8, technology_maturity=6.0, relevant_experience_years=10.0)
    )
    
    bidders_scores = {
        "B1": {"price": 0.8, "performance": 0.8, "legal": 0.8, "financial": 0.8, "technical": 0.8},
        "B2": {"price": 0.9, "performance": 0.9, "legal": 0.9, "financial": 0.9, "technical": 0.9}
    }
    
    weights = Weights(w1=0.2, w2=0.2, w3=0.2, w4=0.2, w5=0.2)
    thresholds = Thresholds(Perf_min=0.4, Tech_min=0.3, F_min=0.3, L_min=0.3)
    
    winner, Z, excluded, anomalies, hold = select_winner(
        bidders=[bidder_1, bidder_2],
        bidders_scores=bidders_scores,
        weights=weights,
        thresholds=thresholds,
        tender_id="T1",
        min_registration_age=2.0,
        min_turnover=100000.0,
        mu=0.3
    )
    
    assert winner == "B1"
    assert "B2" in excluded
