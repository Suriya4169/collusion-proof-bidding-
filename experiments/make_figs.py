import json, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams.update({"font.size": 10, "font.family": "serif"})
# Fig 1: adaptive-bot detection by session length (values from the biometrics evaluation report)
bands = ["10-19", "30-49", "100-199", "200-300"]; vals = [13, 40, 92, 98]
fig, ax = plt.subplots(figsize=(5.2, 3.0))
b = ax.bar(bands, vals, color="#4a6fa5", width=0.55)
for r, v in zip(b, vals): ax.text(r.get_x() + r.get_width()/2, v + 1.5, f"{v}%", ha="center", fontsize=9)
ax.set_ylim(0, 110); ax.set_xlabel("Keystrokes per session"); ax.set_ylabel("Adaptive bots flagged (%)")
ax.spines[["top", "right"]].set_visible(False)
fig.tight_layout(); fig.savefig("images/fig_bio_length.pdf"); plt.close(fig)
# Fig 2: cap sweep
d = json.load(open("experiments/cap_sweep.json"))
caps = sorted(int(k) for k in d); eng = [d[str(c)]["engine_false_pairs"] for c in caps]
naive = d[str(caps[0])]["naive_false_pairs"]
fig, ax = plt.subplots(figsize=(5.2, 3.0))
ax.plot(caps, eng, marker="o", color="#4a6fa5", label="Engine")
ax.axhline(naive, ls="--", color="#888", label="Naive method")
ax.axvline(5, ls=":", color="#c0504d"); ax.text(5.1, 600, "default cap", color="#c0504d", fontsize=8)
ax.set_xlabel("Public-infrastructure degree cap"); ax.set_ylabel("Honest pairs flagged")
ax.legend(frameon=False, loc="center right"); ax.spines[["top", "right"]].set_visible(False)
fig.tight_layout(); fig.savefig("images/fig_cap_sweep.pdf"); plt.close(fig)
