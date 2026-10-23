import React, { useState } from 'react';
import { 
  Building2, 
  LayoutDashboard, 
  ShoppingBag, 
  Search, 
  FileText, 
  CreditCard, 
  LogOut, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  Award, 
  ShieldCheck, 
  ExternalLink, 
  ChevronRight, 
  Sparkles, 
  Filter, 
  FileCheck2, 
  AlertCircle,
  HelpCircle,
  IndianRupee,
  Briefcase,
  FileDown,
  Download,
  Printer,
  Check
} from 'lucide-react';
import { MSMEProfile, TenderAnalysisItem, GovernmentScheme } from '../types';
import { MOCK_TENDER_ANALYSES, MOCK_GOVERNMENT_SCHEMES } from '../data/mockData';
import { Modal } from './Modal';
import { MSMEAnalyzeScreen } from './MSMEAnalyzeScreen';
import { MSMEMarketplace, MarketplaceTender } from './MSMEMarketplace';
import { MSMEDocuments } from './MSMEDocuments';
import { MSMEPaymentTracker } from './MSMEPaymentTracker';
import { ThemeSelector } from './ThemeSelector';
import { generateMSMEAuditPDF } from '../utils/pdfExport';

interface MSMEDashboardProps {
  profile: MSMEProfile;
  onLogout: () => void;
  initialTab?: 'dashboard' | 'marketplace' | 'analyze' | 'documents' | 'payments';
}

