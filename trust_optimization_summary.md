# Research Summary: Dynamic Bayesian Multi-Agent Trust Optimization System

This document provides a detailed overview of the design, mathematical formulations, and implementation details of the **Dynamic Bayesian Multi-Agent Trust Optimization System** as of August 2026. This summary is intended for research transfer and prompt continuation in other LLMs (like GPT).

---

## 1. Project Overview & Architecture

The system evaluates, ranks, and selects bidders/vendors for tenders. It uses **five independent agents** to evaluate bidders across five distinct dimensions. The individual scores are then fused using a **Bayesian confidence weighting** scheme, filtered against minimum threshold constraints, and selected by maximizing a composite weighted objective function. The system also supports **dynamic updating** of trust scores based on observed project outcomes.

### Directory Structure

```text
trust_optimization/
│   __init__.py
│   schema.py               # Pydantic schemas for data validation
│   fusion.py               # Bayesian confidence-weighted trust fusion
│   selection.py            # Constraint filtering and Composite score maximization
│   update.py               # Pure-function dynamic trust update formula
│   dataset_generator.py    # Synthetic bidder dataset generator (includes hand-checkable cases)
│   run_simulation.py       # Main CLI entry point to run dataset generation and simulation
│   requirements.txt        # Package dependencies (pydantic, pytest)
│   README.md               # User manual and math explanations
│
├───agents/
│       __init__.py
│       price.py            # Price Agent (Relative ratio calculation)
│       performance.py      # Performance Agent (Beta-Binomial estimator)
│       legal.py            # Legal Agent (Exponential risk decay)
│       financial.py        # Financial Agent (Multiplicative normalized score)
│       technical.py        # Technical Agent (Cobb-Douglas weighted geometric mean)
│
└───tests/
        test_agents.py      # Unit tests for price, performance, legal, financial, technical agents
        test_fusion.py      # Unit tests for Bayesian confidence-weighted fusion
        test_selection.py   # Unit tests for constraint verification and winners argmax
        test_update.py      # Unit tests for dynamic trust update calculations
```

---

## 2. Mathematical Formulations & Component Logic

### 2.1. Price Agent (`agents/price.py`)
Evaluates the bid relative to the lowest bid received:
$$P_i = \frac{B_{\min}}{B_i}$$
* **Inputs**: `bid_amount` ($B_i$).
* **Mechanism**: Finds the minimum bid ($B_{\min}$) across the entire pool of bidders for the tender. Bids less than or equal to $0$ are assigned a score of $0.0$.

### 2.2. Performance Agent (`agents/performance.py`)
Utilizes a **Bayesian Beta-Binomial estimator** to evaluate historical performance:
$$\text{Perf}_i = \frac{S_i + \alpha}{S_i + F_i + \alpha + \beta}$$
* **Inputs**:
  * $S_i$: Count of successful projects.
  * $F_i$: Count of failed projects.
  * $\alpha, \beta$: Prior parameters representing prior successful/failed project counts.
* **Prior configuration**: Defaults to uniform prior $\alpha = 1.0, \beta = 1.0$ (giving a new bidder score of exactly $0.5$). Prior can be skewed (e.g., $\alpha=0.9, \beta=0.1$) to represent historical industry success averages.

### 2.3. Legal Agent (`agents/legal.py`)
Evaluates risk using an exponential decay model based on counted legal violations:
$$\text{Risk}_i = \sum_{c \in \text{Categories}} (\text{case\_count}_{i,c} \times w_c)$$
$$\text{Legal\_Trust}_i = e^{-\text{Risk}_i}$$
* **Inputs**: A mapping of legal categories to case counts on file.
* **Weights ($w_c$)**:
  * Minor civil: $0.2$
  * Tax violation: $0.3$
  * Labour law: $0.5$
  * Environmental: $0.8$
  * Blacklisting: $0.8$
  * Corruption / fraud: $1.0$

### 2.4. Financial Agent (`agents/financial.py`)
Multiplies normalized financial indicators, then normalizes the product across the pool:
$$\text{Raw\_Finance}_i = \text{Liquidity}_i \times \text{CreditRating}_i \times \text{Profitability}_i$$
$$\text{Finance}_i = \frac{\text{Raw\_Finance}_i - \min(\text{Raw\_Finance})}{\max(\text{Raw\_Finance}) - \min(\text{Raw\_Finance})}$$
* **Inputs**: Pre-normalized attributes $[0, 1]$ representing liquidity, credit rating, and profitability.
* **Mechanism**: Normalizes the final product so the worst bidder in the pool receives $0.0$ and the best receives $1.0$ (with fallback to $1.0$ if all bidders have equal raw products).

