import pytest
from trust_optimization.update import update_trust

def test_dynamic_update():
    # Test 1: standard default lambda = 0.8, observed = 1.0 (success)
    # T_new = 0.8 * 0.5 + 0.2 * 1.0 = 0.4 + 0.2 = 0.6
    t_new1 = update_trust(T_old=0.5, observed_performance=1.0, lambda_val=0.8)
    assert t_new1 == pytest.approx(0.6)
    
    # Test 2: default lambda = 0.8, observed = 0.0 (failure)
    # T_new = 0.8 * 0.7 + 0.2 * 0.0 = 0.56
    t_new2 = update_trust(T_old=0.7, observed_performance=0.0, lambda_val=0.8)
    assert t_new2 == pytest.approx(0.56)
    
    # Test 3: high responsiveness lambda = 0.3, observed = 0.9
    # T_new = 0.3 * 0.6 + 0.7 * 0.9 = 0.18 + 0.63 = 0.81
    t_new3 = update_trust(T_old=0.6, observed_performance=0.9, lambda_val=0.3)
    assert t_new3 == pytest.approx(0.81)
