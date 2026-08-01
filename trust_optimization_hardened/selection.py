import random
import math
from typing import Dict, List, Tuple, Optional, Set
from .schema import Thresholds, Weights, Bidder
from .agents.financial import check_financial_eligibility
from .agents.technical import compute_uniqueness_penalty

def generate_threshold_jitters(
    tender_id: str,
    max_jitter: float = 0.02
) -> Dict[str, float]:
    """
    Generates deterministic, tender-specific threshold jitters.
    """
    rng = random.Random(tender_id + "_jitter")
    thresholds = ["Perf_min", "Tech_min", "F_min", "L_min"]
    return {name: rng.uniform(-max_jitter, max_jitter) for name in thresholds}

def compute_euclidean_distance(v1: List[float], v2: List[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(v1, v2)))

def calculate_anomaly_scores(
    bidders: List[Bidder],
    bidders_scores: Dict[str, Dict[str, float]]
) -> Dict[str, float]:
    """
    Computes Collusion Anomaly Score A_i for each bidder:
    A_i = (S_a + O_i + S_c) / 3.0
    
    Where:
      - S_a = 1.0 - rho_i (Shared technical assets fraction)
      - O_i = 1.0 if beneficial ownership overlap exists with any other bidder, else 0.0
      - S_c = 1.0 if agent score profiles cluster closely (Euclidean distance < 0.05) with any other bidder, else 0.0
    """
    anomaly_scores = {}
    if len(bidders) <= 1:
        return {b.bidder_id: 0.0 for b in bidders}
        
    for bidder in bidders:
        bidder_id = bidder.bidder_id
        scores_i = bidders_scores.get(bidder_id, {})
        v_i = [
            scores_i.get("price", 0.0),
            scores_i.get("performance", 0.0),
            scores_i.get("legal", 0.0),
            scores_i.get("financial", 0.0),
            scores_i.get("technical", 0.0)
        ]
        
        # 1. Shared Assets (S_a)
        other_assets = set()
        for b in bidders:
            if b.bidder_id != bidder_id:
                other_assets.update(b.technical.declared_assets)
        rho = compute_uniqueness_penalty(bidder.technical.declared_assets, other_assets)
        s_a = 1.0 - rho
        
        # 2. Beneficial Ownership Overlap (O_i)
        o_i = 0.0
        owners_i = set(bidder.beneficial_owners)
        for b in bidders:
            if b.bidder_id != bidder_id:
                owners_j = set(b.beneficial_owners)
                if owners_i.intersection(owners_j):
                    o_i = 1.0
                    break
                    
        # 3. Score Clustering Similarity (S_c)
        s_c = 0.0
        for b in bidders:
            if b.bidder_id != bidder_id:
                scores_j = bidders_scores.get(b.bidder_id, {})
                v_j = [
                    scores_j.get("price", 0.0),
                    scores_j.get("performance", 0.0),
                    scores_j.get("legal", 0.0),
                    scores_j.get("financial", 0.0),
                    scores_j.get("technical", 0.0)
                ]
                dist = compute_euclidean_distance(v_i, v_j)
                if dist < 0.05:
                    s_c = 1.0
                    break
                    
        anomaly_scores[bidder_id] = (s_a + o_i + s_c) / 3.0
        
    return anomaly_scores

def check_constraints(
    scores: Dict[str, float],
    thresholds: Thresholds,
    jitters: Dict[str, float]
) -> bool:
    """
    Checks if agent scores pass the jittered minimum thresholds:
      Perf_i >= Perf_min + epsilon_perf
      Tech_i >= Tech_min + epsilon_tech
      F_i    >= F_min    + epsilon_F
      L_i    >= L_min    + epsilon_L
    """
    perf = scores.get("performance", 0.0)
    tech = scores.get("technical", 0.0)
    fin = scores.get("financial", 0.0)
    legal = scores.get("legal", 0.0)
    
    return (
        perf >= (thresholds.Perf_min + jitters.get("Perf_min", 0.0)) and
        tech >= (thresholds.Tech_min + jitters.get("Tech_min", 0.0)) and
        fin >= (thresholds.F_min + jitters.get("F_min", 0.0)) and
        legal >= (thresholds.L_min + jitters.get("L_min", 0.0))
    )

