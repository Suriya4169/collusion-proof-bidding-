"use client";

import { useState, useEffect } from "react";

interface FlaggedNetwork {
  bidders: string[];
  reason: string;
}

interface ComplianceSummary {
  cartel_detected: boolean;
  flagged_networks: FlaggedNetwork[];
  anomaly_scores: Record<string, number>;
}

interface Bidder {
  bidder_id: string;
  name: string;
  beneficial_owners: { name: string }[];
  submission_metadata: {
    ip_address?: string;
    bank_routing_code?: string;
  };
  declared_assets: string[];
}

export default function CartelGraphPage() {
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCartelData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch bidders
      const resBidders = await fetch("http://localhost:8000/api/cartel/bidders");
      if (!resBidders.ok) throw new Error("Failed to load bidders list");
      const biddersData = await resBidders.json();
      setBidders(biddersData.bidders || []);

      // 2. Fetch analysis summary
      const resAnalysis = await fetch("http://localhost:8000/api/cartel/analyze");
      if (!resAnalysis.ok) throw new Error("Failed to analyze cartel graph");
      const analysisData = await resAnalysis.json();
      setSummary(analysisData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to Cartel Intelligence service on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCartelData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                Agent 2C Intelligence
              </span>
              <span className="text-xs text-slate-400">NetworkX Bipartite Graph</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Cartel & Collusion Graph Intelligence
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Detects suspicious bidding rings, shared beneficial ownership, common IP submissions, and asset overlap across public tenders.
            </p>
          </div>
          <button
            onClick={fetchCartelData}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm shadow-lg shadow-rose-900/30 transition-all flex items-center gap-2"
          >
            <span>{loading ? "Analyzing..." : "Re-evaluate Graph"}</span>
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-rose-300 text-sm">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bidders Evaluated</span>
            <div className="text-3xl font-extrabold text-white mt-2">{bidders.length}</div>
            <p className="text-xs text-slate-500 mt-1">Active procurement bidders</p>
          </div>

          <div className={`border rounded-xl p-5 shadow-sm ${
            summary?.cartel_detected 
              ? "bg-rose-950/30 border-rose-800/60" 
              : "bg-slate-900/80 border-slate-800"
          }`}>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cartel Anomaly Status</span>
            <div className={`text-3xl font-extrabold mt-2 ${
              summary?.cartel_detected ? "text-rose-400" : "text-emerald-400"
            }`}>
              {summary?.cartel_detected ? "DETECTED" : "CLEAR"}
            </div>
            <p className="text-xs text-slate-500 mt-1">Bipartite ring threshold</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Flagged Networks</span>
            <div className="text-3xl font-extrabold text-amber-400 mt-2">
              {summary?.flagged_networks?.length || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Collusive sub-clusters</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Highest Anomaly Score</span>
            <div className="text-3xl font-extrabold text-rose-400 mt-2">
              {summary?.anomaly_scores 
                ? Math.max(...Object.values(summary.anomaly_scores), 0).toFixed(2)
                : "0.00"}
            </div>
            <p className="text-xs text-slate-500 mt-1">Scale: 0.00 to 1.00</p>
          </div>
        </div>

        {/* Flagged Networks Alert Box */}
        {summary?.flagged_networks && summary.flagged_networks.length > 0 && (
          <div className="bg-slate-900 border border-rose-900/50 rounded-xl p-6 shadow-md space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
              <h2 className="text-lg font-bold text-rose-300">Flagged Collusion Clusters & Reasoning</h2>
            </div>
            <div className="space-y-3">
              {summary.flagged_networks.map((net, idx) => (
                <div key={idx} className="bg-slate-950/70 border border-rose-950/80 rounded-lg p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono uppercase bg-rose-950 text-rose-400 px-2 py-0.5 rounded border border-rose-800/40">
                      Cluster #{idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-200">
                      Bidders: {net.bidders.join(" & ")}
                    </span>
                  </div>
                  <p className="text-xs text-rose-300/90 leading-relaxed">
                    <strong className="text-rose-400 font-semibold">Evidence:</strong> {net.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bidders Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Registered Bidding Profiles & Anomaly Ratings</h2>
            <span className="text-xs text-slate-400">Total: {bidders.length} entities</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Bidder ID</th>
                  <th className="px-6 py-3.5">Company Name</th>
                  <th className="px-6 py-3.5">Beneficial Owners</th>
                  <th className="px-6 py-3.5">IP Address</th>
                  <th className="px-6 py-3.5">Bank Routing</th>
                  <th className="px-6 py-3.5 text-right">Anomaly Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {bidders.map((b) => {
                  const score = summary?.anomaly_scores?.[b.bidder_id] ?? 0;
                  const isHigh = score >= 0.5;
                  return (
                    <tr key={b.bidder_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-300">{b.bidder_id}</td>
                      <td className="px-6 py-4 font-semibold text-white">{b.name}</td>
                      <td className="px-6 py-4 text-xs text-slate-300">
                        {b.beneficial_owners.map((o) => o.name).join(", ") || "—"}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        {b.submission_metadata?.ip_address || "—"}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        {b.submission_metadata?.bank_routing_code || "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                          isHigh
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        }`}>
                          {score.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
