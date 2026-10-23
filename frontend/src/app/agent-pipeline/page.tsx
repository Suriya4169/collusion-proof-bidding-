"use client";

import { Fragment, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, GitBranch, Loader2, XCircle } from "lucide-react";
import { Btn, EmptyState, ErrorNotice, JsonDrawer, PageHeader, PageShell, Panel, PdfDropzone, Pill, Stat, type Tone } from "@/components/ui";
import { apiRequest, errorMessage, type OrchestratorResponse } from "@/lib/api";

interface NodeDef {
  n: number;
  id: string;
  label: string;
  role: string;
}

const NODES: NodeDef[] = [
  { n: 1, id: "pdf_extractor", label: "PyMuPDF Extractor", role: "Raw text extraction" },
  { n: 2, id: "rag_retriever", label: "Ephemeral RAG", role: "Hybrid chunk + dense retrieval" },
  { n: 3, id: "neural_extractor", label: "Gemini LLM", role: "Typed rule extraction (Pydantic)" },
  { n: 4, id: "symbolic_verifier", label: "Symbolic Verifier", role: "Deterministic eligibility + CDS" },
  { n: 5, id: "tender_simplifier", label: "Tender Simplifier", role: "Plain-language + Hindi summary" },
  { n: 6, id: "scheme_discoverer", label: "Scheme Discoverer", role: "Gap-bridging schemes" },
];

type NodeState = "pending" | "running" | "done" | "error";

interface LogLine {
  node: number | null;
  text: string;
  isError: boolean;
}

function parseLogs(logs: string[]): LogLine[] {
  return logs.map((text) => {
    const m = /^Node (\d+)( Error)?:/.exec(text);
    return { node: m ? Number(m[1]) : null, text, isError: Boolean(m?.[2]) };
  });
}

function nodeState(n: number, lines: LogLine[]): NodeState {
  const mine = lines.filter((l) => l.node === n);
  if (mine.some((l) => l.isError)) return "error";
  return mine.length > 0 ? "done" : "pending";
}

/** Extracts character counts that the backend nodes report in their logs. */
function tokenTelemetry(lines: LogLine[]) {
  const extracted = lines.map((l) => /Extracted (\d+) characters/.exec(l.text)).find(Boolean);
  const filtered = lines.map((l) => /Filtered context to (\d+) characters/.exec(l.text)).find(Boolean);
  if (!extracted || !filtered) return null;
  const full = Number(extracted[1]);
  const kept = Number(filtered[1]);
  return { full, kept, reduction: full > 0 ? (1 - kept / full) * 100 : 0 };
}

const STATE_TONE: Record<NodeState, Tone> = { pending: "neutral", running: "info", done: "pass", error: "fail" };

