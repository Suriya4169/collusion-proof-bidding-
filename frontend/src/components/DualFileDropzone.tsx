"use client";

import { useState } from "react";
import { GitCompare } from "lucide-react";
import { Btn, PdfDropzone } from "./ui";

interface DualFileDropzoneProps {
  onAnalyze: (original: File, corrigendum: File, daysBefore: number) => void;
  isProcessing: boolean;
}

export default function DualFileDropzone({ onAnalyze, isProcessing }: DualFileDropzoneProps) {
  const [original, setOriginal] = useState<File | null>(null);
  const [corrigendum, setCorrigendum] = useState<File | null>(null);
  const [days, setDays] = useState(7);

  return (
    <div className="space-y-3">
      <PdfDropzone label="Original RFP" file={original} onFile={setOriginal} disabled={isProcessing} />
      <PdfDropzone label="Corrigendum" file={corrigendum} onFile={setCorrigendum} disabled={isProcessing} />
      <div>
        <label htmlFor="days" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Days before bid closing
        </label>
        <input
          id="days"
          type="number"
          min={0}
          max={90}
          value={days}
          onChange={(e) => setDays(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
          className="w-24 rounded border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-sky-600"
        />
        <p className="mt-1 text-[11px] text-slate-500">Amendments published ≤ 3 days before closing receive the highest temporal weighting.</p>
      </div>
      <Btn
        variant="primary"
        className="w-full"
        disabled={!original || !corrigendum || isProcessing}
        onClick={() => original && corrigendum && onAnalyze(original, corrigendum, days)}
        icon={<GitCompare className="h-3.5 w-3.5" />}
      >
        {isProcessing ? "Running semantic diff…" : "Run semantic diff"}
      </Btn>
    </div>
  );
}
