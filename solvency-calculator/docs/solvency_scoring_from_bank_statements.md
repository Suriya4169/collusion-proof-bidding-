---
title: "Solvency scoring from bank statements"
source: "https://claude.ai/chat/101433c4-3e9d-4e2d-a597-3a1c1e6871aa"
model: "claude-sonnet-4-6"
exported: 2026-09-18
---

# Human — Sep 17, 2026, 1:07 AM

> **Attachment: attachment · txt · 6.0 KB**
>
> I have an existing project plan described below. Analyze it critically and suggest ways to improve it, extend it, or make it more novel.
>
> Project Plan
>
> Agent 3: FinTech Solvency Extraction (Teammate 3's Module)
> *The Technical Methodology:*
> Bidders often lie about having enough money to finish a project. This agent mathematically proves their solvency. Because bank statements are images or messy PDFs, we use *Optical Character Recognition (OCR)* to turn the image into a raw string, use an LLM to clean the string into a spreadsheet format, and then apply financial formulas.
>
> *The Backend Implementation (What Teammate 3 must code):*
> 1.  *OCR Processing:* Write a Python script using pytesseract or the Google Document AI API that takes the PDF and reads all the text.
> 2.  *Data Structuring:* The OCR text will be very messy. Send the raw string to the Gemini API with a prompt to clean it and return it as a structured JSON table (Dates, Credits, Debits, Balances).
> 3.  *Data Normalization:* Load that JSON into a Pandas DataFrame. 
> 4.  *Financial Math:* Write Python functions to calculate the averages over 6 months: liquidity_ratio = avg_balance / required_emd. Return a score between 0 and 1.
>
> Your Task
>
> Analyze the project from the perspective of a researcher, technical reviewer, and project evaluator.
>
> 1. Understand the Existing Project
>
> Summarize the project's objective, methodology, components, algorithms/models, datasets, and expected outcomes.
>
> Identify the core problem being solved and the assumptions being made.
>
> Clearly distinguish what is already established in the proposed approach from what could potentially be considered novel.
>
> 2. Identify Weaknesses and Limitations
>
> Find:
>
>
>
> Technical limitations
>
> Methodological weaknesses
>
> Missing components
>
> Unrealistic assumptions
>
> Dataset limitations
>
> Scalability issues
>
> Computational limitations
>
> Evaluation gaps
>
> Potential sources of bias or failure
>
> Components that may be unnecessarily complex
>
>
>
> Explain why each limitation matters and how it could affect the final results.
>
> 3. Suggest Improvements
>
> Suggest concrete improvements to:
>
>
>
> Architecture/design
>
> Algorithms
>
> Mathematical formulation
>
> Data collection/preprocessing
>
> Model training
>
> Optimization
>
> System implementation
>
> Evaluation methodology
>
> Performance metrics
>
>
>
> For each improvement, explain:
>
>
>
> What should be changed?
>
> Why should it be changed?
>
> How could it be implemented?
>
> What benefit would it provide?
>
> What additional complexity or resources would it require?
>
> 4. Find Potential Novel Contributions
>
> Identify opportunities to turn the existing project into a stronger research-oriented or publication-worthy project.
>
>
>
> Look for novelty in areas such as:
>
>
>
> New architecture or pipeline
>
> Hybrid algorithms
>
> New optimization techniques
>
> Novel loss/objective functions
>
> New feature representations
>
> Attention mechanisms
>
> Graph-based methods
>
> Multimodal approaches
>
> Adaptive/dynamic methods
>
> Real-time implementation
>
> Edge/IoT deployment
>
> Explainability
>
> Robustness
>
> Domain adaptation
>
> Few-shot/zero-shot learning
>
> Self-supervised learning
>
> Reinforcement learning
>
> Multi-objective optimization
>
> Ablation-based contributions
>
> New evaluation methodology
>
> Combining existing techniques in a meaningful way
>
>
>
> Do not call something novel merely because it combines two technologies. Explain what the actual research contribution would be.
>
> 5. Research Gap Analysis
>
> Determine:
>
>
>
> What aspects of the project are already well established?
>
> What parts are relatively less explored?
>
> What potential research gaps could be investigated?
>
> Which proposed additions could plausibly constitute a research contribution?
>
>
>
> If possible, distinguish between:
>
>
>
> Incremental improvement
>
> Moderate novelty
>
> Potentially strong novelty
>
>
>
> Do not exaggerate novelty. Clearly state when an idea is already common in the literature.
>
> 6. Generate Alternative Project Directions
>
> Give me 5–10 possible directions for extending the project.
>
>
>
> For each direction provide:
>
>
>
> Idea
>
> Technical approach
>
> Expected contribution
>
> Difficulty level
>
> Required resources
>
> Expected improvement over the current project
>
> Potential research value
>
> 7. Prioritize the Ideas
>
> Create a comparison table with:
>
> IdeaTechnical ImpactNovelty PotentialImplementation DifficultyComputational CostResearch Value
>
> Do not simply maximize novelty. Consider whether each idea is realistically implementable within a student project.
>
> 8. Recommend a Final Improved Version
>
> Based on the analysis, propose an improved version of the project.
>
>
>
> Give:
>
>
>
> Revised project title
>
> Revised problem statement
>
> Proposed architecture/workflow
>
> Main algorithms/models
>
> Dataset requirements
>
> Training/optimization strategy
>
> Evaluation metrics
>
> Baselines for comparison
>
> Ablation studies
>
> Expected contribution
>
> What would make the project meaningfully different from the original
>
> 9. Feasibility Check
>
> Assume this is a student-level project with limited time and computational resources.
>
>
>
> Classify each proposed idea as:
>
>
>
> Easy
>
> Moderate
>
> Difficult
>
> Research-heavy
>
>
>
> Also identify:
>
>
>
> Ideas that can realistically be completed
>
> Ideas that are risky
>
> Ideas that sound impressive but are unlikely to provide meaningful value
>
> Important Requirements
>
> Be technically critical rather than simply praising the project.
>
>
>
> Avoid generic suggestions such as "use a better model" or "increase the dataset size" unless you explain exactly how and why.
>
>
>
> For every proposed novel idea, answer:
>
>
>
> What is new? Why does it matter? How would it work? How would we prove that it works?
>
>
>
> Where relevant, suggest specific algorithms, architectures, mathematical formulations, datasets, experiments, and evaluation metrics.
>
>
>
> Finally, give me 3 concrete project versions:
>
>
>
> Safe Version – realistic improvement with low implementation risk.
>
> Advanced Version – significant technical improvement with moderate risk.
>
> Research Version – highest potential research contribution, even if implementation is more challenging.
>
>
>
> Be honest about what is genuinely novel versus what is simply an engineering improvement.

# Claude — Sep 17, 2026, 1:11 AM

## 1. What the project actually is

**Objective as stated:** given a bidder's bank statements (images or PDFs), produce a 0–1 solvency score for a tender-evaluation pipeline.

**Methodology:** OCR → LLM text cleanup into JSON → Pandas → one ratio (`avg_balance / required_emd`).

**Core problem being solved:** not "proving solvency." The pipeline actually solves *document-to-table extraction*, then applies one arithmetic operation. The solvency question is barely touched.

**Assumptions being made, mostly unstated:**

1. The submitted document is authentic and complete.
2. The balances shown reflect unencumbered, available cash.
3. A six-month average balance is a meaningful predictor of ability to finish a project.
4. EMD is the right denominator for capacity.
5. The LLM transcribes numbers faithfully.
6. One bidder = one account.
7. OCR quality is independent of which bidder submitted the document.

Every one of these is false or shaky in real procurement data.

**What is established vs. potentially novel:** the entire proposed pipeline is established. OCR + LLM key-information-extraction from financial documents is a solved commodity (Google Document AI literally ships a bank-statement parser; Azure Form Recognizer, LayoutLMv3, Donut, Qwen2.5-VL all do this). Computing a ratio in Pandas is not a contribution. As written, there is zero novelty — it is a systems integration exercise. That's fine for a course project, but you asked whether it can become research, so below I separate engineering fixes from actual contributions.

---

## 2. Weaknesses and limitations

### 2.1 The threat model is inverted (most serious)

The premise is "bidders lie," but the pipeline is built entirely on the assumption that the document tells the truth. A forged PDF passes OCR *perfectly* — cleaner than a genuine scan, in fact. You are building a high-precision reader of potentially fraudulent input and calling the output a proof.

Worse, the metric is the single most gameable one available. If a bidder knows the score is `avg_balance / EMD`, the counter-strategy is trivial: borrow money, park it for the observation window, return it. This is classic **window dressing**, and it is well-documented in banking supervision. An automated, published formula creates an adaptive adversary — Goodhart's law with money attached.

### 2.2 OCR design errors

- **Most bank statements are digital-born PDFs with an intact text layer.** Rasterizing them and running Tesseract deliberately destroys exact information and introduces error. You need a router: text-layer extraction (`pdfplumber` / PyMuPDF with word bounding boxes) for digital PDFs, OCR only for true scans, and hybrid handling for scanned pages inside otherwise-digital files.
- **Tesseract is bad at multi-column financial tables.** Its reading order flattens columns, so credits, debits, and balances get interleaved. The downstream LLM is then being asked to reconstruct column semantics from scrambled text — an unnecessary, self-inflicted problem.
- **Indian number formatting** (`1,23,456.78` lakh grouping, `Cr`/`Dr` suffixes, `₹` vs `Rs.`) breaks naive parsing, and OCR confusions (1↔7, 3↔8, 5↔6, 0↔8, `.`↔`,`) silently produce order-of-magnitude errors in exactly the field that matters.
- **Digitally signed PDFs are ignored.** Many Indian bank statements carry a PKCS#7 signature. That is a *verifiable* authenticity signal you're throwing away by converting to pixels.

### 2.3 Using an LLM as the numeric parser

This is the most consequential architectural mistake after the threat model.

- LLMs hallucinate digits silently. There is no error signal, no confidence, no provenance back to a pixel location.
- It is **non-deterministic**. The same statement can produce different JSON on two runs. In a public-procurement context this is close to disqualifying: administrative decisions must be reproducible and auditable, and "the model said so, differently each time" is not defensible if a bidder appeals.
- It sends unredacted financial PII of third parties to an external API. Data-residency and consent problems are real, not hypothetical, and a reviewer will ask.
- Cost and latency scale per page, per statement, per bidder.

### 2.4 The financial formulation is wrong, not just weak

- **`avg_balance / required_emd` is a category error.** EMD is a one-time bid security (typically 2–5% of estimated value). Ability to *finish* a project is governed by working-capital needs over the construction schedule, mobilisation advances, running-account bill cycles with 45–90 day payment lags, and 5–10% retention withheld. EMD tells you almost nothing about that.
- **The mean is the wrong statistic.** A bidder at ₹0 for 170 days with a one-day ₹6 crore spike can beat a steadily solvent firm. You want time-weighted average balance, *minimum* balance, and dispersion.
- **Row-averaging ≠ time-averaging.** Averaging the balance column averages over *transactions*, not days. An account with 400 tiny transactions on one high-balance day gets massively overweighted.
- **A credit limit is not cash.** Overdraft/CC accounts show negative or limit-supported balances; lien-marked FDs and margin money are not available.
- **Multiple accounts are double-counted.** Submit three statements, move ₹1 crore in a circle, and your apparent liquidity triples.
- **Contingent commitments are invisible.** A firm with ₹10 crore cash and eight live contracts is weaker than one with ₹3 crore and none. Single-document analysis cannot see this.
- **The 0–1 score is uncalibrated.** What does 0.7 mean? Nothing is anchored to any outcome, so scores can't be compared across tenders of different sizes.

### 2.5 Evaluation gap

There is no ground truth, no metric, no baseline, and no definition of success anywhere in the plan. This is the single biggest obstacle to the project being research rather than a demo. You cannot report that anything "works."

### 2.6 Dataset problem

Real bank statements are PII and effectively uncollectable at student scale. There is no public benchmark of bank statements with solvency labels. Proxy datasets (SROIE, CORD, FUNSD, DocVQA, PubTables-1M) test table/receipt extraction, not ledger semantics.

### 2.7 Bias and equity failure

Extraction quality correlates with bank size and document production quality. Large private banks emit clean digital PDFs; cooperative and regional rural banks emit photocopied, stamped, sometimes vernacular statements. If parsing fails, the score drops — so **document quality becomes a proxy for bidder size and region**. An automated system that systematically disadvantages small and rural contractors in public procurement is a legal and ethical problem, and nothing in the plan detects it.

### 2.8 Unnecessary complexity

Pandas for what is a list of dicts; "agent" framing for a linear pipeline; LLM cleanup for documents that had structured text to begin with.

---

## 3. Concrete improvements

I'll give the high-value ones with the what/why/how/benefit/cost structure.

### Improvement 1 — Ledger-constrained extraction with arithmetic error correction

**What:** Stop treating extraction as transcription. Every bank statement satisfies a hard recurrence: `B_t = B_{t−1} + C_t − D_t`. Use it as a constraint on the parse, not a post-hoc check.

**How:** Get n-best candidates per numeric cell (Tesseract/PaddleOCR character confidences, or a confusion model over {1,7}, {3,8}, {5,6}, {0,8}, decimal-position variants). Then search for the assignment minimising total edit cost subject to the recurrence holding across the page:

```
min Σ_t cost(x_t → x̂_t)   s.t.  |B̂_t − B̂_{t−1} − Ĉ_t + D̂_t| ≤ ε  ∀t
```

Solve with beam search over rows (cheap, exact enough) or a small MILP if you want the stronger claim. Add page-continuity constraints: closing balance of page *p* = opening balance of *p+1*.

**Why it matters:** it converts an uncheckable generative parse into a self-verifying one, gives you a *free* integrity signal, and corrects OCR digit errors using information the LLM approach discards. Residuals that cannot be explained by plausible OCR edits are then evidence of tampering rather than noise — the same machinery serves extraction and fraud detection.

**Cost:** moderate. A few hundred lines. No GPU. Main work is the candidate generator.

### Improvement 2 — LLM for layout, deterministic code for numbers

**What:** Restrict the LLM to structural mapping (which column is debit, what date format, where the table starts) with schema-forced JSON output. Numbers come from coordinate-anchored text extraction, never from generation.

**Why:** eliminates silent digit hallucination, restores determinism, keeps provenance (every figure maps to a bounding box, which you can highlight in the audit trail). Costs drop by an order of magnitude since the LLM sees one header sample, not every page.

**Cost:** low; mostly a redesign of the prompt boundary.

### Improvement 3 — Replace the ratio with a cash-flow shortfall simulation

**What:** Score = `1 − P(liquidity shortfall during contract)`, estimated by Monte Carlo.

**How:** take the project's S-curve of expenditure, mobilisation advance, RA-bill cycle, retention %, and a payment-delay distribution (Gamma fitted to departmental norms or assumed 45–90 days). Simulate the contractor's cash position `A(m)` month by month starting from extracted opening liquidity and ongoing commitments; estimate `P(min_m A(m) < 0)` over a few thousand draws.

**Why:** it's dimensionally correct, sensitive to schedule and payment risk, produces a calibrated probability rather than an arbitrary ratio, and it's directly interpretable to a tender committee ("38% chance of cash shortfall around month 7"). It also makes the score *tender-specific* instead of a context-free number.

**Cost:** low compute, moderate domain research to get the parameters defensible.

### Improvement 4 — Window-dressing and manipulation detection

**What:** an explicit anomaly layer over the balance time series.

**How:** (a) end-of-window spike test — `z = (B̄_last_30d − median(B_prior)) / MAD(B_prior)`; (b) round-trip detection — match large credits to near-equal debits within a window *w* to the same counterparty; (c) cross-account transfer reconciliation via maximum-weight bipartite matching over (amount, date) pairs across the bidder's accounts, then deduplicate before aggregating; (d) Benford's-law deviation on transaction leading digits as a weak fabrication signal (be honest that it's weak at small *n*).

**Why:** this is the thing the project *claims* to do and currently doesn't do at all.

**Cost:** low-moderate. Hungarian matching is `scipy.optimize.linear_sum_assignment`.

### Improvement 5 — Abstention instead of low scores

**What:** a selective-prediction wrapper. If extraction confidence (ledger consistency rate, coverage, OCR confidence) falls below τ, output *abstain → route to human review*, not a low score.

**Why:** prevents the equity failure in 2.7 and is the correct behaviour for a consequential decision system. Report a risk–coverage curve and AURC.

**Cost:** low. Mostly discipline.

### Improvement 6 — Build an evaluation harness at all

**What:** two tiers — extraction metrics (field F1, numeric MAE, ledger consistency rate, CER on numeric spans) on a hand-labelled set of 50–100 statements plus a synthetic corpus with free ground truth; and decision metrics (Spearman correlation with expert ranking, detection AUC on injected manipulations, equity gap across bank-template strata, determinism variance across repeated runs, cost and latency per statement).

**Cost:** this is the largest time investment and the highest-return one.

---

## 4. Where genuine novelty could live

Being blunt about the honest categories:

**Not novel at all:** OCR+LLM extraction; ratio computation; "multi-agent" framing; using Pandas; adding a vision LLM.

**Incremental engineering:** text-layer routing, determinism, schema enforcement, PII redaction.

**Moderate novelty:**

- *Ledger-constrained parsing as joint extraction + error correction.* Constrained decoding exists; consistency checking in invoice processing exists; formulating bank-statement extraction as constrained combinatorial correction over an OCR lattice, and then showing it both reduces numeric error *and* yields a tamper signal from the residual distribution, is a defensible contribution. **What's new:** the constraint is used generatively (to fix the parse), not just diagnostically. **How to prove it:** ablation — accuracy with and without the constraint across degradation levels, plus ROC for tamper detection using unexplainable residuals.
- *Manipulation-aware, tender-conditioned solvency scoring.* Replacing a static ratio with a shortfall probability conditioned on the specific contract's payment schedule. The finance is textbook; the contribution is the formulation and the demonstration that it is materially harder to game.
- *An adversarial benchmark for financial document verification.* No public dataset exists. A parameterised synthetic generator (N bank templates × controllable degradation × controllable fraud injection: digit edits, page deletion, window dressing, circular transfers, template splicing) with a public release is a real, citable artefact. Benchmark papers get published.
- *Equity auditing of document-AI gatekeeping.* Measuring whether extraction quality induces score disparity across bank strata, and fixing it with abstention. Underexplored in this application domain.

**Potentially strong novelty:**

- *Cross-bidder graph reasoning.* Every existing system reads one bidder's documents in isolation. A tender has *many* bidders, and a procurement authority has *many* tenders. Build a graph over {bidders, accounts, counterparties, contracts}. Then you can detect what no per-document system can: the same funds circulating between "competing" bidders before the deadline (a strong collusion / front-company signal), committed-capacity overload from concurrent contracts, and shared counterparties indicating common control. **What's new:** treating solvency as a *relational*, portfolio-level property rather than a document-level one. **Why it matters:** cartel behaviour and shell bidding are the actual high-value frauds in public procurement, and they are invisible to the current design. **How to prove it:** synthetic collusion injection with known ground truth; measure detection AUC vs. per-document baselines and show the graph model catches cases no single-document method can, by construction.

---

## 5. Research gap summary

| Aspect | Status |
|---|---|
| Document OCR / KIE | Saturated. Commercial products exist. |
| Table structure recognition | Well-studied (PubTables-1M, TATR). |
| Ratio-based financial screening | Textbook, decades old. |
| Arithmetic-constrained document parsing | Sparse, mostly in invoice QA. **Gap.** |
| Tamper detection from ledger self-consistency | Little published. **Gap.** |
| Contractor liquidity risk from raw statements, contract-conditioned | Sparse. **Gap.** |
| Multi-bidder relational fraud signals from financial documents | Rare in open literature. **Strong gap.** |
| Fairness/equity of document-AI gatekeeping in procurement | Nearly unexplored. **Gap.** |
| Public benchmark for adversarial bank-statement verification | Does not exist. **Gap.** |

---

## 6. Alternative directions

**D1. Ledger-constrained extraction engine.** Beam search / MILP over OCR candidate lattice enforcing recurrence + page continuity. *Contribution:* joint extraction-and-correction with a built-in integrity signal. *Difficulty:* Moderate. *Resources:* CPU only. *Gain:* large accuracy improvement on degraded scans; removes hallucination. *Research value:* Moderate.

**D2. Synthetic adversarial benchmark + generator.** ReportLab/HTML templates for 8–12 bank layouts, degradation pipeline (blur, skew, JPEG, photocopy noise, stamps), fraud injectors. *Contribution:* the first open evaluation set for this task. *Difficulty:* Easy–Moderate (tedious, not hard). *Gain:* makes every other experiment measurable. *Research value:* Moderate but disproportionately high practical value.

**D3. Contract-conditioned cash-flow shortfall model.** Monte Carlo over payment-delay and S-curve. *Contribution:* replaces an arbitrary ratio with a calibrated risk probability. *Difficulty:* Moderate. *Research value:* Moderate.

**D4. Window-dressing detector.** Time-series anomaly + round-trip matching + cross-account transfer reconciliation. *Difficulty:* Moderate. *Research value:* Moderate.

**D5. Cross-bidder collusion graph.** GNN or, better, interpretable motif detection (cycles, shared counterparties, temporal co-movement) over the bidder–account–counterparty graph. *Difficulty:* Difficult / research-heavy. *Research value:* Strong. *Caveat:* entirely dependent on D2 for data.

**D6. Selective prediction + equity audit.** Abstention with calibrated confidence; disparity measured across document-quality strata. *Difficulty:* Easy–Moderate. *Research value:* Moderate.

**D7. Provenance-preserving audit trail.** Every number in the final report hyperlinked to a bounding box on the source page; deterministic re-execution; signed output. *Difficulty:* Easy. *Research value:* Low, deployment value high.

**D8. Cryptographic / metadata authenticity layer.** Verify PKCS#7 signatures, inspect PDF incremental-update history and producer metadata for evidence of editing, detect resaves. *Difficulty:* Easy–Moderate. *Research value:* Low–Moderate, but it is the only part of the system that can actually *prove* anything.

**D9. On-device VLM comparison.** Qwen2.5-VL / docTR / PaddleOCR locally vs. cloud API, quantifying the accuracy-vs-privacy-vs-cost frontier. *Difficulty:* Moderate (needs a GPU). *Research value:* Low–Moderate as an empirical study.

**D10. Account-to-account verification via consent layer.** In India, AA framework / bank APIs bypass documents entirely. *Difficulty:* Infeasible for a student project (institutional access), but worth one paragraph in the report as the correct long-run answer — it makes your document-based work honestly positioned as a fallback.

---

## 7. Prioritisation

| Idea | Technical impact | Novelty | Implementation difficulty | Compute cost | Research value |
|---|---|---|---|---|---|
| D1 Ledger-constrained extraction | High | Moderate | Moderate | Low | Moderate–High |
| D2 Adversarial benchmark | High (enabling) | Moderate | Easy–Moderate | Low | Moderate |
| D3 Cash-flow shortfall model | High | Moderate | Moderate | Low | Moderate |
| D4 Window-dressing detection | High | Moderate | Moderate | Low | Moderate |
| D5 Cross-bidder graph | Very high | Strong | Difficult | Low–Med | High |
| D6 Abstention + equity audit | Medium | Moderate | Easy–Moderate | Low | Moderate |
| D7 Provenance audit trail | Medium | Low | Easy | Low | Low |
| D8 PDF authenticity layer | Medium–High | Low–Moderate | Easy–Moderate | Low | Low–Moderate |
| D9 Local VLM study | Medium | Low | Moderate | High (GPU) | Low–Moderate |
| D10 Account aggregator | Very high | Low | Infeasible | — | Low (as research) |

Note that the top of this table is dominated by *cheap* ideas. Nothing here needs a GPU cluster. The expensive resource is your labelling and engineering time, which is why D2 comes early.

---

## 8. Recommended improved version

**Title:** *Audit-Grade Solvency Verification for Public Procurement: Ledger-Constrained Document Parsing with Manipulation-Aware, Contract-Conditioned Risk Scoring*

**Problem statement:** Given self-submitted, heterogeneous, potentially manipulated bank statements, produce a reproducible, provenance-traceable liquidity risk assessment for a specific tender — while detecting manipulation, quantifying its own uncertainty, and abstaining rather than penalising bidders when extraction is unreliable.

Note the honest reframing: *risk assessment*, not *proof*.

**Architecture:**

1. **Ingest & authenticity** — PDF type router (text-layer / scanned / hybrid); PKCS#7 signature verification; metadata and incremental-update inspection; hash + retention log.
2. **Extraction** — coordinate-anchored text or PaddleOCR with candidate lattice; LLM used only for header/column semantic mapping under a forced schema.
3. **Constrained reconciliation** — beam search over candidates enforcing the ledger recurrence and page continuity; output corrected table + per-row residual + confidence.
4. **Normalisation** — currency/locale parsing, account typing (savings vs OD vs CC), lien flags, multi-account transfer reconciliation via bipartite matching.
5. **Integrity analytics** — unexplainable residuals, window-dressing z-score, round-trip detection, Benford deviation → manipulation score.
6. **Risk scoring** — Monte Carlo cash-flow shortfall conditioned on the tender's schedule → `P(shortfall)`; combined with manipulation score into a two-dimensional output, not a single collapsed number.
7. **Decision layer** — abstain below confidence τ; emit an audit report where every figure links to its source bounding box.

**Models/algorithms:** PaddleOCR or docTR; beam search / MILP (PuLP or OR-Tools); Hungarian matching; Monte Carlo; robust z-scores with MAD; isotonic regression for score calibration; a small LLM for layout mapping only.

**Data:** 50–100 hand-labelled real statements (anonymised, consented, from classmates/family — be explicit about consent in the report) + a synthetic corpus of 2,000–5,000 statements across 8–12 templates with controllable degradation and injected fraud.

**Metrics:** numeric field MAE and exact-match rate; CER on numeric spans; ledger consistency rate; end-to-end score MAE and Spearman ρ vs. expert judgement; manipulation-detection ROC-AUC and AUPRC per fraud type; AURC for abstention; equity gap (max score disparity across template-quality strata); determinism (variance over 5 repeated runs — target exactly zero); cost and latency per statement.

**Baselines:** (1) pytesseract + regex; (2) *the original proposed pipeline* — this is important, you should beat your own starting point and show it; (3) Google Document AI or Azure Form Recognizer bank-statement parser; (4) end-to-end VLM extraction without constraints.

**Ablations:** ledger constraint on/off; page continuity on/off; multi-account dedup on/off; ratio score vs. shortfall simulation; abstention on/off; each integrity signal removed individually.

**What makes it meaningfully different:** the original reads a document and divides two numbers. This version treats the document as adversarial evidence, uses financial structure as a correction mechanism, produces a contract-specific calibrated risk rather than a context-free ratio, and is auditable and reproducible enough to survive a bid challenge.

---

## 9. Feasibility

**Easy:** D7 audit trail, D8 authenticity checks, text-layer routing, determinism fixes, PII redaction.
**Moderate:** D1, D2, D3, D4, D6 — all achievable in a semester with CPU only.
**Difficult:** D5 graph reasoning, D9 local VLM benchmarking (GPU-bound).
**Research-heavy:** D5 with learned components; calibration against real default outcomes (data doesn't exist at your scale).

**Realistically completable:** D1 + D2 + D3 + D4 + D6 + D7. That's a full, strong project.
**Risky:** D5 (data-starved; you'd be evaluating purely on synthetic collusion, which reviewers will discount). D9 (hardware).
**Impressive-sounding but low value:** bolting on a GNN "because graphs"; RL for anything here; fine-tuning LayoutLM when the text layer already exists; calling the pipeline "multi-agent"; any claim of "mathematically proving" solvency.

---

## Three project versions

**Safe version.** Keep the OCR→structure→score shape. Add text-layer routing, schema-forced LLM restricted to layout, ledger-consistency *checking* (not correction), multi-account dedup, time-weighted and minimum balance in place of the naive mean, abstention, provenance trail, and a proper evaluation harness with a 100-statement labelled set. *Risk: low. Novelty: none. Quality of engineering: high. This alone fixes the plan's real defects.*

**Advanced version.** Safe + ledger-*constrained* correction over an OCR candidate lattice (D1) + the synthetic adversarial benchmark with injected fraud (D2) + window-dressing detection (D4) + contract-conditioned shortfall simulation (D3), with full ablations. *Risk: moderate. This is a workshop-paper-shaped project and is what I'd actually recommend.*

**Research version.** Advanced + cross-bidder graph reasoning over the tender population for collusion and committed-capacity overload (D5), with the equity audit (D6) as a secondary contribution. *Risk: high, because the graph layer can only be evaluated on synthetic collusion. If you attempt it, hedge by making D1–D4 the defensible core and D5 the exploratory chapter.*

**The single most important change, if you only make one:** stop calling it proof and start measuring something. Right now the project has no way of knowing whether it works.

# Human — Sep 17, 2026, 9:38 AM

list out all the additional features that can be added which are aligned with the original idea

# Claude — Sep 17, 2026, 9:38 AM

## Additional Features Aligned with the Original Idea

The original idea is: **extract financial data from bank statement documents and produce a solvency/liquidity score for procurement bidder evaluation.**

Everything below stays within that scope — no graph databases, no multi-tenant systems, no scope creep into procurement policy. Roughly ordered from easiest to hardest.

---

### Extraction & Parsing Layer

1. **Text-layer router** — detect whether a PDF has an embedded text layer before rasterising; use `pdfplumber` for digital PDFs and OCR only for true scans
2. **Multi-page continuity check** — verify that the closing balance of page *n* equals the opening balance of page *n+1*
3. **Ledger recurrence constraint** — enforce `B_t = B_{t-1} + C_t - D_t` row-by-row; flag rows that violate it
4. **OCR candidate lattice** — generate top-k candidates per numeric cell using character-level OCR confidence scores instead of taking the top-1 greedily
5. **Indian number format handler** — explicit parser for lakh grouping (`1,23,456`), `Cr`/`Dr` suffixes, `₹`/`Rs.` variants, and regional date formats (`DD-MMM-YY`, etc.)
6. **Stamp and watermark masking** — detect and mask bank stamps/watermarks before OCR to reduce character errors beneath them
7. **Multi-column table segmentation** — use bounding-box layout analysis (DocTR, PaddleOCR layout) to correctly separate date, narration, debit, credit, balance columns before OCR, instead of reading left-to-right across all columns
8. **Schema-forced LLM output** — replace free-form JSON generation with a strict Pydantic/JSON schema that the LLM must conform to; reject and retry on parse failure
9. **LLM restricted to layout only** — use the LLM only to identify which column is debit/credit/balance from a header sample, not to transcribe numbers
10. **Confidence score per extracted cell** — propagate OCR confidence into the output so downstream components know which figures are uncertain
11. **Multi-statement ingestion** — accept and reconcile multiple bank statements for the same entity (e.g., current account + savings account + OD account)
12. **Statement period detection** — automatically extract the statement's start and end dates and validate they cover the required window

---

### Data Cleaning & Normalisation

13. **Currency normalisation** — convert all amounts to a single base currency with explicit conversion dates if forex statements are submitted
14. **Account type classifier** — distinguish savings, current, overdraft, cash-credit, and FD accounts; apply different treatment rules for each
15. **Lien and hold amount exclusion** — parse lien/hold notations in narration text and subtract them from the usable balance
16. **Round-trip transfer reconciliation** — match large credits to near-equal debits within a short time window to the same counterparty, and flag or net them out
17. **Intra-entity transfer deduplication** — when multiple accounts are submitted, detect transfers between the bidder's own accounts and avoid double-counting the balance
18. **Narration keyword classifier** — classify each transaction as salary, contractor payment, loan EMI, GST, etc., to give qualitative context alongside the numbers
19. **Anomalous transaction tagger** — flag transactions that are unusually large relative to the account's history (e.g., > 3σ from the mean transaction size)

---

### Financial Metrics

20. **Time-weighted average balance** — weight each balance by the number of days it was held instead of averaging by transaction count
21. **Minimum balance over the window** — report the lowest balance reached in the period, not just the average; this is the binding liquidity constraint
22. **Balance volatility (coefficient of variation)** — measure how stable the balance is; a wildly volatile account with a high mean is riskier than a stable lower-balance account
23. **Net cash flow trend** — linear regression slope of the balance over the period to detect whether the entity is accumulating or depleting cash
24. **Liquidity coverage period** — how many months the average balance would sustain estimated monthly burn; a more interpretable output than a 0–1 ratio
25. **Debt service detection** — identify regular EMI-style outflows and estimate the existing debt-service burden
26. **Average monthly credit inflow** — total inflows / number of months; a measure of revenue capacity independent of the balance
27. **Operating expense estimate** — total debits minus identified loan/transfer payments, as a proxy for monthly burn
28. **Working capital surplus** — `avg_balance − estimated_monthly_operating_expense`, giving a residual-capacity figure

---

### Integrity & Manipulation Detection

29. **Window-dressing spike detector** — compare balance in the last 30 days of the window to the prior median; flag if the z-score is above a threshold
30. **Benford's law deviation** — check whether leading digits of transaction amounts follow Benford's distribution; deviations are a weak fabrication signal (be explicit about low sensitivity at small *n*)
31. **Round-number clustering** — detect whether an unusual proportion of transaction amounts are round numbers (e.g., exactly ₹5,00,000), which is uncommon in genuine trade flows
32. **Page deletion detector** — check for non-contiguous statement dates or unexplained jumps in balance that suggest pages were removed
33. **Balance continuity gap flag** — flag any date gap in the statement longer than 7 days that isn't a weekend/public holiday
34. **PDF metadata inspection** — extract producer, creation date, and modification date from PDF metadata; flag if modification date is after creation date or if the producer is an unusual tool
35. **PKCS#7 / digital signature verification** — check whether the PDF carries a bank-issued digital signature and whether it is valid
36. **Template consistency check** — verify that the font, layout, and header format are consistent across pages of the same statement

---

### Scoring & Risk Model

37. **Multi-metric composite score** — replace the single ratio with a weighted combination of minimum balance, time-weighted average, volatility, trend, and debt burden
38. **Score calibration** — apply isotonic regression or Platt scaling to map raw scores to well-calibrated probabilities (requires a small labelled set)
39. **Tender-specific normalisation** — scale the score relative to the specific tender's estimated value and payment terms rather than using EMD as the denominator
40. **Score component breakdown** — report how much each sub-metric contributed to the final score, so the output is interpretable
41. **Historical score trend** — if the same bidder has submitted in a prior tender, compare current scores to prior submissions and flag significant drops
42. **Peer comparison percentile** — rank the bidder's score within the distribution of all bidders who submitted for the same tender

---

### Uncertainty & Abstention

43. **Extraction confidence gate** — if ledger consistency rate or OCR confidence falls below a threshold, output "insufficient confidence → route to manual review" instead of a low score
44. **Score confidence interval** — report an uncertainty range around the score using bootstrap resampling of the parsed transaction table
45. **Abstention audit trail** — when the system abstains, record exactly which confidence gate triggered and what the thresholds were

---

### Output & Audit Trail

46. **Source-linked report** — every figure in the output report hyperlinks back to the exact bounding box on the source PDF page
47. **Deterministic re-execution** — given the same input PDF, the system must produce bit-identical output; log the seed and all non-deterministic steps
48. **Diff report for resubmission** — if a bidder resubmits, produce a structured diff of what changed between the two parsed statements
49. **Machine-readable audit log** — JSON log of every extraction decision, confidence score, constraint check, and flag raised, for downstream audit
50. **Human-readable summary card** — a one-page plain-language summary (date range, average balance, flags raised, final score, confidence) for the tender committee
51. **PII redaction before LLM call** — mask account numbers, IFSC codes, and counterparty names before sending any text to an external API
52. **Signed output hash** — hash and sign the final report so that the output cannot be tampered with after generation

---

### Evaluation & Testing

53. **Synthetic statement generator** — parameterised generator that produces realistic bank statements with known ground truth, for testing without real PII
54. **Degradation simulator** — apply controlled blur, skew, JPEG compression, stamp overlay, and photocopy noise to test OCR robustness
55. **Fraud injection suite** — programmatically inject digit edits, page deletions, window-dressing spikes, and round-trip transfers into synthetic statements to benchmark detection
56. **Template coverage test** — validate that the pipeline handles statements from at least 5–6 different bank formats (SBI, HDFC, ICICI, Canara, PNB, cooperative bank) before deployment
57. **Equity gap measurement** — measure whether extraction accuracy and final scores differ systematically across bank types; report the disparity

---

### Quick Reference by Effort

| Effort | Features |
|---|---|
| **Easy** (hours) | 1, 2, 5, 8, 9, 12, 23, 34, 43, 45, 47, 51 |
| **Moderate** (days) | 3, 4, 7, 11, 13, 14, 15, 16, 17, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 37, 38, 39, 40, 44, 46, 48, 49, 50, 52, 53 |
| **Harder** (weeks) | 6, 10, 18, 19, 36, 41, 42, 54, 55, 56, 57 |

All 57 features stay within the original scope: read a bank statement, understand the numbers, score the bidder's financial health. None require external data feeds, organisational integrations, or going beyond what a single module in a student project can plausibly own.

# Human — Sep 17, 2026, 10:53 AM

can you give something similar to this
📅 7th Semester Goal (The Core Foundation)
Module 1 (NLP Copilot): Done. (This proves your architecture works).
Module 2 (Matchmaker & Consortium): To be built next.
Why this is enough for 7th Sem: By finishing Module 1 and 2, you have successfully built a complete, end-to-end "Discovery and Verification" engine. MSMEs can find tenders and legally verify their eligibility. This is a massive milestone for a 7th-semester review.
📅 8th Semester Goal (The Advanced AI Integration)
Module 3 (Generative Auto-Bidder): Generative AI integration.
Module 4 (CV Progress Auditor): Computer Vision integration.
Why this works for 8th Sem: These modules deal with completely different AI domains (GenAI and CV). Pushing them to the 8th semester gives you the time to properly research and train those specific models, leading up to a spectacular final presentation before graduation.

indha mari u plan and send for me ur part after the detailed reseach

# Claude — Sep 17, 2026, 10:53 AM

# 📅 Agent 3: FinTech Solvency Verifier — Semester Roadmap

---

## 📅 7th Semester Goal (The Solid, Defensible Foundation)

**Phase 1 (Core Pipeline) → Phase 2 (Integrity Layer)**

---

### ✅ Phase 1 — Core Extraction & Scoring Engine
> *Get the pipeline working end-to-end with correct financial logic*

| # | Feature | What it does |
|---|---|---|
| 1 | Text-layer router | Uses `pdfplumber` for digital PDFs, OCR only for scanned ones |
| 2 | Indian number format handler | Handles `1,23,456`, `Cr`/`Dr`, `₹`/`Rs.`, regional dates |
| 3 | Multi-column table segmentation | Correctly separates Date / Narration / Debit / Credit / Balance columns |
| 4 | Schema-forced LLM (layout only) | LLM maps column headers only — never touches numbers |
| 5 | Multi-page continuity check | Closing balance of page *n* = Opening balance of page *n+1* |
| 6 | Time-weighted average balance | Weights balance by days held, not by transaction count |
| 7 | Minimum balance over window | The true binding liquidity constraint |
| 8 | Net cash flow trend | Linear regression slope — is the bidder accumulating or burning cash? |
| 9 | Multi-metric composite score | Combines minimum balance + weighted average + trend into one score |
| 10 | Human-readable summary card | One-page plain-language output for the tender committee |

**Why Phase 1 is enough to demonstrate:** You have replaced the original broken pipeline (average ÷ EMD) with a mathematically correct, professionally structured extraction and scoring engine. Every number is traceable. The score is interpretable.

---

### ✅ Phase 2 — Integrity & Audit Layer
> *Make the system trustworthy, not just functional*

| # | Feature | What it does |
|---|---|---|
| 11 | Ledger recurrence constraint | Enforces `B_t = B_{t-1} + C_t − D_t` row-by-row; flags violations |
| 12 | Intra-entity transfer dedup | Detects money moved between the bidder's own accounts; removes double-counting |
| 13 | Window-dressing spike detector | Flags abnormal balance spikes in the last 30 days of the statement window |
| 14 | Page deletion detector | Flags date gaps or unexplained balance jumps suggesting removed pages |
| 15 | PDF metadata inspection | Checks if the PDF was modified after creation — a basic forgery signal |
| 16 | PII redaction before LLM call | Masks account numbers, IFSC, counterparty names before any API call |
| 17 | Deterministic re-execution | Same PDF → identical output every time; zero randomness in the score |
| 18 | Machine-readable audit log | Every extraction decision, flag, and confidence value logged as JSON |

**Why Phase 1 + Phase 2 is the right 7th Sem milestone:**
You have built a complete, end-to-end **"Extract → Score → Verify"** engine. The system reads any Indian bank statement, produces a financially correct solvency score, and actively checks whether the document has been tampered with. This is not a demo — it is a defensible, auditable pipeline. A 7th-semester reviewer will see a system that does something real and does it responsibly.

---

## 📅 8th Semester Goal (The Advanced AI Integration)

**Phase 3 (Adversarial Robustness) → Phase 4 (Risk Intelligence)**

---

### 🔬 Phase 3 — Adversarial Robustness & Evaluation
> *Prove the system works under attack and across document types*

| # | Feature | What it does |
|---|---|---|
| 19 | Synthetic statement generator | Generates realistic bank statements with known ground truth — no real PII needed |
| 20 | Degradation simulator | Applies blur, skew, JPEG noise, stamps to test OCR robustness |
| 21 | Fraud injection suite | Programmatically injects digit edits, window-dressing, page deletions to benchmark detection |
| 22 | OCR candidate lattice | Generates top-k OCR candidates per cell using character-level confidence scores |
| 23 | Ledger-constrained correction | Beam search over OCR candidates enforcing the ledger recurrence — fixes digit errors automatically |
| 24 | Template coverage test | Validates the pipeline across SBI, HDFC, ICICI, Canara, PNB, cooperative bank formats |
| 25 | Equity gap measurement | Checks whether score accuracy differs across bank types — detects systemic bias |
| 26 | Extraction confidence gate | If confidence < threshold → abstain and route to human review instead of scoring low |

---

### 🔬 Phase 4 — Contract-Conditioned Risk Intelligence
> *Move from document-level reading to contract-level risk reasoning*

| # | Feature | What it does |
|---|---|---|
| 27 | Account type classifier | Distinguishes savings / current / OD / CC / FD — different rules for each |
| 28 | Debt service detection | Identifies EMI-style outflows and estimates existing debt burden |
| 29 | Working capital surplus | `avg_balance − estimated_monthly_opex` — residual capacity after existing commitments |
| 30 | Tender-specific normalisation | Scales score against the tender's estimated value and payment terms, not just EMD |
| 31 | Score calibration | Isotonic regression maps raw scores to calibrated probabilities |
| 32 | Score confidence interval | Bootstrap resampling over the parsed table gives an uncertainty range |
| 33 | Peer comparison percentile | Ranks the bidder within the score distribution of all bidders for the same tender |
| 34 | Source-linked audit report | Every figure in the final report links back to its exact bounding box on the source PDF |

**Why Phase 3 + Phase 4 is the right 8th Sem finale:**
Phase 3 proves your system is *robust* — you can show it breaking and recovering under adversarial conditions, with numbers. Phase 4 proves your system is *intelligent* — the score now reflects the specific contract the bidder is applying for, calibrated probabilities, and a ranked comparison against other bidders. Together, this is no longer a student project. It is a research-grade financial document intelligence system built for real Indian public procurement.

---

## 🗺️ Full Picture at a Glance

```
7th Semester                          8th Semester
─────────────────────────────────     ──────────────────────────────────
Phase 1: Core Pipeline                Phase 3: Adversarial Robustness
  Extract → Score → Output              Synthetic data → Attack → Defend

Phase 2: Integrity Layer              Phase 4: Risk Intelligence
  Constrain → Flag → Audit              Contract-conditioned → Calibrated
                                        → Ranked → Source-linked report
─────────────────────────────────     ──────────────────────────────────
MILESTONE: End-to-end working         MILESTONE: Research-grade, robust,
pipeline with tamper detection        explainable solvency verifier
```

---

## 🎯 What Each Semester Proves to a Reviewer

| Semester | Claim you can make | Evidence |
|---|---|---|
| **7th** | "We built a financially correct, auditable solvency engine that detects document tampering" | Working pipeline on real PDFs with logged audit trail and deterministic output |
| **8th** | "We proved the system is robust under adversarial conditions and produces contract-specific calibrated risk scores" | Benchmark numbers across degradation levels, fraud detection AUC, calibration curves, per-tender ranked output |

# Human — Sep 19, 2026, 2:27 AM

from the first response at the top, give the limitations found as a concise pointwise information

# Claude — Sep 19, 2026, 2:28 AM

## Limitations of the Original Project

### 🔴 Threat Model & Security
- The pipeline assumes submitted documents are authentic — a forged PDF passes OCR **perfectly**
- The scoring formula is publicly gameable: borrow money, park it for 6 months, return it after scoring (window dressing)
- Publishing a fixed formula creates an adaptive adversary — Goodhart's Law with money

### 🟠 OCR & Extraction
- Most bank statements are digital-born PDFs with an intact text layer — rasterising them and running Tesseract **deliberately destroys** exact information
- Tesseract flattens multi-column tables, interleaving credits, debits, and balances into scrambled text
- Indian number formatting (`1,23,456`, `Cr`/`Dr`, `₹`/`Rs.`) is not handled
- Common OCR confusions (`1↔7`, `3↔8`, `5↔6`, `0↔8`, `.↔,`) silently produce order-of-magnitude errors in financial figures
- Digitally signed PDFs carry a verifiable authenticity signal that is thrown away by converting to pixels

### 🟠 LLM as Numeric Parser
- LLMs hallucinate digits **silently** — no error signal, no confidence, no provenance
- Non-deterministic: the same statement can produce different JSON on two runs
- Administrative decisions must be reproducible and auditable — "the model said so, differently each time" cannot survive a bid challenge
- Sends unredacted financial PII of third parties to an external API — data residency and consent issues
- Cost and latency scale per page, per statement, per bidder

### 🔴 Financial Formulation
- `avg_balance / required_emd` is a **category error** — EMD is a bid security deposit, not a measure of capacity to finish a project
- Averaging the balance column averages over transactions, not days — an account with 400 transactions on one high-balance day is massively overweighted
- The mean hides the binding constraint — a bidder at ₹0 for 170 days with one-day spike beats a steadily solvent firm
- Overdraft and credit-limit-supported balances are not distinguished from real cash
- Lien-marked FDs and margin money are counted as available funds when they are not
- Multiple accounts are double-counted — move ₹1 crore in a circle across three statements and apparent liquidity triples
- Contingent commitments from existing live contracts are completely invisible
- The 0–1 score is uncalibrated — 0.7 means nothing without an anchor to real outcomes

### 🟡 Evaluation
- No ground truth, no metric, no baseline, no definition of success anywhere in the plan
- No way of knowing whether the system works at all

### 🟡 Dataset
- Real bank statements are PII and effectively uncollectable at student scale
- No public benchmark exists for bank statements with solvency labels

### 🟡 Bias & Equity
- Large private banks emit clean digital PDFs; cooperative and rural banks emit photocopied, vernacular statements
- Parsing failure on poor-quality documents lowers the score — **document quality becomes a proxy for bidder size and region**
- A system that systematically disadvantages small and rural contractors in public procurement is a legal and ethical problem
- Nothing in the plan detects or measures this disparity

### 🟢 Unnecessary Complexity / Misused Components
- Pandas used for what is essentially a list of dictionaries
- "Agent" framing applied to a linear, non-agentic pipeline
- LLM used for numeric transcription when deterministic parsing would be safer, cheaper, and auditable

