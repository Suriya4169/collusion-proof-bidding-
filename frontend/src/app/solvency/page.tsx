"use client";

import { useMemo, useState } from "react";
import { Banknote, FlaskConical, ScanSearch } from "lucide-react";
import { Btn, EmptyState, ErrorNotice, JsonDrawer, PageHeader, PageShell, Panel, PdfDropzone, Pill, Spinner, riskTone, toneText, type Tone } from "@/components/ui";
import { apiRequest, errorMessage, formatINR, type IntegrityVerdict, type SolvencyAnalysis, type StatementData } from "@/lib/api";

const WINDOW_DRESSING_THRESHOLD = 3.0; // robust Z, ledger_verifier.window_dressing_threshold
const BENFORD_THRESHOLD = 0.25; // max |observed − expected| leading-digit probability
const BENFORD_MIN_SAMPLE = 20; // below this the engine returns 0.0 without testing

const SAMPLES = {
  legitimate: { label: "Legitimate statement", url: "/samples/solvency/sample_legitimate_statement.json" },
  manipulated: { label: "Manipulated statement", url: "/samples/solvency/sample_manipulated_statement.json" },
} as const;
type SampleKey = keyof typeof SAMPLES;

const VERDICT_TONE: Record<IntegrityVerdict, Tone> = {
  "PASSED (AUTHENTIC_AND_CONSISTENT)": "pass",
  "SUSPICIOUS (MANIPULATION_FLAGS_RAISED)": "warn",
  "FAILED (POTENTIAL_TAMPERING_DETECTED)": "fail",
  "ABSTAINED (INSUFFICIENT_CONFIDENCE)": "neutral",
};
const SEVERITY_TONE = { CRITICAL: "fail", HIGH: "fail", MEDIUM: "warn", LOW: "info" } as const;
const ROW_TONE: Record<string, Tone> = { VALID: "pass", CORRECTED_OCR_ERROR: "warn", UNEXPLAINABLE_RESIDUAL: "fail" };

function MetricCard({ label, value, tone, note, formula }: { label: string; value: string; tone: Tone; note: string; formula: string }) {
  return (
    <div className="rounded-md border border-slate-800/80 bg-slate-900/90 px-4 py-3">
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${tone === "neutral" ? "text-slate-100" : toneText[tone]}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-400">{note}</div>
      <div className="mt-1.5 font-mono text-[10px] text-slate-600">{formula}</div>
    </div>
  );
}

