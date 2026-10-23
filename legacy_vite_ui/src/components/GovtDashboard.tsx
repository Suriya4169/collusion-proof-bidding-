import React, { useState } from 'react';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  FileDiff, 
  Users2, 
  BadgePercent, 
  ShieldCheck, 
  LogOut, 
  AlertOctagon, 
  AlertTriangle, 
  Activity, 
  Search, 
  Filter, 
  ChevronRight, 
  Lock, 
  Eye, 
  Ban, 
  Send, 
  CheckCircle2, 
  Sparkles, 
  Cpu, 
  Clock, 
  Flame,
  Globe2,
  FileSpreadsheet,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { GovtProfile, CriticalAlert, ActiveGovtTender, CartelSuspectGroup } from '../types';
import { MOCK_CRITICAL_ALERTS, MOCK_GOVT_STATS, MOCK_ACTIVE_TENDERS, MOCK_CARTEL_GROUPS } from '../data/mockData';
import { Modal } from './Modal';
import { GovtIntegrityScreen } from './GovtIntegrityScreen';
import { ThemeSelector } from './ThemeSelector';

interface GovtDashboardProps {
  profile: GovtProfile;
  onLogout: () => void;
  initialTab?: 'dashboard' | 'integrity' | 'cartel' | 'financial' | 'cyber';
}

