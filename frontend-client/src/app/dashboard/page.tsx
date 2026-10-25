"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Coins,
  Cpu,
  Download,
  ExternalLink,
  FileCheck2,
  FileSearch,
  FileText,
  Layers,
  Play,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import ComplianceReport from "@/components/ComplianceReport";
import {
  Btn,
  EmptyState,
  ErrorNotice,
  PageHeader,
  PageShell,
  Panel,
  PdfDropzone,
  Pill,
  Spinner,
} from "@/components/ui";
import {
  apiRequest,
  errorMessage,
  formatINR,
  formatLakhs,
  type Tender,
  type TendersResponse,
  type VerificationReport,
} from "@/lib/api";

interface VendorProfile {
  companyName: string;
  udyam: string;
  turnover: number;
  experience: number;
  isRegisteredMSME: boolean;
}

const DEFAULT_PROFILE: VendorProfile = {
  companyName: "Bharat Precision Engineering Pvt Ltd",
  udyam: "UDYAM-TN-02-0048192",
  turnover: 4850000, // ₹ 48.5 Lakhs
  experience: 5,
  isRegisteredMSME: true,
};

function DashboardContent() {
  const router = useRouter();
  const params = useSearchParams();

  // Read URL query parameters for selected tender
  const tenderIdParam = params.get("tender_id");
  const titleParam = params.get("title");
  const deptParam = params.get("department");
  const catParam = params.get("category");
  const valParam = params.get("val");
  const turnoverParam = params.get("turnover");
  const expParam = params.get("exp");
  const emdParam = params.get("emd");
  const deadlineParam = params.get("deadline");
  const startupParam = params.get("startup");
  const autoAuditParam = params.get("auto");

  const [profile, setProfile] = useState<VendorProfile>(DEFAULT_PROFILE);
  const [availableTenders, setAvailableTenders] = useState<Tender[]>([]);
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTenderPicker, setShowTenderPicker] = useState(false);

  // 1. Load active vendor profile from local session / storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("msme_profile");
      if (saved) setProfile({ ...DEFAULT_PROFILE, ...(JSON.parse(saved) as Partial<VendorProfile>) });
    } catch {
      /* fall back to default profile */
    }
  }, []);

  // 2. Fetch all active tenders from GeM marketplace API
  useEffect(() => {
    const fetchTenders = async () => {
      try {
        const res = await apiRequest<TendersResponse>("/api/tenders");
        if (res.data?.tenders) {
          setAvailableTenders(res.data.tenders);
        }
      } catch {
        /* Ignore if offline */
      }
    };
    fetchTenders();
  }, []);

  // 3. Resolve currently selected tender from query params or active list
  useEffect(() => {
    if (tenderIdParam) {
      // Find matching tender from database list if already fetched
      const match = availableTenders.find((t) => t.tender_id === tenderIdParam);
      if (match) {
        setSelectedTender(match);
      } else {
        // Construct from query parameters
        setSelectedTender({
          tender_id: tenderIdParam,
          title: titleParam || "Procurement Notice",
          department: deptParam || "Government Department / Ministry",
          category: catParam || "Manufacturing",
          estimated_value_inr: valParam || "As per RFP",
          min_turnover_lakhs: turnoverParam ? parseFloat(turnoverParam) : 25.0,
          min_experience_years: expParam ? parseInt(expParam, 10) : 2,
          emd_amount_inr: emdParam ? parseFloat(emdParam) : 50000.0,
          submission_deadline: deadlineParam || "2026-11-30",
          allows_startup_exemption: startupParam === "true",
          status: "Active",
        });
      }
    } else if (availableTenders.length > 0 && !selectedTender) {
      // Default to first active tender if none in URL
      setSelectedTender(availableTenders[0]);
    }
  }, [
    tenderIdParam,
    titleParam,
    deptParam,
    catParam,
    valParam,
    turnoverParam,
    expParam,
    emdParam,
    deadlineParam,
    startupParam,
    availableTenders,
    selectedTender,
  ]);

  // 4. Create an official RFP PDF file tailored specifically to the selected tender
  const createTenderRfpFile = useCallback((t: Tender): File => {
    const cleanId = t.tender_id.replace(/[/\\?%*:|"<>]/g, "-");
    const rfpText = `%PDF-1.4
% Government e-Marketplace (GeM) & CPPP Official Tender RFP
% GeM Statutory Notice: Bid No. ${t.tender_id}
TENDER NOTICE AND RFP INVITATION
Bid Reference ID: ${t.tender_id}
Name of Work / Procurement Item: ${t.title}
Procuring Department: ${t.department}
Item Sector / Category: ${t.category}
Estimated Contract Value: ${t.estimated_value_inr}
Bid Submission Deadline: ${t.submission_deadline}

SECTION 3: MANDATORY STATUTORY ELIGIBILITY CRITERIA
Clause 3.1 - Annual Financial Turnover:
The minimum average annual turnover of the bidder during the last three financial years must not be less than ${t.min_turnover_lakhs} Lakhs INR. Audited balance sheets and statutory CA turnover certificates must be submitted.

Clause 3.2 - Prior Work Experience:
The bidder must possess a minimum of ${t.min_experience_years} years of proven past experience in executing supply or contracts of similar category for government bodies or public sector undertakings.

Clause 3.3 - Earnest Money Deposit (EMD) & Bid Security:
An EMD of INR ${t.emd_amount_inr} is required. Pursuant to the Public Procurement Policy for MSEs Order 2012, recognized Micro and Small Enterprises (MSEs) holding a valid Udyam Registration Certificate and recognized Startups are granted 100% exemption from EMD payment.

Clause 3.4 - Statutory MSE & Startup Policy Relaxation:
${
  t.allows_startup_exemption
    ? "Relaxation in turnover and prior experience criteria is granted to recognized Startups and MSEs as per Ministry of Finance GFR Rule 173(i) and MSMED Act 2006 §11, provided technical competence is demonstrated."
    : "Standard statutory qualifications apply as specified in Section 3."
}

Clause 3.5 - Mandatory Statutory Certifications:
Bidders must submit valid Udyam Registration Certificate, GST Registration Certificate, Permanent Account Number (PAN), and ISO 9001 Quality Certification.
%%EOF`;

    const blob = new Blob([rfpText], { type: "application/pdf" });
    return new File([blob], `${cleanId}_Official_RFP.pdf`, { type: "application/pdf" });
  }, []);

  // 5. Run the 6-agent LangGraph analysis on the selected tender file
  const analyzeTender = useCallback(
    async (targetFile: File) => {
      setBusy(true);
      setError(null);
      setReport(null);

      const form = new FormData();
      form.append("file", targetFile);
      form.append("company_name", profile.companyName);
      form.append("turnover", String(profile.turnover));
      form.append("experience", String(profile.experience));
      form.append("certifications", "Udyam, ISO 9001, GSTIN");
      form.append("is_msme", String(profile.isRegisteredMSME));
      form.append("target_language", "Hindi");

      try {
        const res = await apiRequest<VerificationReport>("/api/tender/analyze", {
          method: "POST",
          body: form,
        });
        setReport(res.data);
        setLatency(res.latencyMs);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [profile]
  );

  // 6. Handle Audit Trigger on Selected Tender
  const handleRunAuditOnTender = useCallback(
    (t: Tender) => {
      const generatedFile = createTenderRfpFile(t);
      setFile(generatedFile);
      analyzeTender(generatedFile);
    },
    [createTenderRfpFile, analyzeTender]
  );

  // 7. Auto-run if user clicked "Run compliance audit" from marketplace with ?auto=true
  useEffect(() => {
    if (autoAuditParam === "true" && selectedTender && !report && !busy) {
      handleRunAuditOnTender(selectedTender);
    }
  }, [autoAuditParam, selectedTender, report, busy, handleRunAuditOnTender]);

  // 8. Switching to a different tender
  const handleSelectTender = (t: Tender) => {
    setSelectedTender(t);
    setShowTenderPicker(false);
    setReport(null);
    setError(null);
    const newHref = `/dashboard?tender_id=${encodeURIComponent(t.tender_id)}&title=${encodeURIComponent(
      t.title
    )}&department=${encodeURIComponent(t.department)}&category=${encodeURIComponent(t.category)}&val=${encodeURIComponent(
      t.estimated_value_inr
    )}&turnover=${t.min_turnover_lakhs}&exp=${t.min_experience_years}&emd=${t.emd_amount_inr}&deadline=${encodeURIComponent(
      t.submission_deadline
    )}&startup=${t.allows_startup_exemption ? "true" : "false"}`;
    router.replace(newHref);
    handleRunAuditOnTender(t);
  };

  // Turn annual turnover from lakhs to rupees for easy comparison
  const vendorTurnoverLakhs = profile.turnover / 100000;
  const turnoverPass = selectedTender ? vendorTurnoverLakhs >= selectedTender.min_turnover_lakhs : false;
  const experiencePass = selectedTender ? profile.experience >= selectedTender.min_experience_years : false;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Module 1 · Zero-Hallucination Bid Eligibility"
        title="Tender Intelligence & Compliance Auditor"
        subtitle="Extracts statutory eligibility criteria from the tender RFP document and audits your Udyam profile with deterministic 6-agent symbolic verification."
        statutes={[
          "Rule 173(i) GFR 2017",
          "MSMED Act 2006 §11",
          "Public Procurement Policy for MSEs Order 2012",
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/marketplace"
              className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
            >
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Browse GeM Marketplace</span>
            </Link>

            {selectedTender && (
              <Btn
                variant="primary"
                onClick={() => handleRunAuditOnTender(selectedTender)}
                disabled={busy}
                icon={busy ? <Spinner /> : <Play className="h-3.5 w-3.5" />}
              >
                {busy ? "Auditing Pipeline..." : "Audit This Tender"}
              </Btn>
            )}
          </div>
        }
      />

      {/* =========================================================================
          PROMINENT SELECTED TENDER DOSSIER (Always tells user EXACTLY which tender)
         ========================================================================= */}
      {selectedTender ? (
        <div className="rounded-lg border border-sky-500/40 bg-slate-900/90 p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-sky-500/20 text-sky-300 font-mono text-xs font-bold px-2 py-0.5 border border-sky-500/30">
                  {selectedTender.tender_id}
                </span>
                <span className="rounded bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold px-2 py-0.5 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  <span>GeM Active Tender</span>
                </span>
                <span className="rounded bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5">
                  Sector: {selectedTender.category}
                </span>
                {selectedTender.allows_startup_exemption && (
                  <span className="rounded bg-violet-500/10 text-violet-300 text-[11px] px-2 py-0.5 border border-violet-500/20">
                    Startup / MSE Relaxation Eligible
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-100 leading-snug pt-1">
                {selectedTender.title}
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                <span>Issuing Authority: <strong className="text-slate-200">{selectedTender.department}</strong></span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTenderPicker(!showTenderPicker)}
                className="rounded border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-sky-500 hover:text-white transition flex items-center gap-1.5"
              >
                <Search className="h-3.5 w-3.5 text-sky-400" />
                <span>Switch Tender ({availableTenders.length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleRunAuditOnTender(selectedTender)}
                disabled={busy}
                className="rounded border border-sky-500/50 bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition shadow flex items-center gap-1.5"
              >
                {busy ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />}
                <span>Re-Run AI Audit</span>
              </button>
            </div>
          </div>

          {/* 4 Stat Metric Cards Comparing Tender Criteria vs Bidder Profile */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-[10.5px] uppercase tracking-wider text-slate-500 block">Estimated Contract Value</span>
              <span className="text-sm font-mono font-bold text-slate-100 mt-1 block">
                {selectedTender.estimated_value_inr}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Official Procurement Budget</span>
            </div>

            <div
              className={`rounded border p-3 ${
                turnoverPass
                  ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                  : "border-amber-500/30 bg-amber-950/20 text-amber-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] uppercase tracking-wider text-slate-400">Min. Annual Turnover</span>
                {turnoverPass ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                )}
              </div>
              <span className="text-sm font-mono font-bold text-slate-100 mt-1 block">
                {formatLakhs(selectedTender.min_turnover_lakhs)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Your Turnover: <strong className="text-slate-200">{formatLakhs(vendorTurnoverLakhs)}</strong>{" "}
                ({turnoverPass ? "Eligible" : "Exemption Needed"})
              </span>
            </div>

            <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-[10.5px] uppercase tracking-wider text-slate-500 block">EMD Deposit (Bid Security)</span>
              <span className="text-sm font-mono font-bold text-slate-100 mt-1 block">
                {selectedTender.emd_amount_inr > 0 ? formatINR(selectedTender.emd_amount_inr, true) : "Nil (Free)"}
              </span>
              <span className="text-[10px] text-emerald-400 mt-0.5 block">
                100% MSME Exemption Applies
              </span>
            </div>

            <div
              className={`rounded border p-3 ${
                experiencePass
                  ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                  : "border-amber-500/30 bg-amber-950/20 text-amber-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] uppercase tracking-wider text-slate-400">Min. Past Experience</span>
                {experiencePass ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                )}
              </div>
              <span className="text-sm font-mono font-bold text-slate-100 mt-1 block">
                {selectedTender.min_experience_years} Years
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Your Experience: <strong className="text-slate-200">{profile.experience} Years</strong> ({experiencePass ? "Qualified" : "Gap"})
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Empty selection state: Prominently prompt to select a tender */
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-sky-400" />
              <h2 className="text-sm font-bold text-slate-100">
                Choose an Active GeM Tender to Audit
              </h2>
            </div>
            <Link href="/marketplace" className="text-xs text-sky-400 hover:underline">
              View all marketplace tenders →
            </Link>
          </div>
          <p className="text-xs text-slate-400">
            Select one of the government procurement notices below to immediately inspect eligibility and run symbolic compliance verification:
          </p>
        </div>
      )}

      {/* =========================================================================
          TENDER PICKER POPDOWN (Allows instantly switching tenders on this page)
         ========================================================================= */}
      {showTenderPicker && (
        <div className="rounded-md border border-slate-700 bg-slate-900 p-4 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              Select Tender to Audit ({availableTenders.length} available)
            </span>
            <button
              onClick={() => setShowTenderPicker(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              ✕ Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
            {availableTenders.map((t) => (
              <button
                key={t.tender_id}
                type="button"
                onClick={() => handleSelectTender(t)}
                className={`text-left rounded border p-2.5 transition text-xs space-y-1 ${
                  selectedTender?.tender_id === t.tender_id
                    ? "border-sky-500 bg-sky-950/40"
                    : "border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center justify-between font-mono text-[10.5px]">
                  <span className="text-sky-400 font-semibold">{t.tender_id}</span>
                  <span className="text-slate-400">{t.category}</span>
                </div>
                <div className="font-medium text-slate-200 truncate">{t.title}</div>
                <div className="text-[11px] text-slate-400">
                  Turnover: {formatLakhs(t.min_turnover_lakhs)} · Exp: {t.min_experience_years}y
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TWO-COLUMN WORKSPACE: LEFT (Document & Profile) | RIGHT (AI Report)
         ========================================================================= */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* LEFT COLUMN: Tender RFP Document & Bidder Profile */}
        <div className="space-y-4">
          <Panel
            title="Tender Document (RFP Notice)"
            subtitle={
              selectedTender
                ? `Attached for ${selectedTender.tender_id}`
                : "Upload or select a tender"
            }
          >
            <div className="space-y-3">
              {selectedTender && (
                <div className="rounded border border-slate-800 bg-slate-900/90 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-emerald-400" />
                      <span className="font-semibold text-slate-200 font-mono text-[11.5px]">
                        {selectedTender.tender_id.replace(/\//g, "-")}_RFP.pdf
                      </span>
                    </div>
                    <span className="rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-1.5 py-0.5">
                      Ready
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Official RFP parameters synthesized from GeM notice. Contains all statutory clauses (turnover, experience, EMD, certifications).
                  </div>
                  <Btn
                    variant="primary"
                    className="w-full justify-center"
                    disabled={busy}
                    onClick={() => handleRunAuditOnTender(selectedTender)}
                    icon={busy ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />}
                  >
                    {busy ? "Running 6-Node Pipeline..." : "Audit This Document"}
                  </Btn>
                </div>
              )}

              <div className="border-t border-slate-800 pt-3">
                <span className="text-[11px] text-slate-400 block mb-1.5">
                  Or upload custom tender PDF / corrigendum:
                </span>
                <PdfDropzone
                  label="Upload custom PDF"
                  file={file}
                  onFile={(f) => {
                    setFile(f);
                    if (f) analyzeTender(f);
                  }}
                  disabled={busy}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Bidder Profile" subtitle="Source: Statutory Udyam Registration">
            <dl className="divide-y divide-slate-800/70 text-xs">
              {[
                ["Enterprise", profile.companyName],
                ["Udyam Reg. No.", profile.udyam],
                ["Annual Turnover", formatINR(profile.turnover, true)],
                ["Past Experience", `${profile.experience} Years`],
                ["MSE Status", profile.isRegisteredMSME ? "Verified Micro Enterprise" : "Standard"],
                ["Certifications", "Udyam, ISO 9001, GSTIN"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="truncate text-right font-mono text-slate-200 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="pt-2 border-t border-slate-800 text-right">
              <Link href="/profile" className="text-[11px] text-sky-400 hover:underline">
                Update Udyam & Asset Profile →
              </Link>
            </div>
          </Panel>
        </div>

        {/* RIGHT COLUMN: 6-Node AI Verification Pipeline & Compliance Report */}
        <div className="min-w-0">
          {busy ? (
            <Panel>
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center p-6">
                <Spinner label="Executing Autonomous 6-Node Verification Pipeline..." />
                <div className="space-y-1.5 mt-2">
                  <p className="text-xs font-semibold text-slate-200">
                    PyMuPDF Extraction → Ephemeral RAG → Gemini Extractor → Symbolic Verifier → Simplifier → Scheme Discoverer
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Extracting statutory turnover, EMD exemptions, and experience clauses for{" "}
                    <span className="font-mono text-slate-400">{selectedTender?.tender_id}</span>...
                  </p>
                </div>
              </div>
            </Panel>
          ) : error ? (
            <ErrorNotice
              message={error}
              onRetry={
                selectedTender
                  ? () => handleRunAuditOnTender(selectedTender)
                  : file
                  ? () => analyzeTender(file)
                  : undefined
              }
            />
          ) : report ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                <span>Audited Tender: <strong className="text-sky-400">{selectedTender?.tender_id}</strong></span>
                {latency !== null && <span>Pipeline Latency: {latency} ms</span>}
              </div>
              <ComplianceReport report={report} />
            </div>
          ) : (
            <EmptyState
              icon={<FileSearch className="h-8 w-8" />}
              title={
                selectedTender
                  ? `Ready to audit ${selectedTender.tender_id}`
                  : "No tender selected"
              }
              body={
                selectedTender
                  ? `Click "Audit This Tender" above to run the 6-agent symbolic verification engine on ${selectedTender.title}.`
                  : "Select an active tender from the GeM marketplace to inspect eligibility rules and citations."
              }
            />
          )}
        </div>
      </div>
    </PageShell>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <Spinner label="Loading compliance auditor..." />
        </PageShell>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
