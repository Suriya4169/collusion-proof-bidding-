# Build prompt: Dynamic Bayesian Multi-Agent Trust Optimization System

Paste everything below into Antigravity as the task description.

---

Build a complete, tested Python implementation of a **Dynamic Bayesian Multi-Agent Trust Optimization system** for bidder/vendor selection, plus a synthetic dataset generator so the output can be cross-verified by hand. Follow this spec exactly — the formulas are fixed, not suggestions.

## 1. System overview

Five independent agents each score a bidder on one dimension. Their scores are fused into one trust value per bidder using confidence weighting, that trust value is updated over time as new project outcomes arrive, and a final weighted-sum objective function with minimum-threshold constraints selects exactly one winning bidder per tender.

## 2. Agents (implement each as its own module/function, independently testable)

**Price agent**
```
P_i = B_min / B_i
B_min = min(B_i across all bidders in this tender)
```
Input: `bid_amount` per bidder. Requires the full set of bids to compute `B_min`.

**Performance agent** (Bayesian Beta-Binomial estimator)
```
Perf_i = (S_i + alpha) / (S_i + F_i + alpha + beta)
```
- `S_i` = successful projects, `F_i` = failed projects
- `alpha`, `beta` = Beta-distribution prior parameters (pseudo-counts of prior success/failure)
- Default `alpha = beta = 1` (uniform prior) unless a historical success-rate prior is supplied (e.g. a company with a known 90% track record → `alpha=0.9, beta=0.1`)
- Sanity check to encode as a unit test: a brand-new company with `S_i=0, F_i=0, alpha=1, beta=1` must yield exactly `Perf_i = 0.5`

**Legal agent** (weighted risk → exponential decay)
```
Risk_i = sum(case_count_c * weight_c) for each legal case category c
Legal_Trust_i = e^(-Risk_i)
```
Category weights (fixed policy constants, not per-bidder data):
| Category | Weight |
|---|---|
| Minor civil | 0.2 |
| Tax violation | 0.3 |
| Labour law | 0.5 |
| Environmental | 0.8 |
| Blacklisting | 0.8 |
| Corruption / fraud | 1.0 |

Sanity check unit test: 2 minor-civil cases + 1 tax-violation case → `Risk = 2*0.2 + 1*0.3 = 0.7` → `Legal_Trust = e^-0.7`.

**Financial agent**
```
Finance_i = Liquidity_i * CreditRating_i * Profitability_i
```
All three inputs pre-normalized to [0,1] before multiplying. Normalize the product into [0,1] across the bidder pool.

**Technical agent** (weighted geometric mean / Cobb-Douglas form)
```
Tech_i = E_i^k1 * M_i^k2 * T_i^k3 * X_i^k4
```
- `E_i` = qualified employees / `E_max`, `M_i` = equipment availability / `M_max`,
  `T_i` = technology maturity / `T_max`, `X_i` = relevant experience / `X_max`
- `E_max, M_max, T_max, X_max` are the maximum raw values across all bidders in the current tender (computed after all bidder data is collected, same pattern as `B_min`)
- `k1..k4` are configurable weights, default example: `k1=0.3, k2=0.2, k3=0.2, k4=0.3` (must sum to 1)

## 3. Bayesian trust fusion

```
T_i = sum(C_j * T_ij) / sum(C_j)   for j in {price, performance, legal, financial, technical}
```
`C_j` = confidence score per agent per bidder. Make this configurable/pluggable — a reasonable default: confidence scales with the amount of underlying evidence (e.g. performance confidence grows with `S_i+F_i`; legal confidence grows with number of case records on file; price/financial/technical can default to a fixed confidence of 1.0 unless overridden). Document whatever default you implement clearly in the README.

## 4. Dynamic update (applied after each completed project)

```
T_i_new = lambda * T_i_old + (1 - lambda) * observed_performance
```
`lambda` configurable, default `0.8`. Implement as a pure function that takes `(T_old, observed_performance, lambda)` and returns `T_new` — this should be trivially unit-testable in isolation.

