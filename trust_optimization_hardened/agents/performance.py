from typing import List
from ..schema import ClientPerformanceRecord

def compute_performance_score(
    records: List[ClientPerformanceRecord],
    alpha: float = 1.0,
    beta: float = 1.0
) -> float:
    """
    Perf_i = (sum(v_k * S_i_k) + alpha) / (sum(v_k * (S_i_k + F_i_k)) + alpha + beta)
    
    Where:
      S_i_k, F_i_k = successful / failed projects with client k
      v_k = verification weight for client k
    """
    weighted_success = 0.0
    weighted_total = 0.0
    
    for record in records:
        v_k = record.verification_weight
        weighted_success += v_k * record.successful_projects
        weighted_total += v_k * (record.successful_projects + record.failed_projects)
        
    denominator = weighted_total + alpha + beta
    if denominator <= 0:
        return 0.5
        
    return (weighted_success + alpha) / denominator