### 2.5. Technical Agent (`agents/technical.py`)
Uses a Cobb-Douglas weighted geometric mean of normalized technical capability indices:
$$\text{Tech}_i = E_i^{k_1} \times M_i^{k_2} \times T_i^{k_3} \times X_i^{k_4}$$
* **Inputs**:
  * $E_i = \text{employees}_i / E_{\max}$
  * $M_i = \text{equipment\_availability}_i / M_{\max}$
  * $T_i = \text{technology\_maturity}_i / T_{\max}$
  * $X_i = \text{experience\_years}_i / X_{\max}$
* **Weights**: Configurable parameters $k_1, k_2, k_3, k_4$ that must sum to $1.0$ (Default: $k_1=0.3, k_2=0.2, k_3=0.2, k_4=0.3$).

### 2.6. Bayesian Trust Fusion (`fusion.py`)
Fuses the 5 independent agent scores into a single confidence-weighted trust score:
$$T_i = \frac{\sum_{j} (C_{i,j} \times T_{i,j})}{\sum_{j} C_{i,j}}$$
Where $j \in \{\text{price, performance, legal, financial, technical}\}$ and $C_{i,j}$ represents the confidence level in agent $j$ for bidder $i$.
* **Confidence Calculation Policies (Default)**:
  * **Price, Financial, Technical Confidence**: Fixed at $1.0$ (baseline).
  * **Performance Confidence**: $S_i + F_i$ (scales linearly with the volume of completed historical projects).
  * **Legal Confidence**: Sum of all legal cases on record (scales with the volume of audited court files).
  * *If total confidence $\sum C_j = 0$, falls back to a simple arithmetic average of the 5 agent scores.*

### 2.7. Final Bidder Selection (`selection.py`)
Selects the optimal bidder by applying minimum threshold checks followed by objective function maximization:
$$\text{Maximize } Z = w_1 P_i + w_2 \text{Perf}_i + w_3 L_i + w_4 F_i + w_5 \text{Tech}_i$$
Subject to:
* $\text{Perf}_i \ge \text{Perf}_{\min}$
* $\text{Tech}_i \ge \text{Tech}_{\min}$
* $F_i \ge F_{\min}$ (Financial score minimum threshold)
* $L_i \ge L_{\min}$ (Legal trust minimum threshold)
* Weights sum: $\sum w_k = 1.0$, and $w_k \ge 0.0$
* Winner selection size: exactly 1 winner.

### 2.8. Dynamic Trust Update (`update.py`)
Recalculates a bidder's trust score when a new project outcome is observed:
$$T_{i,\text{new}} = \lambda T_{i,\text{old}} + (1 - \lambda) \times \text{observed\_performance}$$
* **Parameters**:
  * $\lambda$: Decelerating memory factor (Default: $0.8$).
  * $\text{observed\_performance}$: $1.0$ for successful completion, $0.0$ for project failure.

---

## 3. Data Schema & Models (`schema.py`)

All core data structs are backed by **Pydantic v2**:

```python
from pydantic import BaseModel, Field
from typing import Dict, List, Optional

class PriceInput(BaseModel):
    bid_amount: float = Field(..., gt=0.0)

class PerformanceInput(BaseModel):
    successful_projects: int = Field(default=0, ge=0)
    failed_projects: int = Field(default=0, ge=0)

class LegalInput(BaseModel):
    minor_civil: int = Field(default=0, ge=0)
    tax_violation: int = Field(default=0, ge=0)
    labour_law: int = Field(default=0, ge=0)
    environmental: int = Field(default=0, ge=0)
    blacklisting: int = Field(default=0, ge=0)
    corruption_fraud: int = Field(default=0, ge=0)

class FinancialInput(BaseModel):
    liquidity: float = Field(..., ge=0.0, le=1.0)
    credit_rating: float = Field(..., ge=0.0, le=1.0)
    profitability: float = Field(..., ge=0.0, le=1.0)

class TechnicalInput(BaseModel):
    qualified_employees: int = Field(..., ge=0)
    equipment_availability: float = Field(..., ge=0.0, le=1.0)
    technology_maturity: float = Field(..., ge=0.0)
    relevant_experience_years: float = Field(..., ge=0.0)

class Bidder(BaseModel):
    bidder_id: str
    price: PriceInput
    performance: PerformanceInput
    legal: LegalInput
    financial: FinancialInput
    technical: TechnicalInput

class Weights(BaseModel):
    w1: float = Field(0.2, ge=0.0) # Price weight
    w2: float = Field(0.2, ge=0.0) # Performance weight
    w3: float = Field(0.2, ge=0.0) # Legal trust weight
    w4: float = Field(0.2, ge=0.0) # Financial score weight
    w5: float = Field(0.2, ge=0.0) # Technical score weight

class Thresholds(BaseModel):
    Perf_min: float = Field(0.4, ge=0.0, le=1.0)
    Tech_min: float = Field(0.3, ge=0.0, le=1.0)
    F_min: float = Field(0.3, ge=0.0, le=1.0)
    L_min: float = Field(0.3, ge=0.0, le=1.0)

class TenderConstants(BaseModel):
    B_min: float
    E_max: float
    M_max: float
    T_max: float
    X_max: float
    weights: Weights = Field(default_factory=Weights)
    thresholds: Thresholds = Field(default_factory=Thresholds)
```

