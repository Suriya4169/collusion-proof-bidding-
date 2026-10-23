"""
Ledger-Constrained Verification Engine for Bank Statements
Based on: "Audit-Grade Solvency Verification for Public Procurement"

Formulated Constraints:
1. Row-Level Recurrence: |B_t - B_{t-1} - C_t + D_t| <= epsilon
   - OCR Error Correction via Candidate Lattice vs. Unexplainable Residual (Tampering)
2. Inter-Page Continuity: B_opening^(p+1) == B_closing^(p)
3. Window-Dressing Spike Detection: Robust Z-Score via Median Absolute Deviation (MAD)
4. Round-Trip Reversal Matching: C_i approx D_j within window W with matching counterparty
5. Benford's Law Leading Digit Distribution
6. Time-Weighted Average Balance (TWAB) & Minimum Balance Metrics
"""

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd


# ==============================================================================
# 1. Verification Engine
# ==============================================================================

class LedgerConstraintVerifier:
    """
    Enforces mathematical conservation laws and anomaly constraints
    over extracted bank statement transactions.
    """

    # Common OCR digit confusion pairs in financial table scans
    OCR_CONFUSIONS = {
        '1': ['7', 'I', 'l'],
        '7': ['1'],
        '3': ['8'],
        '8': ['3', '0', 'B'],
        '0': ['8', 'O'],
        '5': ['6', 'S'],
        '6': ['5']
    }

    def __init__(self, tolerance: float = 0.05, window_dressing_threshold: float = 3.0):
        self.tolerance = tolerance
        self.window_dressing_threshold = window_dressing_threshold

    def _generate_digit_variations(self, num_str: str) -> List[float]:
        """Generates plausible OCR candidate variations for a numeric string."""
        candidates = {float(num_str)}
        chars = list(num_str)
        for i, char in enumerate(chars):
            if char in self.OCR_CONFUSIONS:
                for alt in self.OCR_CONFUSIONS[char]:
                    if alt.isdigit():
                        varied = chars.copy()
                        varied[i] = alt
                        try:
                            candidates.add(float("".join(varied)))
                        except ValueError:
                            pass
        return list(candidates)

    def verify_row_recurrence(
        self, 
        transactions: List[Dict[str, Any]], 
        opening_balance: float
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Constraint 1: Row Recurrence Equation
        B_t = B_{t-1} + C_t - D_t
        
        If violated:
        - Checks candidate lattice to attempt OCR error correction.
        - If unresolvable, logs as an unexplainable residual (tampering/forgery).
        """
        audit_rows = []
        flags = []
        prev_balance = opening_balance

        for idx, row in enumerate(transactions):
            tx_id = row.get("tx_id", f"TX_{idx+1}")
            c = float(row.get("credit", 0.0))
            d = float(row.get("debit", 0.0))
            b = float(row.get("balance", 0.0))
            
            # Expected balance under recurrence
            expected_b = round(prev_balance + c - d, 2)
            residual = round(abs(b - expected_b), 2)
            
            status = "VALID"
            correction_note = None

            if residual > self.tolerance:
                # Recurrence violated! Test candidate lattice
                corrected = False
                # Try substituting candidates for balance, credit, debit
                b_cands = self._generate_digit_variations(f"{b:.2f}".split('.')[0])
                c_cands = self._generate_digit_variations(f"{c:.2f}".split('.')[0]) if c > 0 else [c]
                d_cands = self._generate_digit_variations(f"{d:.2f}".split('.')[0]) if d > 0 else [d]

                for b_cand in b_cands:
                    for c_cand in c_cands:
                        for d_cand in d_cands:
                            if abs(b_cand - (prev_balance + c_cand - d_cand)) <= self.tolerance:
                                status = "CORRECTED_OCR_ERROR"
                                correction_note = (
                                    f"Lattice correction: Recurrence satisfied by substituting "
                                    f"[B: {b}->{b_cand}, C: {c}->{c_cand}, D: {d}->{d_cand}]"
                                )
                                b, c, d = b_cand, c_cand, d_cand
                                residual = 0.0
                                corrected = True
                                break
                        if corrected:
                            break
                    if corrected:
                        break

                if not corrected:
                    status = "UNEXPLAINABLE_RESIDUAL"
                    flags.append({
                        "type": "ARITHMETIC_INCONSISTENCY",
                        "severity": "CRITICAL",
                        "tx_id": tx_id,
                        "date": row.get("date"),
                        "narration": row.get("narration"),
                        "expected_balance": expected_b,
                        "reported_balance": b,
                        "residual": residual,
                        "details": f"Row arithmetic mismatch: expected {expected_b:,.2f} but reported {b:,.2f} (Residual: {residual:,.2f})"
                    })

            audit_rows.append({
                "tx_id": tx_id,
                "date": row.get("date"),
                "narration": row.get("narration"),
                "debit": d,
                "credit": c,
                "reported_balance": float(row.get("balance", 0.0)),
                "verified_balance": b,
                "expected_balance": expected_b,
                "residual": residual,
                "status": status,
                "note": correction_note
            })
            prev_balance = b

        return audit_rows, flags

    def verify_page_continuity(self, pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Constraint 2: Inter-Page Continuity
        B_opening^(p+1) == B_closing^(p)
        Detects page omission, tampering, or statement splicing.
        """
        flags = []
        for i in range(len(pages) - 1):
            curr_page = pages[i]
            next_page = pages[i + 1]
            
            p_curr_num = curr_page["page_number"]
            p_next_num = next_page["page_number"]
            
            p_curr_close = round(curr_page["closing_balance"], 2)
            p_next_open = round(next_page["opening_balance"], 2)

            gap = round(abs(p_next_open - p_curr_close), 2)
            if gap > self.tolerance:
                flags.append({
                    "type": "PAGE_CONTINUITY_BREAK",
                    "severity": "CRITICAL",
                    "page_transition": f"Page {p_curr_num} -> Page {p_next_num}",
                    "closing_page_p": p_curr_close,
                    "opening_page_next": p_next_open,
                    "gap": gap,
                    "details": (
                        f"Continuity break between Page {p_curr_num} (Close: {p_curr_close:,.2f}) "
                        f"and Page {p_next_num} (Open: {p_next_open:,.2f}). Discrepancy: {gap:,.2f}. "
                        f"Potential page deletion or splicing."
                    )
                })
        return flags

    def detect_window_dressing(self, df: pd.DataFrame) -> Tuple[Optional[float], List[Dict[str, Any]]]:
        """
        Constraint 3: Window-Dressing Spike Detection
        Z_window = (B_bar_last_30d - Median(B_prior)) / MAD(B_prior)
        Detects artificial end-of-period cash injections.
        """
        flags = []
        if df.empty or len(df) < 5:
            return None, flags

        df_sorted = df.sort_values("date_parsed").copy()
        max_date = df_sorted["date_parsed"].max()
        cutoff_date = max_date - timedelta(days=30)

        prior_balances = df_sorted[df_sorted["date_parsed"] < cutoff_date]["verified_balance"]
        window_balances = df_sorted[df_sorted["date_parsed"] >= cutoff_date]["verified_balance"]

        if prior_balances.empty or window_balances.empty:
            return None, flags

        median_prior = float(np.median(prior_balances))
        mad_prior = float(np.median(np.abs(prior_balances - median_prior)))
        
        # Consistent scale factor for normal distribution MAD approx: 1.4826
        mad_scaled = mad_prior * 1.4826 if mad_prior > 0 else 1.0

        mean_window = float(np.mean(window_balances))
        z_score = (mean_window - median_prior) / mad_scaled

        if z_score >= self.window_dressing_threshold:
            flags.append({
                "type": "WINDOW_DRESSING_SPIKE",
                "severity": "HIGH",
                "z_score": round(z_score, 2),
                "threshold": self.window_dressing_threshold,
                "median_prior": round(median_prior, 2),
                "mean_last_30d": round(mean_window, 2),
                "details": (
                    f"Suspicious balance inflation in final 30 days. "
                    f"Prior median: {median_prior:,.2f} vs Last 30d mean: {mean_window:,.2f}. "
                    f"Robust Z-score: {z_score:.2f} >= threshold ({self.window_dressing_threshold})."
                )
            })

        return round(z_score, 2), flags

    def detect_round_trips(self, df: pd.DataFrame, max_window_days: int = 7) -> List[Dict[str, Any]]:
        """
        Constraint 4: Round-Trip Velocity Constraint
        Matches large credits with near-equal debits within W days with same counterparty/narration.
        """
        flags = []
        credits = df[df["credit"] > 0].copy()
        debits = df[df["debit"] > 0].copy()

        # Check transactions exceeding 2x median transaction size
        threshold = df["credit"].median() * 2 if df["credit"].median() > 0 else 10000

        for _, c_row in credits.iterrows():
            c_amt = c_row["credit"]
            if c_amt < threshold:
                continue
            c_date = c_row["date_parsed"]
            c_desc = c_row["narration"].lower().strip()

            # Find matching debits within max_window_days
            matching_debits = debits[
                (debits["date_parsed"] >= c_date) & 
                (debits["date_parsed"] <= c_date + timedelta(days=max_window_days))
            ]

            for _, d_row in matching_debits.iterrows():
                d_amt = d_row["debit"]
                d_desc = d_row["narration"].lower().strip()

                # Check amount similarity (within 2%) and counterparty overlap
                amt_match = abs(c_amt - d_amt) / c_amt <= 0.02
                # Check for common counterparty keywords
                c_tokens = set(c_desc.replace('/', ' ').split())
                d_tokens = set(d_desc.replace('/', ' ').split())
                token_overlap = len(c_tokens.intersection(d_tokens)) > 1

                if amt_match and token_overlap:
                    flags.append({
                        "type": "CIRCULAR_ROUND_TRIP_TRANSFER",
                        "severity": "HIGH",
                        "credit_tx": c_row["tx_id"],
                        "debit_tx": d_row["tx_id"],
                        "amount_in": c_amt,
                        "amount_out": d_amt,
                        "duration_days": (d_row["date_parsed"] - c_date).days,
                        "counterparty_narration": f"In: '{c_row['narration']}' -> Out: '{d_row['narration']}'",
                        "details": (
                            f"Temporary cash parking detected: Inflow of {c_amt:,.2f} on {c_row['date']} "
                            f"reversed by outflow of {d_amt:,.2f} on {d_row['date']} (within {(d_row['date_parsed'] - c_date).days} days)."
                        )
                    })

        return flags

    def check_benfords_law(self, df: pd.DataFrame) -> Tuple[float, List[Dict[str, Any]]]:
        """
        Constraint 5: Benford's Law Leading Digit Distribution Check
        Weak fabrication signal: evaluates leading digits against P(d) = log10(1 + 1/d).
        """
        flags = []
        amounts = []
        for val in list(df["credit"]) + list(df["debit"]):
            if val > 0:
                lead_digit = int(str(f"{val:.2f}").replace(".", "")[0])
                if 1 <= lead_digit <= 9:
                    amounts.append(lead_digit)

        if len(amounts) < 20:
            return 0.0, flags  # sample too small

        counts = pd.Series(amounts).value_counts(normalize=True).to_dict()
        ks_dist = 0.0
        benford_probs = {d: math.log10(1.0 + 1.0 / d) for d in range(1, 10)}

        for d in range(1, 10):
            p_obs = counts.get(d, 0.0)
            p_exp = benford_probs[d]
            diff = abs(p_obs - p_exp)
            if diff > ks_dist:
                ks_dist = diff

        # If max divergence exceeds 0.25 on reasonable samples
        if ks_dist > 0.25 and len(amounts) >= 30:
            flags.append({
                "type": "BENFORDS_LAW_DEVIATION",
                "severity": "LOW",
                "ks_divergence": round(ks_dist, 3),
                "details": f"Transaction amounts deviate from Benford's distribution (Max delta: {ks_dist:.3f})."
            })

        return round(ks_dist, 3), flags

    def compute_solvency_metrics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Computes accurate financial liquidity indicators:
        - Time-Weighted Average Balance (TWAB)
        - Minimum Cash Balance
        - Cash Flow Slope (Accumulation vs. Depletion)
        - Volatility (Coefficient of Variation)
        """
        df_sorted = df.sort_values("date_parsed").copy()
        
        # Calculate daily intervals for time weighting
        df_sorted["days_held"] = df_sorted["date_parsed"].diff().dt.days.fillna(1).clip(lower=1)
        twab = (df_sorted["verified_balance"] * df_sorted["days_held"]).sum() / df_sorted["days_held"].sum()
        min_balance = df_sorted["verified_balance"].min()
        max_balance = df_sorted["verified_balance"].max()
        
        # Volatility
        mean_bal = df_sorted["verified_balance"].mean()
        std_bal = df_sorted["verified_balance"].std()
        cv = (std_bal / mean_bal) if mean_bal > 0 else 0.0

        # Linear regression slope (Net cash trajectory per month)
        df_sorted["day_num"] = (df_sorted["date_parsed"] - df_sorted["date_parsed"].min()).dt.days
        if len(df_sorted) > 2 and df_sorted["day_num"].max() > 0:
            slope, _ = np.polyfit(df_sorted["day_num"], df_sorted["verified_balance"], 1)
            monthly_burn_or_growth = slope * 30.0
        else:
            monthly_burn_or_growth = 0.0

        return {
            "time_weighted_avg_balance": round(twab, 2),
            "naive_transaction_avg_balance": round(mean_bal, 2),
            "min_balance": round(min_balance, 2),
            "max_balance": round(max_balance, 2),
            "balance_volatility_cv": round(cv, 3),
            "monthly_cashflow_slope": round(monthly_burn_or_growth, 2)
        }

    def verify_statement(self, statement_data: Dict[str, Any]) -> Dict[str, Any]:
        """Full end-to-end verification pipeline."""
        account_info = statement_data.get("account_info", {})
        pages = statement_data.get("pages", [])
        
        # 1. Flatten all transactions across pages
        all_tx = []
        for p in pages:
            for tx in p.get("transactions", []):
                tx_copy = tx.copy()
                tx_copy["page_number"] = p["page_number"]
                all_tx.append(tx_copy)

        opening_balance = pages[0]["opening_balance"] if pages else 0.0

        # 2. Enforce Row Recurrence & Error Correction
        audit_rows, row_flags = self.verify_row_recurrence(all_tx, opening_balance)

        # 3. Enforce Page Continuity
        page_flags = self.verify_page_continuity(pages)

        # 4. Prepare DataFrame with parsed dates
        df = pd.DataFrame(audit_rows)
        if not df.empty:
            df["date_parsed"] = pd.to_datetime(df["date"])

        # 5. Detect Window Dressing
        z_score, wd_flags = self.detect_window_dressing(df)

        # 6. Detect Round-Tripping / Circular Transfers
        rt_flags = self.detect_round_trips(df)

        # 7. Benford's Law Check
        benford_div, bf_flags = self.check_benfords_law(df)

        # 8. Compute Solvency & Financial Metrics
        financial_metrics = self.compute_solvency_metrics(df)

        all_flags = row_flags + page_flags + wd_flags + rt_flags + bf_flags
        critical_flags = [f for f in all_flags if f.get("severity") == "CRITICAL"]
        high_flags = [f for f in all_flags if f.get("severity") == "HIGH"]

        # Integrity Status Decision
        if len(critical_flags) > 0:
            overall_integrity = "FAILED (POTENTIAL_TAMPERING_DETECTED)"
        elif len(high_flags) > 0:
            overall_integrity = "SUSPICIOUS (MANIPULATION_FLAGS_RAISED)"
        else:
            overall_integrity = "PASSED (AUTHENTIC_AND_CONSISTENT)"

        return {
            "account_holder": account_info.get("name"),
            "account_number": account_info.get("account_number"),
            "bank_name": account_info.get("bank"),
            "statement_period": account_info.get("period"),
            "overall_integrity": overall_integrity,
            "total_transactions_analyzed": len(all_tx),
            "flags_raised_count": len(all_flags),
            "flags": all_flags,
            "financial_metrics": financial_metrics,
            "window_dressing_z_score": z_score,
            "benford_divergence": benford_div,
            "sample_audit_rows": audit_rows[:6]  # preview first rows
        }


# ==============================================================================
# 2. Realistic Sample Bank Statements
# ==============================================================================

def get_sample_legitimate_statement() -> Dict[str, Any]:
    """Statement A: Legitimate, fully consistent contractor with natural business cycles."""
    return {
        "account_info": {
            "name": "Shree Balaji Infrastructure Pvt Ltd",
            "account_number": "002905001923",
            "bank": "State Bank of India",
            "period": "01-Oct-2025 to 31-Mar-2026"
        },
        "pages": [
            {
                "page_number": 1,
                "opening_balance": 4500000.00,
                "closing_balance": 5275000.00,
                "transactions": [
                    {"tx_id": "SBI_101", "date": "2025-10-05", "narration": "NEFT: NHAI RA BILL 12", "credit": 2200000.00, "debit": 0.0, "balance": 6700000.00},
                    {"tx_id": "SBI_102", "date": "2025-10-12", "narration": "RTGS: UltraTech Cement Ltd", "credit": 0.0, "debit": 850000.00, "balance": 5850000.00},
                    {"tx_id": "SBI_103", "date": "2025-10-25", "narration": "SALARY DISBURSEMENT OCT", "credit": 0.0, "debit": 575000.00, "balance": 5275000.00}
                ]
            },
            {
                "page_number": 2,
                "opening_balance": 5275000.00,  # Exact continuity
                "closing_balance": 6420000.00,
                "transactions": [
                    {"tx_id": "SBI_104", "date": "2025-11-04", "narration": "CHQ: Tata Steel Supply", "credit": 0.0, "debit": 1100000.00, "balance": 4175000.00},
                    {"tx_id": "SBI_105", "date": "2025-11-20", "narration": "NEFT: PWD RA BILL 04", "credit": 3400000.00, "debit": 0.0, "balance": 7575000.00},
                    {"tx_id": "SBI_106", "date": "2025-11-28", "narration": "SALARY DISBURSEMENT NOV", "credit": 0.0, "debit": 590000.00, "balance": 6985000.00},
                    {"tx_id": "SBI_107", "date": "2025-12-15", "narration": "GST PAYMENT NOV", "credit": 0.0, "debit": 565000.00, "balance": 6420000.00}
                ]
            },
            {
                "page_number": 3,
                "opening_balance": 6420000.00,  # Exact continuity
                "closing_balance": 6810000.00,
                "transactions": [
                    {"tx_id": "SBI_108", "date": "2026-01-10", "narration": "DIESEL BULK PURCHASE IOCL", "credit": 0.0, "debit": 720000.00, "balance": 5700000.00},
                    {"tx_id": "SBI_109", "date": "2026-02-05", "narration": "CPWD RUNNING PAYMENT", "credit": 2100000.00, "debit": 0.0, "balance": 7800000.00},
                    {"tx_id": "SBI_110", "date": "2026-02-25", "narration": "SALARY DISBURSEMENT FEB", "credit": 0.0, "debit": 610000.00, "balance": 7190000.00},
                    {"tx_id": "SBI_111", "date": "2026-03-20", "narration": "EQUIPMENT MAINTENANCE L&T", "credit": 0.0, "debit": 380000.00, "balance": 6810000.00}
                ]
            }
        ]
    }


def get_sample_manipulated_statement() -> Dict[str, Any]:
    """
    Statement B: Manipulated statement containing injected anomalies:
    1. Row Recurrence Violation (Forged row arithmetic discrepancy)
    2. Page Continuity Break (Deleted/Missing Page 2)
    3. Window-Dressing Spike in final 30 days
    4. Circular Round-Trip Transfer (Parked fund reversed 4 days later)
    5. Benford's Law anomaly
    """
    return {
        "account_info": {
            "name": "Alpha Apex Enterprises (Bidder 04)",
            "account_number": "502000492810",
            "bank": "HDFC Bank",
            "period": "01-Oct-2025 to 31-Mar-2026"
        },
        "pages": [
            {
                "page_number": 1,
                "opening_balance": 350000.00,
                "closing_balance": 410000.00,
                "transactions": [
                    {"tx_id": "TX_01", "date": "2025-10-05", "narration": "LOCAL VENDOR PAYMENT", "credit": 0.0, "debit": 90000.00, "balance": 260000.00},
                    {"tx_id": "TX_02", "date": "2025-10-18", "narration": "CLIENT RETAINER", "credit": 250000.00, "debit": 0.0, "balance": 510000.00},
                    # ARITHMETIC DISCREPANCY / FORGED BALANCE:
                    # 510,000 - 100,000 = 410,000, but forged to look like 910,000!
                    {"tx_id": "TX_03_FORGED", "date": "2025-10-28", "narration": "SUB-CONTRACT WORK", "credit": 0.0, "debit": 100000.00, "balance": 910000.00}
                ]
            },
            # NOTE: Page 2 is missing! Page 3 starts with an arbitrary opening balance.
            {
                "page_number": 3,
                "opening_balance": 1850000.00,  # Page 1 ended at 410,000/910,000; sudden discontinuity!
                "closing_balance": 8750000.00,
                "transactions": [
                    {"tx_id": "TX_04", "date": "2026-02-10", "narration": "OFFICE EXPENSES", "credit": 0.0, "debit": 50000.00, "balance": 1800000.00},
                    
                    # CIRCULAR ROUND-TRIP TRANSFER:
                    # Inflow of 3,500,000 from Apex Allied, then wired back 4 days later
                    {"tx_id": "TX_05_ROUNDTRIP_IN", "date": "2026-03-02", "narration": "RTGS FROM APEX ALLIED VENTURES", "credit": 3500000.00, "debit": 0.0, "balance": 5300000.00},
                    {"tx_id": "TX_06_ROUNDTRIP_OUT", "date": "2026-03-06", "narration": "RTGS TO APEX ALLIED VENTURES RETURN", "credit": 0.0, "debit": 3500000.00, "balance": 1800000.00},

                    # WINDOW-DRESSING SPIKE:
                    # Sudden massive injection right before tender cutoff date (28-Mar)
                    {"tx_id": "TX_07_WINDOW_DRESS", "date": "2026-03-22", "narration": "SHORT TERM PROMOTER LOAN", "credit": 7000000.00, "debit": 0.0, "balance": 8800000.00},
                    {"tx_id": "TX_08", "date": "2026-03-25", "narration": "MISC CHARGES", "credit": 0.0, "debit": 50000.00, "balance": 8750000.00}
                ]
            }
        ]
    }


# ==============================================================================
# 3. Demonstration Runner
# ==============================================================================

def print_banner(title: str):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def display_audit_result(res: Dict[str, Any]):
    print(f"\nAccount Holder   : {res['account_holder']}")
    print(f"Bank / Account   : {res['bank_name']} | {res['account_number']}")
    print(f"Statement Period : {res['statement_period']}")
    print(f"Overall Decision : >> {res['overall_integrity']} <<")
    print(f"Flags Triggered  : {res['flags_raised_count']}")

    print("\n[+] Formulated Financial & Solvency Metrics:")
    metrics = res["financial_metrics"]
    print(f"  * Time-Weighted Avg Balance (TWAB) : INR {metrics['time_weighted_avg_balance']:>18,.2f}")
    print(f"  * Naive Transaction-Average Balance: INR {metrics['naive_transaction_avg_balance']:>18,.2f}")
    print(f"  * Minimum Cash Balance Reached     : INR {metrics['min_balance']:>18,.2f}")
    print(f"  * Balance Volatility (Coeff of Var): {metrics['balance_volatility_cv']:>18.3f}")
    print(f"  * Monthly Cash Flow Trajectory     : INR {metrics['monthly_cashflow_slope']:>18,.2f}/mo")

    if res.get("window_dressing_z_score") is not None:
        print(f"  * Window-Dressing Robust Z-Score   : {res['window_dressing_z_score']:>18.2f} (Threshold = 3.00)")

    if res["flags"]:
        print("\n[!] DETECTED INCONSISTENCIES & MANIPULATION FLAGS:")
        for idx, flag in enumerate(res["flags"], 1):
            sev = flag.get("severity", "MEDIUM")
            ftype = flag.get("type")
            details = flag.get("details")
            print(f"   [{idx}] [{sev}] {ftype}:")
            print(f"       -> {details}")
    else:
        print("\n[OK] All ledger recurrence and continuity constraints satisfied with zero flags.")


if __name__ == "__main__":
    import json
    import sys

    verifier = LedgerConstraintVerifier(tolerance=0.05, window_dressing_threshold=3.0)

    if len(sys.argv) > 1:
        target_path = sys.argv[1]
        print_banner(f"VERIFYING FILE: {target_path}")
        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        result = verifier.verify_statement(data)
        display_audit_result(result)
    else:
        print_banner("CASE 1: LEGITIMATE BIDDER STATEMENT (SHREE BALAJI INFRA)")
        case1_data = get_sample_legitimate_statement()
        res1 = verifier.verify_statement(case1_data)
        display_audit_result(res1)

        print_banner("CASE 2: MANIPULATED & TAMPERED STATEMENT (ALPHA APEX ENTERPRISES)")
        case2_data = get_sample_manipulated_statement()
        res2 = verifier.verify_statement(case2_data)
        display_audit_result(res2)

    print("\n" + "=" * 80)
    print("  PROTOTYPE VERIFICATION COMPLETED SUCCESSFULLY")
    print("=" * 80 + "\n")
