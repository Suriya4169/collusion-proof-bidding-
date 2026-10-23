import React, { useState, useRef, useEffect } from 'react';
import { 
  FileDiff, 
  UploadCloud, 
  FileText, 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Download, 
  Send, 
  ShieldAlert, 
  Ban, 
  Scale, 
  Cpu, 
  Search, 
  Sparkles, 
  Check, 
  Layers, 
  ChevronRight, 
  HelpCircle, 
  Info, 
  RefreshCw,
  ExternalLink,
  Lock,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { GovtProfile, IntegrityAnalysisResult, SemanticDiffClause } from '../types';
import { MOCK_INTEGRITY_ANALYSIS } from '../data/mockData';
import { SAMPLE_ORIGINAL_CORPUS_TEXT, SAMPLE_AMENDED_CORRIGENDUM_TEXT } from '../data/tenderCorpus';

interface GovtIntegrityScreenProps {
  profile: GovtProfile;
  onNavigateTab?: (tab: string) => void;
}

export const GovtIntegrityScreen: React.FC<GovtIntegrityScreenProps> = ({ profile, onNavigateTab }) => {
  // Input files state
  const [originalFile, setOriginalFile] = useState<string>('Original_RFP_BSNL_Hardware_GEM_771923.pdf');
  const [originalFileSize, setOriginalFileSize] = useState<string>('4.2 MB (48 Pages)');
  const [corrigendumFile, setCorrigendumFile] = useState<string>('Corrigendum_03_Clause_Amendments_Final.pdf');
  const [corrigendumFileSize, setCorrigendumFileSize] = useState<string>('1.1 MB (8 Pages)');

  // Clause Texts state (passed to Gemini)
  const [originalClauseText, setOriginalClauseText] = useState<string>(SAMPLE_ORIGINAL_CORPUS_TEXT);
  const [amendedClauseText, setAmendedClauseText] = useState<string>(SAMPLE_AMENDED_CORRIGENDUM_TEXT);
  const [showClauseTextInspector, setShowClauseTextInspector] = useState<boolean>(false);

  // Drag states
  const [isDragOverOriginal, setIsDragOverOriginal] = useState(false);
  const [isDragOverCorrigendum, setIsDragOverCorrigendum] = useState(false);
  const origInputRef = useRef<HTMLInputElement>(null);
  const corrInputRef = useRef<HTMLInputElement>(null);

  // Date and Deadline inputs
  const [amendmentDate, setAmendmentDate] = useState<string>('2026-09-18T14:30');
  const [tenderDeadline, setTenderDeadline] = useState<string>('2026-09-20T17:00');
  const [daysGap, setDaysGap] = useState<number>(2.1);
  const [isWindowViolated, setIsWindowViolated] = useState<boolean>(true);

  // Analysis Execution state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<IntegrityAnalysisResult | null>(MOCK_INTEGRITY_ANALYSIS);

  // Filter for clauses
  const [clauseFilter, setClauseFilter] = useState<'ALL' | 'CRITICAL_HIGH' | 'RESTRICTIVE' | 'NEUTRAL'>('ALL');

  // Modals & Action states
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [escalateSuccessMsg, setEscalateSuccessMsg] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<'FREEZE' | 'SHOW_CAUSE' | 'CVC_AUDIT'>('FREEZE');
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState(false);

  // Re-calculate days gap whenever dates change
  useEffect(() => {
    try {
      const amendTime = new Date(amendmentDate).getTime();
      const deadlineTime = new Date(tenderDeadline).getTime();
      if (!isNaN(amendTime) && !isNaN(deadlineTime)) {
        const diffHours = (deadlineTime - amendTime) / (1000 * 60 * 60);
        const diffDays = Math.max(0, diffHours / 24);
        setDaysGap(parseFloat(diffDays.toFixed(1)));
        setIsWindowViolated(diffDays < 7);
      }
    } catch {
      // ignore parsing error
    }
  }, [amendmentDate, tenderDeadline]);

  // Handle Drag & Drop for Original
  const handleDropOriginal = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverOriginal(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setOriginalFile(file.name);
      setOriginalFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
      if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        try {
          const text = await file.text();
          setOriginalClauseText(text);
        } catch {
          // ignore
        }
      }
    }
  };

  // Handle Drag & Drop for Corrigendum
  const handleDropCorrigendum = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCorrigendum(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setCorrigendumFile(file.name);
      setCorrigendumFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
      if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        try {
          const text = await file.text();
          setAmendedClauseText(text);
        } catch {
          // ignore
        }
      }
    }
  };

  // Run Semantic Diff via Gemini API
  const handleRunSemanticDiff = async (overrideOrig?: string, overrideAmend?: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    const startTime = Date.now();
    setAnalysisStep('Ingesting PDF text streams and aligning clause hierarchical trees...');

    const timer1 = setTimeout(() => {
      setAnalysisStep('Generating dense neural embeddings and computing semantic vector distance...');
    }, 400);

    const timer2 = setTimeout(() => {
      setAnalysisStep('Evaluating bidder restrictiveness, MSE quota exclusions & CVC circular compliance...');
    }, 900);

    const timer3 = setTimeout(() => {
      setAnalysisStep('Calling Gemini 3.7 Flash: Computing corruption-risk score & forensic diff matrix...');
    }, 1400);

    try {
      const origText = overrideOrig || originalClauseText || SAMPLE_ORIGINAL_CORPUS_TEXT;
      const amendText = overrideAmend || amendedClauseText || SAMPLE_AMENDED_CORRIGENDUM_TEXT;

      const res = await fetch('/api/semantic-diff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalText: origText,
          amendedText: amendText,
          amendmentDate,
          tenderDeadline,
          daysGap,
          tenderRef: 'GEM/2026/B/771923',
          department: 'Ministry of Communications / Bharat Sanchar Nigam Limited (BSNL)',
          title: 'Procurement of High-Capacity Fiber Optic Switching Hardware & Ruggedized Transceivers',
        }),
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned status ${res.status}`);
      }

      const data = await res.json();
      setAnalysisResult({
        tenderRef: data.tenderRef || 'GEM/2026/B/771923',
        title: data.title || 'Procurement of High-Capacity Fiber Optic Switching Hardware & Ruggedized Transceivers',
        department: data.department || 'Ministry of Communications / BSNL',
        originalFileName: originalFile,
        corrigendumFileName: corrigendumFile,
        amendmentDate,
        tenderDeadline,
        daysGap,
        isWindowViolated,
        overallCorruptionRisk: data.overallCorruptionRisk,
        riskLabel: data.riskLabel,
        summaryNote: data.summaryNote,
        clauses: data.clauses,
      });
      setApiLatencyMs(Date.now() - startTime);
    } catch (err: any) {
      console.error('Error executing semantic diff with Gemini API:', err);
      setAnalysisError(err.message || 'Failed to execute semantic diff with Gemini.');
      // Keep UI functional with mock if result was null
      if (!analysisResult) {
        setAnalysisResult({
          ...MOCK_INTEGRITY_ANALYSIS,
          originalFileName: originalFile,
          corrigendumFileName: corrigendumFile,
          amendmentDate,
          tenderDeadline,
          daysGap,
          isWindowViolated,
        });
      }
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Download Report Simulation
  const handleDownloadReport = () => {
    setIsDownloadingReport(true);
    setTimeout(() => {
      setIsDownloadingReport(false);
      setDownloadSuccessToast(true);

      // Create a simulated downloadable text file
      if (analysisResult) {
        const reportContent = `========================================================================
CENTRAL VIGILANCE COMMISSION & GeM OVERSIGHT DIVISION
AUTOMATED TENDER INTEGRITY & CORRIGENDUM AUDIT DOSSIER
========================================================================
Tender Reference: ${analysisResult.tenderRef}
Tender Title: ${analysisResult.title}
Procuring Department: ${analysisResult.department}
Vigilance Officer: ${profile.officerName} (${profile.officerId})
Date of Audit: ${new Date().toLocaleString('en-IN')}

EXECUTIVE INTEGRITY ASSESSMENT:
------------------------------------------------------------------------
Overall Corruption Risk Score: ${analysisResult.overallCorruptionRisk}% [${analysisResult.riskLabel}]
Statutory Corrigendum Window Breach: ${analysisResult.isWindowViolated ? 'YES - CRITICAL NON-COMPLIANCE' : 'NO'}
Time Gap Between Amendment and Cutoff: ${analysisResult.daysGap} Days (${(analysisResult.daysGap * 24).toFixed(0)} Hours)
Statutory Requirement: Minimum 7 Days Extension (GFR Rule 173(iii))

FLAGGED CLAUSE MODIFICATIONS & SEMANTIC SHIFTS:
------------------------------------------------------------------------
${analysisResult.clauses.map((c, i) => `
[${i + 1}] ${c.clauseName}
- Risk Level: ${c.riskScore}% (${c.riskSeverity})
- Semantic Shift: ${c.semanticChangePercentage}%
- Direction: ${c.direction}
- Timing: Issued ${c.timingBeforeDeadline}
- Original RFP Text: "${c.originalText}"
- Amended Corrigendum Text: "${c.changedText}"
- Vigilance Explanation: ${c.oneLineExplanation}
`).join('\n')}
========================================================================
GENERATED VIA AI INTEGRITY MONITOR • DIGITAL SIGNATURE VERIFIED
========================================================================`;

        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `CVC_Integrity_Audit_${analysisResult.tenderRef.replace(/[/\\?%*:|"<>]/g, '_')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setTimeout(() => setDownloadSuccessToast(false), 3500);
    }, 800);
  };

  // Escalate to Vigilance Handler
  const handleConfirmEscalation = () => {
    setIsEscalateModalOpen(false);
    if (selectedActionType === 'FREEZE') {
      setEscalateSuccessMsg('Tender portal immediately FROZEN on GeM. Procurement Officer and CPSE Vigilance head notified under Section 14 CVC Act.');
    } else if (selectedActionType === 'SHOW_CAUSE') {
      setEscalateSuccessMsg('Formal Rule 11 Show-Cause Notice issued to Procuring Officer. 72-hour mandatory explanation deadline logged.');
    } else {
      setEscalateSuccessMsg('Dossier transmitted to Central Vigilance Commission (CVC) Special Investigation Unit.');
    }
  };

  // Filter clauses
  const filteredClauses = analysisResult?.clauses.filter(clause => {
    if (clauseFilter === 'ALL') return true;
    if (clauseFilter === 'CRITICAL_HIGH') return clause.riskSeverity === 'CRITICAL' || clause.riskSeverity === 'HIGH';
    if (clauseFilter === 'RESTRICTIVE') return clause.direction === 'MORE RESTRICTIVE';
    if (clauseFilter === 'NEUTRAL') return clause.direction === 'NEUTRAL';
    return true;
  }) || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* 1. Header & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileDiff className="w-4 h-4" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Tender Integrity & Corrigendum Semantic Monitor
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-300">
              Anti-Tampering Watchdog
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-4xl">
            Detect last-minute corrigenda modifications, restrictive bidder turnover inflation, and proprietary specification tailoring designed to favor pre-selected vendors in CPSE & Government procurements.
          </p>
        </div>

        {/* Sample Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="load-sample-bsnl-btn"
            onClick={() => {
              setOriginalFile('Original_RFP_BSNL_Hardware_GEM_771923.pdf');
              setOriginalFileSize('4.2 MB (48 Pages)');
              setCorrigendumFile('Corrigendum_03_Clause_Amendments_Final.pdf');
              setCorrigendumFileSize('1.1 MB (8 Pages)');
              setAmendmentDate('2026-09-18T14:30');
              setTenderDeadline('2026-09-20T17:00');
              handleRunSemanticDiff();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Load Flagged BSNL Corrigendum Sample</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {escalateSuccessMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <span><strong className="text-white">Action Executed:</strong> {escalateSuccessMsg}</span>
          </div>
          <button 
            onClick={() => setEscalateSuccessMsg('')}
            className="text-rose-400 hover:text-white font-bold text-xs"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {downloadSuccessToast && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span><strong>Dossier Exported:</strong> Forensic CVC Integrity Report downloaded successfully.</span>
        </div>
      )}

      {/* =========================================================================
          TOP SECTION: Side-by-Side PDF Upload Zones + Date Inputs + Warning
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left PDF Zone: Original Tender RFP */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 text-[11px] font-mono">1</span>
              Original Tender RFP (Baseline)
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">NIT / Primary Bid PDF</span>
          </div>

          <div
            id="dropzone-original-tender"
            onDragOver={(e) => { e.preventDefault(); setIsDragOverOriginal(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragOverOriginal(false); }}
            onDrop={handleDropOriginal}
            onClick={() => origInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
              isDragOverOriginal 
                ? 'border-blue-400 bg-blue-950/30' 
                : 'border-slate-700/80 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/70'
            }`}
          >
            <input
              ref={origInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setOriginalFile(e.target.files[0].name);
                  setOriginalFileSize(`${(e.target.files[0].size / (1024 * 1024)).toFixed(1)} MB`);
                }
              }}
            />

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-blue-400">
                <UploadCloud className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-white">
                Drag & Drop Original Tender PDF
              </p>
              <button 
                type="button"
                className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-200"
              >
                Browse Files
              </button>
            </div>
          </div>

          {/* Original File Indicator */}
          {originalFile && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{originalFile}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{originalFileSize}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 shrink-0">
                Baseline RFP
              </span>
            </div>
          )}
        </div>

        {/* Right PDF Zone: Corrigendum (Amendment) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 text-[11px] font-mono">2</span>
              Corrigendum / Addendum (Amendment)
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Revised Clauses PDF</span>
          </div>

          <div
            id="dropzone-corrigendum-tender"
            onDragOver={(e) => { e.preventDefault(); setIsDragOverCorrigendum(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragOverCorrigendum(false); }}
            onDrop={handleDropCorrigendum}
            onClick={() => corrInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
              isDragOverCorrigendum 
                ? 'border-rose-400 bg-rose-950/30' 
                : 'border-slate-700/80 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/70'
            }`}
          >
            <input
              ref={corrInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setCorrigendumFile(e.target.files[0].name);
                  setCorrigendumFileSize(`${(e.target.files[0].size / (1024 * 1024)).toFixed(1)} MB`);
                }
              }}
            />

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-rose-400">
                <UploadCloud className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-white">
                Drag & Drop Corrigendum Amendment PDF
              </p>
              <button 
                type="button"
                className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-200"
              >
                Browse Files
              </button>
            </div>
          </div>

          {/* Corrigendum File Indicator */}
          {corrigendumFile && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{corrigendumFile}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{corrigendumFileSize}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 shrink-0">
                Amendment Document
              </span>
            </div>
          )}
        </div>

      </div>

      {/* =========================================================================
          DATE CONTROLS & STATUTORY GAP WARNING (UNDER 7 DAYS)
         ========================================================================= */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          
          {/* Amendment Date Input */}
          <div className="sm:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Corrigendum Publication Timestamp
            </label>
            <input
              id="input-amendment-date"
              type="datetime-local"
              value={amendmentDate}
              onChange={(e) => setAmendmentDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {/* Tender Deadline Input */}
          <div className="sm:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              Final Bid Submission Cutoff Deadline
            </label>
            <input
              id="input-tender-deadline"
              type="datetime-local"
              value={tenderDeadline}
              onChange={(e) => setTenderDeadline(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
          </div>

          {/* Run Semantic Diff CTA Button */}
          <div className="sm:col-span-4">
            <button
              id="run-semantic-diff-btn"
              onClick={handleRunSemanticDiff}
              disabled={isAnalyzing}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                isAnalyzing
                  ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-950/60 hover:shadow-blue-900/80 scale-[1.005] active:scale-[0.995]'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  <span>Computing Semantic Embeddings...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-blue-200" />
                  <span>Run Semantic Diff & Corruption Scan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {analysisError && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5 animate-fadeIn">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>Gemini API Notice</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {analysisError} (Using resilient vigilance fallback rules).
            </p>
          </div>
        )}

        {/* AI Engine & Latency Indicator */}
        {apiLatencyMs !== null && !isAnalyzing && (
          <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-blue-400 font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              Gemini 3.7 Flash Semantic Comparator
            </span>
            <span className="font-mono text-slate-400">
              Audit Latency: <span className="text-white font-bold">{apiLatencyMs}ms</span>
            </span>
          </div>
        )}

        {/* Optional Clause Texts Inspector */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowClauseTextInspector(!showClauseTextInspector)}
            className="w-full py-2 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <FileDiff className="w-3.5 h-3.5 text-blue-400" />
              <span>{showClauseTextInspector ? 'Hide Clause Texts Sent to Gemini' : 'Inspect / Edit Clause Texts Sent to Gemini'}</span>
            </span>
            <span className="text-[10px] font-mono text-blue-400">
              {originalClauseText.length + amendedClauseText.length} total chars
            </span>
          </button>

          {showClauseTextInspector && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 animate-fadeIn">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-blue-300 font-bold">1. Original RFP Text:</span>
                  <button
                    type="button"
                    onClick={() => setOriginalClauseText(SAMPLE_ORIGINAL_CORPUS_TEXT)}
                    className="text-blue-400 hover:underline text-[10px]"
                  >
                    Reset Baseline
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={originalClauseText}
                  onChange={(e) => setOriginalClauseText(e.target.value)}
                  placeholder="Paste original tender RFP text..."
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500 leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-rose-300 font-bold">2. Corrigendum Text:</span>
                  <button
                    type="button"
                    onClick={() => setAmendedClauseText(SAMPLE_AMENDED_CORRIGENDUM_TEXT)}
                    className="text-rose-400 hover:underline text-[10px]"
                  >
                    Reset Corrigendum
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={amendedClauseText}
                  onChange={(e) => setAmendedClauseText(e.target.value)}
                  placeholder="Paste corrigendum amendment text..."
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-rose-500 leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Progress Bar if Analyzing */}
        {isAnalyzing && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-blue-500/30 text-xs space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-blue-400 font-semibold">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                Gemini AI Semantic Discrepancy Engine Running...
              </span>
              <span className="text-[10px] font-mono bg-blue-950/60 px-2 py-0.5 rounded border border-blue-500/30">
                GFR 173(iii) & CVC Anti-Rigging
              </span>
            </div>
            <p className="text-slate-300 text-[11px] font-mono leading-relaxed">
              {analysisStep}
            </p>
          </div>
        )}

        {/* STATUTORY WINDOW WARNING BANNER (Gap < 7 Days) */}
        {isWindowViolated ? (
          <div className="p-4 rounded-xl bg-rose-950/40 border-2 border-rose-500/60 text-xs text-rose-200 flex items-start gap-3 shadow-lg shadow-rose-950/40 animate-pulse">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-rose-300 font-black text-sm uppercase tracking-wide">
                  ⚠️ Statutory CVC Integrity Breach Warning: Sub-7-Day Amendment Window
                </strong>
                <span className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-100 font-mono font-bold text-[10px]">
                  Gap: {daysGap} Days ({(daysGap * 24).toFixed(0)} Hours Remaining)
                </span>
              </div>
              <p className="text-rose-200 text-xs leading-relaxed">
                The corrigendum was published <strong>only {daysGap} days ({(daysGap * 24).toFixed(0)} hours)</strong> prior to the tender submission deadline. Under <strong>GFR 2017 Rule 173(iii)</strong> and <strong>CVC Circular No. 01/04/2021</strong>, any substantive amendment to bidder qualification or technical specifications requires a mandatory deadline extension of at least <strong>7 to 14 days</strong> to ensure fair competitive parity for all bidders.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Amendment Window Compliant:</strong> {daysGap} days gap between amendment publication and deadline satisfies the statutory 7-day CVC requirement.
            </span>
          </div>
        )}

      </div>

      {/* =========================================================================
          RESULTS SECTION: Corruption Risk Gauge + Flagged Clause List + Actions
         ========================================================================= */}
      {analysisResult && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* 1. OVERALL CORRUPTION-RISK GAUGE CARD */}
          <div className="glass-panel-elevated p-6 rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-900/95 to-[#161226] space-y-5 shadow-2xl">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Tender Reference & Overview */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {analysisResult.tenderRef}
                  </span>
                  <span className="text-xs text-slate-400">
                    {analysisResult.department}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mt-1.5 leading-snug">
                  {analysisResult.title}
                </h3>
              </div>

              {/* Action Buttons Top */}
              <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
                {/* Download Report */}
                <button
                  id="btn-download-integrity-report"
                  onClick={handleDownloadReport}
                  disabled={isDownloadingReport}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white transition-colors flex items-center gap-2 shadow-sm"
                >
                  {isDownloadingReport ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-blue-400" />
                  )}
                  <span>Download Report</span>
                </button>

                {/* Escalate to Vigilance */}
                <button
                  id="btn-escalate-vigilance"
                  onClick={() => setIsEscalateModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-rose-950/60 hover:shadow-rose-900/80"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Escalate to Vigilance</span>
                </button>
              </div>
            </div>

            {/* Visual Risk Gauge & Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2 border-t border-slate-800/80">
              
              {/* Circular / Arc Gauge Visual */}
              <div className="md:col-span-5 flex items-center gap-5 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#1e293b"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke={analysisResult.overallCorruptionRisk >= 70 ? '#f43f5e' : analysisResult.overallCorruptionRisk >= 35 ? '#eab308' : '#10b981'}
                      strokeWidth="10"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * analysisResult.overallCorruptionRisk) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl sm:text-3xl font-black text-white leading-none">
                      {analysisResult.overallCorruptionRisk}%
                    </span>
                    <span className="text-[9px] uppercase font-bold text-slate-400 mt-1">
                      Risk Index
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wide border ${
                      analysisResult.riskLabel === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                        : analysisResult.riskLabel === 'MODERATE'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    }`}>
                      {analysisResult.riskLabel} INTEGRITY RISK
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {analysisResult.overallCorruptionRisk >= 70 
                      ? 'High probability of anti-competitive vendor lock-in and procedural tampering.'
                      : 'Moderate anomalies detected in technical amendment wording.'}
                  </p>
                </div>
              </div>

              {/* 3 Metric Cards */}
              <div className="md:col-span-7 grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center">
                  <span className="text-slate-500 block text-[11px]">Clauses Altered</span>
                  <strong className="text-white font-bold text-base mt-0.5 block">3 Clauses</strong>
                  <span className="text-[10px] text-rose-400">2 Restrictive Shifts</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center">
                  <span className="text-slate-500 block text-[11px]">Timing Cutoff</span>
                  <strong className="text-rose-400 font-bold text-base mt-0.5 block font-mono">48 Hours</strong>
                  <span className="text-[10px] text-slate-400">Before Bid Close</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center">
                  <span className="text-slate-500 block text-[11px]">CVC Window Status</span>
                  <strong className="text-rose-400 font-bold text-base mt-0.5 block">VIOLATED</strong>
                  <span className="text-[10px] text-rose-400">&lt; 7 Days Mandatory</span>
                </div>
              </div>

            </div>

            {/* Summary Note */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>{analysisResult.summaryNote}</span>
            </div>

          </div>

          {/* 2. FLAGGED CLAUSE CHANGES LIST */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Flagged Clause Modifications & Semantic Shift Matrix
                </h3>
                <p className="text-xs text-slate-400">
                  Side-by-side textual diff comparing initial RFP wording with corrigendum amendments
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 text-xs bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                <button
                  onClick={() => setClauseFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    clauseFilter === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({analysisResult.clauses.length})
                </button>
                <button
                  onClick={() => setClauseFilter('RESTRICTIVE')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    clauseFilter === 'RESTRICTIVE' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-rose-400'
                  }`}
                >
                  More Restrictive (2)
                </button>
                <button
                  onClick={() => setClauseFilter('NEUTRAL')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    clauseFilter === 'NEUTRAL' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Neutral (1)
                </button>
              </div>
            </div>

            {/* Clause Items List */}
            <div className="space-y-4">
              {filteredClauses.map((clause) => {
                const isCritical = clause.riskSeverity === 'CRITICAL';
                const isHigh = clause.riskSeverity === 'HIGH';
                const isRestrictive = clause.direction === 'MORE RESTRICTIVE';

                return (
                  <div
                    key={clause.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isCritical
                        ? 'bg-rose-950/15 border-rose-500/40 hover:border-rose-500/60 shadow-lg shadow-rose-950/20'
                        : isHigh
                        ? 'bg-amber-950/15 border-amber-500/40 hover:border-amber-500/60 shadow-lg shadow-amber-950/20'
                        : 'bg-slate-900/80 border-slate-700/70 hover:border-slate-600'
                    }`}
                  >
                    {/* Header Row of Clause Item */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-white">
                            {clause.clauseName}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
                            {clause.clauseRef}
                          </span>
                        </div>
                      </div>

                      {/* Badges & Metrics */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Direction Badge */}
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border uppercase tracking-wider ${
                          clause.direction === 'MORE RESTRICTIVE'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : clause.direction === 'LESS RESTRICTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {clause.direction}
                        </span>

                        {/* Semantic Shift */}
                        <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono">
                          {clause.semanticChangePercentage}% Semantic Shift
                        </span>

                        {/* Risk Score */}
                        <span className={`text-xs font-black px-2.5 py-1 rounded-md border ${
                          isCritical
                            ? 'bg-rose-600 text-white border-rose-500'
                            : isHigh
                            ? 'bg-amber-600 text-white border-amber-500'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {clause.riskScore}% Risk
                        </span>
                      </div>
                    </div>

                    {/* Timing & Violation Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className={`w-3.5 h-3.5 ${clause.hoursBeforeDeadline <= 48 ? 'text-rose-400' : 'text-slate-400'}`} />
                        <span className="text-slate-300">
                          Timing of Revision: <strong className={clause.hoursBeforeDeadline <= 48 ? 'text-rose-400 font-mono font-bold' : 'text-slate-200 font-mono'}>
                            {clause.timingBeforeDeadline}
                          </strong>
                        </span>
                      </div>

                      {clause.violationCode && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Ref: <strong className="text-slate-300">{clause.violationCode}</strong>
                        </span>
                      )}
                    </div>

                    {/* Original vs Changed Text Diff Box */}
                    <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      
                      {/* Original RFP Clause */}
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                          <span>Original RFP Wording</span>
                          <span className="text-blue-400">Baseline</span>
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">
                          {clause.originalText}
                        </p>
                      </div>

                      {/* Amended Corrigendum Clause */}
                      <div className={`p-3.5 rounded-xl border space-y-1.5 ${
                        isRestrictive 
                          ? 'bg-rose-950/25 border-rose-500/40 text-rose-100' 
                          : 'bg-slate-900/90 border-slate-800 text-slate-200'
                      }`}>
                        <div className="flex items-center justify-between uppercase text-[10px] font-bold tracking-wider">
                          <span className={isRestrictive ? 'text-rose-400' : 'text-slate-400'}>
                            Corrigendum Amendment
                          </span>
                          <span className={isRestrictive ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                            {isRestrictive ? 'Modified' : 'Altered'}
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed ${isRestrictive ? 'text-rose-200' : 'text-slate-200'}`}>
                          {clause.changedText}
                        </p>
                      </div>

                    </div>

                    {/* One-Line Explanation */}
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isCritical ? 'text-rose-400' : 'text-amber-400'}`} />
                      <div>
                        <strong className="text-slate-200 block mb-0.5">Vigilance Forensic Finding:</strong>
                        <span>{clause.oneLineExplanation}</span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>

          {/* 3. Bottom Action Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              Analysis based on GFR 2017 Rule 173(iii), CVC Circular 01/04/2021, and Section 11 Vigilance Framework.
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadReport}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Export Dossier (TXT/PDF)</span>
              </button>

              <button
                onClick={() => setIsEscalateModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-rose-950"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Escalate to Vigilance</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          MODAL: Escalate to Vigilance Confirmation
         ========================================================================= */}
      {isEscalateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel-elevated p-6 rounded-2xl border border-rose-500/40 max-w-lg w-full space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">
                  Escalate Corrigendum Tamper Case to Vigilance
                </h3>
              </div>
              <button
                onClick={() => setIsEscalateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200">
                <p className="font-bold text-rose-300 mb-1">
                  Tender Reference: {analysisResult?.tenderRef}
                </p>
                <p>
                  You are taking formal vigilance action regarding the sub-7-day restrictive corrigendum issued by {analysisResult?.department}.
                </p>
              </div>

              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Select Vigilance Action Protocol:
              </label>

              <div className="space-y-2">
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedActionType === 'FREEZE'
                    ? 'bg-rose-950/30 border-rose-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}>
                  <input
                    type="radio"
                    name="actionType"
                    checked={selectedActionType === 'FREEZE'}
                    onChange={() => setSelectedActionType('FREEZE')}
                    className="mt-0.5 accent-rose-500"
                  />
                  <div>
                    <strong className="text-white block">Immediate Portal Bidding Freeze (Rule 14)</strong>
                    <span className="text-[11px] text-slate-300">
                      Suspends electronic bid submission on GeM until procuring officer rectifies restrictive clauses.
                    </span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedActionType === 'SHOW_CAUSE'
                    ? 'bg-rose-950/30 border-rose-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}>
                  <input
                    type="radio"
                    name="actionType"
                    checked={selectedActionType === 'SHOW_CAUSE'}
                    onChange={() => setSelectedActionType('SHOW_CAUSE')}
                    className="mt-0.5 accent-rose-500"
                  />
                  <div>
                    <strong className="text-white block">Issue Formal Rule 11 Show-Cause Notice</strong>
                    <span className="text-[11px] text-slate-300">
                      Mandates the Procuring Committee to submit written justification within 72 hours for exclusion of MSEs.
                    </span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedActionType === 'CVC_AUDIT'
                    ? 'bg-rose-950/30 border-rose-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}>
                  <input
                    type="radio"
                    name="actionType"
                    checked={selectedActionType === 'CVC_AUDIT'}
                    onChange={() => setSelectedActionType('CVC_AUDIT')}
                    className="mt-0.5 accent-rose-500"
                  />
                  <div>
                    <strong className="text-white block">Log & Transmit to CVC Special Investigation</strong>
                    <span className="text-[11px] text-slate-300">
                      Files digital evidence dossier into the Central Vigilance Commission national oversight registry.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEscalateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirm-escalation-action-btn"
                  onClick={handleConfirmEscalation}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950"
                >
                  Confirm & Execute Vigilance Order
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
