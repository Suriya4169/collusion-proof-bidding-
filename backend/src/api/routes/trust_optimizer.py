"""
FastAPI Route: Hardened Collusion-Resistant Trust Optimization & Best Bidder Selection.

Integrates the multi-agent Bayesian Trust Fusion, Anti-Collusion Anomaly Detection,
and Selection Optimizer into the ProcureGuard AI Government Auditor platform.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

# Ensure trust_optimization_hardened is available in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[4]
OPTIMIZER_ROOT = PROJECT_ROOT / "trust_optimization_hardened"
if str(OPTIMIZER_ROOT) not in sys.path and str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from trust_optimization_hardened.schema import (
        Bidder,
        Weights,
        Thresholds,
        TenderConstants,
    )
    from trust_optimization_hardened.dataset_generator import generate_synthetic_dataset
    from trust_optimization_hardened.agents.price import compute_price_scores
    from trust_optimization_hardened.agents.performance import compute_performance_score
    from trust_optimization_hardened.agents.legal import compute_legal_score
    from trust_optimization_hardened.agents.financial import compute_financial_score, check_financial_eligibility
    from trust_optimization_hardened.agents.technical import compute_technical_scores
    from trust_optimization_hardened.fusion import fuse_trust
    from trust_optimization_hardened.selection import select_winner
    from trust_optimization_hardened.update import update_trust
except ImportError as e:
    raise ImportError(f"Failed to import trust_optimization_hardened modules: {e}")

router = APIRouter(
    prefix="/trust-optimizer",
    tags=["Agent 6: Hardened Bayesian Trust Optimizer & Best Bidder Selection"]
)


class EvaluateTenderRequest(BaseModel):
    tender_id: str = Field(default="TENDER-2026-X12", description="Tender identifier used as seed for random multipliers")
    b_ref: float = Field(default=400000.0, description="Independent reference price")
    delta: float = Field(default=0.5, description="Weight between B_min and B_ref for price scoring")
    num_bidders: int = Field(default=20, ge=2, le=100, description="Number of synthetic bidders if custom bidders not supplied")
    seed: int = Field(default=42, description="Random seed for bidder pool generation")
    mu: float = Field(default=0.3, description="Collusion anomaly penalty multiplier")
    min_registration_age: float = Field(default=2.0, description="Minimum company registration age in years")
    min_turnover: float = Field(default=100000.0, description="Minimum statutory annual turnover in INR")


class LeaderboardEntry(BaseModel):
    rank: int
    bidder_id: str
    price_score: float
    performance_score: float
    legal_score: float
    financial_score: float
    technical_score: float
    fused_bayesian_trust_score: float
    collusion_anomaly_score: float
    composite_score: Optional[float]
    is_financially_eligible: bool
    status: str


class OptimizationResultResponse(BaseModel):
    tender_id: str
    winner_id: Optional[str]
    hold_for_manual_review: bool
    total_evaluated: int
    total_eligible: int
    total_excluded: int
    leaderboard: List[LeaderboardEntry]
    summary_message: str


def _evaluate_bidders_internal(
    bidders: List[Bidder],
    constants: TenderConstants,
    alpha: float = 1.0,
    beta: float = 1.0
) -> Dict[str, Any]:
    price_scores = compute_price_scores(bidders, constants.B_ref, constants.delta)
    technical_scores = compute_technical_scores(bidders, constants.weights.w5)

    bidders_scores: Dict[str, Dict[str, float]] = {}
    fused_trust_scores: Dict[str, float] = {}

    for b in bidders:
        bidder_id = b.bidder_id
        perf = compute_performance_score(b.performance.records, alpha, beta)
        legal = compute_legal_score(b.legal.self_declared_cases, b.legal.verified_cases)
        financial = compute_financial_score(b, constants.F_floor, constants.F_ceiling)

        scores = {
            "price": price_scores.get(bidder_id, 0.0),
            "performance": perf,
            "legal": legal,
            "financial": financial,
            "technical": technical_scores.get(bidder_id, 0.0),
        }
        bidders_scores[bidder_id] = scores
        fused_trust_scores[bidder_id] = fuse_trust(b, scores, constants.tender_id)

    winner_id, composite_scores, excluded_bidders, anomaly_scores, hold_review = select_winner(
        bidders=bidders,
        bidders_scores=bidders_scores,
        weights=constants.weights,
        thresholds=constants.thresholds,
        tender_id=constants.tender_id,
        min_registration_age=constants.min_registration_age,
        min_turnover=constants.min_turnover,
        mu=constants.mu,
        review_margin=constants.review_margin,
        anomaly_threshold=constants.anomaly_threshold,
    )

    results: List[Dict[str, Any]] = []
    for b in bidders:
        bidder_id = b.bidder_id
        scores = bidders_scores[bidder_id]
        passed_eligibility = check_financial_eligibility(b, constants.min_registration_age, constants.min_turnover)
        passed_thresholds = bidder_id not in excluded_bidders
        composite = composite_scores.get(bidder_id) if passed_thresholds else None

        results.append({
            "bidder_id": bidder_id,
            "price": round(scores["price"], 4),
            "performance": round(scores["performance"], 4),
            "legal": round(scores["legal"], 4),
            "financial": round(scores["financial"], 4),
            "technical": round(scores["technical"], 4),
            "fused_trust": round(fused_trust_scores[bidder_id], 4),
            "anomaly": round(anomaly_scores.get(bidder_id, 0.0), 4),
            "composite": round(composite, 4) if composite is not None else None,
            "is_eligible": passed_eligibility,
            "status": "Winner" if bidder_id == winner_id else ("Passed" if passed_thresholds else "Excluded"),
        })

    # Sort: Eligible non-excluded first by composite desc, then excluded by fused trust desc
    def sort_key(row):
        is_winner = 1 if row["status"] == "Winner" else 0
        is_passed = 1 if row["status"] == "Passed" else 0
        comp = row["composite"] if row["composite"] is not None else -1.0
        return (is_winner, is_passed, comp, row["fused_trust"])

    results.sort(key=sort_key, reverse=True)

    leaderboard = [
        LeaderboardEntry(
            rank=idx + 1,
            bidder_id=r["bidder_id"],
            price_score=r["price"],
            performance_score=r["performance"],
            legal_score=r["legal"],
            financial_score=r["financial"],
            technical_score=r["technical"],
            fused_bayesian_trust_score=r["fused_trust"],
            collusion_anomaly_score=r["anomaly"],
            composite_score=r["composite"],
            is_financially_eligible=r["is_eligible"],
            status=r["status"],
        )
        for idx, r in enumerate(results)
    ]

    total_eligible = sum(1 for r in results if r["is_eligible"])
    total_excluded = sum(1 for r in results if r["status"] == "Excluded")

    summary_msg = f"Tender {constants.tender_id}: Evaluated {len(bidders)} bidders. Best Bidder: {winner_id or 'None'}."
    if hold_review:
        summary_msg += " Alert: Manual review hold triggered due to close margin or anomaly risk."

    return {
        "tender_id": constants.tender_id,
        "winner_id": winner_id,
        "hold_for_manual_review": hold_review,
        "total_evaluated": len(bidders),
        "total_eligible": total_eligible,
        "total_excluded": total_excluded,
        "leaderboard": leaderboard,
        "summary_message": summary_msg,
    }


@router.get("/health", summary="Trust Optimizer Engine Health")
def health():
    return {
        "status": "ok",
        "service": "Hardened Collusion-Resistant Trust Optimizer",
        "methods": [
            "Blended Anchor Reference Price",
            "Diversity-Weighted Performance",
            "Verification-Reconciled Legal Trust",
            "Absolute Financial Gate Check",
            "Deduplicated Technical Uniqueness",
            "Dynamic Bayesian Trust Fusion",
            "Randomized Jitter & Collusion Anomaly Penalized Selection"
        ]
    }


@router.get(
    "/leaderboard/{tender_id}",
    response_model=OptimizationResultResponse,
    summary="Get Leaderboard & Best Bidder for Tender (GET Master Endpoint)"
)
def get_tender_leaderboard(
    tender_id: str,
    b_ref: float = Query(400000.0, description="Engineer reference price"),
    num_bidders: int = Query(20, ge=2, le=50, description="Candidate pool size"),
    seed: int = Query(42, description="Simulation seed")
):
    constants = TenderConstants(
        tender_id=tender_id,
        B_ref=b_ref,
        weights=Weights(),
        thresholds=Thresholds()
    )
    bidders = generate_synthetic_dataset(num_bidders, seed)
    return _evaluate_bidders_internal(bidders, constants)


@router.post(
    "/evaluate",
    response_model=OptimizationResultResponse,
    summary="Evaluate Tender Bidders & Maximize Trust Optimization"
)
def evaluate_tender(payload: EvaluateTenderRequest):
    constants = TenderConstants(
        tender_id=payload.tender_id,
        B_ref=payload.b_ref,
        delta=payload.delta,
        min_registration_age=payload.min_registration_age,
        min_turnover=payload.min_turnover,
        mu=payload.mu,
        weights=Weights(),
        thresholds=Thresholds()
    )
    bidders = generate_synthetic_dataset(payload.num_bidders, payload.seed)
    return _evaluate_bidders_internal(bidders, constants)
