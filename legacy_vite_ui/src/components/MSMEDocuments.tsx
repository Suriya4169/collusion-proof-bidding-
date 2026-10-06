import React, { useState } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Eye,
  Download,
  Trash2,
  ShieldCheck,
  Lock,
  Sparkles,
  ExternalLink,
  Search,
  Filter,
  Check,
  X,
  FileCheck,
  RefreshCw,
  Building,
  Calendar,
  Info,
  Award
} from 'lucide-react';
import { MSMEProfile } from '../types';
import { Modal } from './Modal';

export interface LegalDocumentItem {
  id: string;
  name: string;
  category: 'Registration' | 'Financial' | 'Quality' | 'Statutory' | 'Compliance';
  status: 'Uploaded' | 'Expiring Soon' | 'Missing';
  expiryDate: string;
  fileSize?: string;
  uploadedAt?: string;
  documentRefNumber?: string;
  issuingAuthority?: string;
  isMandatoryForTenders: boolean;
  shaHash?: string;
}

const INITIAL_DOCUMENTS: LegalDocumentItem[] = [
  {
    id: 'doc-01',
    name: 'Udyam Certificate',
    category: 'Registration',
    status: 'Uploaded',
    expiryDate: 'No Expiry',
    fileSize: '1.4 MB',
    uploadedAt: '12 Jan 2026',
    documentRefNumber: 'UDYAM-MH-02-0094124',
    issuingAuthority: 'Ministry of Micro, Small & Medium Enterprises',
    isMandatoryForTenders: true,
    shaHash: '8f92a1c7e9...3b49',
  },
  {
    id: 'doc-02',
    name: 'GST Registration',
    category: 'Registration',
    status: 'Uploaded',
    expiryDate: 'No Expiry',
    fileSize: '890 KB',
    uploadedAt: '15 Jan 2026',
    documentRefNumber: '27AAACG1892M1Z2',
    issuingAuthority: 'Goods and Services Tax Network (GSTN)',
    isMandatoryForTenders: true,
    shaHash: '6d11b22e0a...fa89',
  },
  {
    id: 'doc-03',
    name: 'Solvency Certificate',
    category: 'Financial',
    status: 'Missing',
    expiryDate: '-',
    fileSize: '-',
    documentRefNumber: '-',
    issuingAuthority: 'Scheduled Commercial Bank',
    isMandatoryForTenders: true,
  },
  {
    id: 'doc-04',
    name: 'ISO 9001:2015 Quality Certificate',
    category: 'Quality',
    status: 'Expiring Soon',
    expiryDate: 'Dec 31, 2026 (in 4 months)',
    fileSize: '2.1 MB',
    uploadedAt: '10 Feb 2025',
    documentRefNumber: 'QMS/ISO9001/2023/9102',
    issuingAuthority: 'NABCB Accredited Registrar',
    isMandatoryForTenders: true,
    shaHash: 'a47b1990cc...821e',
  },
  {
    id: 'doc-05',
    name: 'CA Audited Balance Sheet & UDIN Certificate',
    category: 'Financial',
    status: 'Uploaded',
    expiryDate: 'Mar 31, 2027',
    fileSize: '4.8 MB',
    uploadedAt: '20 Jul 2026',
    documentRefNumber: 'UDIN-24089124AAAAAA8912',
    issuingAuthority: 'Institute of Chartered Accountants of India',
    isMandatoryForTenders: true,
    shaHash: '3e8201ac61...119c',
  },
  {
    id: 'doc-06',
    name: 'Class-I Local Content (Make in India) Declaration',
    category: 'Compliance',
    status: 'Uploaded',
    expiryDate: 'Mar 31, 2027',
    fileSize: '640 KB',
    uploadedAt: '05 Aug 2026',
    documentRefNumber: 'MII-AFFIDAVIT-2026-08',
    issuingAuthority: 'Self-Attested Notarized Affidavit (62% Local Value)',
    isMandatoryForTenders: false,
    shaHash: '990bc134ef...4412',
  },
  {
    id: 'doc-07',
    name: 'ZED Gold Certification Scheme Award',
    category: 'Quality',
    status: 'Uploaded',
    expiryDate: 'Aug 15, 2028',
    fileSize: '1.9 MB',
    uploadedAt: '15 Aug 2025',
    documentRefNumber: 'ZED/2025/GOLD/MH/8891',
    issuingAuthority: 'Quality Council of India (QCI) & Ministry of MSME',
    isMandatoryForTenders: false,
    shaHash: '55bc781190...ee32',
  },
  {
    id: 'doc-08',
    name: 'State Pollution Control Board NOC (Consent to Operate)',
    category: 'Statutory',
    status: 'Missing',
    expiryDate: '-',
    fileSize: '-',
    documentRefNumber: '-',
    issuingAuthority: 'Maharashtra Pollution Control Board (MPCB)',
    isMandatoryForTenders: false,
  },
];

