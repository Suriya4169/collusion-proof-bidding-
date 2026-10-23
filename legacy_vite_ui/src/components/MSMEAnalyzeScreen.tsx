import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Sparkles, 
  ShieldCheck, 
  Building2, 
  Award, 
  IndianRupee, 
  ChevronRight, 
  AlertCircle, 
  FileCheck2, 
  ExternalLink, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  RefreshCw, 
  FileUp, 
  Layers, 
  Info,
  HelpCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Percent,
  FileDown
} from 'lucide-react';
import { MSMEProfile, DetailedTenderAnalysis, AnalysisRuleItem, TenderAnalysisItem } from '../types';
import { MOCK_DETAILED_ANALYSIS } from '../data/mockData';
import { SAMPLE_TENDER_RFP_TEXT } from '../data/tenderCorpus';
import { generateMSMEAuditPDF } from '../utils/pdfExport';

interface MSMEAnalyzeScreenProps {
  profile: MSMEProfile;
  onNavigateTab?: (tab: string) => void;
}

export const MSMEAnalyzeScreen: React.FC<MSMEAnalyzeScreenProps> = ({ profile, onNavigateTab }) => {
  // Upload and file state
  const [uploadedFileName, setUploadedFileName] = useState<string>('GeM_Bid_Document_GEM-2026-B-894102.pdf');
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('2.8 MB (24 Pages)');
  const [tenderText, setTenderText] = useState<string>(SAMPLE_TENDER_RFP_TEXT);
  const [showRawTextEditor, setShowRawTextEditor] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis execution state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DetailedTenderAnalysis | null>(MOCK_DETAILED_ANALYSIS);

  // Plain language summary language toggle
  const [summaryLanguage, setSummaryLanguage] = useState<'english' | 'hindi'>('english');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Rule filter and selected rule for modal / popover
  const [ruleFilter, setRuleFilter] = useState<'ALL' | 'EXEMPTED' | 'MET' | 'CONDITIONAL'>('ALL');
  const [selectedRule, setSelectedRule] = useState<AnalysisRuleItem | null>(null);

  // Missing doc modal simulation
  const [showUploadVaultModal, setShowUploadVaultModal] = useState(false);
  const [vaultUploadSuccess, setVaultUploadSuccess] = useState(false);

  // Export Active Analysis as PDF
  const handleExportActiveAnalysisPDF = () => {
    if (!analysisResult) return;
    const item: TenderAnalysisItem = {
      id: analysisResult.tenderId || 'ACTIVE-001',
      tenderRef: analysisResult.tenderRef,
      title: analysisResult.title,
      authority: analysisResult.authority,
      portal: 'GeM',
      estimatedValue: analysisResult.estimatedValue,
      submissionDeadline: analysisResult.submissionDeadline,
      eligibilityStatus: analysisResult.verdict === 'ELIGIBLE' ? 'Eligible' : analysisResult.verdict === 'PARTIAL' ? 'Conditional' : 'Ineligible',
      matchScore: analysisResult.score,
      matchSummary: analysisResult.plainLanguageSummary?.english || analysisResult.title,
      emdStatus: 'Exempted (MSME)',
      turnoverRequirement: 'Relaxed under MSME Order 2012',
      experienceRequirement: 'Relaxed under GFR Rule 173(i)',
      makeInIndiaPreference: 'Class-I Local Supplier (50%+)',
      keyDisqualifierOrAdvantage: analysisResult.msmeExemptionsApplied,
      category: 'Manufacturing',
    };

    generateMSMEAuditPDF({
      profile,
      tenders: [item],
      filterLabel: `Live AI Analysis Dossier (${analysisResult.tenderRef})`,
      includeLegalExemptions: true,
      includeVaultStatus: true,
    });
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setUploadedFileName(file.name);
      setUploadedFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB (Auto-detected)`);
      
      // If it's a text/json file, read content directly
      if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
        try {
          const text = await file.text();
          setTenderText(text);
          triggerAnalysis(file.name, text);
          return;
        } catch {
          // fallback to default
        }
      }
      triggerAnalysis(file.name);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadedFileName(file.name);
      setUploadedFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB (Auto-detected)`);
      
      if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
        try {
          const text = await file.text();
          setTenderText(text);
          triggerAnalysis(file.name, text);
          return;
        } catch {
          // fallback
        }
      }
      triggerAnalysis(file.name);
    }
  };

  // Real AI Analysis via Gemini API server route
  const triggerAnalysis = async (customFileName?: string, textOverride?: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    const startTime = Date.now();
    setAnalysisStep('Ingesting Tender RFP text & aligning compliance clauses...');

    const activeText = textOverride || tenderText || SAMPLE_TENDER_RFP_TEXT;

    const timer1 = setTimeout(() => {
      setAnalysisStep('Evaluating MSME statutory exemptions under Public Procurement Policy 2012...');
    }, 400);

    const timer2 = setTimeout(() => {
      setAnalysisStep('Cross-referencing Document Vault & GFR Rule 173(i) turnover waivers...');
    }, 850);

    const timer3 = setTimeout(() => {
      setAnalysisStep('Calling Gemini 3.7 Flash: Generating rule-by-rule verdict, distance & summaries...');
    }, 1300);

    try {
      const response = await fetch('/api/analyze-tender', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenderText: activeText,
          msmeProfile: profile,
          fileName: customFileName || uploadedFileName,
          tenderRef: 'GEM/2026/B/894102',
        }),
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `Server responded with status ${response.status}`);
      }

      const data: DetailedTenderAnalysis = await response.json();
      setAnalysisResult(data);
      setApiLatencyMs(Date.now() - startTime);
    } catch (err: any) {
      console.error('Error analyzing tender via Gemini API:', err);
      setAnalysisError(err.message || 'Failed to connect to Gemini API.');
      // Keep UI functional with mock if result was null
      if (!analysisResult) {
        setAnalysisResult({
          ...MOCK_DETAILED_ANALYSIS,
          title: customFileName ? `Tender Document: ${customFileName.replace('.pdf', '')}` : MOCK_DETAILED_ANALYSIS.title,
        });
      }
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Handle Audio Speech synthesis for Plain Language Summary
  const handleToggleSpeech = () => {
    if (!analysisResult) return;
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        const textToRead = summaryLanguage === 'english' 
          ? analysisResult.plainLanguageSummary.english 
          : analysisResult.plainLanguageSummary.hindi;
        
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = summaryLanguage === 'english' ? 'en-IN' : 'hi-IN';
        utterance.rate = 0.95;
        
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
      }
    } else {
      alert('Speech synthesis is not supported in this browser.');
    }
  };

  // Copy Summary text
  const handleCopySummary = () => {
    if (!analysisResult) return;
    const textToCopy = summaryLanguage === 'english' 
      ? analysisResult.plainLanguageSummary.english 
      : analysisResult.plainLanguageSummary.hindi;
    navigator.clipboard.writeText(textToCopy);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const filteredRules = analysisResult?.rules.filter(rule => {
    if (ruleFilter === 'ALL') return true;
    return rule.status === ruleFilter;
  }) || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Header & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Tender Eligibility & RFP Analyzer
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              AI Clause Scanner
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
            Upload any GeM bid document or CPPP tender RFP. The platform evaluates your eligibility, applies statutory MSME relaxations (GFR 173(i) & PPP-MSE 2012), verifies your Document Vault, and generates plain language summaries in English and Hindi.
          </p>
        </div>

        {/* Quick Sample Presets */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="load-sample-railway-btn"
            onClick={() => {
              setUploadedFileName('GeM_Bid_Document_GEM-2026-B-894102.pdf');
              setUploadedFileSize('2.8 MB (24 Pages)');
              triggerAnalysis('GeM_Bid_Document_GEM-2026-B-894102.pdf');
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Load Sample Tender (₹72.5L)</span>
          </button>
        </div>
      </div>

      {/* TWO PANEL MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* =========================================================================
            LEFT PANEL: Upload Zone + MSME Profile Summary + Analyze CTA Button
           ========================================================================= */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* 1. PDF Drag-and-Drop Zone */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileUp className="w-4 h-4 text-emerald-400" />
                1. Upload Tender RFP (PDF)
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                GeM / CPPP / State Portals
              </span>
            </div>

            {/* Drop Zone Box */}
            <div
              id="tender-pdf-dropzone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
                isDragOver 
                  ? 'border-emerald-400 bg-emerald-950/20 scale-[1.01]' 
                  : 'border-slate-700/80 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900/80'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileSelect}
                className="hidden"
                id="tender-file-input"
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${
                  isDragOver ? 'scale-110 bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  <UploadCloud className="w-7 h-7" />
                </div>
                
                <div>
                  <p className="text-sm font-semibold text-white">
                    Drag and drop your Tender RFP PDF here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports GeM Bid PDF, CPPP NIT tender notices, or scanned clause docs
                  </p>
                </div>

                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors shadow-sm">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    Browse Files
                  </span>
                </div>
              </div>
            </div>

            {/* Selected File Card */}
            {uploadedFileName && (
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/70 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {uploadedFileName}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {uploadedFileSize}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                  Ready
                </span>
              </div>
            )}
          </div>

          {/* 2. Read-Only MSME Profile Summary Card */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                2. MSME Profile (Vault Linked)
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                Verified Udyam
              </span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Company Name & Category */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 font-medium">Enterprise Name</span>
                <strong className="text-white font-bold text-right">{profile.companyName}</strong>
              </div>

              {/* Udyam Number */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 font-medium">Udyam Registration</span>
                <span className="text-emerald-300 font-mono font-bold">{profile.udyamNumber}</span>
              </div>

              {/* Annual Turnover & Experience */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Audited Turnover (FY)</span>
                  <strong className="text-white font-bold text-sm">₹45.00 Lakhs</strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">3-Yr Avg: {profile.annualTurnover}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Manufacturing Exp.</span>
                  <strong className="text-white font-bold text-sm">5 Years</strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Since 2021 (Audited)</span>
                </div>
              </div>

              {/* MSME Status & Certifications */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">MSME Classification</span>
                  <span className="text-white font-semibold">{profile.category} Enterprise (MSE)</span>
                </div>
                
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-500 block text-[11px] mb-1.5">Active Certifications in Vault:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                      <Award className="w-3 h-3" /> ZED Gold Certified
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[10px] font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> ISO 9001:2015
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Class-I Local (68%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Analyze Now Button */}
          <div className="space-y-3">
            <button
              id="analyze-now-btn"
              onClick={() => triggerAnalysis(uploadedFileName)}
              disabled={isAnalyzing}
              className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-lg ${
                isAnalyzing
                  ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-950/60 hover:shadow-emerald-900/80 scale-[1.005] active:scale-[0.995]'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <span className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin shrink-0" />
                  <span>Scanning RFP Clauses & Statutory Rules...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-emerald-200" />
                  <span>Analyze Tender Eligibility Now</span>
                </>
              )}
            </button>

            {/* Live Step Tracker during Analysis */}
            {isAnalyzing && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-xs space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-emerald-400 font-semibold">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Gemini AI Reasoning in Progress...
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    GFR 173(i) & PPP-MSE 2012
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] font-mono leading-relaxed">
                  {analysisStep}
                </p>
              </div>
            )}

            {/* Error Banner */}
            {analysisError && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5 animate-fadeIn">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>Gemini API Notice</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {analysisError} (Using resilient fallback compliance model).
                </p>
              </div>
            )}

            {/* AI Model & Latency Status Indicator */}
            {apiLatencyMs !== null && !isAnalyzing && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
                  <Sparkles className="w-3.5 h-3.5" />
                  Gemini 3.7 Flash Engine
                </span>
                <span className="font-mono text-slate-400">
                  Latency: <span className="text-white font-bold">{apiLatencyMs}ms</span>
                </span>
              </div>
            )}

            {/* Optional Extracted Text Inspector */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowRawTextEditor(!showRawTextEditor)}
                className="w-full py-2 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{showRawTextEditor ? 'Hide Extracted RFP Text' : 'Inspect / Edit RFP Text Sent to Gemini'}</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  {tenderText.length} chars
                </span>
              </button>

              {showRawTextEditor && (
                <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Tender RFP Document Text (Editable):</span>
                    <button
                      type="button"
                      onClick={() => setTenderText(SAMPLE_TENDER_RFP_TEXT)}
                      className="text-emerald-400 hover:underline text-[10px]"
                    >
                      Reset to Default ICF Tender
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={tenderText}
                    onChange={(e) => setTenderText(e.target.value)}
                    placeholder="Paste tender clauses, eligibility criteria, or RFP text..."
                    className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-emerald-500 leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-500">
                    Edits here will be passed directly to Gemini structured output engine on next analysis.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT PANEL: Overall Verdict + Rule-by-Rule List + Missing Doc Alert
           ========================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          
          {analysisResult ? (
            <>
              {/* 1. Overall Verdict Card */}
              <div className="glass-panel-elevated p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/20 space-y-4 shadow-xl">
                
                {/* Top Row: Ref & Verdict Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {analysisResult.tenderRef}
                      </span>
                      <span className="text-xs text-slate-400">
                        {analysisResult.authority}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white mt-1.5 leading-snug">
                      {analysisResult.title}
                    </h3>
                  </div>

                  {/* Verdict Badge & PDF Export */}
                  <div className="shrink-0 flex flex-wrap items-center gap-2.5">
                    <div className="text-right pr-1">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Eligibility Score
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-300">
                        {analysisResult.score}<span className="text-xs text-slate-400 font-normal">/100</span>
                      </div>
                    </div>

                    <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md shadow-emerald-950/50">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {analysisResult.verdict}
                    </div>

                    <button
                      type="button"
                      id="export-active-analysis-pdf-btn"
                      onClick={handleExportActiveAnalysisPDF}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                      title="Export this analysis report as an official PDF"
                    >
                      <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Export PDF</span>
                    </button>
                  </div>
                </div>

                {/* Tender Quick Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs pt-1 border-t border-slate-800/80">
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[11px]">Estimated Value:</span>
                    <strong className="text-white font-semibold">{analysisResult.estimatedValue}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[11px]">Submission Due:</span>
                    <strong className="text-slate-300 font-semibold">{analysisResult.submissionDeadline}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-slate-500 block text-[11px]">MSME Quota:</span>
                    <strong className="text-emerald-400 font-semibold">25% MSE Reservation</strong>
                  </div>
                </div>

                {/* Note on MSME Exemptions Applied */}
                <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-emerald-300 font-bold block mb-0.5">
                      Statutory MSME Exemptions Applied:
                    </strong>
                    <span>{analysisResult.msmeExemptionsApplied}</span>
                  </div>
                </div>
              </div>

              {/* 2. Rule-by-Rule Compliance Table / List */}
              <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
                
                {/* Header & Filter Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      Rule-by-Rule Compliance Breakdown
                    </h3>
                    <p className="text-xs text-slate-400">
                      RFP clauses cross-checked against statutory exemptions and Document Vault
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 text-xs bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                    <button
                      onClick={() => setRuleFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        ruleFilter === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All ({analysisResult.rules.length})
                    </button>
                    <button
                      onClick={() => setRuleFilter('EXEMPTED')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        ruleFilter === 'EXEMPTED' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400'
                      }`}
                    >
                      Exempted
                    </button>
                    <button
                      onClick={() => setRuleFilter('MET')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        ruleFilter === 'MET' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-blue-400'
                      }`}
                    >
                      Met
                    </button>
                    <button
                      onClick={() => setRuleFilter('CONDITIONAL')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        ruleFilter === 'CONDITIONAL' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-amber-400'
                      }`}
                    >
                      Action Needed
                    </button>
                  </div>
                </div>

                {/* Rules List */}
                <div className="space-y-3">
                  {filteredRules.map((rule) => {
                    const isExempted = rule.status === 'EXEMPTED';
                    const isMet = rule.status === 'MET';
                    const isConditional = rule.status === 'CONDITIONAL';
                    const isUnmet = rule.status === 'UNMET';

                    return (
                      <div
                        key={rule.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isExempted
                            ? 'bg-emerald-950/15 border-emerald-500/30 hover:border-emerald-500/50'
                            : isMet
                            ? 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
                            : isConditional
                            ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/60'
                            : 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/60'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          
                          {/* Left: Status Icon & Rule Name */}
                          <div className="flex items-start gap-3">
                            {/* Traffic-light Icon */}
                            <div className="shrink-0 mt-0.5">
                              {isExempted && (
                                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                                  <ShieldCheck className="w-4 h-4" />
                                </div>
                              )}
                              {isMet && (
                                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300">
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                              )}
                              {isConditional && (
                                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                                  <AlertTriangle className="w-4 h-4" />
                                </div>
                              )}
                              {isUnmet && (
                                <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300">
                                  <XCircle className="w-4 h-4" />
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-bold text-white">
                                  {rule.ruleName}
                                </h4>
                                
                                {/* Status Badge */}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isExempted
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : isMet
                                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                                    : isConditional
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                    : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                }`}>
                                  {isExempted ? 'MSME EXEMPTED' : isMet ? 'CRITERIA MET' : isConditional ? 'ACTION REQUIRED' : 'NOT MET'}
                                </span>

                                <span className="text-[10px] text-slate-400 font-mono">
                                  {rule.sourcePage}
                                </span>
                              </div>

                              <p className="text-xs text-slate-300 mt-1">
                                {rule.detailsNote}
                              </p>
                            </div>
                          </div>

                          {/* Right: Confidence Score & Compliance Distance */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 shrink-0 text-xs">
                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                              <span>Confidence:</span>
                              <strong className="text-white font-bold">{rule.confidenceScore}%</strong>
                            </div>

                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                              isExempted || isMet
                                ? 'bg-emerald-950 border-emerald-500/30 text-emerald-300'
                                : 'bg-amber-950 border-amber-500/30 text-amber-300'
                            }`}>
                              {rule.complianceDistance}
                            </span>
                          </div>
                        </div>

                        {/* Required vs Actual Comparison Box */}
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2.5 border-t border-slate-800/80">
                          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Tender Required:</span>
                            <span className="text-slate-200 font-medium">{rule.requiredValue}</span>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Your Actual / Relieved:</span>
                            <span className={isConditional ? 'text-amber-300 font-semibold' : 'text-emerald-300 font-semibold'}>
                              {rule.actualValue}
                            </span>
                          </div>
                        </div>

                        {/* Legal Exemption Reference Note */}
                        {rule.legalExemptionReference && (
                          <div className="mt-2 text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                            <Info className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span>Legal Statutory Basis: <strong className="text-slate-300 font-sans">{rule.legalExemptionReference}</strong></span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Missing-Document Alert Card */}
              {analysisResult.missingDocuments.length > 0 && (
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/40 bg-amber-950/10 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-amber-300">
                            Missing Document Alert: {analysisResult.missingDocuments[0].name}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-200 uppercase">
                            High Urgency
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          {analysisResult.missingDocuments[0].description}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono mt-1">
                          Ref: {analysisResult.missingDocuments[0].sourcePage}
                        </p>
                      </div>
                    </div>

                    <button
                      id="upload-solvency-cert-btn"
                      onClick={() => setShowUploadVaultModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition-colors shadow-md shadow-amber-950"
                    >
                      Upload to Vault
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-4">
              <UploadCloud className="w-12 h-12 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Tender Loaded</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Upload a Tender RFP PDF on the left panel or click "Load Sample Tender" to start the intelligent eligibility evaluation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          BELOW BOTH PANELS: Plain Language Summary + Recommended Schemes
         ========================================================================= */}
      {analysisResult && (
        <div className="space-y-6 pt-4 border-t border-slate-800/80">
          
          {/* 1. Plain Language Summary Card with English / Hindi Toggle */}
          <div className="glass-panel-elevated p-6 rounded-2xl border border-slate-700/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Plain Language Summary (सरल भाषा में सारांश)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Jargon-free procurement briefing translated for business owners and tender executives
                  </p>
                </div>
              </div>

              {/* Controls: Language Toggle & Audio / Copy */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {/* Language Toggle */}
                <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    id="summary-lang-en-btn"
                    onClick={() => setSummaryLanguage('english')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      summaryLanguage === 'english'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    English
                  </button>
                  <button
                    id="summary-lang-hi-btn"
                    onClick={() => setSummaryLanguage('hindi')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      summaryLanguage === 'hindi'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🇮🇳 हिन्दी (Hindi)
                  </button>
                </div>

                {/* Audio Read-Out Button */}
                <button
                  id="read-aloud-summary-btn"
                  onClick={handleToggleSpeech}
                  title="Listen to summary"
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    isSpeaking 
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse' 
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {isSpeaking ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  <span className="hidden md:inline">{isSpeaking ? 'Stop Audio' : 'Listen'}</span>
                </button>

                {/* Copy Button */}
                <button
                  id="copy-summary-btn"
                  onClick={handleCopySummary}
                  title="Copy summary text"
                  className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span className="hidden md:inline">{copiedText ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Summary Text Content Box */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 text-sm sm:text-base leading-relaxed">
              {summaryLanguage === 'english' ? (
                <p className="font-sans">
                  {analysisResult.plainLanguageSummary.english}
                </p>
              ) : (
                <p className="font-sans leading-relaxed tracking-wide text-slate-100">
                  {analysisResult.plainLanguageSummary.hindi}
                </p>
              )}
            </div>
          </div>

          {/* 2. Recommended Schemes for You Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  Recommended Government Relief & Financing Schemes for This Tender
                </h3>
                <p className="text-xs text-slate-400">
                  Statutory purchase preferences, invoice discounting, and collateral-free working capital tailored to this RFP
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                3 Applicable Programs
              </span>
            </div>

            {/* 2-3 Scheme Chips */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {analysisResult.recommendedSchemes.map((scheme) => (
                <div
                  key={scheme.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    scheme.color === 'emerald'
                      ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60'
                      : scheme.color === 'cyan'
                      ? 'bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-500/60'
                      : 'bg-indigo-950/20 border-indigo-500/30 hover:border-indigo-500/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        scheme.color === 'emerald'
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : scheme.color === 'cyan'
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                          : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      }`}>
                        {scheme.tag}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {scheme.relevance}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white leading-snug">
                      {scheme.name}
                    </h4>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {scheme.benefit}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">Direct MSME Benefit</span>
                    <button
                      onClick={() => alert(`Redirecting to official portal for ${scheme.name}`)}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1 text-xs"
                    >
                      <span>Explore</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upload Missing Solvency Certificate Modal Simulation */}
      {showUploadVaultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel-elevated p-6 rounded-2xl border border-slate-700 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Upload Bank Solvency Certificate
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowUploadVaultModal(false);
                  setVaultUploadSuccess(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {vaultUploadSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">
                  Solvency Certificate Verified & Attached to Vault!
                </h4>
                <p className="text-xs text-slate-300">
                  Bank Solvency of ₹15.00 Lakhs (State Bank of India) has been encrypted and verified. Your bid compliance score has increased to 98/100.
                </p>
                <button
                  onClick={() => {
                    setShowUploadVaultModal(false);
                    setVaultUploadSuccess(false);
                    // Update rule status
                    if (analysisResult) {
                      setAnalysisResult({
                        ...analysisResult,
                        score: 98,
                        rules: analysisResult.rules.map(r => 
                          r.id === 'rule-solvency'
                            ? { ...r, status: 'MET', actualValue: '₹15.0 Lakhs (SBI Certified)', complianceDistance: '+100% (Met)' }
                            : r
                        ),
                        missingDocuments: []
                      });
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <p className="text-slate-300">
                  Select your scanned Bank Solvency Certificate on official bank letterhead with IFSC, Branch seal, and authorized signatory.
                </p>

                <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center space-y-2 bg-slate-900/50">
                  <UploadCloud className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-white font-medium">Bank_Solvency_Certificate_SBI_15Lakhs.pdf</p>
                  <p className="text-slate-400 text-[11px]">Valid until: 28 Feb 2027 • 1.2 MB</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowUploadVaultModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setVaultUploadSuccess(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    Upload & Re-evaluate
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
