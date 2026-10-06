'use client';

import { useState } from 'react';
import DualFileDropzone from '@/components/DualFileDropzone';
import DiffReport from '@/components/DiffReport';

export default function LegalDiffPage() {
  const [reportData, setReportData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (original: File, corrigendum: File, daysBefore: number) => {
    setIsProcessing(true);
    setError(null);
    setReportData(null);

    try {
      const formData = new FormData();
      formData.append('original_pdf', original);
      formData.append('corrigendum_pdf', corrigendum);
      formData.append('days_before_deadline', daysBefore.toString());

      const response = await fetch('http://localhost:8000/api/diff', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setReportData(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while analyzing the documents.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white selection:bg-indigo-500/30 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            Legal Semantic Diff
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light">
            Corrigendum Tampering Detection System. Upload an original tender and its amendment to instantly flag restrictive mathematical alterations.
          </p>
        </header>

        <DualFileDropzone onAnalyze={handleAnalyze} isProcessing={isProcessing} />

        {error && (
          <div className="mt-8 bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-red-400 text-center shadow-2xl animate-fade-in-up">
            ⚠️ {error}
          </div>
        )}

        <DiffReport data={reportData} />
      </div>
    </div>
  );
}
