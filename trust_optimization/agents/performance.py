def compute_performance_score(
    successful_projects: int,
    failed_projects: int,
    alpha: float = 1.0,
    beta: float = 1.0
) -> float:
    """
    Perf_i = (S_i + alpha) / (S_i + F_i + alpha + beta)
    """
    denominator = successful_projects + failed_projects + alpha + beta
    if denominator <= 0:
        return 0.5
    return (successful_projects + alpha) / denominator
