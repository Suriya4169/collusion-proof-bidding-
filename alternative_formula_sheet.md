# Alternative Formula Sheet: Collusion-Resistant Trust Optimization System

This document proposes **hardened alternative formulas** for each component of the Dynamic Bayesian Multi-Agent Trust Optimization System, specifically designed to reduce vulnerability to cartel behavior, bid-rigging, and reverse-engineering, while preserving the original system's transparency and auditability goals.

Each section shows the **original formula**, the **vulnerability**, and the **alternative formula**.

---

## 1. Price Agent

### Original
$$P_i = \frac{B_{\min}}{B_i}$$

**Vulnerability**: Fully relative to the bidder pool — a shell/decoy bidder submitting an artificially low bid drags down $B_{\min}$, which can be used to reshape everyone else's relative price score in a coordinated way (or conversely, cartel members submit high cover bids so the "chosen" bidder's real bid looks better by contrast).

### Alternative: Anchor-Blended Price Score
$$P_i = \delta \cdot \frac{B_{\min}}{B_i} + (1-\delta) \cdot \frac{B_{\text{ref}}}{B_i}$$

* $B_{\text{ref}}$: an **independent reference price** — e.g., the government's own pre-tender cost estimate (Engineer's Estimate / EE), or a rolling median of bid prices from the last $N$ similar tenders.
* $\delta \in [0,1]$: blending factor (suggested default $\delta = 0.5$).
* **Why it helps**: Price scoring is no longer *purely* relative to the current bidder pool, so shell bids or cover bids can only influence half the score at most. A bidder pool manipulated to look artificially cheap/expensive can no longer fully control $P_i$.
* **Additional safeguard**: Flag any bid that deviates more than $\pm 40\%$ from $B_{\text{ref}}$ for manual review before it's allowed to affect $B_{\min}$.

---

## 2. Performance Agent

### Original
$$\text{Perf}_i = \frac{S_i + \alpha}{S_i + F_i + \alpha + \beta}$$

**Vulnerability**: A subcontracting ring can inflate each member's $S_i$ over time by "completing projects" with each other, synthetically boosting both performance score and performance confidence.

### Alternative: Independently-Verified, Diversity-Weighted Performance
$$\text{Perf}_i = \frac{\sum_{k=1}^{n} v_k \cdot S_{i,k} + \alpha}{\sum_{k=1}^{n} v_k \cdot (S_{i,k} + F_{i,k}) + \alpha + \beta}$$

* $S_{i,k}, F_{i,k}$: successes/failures for bidder $i$ under **distinct verified client** $k$ (out of $n$ distinct clients on record).
* $v_k$: a **client-diversity verification weight**, $v_k \in (0,1]$, reduced when the client itself has ownership/directorship links to bidder $i$ or to other bidders competing in the same pool (using a beneficial-ownership cross-check registry).
* **Why it helps**: Projects "completed" within a closed ring of related entities contribute far less to the score than independently verified, arms-length client relationships. This breaks the incentive to fabricate performance history through mutual subcontracting.

---

## 3. Legal Agent

### Original
$$\text{Legal\_Trust}_i = e^{-\text{Risk}_i}, \quad \text{Risk}_i = \sum_c (\text{case\_count}_{i,c} \times w_c)$$

**Vulnerability**: Fully self-declared case counts are easy to under-report; no penalty term for being caught lying.

### Alternative: Verification-Weighted Legal Trust with Non-Disclosure Penalty
$$\text{Risk}_i = \sum_{c} \left(\text{case\_count}_{i,c}^{\text{verified}} \times w_c\right) + \gamma \cdot D_i$$
$$\text{Legal\_Trust}_i = e^{-\text{Risk}_i}$$

* $\text{case\_count}_{i,c}^{\text{verified}}$: case counts reconciled against an external registry (court records, blacklist database, tax authority feed) rather than pure self-declaration.
* $D_i$: **discrepancy count** — number of cases found in verification that were *not* self-declared by the bidder.
* $\gamma$: heavy penalty multiplier (suggested $\gamma \ge 2.0$, i.e., an undisclosed case counts for more than a disclosed one of the same type).
* **Why it helps**: Creates an explicit mathematical incentive to disclose honestly rather than hope violations go unnoticed — under-reporting is punished harder than the violation itself.

---

## 4. Financial Agent

### Original
$$\text{Finance}_i = \frac{\text{Raw\_Finance}_i - \min(\text{Raw\_Finance})}{\max(\text{Raw\_Finance}) - \min(\text{Raw\_Finance})}$$

**Vulnerability**: Pool-relative min-max normalization means decoy/shell bidders can shift the entire pool's scoring by artificially setting the floor or ceiling.

### Alternative: Absolute-Reference Normalization with Eligibility Gate
$$\text{Finance}_i = \text{clip}\left(\frac{\text{Raw\_Finance}_i - F_{\text{floor}}}{F_{\text{ceiling}} - F_{\text{floor}}},\ 0,\ 1\right)$$

* $F_{\text{floor}}, F_{\text{ceiling}}$: **fixed, pre-published absolute reference bounds** (e.g., based on industry benchmark data or historical tender averages), set *before* the tender opens — not derived from the current bidder pool.
* **Eligibility gate**: any bidder whose registration age is under a minimum threshold (e.g., 2 years) or whose turnover falls below a statutory minimum is excluded from the pool entirely before normalization, preventing shell companies from being counted at all.
* **Why it helps**: Removes the pool itself as an attack surface — no bidder's score can be manipulated by another bidder's presence in the same tender.

---

## 5. Technical Agent

### Original
$$\text{Tech}_i = E_i^{k_1} \times M_i^{k_2} \times T_i^{k_3} \times X_i^{k_4}$$

