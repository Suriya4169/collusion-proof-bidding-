'use client';

import { useState, useRef } from 'react';

interface DualFileDropzoneProps {
  onAnalyze: (original: File, corrigendum: File, daysBefore: number) => void;
  isProcessing: boolean;
}

export default function DualFileDropzone({ onAnalyze, isProcessing }: DualFileDropzoneProps) {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [corrigendumFile, setCorrigendumFile] = useState<File | null>(null);
  const [daysBefore, setDaysBefore] = useState<number>(7);
  
  const originalInputRef = useRef<HTMLInputElement>(null);
  const corrigendumInputRef = useRef<HTMLInputElement>(null);

  const handleOriginalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setOriginalFile(e.target.files[0]);
    }
  };

  const handleCorrigendumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCorrigendumFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (originalFile && corrigendumFile) {
      onAnalyze(originalFile, corrigendumFile, daysBefore);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Tender Corrigendum Auditor</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Original Dropzone */}
        <div 
          className="border-2 border-dashed border-indigo-400/50 rounded-xl p-8 text-center cursor-pointer hover:bg-indigo-500/10 transition-colors"
          onClick={() => originalInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={originalInputRef} 
            onChange={handleOriginalChange} 
            accept="application/pdf"
            className="hidden" 
          />
          <div className="text-4xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-white mb-2">Original Tender PDF</h3>
          <p className="text-sm text-gray-400">
            {originalFile ? originalFile.name : "Click to select the baseline document"}
          </p>
        </div>

        {/* Corrigendum Dropzone */}
        <div 
          className="border-2 border-dashed border-purple-400/50 rounded-xl p-8 text-center cursor-pointer hover:bg-purple-500/10 transition-colors"
          onClick={() => corrigendumInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={corrigendumInputRef} 
            onChange={handleCorrigendumChange} 
            accept="application/pdf"
            className="hidden" 
          />
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-white mb-2">Corrigendum PDF</h3>
          <p className="text-sm text-gray-400">
            {corrigendumFile ? corrigendumFile.name : "Click to select the amended document"}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="flex items-center space-x-4">
          <label className="text-gray-300 text-sm font-medium">Days Before Deadline:</label>
          <input 
            type="number" 
            min="1" 
            max="30"
            value={daysBefore}
            onChange={(e) => setDaysBefore(parseInt(e.target.value) || 7)}
            className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 w-24 text-center focus:outline-none focus:border-indigo-500"
          />
        </div>
        
        <p className="text-xs text-gray-500 max-w-md text-center">
          Changes made very close to the deadline (e.g. 1-3 days) receive a higher corruption risk penalty.
        </p>

        <button
          onClick={handleSubmit}
          disabled={!originalFile || !corrigendumFile || isProcessing}
          className={`mt-4 px-8 py-3 rounded-full font-semibold text-white transition-all transform hover:scale-105 shadow-lg ${
            !originalFile || !corrigendumFile || isProcessing 
              ? 'bg-gray-600 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500'
          }`}
        >
          {isProcessing ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running NLP Semantic Diff...
            </span>
          ) : (
            'Run Semantic Diff Analysis'
          )}
        </button>
      </div>
    </div>
  );
}
