"use client";

import { useEffect, useState } from "react";
import { Trophy, ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, Cpu, Award } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  bidder_id: string;
  price_score: number;
  legal_score: number;
  financial_score: number;
  technical_score: number;
  fused_bayesian_trust_score: float;
  collusion_anomaly_score: float;
  composite_score: float | null;
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

  const fetchOptimization = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/trust-optimizer/leaderboard/TENDER-2026-001");
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
              <span className="text-xs text-slate-500">Tender: TENDER-2026-001</span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">Hardened Multi-Criteria Trust Optimizer</h1>
            <p className="text-sm text-slate-400 mt-1">
              Fuses Bayesian performance beta priors, financial solvency proofs, collusion anomaly penalties, and pricing curves.
            </p>
          </div>

          <button
            onClick={fetchOptimization}
            disabled={loading}
            className="flex items-center gap-2 rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Re-run Optimization
          </button>
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
                <span className="text-xs text-emerald-400">({data.total_eligible} eligible)</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-2">Strict gatekeeping applied</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-400">Disqualified / Collusion Risk</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-bold text-rose-400">{data.total_excluded}</span>
                <span className="text-xs text-slate-400">entities</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-2">Insolvency or Anomaly flags</span>
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
              <span className="text-xs font-mono text-slate-500">Bayesian Posterior Fusion Mode</span>
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
                          {entry.status === "eligible" ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 border border-emerald-500/20 font-sans">
                              <CheckCircle className="h-3 w-3" /> Eligible
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
