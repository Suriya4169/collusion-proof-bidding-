# Simulation Results Comparison

This document compares the results of the **Original Multi-Agent Trust Optimization System** against the **Hardened Collusion-Resistant System** running under identical seeds (seed=42) and bidder counts (num-bidders=20).

---

## 1. Top Rankings and Winner Comparison

| System | Rank 1 (Winner) | Rank 2 | Rank 3 | Rank 4 | Rank 5 |
|---|---|---|---|---|---|
| **Original** | **`B007`** ($Z=0.7386$) | **`B018`** ($Z=0.7099$) | **`B014`** ($Z=0.7042$) | **`B011`** ($Z=0.6582$) | **`B006`** ($Z=0.6580$) |
| **Hardened** | **`B020`** ($Z=0.8454$) | **`B017`** ($Z=0.8447$) | **`B013`** ($Z=0.8375$) | **`B014`** ($Z=0.7577$) | **`B019`** ($Z=0.7025$) |

### Why the Winner Changed
1. **Outlier Price Safeguard**: In the original, the bidder `B_cheap_but_weak` (bid amount $150,000$) dragged the minimum bid ($B_{\min}$) down. This compressed everyone else's price scores (since $P_i = 150k / B_i$).
   In the hardened system, the $150,000$ bid is flagged as an outlier since it deviates more than $40\%$ from the Engineer's Reference Price ($B_{\text{ref}} = 450,000$). It is excluded from the $B_{\min}$ calculation. Price scores are also blended with the reference price, raising the price scores of reasonable bidders (like `B020` with a $250k$ bid) and boosting their final composite score.
2. **Eligibility Gates**: In the original, `B_cheap_but_weak` was part of the scoring pool. In the hardened system, it fails the financial gate (0.5 years of age < 2; $20k turnover < $100k) and is immediately disqualified.

---

## 2. Key Collusion-Resistance Behaviors

### Case A: Asset-Sharing/Ownership Collusion (`B_colluder_A` & `B_colluder_B`)
* **Original System**: Did not check for asset duplication or ownership linkages. If these bidders existed, they would score highly because their raw attributes were strong.
* **Hardened System**:
  - Automatically detected that both bidders declared the duplicate asset ID `"Asset_Shared_Truck_101"` and shared director `"Owner_Alpha"`.
  - Both received an elevated **Collusion Anomaly Score ($A_i$)** of **`0.8333`**.
  - A **uniqueness penalty ($\rho_i = 0.5$)** was applied to their technical score, cutting it in half to `0.2324`. This dropped them below the technical threshold of `0.3`, excluding them from selection.

### Case B: Non-Disclosure Discrepancies (`B_legal_undisclosed` vs `B_legal_test`)
These two bidders are identical except `B_legal_undisclosed` attempts to hide its litigation cases (declaring 0), while `B_legal_test` honestly declares all 3 of its cases.
* **Original System**:
  - Since the original system relied purely on self-declarations, both bidders scored identically on legal trust (and `B_legal_undisclosed` would have scored higher if external records weren't manually checked).
* **Hardened System**:
  - `B_legal_test` honestly declared and scored **`0.4966`** ($e^{-0.7}$), passing the `0.30` threshold.
  - `B_legal_undisclosed` was reconciled against verified feeds, identifying the discrepancy. It was penalized with $\gamma = 2.0$, dropping its legal trust score to **`0.0012`**, leading to exclusion.

### Case C: Threshold Jitters
* **Original System**: Minimum thresholds were static policy constants (e.g. Perf $\ge 0.40$). Bidders could "aim" exactly for the threshold (threshold-skimming).
* **Hardened System**:
  - The thresholds were randomly jittered by $\pm 0.02$ based on the tender ID. In the run above:
    - Perf threshold shifted, excluding border-line candidates.
    - Since bidders cannot predict the jitter before bid submission, it deters threshold-skimming.

---

## 3. Detailed Diagnostic Bidders Score Comparison

| Bidder ID | Attribute Checked | Original Score | Hardened Score | Resulting Status |
|---|---|---|---|---|
| **`B_brand_new`** | Performance Prior | Perf = `0.5000` | Perf = `0.5000` | Excluded (fails technical/price bounds) |
| **`B_legal_test`** | Honest Legal Trust | Legal = `0.4966` | Legal = `0.4966` | Passed |
| **`B_legal_undisclosed`**| Undisclosed Penalty | Legal = `0.4966` | Legal = **`0.0012`** | **Excluded** (fails legal threshold) |
| **`B_cheap_but_weak`** | Price/Financial Gate| Price = `1.0000` | Price = `2.5033` | **Excluded** (fails eligibility age/turnover) |
| **`B_fails_threshold`** | Threshold Constraint | Perf = `0.1111` | Perf = `0.1111` | Excluded (fails performance threshold) |
| **`B_colluder_A`** | Resource Sharing | Tech = `0.4648` | Tech = **`0.2324`** | **Excluded** (fails technical threshold due to $\rho$) |
