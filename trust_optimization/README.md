# Dynamic Bayesian Multi-Agent Trust Optimization System

A complete, modular Python implementation of a **Dynamic Bayesian Multi-Agent Trust Optimization system** for bidder/vendor selection, complete with a synthetic dataset generator and a CLI runner.

## System Overview

This system utilizes five independent agents to score bidders across five distinct dimensions:
1. **Price Agent**: Evaluates price using a relative ratio: $P_i = B_{min} / B_i$.
2. **Performance Agent**: Evaluates project history using a Bayesian Beta-Binomial estimator: $\text{Perf}_i = \frac{S_i + \alpha}{S_i + F_i + \alpha + \beta}$.
3. **Legal Agent**: Evaluates regulatory/litigation risk using an exponential decay model: $\text{Legal\_Trust}_i = e^{-\text{Risk}_i}$.
4. **Financial Agent**: Multiplies normalized liquidity, credit rating, and profitability, then normalizes the product across the bidder pool.
5. **Technical Agent**: Computes the Cobb-Douglas weighted geometric mean of normalized tech metrics: $\text{Tech}_i = E_i^{k_1} M_i^{k_2} T_i^{k_3} X_i^{k_4}$.

These scores are fused into a single **Fused Trust Score** using Bayesian confidence weighting:
$$T_i = \frac{\sum C_j T_{ij}}{\sum C_j}$$

Where confidences $C_j$ default to:
* **Price, Financial, Technical**: $1.0$ (constant baseline confidence)
* **Performance**: $S_i + F_i$ (grows with the volume of completed projects)
* **Legal**: Sum of all legal case counts on file (grows with the volume of court records)

Finally, selection optimization is applied to filter out bidders who fail minimum threshold constraints, and the winner is selected by maximizing a weighted composite objective function:
$$\max Z = w_1 P_i + w_2 \text{Perf}_i + w_3 L_i + w_4 F_i + w_5 \text{Tech}_i$$

---

## Installation

Clone or copy the directory, then install the dependencies listed in `requirements.txt`:

```bash
pip install -r requirements.txt
```

---

## Running the Simulation

You can run the end-to-end pipeline using `run_simulation.py` via python's module invocation:

```bash
python -m trust_optimization.run_simulation
```

### CLI Arguments

You can customize the simulation using command-line arguments:

```bash
python -m trust_optimization.run_simulation \
    --seed 42 \
    --num-bidders 25 \
    --lambda-val 0.8 \
    --alpha 1.0 \
    --beta 1.0 \
    --perf-min 0.4 \
    --tech-min 0.3 \
    --f-min 0.3 \
    --l-min 0.3 \
    --w1 0.2 --w2 0.2 --w3 0.2 --w4 0.2 --w5 0.2
```

Options:
* `--seed`: Set random seed for generating synthetic data (default: `42`).
* `--num-bidders`: Set total number of bidders to generate (default: `20`).
* `--lambda-val`: Weight parameter for the dynamic trust update (default: `0.8`).
* `--alpha`, `--beta`: Beta distribution parameters for performance prior (default: `1.0`).
* `--w1` to `--w5`: Weights for Price, Performance, Legal, Financial, and Technical scores (must sum to 1.0, default: `0.2` each).
* `--perf-min`, `--tech-min`, `--f-min`, `--l-min`: Minimum threshold scores for each dimension (default: `0.4`, `0.3`, `0.3`, `0.3`).

---

## Interpreting Results

Running the CLI produces:
1. **Console Report**: A markdown-style ranking table showing raw agent scores, fused trust scores, composite objective score, threshold evaluation, and final winner selection.
2. **Dynamic Update Simulation**: Simulates a project outcome (both SUCCESS and FAILURE) for the selected winner and shows the recalculated fused trust score updated under the formula:
   $$T_{new} = \lambda T_{old} + (1 - \lambda) \text{observed}$$
3. **File Exports**:
   * `data/bidders.json` & `data/bidders.csv`: The generated synthetic bidders.
   * `results/results.csv` & `results/results.md`: Detailed ranking reports containing all final scores.

### Cross-Checking Edge Cases

To verify mathematical correctness, check the following edge cases included in every synthetic run:
* **`B_brand_new`** (Brand New Bidder):
  * Has $S=0, F=0$. Under default prior $\alpha=1.0, \beta=1.0$, the performance score is exactly $\frac{0 + 1}{0 + 0 + 1 + 1} = 0.5$.
* **`B_legal_test`** (Litigation Test Bidder):
  * Has exactly 2 minor civil and 1 tax violation cases.
  * Risk = $2 \times 0.2 + 1 \times 0.3 = 0.7$.
  * Legal Trust score = $e^{-0.7} \approx 0.4966$.
* **`B_cheap_but_weak`** (Low Cost Bidder):
  * Has the lowest bid amount (e.g., $150,000$) to guarantee a Price Score of $1.0$, but very low tech/financial attributes. Shows that price alone doesn't guarantee victory.
* **`B_fails_threshold`** (Threshold Excluded Bidder):
  * Has excellent pricing and technology but has a high failure rate ($S=1, F=15$, resulting in Perf score $\frac{2}{18} \approx 0.111$). This bidder must be excluded from selection regardless of composite potential since $0.111 < \text{Perf\_min} = 0.4$.

---

## Running Tests

All mathematical formulas, confidence-weighted fusion, dynamic update, and constraints are unit tested using `pytest`. Run the tests using:

```bash
pytest trust_optimization/tests/
```
