"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Network, RefreshCw, ShieldAlert } from "lucide-react";
import { Btn, EmptyState, ErrorNotice, ExportJsonButton, JsonDrawer, PageHeader, PageShell, Panel, Pill, Spinner, Stat, riskTone } from "@/components/ui";
import { apiRequest, errorMessage, type BiddersResponse, type CartelSummary, type GraphRenderPayload } from "@/lib/api";

const KIND_STYLE: Record<string, { label: string; color: string }> = {
  director: { label: "Beneficial owner", color: "#38bdf8" },
  ip: { label: "Submission IP", color: "#fbbf24" },
  bank: { label: "Bank routing (IFSC)", color: "#a78bfa" },
  asset: { label: "Declared asset", color: "#94a3b8" },
};
const kindStyle = (k: string) => KIND_STYLE[k] ?? { label: k, color: "#94a3b8" };

const ROW = 30;
const W = 920;
const LEFT_X = 190;
const RIGHT_X = 640;

function scoreColor(score: number): string {
  return score >= 0.7 ? "#fb7185" : score >= 0.4 ? "#fbbf24" : "#34d399";
}

interface AllData {
  bidders: BiddersResponse;
  summary: CartelSummary;
  graph: GraphRenderPayload;
}

function BipartiteGraph({ graph, sharedOnly }: { graph: GraphRenderPayload; sharedOnly: boolean }) {
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    const degree = new Map<string, number>();
    graph.bipartite.forEach(([, m]) => degree.set(m, (degree.get(m) ?? 0) + 1));
    const meta = graph.metadata
      .filter((m) => !sharedOnly || (degree.get(m.id) ?? 0) > 1)
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
    const metaIds = new Set(meta.map((m) => m.id));
    const edges = graph.bipartite.filter(([, m]) => metaIds.has(m));
    const linked = new Set(edges.map(([b]) => b));
    const bidders = graph.bidders.filter((b) => !sharedOnly || linked.has(b.id));
    const rows = Math.max(bidders.length, meta.length, 1);
    return {
      height: rows * ROW + 40,
      bidders: bidders.map((b, i) => ({ ...b, y: 28 + i * ROW })),
      meta: meta.map((m, i) => ({ ...m, y: 28 + i * ROW, degree: degree.get(m.id) ?? 0 })),
      edges,
    };
  }, [graph, sharedOnly]);

  const bY = new Map(layout.bidders.map((b) => [b.id, b.y]));
  const mY = new Map(layout.meta.map((m) => [m.id, m.y]));

  const active = (b: string, m: string) => hover === null || hover === b || hover === m;

  if (layout.bidders.length === 0) {
    return <p className="py-10 text-center text-xs text-slate-500">No shared infrastructure between bidders — nothing to plot.</p>;
  }

  return (
    <svg viewBox={`0 0 ${W} ${layout.height}`} className="w-full" role="img" aria-label="Bipartite bidder to shared-attribute graph">
      {layout.edges.map(([b, m], i) => {
        const y1 = bY.get(b);
        const y2 = mY.get(m);
        if (y1 === undefined || y2 === undefined) return null;
        const kind = graph.metadata.find((x) => x.id === m)?.kind ?? "";
        return (
          <path
            key={i}
            d={`M${LEFT_X + 8},${y1} C${(LEFT_X + RIGHT_X) / 2},${y1} ${(LEFT_X + RIGHT_X) / 2},${y2} ${RIGHT_X - 8},${y2}`}
            fill="none"
            stroke={kindStyle(kind).color}
            strokeWidth={active(b, m) ? 1.6 : 0.6}
            opacity={active(b, m) ? 0.85 : 0.12}
          />
        );
      })}
      {layout.bidders.map((b) => {
        const s = graph.anomalyScores[b.id] ?? 0;
        return (
          <g key={b.id} onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
            <text x={LEFT_X - 14} y={b.y + 4} textAnchor="end" className="fill-slate-200" fontSize="11.5">
              {b.name.length > 28 ? `${b.name.slice(0, 27)}…` : b.name}
            </text>
            <circle cx={LEFT_X} cy={b.y} r="7" fill="#0f172a" stroke={scoreColor(s)} strokeWidth="2.5" />
            <text x={LEFT_X - 14} y={b.y + 16} textAnchor="end" className="fill-slate-500 font-mono" fontSize="9">
              {b.id} · {s.toFixed(2)}
            </text>
          </g>
        );
      })}
      {layout.meta.map((m) => (
        <g key={m.id} onMouseEnter={() => setHover(m.id)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
          <rect x={RIGHT_X - 6} y={m.y - 6} width="12" height="12" fill="#0f172a" stroke={kindStyle(m.kind).color} strokeWidth="2" />
          <text x={RIGHT_X + 14} y={m.y + 4} className="fill-slate-300 font-mono" fontSize="10.5">
            {m.label.length > 34 ? `${m.label.slice(0, 33)}…` : m.label}
          </text>
          {m.degree > 1 && (
            <text x={W - 10} y={m.y + 4} textAnchor="end" className="fill-rose-400 font-mono" fontSize="9.5">
              ×{m.degree} shared
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function CartelGraphPage() {
  const [data, setData] = useState<AllData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedOnly, setSharedOnly] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, s, g] = await Promise.all([
        apiRequest<BiddersResponse>("/api/cartel/bidders"),
        apiRequest<CartelSummary>("/api/cartel/analyze"),
        apiRequest<GraphRenderPayload>("/api/cartel/graph-render"),
      ]);
      setData({ bidders: b.data, summary: s.data, graph: g.data });
    } catch (e) {
      setData(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxScore = data ? Math.max(0, ...Object.values(data.summary.anomaly_scores)) : 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Agent 2C · Collusion analytics"
        title="Cartel & Collusion Graph Intelligence"
        subtitle="Bipartite network of bidders against shared beneficial owners, submission IPs, bank routing codes and declared assets. Overlap across supposedly independent bidders indicates bid-rigging risk."
        statutes={["Competition Act 2002 §3(3)(d) — bid rigging", "GFR 2017 Rule 173(xvi)", "NetworkX bipartite projection"]}
        actions={
          <>
            {data && <ExportJsonButton data={data.graph} filename="cartel-graph-render.json" />}
            <Btn onClick={load} disabled={loading} icon={<RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />}>
              Re-evaluate
            </Btn>
          </>
        }
      />

      {error && <ErrorNotice message={error} onRetry={load} />}
      {loading && !data && <Spinner label="Building bidder graph…" />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Bidders evaluated" value={data.bidders.count} />
            <Stat label="Cartel status" value={data.summary.cartel_detected ? "DETECTED" : "CLEAR"} tone={data.summary.cartel_detected ? "fail" : "pass"} />
            <Stat label="Collusion clusters" value={data.summary.flagged_networks.length} tone={data.summary.flagged_networks.length ? "warn" : "neutral"} />
            <Stat label="Peak anomaly score" value={maxScore.toFixed(2)} tone={riskTone(maxScore * 100)} hint="scale 0.00 – 1.00" />
          </div>

          <Panel
            title="Bidder ↔ shared-attribute network"
            subtitle="Ring colour = anomaly score · square colour = attribute type · hover to trace edges"
            actions={
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-400">
                <input type="checkbox" checked={sharedOnly} onChange={(e) => setSharedOnly(e.target.checked)} className="accent-sky-500" />
                Shared attributes only
              </label>
            }
          >
            <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(KIND_STYLE).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="h-2.5 w-2.5 border-2" style={{ borderColor: v.color }} />
                  {v.label}
                </span>
              ))}
            </div>
            <BipartiteGraph graph={data.graph} sharedOnly={sharedOnly} />
          </Panel>

          {data.summary.flagged_networks.length > 0 && (
            <Panel title="Collusion cluster alerts" subtitle="Bidder groups connected through one or more shared attributes">
              <ul className="space-y-2">
                {data.summary.flagged_networks.map((n, i) => (
                  <li key={i} className="rounded border border-rose-900/50 bg-rose-950/20 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="fail" mono icon={<ShieldAlert className="h-3 w-3" />}>
                        CLUSTER {String(i + 1).padStart(2, "0")}
                      </Pill>
                      <span className="text-[13px] font-medium text-slate-100">{n.bidders.join("  ·  ")}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                      <span className="font-medium text-slate-300">Evidence: </span>
                      {n.reason}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Bidder register" subtitle={`${data.bidders.count} entities · sorted by anomaly score`} flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/50 text-[10.5px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">ID</th>
                    <th className="px-4 py-2 font-medium">Bidder</th>
                    <th className="px-4 py-2 font-medium">Beneficial owners</th>
                    <th className="px-4 py-2 font-medium">Submission IP</th>
                    <th className="px-4 py-2 font-medium">Bank routing</th>
                    <th className="px-4 py-2 text-right font-medium">Anomaly</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {[...data.bidders.bidders]
                    .sort((a, b) => (data.summary.anomaly_scores[b.bidder_id] ?? 0) - (data.summary.anomaly_scores[a.bidder_id] ?? 0))
                    .map((b) => {
                      const s = data.summary.anomaly_scores[b.bidder_id] ?? 0;
                      return (
                        <tr key={b.bidder_id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2 font-mono text-slate-400">{b.bidder_id}</td>
                          <td className="px-4 py-2 font-medium text-slate-100">{b.name}</td>
                          <td className="px-4 py-2 text-slate-300">{b.beneficial_owners.map((o) => o.name).join(", ") || "—"}</td>
                          <td className="px-4 py-2 font-mono text-slate-400">{b.submission_metadata.ip_address ?? "—"}</td>
                          <td className="px-4 py-2 font-mono text-slate-400">{b.submission_metadata.bank_routing_code ?? "—"}</td>
                          <td className="px-4 py-2 text-right">
                            <Pill tone={riskTone(s * 100)} mono>
                              {s.toFixed(2)}
                            </Pill>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Panel>

          <JsonDrawer title="GET /api/cartel/graph-render" data={data.graph} filename="cartel-graph-render.json" />
        </>
      )}

      {!data && !loading && !error && <EmptyState icon={<Network className="h-8 w-8" />} title="No bidder data" body="Register bidders through POST /api/cartel/bidders to build the graph." />}
    </PageShell>
  );
}
