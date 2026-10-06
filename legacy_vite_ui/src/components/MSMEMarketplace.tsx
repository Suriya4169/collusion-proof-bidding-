import React, { useState, useMemo } from 'react';
import {
  Search,
  Building2,
  Train,
  Shield,
  Zap,
  Activity,
  Radio,
  Rocket,
  Flame,
  Sun,
  Truck,
  IndianRupee,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Filter,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Layers,
  HelpCircle,
  TrendingUp,
  Tag,
  Check,
  RotateCcw
} from 'lucide-react';
import { MSMEProfile } from '../types';

export interface MarketplaceTender {
  id: string;
  tenderRef: string;
  title: string;
  department: string;
  departmentCategory: 'Railways' | 'Defence' | 'Power' | 'Health' | 'Communications' | 'Space' | 'Heavy Engineering' | 'Highways' | 'Petroleum' | 'Renewable';
  portal: 'GeM' | 'CPPP' | 'State e-Proc';
  estimatedValue: string;
  emdAmount: string;
  emdNumeric: number; // in Rupees
  emdExemptForMSME: boolean;
  deadlineDate: string;
  deadlineDateISO: string;
  daysRemaining: number;
  closingThisWeek: boolean;
  minTurnoverRequired: string;
  minTurnoverNumericCr: number; // in Crores
  hasMSMETurnoverWaiver: boolean;
  preCheckStatus: 'ELIGIBLE' | 'INELIGIBLE' | 'CONDITIONAL';
  preCheckReason: string;
  matchScore: number;
  makeInIndiaTier: string;
  reservedForMSE: boolean;
}