## 5. Final bidder selection

```
maximize  Z = sum_i x_i * [w1*P_i + w2*Perf_i + w3*L_i + w4*F_i + w5*Tech_i]
subject to:
  sum_i x_i = 1                 (exactly one bidder selected, x_i in {0,1})
  sum_k w_k = 1, w_k >= 0        (criteria weights)
  Perf_i >= Perf_min  for x_i=1
  Tech_i >= Tech_min  for x_i=1
  F_i    >= F_min     for x_i=1
  L_i    >= L_min     for x_i=1
```
Implementation note: since exactly one bidder is chosen, do **not** call an ILP solver — implement this as (1) filter bidders failing any minimum threshold, (2) compute the weighted composite score for each survivor, (3) select the argmax. Keep the constraint-checking and scoring as separate, testable functions.

## 6. Data model

Per-bidder input record:
```json
{
  "bidder_id": "B001",
  "price": { "bid_amount": 450000 },
  "performance": { "successful_projects": 12, "failed_projects": 2 },
  "legal": { "minor_civil": 2, "tax_violation": 1, "labour_law": 0,
             "environmental": 0, "blacklisting": 0, "corruption_fraud": 0 },
  "financial": { "liquidity": 0.8, "credit_rating": 0.75, "profitability": 0.6 },
  "technical": { "qualified_employees": 45, "equipment_availability": 0.9,
                 "technology_maturity": 7, "relevant_experience_years": 12 }
}
```
Tender-wide constants (computed once per simulation run from the full bidder pool):
```json
{ "B_min": 0, "E_max": 0, "M_max": 0, "T_max": 0, "X_max": 0,
  "weights": { "w1":0.2,"w2":0.2,"w3":0.2,"w4":0.2,"w5":0.2 },
  "thresholds": { "Perf_min":0.4, "Tech_min":0.3, "F_min":0.3, "L_min":0.3 } }
```
Use `pydantic` (or dataclasses with validation) for both schemas.

## 7. Synthetic dataset for cross-verification

Write a generator that produces a configurable number of synthetic bidders (default 20, seedable via `--seed`) with realistic randomized values, **plus these deliberately hand-checkable edge cases included every run**:
- One brand-new bidder with `S=0, F=0` (should score `Perf=0.5` under default prior)
- One bidder with exactly 2 minor-civil + 1 tax-violation legal cases (should score `Legal_Trust=e^-0.7`)
- One bidder that is cheapest on price but weakest on technical/financial (tests that price alone doesn't win)
- One bidder that fails a minimum threshold (should be excluded from selection regardless of composite score)

Output the dataset as both CSV and JSON to a `data/` folder, and output a results table (per-agent scores, fused trust, final ranking, winner) to `results/`.

## 8. Tests

Using `pytest`, cover:
- Each agent formula against the hand-worked examples above
- The dynamic update function for a few `(T_old, observed, lambda)` combinations
- The fusion function with uniform vs. skewed confidence weights
- The selection function: threshold filtering + argmax, including the case where the highest-composite-score bidder is correctly excluded for failing a threshold

## 9. Deliverables / project structure

```
trust_optimization/
  agents/
    price.py
    performance.py
    legal.py
    financial.py
    technical.py
  fusion.py
  update.py
  selection.py
  schema.py
  dataset_generator.py
  run_simulation.py        # CLI: generates dataset, runs pipeline, prints ranked results
  tests/
    test_agents.py
    test_fusion.py
    test_update.py
    test_selection.py
  data/                     # generated datasets land here
  results/                  # generated output lands here
  README.md
  requirements.txt
```

README must explain: how to run `run_simulation.py`, how to regenerate the dataset with a different seed/size, and how to interpret the results table (so the numbers can be manually cross-checked against the formulas above).

## 10. Acceptance criteria
- All formulas implemented exactly as specified above (no silent simplifications)
- All tests pass
- Code is modular — each agent, fusion, update, and selection logic are independently importable and testable
- `run_simulation.py` runs end-to-end with zero manual setup beyond `pip install -r requirements.txt`
