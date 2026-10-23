# Model card — Agent 4 behavioral anomaly model

Model version `<!--m:model_version str-->2.0.0+4f20da5f<!--/m-->`. Numbers in this card are generated from `reports/metrics.json` (a test fails if they drift).

## 1. What the model is for

**Intended use.** Produce an advisory risk signal about whether the *timing* of a bid-form session resembles genuine human typing, so that reviewers can prioritise sessions for inspection. The signal goes to the platform's audit trail.

**Not intended for.** Blocking bids automatically; accusing anyone of fraud; identifying people (it is not a biometric identification system and holds no per-person template); judging content (it never sees content); use on data it was not calibrated for (other languages, devices or form types) without recalibration.

## 2. How it works

1. **Features (30 for the full model, 15 for flight-only).** Per session: the distribution of key hold times and of gaps between keys (centre, spread, shape of the log-time distribution, percentiles), the share of very short and very long gaps, the share of hesitation pauses (≥ 400 ms), lag-1 autocorrelation of gaps, and typing speed. **No feature depends on how many keystrokes the session has** (no counts, totals, minima or maxima). The first interval (onset latency) is ignored and idle gaps are capped at 2 s, so reading the form or switching tabs cannot distort the statistics.
2. **Detector.** A Gaussian mixture over standardised, log-transformed features, **fitted only on genuine-human sessions**. The anomaly score is the negative log-likelihood. It never sees a bot during training or calibration.
3. **Length-aware calibration.** The score distribution of held-out genuine humans is estimated as a smooth function of session length. This makes the false-alarm rate roughly constant across lengths (a single global threshold would be too strict for short sessions and far too lax for long ones).
4. **Risk scale.** Piecewise-linear through the human score quantiles at each length: 1st percentile → 0, median → 25, **95th → 50**, **99th → 75**, asymptotically 100 above that. A score of 50 means "more atypical than 95% of genuine humans of similar length".
5. **Evidence.** The features furthest from the nearest typical-human mixture component are reported, with plain-language descriptors. These describe observed timing properties; they are not a causal explanation of the model.

**Why a mixture density and not an Isolation Forest.** Version 1 used an Isolation Forest. On a separate development dataset it caught the adaptive bot in <!--m:model_selection.full.isolation_forest_result.detection_rate.ADAPTIVE_AUTOMATION pct0-->5%<!--/m--> of sessions against <!--m:model_selection.full.selected_result.detection_rate.ADAPTIVE_AUTOMATION pct0-->56%<!--/m--> for the selected mixture model, because a bot that differs from humans mainly in the *shape* of its timing distribution is not extreme in many features at once. The comparison of all candidates is in `reports/evaluation_report.md` §6. The selection was made on development data (a different random seed) and never on the test data reported here.

## 3. Training data

Entirely **synthetic**, produced by `agent4/simulation.py` (seed <!--m:dataset.seed int-->42<!--/m-->, <!--m:dataset.total_sessions int-->39,000<!--/m--> sessions). Real bidder keystroke biometrics could not be collected without consent, and real bot attacks are rare and unlabelled.

| Class | Role | What it simulates |
|---|---|---|
| Typical human, fast human, slow human | normal (train / calibrate / test) | Log-normal timing, cognitive pauses, rare long idle gaps, per-session speed variation |
| Regular script | attack (test only) | Fixed cadence, minimal variance |
| Burst injection | attack (test only) | Rapid clusters separated by programmatic gaps |
| Adaptive bot | attack (test only) | Flat random delays imitating the human range, injected pauses |
| Mimic bot | stress test (reported separately) | Copies the human mean, spread and pause rate with symmetric noise |

Sessions are 10–300 keystrokes (log-uniform, so short and long are both common). Genuine-human sessions are split 60% train / 25% calibration / 15% test, by session.

## 4. Evaluation (held-out)