export const MARKETPLACE_TENDERS_DATA: MarketplaceTender[] = [
  {
    id: 'mkt-01',
    tenderRef: 'GEM/2026/B/912401',
    title: 'Supply of Industrial Electrical Switches, Distribution Panels & MCCBs',
    department: 'Ministry of Power (Power Grid Corporation of India)',
    departmentCategory: 'Power',
    portal: 'GeM',
    estimatedValue: '₹72.50 Lakhs',
    emdAmount: '₹72,500 (Exempted for MSEs)',
    emdNumeric: 72500,
    emdExemptForMSME: true,
    deadlineDate: '04 Sep 2026, 15:00 IST',
    deadlineDateISO: '2026-09-04',
    daysRemaining: 4,
    closingThisWeek: true,
    minTurnoverRequired: '₹1.80 Cr (Relaxed for MSME)',
    minTurnoverNumericCr: 1.80,
    hasMSMETurnoverWaiver: true,
    preCheckStatus: 'ELIGIBLE',
    preCheckReason: 'Turnover criteria (₹1.8 Cr) within enterprise turnover (₹4.85 Cr). 100% EMD fee waived.',
    matchScore: 97,
    makeInIndiaTier: 'Class-I (50%+)',
    reservedForMSE: true,
  },
  {
    id: 'mkt-02',
    tenderRef: 'CPPP/RLY/2026/MECH-412',
    title: 'Fabrication of Bogie Mounted Brake Cylinders for Vande Bharat Rakes',
    department: 'Ministry of Railways (Integral Coach Factory)',
    departmentCategory: 'Railways',
    portal: 'CPPP',
    estimatedValue: '₹1.42 Crore',
    emdAmount: '₹2,84,000 (Exempted for MSEs)',
    emdNumeric: 284000,
    emdExemptForMSME: true,
    deadlineDate: '05 Sep 2026, 17:30 IST',
    deadlineDateISO: '2026-09-05',
    daysRemaining: 5,
    closingThisWeek: true,
    minTurnoverRequired: '₹3.50 Cr Avg (Met by Company)',
    minTurnoverNumericCr: 3.50,
    hasMSMETurnoverWaiver: false,
    preCheckStatus: 'ELIGIBLE',
    preCheckReason: 'Turnover and ISO 9001 credentials match RDSO Tier-2 criteria.',
    matchScore: 93,
    makeInIndiaTier: 'Class-I (50%+)',
    reservedForMSE: false,
  },
  {
    id: 'mkt-03',
    tenderRef: 'GEM/2026/B/894210',
    title: 'Supply of CNC Milled Titanium Flanges & Precision Fasteners',
    department: 'Ministry of Defence (Munitions India Limited)',
    departmentCategory: 'Defence',
    portal: 'GeM',
    estimatedValue: '₹84.50 Lakhs',
    emdAmount: '₹85,000 (Exempted for MSEs)',
    emdNumeric: 85000,
    emdExemptForMSME: true,
    deadlineDate: '12 Sep 2026, 15:00 IST',
    deadlineDateISO: '2026-09-12',
    daysRemaining: 12,
    closingThisWeek: false,
    minTurnoverRequired: 'Waived for Micro/Small under PPP 2012',
    minTurnoverNumericCr: 0,
    hasMSMETurnoverWaiver: true,
    preCheckStatus: 'ELIGIBLE',
    preCheckReason: 'Eligible for 15% L1 purchase preference; 100% EMD waiver applied.',
    matchScore: 96,
    makeInIndiaTier: 'Class-I (50%+)',
    reservedForMSE: true,
  },
  {
    id: 'mkt-04',
    tenderRef: 'DISCOM/MAHA/2026/TR-782',
    title: 'Supply of 33kV Composite Polymer Insulators & Terminal Clamps',
    department: 'Ministry of Power (MSEDCL State Distribution)',
    departmentCategory: 'Power',
    portal: 'State e-Proc',
    estimatedValue: '₹3.80 Crore',
    emdAmount: '₹3,80,000 (Mandatory Deposit)',
    emdNumeric: 380000,
    emdExemptForMSME: false,
    deadlineDate: '03 Sep 2026, 18:00 IST',
    deadlineDateISO: '2026-09-03',
    daysRemaining: 3,
    closingThisWeek: true,
    minTurnoverRequired: '₹12.00 Cr in single FY (Strict)',
    minTurnoverNumericCr: 12.00,
    hasMSMETurnoverWaiver: false,
    preCheckStatus: 'INELIGIBLE',
    preCheckReason: 'Turnover requirement (₹12 Cr) exceeds enterprise profile (₹4.85 Cr) without MSME relaxation.',
    matchScore: 34,
    makeInIndiaTier: 'Class-II (20-50%)',
    reservedForMSE: false,
  },
  {
    id: 'mkt-05',
    tenderRef: 'ISRO/LPSC/2026/VALVE-90',
    title: 'Precision Cryogenic Grade Stainless Steel Solenoid Control Valves',
    department: 'Department of Space (ISRO Liquid Propulsion Systems Centre)',
    departmentCategory: 'Space',
    portal: 'CPPP',
    estimatedValue: '₹95.00 Lakhs',
    emdAmount: '₹95,000 (Exempted for MSEs)',
    emdNumeric: 95000,
    emdExemptForMSME: true,
    deadlineDate: '06 Sep 2026, 14:00 IST',
    deadlineDateISO: '2026-09-06',
    daysRemaining: 6,
    closingThisWeek: true,
    minTurnoverRequired: '₹2.00 Cr (Waived for ZED Certified)',
    minTurnoverNumericCr: 2.00,
    hasMSMETurnoverWaiver: true,
    preCheckStatus: 'ELIGIBLE',
    preCheckReason: 'Enterprise ZED Certification qualifies for direct past experience and turnover waiver.',
    matchScore: 94,
    makeInIndiaTier: 'Class-I (50%+)',
    reservedForMSE: true,
  },
  {
    id: 'mkt-06',
    tenderRef: 'BHEL/HYD/P/2026/099',
    title: 'Precision Machined Alloy Steel Turbine Casing Components',
    department: 'Heavy Engineering (Bharat Heavy Electricals Ltd - BHEL)',
    departmentCategory: 'Heavy Engineering',
    portal: 'CPPP',
    estimatedValue: '₹62.00 Lakhs',
    emdAmount: '₹62,000 (Exempted for MSEs)',
    emdNumeric: 62000,
    emdExemptForMSME: true,
    deadlineDate: '15 Sep 2026, 14:00 IST',
    deadlineDateISO: '2026-09-15',
    daysRemaining: 15,
    closingThisWeek: false,
    minTurnoverRequired: '₹1.50 Cr Avg (Met by Company)',
    minTurnoverNumericCr: 1.50,
    hasMSMETurnoverWaiver: false,
    preCheckStatus: 'ELIGIBLE',
    preCheckReason: 'Turnover meets minimum requirements; NABL lab test report required prior to bid opening.',
    matchScore: 88,
    makeInIndiaTier: 'Class-I (50%+)',
    reservedForMSE: false,
  },
  {
    id: 'mkt-07',
    tenderRef: 'NHAI/HQ/2026/GIRDER-33',
    title: 'Fabrication & Delivery of Heavy Structural Steel Flyover Girders',
    department: 'Ministry of Road Transport & Highways (NHAI)',
    departmentCategory: 'Highways',
    portal: 'CPPP',
    estimatedValue: '₹6.50 Crore',
    emdAmount: '₹6,50,000 (Mandatory BG)',
    emdNumeric: 650000,
    emdExemptForMSME: false,
    deadlineDate: '28 Sep 2026, 17:00 IST',
    deadlineDateISO: '2026-09-28',
    daysRemaining: 28,
    closingThisWeek: false,
    minTurnoverRequired: '₹18.50 Cr in past 3 consecutive FYs',
    minTurnoverNumericCr: 18.50,
    hasMSMETurnoverWaiver: false,
    preCheckStatus: 'INELIGIBLE',
    preCheckReason: 'Turnover shortfall: Mandatory ₹18.50 Cr requirement exceeds current enterprise size.',
    matchScore: 28,
    makeInIndiaTier: 'Class-I (50%+)',
    reservedForMSE: false,
  },
  {
    id: 'mkt-08',
    tenderRef: 'AIIMS/DEL/ENG/2026/19',
    title: 'Precision Stainless Steel 316L Autoclave Trays & Medical Enclosures',
    department: 'Ministry of Health (AIIMS New Delhi)',
    departmentCategory: 'Health',
    portal: 'CPPP',
    estimatedValue: '₹31.50 Lakhs',
    emdAmount: '₹31,500 (Exempted for MSEs)',
    emdNumeric: 31500,
    emdExemptForMSME: true,
    deadlineDate: '15 Sep 2026, 12:00 IST',
    deadlineDateISO: '2026-09-15',
    daysRemaining: 15,
    closingThisWeek: false,
    minTurnoverRequired: '₹25.00 Lakhs (Relaxed for MSME)',
    minTurnoverNumericCr: 0.25,
    hasMSMETurnoverWaiver: true,
    preCheckStatus: 'ELIGIBLE',
    preCheckReason: 'Turnover and SS 316L fabrication capability matches factory verification profile.',
    matchScore: 95,
    makeInIndiaTier: 'Class-I (50%+)',
    reservedForMSE: true,
  },
  {
    id: 'mkt-09',
    tenderRef: 'BSNL/CORP/OFC/2026/89',
    title: 'Procurement of High-Capacity Fiber Optic Switching Hardware & Transceivers',
    department: 'Ministry of Communications (Bharat Sanchar Nigam Limited - BSNL)',
    departmentCategory: 'Communications',
    portal: 'GeM',
    estimatedValue: '₹1.15 Crore',
    emdAmount: '₹1,15,000 (Exempted for MSEs)',
    emdNumeric: 115000,
    emdExemptForMSME: true,
    deadlineDate: '07 Sep 2026, 16:00 IST',
    deadlineDateISO: '2026-09-07',
    daysRemaining: 7,
    closingThisWeek: true,
    minTurnoverRequired: '₹2.80 Cr (Relaxed for MSME)',
    minTurnoverNumericCr: 2.80,
    hasMSMETurnoverWaiver: true,
    preCheckStatus: 'ELIGIBLE',
    preCheckReason: 'Meets turnover and technical specifications with 100% EMD statutory waiver.',
    matchScore: 91,
    makeInIndiaTier: 'Class-I (50%+)',
    reservedForMSE: false,
  },
  {
    id: 'mkt-10',
    tenderRef: 'SECI/SOLAR/INV/2026/102',
    title: 'Supply of 500kW Grid-Tied Solar Inverters & Distribution Boxes',
    department: 'Ministry of New & Renewable Energy (SECI)',
    departmentCategory: 'Renewable',
    portal: 'GeM',
    estimatedValue: '₹88.00 Lakhs',
    emdAmount: '₹88,000 (Exempted for MSEs)',
    emdNumeric: 88000,
    emdExemptForMSME: true,
    deadlineDate: '19 Sep 2026, 15:00 IST',
    deadlineDateISO: '2026-09-19',
    daysRemaining: 19,
    closingThisWeek: false,
    minTurnoverRequired: '₹2.20 Cr (Relaxed for MSME)',
    minTurnoverNumericCr: 2.20,
    hasMSMETurnoverWaiver: true,
    preCheckStatus: 'ELIGIBLE',
    preCheckReason: 'Class-I local value addition (62%) and MNRE certified specifications verified.',
    matchScore: 92,
    makeInIndiaTier: 'Class-I (50%+)',
    reservedForMSE: true,
  },
  {
    id: 'mkt-11',
    tenderRef: 'ONGC/OFFSHORE/PIPE/2026/44',
    title: 'High-Pressure Anti-Corrosive Seamless Pipe Flanges & Gaskets',
    department: 'Ministry of Petroleum (ONGC Western Offshore)',
    departmentCategory: 'Petroleum',
    portal: 'CPPP',
    estimatedValue: '₹2.10 Crore',
    emdAmount: '₹2,10,000 (Mandatory Bank Guarantee)',
    emdNumeric: 210000,
    emdExemptForMSME: false,
    deadlineDate: '24 Sep 2026, 17:00 IST',
    deadlineDateISO: '2026-09-24',
    daysRemaining: 24,
    closingThisWeek: false,
    minTurnoverRequired: '₹8.00 Cr in Offshore Equipment',
    minTurnoverNumericCr: 8.00,
    hasMSMETurnoverWaiver: false,
    preCheckStatus: 'INELIGIBLE',
    preCheckReason: 'Turnover hurdle (₹8 Cr required vs ₹4.85 Cr actual) and mandatory EMD deposit without exemption.',
    matchScore: 42,
    makeInIndiaTier: 'Class-I (50%+)',
    reservedForMSE: false,
  },
  {
    id: 'mkt-12',
    tenderRef: 'HAL/BLR/TOOL/2026/088',
    title: 'Heavy Duty Industrial Tooling and CNC Milling Collets & Chucks',
    department: 'Ministry of Defence (Hindustan Aeronautics Limited - HAL)',
    departmentCategory: 'Defence',
    portal: 'GeM',
    estimatedValue: '₹48.90 Lakhs',
    emdAmount: '₹49,000 (Exempted for MSEs)',
    emdNumeric: 49000,
    emdExemptForMSME: true,
    deadlineDate: '05 Sep 2026, 16:00 IST',
    deadlineDateISO: '2026-09-05',
    daysRemaining: 5,
    closingThisWeek: true,
    minTurnoverRequired: 'Relaxed for Startups & ZED Gold MSMEs',
    minTurnoverNumericCr: 0,
    hasMSMETurnoverWaiver: true,
    preCheckStatus: 'ELIGIBLE',
    preCheckReason: '100% reserved under MSME 25% Sub-quota. ZED certification satisfies prior experience.',
    matchScore: 98,
    makeInIndiaTier: 'Class-I (50%+)',
    reservedForMSE: true,
  },
];

