"use client";

import { useRef, useState } from "react";
import { Bot, Fingerprint, RotateCcw } from "lucide-react";
import { Btn, ErrorNotice, JsonDrawer, PageHeader, PageShell, Panel, Pill, Spinner, Stat, riskTone, toneText, type Tone } from "@/components/ui";
import { apiRequest, errorMessage, type BehaviorResponse } from "@/lib/api";

const MIN_EVENTS = 5;
const BOT_INTERVAL_MS = 12;
const BOT_HOLD_MS = 8;
const BOT_EVENTS = 45;

interface Capture {
  intervals: number[];
  holds: number[];
}

const RELIABILITY_TONE: Record<string, Tone> = { high: "pass", medium: "warn", low: "fail" };

function mean(a: number[]): number {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
}
function cv(a: number[]): number {
  const m = mean(a);
  if (!m) return 0;
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2))) / m;
}

function Bars({ values, label, color }: { values: number[]; label: string; color: string }) {
  const shown = values.slice(-48);
  const max = Math.max(1, ...shown);
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10.5px] uppercase tracking-wider text-slate-500">
        <span>{label}</span>
        <span className="font-mono normal-case">
          n={values.length} · μ={mean(values).toFixed(1)} ms · CV={cv(values).toFixed(2)}
        </span>
      </div>
      <svg viewBox="0 0 192 40" preserveAspectRatio="none" className="h-14 w-full rounded border border-slate-800 bg-slate-950/60" role="img" aria-label={label}>
        {shown.map((v, i) => {
          const h = Math.max(1, (v / max) * 36);
          return <rect key={i} x={i * 4 + 0.5} y={38 - h} width="3" height={h} fill={color} opacity="0.85" />;
        })}
      </svg>
    </div>
  );
}