| Measure (full model) | Result |
|---|---|
| Genuine humans flagged (risk ≥ 50), test split | <!--m:full.human_test.overall.rate pct1-->4.6%<!--/m--> (95% CI <!--m:full.human_test.overall.ci95.0 pct1-->3.8%<!--/m-->–<!--m:full.human_test.overall.ci95.1 pct1-->5.4%<!--/m-->) |
| Genuine humans in the HIGH band (risk ≥ 75) | <!--m:full.human_test.high_anomaly_rate.rate pct1-->1.0%<!--/m--> |
| Regular script / burst injection detected | <!--m:full.attacks.REGULAR_AUTOMATION.overall.rate pct0-->100%<!--/m--> / <!--m:full.attacks.BURST_AUTOMATION.overall.rate pct0-->100%<!--/m--> |
| Adaptive bot detected, 10–19 / 50–99 / 200+ keystrokes | <!--m:full.attacks.ADAPTIVE_AUTOMATION.by_length.10-19.rate pct0-->13%<!--/m--> / <!--m:full.attacks.ADAPTIVE_AUTOMATION.by_length.50-99.rate pct0-->68%<!--/m--> / <!--m:full.attacks.ADAPTIVE_AUTOMATION.by_length.200-300.rate pct0-->98%<!--/m--> |
| Mimic bot detected (stress test), overall | <!--m:full.attacks.MIMIC_BOT.overall.rate pct0-->45%<!--/m--> |
| ROC-AUC, humans vs. core attacks | <!--m:full.summary.roc_auc_core_attacks_vs_human f3-->0.958<!--/m--> |

The human false-alarm rate is an **out-of-sample** estimate: the threshold was calibrated on a different split from the one used to measure it. The flight-only fallback detects <!--m:flight_only.attacks.REGULAR_AUTOMATION.overall.rate pct0-->100%<!--/m--> of regular scripts and <!--m:flight_only.attacks.BURST_AUTOMATION.overall.rate pct0-->100%<!--/m--> of bursts but only <!--m:flight_only.attacks.ADAPTIVE_AUTOMATION.overall.rate pct0-->2%<!--/m--> of adaptive bots (without hold times they are indistinguishable at this feature level).

## 5. Known limitations and failure modes

* **Synthetic data.** All numbers describe the simulated world. Real keyboards, browsers (timer resolution), languages, field types (numeric amount vs. free text), and real attackers will differ. Validate on real data before relying on any figure.
* **A genuine style missing from training is flagged.** With one human style withheld, <!--m:leave_one_style_out.HUMAN_LIKE.held_out_style_flagged.rate pct0-->51%<!--/m-->, <!--m:leave_one_style_out.FAST_HUMAN_LIKE.held_out_style_flagged.rate pct0-->79%<!--/m--> and <!--m:leave_one_style_out.SLOW_HUMAN_LIKE.held_out_style_flagged.rate pct0-->81%<!--/m--> of that style's sessions were flagged (withholding the typical, fast and slow style respectively). The training population must cover the real users.
* **Short sessions carry little evidence.** Sophisticated bots are mostly missed below ~30 keystrokes. The false-alarm rate on genuine humans also runs a little above target at 10–19 keystrokes (<!--m:full.human_test.by_length.10-19.rate pct1-->7.5%<!--/m-->).
* **Mimic and replay.** A bot that copies human statistics is only partly detected; a replay of recorded human timing would pass. These need sequence-level or non-timing signals.
* **Base rates.** When automation is rare, most flags are false alarms; see the precision table in the evaluation report.

## 6. Ethical and fairness considerations

* **Accessibility.** People using assistive technology (switch devices, eye-trackers, voice typing, on-screen keyboards), people with motor impairments, and people on slow remote desktops produce timing unlike the training population. The model was not evaluated on them. This is the main reason the output is advisory and must never trigger automatic rejection; offer an alternative verification path for flagged sessions.
* **Privacy.** No content, key identity or personal data is used. See `docs/privacy_and_security.md`.
* **Transparency.** Every score ships with evidence and a reliability level so reviewers can see *why*, and the model version is recorded for audit.
* **Drift.** If typical bidder behaviour changes (new device mix, a new form), the false-alarm rate will drift from 5%. Monitor it (see the deployment guide) and recalibrate.

## 7. Maintenance

* **Reproduce:** `python -m agent4 all` regenerates data, model selection, model, evaluation, figures and reports from the seed.
* **Retrain on real data:** `python -m agent4 retrain --events real_sessions.csv.gz` (timing-only CSV of genuine sessions; see the deployment guide).
* **Integrity:** `python -m agent4 verify` checks the model files against `models/manifest.json` (SHA-256). The service refuses to start on a mismatch.
* **Versioning:** `model_version` = package version + the first 8 hex characters of the combined bundle hash; it is returned in every response.
