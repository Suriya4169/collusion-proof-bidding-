"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FileDropzone from "@/components/FileDropzone";
import ComplianceReport from "@/components/ComplianceReport";

function DashboardContent() {
  const searchParams = useSearchParams();
  const tenderIdParam = searchParams.get("tender_id");
  const tenderTitleParam = searchParams.get("title");

  const [profile, setProfile] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the MSME profile from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("msme_profile");
    if (saved) {
      setProfile(JSON.parse(saved));
    } else {
      // Default profile if not logged in yet
      setProfile({
        companyName: "Bharat Precision Engineering Pvt Ltd",
        udyam: "UDYAM-TN-01-0012345",
        turnover: 4850000,
        experience: 5,
        isRegisteredMSME: true
      });
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    const activeProfile = profile || {
      companyName: "Bharat Precision Engineering Pvt Ltd",
      turnover: 4850000,
      experience: 5,
      isRegisteredMSME: true
    };

    setIsAnalyzing(true);
    setError(null);
    setReport(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", activeProfile.companyName);
    formData.append("turnover", (activeProfile.turnover || 4850000).toString());
    formData.append("experience", (activeProfile.experience || 5).toString());
    formData.append("certifications", "Udyam, ISO 9001");
    formData.append("is_msme", (activeProfile.isRegisteredMSME ?? true).toString());
    formData.append("target_language", "Hindi");

    try {
      // Connects to our FastAPI backend running on port 8000
      const response = await fetch("http://localhost:8000/api/tender/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      setReport(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while analyzing the tender.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunDemoSample = async () => {
    // Generates a mock File object to simulate uploading GeM sample tender
    const dummyBlob = new Blob(["%PDF-1.4 Mock GeM Tender RFP Document Supply of Precision Machined Components min turnover 250L EMD 50000 experience 3 years"], { type: "application/pdf" });
    const dummyFile = new File([dummyBlob], tenderIdParam ? `${tenderIdParam.replace(/\//g, "-")}.pdf` : "GeM-Bidding-9292805.pdf", { type: "application/pdf" });
    await handleFileUpload(dummyFile);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Marketplace Pre-selection Alert */}
      {tenderIdParam && (
        <div className="mb-6 bg-blue-950/40 border border-blue-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-blue-500/20 text-blue-400 font-bold text-xs px-2.5 py-0.5 rounded-full border border-blue-500/30">
                Selected from Marketplace
              </span>
              <span className="text-xs font-mono text-slate-400">{tenderIdParam}</span>
            </div>
            <h3 className="text-white font-bold text-base">{tenderTitleParam || "Target Tender for Evaluation"}</h3>
          </div>
          <button
            onClick={handleRunDemoSample}
            disabled={isAnalyzing}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/30 whitespace-nowrap"
          >
            {isAnalyzing ? "Analyzing..." : "⚡ Quick Test on this Tender"}
          </button>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl sm:truncate">
          Bid Eligibility & Compliance Auditor
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Upload any official GeM Tender PDF. Our 10-Agent Neurosymbolic pipeline will calculate your exact Compliance Distance Score (CDS) with zero hallucination.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload & Profile Context */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Step 1: Upload Tender PDF
            </h3>
            <FileDropzone onFileSelect={handleFileUpload} />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                MSME Profile Context
              </h3>
              <span className="text-xs text-emerald-400 font-semibold">Active Session</span>
            </div>
            
            {profile ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-slate-800/80 pb-2.5">
                  <dt className="text-slate-500">Company</dt>
                  <dd className="text-slate-200 font-medium text-right line-clamp-1">{profile.companyName}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2.5">
                  <dt className="text-slate-500">Udyam No.</dt>
                  <dd className="text-slate-200 font-mono text-xs">{profile.udyam || "UDYAM-TN-01-0012345"}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2.5">
                  <dt className="text-slate-500">Turnover</dt>
                  <dd className="text-emerald-400 font-bold font-mono">₹ {(profile.turnover || 4850000).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between pb-1">
                  <dt className="text-slate-500">Experience</dt>
                  <dd className="text-slate-200 font-medium">{profile.experience || 5} Years</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-500 italic">No profile loaded. Please login.</p>
            )}
          </div>
        </div>

        {/* Right Column: AI Analysis Results */}
        <div className="lg:col-span-2">
          {isAnalyzing ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 shadow-sm flex flex-col items-center justify-center min-h-[440px]">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-6"></div>
              <h3 className="text-lg font-bold text-white mb-2">Neurosymbolic Pipeline Running</h3>
              <p className="text-sm text-slate-400 text-center max-w-sm leading-relaxed">
                1. Extracting PDF text with PyMuPDF...<br/>
                2. Dense RAG chunking & vector filtering...<br/>
                3. Gemini structured parameter extraction...<br/>
                4. Deterministic Python Symbolic Verifier...
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">Analysis Error</h3>
              <p className="text-sm text-slate-300">{error}</p>
            </div>
          ) : report ? (
            <ComplianceReport report={report} />
          ) : (
            <div className="bg-slate-900 border border-slate-800 border-dashed rounded-2xl p-12 shadow-sm flex flex-col items-center justify-center min-h-[440px]">
              <div className="w-16 h-16 bg-slate-800/60 rounded-full flex items-center justify-center text-slate-500 mb-4">
                📄
              </div>
              <h3 className="text-lg font-bold text-white">Waiting for Tender Document</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md text-center">
                Drag and drop a government tender PDF on the left, or select a bid from the Marketplace to view complete AI compliance results.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
