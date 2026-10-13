'use client';

import React, { useState } from 'react';

interface UploadTenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadTenderModal({ isOpen, onClose, onSuccess }: UploadTenderModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a GeM Tender PDF file.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://localhost:8000/api/tenders/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to ingest GeM tender PDF.');
      }

      setSuccessMsg(data.message || 'Tender ingested successfully!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Error processing tender PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold p-1"
        >
          ✕
        </button>

        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
            <span>📑</span> Real GeM / CPPP Ingestion
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Upload Custom Tender PDF</h2>
          <p className="text-xs text-slate-400 mt-1">
            Drop any public tender PDF downloaded from <code className="text-blue-400">gem.gov.in</code>. AI will autonomously extract eligibility, turnover, EMD, and ministry details.
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl">
            ✓ {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-xl p-8 text-center bg-slate-800/40 transition">
            <input
              type="file"
              accept=".pdf"
              id="tenderPdfInput"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setFile(e.target.files[0]);
                }
              }}
            />
            <label htmlFor="tenderPdfInput" className="cursor-pointer block">
              <span className="text-3xl block mb-2">📥</span>
              <p className="text-sm font-semibold text-slate-200">
                {file ? file.name : 'Click to select or drop GeM Tender PDF'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Supports multi-page GeM Bidding documents (.pdf)</p>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !file}
              className="w-2/3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30"
            >
              {loading ? 'Reading & Extracting Metadata...' : 'Parse & Add to Marketplace →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
