"use client";

import { useMemo, useState } from "react";
import { KeyRound, Send, Server } from "lucide-react";
import { Btn, EmptyState, ErrorNotice, JsonDrawer, PageHeader, PageShell, Panel, Pill, Stat, type Tone } from "@/components/ui";
import { API_BASE, ApiError, apiRequest, errorMessage, type M2MPushResponse, type M2MTenderPush } from "@/lib/api";

type OpId = "push" | "compliance" | "subscribe";

interface Operation {
  id: OpId;
  label: string;
  method: "GET" | "POST";
  path: (p: { tenderId: string; msmeId: string }) => string;
  body?: unknown;
}

const SAMPLE_PUSH: M2MTenderPush = {
  tender_id: `GEM/2026/B/${Math.floor(9_000_000 + Math.random() * 999_999)}`,
  title: "Automated Procurement of Critical Server Blades",
  department: "Ministry of Electronics and Information Technology",
  category: "IT Services",
  estimated_value_inr: "₹ 4.5 Crores",
  emd_amount_inr: 150000,
  min_turnover_lakhs: 350,
  min_experience_years: 3,
  allows_startup_exemption: true,
  submission_deadline: "2026-12-15",
};

const OPERATIONS: Operation[] = [
  { id: "push", label: "Push tender", method: "POST", path: () => "/api/m2m/v1/tenders/push", body: SAMPLE_PUSH },
  { id: "compliance", label: "Query compliance", method: "GET", path: ({ tenderId, msmeId }) => `/api/m2m/v1/compliance/${encodeURIComponent(tenderId)}/${encodeURIComponent(msmeId)}` },
  {
    id: "subscribe",
    label: "Subscribe webhook",
    method: "POST",
    path: () => "/api/m2m/v1/webhooks/subscribe",
    body: { callback_url: "https://gem.gov.in/api/webhooks/procureguard-event", event_types: ["TENDER_ANALYZE_COMPLETED", "CORRIGENDUM_DETECTED"], secret_token: "" },
  },
];

interface TxRecord {
  id: number;
  at: Date;
  method: string;
  path: string;
  status: number | null;
  latencyMs: number | null;
  ingestion: string;
  signature: string;
  response: unknown;
}

/** HMAC-SHA256 hex of the payload keyed with the console's API key (WebCrypto). */
async function hmacHex(key: string, message: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
    return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "unavailable (insecure context)";
  }
}

function statusTone(s: number | null): Tone {
  return s === null ? "fail" : s < 300 ? "pass" : s < 500 ? "warn" : "fail";
}

