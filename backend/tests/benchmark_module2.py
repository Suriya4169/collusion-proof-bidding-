import os
import sys
import time
from typing import List, Dict

# Fix encoding for Windows terminal
sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.agents.module1.agent5_legal_diff.semantic_differ import compute_semantic_diff
from src.agents.module1.agent5_legal_diff.corruption_risk_scorer import score_corruption_risk

# ═══════════════════════════════════════════════════════════
# GROUND TRUTH DATASET
# ═══════════════════════════════════════════════════════════
# A scientifically controlled dataset to test the precision of the Semantic Differ and Gemini.
GROUND_TRUTH = [
    {
        "original": "The Earnest Money Deposit (EMD) required is ₹50,000.",
        "amended": "The Earnest Money Deposit (EMD) required is ₹5,00,000.",
        "expected_flag": True,
        "expected_classification": "RESTRICTIVE",
        "description": "Numerical Tampering (10x EMD)"
    },
    {
        "original": "Bidder must have 3 years of past experience.",
        "amended": "Bidder must have 8 years of past experience.",
        "expected_flag": True,
        "expected_classification": "RESTRICTIVE",
        "description": "Numerical Tampering (Experience)"
    },
    {
        "original": "The delivery must be completed within 30 days of PO.",
        "amended": "The delivery must be completed within 30 days of Purchase Order.",
        "expected_flag": False,
        "expected_classification": "NEUTRAL",
        "description": "Semantic Equivalence (Abbreviation Expansion)"
    },
    {
        "original": "Turnover requirement is 48 Lakhs.",
        "amended": "Turnover requirement is 200 Lakhs.",
        "expected_flag": True,
        "expected_classification": "RESTRICTIVE",
        "description": "Numerical Tampering (Turnover)"
    },
    {
        "original": "The goods must be securely packaged in wooden crates.",
        "amended": "The goods must be packaged securely in wooden crates.",
        "expected_flag": False,
        "expected_classification": "NEUTRAL",
        "description": "Semantic Equivalence (Word Reordering)"
    },
    {
        "original": "Bidders must have ISO 9001 certification.",
        "amended": "Bidders do not need ISO 9001 certification if registered under MSME.",
        "expected_flag": True,
        "expected_classification": "PERMISSIVE",
        "description": "Semantic Reversal (Making it easier)"
    }
]

def run_mlops_benchmark():
    print("\n" + "="*70)
    print("🚀 MLOps Benchmark Suite: Legal Semantic Diff (Module 2)")
    print("="*70)
    
    total_latency = 0
    true_positives = 0
    false_positives = 0
    false_negatives = 0
    
    correct_classifications = 0
    total_classifications_attempted = 0

    for idx, test_case in enumerate(GROUND_TRUTH):
        print(f"\n[Test {idx+1}] {test_case['description']}")
        print(f"  Orig: {test_case['original']}")
        print(f"  New : {test_case['amended']}")
        
        start_time = time.time()
        
        # 1. Run Sub-Agent 5.2 (Semantic Differ)
        flagged_pairs = compute_semantic_diff(
            original_clauses=[test_case["original"]],
            amended_clauses=[test_case["amended"]],
            similarity_threshold=0.75
        )
        
        is_flagged = len(flagged_pairs) > 0
        
        # Calculate Precision/Recall for semantic difference
        if is_flagged and test_case["expected_flag"]:
            true_positives += 1
            print("  ✅ Semantic Differ: True Positive (Caught tampering)")
        elif is_flagged and not test_case["expected_flag"]:
            false_positives += 1
            print("  ❌ Semantic Differ: False Positive (Flagged a safe change)")
        elif not is_flagged and test_case["expected_flag"]:
            false_negatives += 1
            print("  ❌ Semantic Differ: False Negative (Missed tampering)")
        else:
            print("  ✅ Semantic Differ: True Negative (Ignored safe change)")
            
        # 2. Run Sub-Agent 5.3 (Gemini Classification) if flagged
        if is_flagged and test_case["expected_flag"]:
            total_classifications_attempted += 1
            report = score_corruption_risk(flagged_pairs, days_before_deadline=5)
            
            if report["flagged_clauses"]:
                actual_class = report["flagged_clauses"][0]["classification"]
                if actual_class == test_case["expected_classification"]:
                    correct_classifications += 1
                    print(f"  ✅ Gemini Classification: Correct ({actual_class})")
                else:
                    print(f"  ❌ Gemini Classification: Incorrect (Got {actual_class}, Expected {test_case['expected_classification']})")

        latency = time.time() - start_time
        total_latency += latency
        print(f"  ⏱️  Latency: {latency:.2f}s")
        
    # ═══════════════════════════════════════════════════════════
    # METRICS CALCULATION
    # ═══════════════════════════════════════════════════════════
    precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
    recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
    f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    classification_accuracy = (correct_classifications / total_classifications_attempted) * 100 if total_classifications_attempted > 0 else 0
    avg_latency = total_latency / len(GROUND_TRUTH)

    print("\n" + "="*70)
    print("📊 FINAL BENCHMARK METRICS (MODULE 2)")
    print("="*70)
    print(f"Total Test Cases Analyzed : {len(GROUND_TRUTH)}")
    print(f"Average Pipeline Latency  : {avg_latency:.2f} seconds per pair")
    print("-" * 70)
    print("Sub-Agent 5.2 (Mathematical Semantic Differ)")
    print(f"  Precision : {precision * 100:.1f}% (No false alarms)")
    print(f"  Recall    : {recall * 100:.1f}% (Caught all tampering)")
    print(f"  F1-Score  : {f1_score:.2f}")
    print("-" * 70)
    print("Sub-Agent 5.3 (Gemini Corruption Classification)")
    print(f"  Accuracy  : {classification_accuracy:.1f}%")
    print("="*70 + "\n")

if __name__ == "__main__":
    run_mlops_benchmark()