export default function SolvencyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SolvencyAnalysis | null>(null);
  const [source, setSource] = useState<string>("");
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  const runPdf = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setRetry(() => runPdf);
    const form = new FormData();
    form.append("file", file);
    if (password) form.append("password", password);
    try {
      const res = await apiRequest<SolvencyAnalysis>("/api/v1/agent/solvency/analyze", { method: "POST", body: form });
      setResult(res.data);
      setLatency(res.latencyMs);
      setSource(file.name);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runSample = async (key: SampleKey) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setRetry(() => () => runSample(key));
    try {
      const sampleRes = await fetch(SAMPLES[key].url);
      if (!sampleRes.ok) throw new Error(`Sample file ${SAMPLES[key].url} could not be loaded.`);
      const statement = (await sampleRes.json()) as StatementData;
      const res = await apiRequest<SolvencyAnalysis>("/api/v1/agent/solvency/verify-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement_data: statement }),
      });
      setResult(res.data);
      setLatency(res.latencyMs);
      setSource(`${SAMPLES[key].label} (sample JSON)`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const m = result?.financial_metrics ?? null;
  const z = result?.window_dressing_z_score ?? null;
  const benfordTested = result !== null && result.total_transactions_analyzed >= BENFORD_MIN_SAMPLE;
  const volatilityTone: Tone = m ? (m.balance_volatility_cv >= 0.8 ? "fail" : m.balance_volatility_cv >= 0.4 ? "warn" : "pass") : "neutral";

  const residualTotal = useMemo(() => result?.audit_rows.reduce((s, r) => s + r.residual, 0) ?? 0, [result]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Agent 3 · Financial forensics"
        title="Solvency Auditor"
        subtitle="Verifies a bidder's bank statement against ledger conservation laws before any solvency figure is trusted: row recurrence, inter-page continuity, end-of-period balance inflation, round-trip transfers and leading-digit distribution."
        statutes={["GFR 2017 Rule 173(xiii) — financial standing", "Companies Act 2013 §447 — fraud", "B_t = B_{t−1} + C_t − D_t"]}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Bank statement">
            <div className="space-y-3">
              <PdfDropzone label="Statement PDF" file={file} onFile={setFile} disabled={busy} maxMb={50} hint="Text-layer PDF · max 50 MB · scanned images are not supported" />
              <div>
                <label htmlFor="pdf-pass" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  PDF password (optional)
                </label>
                <input
                  id="pdf-pass"
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-600"
                />
              </div>
              <Btn variant="primary" className="w-full" disabled={!file || busy} onClick={runPdf} icon={<ScanSearch className="h-3.5 w-3.5" />}>
                {busy ? "Verifying…" : "Verify statement"}
              </Btn>
              <p className="text-[11px] leading-relaxed text-slate-500">PDF analysis needs GEMINI_API_KEY on the server: the model maps column layout only, and every figure is read from the PDF text.</p>
            </div>
          </Panel>

          <Panel title="Test with sample data" subtitle="Pre-structured statements — skips PDF extraction and the LLM">
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(SAMPLES) as SampleKey[]).map((k) => (
                <Btn key={k} disabled={busy} onClick={() => runSample(k)} icon={<FlaskConical className="h-3.5 w-3.5" />}>
                  {SAMPLES[k].label}
                </Btn>
              ))}
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          {busy && (
            <Panel>
              <div className="flex min-h-[260px] items-center justify-center">
                <Spinner label="Running ledger-constrained verification" />
              </div>
            </Panel>
          )}
          {error && !busy && <ErrorNotice message={error} onRetry={retry ?? undefined} />}

          {result && !busy ? (
            <>
              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={VERDICT_TONE[result.overall_integrity]} mono>
                        {result.overall_integrity}
                      </Pill>
                      <span className="font-mono text-[11px] text-slate-500">
                        {result.total_transactions_analyzed} transactions · {result.flags_raised_count} flag{result.flags_raised_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-2 text-[13px] text-slate-200">
                      {result.account_holder ?? "Unknown account holder"}
                      <span className="text-slate-500"> · {result.bank_name ?? "—"} · </span>
                      <span className="font-mono text-slate-400">{result.account_number ?? "—"}</span>
                    </div>
                    <div className="text-[11.5px] text-slate-500">
                      {result.statement_period ?? "Period n/a"} · source: {source}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-500">
                    <div>analysis {result.analysis_id}</div>
                    {latency !== null && <div>HTTP 200 · {latency} ms</div>}
                  </div>
                </div>
              </Panel>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Window-dressing Z-score"
                  value={z === null ? "n/a" : z.toFixed(2)}
                  tone={z === null ? "neutral" : z >= WINDOW_DRESSING_THRESHOLD ? "fail" : "pass"}
                  note={z === null ? "Fewer than 5 rows or no prior window" : z >= WINDOW_DRESSING_THRESHOLD ? `Spike: ≥ ${WINDOW_DRESSING_THRESHOLD} threshold` : `Below ${WINDOW_DRESSING_THRESHOLD} threshold`}
                  formula="(mean₃₀d − median_prior) / (1.4826·MAD)"
                />
                <MetricCard
                  label="Benford divergence"
                  value={benfordTested ? (result.benford_divergence ?? 0).toFixed(3) : "n/a"}
                  tone={!benfordTested ? "neutral" : (result.benford_divergence ?? 0) > BENFORD_THRESHOLD ? "warn" : "pass"}
                  note={benfordTested ? `Flag above ${BENFORD_THRESHOLD}` : `Not tested: needs ≥ ${BENFORD_MIN_SAMPLE} amounts`}
                  formula="max_d |P_obs(d) − log₁₀(1+1/d)|"
                />
                <MetricCard
                  label="Time-weighted balance"
                  value={m ? formatINR(m.time_weighted_avg_balance, true) : "—"}
                  tone="neutral"
                  note={m ? `Naive mean ${formatINR(m.naive_transaction_avg_balance, true)}` : ""}
                  formula="Σ B_t·days_held / Σ days_held"
                />
                <MetricCard
                  label="Volatility (CV)"
                  value={m ? m.balance_volatility_cv.toFixed(3) : "—"}
                  tone={volatilityTone}
                  note={m ? `Min ${formatINR(m.min_balance, true)} · Max ${formatINR(m.max_balance, true)}` : ""}
                  formula="σ(B) / μ(B)"
                />
              </div>

              {m && (
                <div className="font-mono text-[11px] text-slate-500">
                  Monthly cash-flow slope: <span className={m.monthly_cashflow_slope >= 0 ? "text-emerald-400" : "text-rose-400"}>{formatINR(m.monthly_cashflow_slope, true)}/month</span> (OLS trend of verified balance)
                </div>
              )}

              {result.flags.length > 0 && (
                <Panel title="Forensic flags" subtitle="Ordered as raised by the engine">
                  <ul className="space-y-2">
                    {result.flags.map((f, i) => (
                      <li key={i} className="rounded border border-slate-800 bg-slate-950/50 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={SEVERITY_TONE[f.severity]} mono>
                            {f.severity}
                          </Pill>
                          <span className="font-mono text-[11.5px] text-slate-200">{f.type}</span>
                          {f.tx_id && <span className="font-mono text-[11px] text-slate-500">{f.tx_id}</span>}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{f.details}</p>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              <Panel
                title="Audit ledger"
                subtitle={`Expected balance = previous balance + credit − debit · ${result.audit_rows.length} of ${result.total_transactions_analyzed} rows (engine returns a preview)`}
                actions={<Pill tone={residualTotal > 0 ? riskTone(100) : "pass"} mono>Σ residual {formatINR(residualTotal, true)}</Pill>}
                flush
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="border-b border-slate-800 bg-slate-950/50 text-[10.5px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">tx_id</th>
                        <th className="px-4 py-2 font-medium">date</th>
                        <th className="px-4 py-2 text-right font-medium">reported_balance</th>
                        <th className="px-4 py-2 text-right font-medium">expected_balance</th>
                        <th className="px-4 py-2 text-right font-medium">residual</th>
                        <th className="px-4 py-2 font-medium">status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                      {result.audit_rows.map((r) => (
                        <tr key={r.tx_id} className={r.residual > 0 ? "bg-rose-950/15" : "hover:bg-slate-800/30"}>
                          <td className="px-4 py-2 text-slate-300" title={r.narration ?? undefined}>
                            {r.tx_id}
                          </td>
                          <td className="px-4 py-2 text-slate-400">{r.date ?? "—"}</td>
                          <td className="px-4 py-2 text-right text-slate-200">{formatINR(r.reported_balance)}</td>
                          <td className="px-4 py-2 text-right text-slate-300">{formatINR(r.expected_balance)}</td>
                          <td className={`px-4 py-2 text-right ${r.residual > 0 ? "text-rose-300" : "text-slate-500"}`}>{formatINR(r.residual)}</td>
                          <td className="px-4 py-2">
                            <Pill tone={ROW_TONE[r.status] ?? "neutral"} mono>
                              {r.status}
                            </Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <JsonDrawer title="Solvency analysis response" data={result} filename={`solvency-${result.analysis_id}.json`} />
            </>
          ) : (
            !busy &&
            !error && (
              <EmptyState
                icon={<Banknote className="h-8 w-8" />}
                title="No statement verified"
                body="Upload a bank statement PDF, or run one of the sample statements to see the forensic metrics, flags and the row-by-row audit ledger."
              />
            )
          )}
        </div>
      </div>
    </PageShell>
  );
}