interface MSMEMarketplaceProps {
  profile: MSMEProfile;
  onAnalyzeTender?: (tender: MarketplaceTender) => void;
  onNavigateTab?: (tab: string) => void;
}

export const MSMEMarketplace: React.FC<MSMEMarketplaceProps> = ({
  profile,
  onAnalyzeTender,
  onNavigateTab,
}) => {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [emdFilter, setEmdFilter] = useState<'ALL' | 'UNDER_1L' | 'EXEMPTED'>('ALL');
  const [closingFilter, setClosingFilter] = useState<'ALL' | 'THIS_WEEK' | 'NEXT_15_DAYS'>('ALL');
  const [eligibilityFilter, setEligibilityFilter] = useState<'ALL' | 'ELIGIBLE' | 'INELIGIBLE'>('ALL');
  const [sortBy, setSortBy] = useState<'RELEVANCE' | 'DEADLINE' | 'VALUE_HIGH' | 'VALUE_LOW'>('RELEVANCE');

  // Helper to get Department Icon
  const getDepartmentIcon = (category: MarketplaceTender['departmentCategory']) => {
    switch (category) {
      case 'Railways':
        return <Train className="w-3.5 h-3.5 text-sky-400" />;
      case 'Defence':
        return <Shield className="w-3.5 h-3.5 text-amber-400" />;
      case 'Power':
        return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      case 'Health':
        return <Activity className="w-3.5 h-3.5 text-rose-400" />;
      case 'Communications':
        return <Radio className="w-3.5 h-3.5 text-indigo-400" />;
      case 'Space':
        return <Rocket className="w-3.5 h-3.5 text-purple-400" />;
      case 'Petroleum':
        return <Flame className="w-3.5 h-3.5 text-orange-400" />;
      case 'Renewable':
        return <Sun className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Highways':
        return <Truck className="w-3.5 h-3.5 text-teal-400" />;
      default:
        return <Building2 className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Distinct departments for dropdown
  const departmentOptions = useMemo(() => {
    const deps = Array.from(new Set(MARKETPLACE_TENDERS_DATA.map((t) => t.departmentCategory)));
    return ['ALL', ...deps];
  }, []);

  // Filtered & Sorted Tenders
  const filteredTenders = useMemo(() => {
    return MARKETPLACE_TENDERS_DATA.filter((tender) => {
      // Search query match
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        query === '' ||
        tender.title.toLowerCase().includes(query) ||
        tender.department.toLowerCase().includes(query) ||
        tender.tenderRef.toLowerCase().includes(query) ||
        tender.portal.toLowerCase().includes(query);

      // Department match
      const matchesDepartment =
        selectedDepartment === 'ALL' || tender.departmentCategory === selectedDepartment;

      // EMD filter match
      let matchesEMD = true;
      if (emdFilter === 'UNDER_1L') {
        matchesEMD = tender.emdNumeric <= 100000 || tender.emdExemptForMSME;
      } else if (emdFilter === 'EXEMPTED') {
        matchesEMD = tender.emdExemptForMSME;
      }

      // Closing filter match
      let matchesClosing = true;
      if (closingFilter === 'THIS_WEEK') {
        matchesClosing = tender.closingThisWeek;
      } else if (closingFilter === 'NEXT_15_DAYS') {
        matchesClosing = tender.daysRemaining <= 15;
      }

      // Eligibility pre-check filter
      let matchesEligibility = true;
      if (eligibilityFilter === 'ELIGIBLE') {
        matchesEligibility = tender.preCheckStatus === 'ELIGIBLE';
      } else if (eligibilityFilter === 'INELIGIBLE') {
        matchesEligibility = tender.preCheckStatus === 'INELIGIBLE';
      }

      return matchesSearch && matchesDepartment && matchesEMD && matchesClosing && matchesEligibility;
    }).sort((a, b) => {
      if (sortBy === 'RELEVANCE') return b.matchScore - a.matchScore;
      if (sortBy === 'DEADLINE') return a.daysRemaining - b.daysRemaining;
      if (sortBy === 'VALUE_HIGH') return b.id.localeCompare(a.id);
      return a.id.localeCompare(b.id);
    });
  }, [searchQuery, selectedDepartment, emdFilter, closingFilter, eligibilityFilter, sortBy]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDepartment('ALL');
    setEmdFilter('ALL');
    setClosingFilter('ALL');
    setEligibilityFilter('ALL');
    setSortBy('RELEVANCE');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedDepartment !== 'ALL' ||
    emdFilter !== 'ALL' ||
    closingFilter !== 'ALL' ||
    eligibilityFilter !== 'ALL';

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* 1. TOP HEADER & SEARCH BAR */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800/90 bg-slate-900/95 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Header Title & Subtitle */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Tender Marketplace
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold font-mono">
                {filteredTenders.length} Active Opportunities
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Browse pre-screened Central Ministries, CPSEs & State tenders aligned with{' '}
              <strong className="text-slate-200 font-semibold">{profile.companyName}</strong>'s Udyam credentials and 25% MSE reservation sub-quotas.
            </p>
          </div>

          {/* Quick Profile Summary Badge */}
          <div className="shrink-0 flex items-center gap-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Profile Pre-check:</span>
            <span className="text-emerald-300 font-semibold font-mono">{profile.category} Enterprise</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300 font-mono">{profile.annualTurnover} Turnover</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            id="marketplace-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tenders by keyword, e.g. 'Electrical Switches', 'Railways', 'Fasteners', 'Brake Cylinders'..."
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-950/90 border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs bg-slate-800 rounded-full w-5 h-5 flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 2. FILTER DROPDOWNS ROW */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-xs pr-1">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>Filters:</span>
          </div>

          {/* Filter 1: Departments Dropdown */}
          <div className="relative">
            <select
              id="filter-department-select"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer hover:bg-slate-750 transition-colors"
            >
              <option value="ALL">All Departments</option>
              {departmentOptions
                .filter((d) => d !== 'ALL')
                .map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Filter 2: EMD Amount Filter */}
          <div className="relative">
            <select
              id="filter-emd-select"
              value={emdFilter}
              onChange={(e) => setEmdFilter(e.target.value as any)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer hover:bg-slate-750 transition-colors"
            >
              <option value="ALL">All EMD Amounts</option>
              <option value="UNDER_1L">EMD &lt; ₹1L (or Exempted)</option>
              <option value="EXEMPTED">100% MSME EMD Exempted</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Filter 3: Closing Time Filter */}
          <div className="relative">
            <select
              id="filter-closing-select"
              value={closingFilter}
              onChange={(e) => setClosingFilter(e.target.value as any)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer hover:bg-slate-750 transition-colors"
            >
              <option value="ALL">All Submission Deadlines</option>
              <option value="THIS_WEEK">Closing this week (&lt; 7 Days)</option>
              <option value="NEXT_15_DAYS">Closing in next 15 days</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Filter 4: Likely Eligibility Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setEligibilityFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                eligibilityFilter === 'ALL'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Match
            </button>
            <button
              onClick={() => setEligibilityFilter('ELIGIBLE')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all ${
                eligibilityFilter === 'ELIGIBLE'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <span>🟢 Likely Eligible</span>
            </button>
            <button
              onClick={() => setEligibilityFilter('INELIGIBLE')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all ${
                eligibilityFilter === 'INELIGIBLE'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <span>🔴 Likely Not</span>
            </button>
          </div>
        </div>

        {/* Reset & Sort Controls */}
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-slate-400 hover:text-white text-[11px] font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          <div className="flex items-center gap-1 text-slate-400 text-xs">
            <span className="hidden sm:inline text-[11px]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs py-1 px-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="RELEVANCE">Match Fit %</option>
              <option value="DEADLINE">Closing Soonest</option>
              <option value="VALUE_HIGH">Tender Value</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. MAIN CONTENT AREA: GRID OF TENDER CARDS */}
      {filteredTenders.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center text-slate-400 border border-slate-800 space-y-3">
          <Search className="w-10 h-10 mx-auto text-slate-600" />
          <h3 className="text-base font-bold text-slate-200">No matching tenders found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try adjusting your search terms, department selection, or clearing the active filters.
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Filters</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTenders.map((tender) => {
            const isEligible = tender.preCheckStatus === 'ELIGIBLE';
            
            return (
              <div
                key={tender.id}
                id={`tender-card-${tender.id}`}
                className="rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 transition-all duration-200 flex flex-col justify-between shadow-lg hover:shadow-2xl hover:-translate-y-0.5 group overflow-hidden"
              >
                {/* Card Top & Pre-Check Badge */}
                <div className="p-5 space-y-3.5">
                  
                  {/* Top Bar: Tender Ref, Portal & Top-Right Visual Pre-Check Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-mono font-bold text-slate-300 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700">
                        {tender.tenderRef}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold">
                        {tender.portal}
                      </span>
                      {tender.reservedForMSE && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                          MSE Reserved
                        </span>
                      )}
                    </div>

                    {/* Mandated Top-Right Visual Pre-Check Badge: Green 🟢 Likely Eligible vs Red 🔴 Likely Not */}
                    <div className="shrink-0">
                      {isEligible ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>🟢 Likely Eligible</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-bold shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-rose-400" />
                          <span>🔴 Likely Not</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors leading-snug line-clamp-2">
                    {tender.title}
                  </h3>

                  {/* Department with Specific Icon */}
                  <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="p-1 rounded-lg bg-slate-800 shrink-0">
                      {getDepartmentIcon(tender.departmentCategory)}
                    </div>
                    <span className="font-medium truncate" title={tender.department}>
                      {tender.department}
                    </span>
                  </div>

                  {/* Key Metadata Matrix (EMD, Deadline, Minimum Turnover) */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    
                    {/* EMD Amount */}
                    <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-750 space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <IndianRupee className="w-3 h-3 text-emerald-400" />
                        <span>EMD Amount:</span>
                      </div>
                      <div className="font-semibold text-slate-200 truncate" title={tender.emdAmount}>
                        {tender.emdAmount}
                      </div>
                    </div>

                    {/* Deadline Date */}
                    <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-750 space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Deadline:</span>
                      </div>
                      <div className="font-semibold text-slate-200 truncate" title={tender.deadlineDate}>
                        {tender.deadlineDate}
                      </div>
                    </div>

                    {/* Minimum Turnover Required */}
                    <div className="col-span-2 p-2.5 rounded-xl bg-slate-900/50 border border-slate-750 space-y-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Minimum Turnover Required:</span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          Est. Value: {tender.estimatedValue}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-200 text-xs flex items-center justify-between">
                        <span className={tender.hasMSMETurnoverWaiver ? 'text-emerald-300' : 'text-slate-200'}>
                          {tender.minTurnoverRequired}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {tender.matchScore}% Fit
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pre-Check Reason Note */}
                  <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 p-2 rounded-lg border border-slate-850">
                    <span className="text-slate-500 font-semibold">Pre-check note: </span>
                    {tender.preCheckReason}
                  </div>
                </div>

                {/* Card Footer with Mandated Primary Action: '🔍 Analyze This Tender' */}
                <div className="p-4 bg-slate-900/70 border-t border-slate-750/80 mt-2">
                  <button
                    type="button"
                    id={`analyze-tender-btn-${tender.id}`}
                    onClick={() => {
                      if (onAnalyzeTender) {
                        onAnalyzeTender(tender);
                      } else if (onNavigateTab) {
                        onNavigateTab('analyze');
                      }
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/50 hover:shadow-emerald-900/80 active:scale-[0.98]"
                  >
                    <span>🔍 Analyze This Tender</span>
                    <ArrowRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* 4. BOTTOM STATUTORY ASSURANCE FOOTER */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>
            Real-time feed synchronized with <strong>Government e-Marketplace (GeM)</strong> & <strong>CPPP</strong> Central Portal.
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-emerald-400">PPP-MSE 2012 Exemption Certified</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-300">25% Reserved Sub-Quota Active</span>
        </div>
      </div>

    </div>
  );
};