**Vulnerability**: Equipment, staff, and experience are self-declared and can be "shared" (same asset/employee listed across multiple colluding bidders).

### Alternative: Deduplicated, Cross-Verified Technical Score
$$\text{Tech}_i = \left(E_i^{k_1} \times M_i^{k_2} \times T_i^{k_3} \times X_i^{k_4}\right) \times \rho_i$$

* $\rho_i \in [0,1]$: a **uniqueness penalty factor**, computed as:
$$\rho_i = 1 - \frac{|\text{Assets}_i \cap \text{Assets}_{-i}|}{|\text{Assets}_i|}$$
  where $\text{Assets}_i$ is the set of declared equipment serials / employee IDs (UAN) / experience certificate numbers for bidder $i$, and $\text{Assets}_{-i}$ is the union of all declared assets across every *other* bidder in the same tender pool.
* **Why it helps**: Any equipment, staff, or certificate reused across "competing" bidders in the same tender directly and automatically reduces the technical score of all parties involved — collusion via shared resources becomes self-defeating rather than free.

---

## 6. Bayesian Trust Fusion

### Original
$$T_i = \frac{\sum_j C_{i,j} \times T_{i,j}}{\sum_j C_{i,j}}$$

**Vulnerability**: Static, publicly-inferable weights and confidence rules let cartels calculate exactly which agent to focus manipulation effort on.

### Alternative: Tender-Randomized Confidence Fusion
$$T_i = \frac{\sum_j C_{i,j} \times \eta_j \times T_{i,j}}{\sum_j C_{i,j} \times \eta_j}$$

* $\eta_j$: a **per-tender randomization multiplier** for each agent $j$, drawn from a narrow published range (e.g., $\eta_j \in [0.85, 1.15]$) using a seed tied to the tender ID, generated *after* bid submission closes.
* **Why it helps**: Bidders cannot know in advance exactly how much each agent will matter for *this specific* tender, defeating precision-targeted gaming, while the *range* of possible influence remains fully published and auditable — preserving fairness and transparency.

---

## 7. Final Bidder Selection

### Original
$$\text{Maximize } Z = w_1 P_i + w_2 \text{Perf}_i + w_3 L_i + w_4 F_i + w_5 \text{Tech}_i$$

**Vulnerability**: Thresholds and weights, once known, let a cartel calculate the minimum viable investment per dimension ("threshold-skimming").

### Alternative: Randomized-Threshold Selection with Collusion Anomaly Check
$$\text{Maximize } Z = w_1 P_i + w_2 \text{Perf}_i + w_3 L_i + w_4 F_i + w_5 \text{Tech}_i - \mu \cdot A_i$$

Subject to:
* $\text{Perf}_i \ge \text{Perf}_{\min} \pm \epsilon$, similarly for $\text{Tech}_{\min}, F_{\min}, L_{\min}$, where $\epsilon$ is a small per-tender randomized jitter (e.g., $\pm 0.02$), sealed and revealed only after bid close.
* $A_i$: a **collusion anomaly score** for bidder $i$ — e.g., a composite of (a) score-clustering similarity with other bidders in the same pool, (b) beneficial-ownership overlap count, (c) shared-asset overlap count from $\rho_i$ above.
* $\mu$: penalty weight applied to suspected anomalous bidders (suggested default $\mu = 0.3$; bidders exceeding an anomaly threshold are flagged for manual disqualification review rather than automatically scored).
* **Winner selection**: exactly 1 winner, but selection is **held for manual review** if the top 2 candidates' $Z$ scores differ by less than a configurable margin *and* either has an elevated $A_i$ — preventing a "designated winner" from cleanly beating suspiciously-similar cover bids.

---

## 8. Summary of Changes

| Component | Original Risk | Alternative Mechanism |
|---|---|---|
| Price | Pool-relative manipulation via shell/cover bids | Blend with independent reference price ($B_{\text{ref}}$) |
| Performance | Ring-based fake project history | Client-diversity verification weighting ($v_k$) |
| Legal | Under-reporting self-declared cases | Verified case counts + non-disclosure penalty ($\gamma$) |
| Financial | Pool min-max manipulation via decoys | Fixed absolute reference bounds + eligibility gate |
| Technical | Shared equipment/staff across bidders | Uniqueness penalty via asset-overlap detection ($\rho_i$) |
| Fusion | Static, learnable agent weighting | Per-tender randomized confidence multipliers ($\eta_j$) |
| Selection | Learnable fixed thresholds | Randomized threshold jitter + collusion anomaly penalty ($A_i$) |

---

## 9. Implementation Notes

* All randomized elements ($\eta_j$, $\epsilon$, tender seed) should be generated using a **cryptographically seeded RNG tied to the tender ID**, generated only *after* the bid submission deadline, and logged for post-hoc audit — this preserves determinism and auditability (anyone can re-run the tender's scoring given the published seed) while denying bidders foreknowledge before they submit.
* Asset/ownership cross-checks ($\rho_i$, $A_i$) require a **shared registry lookup** (e.g., MCA director database, EPFO UAN, equipment registration numbers) — this is the one new infrastructure dependency this alternative formula sheet introduces, and should be scoped explicitly in the prototype's data requirements.
* These alternative formulas are designed to be **backward-compatible** — with $\delta=1$, $\rho_i=1$, $\eta_j=1$, $\epsilon=0$, $\mu=0$, and $v_k=1$, the system collapses exactly back to the original formulas. This means the hardened version can be built as a configurable superset rather than a separate system.

---

*Prepared as a companion to the Market Impact Analysis for the Dynamic Bayesian Multi-Agent Trust Optimization System — Anti-Collusion & Gaming Resistance formulas.*
