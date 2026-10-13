"use client";

import { useState, useEffect } from "react";
import FileDropzone from "@/components/FileDropzone";

export default function PaymentTracker() {
  const [profile, setProfile] = useState<any>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("msme_profile");
    if (saved) {
      setProfile(JSON.parse(saved));
    }
  }, []);

  const handleTrack = async () => {
    if (!profile) {
      setError("Please login first to use the legal tracker.");
      return;
    }
    if (!invoiceFile || !receiptFile) {
      setError("Please upload both the Invoice and Bank Receipt PDFs.");
      return;
    }

    setIsCalculating(true);
    setError(null);
    setReport(null);

    const formData = new FormData();
    formData.append("invoice_file", invoiceFile);
    formData.append("receipt_file", receiptFile);
    formData.append("company_name", profile.companyName);

    try {
      const response = await fetch("http://localhost:8000/api/payments/track", {
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
      setError(err.message || "An error occurred while calculating the penalty.");
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl sm:truncate">
          AI Document Verification (MSMED Act)
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Upload your Stamped Invoice and Bank Statement PDFs. Our AI will cryptographically extract the dates and mathematically calculate your Section 16 Penalty.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-800 bg-slate-800/30">
            <h3 className="text-lg leading-6 font-medium text-white">Upload Proof Documents</h3>
          </div>
          <div className="p-6 space-y-6">
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">1. Upload Stamped Invoice (PDF)</label>
              <FileDropzone onFileSelect={setInvoiceFile} />
              {invoiceFile && <p className="mt-2 text-sm text-green-400 flex items-center">✓ {invoiceFile.name} loaded</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">2. Upload Bank Receipt (PDF)</label>
              <FileDropzone onFileSelect={setReceiptFile} />
              {receiptFile && <p className="mt-2 text-sm text-green-400 flex items-center">✓ {receiptFile.name} loaded</p>}
            </div>

            <button
              onClick={handleTrack}
              disabled={isCalculating || !invoiceFile || !receiptFile}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-900 transition-colors disabled:opacity-50"
            >
              {isCalculating ? "Extracting Dates with Gemini AI..." : "Extract Data & Calculate Penalty"}
            </button>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-1">
          {error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">Calculation Error</h3>
              <p className="text-sm text-slate-300">{error}</p>
            </div>
          ) : isCalculating ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <h3 className="text-lg font-medium text-white mb-2">AI Extraction Running</h3>
              <p className="text-sm text-slate-400 text-center max-w-sm">
                1. OCR scanning PDFs...<br/>
                2. Extracting immutable dates via Gemini AI...<br/>
                3. Running pure Python symbolic penalty math...
              </p>
            </div>
          ) : report ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden mt-0">
              <div className={`px-6 py-5 border-b border-slate-800 flex justify-between items-center ${report.is_delayed ? 'bg-red-900/20' : 'bg-green-900/20'}`}>
                <div>
                  <h3 className="text-lg leading-6 font-medium text-white">AI Audit Report</h3>
                  <p className="mt-1 max-w-2xl text-sm text-slate-400">
                    Delay Status: <span className={`font-bold ${report.is_delayed ? 'text-red-400' : 'text-green-400'}`}>{report.days_delayed} Days</span>
                  </p>
                </div>
                {report.is_delayed ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                    🔴 PENALTY APPLICABLE
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                    🟢 NO PENALTY
                  </span>
                )}
              </div>

              <div className="p-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 mb-6">
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-slate-500">Principal Amount</dt>
                    <dd className="mt-1 text-lg text-white font-mono">₹ {report.principal_amount.toLocaleString()}</dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-red-400">Interest Owed</dt>
                    <dd className="mt-1 text-lg text-red-400 font-bold font-mono">₹ {report.total_interest.toLocaleString()}</dd>
                  </div>
                </dl>

                {report.is_delayed && report.legal_notice_draft && (
                  <div className="mt-6 border-t border-slate-800 pt-6">
                    <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Auto-Generated Legal Notice</h4>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-md p-4 max-h-64 overflow-y-auto">
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {report.legal_notice_draft}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
             <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-12 shadow-sm flex flex-col items-center justify-center h-full min-h-[300px]">
              <svg className="h-12 w-12 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-slate-400">No Documents Uploaded</h3>
              <p className="text-sm text-slate-500 mt-1 text-center">Upload your Invoice and Bank Receipt to run the AI Verification.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
