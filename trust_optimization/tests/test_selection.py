import pytest
from trust_optimization.schema import Weights, Thresholds
from trust_optimization.selection import select_winner, check_constraints, compute_composite_score

def test_selection_filtering_and_optimization():
    # Define Weights & Thresholds
    # All weights are equal (0.2 each)
    weights = Weights(w1=0.2, w2=0.2, w3=0.2, w4=0.2, w5=0.2)
    thresholds = Thresholds(Perf_min=0.4, Tech_min=0.3, F_min=0.3, L_min=0.3)
    
    bidders_scores = {
        # B1: passes all thresholds, composite is average: 0.5
        "B1": {
            "price": 0.5,
            "performance": 0.5,
            "legal": 0.5,
            "financial": 0.5,
            "technical": 0.5
        },
        # B2: fails performance threshold (0.39 < 0.40) but has higher other scores
        # Composite score would be 0.2*0.9 + 0.2*0.39 + 0.2*0.9 + 0.2*0.9 + 0.2*0.9 = 0.798
        # Since it fails Perf_min, it must be excluded.
        "B2": {
            "price": 0.9,
            "performance": 0.39,
            "legal": 0.9,
            "financial": 0.9,
            "technical": 0.9
        },
        # B3: passes all thresholds, composite is average: 0.6
        "B3": {
            "price": 0.6,
            "performance": 0.6,
            "legal": 0.6,
            "financial": 0.6,
            "technical": 0.6
        }
    }
    
    # Verify constraint checks directly
    assert check_constraints(bidders_scores["B1"], thresholds) is True
    assert check_constraints(bidders_scores["B2"], thresholds) is False
    assert check_constraints(bidders_scores["B3"], thresholds) is True
    
    # Run selection
    winner_id, composite_scores, excluded_bidders = select_winner(bidders_scores, weights, thresholds)
    
    # B3 should be the winner because B2 was excluded and B3 (0.6) > B1 (0.5)
    assert winner_id == "B3"
    assert "B2" in excluded_bidders
    assert "B1" not in excluded_bidders
    assert composite_scores["B3"] == pytest.approx(0.6)
    assert composite_scores["B1"] == pytest.approx(0.5)
    assert "B2" not in composite_scores

def test_selection_no_survivors():
    weights = Weights(w1=0.2, w2=0.2, w3=0.2, w4=0.2, w5=0.2)
    thresholds = Thresholds(Perf_min=0.4, Tech_min=0.3, F_min=0.3, L_min=0.3)
    
    bidders_scores = {
        "B1": {
            "price": 0.9,
            "performance": 0.2, # fails Perf_min
            "legal": 0.9,
            "financial": 0.9,
            "technical": 0.9
        }
    }
    
    winner_id, composite_scores, excluded_bidders = select_winner(bidders_scores, weights, thresholds)
    assert winner_id is None
    assert composite_scores == {}
    assert excluded_bidders == ["B1"]
