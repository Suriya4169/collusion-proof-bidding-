"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";
import { Gauge, JsonDrawer, Panel, Pill, riskTone, type Tone } from "./ui";
import type { DiffReportData } from "@/lib/api";

type Op = { kind: "same" | "del" | "add"; text: string };

/** Word-level LCS diff used for the redline view. */
function wordDiff(a: string, b: string): Op[] {
  const x = a.split(/\s+/).filter(Boolean);
  const y = b.split(/\s+/).filter(Boolean);
  const dp: number[][] = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) ops.push({ kind: "same", text: x[i++] }), j++;
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ kind: "del", text: x[i++] });
    else ops.push({ kind: "add", text: y[j++] });
  }
  while (i < x.length) ops.push({ kind: "del", text: x[i++] });
  while (j < y.length) ops.push({ kind: "add", text: y[j++] });
  return ops;
}

const CLASS_TONE: Record<string, Tone> = { RESTRICTIVE: "fail", PERMISSIVE: "pass" };

export default function DiffReport({ data }: { data: DiffReportData }) {
  const index = data.overall_manipulation_probability * 100;
  const tone = riskTone(index);
  const closeToDeadline = data.days_before_deadline <= 3;

  const diffs = useMemo(() => data.flagged_clauses.map((c) => wordDiff(c.original_clause, c.amended_clause)), [data.flagged_clauses]);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Gauge value={index} tone={tone} label="Tampering risk index" />
          <div className="w-full flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={tone} mono>
                {data.risk_level}
              </Pill>
              <Pill tone={closeToDeadline ? "fail" : data.days_before_deadline <= 7 ? "warn" : "neutral"} icon={<Clock className="h-3 w-3" />}>
                Modified {data.days_before_deadline} day{data.days_before_deadline === 1 ? "" : "s"} before bid closing
              </Pill>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              {[
                ["Flagged clauses", String(data.flagged_clauses.length)],
                ["Temporal multiplier", `${data.temporal_multiplier}×`],
                ["Similarity floor", "0.75"],
              ].map(([k, v]) => (
                <div key={k} className="rounded border border-slate-800 bg-slate-950/50 px-3 py-2">
                  <dt className="text-[10.5px] uppercase tracking-wider text-slate-500">{k}</dt>
                  <dd className="font-mono text-lg font-semibold tabular-nums text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11.5px] text-slate-500">
              Index = Σ clause base risk × temporal multiplier. Amendments close to the bid deadline weigh more under CVC transparency guidelines.
            </p>
          </div>
        </div>
      </Panel>

      {data.flagged_clauses.length === 0 ? (
        <Panel>
          <p className="text-center text-xs text-emerald-300">No semantically significant amendments detected (all clause pairs ≥ 0.75 similarity).</p>
        </Panel>
      ) : (
        <Panel title="Clause redline" subtitle="Deletions struck through in red · additions underlined in green" flush>
          <ol className="divide-y divide-slate-800/70">
            {data.flagged_clauses.map((c, i) => (
              <li key={i} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-500">#{i + 1}</span>
                  <Pill tone={CLASS_TONE[c.classification] ?? "neutral"} mono>
                    {c.classification}
                  </Pill>
                  <Pill tone="neutral" mono>
                    cos-sim {c.similarity_score.toFixed(2)}
                  </Pill>
                  <Pill tone={riskTone(c.base_risk_score * 100)} mono>
                    base risk {c.base_risk_score.toFixed(2)}
                  </Pill>
                </div>
                <p className="rounded border border-slate-800 bg-slate-950/60 p-3 text-[13px] leading-relaxed text-slate-300">
                  {diffs[i].map((op, k) =>
                    op.kind === "same" ? (
                      <span key={k}>{op.text} </span>
                    ) : op.kind === "del" ? (
                      <del key={k} className="mr-1 rounded-sm bg-rose-500/15 px-0.5 text-rose-300 decoration-rose-400">
                        {op.text}
                      </del>
                    ) : (
                      <ins key={k} className="mr-1 rounded-sm bg-emerald-500/15 px-0.5 text-emerald-300 decoration-emerald-400">
                        {op.text}
                      </ins>
                    ),
                  )}
                </p>
                <p className="text-xs leading-relaxed text-slate-400">
                  <span className="font-medium text-slate-300">Analyst note: </span>
                  {c.reason}
                </p>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <JsonDrawer title="POST /api/diff" data={data} filename="corrigendum-diff.json" />
    </div>
  );
}
