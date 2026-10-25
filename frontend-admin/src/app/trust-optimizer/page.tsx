"use client";

import { useEffect, useState } from "react";
import { Trophy, ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, Cpu, Award, Sliders, Zap } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  bidder_id: string;
  price_score: number;
  performance_score?: number;
  legal_score: number;
  financial_score: number;
  technical_score: number;
  fused_bayesian_trust_score: number;
  collusion_anomaly_score: number;
  composite_score: number | null;
  is_financially_eligible: boolean;
  status: string;
}

interface OptimizationResult {
  tender_id: string;
  winner_id: string | null;
  hold_for_manual_review: boolean;
  total_evaluated: number;
  total_eligible: number;
  total_excluded: number;
  leaderboard: LeaderboardEntry[];
  summary_message: string;
}

export default function TrustOptimizerPage() {
  const [data, setData] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Parameter State
  const [tenderId, setTenderId] = useState("TENDER-2026-001");
  const [bRef, setBRef] = useState(400000);
  const [numBidders, setNumBidders] = useState(20);
  const [seed, setSeed] = useState(42);

  const fetchOptimization = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `http://localhost:8000/api/trust-optimizer/leaderboard/${encodeURIComponent(
        tenderId.trim() || "TENDER-2026-001"
      )}?b_ref=${bRef}&num_bidders=${numBidders}&seed=${seed}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load trust optimization leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptimization();
  }, []);

  const applyPreset = (presetName: string, id: string, budget: number, count: number, s: number) => {
    setTenderId(id);
    setBRef(budget);
    setNumBidders(count);
    setSeed(s);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-10">
      <div className="max-w-[1440px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-300 border border-violet-500/30">
                SOVEREIGN BAYESIAN TRUST ENGINE
              </span>
              <span className="text-xs text-slate-500 font-mono">Agent 6 · Best Bidder Multi-Agent Selection</span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">Hardened Multi-Criteria Trust Optimizer</h1>
            <p className="text-sm text-slate-400 mt-1">
              Dynamically computes Bayesian beta priors, financial gatekeeping, price non-linearity, and collusion anomaly penalties across any tender.
            </p>
          </div>

          <button
            onClick={fetchOptimization}
            disabled={loading}
            className="flex items-center gap-2 rounded bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/30 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Run Bayesian Optimization
          </button>
        </div>

        {/* Dynamic Parameter Tuning Console */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <Sliders className="h-4 w-4 text-violet-400" />
              Dynamic Procurement Parameters & Seed Tuning
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="text-slate-500">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset("Standard", "TENDER-2026-001", 400000, 20, 42)}
                className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700"
              >
                Standard (₹4L, 20)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("Mega Infra", "TENDER-INFRA-900", 15000000, 35, 108)}
                className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700"
              >
                Mega Infra (₹1.5Cr, 35)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("High Collusion", "TENDER-CARTEL-RISK", 850000, 15, 7)}
                className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700"
              >
                Cartel Stress (15 bids)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-400 mb-1">Tender Reference ID</label>
              <input
                type="text"
                value={tenderId}
                onChange={(e) => setTenderId(e.target.value)}
                placeholder="e.g. TENDER-2026-X12"
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-slate-200 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-400 mb-1">Independent Budget Ref (B_ref in ₹)</label>
              <input
                type="number"
                min={10000}
                step={50000}
                value={bRef}
                onChange={(e) => setBRef(Number(e.target.value))}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-slate-200 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-400 mb-1">
                Candidate Pool Size: <span className="font-mono text-violet-400 font-bold">{numBidders}</span>
              </label>
              <input
                type="range"
                min={2}
                max={50}
                value={numBidders}
                onChange={(e) => setNumBidders(Number(e.target.value))}
                className="w-full accent-violet-500 mt-1 cursor-pointer"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-400 mb-1">Simulation Seed (Random Multiplier)</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-slate-200 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="font-semibold">Backend Unreachable or Error</p>
              <p className="text-xs text-red-400">{error} (Ensure backend is running at http://localhost:8000)</p>
            </div>
          </div>
        )}

        {/* Winner Banner */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 p-6 flex items-start gap-4 shadow-xl shadow-amber-950/10">
              <div className="rounded-xl bg-amber-500/20 p-3 text-amber-400 border border-amber-500/40">
                <Trophy className="h-8 w-8" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Optimal Winner Selected</span>
                <h2 className="text-3xl font-extrabold text-white mt-0.5">Bidder {data.winner_id}</h2>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">{data.summary_message}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-400">Total Bidders Evaluated</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-bold text-white">{data.total_evaluated}</span>
                <span className="text-xs text-emerald-400 font-medium">({data.total_eligible} eligible)</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-2 font-mono">Tender: {data.tender_id}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-400">Disqualified / Collusion Risk</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-bold text-rose-400">{data.total_excluded}</span>
                <span className="text-xs text-slate-400">entities</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-2 font-mono">Hold review: {data.hold_for_manual_review ? "YES" : "NO"}</span>
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        {data && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-2xl">
            <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <Award className="h-5 w-5 text-violet-400" />
                Ranked Multi-Criteria Evaluation Matrix
              </h3>
              <span className="text-xs font-mono text-slate-500">Posterior Optimization · Sorted by Composite Score</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Bidder</th>
                    <th className="py-3 px-4">Composite Score</th>
                    <th className="py-3 px-4">Bayesian Trust</th>
                    <th className="py-3 px-4">Price Score</th>
                    <th className="py-3 px-4">Technical</th>
                    <th className="py-3 px-4">Collusion Anomaly</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {data.leaderboard.map((entry) => {
                    const isWinner = entry.bidder_id === data.winner_id;
                    return (
                      <tr
                        key={entry.bidder_id}
                        className={`transition-colors ${
                          isWinner
                            ? "bg-amber-500/10 hover:bg-amber-500/15 font-semibold text-amber-200"
                            : "hover:bg-slate-800/40 text-slate-300"
                        }`}
                      >
                        <td className="py-3 px-4">
                          {isWinner ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                              🏆 #{entry.rank}
                            </span>
                          ) : (
                            <span className="text-slate-400">#{entry.rank}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          {entry.bidder_id}
                          {isWinner && (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] text-amber-300 border border-amber-500/40">
                              WINNER
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-sm">
                          {entry.composite_score !== null ? (
                            <span className={isWinner ? "text-amber-300" : "text-sky-300"}>
                              {entry.composite_score.toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-rose-400">Disqualified</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-emerald-400">
                          {entry.fused_bayesian_trust_score.toFixed(4)}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{entry.price_score.toFixed(4)}</td>
                        <td className="py-3 px-4 text-slate-300">{entry.technical_score.toFixed(4)}</td>
                        <td className="py-3 px-4">
                          <span
                            className={
                              entry.collusion_anomaly_score > 0.4
                                ? "text-rose-400 font-bold"
                                : "text-slate-400"
                            }
                          >
                            {entry.collusion_anomaly_score.toFixed(4)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {entry.status === "Winner" || entry.status === "Passed" || entry.status === "eligible" ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 border border-emerald-500/20 font-sans">
                              <CheckCircle className="h-3 w-3" /> {entry.status}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-400 border border-rose-500/20 font-sans">
                              <AlertTriangle className="h-3 w-3" /> Excluded
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