export const MSMEDashboard: React.FC<MSMEDashboardProps> = ({ profile, onLogout, initialTab }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'marketplace' | 'analyze' | 'documents' | 'payments'>(() => {
    if (initialTab) return initialTab;
    if (typeof window !== 'undefined' && window.location.pathname.includes('/analyze')) return 'analyze';
    if (typeof window !== 'undefined' && window.location.pathname.includes('/marketplace')) return 'marketplace';
    if (typeof window !== 'undefined' && window.location.pathname.includes('/documents')) return 'documents';
    if (typeof window !== 'undefined' && window.location.pathname.includes('/payments')) return 'payments';
    return 'dashboard';
  });

  const handleTabChange = (tab: 'dashboard' | 'marketplace' | 'analyze' | 'documents' | 'payments') => {
    setActiveTab(tab);
    if (tab === 'analyze') {
      window.history.pushState({}, '', '/msme/analyze');
    } else {
      window.history.pushState({}, '', `/msme/${tab}`);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Eligible' | 'Conditional' | 'Ineligible'>('ALL');
  const [selectedTender, setSelectedTender] = useState<TenderAnalysisItem | null>(null);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);

  // PDF Export Modal & Customization State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'filtered' | 'eligible'>('all');
  const [includeLegalExemptions, setIncludeLegalExemptions] = useState(true);
  const [includeVaultStatus, setIncludeVaultStatus] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Filtered recent tenders
  const filteredTenders = MOCK_TENDER_ANALYSES.filter(tender => {
    const matchesSearch = 
      tender.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tender.tenderRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tender.authority.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = 
      statusFilter === 'ALL' ? true : tender.eligibilityStatus === statusFilter;

    return matchesSearch && matchesFilter;
  });

  const handleOpenBreakdown = (tender: TenderAnalysisItem) => {
    setSelectedTender(tender);
    setIsBreakdownModalOpen(true);
  };

  // Trigger PDF Report Generation
  const handleExecutePDFExport = (overrideTenders?: TenderAnalysisItem[], customScopeLabel?: string) => {
    setIsExporting(true);
    setExportSuccess(false);

    setTimeout(() => {
      let targetTenders = MOCK_TENDER_ANALYSES;
      let scopeLabel = 'All Analyzed Tenders';

      if (overrideTenders) {
        targetTenders = overrideTenders;
        scopeLabel = customScopeLabel || 'Selected Tender Record';
      } else if (exportScope === 'eligible') {
        targetTenders = MOCK_TENDER_ANALYSES.filter(t => t.eligibilityStatus === 'Eligible');
        scopeLabel = 'Eligible Tenders Only';
      } else if (exportScope === 'filtered') {
        targetTenders = filteredTenders;
        scopeLabel = `Filtered Query Results (${statusFilter} Status)`;
      }

      generateMSMEAuditPDF({
        profile,
        tenders: targetTenders,
        filterLabel: scopeLabel,
        includeLegalExemptions,
        includeVaultStatus,
      });

      setIsExporting(false);
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        setIsExportModalOpen(false);
      }, 1500);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans">
      
      {/* 1. TOP BAR */}
      <header className="sticky top-0 z-40 bg-[#0b0f19]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-950">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-white tracking-tight">
                {profile.companyName}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                {profile.category} Enterprise
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
              <span>Udyam: <strong className="text-slate-200">{profile.udyamNumber}</strong></span>
              <span className="hidden md:inline">•</span>
              <span className="hidden md:inline">Turnover: <strong className="text-emerald-300 font-sans">{profile.annualTurnover}</strong></span>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <ThemeSelector />

          {profile.zedCertified && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>ZED Gold Certified</span>
            </div>
          )}

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <button
            id="msme-logout-btn"
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* BODY WITH LEFT SIDEBAR + CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR */}
        <aside className="w-64 shrink-0 bg-[#090d16] border-r border-slate-800/80 p-4 hidden md:flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 mb-2">
                MSME Portal Navigation
              </div>
              <nav className="space-y-1">
                <button
                  id="nav-msme-dashboard"
                  onClick={() => handleTabChange('dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>

                <button
                  id="nav-msme-marketplace"
                  onClick={() => handleTabChange('marketplace')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'marketplace'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Tender Marketplace</span>
                  <span className="ml-auto text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md font-mono">
                    2.4k+
                  </span>
                </button>

                <button
                  id="nav-msme-analyze"
                  onClick={() => handleTabChange('analyze')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'analyze'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>Analyze Tender</span>
                  <span className="ml-auto flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </button>

                <button
                  id="nav-msme-documents"
                  onClick={() => handleTabChange('documents')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'documents'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>My Documents</span>
                  <span className="ml-auto text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/40 px-1.5 py-0.5 rounded-md">
                    Verified
                  </span>
                </button>

                <button
                  id="nav-msme-payments"
                  onClick={() => handleTabChange('payments')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'payments'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Payment Tracker</span>
                  {profile.activeDisputesCount > 0 && (
                    <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">
                      {profile.activeDisputesCount} Overdue
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* Quick Exemption Policy Card */}
            <div className="glass-panel p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                MSME Sambandh Benefit
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Central Ministries & CPSEs must procure at least <strong>25%</strong> from MSEs. EMD is 100% exempted.
              </p>
            </div>
          </div>

          {/* Bottom Helpdesk box */}
          <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-500 flex items-center justify-between">
            <span>Udyam Helpline 1800-180-6763</span>
            <HelpCircle className="w-4 h-4 text-slate-400" />
          </div>
        </aside>

        {/* MAIN SCROLLABLE DASHBOARD VIEW */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8">
          
          {/* Top Mobile Navigation Pills */}
          <div className="flex md:hidden overflow-x-auto pb-2 gap-2 text-xs">
            <button
              onClick={() => handleTabChange('dashboard')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
                activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => handleTabChange('marketplace')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
                activeTab === 'marketplace' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Marketplace
            </button>
            <button
              onClick={() => handleTabChange('analyze')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
                activeTab === 'analyze' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Analyze Tender
            </button>
            <button
              onClick={() => handleTabChange('documents')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
                activeTab === 'documents' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              My Documents
            </button>
            <button
              onClick={() => handleTabChange('payments')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
                activeTab === 'payments' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Payments
            </button>
          </div>

          {/* TAB 1: MAIN DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              
              {/* Top Greeting & Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-white">
                    MSME Procurement Intelligence
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Real-time eligibility assessment against GeM & CPPP government tenders.
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    id="export-pdf-dossier-top-btn"
                    onClick={() => setIsExportModalOpen(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs sm:text-sm font-semibold transition-all shadow-sm"
                    title="Export tender analysis history as an official PDF report"
                  >
                    <FileDown className="w-4 h-4 text-emerald-400" />
                    <span>Export PDF Dossier</span>
                  </button>

                  <button
                    id="analyze-new-tender-btn"
                    onClick={() => handleTabChange('analyze')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-emerald-950"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze New Tender</span>
                  </button>
                </div>
              </div>

              {/* 2. 4 STAT CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stat 1: Tenders Analyzed */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider">Tenders Analyzed</span>
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                      <Search className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white tracking-tight">42</span>
                    <span className="text-xs font-medium text-emerald-400 flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> +8 this month
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Scanned across GeM, Railways, Defence & CPPP
                  </p>
                </div>

                {/* Stat 2: Eligible */}
                <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 hover:border-emerald-500/40 transition-all">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Eligible to Bid</span>
                    <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-emerald-400 tracking-tight">29</span>
                    <span className="text-xs font-medium text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      69% Fit Rate
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Qualifies for 25% MSME purchase preference
                  </p>
                </div>

                {/* Stat 3: Not Eligible */}
                <div className="glass-panel p-5 rounded-2xl border border-rose-500/20 bg-rose-950/10 hover:border-rose-500/40 transition-all">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider text-rose-300">Not Eligible</span>
                    <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400">
                      <XCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-rose-400 tracking-tight">13</span>
                    <span className="text-xs font-medium text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-full">
                      Turnover Gap
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Missing past experience or high turnover clause
                  </p>
                </div>

                {/* Stat 4: Payments Overdue */}
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-amber-950/10 hover:border-amber-500/40 transition-all">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">Payments Overdue</span>
                    <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400">
                      <IndianRupee className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-amber-300 tracking-tight">₹32.4 L</span>
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                      3 Invoices &gt;45d
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Subject to MSME Samadhaan 3x compound interest
                  </p>
                </div>
              </div>

              {/* 3. RECENT ANALYSIS RESULTS LIST */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <FileCheck2 className="w-5 h-5 text-emerald-400" />
                      Recent Tender Eligibility Analysis
                    </h3>
                    <p className="text-xs text-slate-400">
                      Evaluated against turnover, EMD waivers, past performance, and Make In India (MII) norms
                    </p>
                  </div>

                  {/* Filters, Search Bar & PDF Export */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tender or ministry..."
                        className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 sm:w-48"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs">
                      <button
                        onClick={() => setStatusFilter('ALL')}
                        className={`px-2 py-1 rounded font-medium ${
                          statusFilter === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setStatusFilter('Eligible')}
                        className={`px-2 py-1 rounded font-medium ${
                          statusFilter === 'Eligible' ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-emerald-300'
                        }`}
                      >
                        Eligible
                      </button>
                      <button
                        onClick={() => setStatusFilter('Conditional')}
                        className={`px-2 py-1 rounded font-medium ${
                          statusFilter === 'Conditional' ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-amber-300'
                        }`}
                      >
                        Conditional
                      </button>
                      <button
                        onClick={() => setStatusFilter('Ineligible')}
                        className={`px-2 py-1 rounded font-medium ${
                          statusFilter === 'Ineligible' ? 'bg-rose-600/30 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-rose-300'
                        }`}
                      >
                        Ineligible
                      </button>
                    </div>

                    {/* PDF Export Button */}
                    <button
                      id="export-filtered-pdf-btn"
                      onClick={() => {
                        setExportScope('filtered');
                        setIsExportModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-semibold transition-all shadow-sm"
                      title="Export analysis history as PDF report"
                    >
                      <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Export PDF</span>
                    </button>
                  </div>
                </div>

                {/* Tender Cards Grid */}
                <div className="space-y-3">
                  {filteredTenders.length === 0 ? (
                    <div className="glass-panel p-8 rounded-2xl text-center text-slate-400 border border-slate-800">
                      <Search className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                      <p className="font-semibold text-sm">No tenders match your filter criteria.</p>
                      <button
                        onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
                        className="mt-3 text-xs text-emerald-400 hover:underline"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    filteredTenders.map((tender) => (
                      <div
                        key={tender.id}
                        className="glass-panel-elevated p-4 sm:p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all group"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          
                          {/* Left Details */}
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700">
                                {tender.tenderRef}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold">
                                {tender.portal}
                              </span>
                              <span className="text-xs text-slate-400 font-medium">
                                {tender.authority}
                              </span>
                            </div>

                            <h4 className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors">
                              {tender.title}
                            </h4>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                              <div>
                                <span className="text-slate-500">Value: </span>
                                <strong className="text-white font-semibold">{tender.estimatedValue}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">Deadline: </span>
                                <strong className="text-slate-300">{tender.submissionDeadline}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">EMD: </span>
                                <span className="text-emerald-400 font-medium">{tender.emdStatus}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Make in India: </span>
                                <span className="text-cyan-300 font-medium">{tender.makeInIndiaPreference}</span>
                              </div>
                            </div>

                            {/* Summary note */}
                            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
                              <span className="text-slate-400 shrink-0">Analysis:</span>
                              <span>{tender.matchSummary}</span>
                            </div>
                          </div>

                          {/* Right Eligibility Badge & Action Button */}
                          <div className="flex sm:flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                            
                            {/* Score & Badge */}
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="text-[10px] uppercase font-bold text-slate-400">
                                  Match Score
                                </div>
                                <div className="text-base font-black text-white">
                                  {tender.matchScore}%
                                </div>
                              </div>

                              {/* Badge */}
                              {tender.eligibilityStatus === 'Eligible' && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shadow-sm">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Eligible
                                </span>
                              )}
                              {tender.eligibilityStatus === 'Conditional' && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300 shadow-sm">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Conditional
                                </span>
                              )}
                              {tender.eligibilityStatus === 'Ineligible' && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 shadow-sm">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Not Eligible
                                </span>
                              )}
                            </div>

                            {/* View AI Breakdown button */}
                            <button
                              id={`inspect-tender-${tender.id}`}
                              onClick={() => handleOpenBreakdown(tender)}
                              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-colors flex items-center gap-1.5"
                            >
                              <span>View Breakdown</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 4. RECOMMENDED GOVERNMENT SCHEMES SECTION */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" />
                      Recommended Government Schemes & Relief
                    </h3>
                    <p className="text-xs text-slate-400">
                      Statutory procurement preferences, invoice discounting, and guarantees matching your Udyam profile
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 font-medium hidden sm:block">
                    4 Active Programs
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {MOCK_GOVERNMENT_SCHEMES.map((scheme) => (
                    <div
                      key={scheme.id}
                      className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-400">
                            {scheme.ministry}
                          </span>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            scheme.badgeColor === 'emerald'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : scheme.badgeColor === 'cyan'
                              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                              : scheme.badgeColor === 'amber'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                          }`}>
                            {scheme.eligibilityTag}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white leading-snug">
                          {scheme.name}
                        </h4>

                        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-emerald-300 font-medium">
                          {scheme.benefit}
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">
                          {scheme.description}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-400">
                          Relevance Match: <strong className="text-white">{scheme.relevanceScore}%</strong>
                        </span>
                        <a
                          href={scheme.actionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
                        >
                          Official Portal
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TENDER MARKETPLACE */}
          {activeTab === 'marketplace' && (
            <MSMEMarketplace
              profile={profile}
              onAnalyzeTender={(tender) => {
                handleTabChange('analyze');
              }}
              onNavigateTab={handleTabChange}
            />
          )}

          {/* TAB 3: ANALYZE TENDER SCREEN (TWO-PANEL EVALUATOR) */}
          {activeTab === 'analyze' && (
            <MSMEAnalyzeScreen 
              profile={profile} 
              onNavigateTab={handleTabChange} 
            />
          )}

          {/* TAB 4: MY DOCUMENTS VAULT */}
          {activeTab === 'documents' && (
            <MSMEDocuments
              profile={profile}
              onNavigateTab={handleTabChange}
            />
          )}

          {/* TAB 5: PAYMENT TRACKER & MSME SAMADHAAN */}
          {activeTab === 'payments' && (
            <MSMEPaymentTracker
              profile={profile}
              onNavigateTab={handleTabChange}
            />
          )}

        </main>
      </div>

      {/* DETAILED ELIGIBILITY BREAKDOWN MODAL */}
      <Modal
        isOpen={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
        title={selectedTender ? `Eligibility Criteria Breakdown • ${selectedTender.tenderRef}` : 'Criteria Breakdown'}
        subtitle={selectedTender ? `${selectedTender.authority} • ${selectedTender.title}` : undefined}
      >
        {selectedTender && (
          <div className="space-y-4 text-xs sm:text-sm">
            {/* Status & Overall Fit */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs block">Assessed Overall Fit</span>
                <span className="text-lg font-bold text-white">{selectedTender.matchScore}% Match Score</span>
              </div>
              <div>
                {selectedTender.eligibilityStatus === 'Eligible' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    Fully Eligible to Bid
                  </span>
                )}
                {selectedTender.eligibilityStatus === 'Conditional' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300">
                    <AlertTriangle className="w-4 h-4" />
                    Conditionally Eligible
                  </span>
                )}
                {selectedTender.eligibilityStatus === 'Ineligible' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/20 border border-rose-500/40 text-rose-300">
                    <XCircle className="w-4 h-4" />
                    Turnover / Criteria Deficit
                  </span>
                )}
              </div>
            </div>

            {/* Criteria Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] font-semibold uppercase">1. Turnover Clause & MSME Exemption</span>
                <p className="text-slate-200 font-medium">{selectedTender.turnoverRequirement}</p>
                <p className="text-[11px] text-emerald-400">
                  User Turnover: {profile.annualTurnover} (Exemption applies under MSME Order 2012)
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] font-semibold uppercase">2. EMD / Tender Fee Exemption</span>
                <p className="text-emerald-300 font-medium">{selectedTender.emdStatus}</p>
                <p className="text-[11px] text-slate-400">
                  Micro & Small enterprises exempted from ₹1.2L EMD upon Udyam certificate upload.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] font-semibold uppercase">3. Make in India (MII) Preference</span>
                <p className="text-cyan-300 font-medium">{selectedTender.makeInIndiaPreference}</p>
                <p className="text-[11px] text-slate-400">
                  Local value addition in manufacturing exceeds 50% threshold.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] font-semibold uppercase">4. Past Performance & Experience</span>
                <p className="text-slate-200 font-medium">{selectedTender.experienceRequirement}</p>
                <p className="text-[11px] text-slate-400">
                  Relaxation provision for Startups & ZED certified units verified.
                </p>
              </div>
            </div>

            {/* Key Disqualifier or Advantage Note */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <span className="text-slate-400 font-semibold block mb-1">Procurement Legal Advisory:</span>
              <p className="text-slate-200">{selectedTender.keyDisqualifierOrAdvantage}</p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedTender) {
                    handleExecutePDFExport([selectedTender], `Single Tender Audit (${selectedTender.tenderRef})`);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Download single tender compliance report as PDF"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export Tender PDF</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsBreakdownModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setIsBreakdownModalOpen(false);
                    alert(`Directing to ${selectedTender.portal} portal for bid submission with MSME exemption credentials.`);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <span>Proceed to Bid on {selectedTender.portal}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* EXPORT ANALYSIS HISTORY PDF MODAL */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => !isExporting && setIsExportModalOpen(false)}
        title="Export MSME Tender Eligibility Dossier (PDF)"
        subtitle="Official certified report for enterprise audit, record-keeping, and banking due diligence"
      >
        <div className="space-y-5 text-xs sm:text-sm">
          
          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="text-slate-300 font-bold block text-xs">
              Select Export Scope:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              
              {/* Option 1: All Tenders */}
              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  exportScope === 'all'
                    ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">All History</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {MOCK_TENDER_ANALYSES.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Complete archive of all analyzed GeM & CPPP tenders.
                </p>
              </button>

              {/* Option 2: Eligible Only */}
              <button
                type="button"
                onClick={() => setExportScope('eligible')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  exportScope === 'eligible'
                    ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-400">Eligible Only</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-500/30">
                    {MOCK_TENDER_ANALYSES.filter(t => t.eligibilityStatus === 'Eligible').length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Tenders where MSME meets 100% eligibility criteria.
                </p>
              </button>

              {/* Option 3: Filtered View */}
              <button
                type="button"
                onClick={() => setExportScope('filtered')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  exportScope === 'filtered'
                    ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-blue-400">Current View</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-500/30">
                    {filteredTenders.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Matches current search & status filter ({statusFilter}).
                </p>
              </button>
            </div>
          </div>

          {/* Customization Checkboxes */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
            <span className="text-slate-300 font-bold block text-xs">
              Report Sections & Statutory Inclusions:
            </span>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={includeLegalExemptions}
                onChange={(e) => setIncludeLegalExemptions(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                Include Statutory Legal Citations (PPP for MSEs 2012, GFR Rule 173(i), MSMED Act 2006)
              </span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={includeVaultStatus}
                onChange={(e) => setIncludeVaultStatus(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                Include Enterprise Verification Stamp & Document Vault Attestation
              </span>
            </label>
          </div>

          {/* Dossier Preview Summary Box */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-slate-300">Dossier Metadata Preview</span>
              <span className="text-[10px] font-mono text-emerald-400">FORMAT: A4 VECTOR PDF</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-500 block">Enterprise:</span>
                <strong className="text-slate-200 truncate block">{profile.companyName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Udyam Number:</span>
                <strong className="text-slate-200 font-mono">{profile.udyamNumber}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Records Included:</span>
                <strong className="text-emerald-400">
                  {exportScope === 'all'
                    ? MOCK_TENDER_ANALYSES.length
                    : exportScope === 'eligible'
                    ? MOCK_TENDER_ANALYSES.filter(t => t.eligibilityStatus === 'Eligible').length
                    : filteredTenders.length}{' '}
                  Tenders
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Digital Hash:</span>
                <span className="text-slate-400 font-mono text-[10px]">SHA256 Certified</span>
              </div>
            </div>
          </div>

          {/* Export Action Controls */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => setIsExportModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              id="generate-pdf-download-btn"
              disabled={isExporting}
              onClick={() => handleExecutePDFExport()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-950"
            >
              {isExporting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Compiling PDF Dossier...</span>
                </>
              ) : exportSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>PDF Downloaded Successfully!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Generate & Download PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