export const GovtDashboard: React.FC<GovtDashboardProps> = ({ profile, onLogout, initialTab }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'integrity' | 'cartel' | 'financial' | 'cyber'>(() => {
    if (initialTab) return initialTab;
    if (typeof window !== 'undefined' && window.location.pathname.includes('/integrity')) return 'integrity';
    if (typeof window !== 'undefined' && window.location.pathname.includes('/cartel')) return 'cartel';
    if (typeof window !== 'undefined' && window.location.pathname.includes('/financial')) return 'financial';
    if (typeof window !== 'undefined' && window.location.pathname.includes('/cyber')) return 'cyber';
    return 'dashboard';
  });

  const handleTabChange = (tab: 'dashboard' | 'integrity' | 'cartel' | 'financial' | 'cyber') => {
    setActiveTab(tab);
    if (tab === 'integrity') {
      window.history.pushState({}, '', '/govt/integrity');
    } else {
      window.history.pushState({}, '', `/govt/${tab}`);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH'>('ALL');
  
  const [alerts, setAlerts] = useState<CriticalAlert[]>(MOCK_CRITICAL_ALERTS);
  const [selectedAlert, setSelectedAlert] = useState<CriticalAlert | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = 
      alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.tenderRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.department.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeverity = 
      severityFilter === 'ALL' ? true : alert.riskSeverity === severityFilter;

    return matchesSearch && matchesSeverity;
  });

  const handleOpenDiff = (alert: CriticalAlert) => {
    setSelectedAlert(alert);
    setIsDiffModalOpen(true);
    setActionSuccessMsg('');
  };

  const handleFreezeTender = (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'Frozen' } : a));
    if (selectedAlert && selectedAlert.id === alertId) {
      setSelectedAlert({ ...selectedAlert, status: 'Frozen' });
    }
    setActionSuccessMsg('Tender bidding portal immediately FROZEN. Alert logged to Central Vigilance Commission (CVC).');
  };

  const handleIssueNotice = (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'Notice Issued' } : a));
    if (selectedAlert && selectedAlert.id === alertId) {
      setSelectedAlert({ ...selectedAlert, status: 'Notice Issued' });
    }
    setActionSuccessMsg('Section 11 Vigilance Show-Cause Notice dispatched to Procuring Officer and Benefiting Entity.');
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans">
      
      {/* 1. TOP BAR */}
      <header className="sticky top-0 z-40 bg-[#0b0f19]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-950">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-white tracking-tight">
                {profile.officerName}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
                {profile.designation}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 font-mono mt-0.5">
              <span>ID: <strong className="text-slate-200">{profile.officerId}</strong></span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden md:inline text-slate-300">{profile.department}</span>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <ThemeSelector />

          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AI Corrigendum Watchdog: Active</span>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <button
            id="govt-logout-btn"
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
                Vigilance Modules
              </div>
              <nav className="space-y-1">
                <button
                  id="nav-govt-dashboard"
                  onClick={() => handleTabChange('dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>

                <button
                  id="nav-govt-integrity"
                  onClick={() => handleTabChange('integrity')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'integrity'
                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <FileDiff className="w-4 h-4" />
                  <span>Tender Integrity</span>
                  <span className="ml-auto text-[10px] bg-rose-950 text-rose-300 border border-rose-800/40 px-1.5 py-0.5 rounded-md font-bold">
                    {MOCK_GOVT_STATS.amendmentsFlagged} Flagged
                  </span>
                </button>

                <button
                  id="nav-govt-cartel"
                  onClick={() => handleTabChange('cartel')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'cartel'
                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Users2 className="w-4 h-4" />
                  <span>Cartel Detection</span>
                  <span className="ml-auto text-[10px] bg-amber-950 text-amber-300 border border-amber-800/40 px-1.5 py-0.5 rounded-md font-bold">
                    5 Rings
                  </span>
                </button>

                <button
                  id="nav-govt-financial"
                  onClick={() => handleTabChange('financial')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'financial'
                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <BadgePercent className="w-4 h-4" />
                  <span>Financial Verify</span>
                  <span className="ml-auto text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md">
                    GSTR-3B vs CA
                  </span>
                </button>

                <button
                  id="nav-govt-cyber"
                  onClick={() => handleTabChange('cyber')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'cyber'
                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Cyber Security</span>
                  <span className="ml-auto text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md">
                    IP & DSC Logs
                  </span>
                </button>
              </nav>
            </div>

            {/* Quick GFR 2017 Notice */}
            <div className="glass-panel p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                <AlertOctagon className="w-4 h-4" />
                Vigilance Mandate
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Rule 173(xvi) of GFR 2017: No restrictive corrigendum allowed within 72 hrs of tender deadline without timeline extension.
              </p>
            </div>
          </div>

          {/* Bottom Security level info */}
          <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-500 flex items-center justify-between">
            <span>CVC Audit Node #982</span>
            <Lock className="w-4 h-4 text-slate-400" />
          </div>
        </aside>

        {/* MAIN SCROLLABLE DASHBOARD VIEW */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8">
          
          {/* Top Mobile Navigation Pills */}
          <div className="flex md:hidden overflow-x-auto pb-2 gap-2 text-xs">
            <button
              onClick={() => handleTabChange('dashboard')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
                activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => handleTabChange('integrity')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
                activeTab === 'integrity' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Tender Integrity
            </button>
            <button
              onClick={() => handleTabChange('cartel')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
                activeTab === 'cartel' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Cartel Detection
            </button>
            <button
              onClick={() => handleTabChange('financial')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
                activeTab === 'financial' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Financial Verify
            </button>
            <button
              onClick={() => handleTabChange('cyber')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
                activeTab === 'cyber' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Cyber Security
            </button>
          </div>

          {/* TAB 1: MAIN DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              
              {/* Top Title */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-white">
                    Procurement Integrity & Anti-Corruption Cockpit
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Real-time surveillance on last-minute tender corrigenda, bidder rings, and fraudulent certifications.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    7 Live High-Risk Anomaly Alerts
                  </span>
                </div>
              </div>

              {/* 2. 4 STAT CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stat 1: Critical Alerts */}
                <div className="glass-panel p-5 rounded-2xl border border-rose-500/30 bg-rose-950/15 hover:border-rose-500/50 transition-all">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider text-rose-300">Critical Alerts</span>
                    <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                      <AlertOctagon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-rose-400 tracking-tight">
                      {MOCK_GOVT_STATS.criticalAlerts}
                    </span>
                    <span className="text-xs font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full">
                      Immediate Action
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    3 predatory last-minute amendment timings flagged
                  </p>
                </div>

                {/* Stat 2: Active Tenders */}
                <div className="glass-panel p-5 rounded-2xl border border-blue-500/20 bg-blue-950/10 hover:border-blue-500/40 transition-all">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">Active Tenders</span>
                    <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white tracking-tight">
                      {MOCK_GOVT_STATS.activeTenders}
                    </span>
                    <span className="text-xs font-medium text-slate-300 font-mono">
                      {MOCK_GOVT_STATS.totalProcurementValueMonitored}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Continuous monitoring across GeM, CPPP & Railways
                  </p>
                </div>

                {/* Stat 3: Bids Analyzed */}
                <div className="glass-panel p-5 rounded-2xl border border-indigo-500/20 bg-indigo-950/10 hover:border-indigo-500/40 transition-all">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Bids Analyzed</span>
                    <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400">
                      <Cpu className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white tracking-tight">
                      {MOCK_GOVT_STATS.bidsAnalyzed}
                    </span>
                    <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      98.2% Clean
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    23 BOQ formatting anomalies caught
                  </p>
                </div>

                {/* Stat 4: Cartel Suspects */}
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-amber-950/10 hover:border-amber-500/40 transition-all">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">Cartel Suspects</span>
                    <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400">
                      <Users2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-amber-300 tracking-tight">
                      {MOCK_GOVT_STATS.cartelSuspects} Rings
                    </span>
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                      14 Entities
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Matched via common IP addresses & Director PANs
                  </p>
                </div>
              </div>

              {/* 3. CRITICAL ALERTS LIST */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                      Live Vigilance & Corrupt Amendment Alerts
                    </h3>
                    <p className="text-xs text-slate-400">
                      High-confidence anomalies requiring immediate officer review or administrative freeze
                    </p>
                  </div>

                  {/* Filters & Search */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tender ref, ministry..."
                        className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs">
                      <button
                        onClick={() => setSeverityFilter('ALL')}
                        className={`px-2 py-1 rounded font-medium ${
                          severityFilter === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setSeverityFilter('CRITICAL')}
                        className={`px-2 py-1 rounded font-medium ${
                          severityFilter === 'CRITICAL' ? 'bg-rose-600/30 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-rose-300'
                        }`}
                      >
                        Critical (&gt;80%)
                      </button>
                      <button
                        onClick={() => setSeverityFilter('HIGH')}
                        className={`px-2 py-1 rounded font-medium ${
                          severityFilter === 'HIGH' ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-amber-300'
                        }`}
                      >
                        High
                      </button>
                    </div>
                  </div>
                </div>

                {/* Alerts Cards Feed */}
                <div className="space-y-3">
                  {filteredAlerts.length === 0 ? (
                    <div className="glass-panel p-8 rounded-2xl text-center text-slate-400 border border-slate-800">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                      <p className="font-semibold text-sm">No critical alerts matching your filter.</p>
                    </div>
                  ) : (
                    filteredAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`glass-panel-elevated p-4 sm:p-5 rounded-2xl border transition-all ${
                          alert.riskSeverity === 'CRITICAL'
                            ? 'border-rose-500/30 hover:border-rose-500/60 bg-gradient-to-r from-rose-950/15 to-transparent'
                            : 'border-amber-500/30 hover:border-amber-500/60 bg-gradient-to-r from-amber-950/10 to-transparent'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          
                          {/* Alert Info */}
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-700">
                                {alert.tenderRef}
                              </span>
                              <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300 font-medium">
                                {alert.department}
                              </span>
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {alert.detectedTime}
                              </span>
                            </div>

                            <h4 className="text-base font-bold text-white leading-snug">
                              {alert.title}
                            </h4>

                            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                              <strong className="text-rose-400">Anomaly Synopsis: </strong>
                              {alert.summary}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                              <div>
                                Type: <span className="text-slate-200 font-semibold">{alert.alertType}</span>
                              </div>
                              <div>
                                Benefiting Entity: <span className="text-rose-300 font-mono font-medium">{alert.tamperEvidence.benefitingVendor}</span>
                              </div>
                              <div>
                                Status: <span className={`font-bold ${
                                  alert.status === 'Frozen' ? 'text-rose-400' :
                                  alert.status === 'Notice Issued' ? 'text-amber-400' : 'text-cyan-400'
                                }`}>{alert.status}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Risk Badge & Action Buttons */}
                          <div className="flex sm:flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                            
                            {/* Risk Percentage Badge */}
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="text-[10px] uppercase font-bold text-slate-400">
                                  Tamper Risk
                                </div>
                                <div className={`text-xl font-black ${
                                  alert.riskPercentage >= 80 ? 'text-rose-400' : 'text-amber-400'
                                }`}>
                                  {alert.riskPercentage}%
                                </div>
                              </div>

                              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                alert.riskSeverity === 'CRITICAL'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}>
                                {alert.riskSeverity}
                              </span>
                            </div>

                            {/* Inspect Diff Button */}
                            <button
                              id={`inspect-alert-${alert.id}`}
                              onClick={() => handleOpenDiff(alert)}
                              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-950 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect Corrigendum Diff</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 4. ACTIVE TENDERS MONITORED TABLE */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <Activity className="w-5 h-5 text-blue-400" />
                      Active Procurements Under Surveillance
                    </h3>
                    <p className="text-xs text-slate-400">
                      Automated integrity health index based on bid dispersion, bidder counts, and corrigenda frequency
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('integrity')}
                    className="text-xs text-blue-400 hover:underline font-semibold"
                  >
                    View All 148 Tenders &rarr;
                  </button>
                </div>

                <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Tender Ref / Title</th>
                          <th className="p-3.5">Department</th>
                          <th className="p-3.5">Estimated Value</th>
                          <th className="p-3.5">Bids</th>
                          <th className="p-3.5">Corrigenda</th>
                          <th className="p-3.5">Integrity Score</th>
                          <th className="p-3.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 font-mono">
                        {MOCK_ACTIVE_TENDERS.map((tender) => (
                          <tr key={tender.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-3.5 font-sans">
                              <span className="font-mono font-bold text-white block">{tender.tenderRef}</span>
                              <span className="text-slate-400 text-xs truncate max-w-xs block font-sans">{tender.title}</span>
                            </td>
                            <td className="p-3.5 font-sans">{tender.department}</td>
                            <td className="p-3.5 text-white font-bold">{tender.estimatedValue}</td>
                            <td className="p-3.5">{tender.totalBids}</td>
                            <td className="p-3.5">
                              <span className={tender.corrigendaCount > 2 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                                {tender.corrigendaCount}
                              </span>
                            </td>
                            <td className="p-3.5 font-sans">
                              <span className={`px-2 py-0.5 rounded font-bold ${
                                tender.integrityScore > 80 ? 'bg-emerald-500/20 text-emerald-300' :
                                tender.integrityScore > 50 ? 'bg-amber-500/20 text-amber-300' :
                                'bg-rose-500/20 text-rose-300'
                              }`}>
                                {tender.integrityScore}%
                              </span>
                            </td>
                            <td className="p-3.5 font-sans">
                              <span className={`text-[11px] font-semibold ${
                                tender.status === 'Corrigendum Frozen' ? 'text-rose-400' :
                                tender.status === 'Flagged for Vigilance' ? 'text-amber-400' : 'text-emerald-400'
                              }`}>
                                {tender.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: TENDER INTEGRITY VIEW (INTEGRITY MONITOR) */}
          {activeTab === 'integrity' && (
            <GovtIntegrityScreen 
              profile={profile} 
              onNavigateTab={handleTabChange} 
            />
          )}

          {/* TAB 3: CARTEL DETECTION VIEW */}
          {activeTab === 'cartel' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Users2 className="w-6 h-6 text-amber-400" />
                    Bid-Rigging & Cartel Ring Detection
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    AI graph analysis tracking shared digital signature tokens, identical IP addresses, and cover bidding patterns.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800"
                >
                  Back to Dashboard
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {MOCK_CARTEL_GROUPS.map((cartel) => (
                  <div key={cartel.id} className="glass-panel p-5 rounded-2xl border border-amber-500/30 bg-amber-950/10 space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400">
                          {cartel.confidenceScore}% Collusion Confidence
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                          {cartel.bidsCovered} Bids Rigged
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white leading-snug">
                        {cartel.ringName}
                      </h4>

                      <p className="text-xs text-slate-300">
                        Type: <strong className="text-amber-300">{cartel.collusionType}</strong>
                      </p>

                      <div className="space-y-1.5 pt-2 border-t border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-400 block">Matched Forensic Fingerprints:</span>
                        {cartel.sharedAttributes.map((attr, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span>{attr}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={() => alert(`Opening Full Collusion Graph for ${cartel.ringName}`)}
                      className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1 border border-slate-700"
                    >
                      <span>Explore Vendor Node Graph</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: FINANCIAL VERIFICATION VIEW */}
          {activeTab === 'financial' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <BadgePercent className="w-6 h-6 text-emerald-400" />
                    Turnover & GSTR-3B Financial Verification Engine
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Cross-checking uploaded Chartered Accountant balance sheets with GST Network (GSTN) returns & UDIN codes.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800"
                >
                  Back to Dashboard
                </button>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-white">Recent CA UDIN Discrepancy Case: Medilife Diagnostic Systems</h4>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                    98.4% Discrepancy
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 block">Declared in Tender Bid:</span>
                    <strong className="text-white font-mono text-sm">₹50.00 Crore Turnover</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30">
                    <span className="text-rose-400 block">Actual GSTR-3B Taxable Turnover:</span>
                    <strong className="text-rose-200 font-mono text-sm">₹18.50 Lakhs Turnover</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 block">ICAI UDIN Checksum:</span>
                    <strong className="text-rose-400 font-mono text-sm">INVALID / UNREGISTERED</strong>
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  Bidder fabricated audited profit & loss statement using expired CA seal to pass the ₹40 Cr pre-qualification turnover threshold for ICU Ventilators tender.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    onClick={() => alert("Report dispatched to ICAI Disciplinary Committee & GeM Blacklisting Cell.")}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    Initiate 3-Year Blacklisting on GeM
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CYBER SECURITY VIEW */}
          {activeTab === 'cyber' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-cyan-400" />
                    Portal Security & Tamper Audit Logs
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Immutable timestamp audit of tender database modifications, user role elevation, and corrigenda publications.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800"
                >
                  Back to Dashboard
                </button>
              </div>

              <div className="glass-panel rounded-2xl border border-slate-800 p-4 space-y-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-slate-300">
                  <span>[2026-08-31 22:45:12 IST] ⚠️ CORRIGENDUM #4 Published for GEM/2026/B/901844 outside office hours (IP: 103.24.12.89)</span>
                  <span className="text-rose-400 font-bold">TAMPER ALERT</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-slate-300">
                  <span>[2026-08-31 20:12:04 IST] ℹ️ Bid Submission received for CPPP/RLY/2026/MECH-412 with Class-3 DSC Token</span>
                  <span className="text-emerald-400">PASSED</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-slate-300">
                  <span>[2026-08-31 18:30:55 IST] ⚠️ 4 Competing bids uploaded from identical subnet (202.54.1.0/24)</span>
                  <span className="text-amber-400 font-bold">CARTEL SUSPECT</span>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* DETAILED CORRIGENDUM INSPECTION & VIGILANCE ACTIONS MODAL */}
      <Modal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        title={selectedAlert ? `Corrupt Amendment Diff • ${selectedAlert.tenderRef}` : 'Corrigendum Diff'}
        subtitle={selectedAlert ? `${selectedAlert.department} • Risk: ${selectedAlert.riskPercentage}% (${selectedAlert.alertType})` : undefined}
        maxWidth="max-w-4xl"
      >
        {selectedAlert && (
          <div className="space-y-4 text-xs sm:text-sm">
            
            {/* Timing & Impact Banner */}
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider block">
                  Critical Timing Anomaly
                </span>
                <p className="text-white font-bold mt-0.5">
                  Amendment published only {selectedAlert.tamperEvidence.hoursBeforeDeadline} hours before bid closing deadline.
                </p>
                <p className="text-xs text-rose-300/80 mt-1">
                  GFR Rule 173(xvi) requires a minimum 14-day extension for substantial qualification amendments.
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-2xl font-black text-rose-400 block">{selectedAlert.riskPercentage}%</span>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Integrity Breach Score</span>
              </div>
            </div>

            {/* Side-by-Side Clause Diff */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                  <span>Original RFP Condition</span>
                  <span className="text-emerald-400">Baseline Spec</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 font-mono text-xs leading-relaxed">
                  {selectedAlert.tamperEvidence.originalClause}
                </div>
              </div>

              {/* Amended Corrigendum */}
              <div className="p-4 rounded-xl bg-slate-900 border border-rose-500/40 space-y-2">
                <div className="flex items-center justify-between text-rose-300 text-xs font-semibold uppercase">
                  <span>Corrupt Amendment Revision</span>
                  <span className="text-rose-400 font-bold">Tampered Spec</span>
                </div>
                <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-100 font-mono text-xs leading-relaxed">
                  {selectedAlert.tamperEvidence.amendedClause}
                </div>
              </div>
            </div>

            {/* Benefiting Entity Breakdown */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
              <span className="text-slate-400 font-semibold block">AI Beneficiary & Collusion Analysis:</span>
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <span className="text-slate-500">Sole Benefiting Vendor: </span>
                  <strong className="text-white font-mono">{selectedAlert.tamperEvidence.benefitingVendor}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Assessment: </span>
                  <strong className="text-amber-300">{selectedAlert.tamperEvidence.impactScore}</strong>
                </div>
              </div>
            </div>

            {/* Action Feedback Message */}
            {actionSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{actionSuccessMsg}</span>
              </div>
            )}

            {/* Vigilance Action Buttons */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                Current Status: <strong className="text-white">{selectedAlert.status}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="issue-notice-btn"
                  onClick={() => handleIssueNotice(selectedAlert.id)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Issue Show-Cause Notice</span>
                </button>

                <button
                  id="freeze-tender-btn"
                  onClick={() => handleFreezeTender(selectedAlert.id)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-950"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Freeze Tender Corrigendum</span>
                </button>
              </div>
            </div>

          </div>
        )}
      </Modal>

    </div>
  );
};
