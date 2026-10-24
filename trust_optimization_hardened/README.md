# Hardened Collusion-Resistant Trust Optimization System

A robust extension of the Dynamic Bayesian Multi-Agent Trust Optimization System, designed specifically to reduce vulnerability to cartel behavior, bid-rigging, resource sharing, and reverse engineering.

## Anti-Collusion Enhancements

### 1. Blended Anchor Reference Price (Price Agent)
$$P_i = \delta \cdot \frac{B_{\min}}{B_i} + (1-\delta) \cdot \frac{B_{\text{ref}}}{B_i}$$
* **Reference Price ($B_{\text{ref}}$)**: Bids are graded against an independent engineer's estimate, preventing cartels from shifting the price scale with shell bids.
* **Deviation Guard**: Bids deviating more than $\pm 40\%$ from $B_{\text{ref}}$ are flagged and excluded from the $B_{\min}$ calculation.

### 2. Verified Diversity-Weighted Performance (Performance Agent)
$$\text{Perf}_i = \frac{\sum_k v_k \cdot S_{i,k} + \alpha}{\sum_k v_k \cdot (S_{i,k} + F_{i,k}) + \alpha + \beta}$$
* **Verification Weight ($v_k$)**: Scores are adjusted by client verification weights, reducing the impact of mutual subcontracting rings (fake reviews).

### 3. Verification Reconciled Legal Trust (Legal Agent)
$$\text{Risk}_i = \sum_{c} \left(\text{case\_count}_{i,c}^{\text{verified}} \times w_c\right) + \gamma \cdot D_i$$
* **Non-Disclosure Penalty ($\gamma$)**: If audited verified cases ($verified$) exceed self-declared cases ($declared$), the discrepancy $D_i$ incurs a heavy multiplier penalty (default $\gamma=2.0$).

### 4. Eligibility Gate & Absolute Reference (Financial Agent)
$$\text{Finance}_i = \text{clip}\left(\frac{\text{Raw\_Finance}_i - F_{\text{floor}}}{F_{\text{ceiling}} - F_{\text{floor}}},\ 0,\ 1\right)$$
* **Absolute Normalization**: Eliminates pool-relative min-max, removing decoy bidders as an attack vector.
* **Gate Check**: Bidders are pre-filtered based on minimum registration age (default 2 years) and statutory turnover (default $100k) to prevent front companies.

### 5. Deduplicated Technical Uniqueness (Technical Agent)
$$\text{Tech}_i = \text{Cobb\_Douglas} \times \rho_i$$
* **Asset Uniqueness Factor ($\rho_i$)**:
$$\rho_i = 1 - \frac{|\text{Assets}_i \cap \text{Assets}_{-i}|}{|\text{Assets}_i|}$$
Declaring equipment serials, employee IDs, or experience credentials that are shared/reused across competing bidders in the same pool results in a direct penalty to the technical score of all involved parties.

### 6. Per-Tender Randomized Multipliers (Bayesian Trust Fusion)
$$T_i = \frac{\sum_j C_{i,j} \cdot \eta_j \cdot T_{i,j}}{\sum_j C_{i,j} \cdot \eta_j}$$
* **Randomized Weights ($\eta_j \in [0.85, 1.15]$)**: Generated using a cryptographically secure deterministic seed tied to the tender ID, preventing bidders from calculating exact target weights before submission.

### 7. Randomized Jitter & Anomaly Penalized Selection (Final Selection)
$$\text{Maximize } Z = \text{weighted\_sum} - \mu \cdot A_i$$
* **Collusion Anomaly Score ($A_i$)**: A composite score reflecting:
  1. Score clustering similarity (Euclidean distance of 5 scores profiles $< 0.05$).
  2. Beneficial ownership overlap.
  3. Shared technical assets ($1.0 - \rho_i$).
* **Jittered Thresholds**: Jitters minimum thresholds randomly ($\pm 0.02$) for each tender run.
* **Manual Review hold**: Triggers a manual verification flag if top candidates score closely and have high anomaly profiles.

---

## Getting Started

### Installation
Ensure dependencies are installed:
```bash
pip install -r trust_optimization_hardened/requirements.txt
```

### Running the CLI
Run the hardened simulation end-to-end:
```bash
python -m trust_optimization_hardened.run_simulation
```

To customize parameters:
```bash
python -m trust_optimization_hardened.run_simulation \
    --tender-id "TENDER-2026-X88" \
    --b-ref 400000 \
    --min-age 3.0 \
    --min-turnover 120000 \
    --mu 0.4
```

### Verification & Testing
Run the collusion-resistance test suite:
```bash
python -m pytest trust_optimization_hardened/tests/
```
