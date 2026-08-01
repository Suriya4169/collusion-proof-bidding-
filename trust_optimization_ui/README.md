# Trust Optimization UI Dashboard

An interactive, responsive verification web interface for the **Dynamic Bayesian Multi-Agent Trust Optimization System**. This dashboard allows visual inspection and validation of bidder scoring formulas, constraint checking, and real-time trust updates.

## Visual Design Features

* **Glassmorphic UI Panels**: Translucent container panels using dark-blue/indigo gradient tones and modern typography (`Outfit` and `Plus Jakarta Sans`).
* **Real-time Parametric Recalculation**: Adjust criteria weights and minimum thresholds using sliders. The ranking table updates instantly as soon as sliders move.
* **Proportional Weight Allocator**: Modifying a weight automatically scales the other sliders proportionally so that their sum remains exactly $1.0$.
* **Step-by-Step Mathematical Inspector**: Click on any bidder row to slide out a calculation inspector panel showing the exact numerical substitution for every agent score, Bayesian fusion weight, and constraints evaluation.
* **Dynamic Trust Simulator**: In the drawer panel, you can click "Success" or "Failure" to log simulated project outcomes, modifying the bidder's history and recalculating the rankings in real-time.

---

## Launching the UI Dashboard

To view the dashboard, run the local Python server launcher script:

```bash
python run_ui_server.py
```

This will automatically spin up a lightweight web server at `http://localhost:8000` and launch it in your default web browser.

Alternatively, because the app is a pure, self-contained HTML/JS/CSS single-page application, you can simply open `index.html` directly in any modern web browser!

---

## Verification of Key Mathematical Claims

Through this UI, you can interactively verify the four default edge cases included in the dataset:

1. **`B_brand_new`** (Unrated performance):
   * Select `B_brand_new` from the table.
   * Observe the **Performance Score** is exactly `0.5000` under uniform priors ($\alpha=\beta=1.0$).
   * Because it has zero projects and cases, its performance and legal confidences are `0.0`, resulting in a **Fused Trust** of `0.3087` (the average of price, financial, and technical scores).
2. **`B_legal_test`** (Litigation cases):
   * Select `B_legal_test` from the table.
   * Verify the **Legal Score** is exactly `0.4966`, representing the mathematical result of $e^{-(2 \times 0.2 + 1 \times 0.3)} = e^{-0.7}$.
3. **`B_cheap_but_weak`** (Low-cost check):
   * Note that `B_cheap_but_weak` has the highest **Price Score** (`1.0000`) but is **Excluded** because its Financial Score (`0.0000`) and Technical Score (`0.0351`) fail the minimum threshold constraints.
4. **`B_fails_threshold`** (Threshold exclusion check):
   * Observe that `B_fails_threshold` is **Excluded** despite having excellent financial (`1.0000`) and technical (`0.8828`) scores because its Performance Score (`0.1111`) fails the minimum threshold of `0.40`.
