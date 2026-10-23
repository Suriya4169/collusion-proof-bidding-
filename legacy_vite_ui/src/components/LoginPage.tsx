import React, { useState } from 'react';
import { Shield, Building2, UserCheck, Lock, FileText, Sparkles, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserRole } from '../types';
import { ThemeSelector } from './ThemeSelector';

interface LoginPageProps {
  onLogin: (role: UserRole, credentials: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [activeRole, setActiveRole] = useState<UserRole>('msme');

  // MSME Form State
  const [udyamNumber, setUdyamNumber] = useState('UDYAM-MH-01-0023456');
  const [gstin, setGstin] = useState('27AABCB1234F1Z5');
  const [msmePassword, setMsmePassword] = useState('••••••••••');

  // Govt Form State
  const [officerId, setOfficerId] = useState('GOI-VIG-9842');
  const [department, setDepartment] = useState('Central Vigilance & GeM Oversight Directorate');
  const [govtPassword, setGovtPassword] = useState('••••••••••');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAutofillMSME = () => {
    setUdyamNumber('UDYAM-MH-01-0023456');
    setGstin('27AABCB1234F1Z5');
    setMsmePassword('Bharat@2026');
    setErrorMsg('');
  };

  const handleAutofillGovt = () => {
    setOfficerId('GOI-VIG-9842');
    setDepartment('Central Vigilance & GeM Oversight Directorate');
    setGovtPassword('GovtVig@2026');
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      if (activeRole === 'msme') {
        if (!udyamNumber.trim() || !gstin.trim()) {
          setErrorMsg('Please enter valid Udyam Number and GSTIN.');
          return;
        }
        onLogin('msme', { udyamNumber, gstin });
      } else {
        if (!officerId.trim()) {
          setErrorMsg('Please enter valid Officer ID.');
          return;
        }
        onLogin('govt', { officerId, department });
      }
    }, 450);
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Subtle Background Glow Orbs */}
      <div className="absolute top-[-15%] left-[20%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[15%] w-[600px] h-[600px] rounded-full bg-emerald-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-[40%] right-[5%] w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <header className="w-full border-b border-slate-800/80 bg-[#0b0f19]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 via-blue-500/20 to-indigo-500/30 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  Intelligent Procurement Integrity Platform
                </h1>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 tracking-wider">
                  India Public Procurement
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                GeM • CPPP • MSME Sambandh & Samadhaan • Vigilance Oversight
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800/80 border border-slate-700 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              National Portal Live
            </span>
            <ThemeSelector />
          </div>
        </div>
      </header>

      {/* Main Hero & Login Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex items-center justify-center w-full z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full max-w-6xl">
          
          {/* Left Column: Mission & Feature Highlights */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Dual-Engine Procurement Intelligence
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Fair Tenders for <span className="text-emerald-400">MSMEs</span>. <br />
              Zero Corruption for <span className="text-blue-400">Officers</span>.
            </h2>

            <p className="text-slate-300 text-base leading-relaxed">
              Empowering Indian micro and small businesses to instantly verify government tender eligibility, claim mandatory 25% MSME purchase preferences, and assisting vigilance officers in catching last-minute corrupt corrigendum amendments.
            </p>

            {/* Feature Badges Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="glass-panel p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  MSME Eligibility Scanner
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Cross-references Udyam, turnover & EMD waivers against GeM / CPPP tender documents.
                </p>
              </div>

              <div className="glass-panel p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Tamper & Cartel Detector
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Surveils predatory last-minute amendment timings, BOQ tampering & bidder IP clustering.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2 text-xs text-slate-400 border-t border-slate-800/80">
              <div>
                <span className="block text-white font-bold text-base">₹1,240+ Cr</span>
                Monitored Tenders
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="block text-white font-bold text-base">25% Quota</span>
                MSME Policy Enforced
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="block text-white font-bold text-base">45-Day</span>
                Samadhaan Dispute Law
              </div>
            </div>
          </div>

          {/* Right Column: Portal Login Glass Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="glass-panel-elevated rounded-2xl p-6 sm:p-8 border border-slate-700/60 shadow-2xl relative">
              
              {/* Subtle top card glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent rounded-full" />

              <div className="mb-6">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Access Portal
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Select your role to enter your dedicated analytics dashboard
                </p>
              </div>

              {/* Role Switcher Toggle */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900/90 border border-slate-800 mb-6">
                <button
                  id="role-toggle-msme"
                  type="button"
                  onClick={() => {
                    setActiveRole('msme');
                    setErrorMsg('');
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    activeRole === 'msme'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  MSME / Startup
                </button>

                <button
                  id="role-toggle-govt"
                  type="button"
                  onClick={() => {
                    setActiveRole('govt');
                    setErrorMsg('');
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    activeRole === 'govt'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-950'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  Government Officer
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {activeRole === 'msme' ? (
                  <>
                    {/* MSME: Udyam Number */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Udyam Registration Number
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <FileText className="w-4 h-4" />
                        </div>
                        <input
                          id="msme-udyam-input"
                          type="text"
                          value={udyamNumber}
                          onChange={(e) => setUdyamNumber(e.target.value)}
                          placeholder="e.g. UDYAM-MH-01-0023456"
                          required
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 font-mono transition-all"
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Verified against Ministry of MSME Udyam Portal
                      </span>
                    </div>

                    {/* MSME: GSTIN */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        GSTIN (Goods and Services Tax ID)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <input
                          id="msme-gstin-input"
                          type="text"
                          value={gstin}
                          onChange={(e) => setGstin(e.target.value.toUpperCase())}
                          placeholder="e.g. 27AABCB1234F1Z5"
                          required
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 font-mono transition-all"
                        />
                      </div>
                    </div>

                    {/* MSME: Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="msme-password-input"
                          type="password"
                          value={msmePassword}
                          onChange={(e) => setMsmePassword(e.target.value)}
                          placeholder="••••••••••••"
                          required
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Govt: Officer ID */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Officer ID / NIC Email Code
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <input
                          id="govt-officer-id-input"
                          type="text"
                          value={officerId}
                          onChange={(e) => setOfficerId(e.target.value)}
                          placeholder="e.g. GOI-VIG-9842"
                          required
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono transition-all"
                        />
                      </div>
                    </div>

                    {/* Govt: Department Dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Procuring Ministry / Department
                      </label>
                      <div className="relative">
                        <select
                          id="govt-department-select"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                        >
                          <option value="Central Vigilance & GeM Oversight Directorate">
                            Central Vigilance & GeM Oversight Directorate
                          </option>
                          <option value="Ministry of Defence / Ordnance Factory Board">
                            Ministry of Defence / Ordnance Factory Board
                          </option>
                          <option value="Ministry of Railways / RDSO Procurement">
                            Ministry of Railways / RDSO Procurement
                          </option>
                          <option value="National Highways Authority of India (NHAI)">
                            National Highways Authority of India (NHAI)
                          </option>
                          <option value="Dept of Telecommunications / BharatNet">
                            Dept of Telecommunications / BharatNet
                          </option>
                          <option value="Ministry of Health & Family Welfare">
                            Ministry of Health & Family Welfare
                          </option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Govt: Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Security Token / Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="govt-password-input"
                          type="password"
                          value={govtPassword}
                          onChange={(e) => setGovtPassword(e.target.value)}
                          placeholder="••••••••••••"
                          required
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

                {errorMsg && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  id="login-submit-button"
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 mt-2 ${
                    activeRole === 'msme'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating Credentials...
                    </span>
                  ) : (
                    <>
                      <span>
                        Enter {activeRole === 'msme' ? 'MSME Portal' : 'Vigilance Dashboard'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Demo Autofill Quick Button */}
                <div className="pt-2">
                  <button
                    id="autofill-demo-btn"
                    type="button"
                    onClick={activeRole === 'msme' ? handleAutofillMSME : handleAutofillGovt}
                    className="w-full py-2 px-3 rounded-lg border border-slate-700/80 bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Autofill Demo Credentials ({activeRole === 'msme' ? 'Bharat Precision MSME' : 'Dr. Rajesh Varma, IAS'})
                  </button>
                </div>
              </form>

              {/* Security Footnote */}
              <div className="mt-5 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 text-center">
                Protected by 256-bit NIC e-Procurement Encryption & Audit Hash.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 bg-[#080c14] py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Intelligent Procurement Integrity Platform • Government of India Procurement Analytics</span>
          <span className="text-slate-400">Complying with Public Procurement Policy Order, 2012 & GFR Rule 153</span>
        </div>
      </footer>
    </div>
  );
};
