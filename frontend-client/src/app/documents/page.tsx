"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BellRing, FileCheck2, Trash2, UserPlus } from "lucide-react";
import RegisterMsmeModal from "@/components/RegisterMsmeModal";
import { Btn, ErrorNotice, Gauge, JsonDrawer, PageHeader, PageShell, Panel, PdfDropzone, Pill, Spinner, scoreTone, type Tone } from "@/components/ui";
import { apiRequest, errorMessage, setActiveMsmeId, type MsmeSummary, type VaultData, type VaultDoc } from "@/lib/api";

/** Mirrors STANDARD_CHECKLIST in backend/src/api/routes/documents.py. */
const CHECKLIST_META: Record<string, { mandatory: boolean; authority: string }> = {
  "Udyam Certificate": { mandatory: true, authority: "Ministry of MSME" },
  "GST Registration": { mandatory: true, authority: "CBIC · GSTIN (REG-06)" },
  "PAN Card": { mandatory: true, authority: "Income Tax Dept." },
  "ISO 9001": { mandatory: false, authority: "QMS certification body" },
  "Last 3 Years ITR": { mandatory: true, authority: "CA-audited returns" },
  "Solvency Certificate": { mandatory: false, authority: "Scheduled bank · ≤ 6 months old" },
  "Bank Statement": { mandatory: true, authority: "Scheduled bank · last 6 months" },
};
const DOC_TYPES = Object.keys(CHECKLIST_META);
const EXPIRY_WARN_DAYS = 90;
const MS_DAY = 86_400_000;

type ExpiryState = "valid" | "expiring" | "expired" | "perpetual" | "missing";

interface Row {
  doc: VaultDoc;
  state: ExpiryState;
  daysLeft: number | null;
}

function classify(doc: VaultDoc, now: number): Row {
  if (!doc.is_uploaded) return { doc, state: "missing", daysLeft: null };
  const t = doc.expiry_date ? Date.parse(doc.expiry_date) : Number.NaN;
  if (Number.isNaN(t)) return { doc, state: "perpetual", daysLeft: null };
  const daysLeft = Math.ceil((t - now) / MS_DAY);
  return { doc, state: daysLeft < 0 ? "expired" : daysLeft <= EXPIRY_WARN_DAYS ? "expiring" : "valid", daysLeft };
}

const STATE_VIEW: Record<ExpiryState, { tone: Tone; label: string }> = {
  valid: { tone: "pass", label: "VALID" },
  perpetual: { tone: "pass", label: "NO EXPIRY" },
  expiring: { tone: "warn", label: "EXPIRING" },
  expired: { tone: "fail", label: "EXPIRED" },
  missing: { tone: "fail", label: "MISSING" },
};