function StateIcon({ s }: { s: NodeState }) {
  if (s === "running") return <Loader2 className="h-4 w-4 animate-spin text-sky-400" />;
  if (s === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (s === "error") return <XCircle className="h-4 w-4 text-rose-400" />;
  return <Circle className="h-4 w-4 text-slate-600" />;
}

export default function AgentPipelinePage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OrchestratorResponse | null>(null);
  const [finishedAt, setFinishedAt] = useState<Date | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setStartedAt(new Date());
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await apiRequest<OrchestratorResponse>("/api/orchestrator/analyze", { method: "POST", body: form });
      setResult(res.data);
      setLatency(res.latencyMs);
      setFinishedAt(new Date());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const lines = useMemo(() => parseLogs(result?.orchestration_logs ?? []), [result]);
  const telemetry = useMemo(() => tokenTelemetry(lines), [lines]);
  const states = NODES.map((nd) => (busy ? "running" : nodeState(nd.n, lines)) as NodeState);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Orchestration · LangGraph StateGraph"
        title="Multi-Agent Pipeline Visualizer"
        subtitle="Runs a tender through the compiled six-node LangGraph workflow and shows what each node reported. Execution is linear: any node error short-circuits the remaining nodes."
        statutes={["POST /api/orchestrator/analyze", "StateGraph · 6 nodes · 5 edges → END"]}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Panel title="Pipeline input">
          <div className="space-y-3">
            <PdfDropzone label="Tender PDF" file={file} onFile={setFile} disabled={busy} />
            <Btn variant="primary" className="w-full" disabled={!file || busy} onClick={run} icon={<GitBranch className="h-3.5 w-3.5" />}>
              {busy ? "Graph executing…" : "Execute pipeline"}
            </Btn>
            <p className="text-[11px] leading-relaxed text-slate-500">
              The backend returns node logs when the graph finishes, so node status resolves after completion rather than streaming. Default bidder profile is used.
            </p>
          </div>
        </Panel>

        <div className="min-w-0 space-y-4">
          <Panel title="StateGraph topology" subtitle={busy ? "Executing — awaiting node logs" : result ? "Execution complete" : "Idle"}>
            <div className="flex flex-col gap-2 xl:flex-row xl:items-stretch">
              {NODES.map((nd, i) => (
                <Fragment key={nd.id}>
                  <div
                    className={`flex-1 rounded border px-3 py-2.5 ${
                      states[i] === "done"
                        ? "border-emerald-900/60 bg-emerald-950/15"
                        : states[i] === "error"
                          ? "border-rose-900/60 bg-rose-950/20"
                          : states[i] === "running"
                            ? "border-sky-900/60 bg-sky-950/15"
                            : "border-slate-800 bg-slate-950/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10.5px] text-slate-500">NODE {nd.n}</span>
                      <StateIcon s={states[i]} />
                    </div>
                    <div className="mt-1 text-[13px] font-medium text-slate-100">{nd.label}</div>
                    <div className="text-[11px] leading-snug text-slate-500">{nd.role}</div>
                    <div className="mt-1.5 font-mono text-[10px] text-slate-600">{nd.id}</div>
                  </div>
                  {i < NODES.length - 1 && <ArrowRight className="hidden h-4 w-4 shrink-0 self-center text-slate-600 xl:block" />}
                </Fragment>
              ))}
            </div>
          </Panel>

          {error && <ErrorNotice message={error} onRetry={file ? run : undefined} />}

          {result ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Nodes completed" value={`${states.filter((s) => s === "done").length}/6`} tone={states.every((s) => s === "done") ? "pass" : "warn"} />
                <Stat label="Wall time" value={latency === null ? "—" : `${(latency / 1000).toFixed(2)} s`} hint="request round-trip" />
                <Stat label="Context reduction" value={telemetry ? `${telemetry.reduction.toFixed(1)}%` : "—"} tone={telemetry && telemetry.reduction >= 90 ? "pass" : "neutral"} hint="characters sent to LLM vs. document" />
                <Stat label="Schemes found" value={result.recommended_schemes.length} />
              </div>

              <Panel title="Node execution log" subtitle={startedAt && finishedAt ? `${startedAt.toLocaleTimeString("en-IN", { hour12: false })} → ${finishedAt.toLocaleTimeString("en-IN", { hour12: false })} (per-node timestamps are not emitted by the backend)` : undefined} flush>
                <ol className="divide-y divide-slate-800/70 font-mono text-[11.5px]">
                  {lines.map((l, i) => {
                    const nd = NODES.find((x) => x.n === l.node);
                    return (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-3 px-4 py-1.5">
                        <span className="w-8 text-slate-600">{String(i + 1).padStart(2, "0")}</span>
                        <span className="w-36 shrink-0 text-slate-500">{nd?.id ?? "—"}</span>
                        <span className={l.isError ? "text-rose-300" : "text-slate-300"}>{l.text.replace(/^Node \d+( Error)?:\s*/, "")}</span>
                      </li>
                    );
                  })}
                </ol>
              </Panel>

              {telemetry && (
                <Panel title="Ephemeral RAG token telemetry" subtitle="Derived from the node 1 and node 2 log lines">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="w-28 text-slate-500">Full document</span>
                      <div className="h-2 flex-1 rounded bg-slate-600" />
                      <span className="w-28 text-right font-mono text-slate-300">{telemetry.full.toLocaleString("en-IN")} chars</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="w-28 text-slate-500">Retrieved context</span>
                      <div className="flex-1">
                        <div className="h-2 rounded bg-sky-500" style={{ width: `${Math.max(0.5, (telemetry.kept / telemetry.full) * 100)}%` }} />
                      </div>
                      <span className="w-28 text-right font-mono text-sky-300">{telemetry.kept.toLocaleString("en-IN")} chars</span>
                    </div>
                    <Pill tone={telemetry.reduction >= 90 ? "pass" : "info"} mono>
                      −{telemetry.reduction.toFixed(1)}% LLM input
                    </Pill>
                  </div>
                </Panel>
              )}

              <JsonDrawer title="POST /api/orchestrator/analyze" data={result} filename="orchestrator-run.json" />
            </>
          ) : (
            !busy &&
            !error && <EmptyState icon={<GitBranch className="h-8 w-8" />} title="Graph not executed" body="Upload a tender PDF and execute the pipeline to see per-node status, logs and token-reduction telemetry." />
          )}
        </div>
      </div>
    </PageShell>
  );
}
