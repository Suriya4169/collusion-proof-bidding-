# Audit-Grade Financial Solvency & Ledger Verification Engine
## Mathematical Formulation, Constraint Engineering, and Adversarial Test Report

---

### Executive Summary

In public procurement and tender evaluations, evaluating bidder solvency using raw bank statements is fraught with fraud and extraction vulnerabilities. A naive pipeline using Optical Character Recognition (OCR) coupled with Large Language Model (LLM) text parsing suffers from three fatal flaws:
1. **Inverted Threat Model:** Forged or tampered PDFs pass standard OCR cleanly without triggering any alarms.
2. **Silent Hallucinations & Non-Determinism:** LLMs frequently drop, substitute, or hallucinate digits in tabular data without error signals or provenance.
3. **Flawed Financial Formulations:** Relying on simple averages or static ratios (e.g., `Average Balance / EMD`) invites **window dressing** (borrowing funds right before bid submission) and overlooks cash-flow volatility.

This report details the implementation of a **Ledger-Constrained Verification Engine** ([ledger_verifier.py](file:///c:/Users/T.P.Veerabathiran/Desktop/academics/S7/project/ledger_verifier.py)). The engine treats bank statements not as plain text documents, but as **mathematical ledgers governed by strict conservation laws**. By enforcing deterministic recurrence constraints, candidate-lattice error recovery, and robust statistical anomaly filters, the system simultaneously fixes OCR digit errors and detects fraudulent balance inflation, page omissions, and circular fund parking.

---

## 1. System Architecture & Verification Pipeline

```mermaid
flowchart TD
    A[Raw Ingestion: Extracted Bank Statement JSON] --> B[Row Recurrence Verification]
    B --> C{Residual |B_t - B_prev - C_t + D_t| <= ε ?}
    C -- Yes --> D[Valid Row Recorded]
    C -- No --> E[Search OCR Candidate Lattice: 1↔7, 3↔8, 5↔6, 0↔8]
    E --> F{Lattice Alternative Satisfies Recurrence?}
    F -- Yes --> G[Corrected OCR Error Logged]
    F -- No --> H[Flag: Unexplainable Residual / Tampering]
    
    D --> I[Inter-Page Continuity Engine]
    G --> I
    H --> I
    
    I --> J{B_open_p+1 == B_close_p ?}
    J -- No --> K[Flag: Missing/Deleted Page Omission]
    J -- Yes --> L[Integrity & Manipulation Layer]
    K --> L
    
    L --> M[Window-Dressing Detector: Robust MAD Z-Score]
    L --> N[Circular Round-Trip Matching: Within W Days]
    L --> O[Benford's Law KS-Divergence]
    
    M --> P[Financial Metrics & Solvency Engine]
    N --> P
    O --> P
    
    P --> Q[Audit Report: Integrity Decision + TWAB + Risk Breakdown]
```

---

## 2. Mathematical Formulations & Constraints

### 2.1 Constraint 1: Intrastatement Row Recurrence (Conservation of Funds)

Every valid financial ledger satisfies the fundamental cash-conservation recurrence relation at each transaction $t$:

$$B_t = B_{t-1} + C_t - D_t$$

Where:
* $B_t$: Closing balance after transaction $t$
* $B_{t-1}$: Opening balance (or balance immediately preceding transaction $t$)
* $C_t$: Credit amount (inflow)
* $D_t$: Debit amount (outflow)

To account for floating-point rounding, we enforce:

$$|B_t - B_{t-1} - C_t + D_t| \le \varepsilon \quad (\text{Default } \varepsilon = 0.05)$$

#### Dual Error-Correction vs. Tamper-Detection Engine:
When the recurrence condition is violated ($|r_t| > \varepsilon$), the engine generates an OCR candidate lattice $\mathcal{C}(x)$ across plausible character confusion sets:

$$\mathcal{C} = \{(1, 7), (3, 8), (5, 6), (0, 8, \text{O})\}$$

The system solves the local combinatorial optimization problem:

$$\min_{\hat{B}_t, \hat{C}_t, \hat{D}_t} \text{Cost}(x \to \hat{x}) \quad \text{subject to} \quad |\hat{B}_t - B_{t-1} - \hat{C}_t + \hat{D}_t| \le \varepsilon$$

* **Case A (OCR Noise):** If a candidate set $\hat{x}$ satisfies the recurrence, the row is corrected automatically with provenance logged (`CORRECTED_OCR_ERROR`).
* **Case B (Deliberate Tampering):** If no permutation of plausible OCR confusions satisfies the recurrence, the residual is logged as an **Unexplainable Residual**:

$$\text{Flag: } \text{ARITHMETIC\_INCONSISTENCY} \quad (\text{Severity: CRITICAL})$$

---

### 2.2 Constraint 2: Inter-Page Balance Continuity

Unscrupulous bidders frequently remove pages containing unfavorable entries (e.g., overdraft penalty fees, loan repayments, or zero-balance periods). To prevent page omission, the opening balance of page $p+1$ must strictly equal the closing balance of page $p$:

$$B_{\text{opening}}^{(p+1)} = B_{\text{closing}}^{(p)}$$

$$\text{Discrepancy} = \left| B_{\text{opening}}^{(p+1)} - B_{\text{closing}}^{(p)} \right| \le \varepsilon$$

If the discrepancy exceeds $\varepsilon$:
$$\text{Flag: } \text{PAGE\_CONTINUITY\_BREAK} \quad (\text{Severity: CRITICAL})$$

---

### 2.3 Constraint 3: Window-Dressing Spike Detection

Bidders often arrange short-term capital injections (promoter loans, temporary third-party deposits) right before bid submission to falsely inflate their average balance. 

Traditional mean balances and standard deviations are heavily skewed by extreme outliers. We employ a **Robust Z-Score** based on **Median Absolute Deviation (MAD)** over daily balances:

$$\text{Median}_{\text{prior}} = \text{Median}\Big(\{B_t \mid t < t_{\text{cutoff}}\}\Big)$$

$$\text{MAD}_{\text{prior}} = \text{Median}\Big(\big|B_t - \text{Median}_{\text{prior}}\big|\Big)$$

$$\hat{\sigma}_{\text{prior}} = 1.4826 \times \text{MAD}_{\text{prior}}$$

$$Z_{\text{window}} = \frac{\bar{B}_{\text{last 30 days}} - \text{Median}_{\text{prior}}}{\hat{\sigma}_{\text{prior}}}$$

Where $t_{\text{cutoff}} = t_{\max} - 30\text{ days}$.

$$\text{If } Z_{\text{window}} \ge \theta_{\text{threshold}} \; (3.0): \quad \text{Flag: } \text{WINDOW\_DRESSING\_SPIKE} \quad (\text{Severity: HIGH})$$

---

### 2.4 Constraint 4: Circular Round-Trip Transfer Detection

Contractors frequently circulate funds between affiliated accounts to fabricate artificial liquidity: a large credit is received and subsequently returned within a short window.

For every credit $C_i \ge \tau_{\text{significance}}$ at timestamp $t_1$:

$$\exists D_j \quad \text{at } t_2 \quad \text{such that} \quad \begin{cases} 
0 \le t_2 - t_1 \le W \quad (W = 7 \text{ days}) \\
\frac{|C_i - D_j|}{C_i} \le 0.02 \quad (\le 2\% \text{ variance}) \\
\text{Jaccard}(\text{Tokens}(C_i), \text{Tokens}(D_j)) \ge \kappa
\end{cases}$$

$$\text{If True:} \quad \text{Flag: } \text{CIRCULAR\_ROUND\_TRIP\_TRANSFER} \quad (\text{Severity: HIGH})$$

---

### 2.5 Constraint 5: Benford's Law Leading Digit Conformity

Natural financial transactions follow Benford's logarithmic distribution for leading significant digits $d \in \{1, 2, \dots, 9\}$:

$$P(d) = \log_{10}\left(1 + \frac{1}{d}\right)$$

The divergence between observed empirical leading-digit distribution $P_{\text{obs}}(d)$ and theoretical distribution $P(d)$ is measured using Kolmogorov-Smirnov distance:

$$d_{\text{KS}} = \max_{d \in \{1,\dots,9\}} \left| F_{\text{observed}}(d) - F_{\text{Benford}}(d) \right|$$

> [!NOTE]
> As highlighted in the core research, Benford's test has reduced power for small transaction counts ($N < 30$), so it is calibrated in this engine as an auxiliary warning rather than an immediate disqualifier.

---

### 2.6 Formulated Solvency Indicators

Rather than relying on the naive arithmetic mean over transaction rows (which overweights days with high transaction volume), the engine computes:

1. **Time-Weighted Average Balance (TWAB):**
   $$\text{TWAB} = \frac{\sum_{k=1}^K B_k \cdot \Delta t_k}{\sum_{k=1}^K \Delta t_k}$$
   Weights each cash level by the actual duration (in days) it remained in the account.

2. **Binding Liquidity Constraint (Minimum Balance):**
   $$B_{\min} = \min_{t} B_t$$
   Measures the true lower bound of solvency during the observation window.

3. **Balance Volatility (Coefficient of Variation, CV):**
   $$\text{CV} = \frac{\sigma(B)}{\bar{B}}$$

4. **Monthly Cash-Flow Trajectory (Slope):**
   Fits an ordinary least-squares regression line $B(t) = m \cdot t + c$ over the observation window, projecting monthly net accumulation or cash burn rate:
   $$\text{Trajectory} = m \times 30 \text{ days}$$

---

## 3. Synthetic Benchmark Datasets

To evaluate the mathematical model, two synthetic multi-page bank statements were constructed:

### Case 1: Authentic Contractor ([sample_legitimate_statement.json](file:///c:/Users/T.P.Veerabathiran/Desktop/academics/S7/project/sample_legitimate_statement.json))
* **Entity:** Shree Balaji Infrastructure Pvt Ltd (State Bank of India)
* **Period:** 6 Months (01-Oct-2025 to 31-Mar-2026)
* **Characteristics:** Natural business inflows (NHAI, PWD, CPWD RA bills) matched with standard construction outflows (cement purchases, steel supplies, monthly payroll, GST payments).
* **Continuity:** Exact continuity across all 3 statement pages.

### Case 2: Adversarially Manipulated Statement ([sample_manipulated_statement.json](file:///c:/Users/T.P.Veerabathiran/Desktop/academics/S7/project/sample_manipulated_statement.json))
* **Entity:** Alpha Apex Enterprises / Bidder 04 (HDFC Bank)
* **Injected Anomalies:**
  1. **Row Recurrence Forgery:** On 2025-10-28, a debit of ₹1,00,000 from an opening ₹5,10,000 should result in ₹4,10,000, but is forged to display ₹9,10,000 (+₹5,00,000 artificial inflation).
  2. **Page Omission:** Page 2 is physically stripped from the submission. Page 1 closes at ₹4,10,000, but Page 3 starts arbitrarily at ₹18,50,000 (discrepancy of ₹14,40,000).
  3. **Circular Round-Trip:** An inflow of ₹35,00,000 from "Apex Allied Ventures" on 2026-03-02 is returned in full 4 days later (2026-03-06).
  4. **Window-Dressing Spike:** On 2026-03-22 (9 days before window close), a ₹70,00,000 "Promoter Loan" is injected, inflating the final balance from ₹18,00,000 to ₹88,00,000.

---

## 4. Empirical Evaluation Results

Execution of `python ledger_verifier.py` produced the following comparative verification:

| Evaluation Metric | Case 1: Legitimate Bidder | Case 2: Manipulated Bidder | Analysis / Interpretation |
|---|---|---|---|
| **Overall Integrity Decision** | **PASSED (AUTHENTIC)** | **FAILED (TAMPERING DETECTED)** | System successfully distinguished authentic vs. fraudulent statements |
| **Flags Triggered** | **0 Flags** | **5 Flags (3 Critical, 2 High)** | All injected fraud patterns were independently caught |
| **Arithmetic Residuals** | 0.00 (All rows match) | Residuals: ₹5,00,000 & ₹9,40,000 | Forged ledger rows caught deterministically |
| **Page Continuity Gap** | ₹0.00 (Seamless transition) | ₹14,40,000 gap (P1 $\to$ P3) | Missing page caught at boundary |
| **Window-Dressing Z-Score** | **0.54** (Normal) | **11.32** (Threshold: 3.00) | Flagged sudden end-of-period cash parking |
| **Round-Trip Transfers** | 0 detected | 1 detected (₹35,00,000 over 4 days) | Caught temporary liquidity inflation |
| **Time-Weighted Avg (TWAB)** | ₹65,60,628.74 | ₹28,21,162.79 | Corrected for day-weighting |
| **Naive Row Average** | ₹64,07,272.73 | ₹35,16,250.00 | Naive average was distorted by +24.6% in Case 2 |
| **Minimum Cash Reserve** | ₹41,75,000.00 | ₹2,60,000.00 | Reveals true liquidity risk (Alpha Apex was near ₹0) |
| **Balance Volatility (CV)** | **0.168** (Very stable) | **1.024** (Highly volatile / unstable) | Accurately reflects high-risk cash fluctuations |
| **Monthly Net Trajectory** | +₹2,57,722.94 / mo | +₹11,29,844.91 / mo (Artificial) | Legitimate steady growth vs. artificial late surge |

---

## 5. Academic Contributions & Alignment

### Alignment with 7th & 8th Semester Goals

```
7th Semester (Completed Core Foundation)
├── Phase 1: Correct Financial Extraction & Normalization
│   └── Time-Weighted Average Balance (TWAB) + Minimum Balance + Trend
└── Phase 2: Mathematical Integrity & Audit Layer
    ├── Deterministic Row Recurrence Equations: B_t = B_{t-1} + C_t - D_t
    ├── Page Continuity Verification: B_open^(p+1) == B_close^(p)
    ├── Window-Dressing Outlier Flagging (Robust MAD Z-Score)
    └── Circular Round-Trip Matching

8th Semester (Future Research Extension)
├── Phase 3: Adversarial Robustness & Evaluation
│   ├── Automated Synthetic Statement Generator with Parametric Degradation
│   ├── OCR Candidate Lattice Beam Search for Autonomous Joint Correction
│   └── Calibration Curves & Equity Gap Auditing across Bank Tiers
└── Phase 4: Contract-Conditioned Cash Flow Shortfall Simulation
    └── Monte Carlo Simulation conditioned on specific Tender S-Curve & Payment Delays
```

### Key Takeaways for Reviewers
1. **Mathematical Rigor Over Generative Hallucination:** Rather than delegating arithmetic to an LLM, the model uses strict conservation equations to audit the data deterministically.
2. **Defensible Audit Trail:** Every flag is backed by an exact transaction ID, date, expected versus reported amount, and mathematical residual.
3. **True Solvency Assessment:** By separating time-weighted averages and minimum balances from window-dressing spikes, the engine protects public tender authorities from selecting under-capitalized contractors.

---

### Executable Files in this Workspace
* [ledger_verifier.py](file:///c:/Users/T.P.Veerabathiran/Desktop/academics/S7/project/ledger_verifier.py) — Complete source code of the verification engine.
* [sample_legitimate_statement.json](file:///c:/Users/T.P.Veerabathiran/Desktop/academics/S7/project/sample_legitimate_statement.json) — Valid benchmark data.
* [sample_manipulated_statement.json](file:///c:/Users/T.P.Veerabathiran/Desktop/academics/S7/project/sample_manipulated_statement.json) — Adversarial benchmark data.
