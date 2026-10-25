"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileSearch, Play } from "lucide-react";
import ComplianceReport from "@/components/ComplianceReport";
import { Btn, EmptyState, ErrorNotice, PageHeader, PageShell, Panel, PdfDropzone, Pill, Spinner } from "@/components/ui";
import { apiRequest, errorMessage, formatINR, type VerificationReport } from "@/lib/api";

interface VendorProfile {
  companyName: string;
  udyam: string;
  turnover: number;
  experience: number;
  isRegisteredMSME: boolean;
}

const DEFAULT_PROFILE: VendorProfile = {
  companyName: "Bharat Precision Engineering Pvt Ltd",
  udyam: "UDYAM-TN-01-0012345",
  turnover: 4850000,
  experience: 5,
  isRegisteredMSME: true,
};

function DashboardContent() {
  const params = useSearchParams();
  const tenderId = params.get("tender_id");
  const tenderTitle = params.get("title");

  const [profile, setProfile] = useState<VendorProfile>(DEFAULT_PROFILE);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("msme_profile");
      if (saved) setProfile({ ...DEFAULT_PROFILE, ...(JSON.parse(saved) as Partial<VendorProfile>) });
    } catch {
      /* fall back to default profile */
    }
  }, []);

  const analyze = async (target: File | null) => {
    if (!target) return;
    setBusy(true);
    setError(null);
    setReport(null);
    const form = new FormData();
    form.append("file", target);
    form.append("company_name", profile.companyName);
    form.append("turnover", String(profile.turnover));
    form.append("experience", String(profile.experience));
    form.append("certifications", "Udyam, ISO 9001");
    form.append("is_msme", String(profile.isRegisteredMSME));
    form.append("target_language", "Hindi");
    try {
      const res = await apiRequest<VerificationReport>("/api/tender/analyze", { method: "POST", body: form });
      setReport(res.data);
      setLatency(res.latencyMs);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runSample = () => {
    const blob = new Blob(
      ["%PDF-1.4 Mock GeM Tender RFP Document Supply of Precision Machined Components min turnover 250L EMD 50000 experience 3 years"],
      { type: "application/pdf" },
    );
    const name = tenderId ? `${tenderId.replace(/\//g, "-")}.pdf` : "GeM-Bidding-9292805.pdf";
    const sample = new File([blob], name, { type: "application/pdf" });
    setFile(sample);
    analyze(sample);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Module 1 · Bid eligibility"
        title="Tender Intelligence & Compliance Auditor"
        subtitle="Extracts eligibility criteria from the tender PDF and verifies them against your Udyam profile with a deterministic, zero-hallucination rule engine."
        statutes={["Rule 173(i) GFR 2017", "MSMED Act 2006", "Public Procurement Policy for MSEs Order 2012"]}
      />

      {tenderId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-sky-900/60 bg-sky-950/20 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Pill tone="info" mono>
              {tenderId}
            </Pill>
            <span className="truncate text-xs text-slate-300">{tenderTitle ?? "Selected marketplace tender"}</span>
          </div>
          <Btn onClick={runSample} disabled={busy} icon={<Play className="h-3 w-3" />}>
            Run on sample document
          </Btn>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Tender document">
            <div className="space-y-3">
              <PdfDropzone label="Tender PDF" file={file} onFile={setFile} disabled={busy} />
              <Btn variant="primary" className="w-full" disabled={!file || busy} onClick={() => analyze(file)} icon={<FileSearch className="h-3.5 w-3.5" />}>
                {busy ? "Analysing…" : "Run compliance audit"}
              </Btn>
            </div>
          </Panel>

          <Panel title="Bidder profile" subtitle="Source: Udyam registration / local session">
            <dl className="divide-y divide-slate-800/70 text-xs">
              {[
                ["Enterprise", profile.companyName],
                ["Udyam No.", profile.udyam],
                ["Turnover", formatINR(profile.turnover, true)],
                ["Experience", `${profile.experience} yrs`],
                ["MSE status", profile.isRegisteredMSME ? "Registered" : "Not registered"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="truncate text-right font-mono text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>

        <div className="min-w-0">
          {busy ? (
            <Panel>
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3">
                <Spinner label="Running 6-node pipeline" />
                <p className="text-[11.5px] text-slate-500">PyMuPDF → Ephemeral RAG → Gemini extraction → Symbolic verifier → Simplifier → Scheme discoverer</p>
              </div>
            </Panel>
          ) : error ? (
            <ErrorNotice message={error} onRetry={file ? () => analyze(file) : undefined} />
          ) : report ? (
            <>
              {latency !== null && <div className="mb-2 font-mono text-[11px] text-slate-500">HTTP 200 · {latency} ms</div>}
              <ComplianceReport report={report} />
            </>
          ) : (
            <EmptyState
              icon={<FileSearch className="h-8 w-8" />}
              title="No tender analysed"
              body="Upload a tender PDF (max 10 MB) to see the compliance gauge, per-clause verdicts with page citations and the Hindi summary."
            />
          )}
        </div>
      </div>
    </PageShell>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<PageShell><Spinner label="Loading…" /></PageShell>}>
      <DashboardContent />
    </Suspense>
  );
}
