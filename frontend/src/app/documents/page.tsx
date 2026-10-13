'use client';

import React, { useState, useEffect } from 'react';

interface VaultDoc {
  id: number | null;
  document_type: string;
  file_name: string | null;
  upload_date: string | null;
  expiry_date: string | null;
  status: string;
  is_uploaded: boolean;
}

interface VaultData {
  msme_id: string;
  readiness_score: number;
  total_documents_uploaded: number;
  total_required: number;
  vault_documents: VaultDoc[];
  missing_documents: string[];
  proactive_alerts: string[];
}

export default function DocumentVaultPage() {
  const [msmeId, setMsmeId] = useState('M101');
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [selectedType, setSelectedType] = useState('ISO 9001');
  const [expiryDate, setExpiryDate] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const fetchVault = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/api/documents/${id}`);
      if (!res.ok) {
        throw new Error(`Failed to load vault for ${id}`);
      }
      const data: VaultData = await res.json();
      setVaultData(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching document vault');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVault(msmeId);
  }, [msmeId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('msme_id', msmeId);
      formData.append('document_type', selectedType);
      formData.append('expiry_date', expiryDate || 'No Expiry');

      const res = await fetch('http://localhost:8000/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to upload document');
      }

      const result = await res.json();
      setSuccessMsg(result.message || 'Document uploaded successfully');
      setFileToUpload(null);
      setExpiryDate('');
      // Refresh vault
      await fetchVault(msmeId);
    } catch (err: any) {
      setError(err.message || 'Upload error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm('Are you sure you want to remove this document from the vault?')) return;
    try {
      const res = await fetch(`http://localhost:8000/api/documents/${docId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete document');
      await fetchVault(msmeId);
    } catch (err: any) {
      alert(err.message || 'Error deleting document');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500 bg-emerald-500/10';
    if (score >= 60) return 'text-amber-400 border-amber-500 bg-amber-500/10';
    return 'text-rose-400 border-rose-500 bg-rose-500/10';
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
              Procurement Readiness Engine
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
              Digital Document Vault
            </h1>
            <p className="mt-1 text-slate-400 text-sm">
              Manage GeM compliance certificates, track statutory expiry dates, and optimize bid eligibility.
            </p>
          </div>

          {/* MSME Switcher */}
          <div className="flex items-center gap-3 bg-slate-800/80 p-2 rounded-xl border border-slate-700">
            <label htmlFor="msmeSelect" className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-2">
              Active MSME:
            </label>
            <select
              id="msmeSelect"
              value={msmeId}
              onChange={(e) => setMsmeId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="M101">M101 - Apex Precision Tools</option>
              <option value="M102">M102 - BioClean Waste Systems</option>
              <option value="M103">M103 - DataCraft Analytics</option>
              <option value="M104">M104 - EcoEnergy Solar Tech</option>
              <option value="M105">M105 - Precision Hydraulics</option>
            </select>
          </div>
        </div>

        {/* Proactive Alerts Banner */}
        {vaultData?.proactive_alerts && vaultData.proactive_alerts.length > 0 && (
          <div className="space-y-2">
            {vaultData.proactive_alerts.map((alert, idx) => (
              <div
                key={idx}
                className="bg-amber-500/10 border border-amber-500/30 text-amber-200 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-lg shadow-amber-950/20"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">⚡</span>
                  <span>{alert}</span>
                </div>
                <span className="text-xs font-semibold uppercase px-2 py-1 rounded bg-amber-500/20 text-amber-300">
                  Govt Subsidy Eligible
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Readiness Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Score Card */}
          <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Readiness Score</p>
                <h3 className="text-sm text-slate-300 mt-0.5">Government Tender Eligibility</h3>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getScoreColor(vaultData?.readiness_score || 0)}`}>
                {(vaultData?.readiness_score || 0) >= 70 ? 'High Tier' : 'Needs Action'}
              </span>
            </div>

            <div className="my-6 flex items-baseline gap-3">
              <span className="text-5xl font-black text-white tracking-tight">
                {vaultData ? `${vaultData.readiness_score}%` : '--'}
              </span>
              <span className="text-slate-400 text-sm">
                ({vaultData?.total_documents_uploaded || 0} of {vaultData?.total_required || 7} verified)
              </span>
            </div>

            <div className="w-full bg-slate-700/60 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-emerald-400 h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${vaultData?.readiness_score || 0}%` }}
              ></div>
            </div>
          </div>

          {/* Missing Checklist Card */}
          <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Missing Mandatory Docs</p>
              <h3 className="text-sm text-slate-300 mt-0.5">Disqualification Risk Factors</h3>
            </div>

            <div className="my-4">
              {vaultData?.missing_documents && vaultData.missing_documents.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {vaultData.missing_documents.map((doc, idx) => (
                    <span key={idx} className="bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs px-2.5 py-1 rounded-lg font-medium">
                      ✕ {doc}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-emerald-400 text-sm font-semibold flex items-center gap-2">
                  <span>✓</span> All mandatory documents present!
                </p>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Upload missing items to unlock auto-bidding and higher consortium trust scores.
            </p>
          </div>

          {/* Quick Upload Form Card */}
          <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-6 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Upload to Vault</p>
              <h3 className="text-sm text-slate-300 mt-0.5">Encrypt & Verify with AI</h3>
            </div>

            <form onSubmit={handleUpload} className="mt-4 space-y-3">
              <div>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ISO 9001">ISO 9001 (Quality Standard)</option>
                  <option value="Solvency Certificate">Solvency Certificate (Bank)</option>
                  <option value="Bank Statement">Bank Statement (6 Months)</option>
                  <option value="Udyam Certificate">Udyam Registration</option>
                  <option value="GST Registration">GST Registration (REG-06)</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Last 3 Years ITR">Audited Balance Sheet / ITR</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  placeholder="Expiry date"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <label className="flex items-center justify-center bg-slate-700/60 hover:bg-slate-700 text-white rounded-lg px-2 py-1.5 text-xs cursor-pointer border border-slate-600 transition truncate">
                  <span>{fileToUpload ? fileToUpload.name.slice(0, 10) + '...' : 'Select File'}</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFileToUpload(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-2 rounded-lg text-xs transition flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <span>Encrypting & Storing...</span>
                ) : (
                  <>
                    <span>Upload Document</span>
                    <span>↑</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Message Feedback */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-3 rounded-xl text-sm">
            {successMsg}
          </div>
        )}

        {/* Vault Document Table */}
        <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/60">
            <div>
              <h2 className="text-base font-bold text-white">Standard GeM Procurement Checklist</h2>
              <p className="text-xs text-slate-400">Real-time status of required compliance certificates</p>
            </div>
            <span className="text-xs text-slate-400">
              Synced with MSME SQLite Database
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Document Name</th>
                  <th className="px-6 py-3.5">File Reference</th>
                  <th className="px-6 py-3.5">Uploaded Date</th>
                  <th className="px-6 py-3.5">Expiry Date</th>
                  <th className="px-6 py-3.5">Audit Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {vaultData?.vault_documents.map((doc, idx) => {
                  const isExpiring = doc.status === 'EXPIRING_SOON';
                  const isValid = doc.status === 'VALID';
                  const isMissing = !doc.is_uploaded;

                  return (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${isValid ? 'bg-emerald-400' : isExpiring ? 'bg-amber-400 animate-ping' : 'bg-rose-400'}`}></span>
                        <div>
                          <span>{doc.document_type}</span>
                          <span className="block text-[11px] text-slate-500">
                            {doc.document_type === 'ISO 9001' || doc.document_type === 'Solvency Certificate' ? 'Optional Merit' : 'Mandatory Statutory'}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 font-mono text-xs text-slate-300">
                        {doc.file_name ? (
                          <span className="bg-slate-800 px-2 py-1 rounded border border-slate-700">
                            📄 {doc.file_name}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No file attached</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-400">
                        {doc.upload_date || '--'}
                      </td>

                      <td className="px-6 py-4 text-xs">
                        {doc.expiry_date ? (
                          <span className={isExpiring ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                            {doc.expiry_date}
                          </span>
                        ) : (
                          <span className="text-slate-500">Permanent</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isValid && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ✓ Valid
                          </span>
                        )}
                        {isExpiring && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            ⚠️ Expiring Soon
                          </span>
                        )}
                        {isMissing && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            ✕ Missing
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {doc.id ? (
                          <button
                            onClick={() => handleDelete(doc.id!)}
                            className="text-xs text-rose-400 hover:text-rose-300 hover:underline transition font-medium"
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedType(doc.document_type);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition font-medium"
                          >
                            Upload Now
                          </button>
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
    </div>
  );
}