export default function BotDetectionPage() {
  const [text, setText] = useState("");
  const [capture, setCapture] = useState<Capture>({ intervals: [], holds: [] });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BehaviorResponse | null>(null);
  const [request, setRequest] = useState<unknown>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downAt = useRef<Record<string, number>>({});
  const lastRelease = useRef<number | null>(null);
  const intervalsRef = useRef<number[]>([]);
  const holdsRef = useRef<number[]>([]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.repeat) return;
    const now = performance.now();
    downAt.current[e.code] = now;
    // First keystroke has no preceding release; use a neutral onset latency.
    intervalsRef.current.push(lastRelease.current === null ? 100 : Number(Math.max(0, now - lastRelease.current).toFixed(2)));
  };

  const onKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const now = performance.now();
    lastRelease.current = now;
    const start = downAt.current[e.code];
    if (start !== undefined) {
      holdsRef.current.push(Number(Math.max(1, now - start).toFixed(2)));
      delete downAt.current[e.code];
    }
    setCapture({ intervals: [...intervalsRef.current], holds: [...holdsRef.current] });
  };

  const reset = () => {
    setText("");
    intervalsRef.current = [];
    holdsRef.current = [];
    lastRelease.current = null;
    downAt.current = {};
    setCapture({ intervals: [], holds: [] });
    setResult(null);
    setRequest(null);
    setError(null);
  };

  const submit = async (intervals: number[], holds: number[]) => {
    const n = Math.min(intervals.length, holds.length);
    if (n < MIN_EVENTS) {
      setError(`Only ${n} timing events captured; at least ${MIN_EVENTS} are required (type roughly 15–20 characters).`);
      return;
    }
    const body = { session_id: `bid-session-${Date.now()}`, intervals: intervals.slice(0, n), hold_durations: holds.slice(0, n) };
    setBusy(true);
    setError(null);
    setRequest(body);
    try {
      const res = await apiRequest<BehaviorResponse>("/api/behavior/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setResult(res.data);
      setLatency(res.latencyMs);
    } catch (e) {
      setResult(null);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const simulateBot = () => {
    reset();
    const intervals = Array<number>(BOT_EVENTS).fill(BOT_INTERVAL_MS);
    const holds = Array<number>(BOT_EVENTS).fill(BOT_HOLD_MS);
    setText("AUTOMATED_BID_INJECTION_RATE_INR_4800000");
    setCapture({ intervals, holds });
    submit(intervals, holds);
  };

  const score = result?.behavioral_risk_score;
  const tone = riskTone(score ?? 0);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Agent 4 · Behavioural biometrics"
        title="Bot Detection & Keystroke Dynamics"
        subtitle="Scores release-to-press latency and key-hold durations to separate human bidders from scripted submissions. Typed characters are never transmitted — only timing."
        statutes={["IT Act 2000 §43 / §66", "DPDP Act 2023 — timing-only telemetry", "Competition Act 2002 §3(3)(d)"]}
        actions={
          <>
            <Btn variant="danger" onClick={simulateBot} disabled={busy} icon={<Bot className="h-3.5 w-3.5" />}>
              Simulate automated script bot ({BOT_INTERVAL_MS} ms)
            </Btn>
            <Btn onClick={reset} icon={<RotateCcw className="h-3 w-3" />}>
              Reset
            </Btn>
          </>
        }
      />

      {error && <ErrorNotice message={error} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Typing sandbox" subtitle="Compose a bid declaration naturally; capture is local until you submit">
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            aria-label="Typing sandbox"
            placeholder="We hereby confirm compliance with all technical specifications for GeM/2026/B/9292805…"
            className="w-full resize-y rounded border border-slate-700 bg-slate-950/60 p-3 font-mono text-xs leading-relaxed text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-600"
          />
          <div className="mt-3 space-y-3">
            <Bars values={capture.intervals} label="Flight time · release → press (intervals)" color="#38bdf8" />
            <Bars values={capture.holds} label="Dwell time · key down → up (hold_durations)" color="#a78bfa" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-slate-500">
              {Math.min(capture.intervals.length, capture.holds.length)} / {MIN_EVENTS} min events
            </span>
            <Btn variant="primary" disabled={busy} onClick={() => submit(intervalsRef.current, holdsRef.current)} icon={<Fingerprint className="h-3.5 w-3.5" />}>
              {busy ? "Scoring…" : "Score session"}
            </Btn>
          </div>
        </Panel>

        <div className="space-y-4">
          {busy && <Spinner label="Scoring timing distribution" />}
          {result && !busy ? (
            <>
              <Panel
                title="Behavioural risk"
                subtitle={`${result.session_id}`}
                actions={
                  <Pill tone={tone} mono>
                    {result.risk_category ?? result.status.toUpperCase()}
                  </Pill>
                }
              >
                <div className="flex items-end justify-between">
                  <div className={`font-mono text-4xl font-semibold tabular-nums ${toneText[tone]}`}>
                    {score !== undefined ? score.toFixed(1) : "—"}
                    <span className="text-base text-slate-500"> / 100</span>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    {result.behavioral_anomaly ? "Flagged for human audit" : "Within genuine-human band"}
                  </div>
                </div>
                <div className="relative mt-3 h-2.5 rounded bg-slate-800" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score ?? 0} aria-label="Behavioural risk">
                  <div
                    className={`h-full rounded ${tone === "fail" ? "bg-rose-500" : tone === "warn" ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${score ?? 0}%`, transition: "width 500ms ease" }}
                  />
                  {[40, 70].map((t) => (
                    <span key={t} className="absolute top-[-3px] h-4 w-px bg-slate-500" style={{ left: `${t}%` }} />
                  ))}
                </div>
                <div className="mt-1 flex justify-between font-mono text-[9.5px] text-slate-600">
                  <span>0</span>
                  <span style={{ marginLeft: "28%" }}>40 moderate</span>
                  <span>70 high</span>
                  <span>100</span>
                </div>
              </Panel>

              <div className="grid grid-cols-3 gap-3">
                <Stat label="Reliability" value={<span className="capitalize">{result.reliability ?? "n/a"}</span>} tone={RELIABILITY_TONE[result.reliability ?? ""] ?? "neutral"} />
                <Stat label="Events scored" value={`${result.events_scored}/${result.events_received}`} />
                <Stat label="Mode" value={<span className="text-base uppercase">{result.scoring_mode}</span>} hint={result.model_version} />
              </div>

              <Panel title="Forensic telemetry evidence">
                {result.behavioral_evidence.length ? (
                  <ul className="space-y-1.5">
                    {result.behavioral_evidence.map((e, i) => (
                      <li key={i} className="flex gap-2 rounded border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs leading-relaxed text-slate-300">
                        <span className="font-mono text-slate-600">{String(i + 1).padStart(2, "0")}</span>
                        {e}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">{result.message ?? "No anomalous signals reported."}</p>
                )}
              </Panel>
              {latency !== null && <div className="font-mono text-[11px] text-slate-500">HTTP 200 · {latency} ms</div>}
            </>
          ) : (
            !busy && (
              <Panel>
                <p className="py-16 text-center text-xs text-slate-500">Type in the sandbox and score the session, or run the automated-bot simulation to see a high-risk verdict.</p>
              </Panel>
            )
          )}
        </div>
      </div>

      {(request !== null || result !== null) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {request !== null && <JsonDrawer title="Request · POST /api/behavior/analyze" data={request} filename="behavior-request.json" />}
          {result && <JsonDrawer title="Response" data={result} filename="behavior-response.json" />}
        </div>
      )}
    </PageShell>
  );
}
