"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Flag, RefreshCw } from "lucide-react";
import { Btn, EmptyState, ErrorNotice, Panel, Pill, Spinner, Stat, type Tone } from "./ui";
import {
  AGENT4_CATEGORY_TONE,
  apiRequest,
  errorMessage,
  type BehaviorSignal,
  type BehaviorSignalList,
  type BehaviorSummary,
  type ReviewState,
} from "@/lib/api";

const TABS: { state: ReviewState; label: string }[] = [
  { state: "pending", label: "Pending" },
  { state: "escalated", label: "Escalated" },
  { state: "cleared", label: "Cleared" },
];

const MIN_FOR_RATE = 20; // below this many scored signals the flag rate is noise, so it is not coloured

const STATUS_LABEL: Record<string, string> = {
  scored: "Scored",
  insufficient_data: "Too few keystrokes",
  no_timing: "No timing received",
  invalid_timing: "Malformed timing",
  unavailable: "Model unavailable",
};

function statusTone(s: BehaviorSignal): Tone {
  if (s.status === "scored") return AGENT4_CATEGORY_TONE[s.risk_category ?? ""] ?? "neutral";
  return s.status === "no_timing" || s.status === "invalid_timing" ? "warn" : "neutral";
}

/**
 * Reviewer queue for Agent 4 signals. A signal is evidence for a person to look at, never a verdict: this panel
 * records a decision (cleared / escalated) with a note and keeps an audit trail. Nothing here touches a bid.
 */
export default function BehaviorReviewQueue() {
  const [tab, setTab] = useState<ReviewState>("pending");
  const [reloadKey, setReloadKey] = useState(0);
  const [summary, setSummary] = useState<BehaviorSummary | null>(null);
  const [signals, setSignals] = useState<BehaviorSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  // Fetch whenever the tab changes or a reload is requested. State is only set after the request completes, and a
  // response that arrives after the tab changed again is ignored.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sum, list] = await Promise.all([
          apiRequest<BehaviorSummary>("/api/behavior/summary"),
          apiRequest<BehaviorSignalList>(`/api/behavior/signals?review_state=${tab}&limit=50`),
        ]);
        if (cancelled) return;
        setSummary(sum.data);
        setSignals(list.data.signals);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const switchTab = (state: ReviewState) => {
    setLoading(true);
    setTab(state);
  };

  const decide = async (id: number, decision: "cleared" | "escalated") => {
    setSavingId(id);
    setError(null);
    try {
      await apiRequest(`/api/behavior/signals/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: notes[id]?.trim() || null }),
      });
      setNotes((n) => {
        const next = { ...n };
        delete next[id];
        return next;
      });
      reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSavingId(null);
    }
  };

  const rate = summary?.flag_rate;
  const expected = summary?.expected_flag_rate_for_genuine_users ?? 0.05;

  return (
    <div className="space-y-4" aria-label="Review queue">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Review queue</h2>
          <p className="text-xs text-slate-500">
            Signals recorded when bids were submitted. A score is evidence for a person to look at, not a verdict, and nothing here changes a bid.
          </p>
        </div>
        <Btn onClick={reload} disabled={loading} icon={<RefreshCw className="h-3 w-3" />}>
          Refresh
        </Btn>
      </div>

      {error && <ErrorNotice message={error} onRetry={reload} />}

      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Pending review" value={summary.pending_review} tone={summary.pending_review > 0 ? "warn" : "neutral"} />
          <Stat label="Escalated" value={summary.escalated} />
          <Stat label="Cleared" value={summary.cleared} />
          <Stat
            label="Flag rate"
            value={rate === null || rate === undefined ? "—" : `${(rate * 100).toFixed(1)}%`}
            hint={`of ${summary.scored} scored · about ${(expected * 100).toFixed(0)}% expected for genuine users${summary.scored < MIN_FOR_RATE ? " · too few to judge" : ""}`}
            tone={rate !== null && rate !== undefined && summary.scored >= MIN_FOR_RATE && rate > expected * 2 ? "warn" : "neutral"}
          />
        </div>
      )}

      <div role="tablist" aria-label="Review state" className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.state}
            role="tab"
            aria-selected={tab === t.state}
            onClick={() => switchTab(t.state)}
            className={`rounded border px-3 py-1 text-xs font-medium ${
              tab === t.state ? "border-sky-600 bg-sky-600/20 text-sky-200" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <Spinner label="Loading signals" />}

      {!loading && signals.length === 0 && !error && (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8" />}
          title={tab === "pending" ? "Nothing waiting for review" : `No ${tab} signals`}
          body="Signals appear here when a submitted bid carries an unusual typing pattern, or arrives with no typing data at all."
        />
      )}

      {!loading && signals.length > 0 && (
        <ul className="space-y-3">
          {signals.map((s) => (
            <li key={s.id}>
              <Panel
                title={s.reference}
                subtitle={`${s.created_at} · session ${s.session_id}`}
                actions={
                  <div className="flex items-center gap-2">
                    {s.risk_category && <Pill tone={statusTone(s)} mono>{s.risk_category}</Pill>}
                    <Pill tone={statusTone(s)}>{STATUS_LABEL[s.status] ?? s.status}</Pill>
                  </div>
                }
              >
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-400">
                  <span>
                    Risk <span className="font-mono text-slate-100">{s.behavioral_risk_score !== null ? s.behavioral_risk_score.toFixed(1) : "—"}</span> / 100
                  </span>
                  <span>Reliability <span className="capitalize text-slate-200">{s.reliability ?? "n/a"}</span></span>
                  <span>Keystrokes <span className="font-mono text-slate-200">{s.events_received}</span></span>
                  {s.msme_id && <span>Enterprise <span className="font-mono text-slate-200">{s.msme_id}</span></span>}
                </div>

                {s.behavioral_evidence.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {s.behavioral_evidence.map((e, i) => (
                      <li key={i} className="rounded border border-slate-800 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-300">{e}</li>
                    ))}
                  </ul>
                ) : (
                  s.message && <p className="mt-2 text-xs leading-relaxed text-slate-400">{s.message}</p>
                )}

                {s.review_state === "pending" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      aria-label={`Note for ${s.reference}`}
                      value={notes[s.id] ?? ""}
                      maxLength={500}
                      onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                      placeholder="Optional note for other reviewers"
                      className="min-w-[220px] flex-1 rounded border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-600"
                    />
                    <Btn disabled={savingId === s.id} onClick={() => decide(s.id, "cleared")} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                      Clear
                    </Btn>
                    <Btn variant="danger" disabled={savingId === s.id} onClick={() => decide(s.id, "escalated")} icon={<Flag className="h-3.5 w-3.5" />}>
                      Escalate
                    </Btn>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">
                    {s.review_state === "escalated" ? "Escalated" : "Cleared"} by {s.reviewed_by} on {s.reviewed_at}
                    {s.review_note ? `: ${s.review_note}` : "."}
                  </p>
                )}
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