export default function M2MGatewayPage() {
  const [apiKey, setApiKey] = useState("");
  const [opId, setOpId] = useState<OpId>("push");
  const [bodies, setBodies] = useState<Record<OpId, string>>({
    push: JSON.stringify(SAMPLE_PUSH, null, 2),
    compliance: "",
    subscribe: JSON.stringify(OPERATIONS[2].body, null, 2),
  });
  const [tenderId, setTenderId] = useState(SAMPLE_PUSH.tender_id);
  const [msmeId, setMsmeId] = useState("M101");
  const [stream, setStream] = useState<TxRecord[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const op = OPERATIONS.find((o) => o.id === opId) as Operation;
  const path = op.path({ tenderId, msmeId });

  const send = async () => {
    setError(null);
    let payload: string | undefined;
    if (op.method === "POST") {
      try {
        payload = JSON.stringify(JSON.parse(bodies[opId]));
      } catch {
        setError("Request body is not valid JSON.");
        return;
      }
    }
    setBusy(true);
    const headers: Record<string, string> = { "X-ProcureGuard-Key": apiKey };
    if (payload) headers["Content-Type"] = "application/json";
    const signature = await hmacHex(apiKey || "unkeyed", payload ?? path);

    const base = { id: Date.now(), at: new Date(), method: op.method, path, signature };
    try {
      const res = await apiRequest<unknown>(path, { method: op.method, headers, body: payload });
      const ingestion = opId === "push" ? (res.data as M2MPushResponse).status : opId === "subscribe" ? "ACTIVE" : (res.data as { is_eligible?: boolean }).is_eligible ? "ELIGIBLE" : "INELIGIBLE";
      const rec: TxRecord = { ...base, status: res.status, latencyMs: res.latencyMs, ingestion, response: res.data };
      setStream((s) => [rec, ...s].slice(0, 50));
      setSelected(rec.id);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : null;
      const rec: TxRecord = { ...base, status, latencyMs: null, ingestion: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "REJECTED" : status === null ? "UNREACHABLE" : "ERROR", response: { error: errorMessage(e) } };
      setStream((s) => [rec, ...s].slice(0, 50));
      setSelected(rec.id);
      if (status === null) setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => {
    const ok = stream.filter((t) => t.status !== null && t.status < 300);
    const lat = ok.map((t) => t.latencyMs ?? 0);
    return { total: stream.length, ok: ok.length, avg: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null };
  }, [stream]);

  const current = stream.find((t) => t.id === selected);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Sovereign integration · M2M"
        title="Machine-to-Machine Gateway Console"
        subtitle="Exercise the server-to-server API that GeM / CPPP use to push tenders, query bidder compliance and subscribe to integrity events. Every call is authenticated with the X-ProcureGuard-Key header."
        statutes={["IT Act 2000 §3A — authentication", "MeitY Interoperability Framework", `${API_BASE}/api/m2m/v1`]}
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Transactions" value={stats.total} />
        <Stat label="Accepted (2xx)" value={stats.ok} tone={stats.ok ? "pass" : "neutral"} />
        <Stat label="Mean latency" value={stats.avg === null ? "—" : `${stats.avg} ms`} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Panel title="Request composer" subtitle="Calls are sent from this browser to the backend">
          <div className="space-y-3">
            <div>
              <label htmlFor="m2m-key" className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                <KeyRound className="h-3 w-3" /> X-ProcureGuard-Key
              </label>
              <input
                id="m2m-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste the M2M master key (M2M_MASTER_KEY)"
                className="w-full rounded border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-600"
              />
              <p className="mt-1 text-[11px] text-slate-500">Held in memory only. Leave blank to confirm the gateway rejects unauthenticated calls (401).</p>
            </div>

            <div role="tablist" className="flex rounded border border-slate-800 bg-slate-950 p-0.5 text-[11px]">
              {OPERATIONS.map((o) => (
                <button
                  key={o.id}
                  role="tab"
                  aria-selected={opId === o.id}
                  onClick={() => setOpId(o.id)}
                  className={`flex-1 rounded-sm px-2 py-1 font-medium ${opId === o.id ? "bg-slate-700/70 text-slate-50" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <div className="rounded border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 font-mono text-[11px] text-slate-300">
              <span className="text-sky-400">{op.method}</span> {path}
            </div>

            {opId === "compliance" ? (
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Tender ID", tenderId, setTenderId],
                  ["MSME ID", msmeId, setMsmeId],
                ].map(([label, value, set]) => (
                  <label key={label as string} className="text-[11px] text-slate-500">
                    {label as string}
                    <input
                      value={value as string}
                      onChange={(e) => (set as (v: string) => void)(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-2 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-sky-600"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                aria-label="Request body"
                rows={13}
                spellCheck={false}
                value={bodies[opId]}
                onChange={(e) => setBodies((b) => ({ ...b, [opId]: e.target.value }))}
                className="w-full resize-y rounded border border-slate-700 bg-slate-950/60 p-2.5 font-mono text-[11px] leading-relaxed text-slate-200 outline-none focus:border-sky-600"
              />
            )}

            {error && <ErrorNotice message={error} />}
            <Btn variant="primary" className="w-full" disabled={busy} onClick={send} icon={<Send className="h-3.5 w-3.5" />}>
              {busy ? "Sending…" : "Send request"}
            </Btn>
          </div>
        </Panel>

        <div className="min-w-0 space-y-4">
          <Panel title="Live M2M transaction stream" subtitle="Most recent first · signature = HMAC-SHA256 of payload keyed with the console key (client-computed, informational)" flush>
            {stream.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={<Server className="h-8 w-8" />} title="No transactions yet" body="Send a request from the composer to see status, latency, ingestion result and payload signature." />
              </div>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-900 text-[10.5px] uppercase tracking-wider text-slate-500">
                    <tr className="border-b border-slate-800">
                      <th className="px-4 py-2 font-medium">Time</th>
                      <th className="px-4 py-2 font-medium">Request</th>
                      <th className="px-4 py-2 font-medium">HTTP</th>
                      <th className="px-4 py-2 text-right font-medium">Latency</th>
                      <th className="px-4 py-2 font-medium">Ingestion</th>
                      <th className="px-4 py-2 font-medium">HMAC SHA-256</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {stream.map((t) => (
                      <tr key={t.id} onClick={() => setSelected(t.id)} className={`cursor-pointer hover:bg-slate-800/40 ${selected === t.id ? "bg-slate-800/50" : ""}`}>
                        <td className="whitespace-nowrap px-4 py-2 font-mono text-slate-400">{t.at.toLocaleTimeString("en-IN", { hour12: false })}</td>
                        <td className="max-w-[240px] truncate px-4 py-2 font-mono text-slate-200">
                          <span className="text-sky-400">{t.method}</span> {t.path.replace("/api/m2m/v1", "")}
                        </td>
                        <td className="px-4 py-2">
                          <Pill tone={statusTone(t.status)} mono>
                            {t.status ?? "ERR"}
                          </Pill>
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-300">{t.latencyMs === null ? "—" : `${t.latencyMs} ms`}</td>
                        <td className="px-4 py-2 font-mono text-[11px] text-slate-300">{t.ingestion}</td>
                        <td className="px-4 py-2 font-mono text-[11px] text-slate-500" title={t.signature}>
                          {t.signature.length > 20 ? `${t.signature.slice(0, 16)}…${t.signature.slice(-6)}` : t.signature}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          {current && <JsonDrawer title={`Response · ${current.method} ${current.path.replace("/api/m2m/v1", "")}`} data={current.response} filename="m2m-response.json" />}
        </div>
      </div>
    </PageShell>
  );
}
