"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Printer, Scale } from "lucide-react";
import { Btn, CopyButton, EmptyState, ErrorNotice, JsonDrawer, PageHeader, PageShell, Panel, PdfDropzone, Pill, Spinner, Stat } from "@/components/ui";
import { apiRequest, errorMessage, formatINR, type PaymentPenaltyReport } from "@/lib/api";

const STATUTORY_DAYS = 45;
const RBI_BANK_RATE = 6.5;
const MULTIPLIER = 3;
const ANNUAL_RATE = RBI_BANK_RATE * MULTIPLIER; // 19.5 % p.a.
const MS_DAY = 86_400_000;

interface MonthRow {
  month: number;
  opening: number;
  interest: number;
  closing: number;
}

/** Facts the backend embeds in the notice text; the report JSON itself omits them. */
function parseNotice(draft: string): { principal: number; invoiceDate: string } | null {
  const principal = /principal amount of ₹([\d,]+(?:\.\d+)?)/.exec(draft);
  const date = /dated (\d{4}-\d{2}-\d{2})/.exec(draft);
  if (!principal || !date) return null;
  return { principal: Number(principal[1].replace(/,/g, "")), invoiceDate: date[1] };
}

function addDays(iso: string, days: number): Date {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * MS_DAY);
}
const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/** Mirrors the backend engine: A = P(1 + r/12)^m, m = ceil(days_overdue / 30). */
function buildSchedule(principal: number, daysOverdue: number): MonthRow[] {
  const months = Math.ceil(daysOverdue / 30);
  const monthly = ANNUAL_RATE / 100 / 12;
  const rows: MonthRow[] = [];
  let balance = principal;
  for (let m = 1; m <= months; m++) {
    const interest = balance * monthly;
    rows.push({ month: m, opening: balance, interest, closing: balance + interest });
    balance += interest;
  }
  return rows;
}

function toMarkdown(draft: string): string {
  const body = draft.replace(/^\[DRAFT LEGAL DEMAND NOTICE UNDER MSMED ACT, 2006\]\s*/i, "").replace(/^(Subject:.*)$/m, "**$1**");
  return `# Statutory Demand Notice\n\n_Micro, Small and Medium Enterprises Development Act, 2006 — Sections 15, 16 & 17_\n\n${body.trim()}\n`;
}