interface MSMEDocumentsProps {
  profile: MSMEProfile;
  onNavigateTab?: (tab: string) => void;
}

export const MSMEDocuments: React.FC<MSMEDocumentsProps> = ({
  profile,
  onNavigateTab,
}) => {
  const [documents, setDocuments] = useState<LegalDocumentItem[]>(INITIAL_DOCUMENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDocToUpload, setSelectedDocToUpload] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [activeDocToView, setActiveDocToView] = useState<LegalDocumentItem | null>(null);
  const [isZEDInfoModalOpen, setIsZEDInfoModalOpen] = useState(false);

  // Upload Form State
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadCategory, setUploadCategory] = useState<LegalDocumentItem['category']>('Financial');
  const [uploadExpiry, setUploadExpiry] = useState('');
  const [uploadNoExpiry, setUploadNoExpiry] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadRefNo, setUploadRefNo] = useState('');
  const [uploadAuthority, setUploadAuthority] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessToast, setUploadSuccessToast] = useState(false);

  // Calculate dynamic readiness score
  const totalMandatory = documents.filter((d) => d.isMandatoryForTenders).length;
  const uploadedMandatory = documents.filter(
    (d) => d.isMandatoryForTenders && (d.status === 'Uploaded' || d.status === 'Expiring Soon')
  ).length;
  
  const totalDocs = documents.length;
  const activeDocs = documents.filter((d) => d.status === 'Uploaded' || d.status === 'Expiring Soon').length;
  
  // Readiness score (target 71% default with 5 of 7 or weighted)
  const readinessScore = Math.round((activeDocs / totalDocs) * 100);

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      searchQuery === '' ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.documentRefNumber && doc.documentRefNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'ALL' || doc.category === categoryFilter;

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'UPLOADED' && doc.status === 'Uploaded') ||
      (statusFilter === 'EXPIRING' && doc.status === 'Expiring Soon') ||
      (statusFilter === 'MISSING' && doc.status === 'Missing');

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Handle open upload modal for specific missing doc or generic new
  const handleOpenUpload = (docName?: string, category?: LegalDocumentItem['category']) => {
    if (docName) {
      setSelectedDocToUpload(docName);
      setUploadDocName(docName);
      if (category) setUploadCategory(category);
    } else {
      setSelectedDocToUpload(null);
      setUploadDocName('');
      setUploadCategory('Financial');
    }
    setUploadExpiry('');
    setUploadNoExpiry(false);
    setUploadFile(null);
    setUploadRefNo('');
    setUploadAuthority('');
    setIsUploadModalOpen(true);
  };

  // Handle file upload submit
  const handleConfirmUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadDocName) return;

    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      const newExpiry = uploadNoExpiry ? 'No Expiry' : uploadExpiry || 'Mar 31, 2027';

      setDocuments((prev) => {
        const existingIndex = prev.findIndex(
          (d) => d.name.toLowerCase() === uploadDocName.toLowerCase()
        );

        const newDoc: LegalDocumentItem = {
          id: existingIndex >= 0 ? prev[existingIndex].id : `doc-${Date.now()}`,
          name: uploadDocName,
          category: uploadCategory,
          status: 'Uploaded',
          expiryDate: newExpiry,
          fileSize: uploadFile ? `${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB` : '1.8 MB',
          uploadedAt: 'Today',
          documentRefNumber: uploadRefNo || `DOC/2026/VERIFIED/${Math.floor(1000 + Math.random() * 9000)}`,
          issuingAuthority: uploadAuthority || 'Government / Certified Issuing Authority',
          isMandatoryForTenders: true,
          shaHash: `e71a44c9...${Math.floor(1000 + Math.random() * 9000)}`,
        };

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = newDoc;
          return updated;
        } else {
          return [newDoc, ...prev];
        }
      });

      setIsUploadModalOpen(false);
      setUploadSuccessToast(true);
      setTimeout(() => setUploadSuccessToast(false), 4000);
    }, 800);
  };

  // Handle view document
  const handleViewDocument = (doc: LegalDocumentItem) => {
    setActiveDocToView(doc);
    setIsViewModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      
      {/* 1. TOP HEADER TITLE */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800/90 bg-slate-900/95 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Lock className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                My Documents
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>256-bit Encrypted Vault</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Centralized repository for statutory licenses, tax registrations, and technical certificates for automated GeM & CPPP tender eligibility checks.
            </p>
          </div>

          {/* Prominent Button: + Upload New Document */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              id="upload-new-document-top-btn"
              onClick={() => handleOpenUpload()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-950/60 hover:shadow-emerald-900/80 active:scale-[0.98]"
            >
              <UploadCloud className="w-4 h-4" />
              <span>+ Upload New Document</span>
            </button>
          </div>
        </div>

        {/* 2. TOP SECTION: OVERALL 'READINESS SCORE' PROGRESS BAR (71%) */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-xs">
                {readinessScore}%
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span>Overall Tender Readiness Score</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {activeDocs} of {totalDocs} Certificates Active
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {uploadedMandatory === totalMandatory
                    ? 'All mandatory tender bidding documents verified.'
                    : `Upload missing statutory certificates to achieve 100% automated clearance on GeM/CPPP bids.`}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Uploaded: <strong>{documents.filter((d) => d.status === 'Uploaded').length}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Expiring: <strong>{documents.filter((d) => d.status === 'Expiring Soon').length}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>Missing: <strong>{documents.filter((d) => d.status === 'Missing').length}</strong></span>
              </div>
            </div>
          </div>

          {/* Progress Bar Graphic */}
          <div className="w-full bg-slate-800/90 rounded-full h-3 p-0.5 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-700 relative shadow-sm"
              style={{ width: `${readinessScore}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </div>
          </div>
        </div>

        {/* 3. WARNING ALERT BOX (YELLOW/AMBER) */}
        <div
          id="iso-expiry-alert-box"
          className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-amber-300 block">
                ⚠️ Your ISO 9001 certificate expires in 4 months! Renew it using the ZED Certification Scheme for an 80% subsidy.
              </span>
              <p className="text-[11px] text-amber-300/80">
                Ministry of MSME provides 80% reimbursement for Micro/Small enterprise renewals via the Quality Council of India portal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsZEDInfoModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>ZED Subsidy Info</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleOpenUpload('ISO 9001:2015 Quality Certificate', 'Quality')}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors"
            >
              Upload Renewal
            </button>
          </div>
        </div>

      </div>

      {/* Success Toast */}
      {uploadSuccessToast && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Document securely uploaded, hashed, and integrated into your compliance profile!</span>
          </div>
          <button onClick={() => setUploadSuccessToast(false)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. SLEEK DATA TABLE CONTROLS & FILTER */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
        
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by name, category, or UDIN / Ref number..."
            className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              ×
            </button>
          )}
        </div>

        {/* Status & Category Filters */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter('UPLOADED')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === 'UPLOADED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              ✅ Uploaded
            </button>
            <button
              onClick={() => setStatusFilter('EXPIRING')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === 'EXPIRING'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              ⚠️ Expiring
            </button>
            <button
              onClick={() => setStatusFilter('MISSING')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === 'MISSING'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              ❌ Missing
            </button>
          </div>

        </div>
      </div>

      {/* 5. SLEEK DATA TABLE LISTING DOCUMENTS */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            
            {/* Table Header Columns: 'Document Name', 'Upload Status', 'Expiry Date', and 'Action' */}
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 text-xs border-b border-slate-800 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4 font-semibold">Document Name</th>
                <th className="py-3.5 px-4 font-semibold">Upload Status</th>
                <th className="py-3.5 px-4 font-semibold">Expiry Date</th>
                <th className="py-3.5 px-4 text-right font-semibold">Action</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800/70 text-slate-300">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No documents matching the current search criteria.
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => {
                  const isUploaded = doc.status === 'Uploaded';
                  const isExpiring = doc.status === 'Expiring Soon';
                  const isMissing = doc.status === 'Missing';

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* 1. Document Name & Category Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/70 text-slate-400 group-hover:text-emerald-400 transition-colors shrink-0 mt-0.5">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                              <span>{doc.name}</span>
                              {doc.isMandatoryForTenders && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                  Mandatory
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="text-slate-500">{doc.category}</span>
                              {doc.documentRefNumber && doc.documentRefNumber !== '-' && (
                                <>
                                  <span className="text-slate-600">•</span>
                                  <span className="font-mono text-slate-400 truncate max-w-[200px]">
                                    {doc.documentRefNumber}
                                  </span>
                                </>
                              )}
                              {doc.fileSize && doc.fileSize !== '-' && (
                                <>
                                  <span className="text-slate-600">•</span>
                                  <span className="text-slate-500">{doc.fileSize}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Upload Status Column */}
                      <td className="py-3.5 px-4">
                        {isUploaded && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                            <span>✅ Uploaded</span>
                          </span>
                        )}
                        {isExpiring && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-bold">
                            <span>⚠️ Expiring Soon</span>
                          </span>
                        )}
                        {isMissing && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-bold">
                            <span>❌ Missing</span>
                          </span>
                        )}
                      </td>

                      {/* 3. Expiry Date Column */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {isMissing ? (
                          <span className="text-slate-600 font-bold">-</span>
                        ) : doc.expiryDate === 'No Expiry' ? (
                          <span className="text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded text-[11px] font-sans">
                            No Expiry
                          </span>
                        ) : isExpiring ? (
                          <span className="text-amber-300 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {doc.expiryDate}
                          </span>
                        ) : (
                          <span className="text-slate-300">{doc.expiryDate}</span>
                        )}
                      </td>

                      {/* 4. Action Column */}
                      <td className="py-3.5 px-4 text-right">
                        {isMissing ? (
                          /* Highlighted Upload Button for Missing Documents */
                          <button
                            type="button"
                            id={`upload-missing-btn-${doc.id}`}
                            onClick={() => handleOpenUpload(doc.name, doc.category)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950 hover:shadow-emerald-900 inline-flex items-center gap-1.5 animate-pulse hover:animate-none"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Upload</span>
                          </button>
                        ) : (
                          /* View Button for Uploaded / Expiring Documents */
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              id={`view-doc-btn-${doc.id}`}
                              onClick={() => handleViewDocument(doc)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                              <span>View</span>
                            </button>

                            {isExpiring && (
                              <button
                                type="button"
                                onClick={() => handleOpenUpload(doc.name, doc.category)}
                                className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                                title="Upload renewed document"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span className="hidden sm:inline">Renew</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. UPLOAD MODAL */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => !isUploading && setIsUploadModalOpen(false)}
        title={selectedDocToUpload ? `Upload ${selectedDocToUpload}` : 'Upload New Document to Vault'}
        subtitle="End-to-end encrypted storage linked to automated GeM & CPPP bid pre-checks"
      >
        <form onSubmit={handleConfirmUpload} className="space-y-4 text-xs sm:text-sm">
          
          {/* Document Name */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold block text-xs">
              Document / Certificate Title *
            </label>
            <input
              type="text"
              required
              value={uploadDocName}
              onChange={(e) => setUploadDocName(e.target.value)}
              placeholder="e.g. Solvency Certificate, Factory License, ISO 14001..."
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block text-xs">Category</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Registration">Registration & Legal</option>
                <option value="Financial">Financial & Audited Statements</option>
                <option value="Quality">Quality & Technical Certifications</option>
                <option value="Statutory">Statutory & Pollution NOCs</option>
                <option value="Compliance">Make in India & Local Content</option>
              </select>
            </div>

            {/* Document / UDIN Ref Number */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block text-xs">
                Registration / UDIN / Certificate Number
              </label>
              <input
                type="text"
                value={uploadRefNo}
                onChange={(e) => setUploadRefNo(e.target.value)}
                placeholder="e.g. SOLV/2026/HDFC/098"
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Expiry Date Section */}
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-semibold text-xs">Validity / Expiry Date</label>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uploadNoExpiry}
                  onChange={(e) => setUploadNoExpiry(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-emerald-500"
                />
                <span>No Expiration Date</span>
              </label>
            </div>

            {!uploadNoExpiry && (
              <input
                type="date"
                value={uploadExpiry}
                onChange={(e) => setUploadExpiry(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            )}
          </div>

          {/* Drag & Drop File Zone */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold block text-xs">Upload File (PDF / Image) *</label>
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-5 text-center bg-slate-950/60 cursor-pointer transition-colors">
              <input
                type="file"
                id="vault-file-upload-input"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setUploadFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <label htmlFor="vault-file-upload-input" className="cursor-pointer space-y-2 block">
                <UploadCloud className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-xs text-slate-300 font-medium">
                  {uploadFile ? (
                    <span className="text-emerald-300 font-bold">{uploadFile.name}</span>
                  ) : (
                    <span>Click to browse or drag & drop certificate</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  PDF, PNG, JPG up to 25MB • Automatically attested with SHA-256 hash
                </p>
              </label>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => setIsUploadModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950"
            >
              {isUploading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Encrypting & Storing...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Save to Vault</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* 7. VIEW DOCUMENT PREVIEW MODAL */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={activeDocToView?.name || 'Document Details'}
        subtitle="Cryptographically verified statutory credential in Document Vault"
      >
        {activeDocToView && (
          <div className="space-y-4 text-xs sm:text-sm">
            
            {/* Header Badge */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="font-bold text-white">{activeDocToView.name}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Ref: {activeDocToView.documentRefNumber || 'N/A'}
                  </p>
                </div>
              </div>

              <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                activeDocToView.status === 'Uploaded'
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-500/40 text-amber-300'
              }`}>
                {activeDocToView.status === 'Uploaded' ? '✅ Valid' : '⚠️ Expiring'}
              </span>
            </div>

            {/* Document Attributes Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-500 block">Category:</span>
                <strong className="text-slate-200">{activeDocToView.category}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-500 block">Expiry Date:</span>
                <strong className="text-slate-200">{activeDocToView.expiryDate}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-500 block">Issuing Authority:</span>
                <strong className="text-slate-200 truncate block" title={activeDocToView.issuingAuthority}>
                  {activeDocToView.issuingAuthority || 'Ministry / Commercial Bank'}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-500 block">File Size:</span>
                <strong className="text-slate-200">{activeDocToView.fileSize || '1.8 MB'}</strong>
              </div>
            </div>

            {/* SHA Hash & Verification Stamp */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">Integrity Hash:</span>
                <span className="text-emerald-400 font-mono text-[10px]">SHA-256 Verified</span>
              </div>
              <p className="font-mono text-[11px] text-slate-300 bg-slate-900 p-1.5 rounded border border-slate-800 break-all">
                {activeDocToView.shaHash ? `urn:sha256:${activeDocToView.shaHash}491209cae193` : 'urn:sha256:8f92a1c7e93b491209cae193'}
              </p>
            </div>

            {/* Simulated PDF Preview Box */}
            <div className="p-6 rounded-xl bg-slate-950/90 border border-slate-800 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="space-y-1">
                <span className="font-bold text-slate-200 text-xs block">
                  Official Digital Copy Available
                </span>
                <p className="text-[11px] text-slate-400">
                  Pre-configured to auto-attach during one-click GeM & CPPP bid submissions.
                </p>
              </div>
            </div>

            {/* View Modal Footer */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  alert(`Downloading certified copy of ${activeDocToView.name}...`);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download Certified Copy</span>
              </button>

              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>

          </div>
        )}
      </Modal>

      {/* 8. ZED SUBSIDY INFO MODAL */}
      <Modal
        isOpen={isZEDInfoModalOpen}
        onClose={() => setIsZEDInfoModalOpen(false)}
        title="ZED Certification 80% Subsidy Scheme"
        subtitle="Zero Defect Zero Effect initiative by Ministry of MSME"
      >
        <div className="space-y-4 text-xs sm:text-sm">
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <Award className="w-5 h-5 text-emerald-400" />
              <span>Financial Support for MSME Quality Certification</span>
            </div>
            <p className="text-xs text-emerald-300/90 leading-relaxed">
              Under the MSME Sustainable (ZED) Certification Scheme, enterprises can obtain up to <strong>80% financial subsidy</strong> on consulting, audit fees, and certification renewals for ISO 9001, ISO 14001, and ISO 45001.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-slate-200">Subsidy Slab Structure:</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[11px]">Micro Enterprise</span>
                <strong className="text-emerald-400 text-sm">80% Subsidy</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[11px]">Small Enterprise</span>
                <strong className="text-emerald-400 text-sm">60% Subsidy</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[11px]">Medium Enterprise</span>
                <strong className="text-emerald-400 text-sm">50% Subsidy</strong>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsZEDInfoModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                setIsZEDInfoModalOpen(false);
                handleOpenUpload('ISO 9001:2015 Quality Certificate', 'Quality');
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
            >
              Upload Renewal Certificate
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
