import argparse
import os
import csv
from typing import List, Dict, Any
from .schema import Bidder, Weights, Thresholds
from .dataset_generator import generate_synthetic_dataset, save_dataset
from .agents.price import compute_price_scores
from .agents.performance import compute_performance_score
from .agents.legal import compute_legal_score
from .agents.financial import compute_financial_scores
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
    weights: Weights = Weights(),
    thresholds: Thresholds = Thresholds()
):
    print(f"=== Starting Multi-Agent Trust Optimization Simulation (Seed: {seed}, Bidders: {num_bidders}) ===")
    
    # 1. Generate & save dataset
    bidders = generate_synthetic_dataset(num_bidders, seed)
    save_dataset(bidders, data_dir)
    print(f"Dataset generated and saved to {data_dir}/")
    
    # 2. Compute individual agent scores
    price_scores = compute_price_scores(bidders)
    financial_scores = compute_financial_scores(bidders)
    technical_scores = compute_technical_scores(bidders)
    
    # We will build a scores dict for each bidder
    bidders_scores: Dict[str, Dict[str, float]] = {}
    fused_trust_scores: Dict[str, float] = {}
    
    for b in bidders:
        bidder_id = b.bidder_id
        
        # Performance score (using customizable alpha/beta)
        perf_score = compute_performance_score(
            b.performance.successful_projects,
            b.performance.failed_projects,
            alpha=alpha,
            beta=beta
        )
        
        # Legal score
        legal_score = compute_legal_score(b.legal.model_dump())
        
        # Build individual scores dict
        scores = {
            "price": price_scores.get(bidder_id, 0.0),
            "performance": perf_score,
            "legal": legal_score,
            "financial": financial_scores.get(bidder_id, 0.0),
            "technical": technical_scores.get(bidder_id, 0.0)
        }
        bidders_scores[bidder_id] = scores
        
        # Bayesian Trust Fusion
        fused_trust = fuse_trust(b, scores)
        fused_trust_scores[bidder_id] = fused_trust
        
    # 3. Perform selection optimization
    winner_id, composite_scores, excluded_bidders = select_winner(bidders_scores, weights, thresholds)
    
    # 4. Prepare Results Table
    results: List[Dict[str, Any]] = []
    for b in bidders:
        bidder_id = b.bidder_id
        scores = bidders_scores[bidder_id]
        passed = bidder_id not in excluded_bidders
        composite = composite_scores.get(bidder_id, 0.0) if passed else None
        
        results.append({
            "bidder_id": bidder_id,
            "price_score": scores["price"],
            "performance_score": scores["performance"],
            "legal_trust": scores["legal"],
            "financial_score": scores["financial"],
            "technical_score": scores["technical"],
            "fused_trust": fused_trust_scores[bidder_id],
            "composite_score": composite,
            "passed_thresholds": passed,
            "is_winner": (bidder_id == winner_id)
        })
        
    # Sort results: survivors first sorted by composite score descending, then excluded ones
    survivors = [r for r in results if r["passed_thresholds"]]
    survivors.sort(key=lambda x: x["composite_score"], reverse=True)
    
    excluded = [r for r in results if not r["passed_thresholds"]]
    # Sort excluded by bidder ID or fused trust
    excluded.sort(key=lambda x: x["fused_trust"], reverse=True)
    
    final_ranking = survivors + excluded
    
    # 5. Output results to files
    os.makedirs(results_dir, exist_ok=True)
    
    # Write CSV
    csv_path = os.path.join(results_dir, "results.csv")
    with open(csv_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            "rank", "bidder_id", "price_score", "performance_score", "legal_trust",
            "financial_score", "technical_score", "fused_trust", "composite_score",
            "passed_thresholds", "is_winner"
        ])
        for idx, r in enumerate(final_ranking):
            writer.writerow([
                idx + 1,
                r["bidder_id"],
                f"{r['price_score']:.4f}",
                f"{r['performance_score']:.4f}",
                f"{r['legal_trust']:.4f}",
                f"{r['financial_score']:.4f}",
                f"{r['technical_score']:.4f}",
                f"{r['fused_trust']:.4f}",
                f"{r['composite_score']:.4f}" if r["composite_score"] is not None else "N/A",
                "Yes" if r["passed_thresholds"] else "No",
                "Winner" if r["is_winner"] else ""
            ])
            
    # Write Markdown
    md_path = os.path.join(results_dir, "results.md")
    with open(md_path, 'w') as f:
        f.write("# Simulation Results\n\n")
        f.write("| Rank | Bidder ID | Price | Perf | Legal | Finance | Tech | Fused Trust | Composite | Passed? | Status |\n")
        f.write("|---|---|---|---|---|---|---|---|---|---|---|\n")
        for idx, r in enumerate(final_ranking):
            comp_str = f"{r['composite_score']:.4f}" if r["composite_score"] is not None else "N/A"
            passed_str = "Yes" if r["passed_thresholds"] else "No"
            status_str = "**Winner**" if r["is_winner"] else "Passed" if r["passed_thresholds"] else "Excluded"
            f.write(f"| {idx+1} | {r['bidder_id']} | {r['price_score']:.4f} | {r['performance_score']:.4f} | {r['legal_trust']:.4f} | {r['financial_score']:.4f} | {r['technical_score']:.4f} | {r['fused_trust']:.4f} | {comp_str} | {passed_str} | {status_str} |\n")
            
    # Print table to console
    print("\nRanked Simulation Results:")
    print("-" * 125)
    print(f"{'Rank':<5} | {'Bidder ID':<17} | {'Price':<7} | {'Perf':<7} | {'Legal':<7} | {'Finance':<7} | {'Tech':<7} | {'Fused':<7} | {'Composite':<9} | {'Passed?':<7} | {'Status':<8}")
    print("-" * 125)
    for idx, r in enumerate(final_ranking):
        comp_str = f"{r['composite_score']:.4f}" if r["composite_score"] is not None else "N/A"
        passed_str = "Yes" if r["passed_thresholds"] else "No"
        status_str = "*Winner*" if r["is_winner"] else "Passed" if r["passed_thresholds"] else "Excluded"
        print(f"{idx+1:<5} | {r['bidder_id']:<17} | {r['price_score']:.4f} | {r['performance_score']:.4f} | {r['legal_trust']:.4f} | {r['financial_score']:.4f} | {r['technical_score']:.4f} | {r['fused_trust']:.4f} | {comp_str:<9} | {passed_str:<7} | {status_str:<8}")
    print("-" * 125)
    
    # 6. Dynamic update simulation
    if winner_id:
        winner_fused_trust = fused_trust_scores[winner_id]
        trust_success = update_trust(winner_fused_trust, 1.0, lambda_val)
        trust_failure = update_trust(winner_fused_trust, 0.0, lambda_val)
        
        print("\n=== Dynamic Trust Update Simulation (Winner Project Outcome) ===")
        print(f"Winning Bidder: {winner_id}")
        print(f"Original Fused Trust Score: {winner_fused_trust:.4f}")
        print(f"Updated Fused Trust if project SUCCESS (observed performance = 1.0): {trust_success:.4f}")
        print(f"Updated Fused Trust if project FAILURE (observed performance = 0.0): {trust_failure:.4f}")
    else:
        print("\nNo bidder survived the threshold constraints. No winner selected.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Dynamic Bayesian Multi-Agent Trust Optimization Simulation")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for generation")
    parser.add_argument("--num-bidders", type=int, default=20, help="Total number of bidders to generate")
    parser.add_argument("--data-dir", type=str, default="data", help="Directory to save synthetic dataset")
    parser.add_argument("--results-dir", type=str, default="results", help="Directory to save simulation results")
    parser.add_argument("--lambda-val", type=float, default=0.8, help="Lambda parameter for dynamic trust update")
    parser.add_argument("--alpha", type=float, default=1.0, help="Alpha parameter for performance Beta prior")
    parser.add_argument("--beta", type=float, default=1.0, help="Beta parameter for performance Beta prior")
    
    # Weights parameters
    parser.add_argument("--w1", type=float, default=0.2, help="Price weight")
    parser.add_argument("--w2", type=float, default=0.2, help="Performance weight")
    parser.add_argument("--w3", type=float, default=0.2, help="Legal weight")
    parser.add_argument("--w4", type=float, default=0.2, help="Financial weight")
    parser.add_argument("--w5", type=float, default=0.2, help="Technical weight")
    
    # Threshold parameters
    parser.add_argument("--perf-min", type=float, default=0.4, help="Minimum performance threshold")
    parser.add_argument("--tech-min", type=float, default=0.3, help="Minimum technical threshold")
    parser.add_argument("--f-min", type=float, default=0.3, help="Minimum financial threshold")
    parser.add_argument("--l-min", type=float, default=0.3, help="Minimum legal threshold")
    
    args = parser.parse_args()
    
    weights = Weights(w1=args.w1, w2=args.w2, w3=args.w3, w4=args.w4, w5=args.w5)
    thresholds = Thresholds(Perf_min=args.perf_min, Tech_min=args.tech_min, F_min=args.f_min, L_min=args.l_min)
    
    run_simulation(
        seed=args.seed,
        num_bidders=args.num_bidders,
        data_dir=args.data_dir,
        results_dir=args.results_dir,
        lambda_val=args.lambda_val,
        alpha=args.alpha,
        beta=args.beta,
        weights=weights,
        thresholds=thresholds
    )