export default function PaymentTracker() {
  const [company, setCompany] = useState("Bharat Precision Engineering Pvt Ltd");
  const [invoice, setInvoice] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<PaymentPenaltyReport | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("msme_profile");
      if (saved) {
        const p = JSON.parse(saved) as { companyName?: string };
        if (p.companyName) setCompany(p.companyName);
      }
    } catch {
      /* default company retained */
    }
  }, []);

  const track = async () => {
    if (!invoice || !receipt) return;
    setBusy(true);
    setError(null);
    setReport(null);
    const form = new FormData();
    form.append("invoice_file", invoice);
    form.append("receipt_file", receipt);
    form.append("company_name", company);
    try {
      const res = await apiRequest<PaymentPenaltyReport>("/api/payments/track", { method: "POST", body: form });
      setReport(res.data);
      setLatency(res.latencyMs);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const facts = useMemo(() => (report ? parseNotice(report.demandNoticeDraft) : null), [report]);
  const schedule = useMemo(
    () => (report && report.isPenaltyApplicable && facts ? buildSchedule(facts.principal, report.daysOverdue) : []),
    [report, facts],
  );
  const computed = schedule.length ? schedule[schedule.length - 1].closing - (facts?.principal ?? 0) : 0;
  const reconciled = report ? Math.abs(computed - report.penaltyAmountInr) < 0.01 : false;

  const cutoff = facts ? addDays(facts.invoiceDate, STATUTORY_DAYS) : null;
  const paidOn = facts && report ? addDays(facts.invoiceDate, STATUTORY_DAYS + report.daysOverdue) : null;
  const totalDays = STATUTORY_DAYS + (report?.daysOverdue ?? 0);

  const printNotice = () => {
    setNoticeOpen(true);
    setTimeout(() => window.print(), 80);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Module 2 · Statutory recovery"
        title="Statutory Payment Recovery Engine"
        subtitle="Upload the commercial invoice and delivery challan. Dates are extracted by the AI layer; interest is computed by a deterministic compounding engine and a demand notice is drafted."
        statutes={["MSMED Act 2006 §15 — 45-day limit", "§16 — 3× RBI Bank Rate, monthly rests", "§17 — liability of buyer", "§18 — MSEFC reference"]}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel title="Proof documents">
          <div className="space-y-3">
            <div>
              <label htmlFor="company" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Claimant enterprise
              </label>
              <input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-600"
              />
            </div>
            <PdfDropzone label="Commercial tax invoice" file={invoice} onFile={setInvoice} disabled={busy} />
            <PdfDropzone label="Delivery challan / payment receipt" file={receipt} onFile={setReceipt} disabled={busy} />
            <Btn variant="primary" className="w-full" disabled={!invoice || !receipt || !company.trim() || busy} onClick={track} icon={<Calculator className="h-3.5 w-3.5" />}>
              {busy ? "Extracting & computing…" : "Compute statutory interest"}
            </Btn>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Rate applied: {MULTIPLIER} × RBI Bank Rate ({RBI_BANK_RATE.toFixed(2)}%) = <span className="font-mono text-slate-300">{ANNUAL_RATE.toFixed(2)}% p.a.</span>, compounded monthly.
            </p>
          </div>
        </Panel>

        <div className="min-w-0 space-y-4">
          {busy ? (
            <Panel>
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3">
                <Spinner label="Extracting dates and computing interest" />
                <p className="text-[11.5px] text-slate-500">OCR → Gemini date extraction → symbolic compounding engine</p>
              </div>
            </Panel>
          ) : error ? (
            <ErrorNotice message={error} onRetry={invoice && receipt ? track : undefined} />
          ) : report ? (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Stat label="Days overdue" value={report.daysOverdue} tone={report.isPenaltyApplicable ? "fail" : "pass"} hint={`beyond ${STATUTORY_DAYS}-day limit`} />
                <Stat label="Principal" value={facts ? formatINR(facts.principal) : "—"} hint="from invoice" />
                <Stat label="Interest accrued" value={formatINR(report.penaltyAmountInr)} tone={report.isPenaltyApplicable ? "fail" : "pass"} hint={`${ANNUAL_RATE}% p.a. compounded`} />
                <Stat label="Total recoverable" value={facts ? formatINR(facts.principal + report.penaltyAmountInr) : "—"} hint="principal + interest" />
              </div>

              <Panel
                title="Statutory timeline"
                subtitle="Section 15, MSMED Act 2006: payment due within 45 days of acceptance"
                actions={<Pill tone={report.isPenaltyApplicable ? "fail" : "pass"}>{report.isPenaltyApplicable ? "DEFAULT — §16 INTEREST ACCRUES" : "WITHIN STATUTORY LIMIT"}</Pill>}
              >
                {facts && cutoff && paidOn ? (
                  <div>
                    <div className="relative h-2 overflow-hidden rounded bg-slate-800">
                      <div className="absolute inset-y-0 left-0 bg-emerald-500/70" style={{ width: `${(STATUTORY_DAYS / totalDays) * 100}%` }} />
                      {report.daysOverdue > 0 && (
                        <div className="absolute inset-y-0 right-0 bg-rose-500/80" style={{ width: `${(report.daysOverdue / totalDays) * 100}%` }} />
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
                      <div>
                        <div className="text-slate-500">Day 0 · Invoice</div>
                        <div className="text-slate-200">{fmtDate(addDays(facts.invoiceDate, 0))}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-emerald-400">Day {STATUTORY_DAYS} · Statutory cutoff</div>
                        <div className="text-slate-200">{fmtDate(cutoff)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-rose-400">Day {totalDays} · Payment received</div>
                        <div className="text-slate-200">{fmtDate(paidOn)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Dates could not be parsed from the notice draft; timeline unavailable.</p>
                )}
              </Panel>

              {schedule.length > 0 && facts && (
                <Panel
                  title="Interest computation"
                  subtitle={`A = P·(1 + ${ANNUAL_RATE}%/12)^m · m = ⌈${report.daysOverdue}/30⌉ = ${schedule.length} monthly rests`}
                  actions={<Pill tone={reconciled ? "pass" : "warn"}>{reconciled ? "Reconciled with server" : "Differs from server"}</Pill>}
                  flush
                >
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full min-w-[520px] text-right font-mono text-xs tabular-nums">
                      <thead className="sticky top-0 bg-slate-900 text-[10.5px] uppercase tracking-wider text-slate-500">
                        <tr className="border-b border-slate-800">
                          <th className="px-4 py-2 text-left font-medium">Month</th>
                          <th className="px-4 py-2 font-medium">Opening balance</th>
                          <th className="px-4 py-2 font-medium">Interest @ {(ANNUAL_RATE / 12).toFixed(4)}%</th>
                          <th className="px-4 py-2 font-medium">Closing balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {schedule.map((r) => (
                          <tr key={r.month}>
                            <td className="px-4 py-1.5 text-left text-slate-500">{r.month}</td>
                            <td className="px-4 py-1.5">{formatINR(r.opening)}</td>
                            <td className="px-4 py-1.5 text-rose-300">{formatINR(r.interest)}</td>
                            <td className="px-4 py-1.5">{formatINR(r.closing)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-slate-700 text-slate-100">
                        <tr>
                          <td className="px-4 py-2 text-left" colSpan={2}>
                            Total interest (server)
                          </td>
                          <td className="px-4 py-2 text-rose-300">{formatINR(report.penaltyAmountInr)}</td>
                          <td className="px-4 py-2">{formatINR(facts.principal + report.penaltyAmountInr)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Panel>
              )}

              <Panel
                title="Statutory demand notice"
                subtitle="Draft for review by the claimant or counsel before dispatch"
                actions={
                  <>
                    <CopyButton text={toMarkdown(report.demandNoticeDraft)} label="Copy Markdown" />
                    <Btn onClick={printNotice} icon={<Printer className="h-3 w-3" />}>
                      Print formatted notice
                    </Btn>
                    <Btn onClick={() => setNoticeOpen((o) => !o)} icon={<Scale className="h-3 w-3" />}>
                      {noticeOpen ? "Hide" : "View"}
                    </Btn>
                  </>
                }
              >
                {noticeOpen ? (
                  <div className="print-area">
                    <h3 className="mb-3 hidden text-lg font-bold print:block">Statutory Demand Notice — MSMED Act, 2006 (§15–17)</h3>
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-950/70 p-4 font-mono text-xs leading-relaxed text-slate-300 print:max-h-none print:border-0 print:bg-white print:p-0 print:text-black">
                      {report.demandNoticeDraft}
                    </pre>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Notice drafted ({report.demandNoticeDraft.length.toLocaleString("en-IN")} characters). Open to review.</p>
                )}
              </Panel>

              <div className="flex items-center justify-between gap-2">
                {latency !== null && <span className="font-mono text-[11px] text-slate-500">HTTP 200 · {latency} ms</span>}
              </div>
              <JsonDrawer title="POST /api/payments/track" data={report} filename="payment-recovery.json" />
            </>
          ) : (
            <EmptyState
              icon={<Calculator className="h-8 w-8" />}
              title="No documents processed"
              body="Upload the invoice and delivery challan to see the 45-day timeline, month-by-month interest at 19.5% p.a. and a draft demand notice."
            />
          )}
        </div>
      </div>
    </PageShell>
  );
}
