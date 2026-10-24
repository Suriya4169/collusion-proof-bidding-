import pytest
from trust_optimization_hardened.update import update_trust

def test_update_trust():
    # Success observed (observed = 1.0)
    # T_new = 0.8 * 0.7 + 0.2 * 1.0 = 0.56 + 0.20 = 0.76
    t1 = update_trust(0.7, 1.0, lambda_val=0.8)
    assert t1 == pytest.approx(0.76)
    
    # Failure observed (observed = 0.0)
    # T_new = 0.8 * 0.7 + 0.2 * 0.0 = 0.56
    t2 = update_trust(0.7, 0.0, lambda_val=0.8)
    assert t2 == pytest.approx(0.56)