function VaultContent() {
  const params = useSearchParams();
  const [msmeId, setMsmeId] = useState(params.get("msme_id") ?? "M101");
  const [msmes, setMsmes] = useState<MsmeSummary[]>([]);
  const [vault, setVault] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [docType, setDocType] = useState(DOC_TYPES[3]);
  const [expiry, setExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => setNow(Date.now()), []);

  const loadMsmes = useCallback(async () => {
    try {
      setMsmes((await apiRequest<MsmeSummary[]>("/api/msme/all")).data);
    } catch {
      /* selector keeps its default; vault load reports connectivity errors */
    }
  }, []);

  const loadVault = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      setVault((await apiRequest<VaultData>(`/api/documents/${encodeURIComponent(id)}`)).data);
    } catch (e) {
      setVault(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMsmes();
  }, [loadMsmes]);
  useEffect(() => {
    loadVault(msmeId);
  }, [msmeId, loadVault]);

  const rows = useMemo(() => (vault && now ? vault.vault_documents.map((d) => classify(d, now)) : []), [vault, now]);
  const renewals = rows.filter((r) => r.state === "expiring" || r.state === "expired");

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    const form = new FormData();
    form.append("file", file);
    form.append("msme_id", msmeId);
    try {
      if (mode === "ai") {
        const res = await apiRequest<{ detected_type: string; extracted_expiry: string; readiness_score: number }>("/api/documents/extract-and-verify", {
          method: "POST",
          body: form,
        });
        setNotice(`Classified as ${res.data.detected_type} (expiry: ${res.data.extracted_expiry}). Readiness is now ${res.data.readiness_score}%.`);
      } else {
        form.append("document_type", docType);
        form.append("expiry_date", expiry || "No Expiry");
        const res = await apiRequest<{ message?: string }>("/api/documents/upload", { method: "POST", body: form });
        setNotice(res.data.message ?? "Document stored in vault.");
        setExpiry("");
      }
      setFile(null);
      await loadVault(msmeId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await apiRequest(`/api/documents/${id}`, { method: "DELETE" });
      setPendingDelete(null);
      await loadVault(msmeId);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const score = vault?.readiness_score ?? 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Vault · Readiness audit"
        title="Procurement Readiness Vault"
        subtitle="Statutory registrations and financial documents that GeM / CPPP tenders require, with expiry tracking and renewal alerts."
        statutes={["Udyam (MSMED Act 2006 §8)", "CGST Act 2017 §25", "GFR 2017 Rule 173"]}
        actions={
          <>
            <select
              aria-label="Enterprise"
              value={msmeId}
              onChange={(e) => { setMsmeId(e.target.value); setActiveMsmeId(e.target.value); }}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-600"
            >
              {msmes.length === 0 && <option value={msmeId}>{msmeId}</option>}
              {msmes.map((m) => (
                <option key={m.msme_id} value={m.msme_id}>
                  {m.msme_id} · {m.company_name}
                </option>
              ))}
            </select>
            <Btn onClick={() => setRegisterOpen(true)} icon={<UserPlus className="h-3 w-3" />}>
              Register MSME
            </Btn>
          </>
        }
      />

      {error && <ErrorNotice message={error} onRetry={() => loadVault(msmeId)} />}
      {notice && (
        <div role="status" className="rounded-md border border-emerald-900/70 bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-300">
          {notice}
        </div>
      )}

      {loading && !vault ? (
        <Spinner label="Loading vault…" />
      ) : (
        vault && (
          <>
            {renewals.length > 0 && (
              <div className="space-y-2">
                {renewals.map(({ doc, state, daysLeft }) => (
                  <div
                    key={doc.document_type}
                    className={`flex flex-wrap items-center gap-3 rounded-md border px-4 py-2.5 text-xs ${
                      state === "expired" ? "border-rose-900/70 bg-rose-950/30 text-rose-200" : "border-amber-900/70 bg-amber-950/25 text-amber-200"
                    }`}
                  >
                    <BellRing className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{doc.document_type}</span>{" "}
                      {state === "expired" ? `expired ${Math.abs(daysLeft ?? 0)} days ago` : `expires in ${daysLeft} days`} ({doc.expiry_date}). Renew before the next bid submission; bids with lapsed
                      certificates are summarily rejected.
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
              <Panel title="Procurement readiness">
                <div className="flex flex-col items-center gap-3">
                  <Gauge value={score} tone={scoreTone(score)} label="Readiness" />
                  <div className="font-mono text-xs text-slate-400">
                    {vault.total_documents_uploaded} of {vault.total_required} documents on file
                  </div>
                  <Pill tone={scoreTone(score)}>{score >= 80 ? "BID-READY" : score >= 60 ? "GAPS PRESENT" : "HIGH DISQUALIFICATION RISK"}</Pill>
                </div>
              </Panel>

              <Panel title="Statutory certificate checklist" subtitle={`Status as of ${now ? new Date(now).toLocaleDateString("en-IN") : "—"} · warning window ${EXPIRY_WARN_DAYS} days`} flush>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-xs">
                    <thead className="border-b border-slate-800 bg-slate-950/50 text-[10.5px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Document</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium">Expiry</th>
                        <th className="px-4 py-2 font-medium">File</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {rows.map(({ doc, state, daysLeft }) => {
                        const meta = CHECKLIST_META[doc.document_type];
                        const view = STATE_VIEW[state];
                        return (
                          <tr key={doc.document_type} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2 font-medium text-slate-100">
                                {doc.document_type}
                                {meta?.mandatory && <span className="rounded border border-slate-700 px-1 font-mono text-[9.5px] text-slate-400">MANDATORY</span>}
                              </div>
                              <div className="text-[11px] text-slate-500">{meta?.authority}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <Pill tone={view.tone} mono>
                                {view.label}
                              </Pill>
                            </td>
                            <td className="px-4 py-2.5 font-mono tabular-nums text-slate-300">
                              {doc.is_uploaded ? doc.expiry_date ?? "—" : "—"}
                              {daysLeft !== null && <span className="ml-1.5 text-[10.5px] text-slate-500">({daysLeft}d)</span>}
                            </td>
                            <td className="max-w-[180px] truncate px-4 py-2.5 font-mono text-[11px] text-slate-500">{doc.file_name ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right">
                              {doc.id !== null &&
                                (pendingDelete === doc.id ? (
                                  <span className="inline-flex gap-1">
                                    <Btn variant="danger" onClick={() => remove(doc.id as number)}>
                                      Confirm
                                    </Btn>
                                    <Btn onClick={() => setPendingDelete(null)}>Cancel</Btn>
                                  </span>
                                ) : (
                                  <button aria-label={`Remove ${doc.document_type}`} onClick={() => setPendingDelete(doc.id)} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel
                title="Add document"
                actions={
                  <div className="flex rounded border border-slate-800 bg-slate-950 p-0.5 text-[11px]">
                    {(
                      [
                        ["ai", "Auto-classify"],
                        ["manual", "Manual"],
                      ] as const
                    ).map(([k, label]) => (
                      <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={`rounded-sm px-2 py-0.5 font-medium ${mode === k ? "bg-slate-700/70 text-slate-50" : "text-slate-400"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="space-y-3">
                  <PdfDropzone label="Certificate PDF" file={file} onFile={setFile} disabled={uploading} />
                  {mode === "manual" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] text-slate-500">
                        Type
                        <select value={docType} onChange={(e) => setDocType(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100">
                          {DOC_TYPES.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[11px] text-slate-500">
                        Expiry
                        <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-2 py-1.5 font-mono text-xs text-slate-100" />
                      </label>
                    </div>
                  ) : (
                    <p className="text-[11px] leading-relaxed text-slate-500">Document type, certificate number and expiry are read from the PDF text; the readiness gauge updates automatically.</p>
                  )}
                  <Btn variant="primary" className="w-full" disabled={!file || uploading} onClick={submit} icon={<FileCheck2 className="h-3.5 w-3.5" />}>
                    {uploading ? "Processing…" : mode === "ai" ? "Verify & store" : "Store in vault"}
                  </Btn>
                </div>
              </Panel>
            </div>

            <JsonDrawer title={`GET /api/documents/${msmeId}`} data={vault} filename={`vault-${msmeId}.json`} />
          </>
        )
      )}

      <RegisterMsmeModal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSuccess={async (id) => {
          await loadMsmes();
          setMsmeId(id);
        }}
      />
    </PageShell>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <Spinner label="Loading…" />
        </PageShell>
      }
    >
      <VaultContent />
    </Suspense>
  );
}
