def update_trust(
    T_old: float,
    observed_performance: float,
    lambda_val: float = 0.8
) -> float:
    """
    T_i_new = lambda * T_i_old + (1 - lambda) * observed_performance
    """
    return lambda_val * T_old + (1.0 - lambda_val) * observed_performance
