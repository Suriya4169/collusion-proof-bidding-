import argparse
import os
import csv
from typing import List, Dict, Any
from .schema import Bidder, Weights, Thresholds, TenderConstants
from .dataset_generator import generate_synthetic_dataset, save_dataset
from .agents.price import compute_price_scores
from .agents.performance import compute_performance_score
from .agents.legal import compute_legal_score
from .agents.financial import compute_financial_score, check_financial_eligibility
from .agents.technical import compute_technical_scores
from .fusion import fuse_trust
from .selection import select_winner
from .update import update_trust

def run_simulation(
    seed: int = 42,
    num_bidders: int = 20,
    data_dir: str = "data",
    results_dir: str = "results",
    lambda_val: float = 0.8,
    alpha: float = 1.0,
    beta: float = 1.0,
    constants: TenderConstants = None
):
    if constants is None:
        raise ValueError("TenderConstants must be provided.")
        
    print(f"=== Starting Hardened Collusion-Resistant Simulation ===")
    print(f"Tender ID: {constants.tender_id} | Seed: {seed} | Bidders: {num_bidders}")
    
    # 1. Generate & Save Dataset
    bidders = generate_synthetic_dataset(num_bidders, seed)
    save_dataset(bidders, data_dir)
    print(f"Hardened dataset generated and saved to {data_dir}/")
    
    # 2. Compute Individual Agent Scores
    price_scores = compute_price_scores(bidders, constants.B_ref, constants.delta)
    technical_scores = compute_technical_scores(bidders, constants.weights.w5) # uses default k1..k4 or w5 inside
    
    # We will build a scores dict for each bidder
    bidders_scores: Dict[str, Dict[str, float]] = {}
    fused_trust_scores: Dict[str, float] = {}
    
    for b in bidders:
        bidder_id = b.bidder_id
        
        # Performance
        perf = compute_performance_score(b.performance.records, alpha, beta)
        
        # Legal
        legal = compute_legal_score(
            b.legal.self_declared_cases,
            b.legal.verified_cases
        )
        
        # Financial (Absolute Reference Normalization)
        financial = compute_financial_score(
            b,
            constants.F_floor,
            constants.F_ceiling
        )
        
        scores = {
            "price": price_scores.get(bidder_id, 0.0),
            "performance": perf,
            "legal": legal,
            "financial": financial,
            "technical": technical_scores.get(bidder_id, 0.0)
        }
        bidders_scores[bidder_id] = scores
        
        # Bayesian Trust Fusion (with per-tender randomization)
        fused_trust = fuse_trust(b, scores, constants.tender_id)
        fused_trust_scores[bidder_id] = fused_trust
        
    # 3. Perform Selection Optimization (including eligibility checks and anomaly scoring)
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
        anomaly_threshold=constants.anomaly_threshold
    )
    
    # 4. Prepare Results Table
    results: List[Dict[str, Any]] = []
    for b in bidders:
        bidder_id = b.bidder_id
        scores = bidders_scores[bidder_id]
        passed_eligibility = check_financial_eligibility(b, constants.min_registration_age, constants.min_turnover)
        passed_thresholds = bidder_id not in excluded_bidders
        composite = composite_scores.get(bidder_id, 0.0) if passed_thresholds else None
        
        results.append({
            "bidder_id": bidder_id,
            "price_score": scores["price"],
            "performance_score": scores["performance"],
            "legal_trust": scores["legal"],
            "financial_score": scores["financial"],
            "technical_score": scores["technical"],
            "fused_trust": fused_trust_scores[bidder_id],
            "anomaly_score": anomaly_scores.get(bidder_id, 0.0),
            "composite_score": composite,
            "passed_eligibility": passed_eligibility,
            "passed_thresholds": passed_thresholds,
            "is_winner": (bidder_id == winner_id)
        })
        
    # Sort: Survivors by composite score desc, then excluded by fused trust desc
    survivors = [r for r in results if r["passed_thresholds"]]
    survivors.sort(key=lambda x: x["composite_score"], reverse=True)
    
    excluded = [r for r in results if not r["passed_thresholds"]]
    excluded.sort(key=lambda x: x["fused_trust"], reverse=True)
    
    final_ranking = survivors + excluded
    
    # 5. Output Results to Files
    os.makedirs(results_dir, exist_ok=True)
    
    # Write CSV
    csv_path = os.path.join(results_dir, "results_hardened.csv")
    with open(csv_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            "rank", "bidder_id", "price_score", "performance_score", "legal_trust",
            "financial_score", "technical_score", "fused_trust", "anomaly_score",
            "composite_score", "eligible", "passed_thresholds", "status"
        ])
        for idx, r in enumerate(final_ranking):
            status = "Winner" if r["is_winner"] else "Passed" if r["passed_thresholds"] else "Excluded"
            writer.writerow([
                idx + 1,
                r["bidder_id"],
                f"{r['price_score']:.4f}",
                f"{r['performance_score']:.4f}",
                f"{r['legal_trust']:.4f}",
                f"{r['financial_score']:.4f}",
                f"{r['technical_score']:.4f}",
                f"{r['fused_trust']:.4f}",
                f"{r['anomaly_score']:.4f}",
                f"{r['composite_score']:.4f}" if r["composite_score"] is not None else "N/A",
                "Yes" if r["passed_eligibility"] else "No",
                "Yes" if r["passed_thresholds"] else "No",
                status
            ])
            
    # Write Markdown
    md_path = os.path.join(results_dir, "results_hardened.md")
    with open(md_path, 'w') as f:
        f.write("# Hardened Simulation Results\n\n")
        if hold_review:
            f.write("> [!WARNING]\n")
            f.write("> **TENDER SELECTION HELD FOR MANUAL REVIEW**: The top candidates' composite scores are close, and at least one exhibits a high collusion anomaly score.\n\n")
        f.write("| Rank | Bidder ID | Price | Perf | Legal | Finance | Tech | Fused Trust | Anomaly | Composite | Eligible? | Status |\n")
        f.write("|---|---|---|---|---|---|---|---|---|---|---|---|\n")
        for idx, r in enumerate(final_ranking):
            comp_str = f"{r['composite_score']:.4f}" if r["composite_score"] is not None else "N/A"
            elig_str = "Yes" if r["passed_eligibility"] else "No"
            status_str = "**Winner**" if r["is_winner"] else "Passed" if r["passed_thresholds"] else "Excluded"
            f.write(f"| {idx+1} | {r['bidder_id']} | {r['price_score']:.4f} | {r['performance_score']:.4f} | {r['legal_trust']:.4f} | {r['financial_score']:.4f} | {r['technical_score']:.4f} | {r['fused_trust']:.4f} | {r['anomaly_score']:.4f} | {comp_str} | {elig_str} | {status_str} |\n")
            
    # Print to Console
    print("\nRanked Simulation Results:")
    print("-" * 145)
    print(f"{'Rank':<5} | {'Bidder ID':<20} | {'Price':<7} | {'Perf':<7} | {'Legal':<7} | {'Finance':<7} | {'Tech':<7} | {'Fused':<7} | {'Anomaly':<7} | {'Composite':<9} | {'Eligible?':<9} | {'Status':<8}")
    print("-" * 145)
    for idx, r in enumerate(final_ranking):
        comp_str = f"{r['composite_score']:.4f}" if r["composite_score"] is not None else "N/A"
        elig_str = "Yes" if r["passed_eligibility"] else "No"
        status_str = "*Winner*" if r["is_winner"] else "Passed" if r["passed_thresholds"] else "Excluded"
        print(f"{idx+1:<5} | {r['bidder_id']:<20} | {r['price_score']:.4f} | {r['performance_score']:.4f} | {r['legal_trust']:.4f} | {r['financial_score']:.4f} | {r['technical_score']:.4f} | {r['fused_trust']:.4f} | {r['anomaly_score']:.4f} | {comp_str:<9} | {elig_str:<9} | {status_str:<8}")
    print("-" * 145)
    
    if hold_review:
        print("\n!!! WARNING: TENDER SELECTION HELD FOR MANUAL REVIEW !!!")
        print("Reason: High anomaly score detected within narrow selection margin.")
        
    # 6. Dynamic update simulation
    if winner_id:
        winner_fused_trust = fused_trust_scores[winner_id]
        trust_success = update_trust(winner_fused_trust, 1.0, lambda_val)
        trust_failure = update_trust(winner_fused_trust, 0.0, lambda_val)
        
        print("\n=== Dynamic Trust Update Simulation (Winner Project Outcome) ===")
        print(f"Winning Bidder: {winner_id}")
        print(f"Original Fused Trust Score: {winner_fused_trust:.4f}")
        print(f"Updated Fused Trust if project SUCCESS: {trust_success:.4f}")
        print(f"Updated Fused Trust if project FAILURE: {trust_failure:.4f}")
    else:
        print("\nNo bidder survived the eligibility and threshold gates. No winner selected.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Hardened Trust Optimization Simulation")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for generation")
    parser.add_argument("--num-bidders", type=int, default=20, help="Total number of bidders to generate")
    parser.add_argument("--data-dir", type=str, default="data", help="Directory to save synthetic dataset")
    parser.add_argument("--results-dir", type=str, default="results", help="Directory to save simulation results")
    parser.add_argument("--lambda-val", type=float, default=0.8, help="Lambda parameter for dynamic trust update")
    parser.add_argument("--alpha", type=float, default=1.0, help="Alpha parameter for performance Beta prior")
    parser.add_argument("--beta", type=float, default=1.0, help="Beta parameter for performance Beta prior")
    
    # Selection weights
    parser.add_argument("--w1", type=float, default=0.2, help="Price weight")
    parser.add_argument("--w2", type=float, default=0.2, help="Performance weight")
    parser.add_argument("--w3", type=float, default=0.2, help="Legal weight")
    parser.add_argument("--w4", type=float, default=0.2, help="Financial weight")
    parser.add_argument("--w5", type=float, default=0.2, help="Technical weight")
    
    # Minimum thresholds
    parser.add_argument("--perf-min", type=float, default=0.4, help="Perf min threshold")
    parser.add_argument("--tech-min", type=float, default=0.3, help="Tech min threshold")
    parser.add_argument("--f-min", type=float, default=0.3, help="Financial min threshold")
    parser.add_argument("--l-min", type=float, default=0.3, help="Legal min threshold")
    
    # Hardened parameters
    parser.add_argument("--b-ref", type=float, default=450000.0, help="Engineer's Reference Price")
    parser.add_argument("--delta", type=float, default=0.5, help="Blending price factor")
    parser.add_argument("--min-age", type=float, default=2.0, help="Eligibility min company age")
    parser.add_argument("--min-turnover", type=float, default=100000.0, help="Eligibility min turnover")
    parser.add_argument("--f-floor", type=float, default=0.05, help="Financial absolute lower bound")
    parser.add_argument("--f-ceiling", type=float, default=0.8, help="Financial absolute upper bound")
    parser.add_argument("--tender-id", type=str, default="TENDER-2026-X12", help="Tender ID to seed randomizers")
    parser.add_argument("--mu", type=float, default=0.3, help="Collusion penalty multiplier")
    parser.add_argument("--review-margin", type=float, default=0.02, help="Clustering margin for manual review")
    parser.add_argument("--anomaly-threshold", type=float, default=0.10, help="Anomaly threshold for manual review")
    
    args = parser.parse_args()
    
    weights = Weights(w1=args.w1, w2=args.w2, w3=args.w3, w4=args.w4, w5=args.w5)
    thresholds = Thresholds(Perf_min=args.perf_min, Tech_min=args.tech_min, F_min=args.f_min, L_min=args.l_min)
    
    constants = TenderConstants(
        B_ref=args.b_ref,
        delta=args.delta,
        min_registration_age=args.min_age,
        min_turnover=args.min_turnover,
        F_floor=args.f_floor,
        F_ceiling=args.f_ceiling,
        tender_id=args.tender_id,
        mu=args.mu,
        review_margin=args.review_margin,
        anomaly_threshold=args.anomaly_threshold,
        weights=weights,
        thresholds=thresholds
    )
    
    run_simulation(
        seed=args.seed,
        num_bidders=args.num_bidders,
        data_dir=args.data_dir,
        results_dir=args.results_dir,
        lambda_val=args.lambda_val,
        alpha=args.alpha,
        beta=args.beta,
        constants=constants
    )