---

## 4. Synthetic Dataset Generator & Validation Edge Cases

The simulator generates synthetic bidder records using reproducible seed generation (`dataset_generator.py`). To allow deterministic validation, **four standard hand-checkable edge cases** are injected in every generated dataset:

1. **`B_brand_new`** (Unrated performance prior check):
   * Has $S=0, F=0$. Under uniform priors ($\alpha=1.0, \beta=1.0$), performance score is exactly $\frac{0+1}{0+0+1+1} = 0.5000$.
   * Performance and legal confidences are $0.0$, which tests the Bayesian trust fusion's zero-confidence fallback mechanism (reverting to simple average of non-zero confidence scores).
2. **`B_legal_test`** (Legal risk formula check):
   * Has exactly 2 minor civil cases and 1 tax violation case.
   * $\text{Risk} = 2 \times 0.2 + 1 \times 0.3 = 0.7$.
   * $\text{Legal\_Trust} = e^{-0.7} \approx 0.4966$.
3. **`B_cheap_but_weak`** (Low-cost check):
   * Has a very low bid amount ($150,000.0$) ensuring a Price Score of exactly $1.0000$.
   * But it has extremely low tech and financial attributes. This tests that price alone does not secure selection.
4. **`B_fails_threshold`** (Constraint exclusion check):
   * Excellent pricing and technical parameters, but fails performance ($S=1, F=15$, resulting in Performance score $= 2 / 18 \approx 0.1111$).
   * Tests that the selection optimization correctly excludes the bidder from selection because $0.1111 < \text{Perf}_{\min} = 0.40$.

---

## 5. Console & CLI Invocation

### Command-line Arguments
The pipeline can be executed via the module syntax:
```bash
python -m trust_optimization.run_simulation
```

Supported arguments:
* `--seed`: Seed for generating synthetic data (default: `42`).
* `--num-bidders`: Bidders in the pool (default: `20`).
* `--lambda-val`: Weight parameter for the dynamic trust update (default: `0.8`).
* `--alpha`, `--beta`: Beta distribution parameters for performance prior (default: `1.0`).
* `--w1` to `--w5`: Weights for Price, Performance, Legal, Financial, and Technical scores (default: `0.2` each).
* `--perf-min`, `--tech-min`, `--f-min`, `--l-min`: Minimum thresholds (default: `0.4`, `0.3`, `0.3`, `0.3`).

### Core Exports
Running the CLI prints a ranked markdown-like table to the console and generates output files:
* **`data/bidders.json`** & **`data/bidders.csv`**: Raw generated bidder attributes.
* **`results/results.csv`** & **`results/results.md`**: Evaluation outputs containing all individual agent scores, fused trust, composite scores, and constraint status.

---

## 6. Testing Strategy

The correctness of all formulas is verified via `pytest`.

* **`test_agents.py`**: Asserts mathematical correctness of agent outputs against analytical cases (e.g. brand new bidder $= 0.5$, legal risk $e^{-0.7}$, normalization ranges).
* **`test_fusion.py`**: Validates the confidence weighting logic, checking weighted results, skewed distributions, and zero-confidence fallback triggers.
* **`test_selection.py`**: Ensures threshold filters run before composite checks, confirming the exclusion of bidders failing constraints even if they would otherwise win the weighted objective sum.
* **`test_update.py`**: Asserts dynamic trust update transitions given various values of $T_{\text{old}}$, $\lambda$, and observed project outcomes.

To run the full suite:
```bash
pytest trust_optimization/tests/
```
