# Limitations and roadmap

## 1. What this system cannot do (today)

1. **It has never seen real data.** Everything — training, calibration, evaluation — uses synthetic sessions from one generator. The *relative* findings (length dependence, value of shape features, need for population-representative training) should transfer; absolute rates will not. **Validate on real keystroke data before quoting any number to stakeholders as a real-world result.**
2. **It only knows the typing styles it was trained on.** A genuine style outside the training population is flagged (leave-one-style-out results in the evaluation report and model card). This is the single most important thing to fix with real data (`python -m agent4 retrain`).
3. **Short sessions carry little evidence.** Subtle bots are mostly missed under ~30 keystrokes; the response says so through `reliability`.
4. **Bots that copy human statistics are only partly detected** (the mimic stress test), and **a replay of recorded human timing is not detected at all**.
5. **Flight-only mode is weak** on subtle bots (it cannot see hold-time shape).
6. **It cannot see content or field type.** Typing a currency amount on a numeric keypad has different timing from free text; not modelled.
7. **Hardware and browser effects are not modelled**: keyboard type, polling jitter, browser timer-resolution reduction (some privacy modes coarsen `performance.now()`), remote desktop latency, assistive devices.
8. **Population fairness has not been assessed.** Users with motor impairments or assistive technology may look atypical (see the model card). The signal must never trigger automatic rejection.
9. **Detecting "value set without typing"** (a script sets `element.value`) is outside Agent 4's data, but it is one of the strongest bot signals available. See the roadmap.
10. **The Docker image was not built here** (no Docker in the development environment); the service itself was run and tested as a real process.

## 2. Recommended next steps, in order

| # | Step | Why | How |
|---|---|---|---|
| 1 | **Validate on real keystroke data** | Replace "works in simulation" with evidence | Use a public keystroke-dynamics dataset (for example the CMU or Buffalo benchmark datasets, subject to their licences) as *genuine-human* data: run the false-alarm rate on it, and compare its feature distributions with the simulator's. Adapt the loader to the `retrain` CSV format. |
| 2 | **Pilot and retrain on the platform's genuine bidders** | Make "normal" mean *your* users | `python -m agent4 retrain` (deployment guide §2); check the held-out flag rate is ≈ 5%. |
| 3 | **Add the "content without keystrokes" signal** | Catches `value = …` injection and distinguishes it from paste/autofill | In the browser collector, record only *booleans/counters* (e.g. field length bucket vs. keystroke count, `isTrusted` of events, presence of `paste`/`input` events without key events). Send them as extra numeric fields and combine at the platform level or add a rule layer. This needs a privacy review (it must still not capture content). |
| 4 | **Monitoring and drift alerts** | Detect attack waves and population change | Dashboard on the flag rate, `insufficient_data` share and latency (deployment guide §6). |
| 5 | **Per-field-type models** | Numeric amounts vs. free text differ | Train separate bundles keyed by field type; the collector already can tag fields (`fieldFilter`). |
| 6 | **Sequence models for replay / mimic** | Marginal statistics cannot catch these | A small recurrent or convolutional model over the interval sequence, trained on human sequences only (autoencoder or one-class), evaluated against replayed recordings. Keep the same API and risk scale. |
| 7 | **Fairness evaluation** | Know who is wrongly flagged | With consent, collect assistive-technology and varied-device sessions and measure false-alarm rates per group; add an accessibility-aware review path. |
| 8 | **Load-test the deployed path** | The in-process numbers exclude network/TLS | Measure through the real gateway at expected peak. |

## 3. What would change my confidence

* False-alarm rate on real genuine sessions close to 5% after retraining → the architecture transfers.
* Far higher → the population is more varied than three styles; increase the mixture size and use more data, or add per-field-type models.
* Adaptive-style detection on real bots far lower than in simulation → expected; weight other signals more and pursue roadmap items 3 and 6.