def compute_composite_score(
    scores: Dict[str, float],
    weights: Weights,
    anomaly_score: float,
    mu: float
) -> float:
    """
    Z = w1*P_i + w2*Perf_i + w3*L_i + w4*F_i + w5*Tech_i - mu * A_i
    """
    base_score = (
        weights.w1 * scores.get("price", 0.0) +
        weights.w2 * scores.get("performance", 0.0) +
        weights.w3 * scores.get("legal", 0.0) +
        weights.w4 * scores.get("financial", 0.0) +
        weights.w5 * scores.get("technical", 0.0)
    )
    return base_score - mu * anomaly_score

def select_winner(
    bidders: List[Bidder],
    bidders_scores: Dict[str, Dict[str, float]],
    weights: Weights,
    thresholds: Thresholds,
    tender_id: str,
    min_registration_age: float,
    min_turnover: float,
    mu: float = 0.3,
    review_margin: float = 0.02,
    anomaly_threshold: float = 0.10
) -> Tuple[Optional[str], Dict[str, float], List[str], Dict[str, float], bool]:
    """
    1. Filter out bidders failing financial eligibility gate.
    2. Filter out bidders failing jittered minimum thresholds.
    3. Apply collusion anomaly score checks.
    4. Compute penalized composite scores Z.
    5. Returns (winner_id, composite_scores, excluded_bidders, anomaly_scores, hold_for_manual_review).
    """
    excluded_bidders = []
    eligible_bidders = []
    
    # 1. Eligibility Gate check
    for b in bidders:
        if check_financial_eligibility(b, min_registration_age, min_turnover):
            eligible_bidders.append(b)
        else:
            excluded_bidders.append(b.bidder_id)
            
    # Compute anomaly scores on all original bidders so cross-references are complete
    anomaly_scores = calculate_anomaly_scores(bidders, bidders_scores)
    
    # Generate threshold jitters
    jitters = generate_threshold_jitters(tender_id)
    
    # 2. Check minimum thresholds on eligible survivors
    survivor_bidders = []
    for b in eligible_bidders:
        scores = bidders_scores.get(b.bidder_id, {})
        if check_constraints(scores, thresholds, jitters):
            survivor_bidders.append(b)
        else:
            excluded_bidders.append(b.bidder_id)
            
    if not survivor_bidders:
        return None, {}, excluded_bidders, anomaly_scores, False
        
    # 3. Compute penalized composite scores Z
    composite_scores = {}
    for b in survivor_bidders:
        bidder_id = b.bidder_id
        scores = bidders_scores[bidder_id]
        anomaly = anomaly_scores.get(bidder_id, 0.0)
        composite_scores[bidder_id] = compute_composite_score(scores, weights, anomaly, mu)
        
    # Sort survivors by Z descending
    sorted_survivors = sorted(composite_scores.items(), key=lambda x: x[1], reverse=True)
    winner_id = sorted_survivors[0][0]
    
    # 4. Check for manual review condition
    hold_for_manual_review = False
    if len(sorted_survivors) >= 2:
        z1, z2 = sorted_survivors[0][1], sorted_survivors[1][1]
        id1, id2 = sorted_survivors[0][0], sorted_survivors[1][0]
        
        close_margin = abs(z1 - z2) < review_margin
        elevated_anomaly = (
            anomaly_scores.get(id1, 0.0) >= anomaly_threshold or
            anomaly_scores.get(id2, 0.0) >= anomaly_threshold
        )
        if close_margin and elevated_anomaly:
            hold_for_manual_review = True
            
    return winner_id, composite_scores, excluded_bidders, anomaly_scores, hold_for_manual_review
