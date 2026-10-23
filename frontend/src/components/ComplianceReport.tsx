"use client";

import { useState } from "react";
import { BookOpen, FileWarning, Landmark } from "lucide-react";
import { Gauge, JsonDrawer, Panel, Pill, scoreTone, type Tone } from "./ui";
import type { RuleStatus, VerificationReport } from "@/lib/api";

const STATUS_TONE: Record<RuleStatus, Tone> = { PASS: "pass", EXEMPTED: "warn", FAIL: "fail", INFO: "info" };
const STATUS_LABEL: Record<RuleStatus, string> = { PASS: "PASS", EXEMPTED: "EXEMPTED", FAIL: "FAIL", INFO: "INFO" };

export default function ComplianceReport({ report }: { report: VerificationReport }) {
  const [lang, setLang] = useState<"en" | "hi">("en");

  const counts = report.checks.reduce<Record<RuleStatus, number>>(
    (acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }),
    { PASS: 0, EXEMPTED: 0, FAIL: 0, INFO: 0 },
  );

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Gauge value={report.overallComplianceScore} tone={scoreTone(report.overallComplianceScore)} label="Compliance score" />
          <div className="w-full flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={report.isEligible ? "pass" : "fail"}>{report.isEligible ? "ELIGIBLE TO BID" : "NOT ELIGIBLE"}</Pill>
              <span className="text-[11px] text-slate-500">Weighted Overall Compliance Distance (OCD), deterministic symbolic verifier</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["PASS", "EXEMPTED", "FAIL"] as const).map((s) => (
                <div key={s} className="rounded border border-slate-800 bg-slate-950/50 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-slate-500">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${s === "PASS" ? "bg-emerald-400" : s === "EXEMPTED" ? "bg-amber-400" : "bg-rose-400"}`}
                    />
                    {STATUS_LABEL[s]}
                  </div>
                  <div className="font-mono text-xl font-semibold tabular-nums text-slate-100">{counts[s]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Rule-by-rule verification" subtitle="Each criterion extracted from the tender with page citation and extractor confidence" flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-[10.5px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Criterion</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Tender requires</th>
                <th className="px-4 py-2 font-medium">Your profile</th>
                <th className="px-4 py-2 text-right font-medium">CDS</th>
                <th className="px-4 py-2 font-medium">Citation</th>
                <th className="px-4 py-2 text-right font-medium">Conf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {report.checks.map((c, i) => (
                <tr key={`${c.ruleName}-${i}`} className="align-top hover:bg-slate-800/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-100">{c.ruleName}</div>
                    <div className="mt-0.5 max-w-sm text-[11.5px] leading-snug text-slate-500">{c.message}</div>
                    {c.status === "EXEMPTED" && /emd|earnest/i.test(c.ruleName) && (
                      <div className="mt-1 font-mono text-[10.5px] text-amber-400/80">Rule 173(i), GFR 2017 · Sec. 11, Public Procurement Policy for MSEs</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Pill tone={STATUS_TONE[c.status]} mono>
                      {STATUS_LABEL[c.status]}
                    </Pill>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-300">{c.requiredValue}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-300">{c.actualValue}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono tabular-nums ${c.distancePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                    title="Compliance Distance Score: positive exceeds requirement, negative falls short"
                  >
                    {c.distancePct > 0 ? "+" : ""}
                    {c.distancePct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5">
                    {c.sourcePage > 0 ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-sky-300">
                        <BookOpen className="h-3 w-3" />
                        Page {c.sourcePage}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-300">{(c.confidence * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {report.missingDocuments.length > 0 && (
        <Panel title="Missing statutory documents" subtitle="Required by the tender, absent from your vault">
          <ul className="flex flex-wrap gap-2">
            {report.missingDocuments.map((d) => (
              <li key={d}>
                <Pill tone="fail" icon={<FileWarning className="h-3 w-3" />}>
                  {d}
                </Pill>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Tender summary"
        actions={
          <div role="tablist" className="flex rounded border border-slate-800 bg-slate-950 p-0.5 text-[11px]">
            {(
              [
                ["en", "English"],
                ["hi", "हिन्दी"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={lang === k}
                onClick={() => setLang(k)}
                className={`rounded-sm px-2.5 py-1 font-medium ${lang === k ? "bg-slate-700/70 text-slate-50" : "text-slate-400 hover:text-slate-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        <p lang={lang === "hi" ? "hi" : "en"} className="text-[13px] leading-relaxed text-slate-300">
          {(lang === "en" ? report.plainSummary : report.regionalSummary) || "Summary not available for this language."}
        </p>
      </Panel>

      {report.recommendedSchemes.length > 0 && (
        <Panel title="Gap-bridging government schemes" subtitle="Scheme Discoverer output">
          <ul className="space-y-1.5">
            {report.recommendedSchemes.map((s) => (
              <li key={s} className="flex items-start gap-2 text-xs text-slate-300">
                <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                {s}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <JsonDrawer title="POST /api/tender/analyze" data={report} filename="tender-analysis.json" />
    </div>
  );
}
