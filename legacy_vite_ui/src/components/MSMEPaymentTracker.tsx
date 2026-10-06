import React, { useState } from 'react';
import {
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Mail,
  Send,
  Scale,
  Building,
  Calendar,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  ArrowUpRight,
  Download,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { MSMEProfile } from '../types';
import { Modal } from './Modal';

export interface InvoiceRecord {
  id: string;
  tenderName: string;
  invoiceNumber: string;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'OVERDUE';
  amount: string;
  amountNum: number;
  buyer: string;
  issuedDate: string;
  daysOverdue?: number;
  interestOwed?: string;
  interestRate?: string;
}

const INITIAL_INVOICES: InvoiceRecord[] = [
  {
    id: 'inv-01',
    tenderName: 'Safety Gear & High-Vis PPE for ONGC Offshore Rigs',
    invoiceNumber: 'INV-ONGC-2026-089',
    dueDate: '25 Jun 2026',
    status: 'OVERDUE',
    amount: '₹3,50,000',
    amountNum: 350000,
    buyer: 'Oil and Natural Gas Corporation (ONGC)',
    issuedDate: '11 May 2026',
    daysOverdue: 67,
    interestOwed: '₹12,450',
    interestRate: '16.5% p.a. (3x RBI Bank Rate)',
  },
  {
    id: 'inv-02',
    tenderName: 'Railway Bogie Pin Machined Assemblies',
    invoiceNumber: 'INV-IR-2026-402',
    dueDate: '14 Aug 2026',
    status: 'Paid',
    amount: '₹12,80,000',
    amountNum: 1280000,
    buyer: 'Central Railway (CR-Matunga Workshop)',
    issuedDate: '30 Jun 2026',
  },
  {
    id: 'inv-03',
    tenderName: 'BHEL Heavy Transformer Gaskets & Bushings',
    invoiceNumber: 'INV-BHEL-2026-114',
    dueDate: '15 Sep 2026',
    status: 'Pending',
    amount: '₹6,20,000',
    amountNum: 620000,
    buyer: 'Bharat Heavy Electricals Ltd (BHEL Bhopal)',
    issuedDate: '01 Aug 2026',
  },
  {
    id: 'inv-04',
    tenderName: 'ISRO Precision Titanium CNC Flanges',
    invoiceNumber: 'INV-ISRO-2026-031',
    dueDate: '08 Jul 2026',
    status: 'Paid',
    amount: '₹8,90,000',
    amountNum: 890000,
    buyer: 'Liquid Propulsion Systems Centre (ISRO)',
    issuedDate: '24 May 2026',
  },
  {
    id: 'inv-05',
    tenderName: 'MSEDCL 33kV Line Isolators & Clamps',
    invoiceNumber: 'INV-MSEDCL-2026-218',
    dueDate: '12 Jul 2026',
    status: 'OVERDUE',
    amount: '₹5,40,000',
    amountNum: 540000,
    buyer: 'Maharashtra State Electricity Distribution Co.',
    issuedDate: '28 May 2026',
    daysOverdue: 50,
    interestOwed: '₹14,850',
    interestRate: '16.5% p.a. (3x RBI Bank Rate)',
  },
  {
    id: 'inv-06',
    tenderName: 'AIIMS Hospital Stainless Surgical Trays',
    invoiceNumber: 'INV-AIIMS-2026-552',
    dueDate: '28 Sep 2026',
    status: 'Pending',
    amount: '₹2,10,000',
    amountNum: 210000,
    buyer: 'AIIMS New Delhi Central Stores',
    issuedDate: '14 Aug 2026',
  },
];

interface MSMEPaymentTrackerProps {
  profile?: MSMEProfile;
  onNavigateTab?: (tab: string) => void;
}

export const MSMEPaymentTracker: React.FC<MSMEPaymentTrackerProps> = ({
  profile,
  onNavigateTab,
}) => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(INITIAL_INVOICES);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord>(INITIAL_INVOICES[0]);

  // Modal States
  const [isDemandNoticeModalOpen, setIsDemandNoticeModalOpen] = useState(false);
  const [isODRModalOpen, setIsODRModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSendingNotice, setIsSendingNotice] = useState(false);
  const [isSubmittingODR, setIsSubmittingODR] = useState(false);

  // Filter state for table
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Paid' | 'Pending' | 'OVERDUE'>('ALL');

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === 'ALL') return true;
    return inv.status === statusFilter;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSendDemandNotice = () => {
    setIsSendingNotice(true);
    setTimeout(() => {
      setIsSendingNotice(false);
      setIsDemandNoticeModalOpen(false);
      showToast(`Section 16 Statutory Demand Notice successfully emailed to Accounts Officer at ${selectedInvoice.buyer}!`);
    }, 1000);
  };

  const handleSubmitODRFiling = () => {
    setIsSubmittingODR(true);
    setTimeout(() => {
      setIsSubmittingODR(false);
      setIsODRModalOpen(false);
      showToast(`MSEFC Reference Case generated! Reference ID: MSEFC/MH/2026/${Math.floor(10000 + Math.random() * 90000)}`);
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      
      {/* 1. TOP HEADER TITLE */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800/90 bg-slate-900/95 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <CreditCard className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Payment &amp; Receivables Tracker
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                <span>MSMED Act 2006 (Sec 15 &amp; 16)</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Automated monitoring for public procurement invoices with statutory penal interest calculations for payments exceeding 45 days.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono">
              RBI Base Rate: <strong className="text-amber-400">5.50%</strong> (3x = <strong className="text-rose-400">16.50%</strong>)
            </span>
          </div>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[11px] text-slate-400 font-semibold block">Total Invoiced</span>
            <span className="text-base sm:text-lg font-extrabold text-white font-mono">₹38,90,000</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">6 Government Orders</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[11px] text-emerald-400 font-semibold block">Paid &amp; Cleared</span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono">₹21,70,000</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">2 Bids settled</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[11px] text-amber-400 font-semibold block">🟡 Pending (&lt;45d)</span>
            <span className="text-base sm:text-lg font-extrabold text-amber-300 font-mono">₹8,30,000</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Within credit window</span>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40">
            <span className="text-[11px] text-rose-300 font-semibold block">🔴 Overdue Principal</span>
            <span className="text-base sm:text-lg font-extrabold text-rose-400 font-mono">₹8,90,000</span>
            <span className="text-[10px] text-rose-300/80 block mt-0.5">+ ₹27,300 Accrued Interest</span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. TOP SECTION: DATA TABLE OF INVOICES */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">
              Invoices &amp; Receivables Ledger
            </h2>
            <span className="text-xs text-slate-400">({filteredInvoices.length} invoices)</span>
          </div>

          {/* Table Filters */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('OVERDUE')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === 'OVERDUE'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              🔴 OVERDUE
            </button>
            <button
              onClick={() => setStatusFilter('Pending')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === 'Pending'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              🟡 Pending
            </button>
            <button
              onClick={() => setStatusFilter('Paid')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === 'Paid'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              ✅ Paid
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              
              {/* Columns: 'Tender Name', 'Invoice #', 'Due Date', 'Status' */}
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 text-xs border-b border-slate-800 uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4 font-semibold">Tender Name</th>
                  <th className="py-3.5 px-4 font-semibold">Invoice #</th>
                  <th className="py-3.5 px-4 font-semibold">Due Date</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/70 text-slate-300">
                {filteredInvoices.map((inv) => {
                  const isOverdue = inv.status === 'OVERDUE';
                  const isPending = inv.status === 'Pending';
                  const isPaid = inv.status === 'Paid';
                  const isCurrentlySelected = selectedInvoice.id === inv.id;

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => {
                        if (isOverdue) setSelectedInvoice(inv);
                      }}
                      className={`transition-colors cursor-pointer ${
                        isCurrentlySelected && isOverdue
                          ? 'bg-rose-950/20 border-l-4 border-l-rose-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* 1. Tender Name & Buyer */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="font-bold text-white text-xs sm:text-sm">
                            {inv.tenderName}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <Building className="w-3 h-3 text-slate-500" />
                            <span>{inv.buyer}</span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Invoice # */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-300 text-xs">
                        {inv.invoiceNumber}
                      </td>

                      {/* 3. Due Date */}
                      <td className="py-3.5 px-4 text-xs font-mono">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span className={isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                            {inv.dueDate}
                          </span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white text-xs sm:text-sm">
                        {inv.amount}
                      </td>

                      {/* 4. Status (✅ Paid, 🟡 Pending, 🔴 OVERDUE) */}
                      <td className="py-3.5 px-4 text-center">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold whitespace-nowrap">
                            <span>✅ Paid</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-bold whitespace-nowrap">
                            <span>🟡 Pending</span>
                          </span>
                        )}
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-950/90 border border-rose-500/70 text-rose-300 text-xs font-bold whitespace-nowrap shadow-sm shadow-rose-950">
                            <span>🔴 OVERDUE</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM SECTION: LARGE CRITICAL ALERT CARD FOR AN OVERDUE PAYMENT */}
      <div
        id="critical-overdue-alert-card"
        className="rounded-2xl border-2 border-rose-500/80 bg-gradient-to-b from-rose-950/40 via-slate-900/95 to-slate-900 p-5 sm:p-7 shadow-2xl shadow-rose-950/50 space-y-6 relative overflow-hidden"
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-500/30 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-rose-100 tracking-tight">
                  🔴 OVERDUE ALERT: {selectedInvoice.tenderName}
                </h3>
              </div>
              <p className="text-xs text-rose-300/80 mt-0.5">
                Buyer: <strong className="text-rose-200">{selectedInvoice.buyer}</strong> • Invoice No: <span className="font-mono text-rose-200">{selectedInvoice.invoiceNumber}</span>
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-rose-900/80 border border-rose-500 text-rose-200 text-xs font-bold self-start sm:self-center font-mono">
            {selectedInvoice.daysOverdue || 67} Days Past Statutory Limit
          </span>
        </div>

        {/* Core Metric Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Invoice Amount */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-rose-900/40 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Invoice Amount:</span>
            <div className="text-xl font-extrabold text-white font-mono">
              {selectedInvoice.amount}
            </div>
            <span className="text-[11px] text-slate-500 block">Principal Balance</span>
          </div>

          {/* Days Overdue */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-rose-900/40 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Days Overdue:</span>
            <div className="text-xl font-extrabold text-rose-400 font-mono">
              {selectedInvoice.daysOverdue || 67} days
            </div>
            <span className="text-[11px] text-rose-300/70 block">Statutory limit: 45 days</span>
          </div>

          {/* Interest Owed */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-rose-900/40 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Interest Owed:</span>
            <div className="text-xl font-extrabold text-amber-300 font-mono">
              {selectedInvoice.interestOwed || '₹12,450'}
            </div>
            <span className="text-[10px] text-amber-400/90 block font-sans">
              Computed via Section 16 MSMED Act
            </span>
          </div>

          {/* Interest Rate Applied */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-rose-900/40 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Interest Rate Applied:</span>
            <div className="text-sm sm:text-base font-extrabold text-white">
              {selectedInvoice.interestRate || '16.5% p.a. (3x RBI Bank Rate)'}
            </div>
            <span className="text-[10px] text-slate-400 block font-sans">
              Compounded monthly per statute
            </span>
          </div>

        </div>

        {/* Statutory Legal Note Box */}
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200/90 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Statutory Mandate (Section 15 &amp; 16):</strong> Where any buyer fails to make payment to the supplier within 45 days from the acceptance date, the buyer is liable to pay compound interest with monthly rests at <strong>3 times of the Bank Rate</strong> notified by the Reserve Bank of India.
          </p>
        </div>

        {/* Two Action Buttons at Bottom of Card */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          
          {/* Button 1: Send Auto-Drafted Demand Notice */}
          <button
            type="button"
            id="send-demand-notice-btn"
            onClick={() => setIsDemandNoticeModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-rose-100 hover:text-white border border-rose-500/40 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
          >
            <Mail className="w-4 h-4 text-rose-400" />
            <span>📧 Send Auto-Drafted Demand Notice</span>
          </button>

          {/* Button 2: Prepare ODR Filing */}
          <button
            type="button"
            id="prepare-odr-filing-btn"
            onClick={() => setIsODRModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-950 hover:shadow-rose-900 active:scale-[0.98]"
          >
            <Scale className="w-4 h-4" />
            <span>📋 Prepare ODR Filing</span>
          </button>

        </div>
      </div>

      {/* 4. MODAL: AUTO-DRAFTED DEMAND NOTICE */}
      <Modal
        isOpen={isDemandNoticeModalOpen}
        onClose={() => !isSendingNotice && setIsDemandNoticeModalOpen(false)}
        title="Statutory Demand Notice (Section 16 MSMED Act)"
        subtitle={`Addressed to Finance & Accounts Division, ${selectedInvoice.buyer}`}
      >
        <div className="space-y-4 text-xs sm:text-sm">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-[11px] sm:text-xs text-slate-300 leading-relaxed max-h-72 overflow-y-auto">
            <div className="text-slate-400">
              <strong>Ref:</strong> STAT-DEMAND/MSME/2026/089<br />
              <strong>Date:</strong> 31 August 2026<br />
              <strong>To:</strong> Head of Finance &amp; Procurement, {selectedInvoice.buyer}
            </div>

            <div className="border-t border-slate-800 pt-2 font-sans font-bold text-white text-xs">
              SUBJECT: DEMAND FOR PAYMENT OF OUTSTANDING INVOICE NO. {selectedInvoice.invoiceNumber} WITH ACCRUED COMPOUND INTEREST UNDER SECTION 16 OF MSMED ACT, 2006
            </div>

            <p className="font-sans">
              Dear Sir/Madam,
            </p>

            <p className="font-sans">
              We draw your kind attention to Invoice No. <strong>{selectedInvoice.invoiceNumber}</strong> dated <strong>{selectedInvoice.issuedDate}</strong> for the supply of <em>'{selectedInvoice.tenderName}'</em> amounting to <strong>{selectedInvoice.amount}</strong>. The goods/services were duly accepted on schedule.
            </p>

            <p className="font-sans">
              As per Section 15 of the Micro, Small and Medium Enterprises Development (MSMED) Act, 2006, the payment was legally due on <strong>{selectedInvoice.dueDate}</strong> (within 45 days). The payment is now overdue by <strong>{selectedInvoice.daysOverdue || 67} days</strong>.
            </p>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1 font-sans text-xs">
              <div>• Principal Outstanding: <strong>{selectedInvoice.amount}</strong></div>
              <div>• Accrued Penal Interest: <strong>{selectedInvoice.interestOwed || '₹12,450'}</strong> (at {selectedInvoice.interestRate || '16.5% p.a.'})</div>
              <div>• Total Amount Payable: <strong>₹3,62,450</strong></div>
            </div>

            <p className="font-sans">
              Please release the total sum of <strong>₹3,62,450</strong> within 7 business days, failing which we shall initiate an Online Dispute Resolution reference under Section 18 before the MSEFC.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              disabled={isSendingNotice}
              onClick={() => setIsDemandNoticeModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSendingNotice}
              onClick={handleSendDemandNotice}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-rose-950"
            >
              {isSendingNotice ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Transmitting Notice...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Transmit Notice via Email &amp; Speed Post</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* 5. MODAL: PREPARE ODR FILING */}
      <Modal
        isOpen={isODRModalOpen}
        onClose={() => !isSubmittingODR && setIsODRModalOpen(false)}
        title="Micro & Small Enterprises Facilitation Council (MSEFC) Filing"
        subtitle="MSME Samadhaan Statutory Arbitration Reference"
      >
        <div className="space-y-4 text-xs sm:text-sm">
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-300">
              <Scale className="w-4 h-4 text-amber-400" />
              <span>Section 18 Statutory Arbitration Jurisdiction</span>
            </div>
            <p className="text-[11px] text-amber-300/80">
              Filing through MSME Samadhaan triggers a 90-day statutory resolution timeline with binding conciliation decrees recognized under the Arbitration and Conciliation Act, 1996.
            </p>
          </div>

          {/* Pre-filled Reference Details */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block">Supplier (Petitioner):</span>
                <strong className="text-white">{profile?.companyName || 'AeroPrecision Tech India Pvt Ltd'}</strong>
                <span className="text-[10px] text-slate-400 block font-mono">{profile?.udyamNumber || 'UDYAM-MH-02-0094124'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block">Respondent (Buyer):</span>
                <strong className="text-white">{selectedInvoice.buyer}</strong>
                <span className="text-[10px] text-slate-400 block">CPSE / Public Sector Entity</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-slate-400 font-semibold block text-xs">Auto-Attached Evidence Documents:</span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-slate-300 bg-slate-900 p-1.5 rounded">
                  <span>📄 Purchase Order &amp; GeM Contract</span>
                  <span className="text-emerald-400 font-mono text-[10px]">Attached (PDF)</span>
                </div>
                <div className="flex items-center justify-between text-slate-300 bg-slate-900 p-1.5 rounded">
                  <span>📄 Goods Receipt &amp; Acceptance Inspection Note</span>
                  <span className="text-emerald-400 font-mono text-[10px]">Verified</span>
                </div>
                <div className="flex items-center justify-between text-slate-300 bg-slate-900 p-1.5 rounded">
                  <span>📄 Tax Invoice {selectedInvoice.invoiceNumber}</span>
                  <span className="text-emerald-400 font-mono text-[10px]">SHA-256 Hashed</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              disabled={isSubmittingODR}
              onClick={() => setIsODRModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmittingODR}
              onClick={handleSubmitODRFiling}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950"
            >
              {isSubmittingODR ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting to Facilitation Council...</span>
                </>
              ) : (
                <>
                  <Scale className="w-3.5 h-3.5" />
                  <span>Submit Application to MSEFC</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
