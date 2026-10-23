'use client';

interface FlaggedClause {
  original_clause: string;
  amended_clause: string;
  similarity_score: number;
  classification: string;
  reason: string;
  base_risk_score: number;
}

interface DiffReportData {
  overall_manipulation_probability: number;
  risk_level: string;
  flagged_clauses: FlaggedClause[];
  days_before_deadline: number;
  temporal_multiplier: number;
}

interface DiffReportProps {
  data: DiffReportData | null;
}

export default function DiffReport({ data }: DiffReportProps) {
  if (!data) return null;

  const isSafe = data.risk_level === 'SAFE';
  const isCritical = data.risk_level === 'CRITICAL';
  
  const badgeColor = isCritical 
    ? 'bg-red-500/20 text-red-400 border-red-500/50' 
    : isSafe 
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
      : 'bg-amber-500/20 text-amber-400 border-amber-500/50';

  return (
    <div className="mt-8 space-y-8 animate-fade-in-up">
      {/* Top Status Bar */}
      <div className={`p-6 rounded-2xl border backdrop-blur-md flex flex-col md:flex-row items-center justify-between shadow-2xl ${badgeColor}`}>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Vigilance Verdict</h2>
          <p className="text-sm mt-1 opacity-90">Temporal Multiplier: {data.temporal_multiplier}x ({data.days_before_deadline} days before deadline)</p>
        </div>
        <div className="mt-4 md:mt-0 text-center md:text-right">
          <div className="text-4xl font-black drop-shadow-md">
            {(data.overall_manipulation_probability * 100).toFixed(0)}%
          </div>
          <div className="text-sm font-bold uppercase tracking-widest opacity-90">
            {data.risk_level}
          </div>
        </div>
      </div>

      {/* Semantic Differences Table */}
      {data.flagged_clauses.length > 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-black/40 px-6 py-4 border-b border-white/10">
            <h3 className="text-lg font-bold text-white">Flagged Semantic Alterations</h3>
            <p className="text-sm text-gray-400">Cosine Similarity dropped below 0.75 threshold</p>
          </div>
          <div className="divide-y divide-white/5">
            {data.flagged_clauses.map((clause, idx) => {
              const isRestrictive = clause.classification === 'RESTRICTIVE';
              const isPermissive = clause.classification === 'PERMISSIVE';
              
              const rowColor = isRestrictive 
                ? 'bg-red-500/5' 
                : isPermissive 
                  ? 'bg-emerald-500/5' 
                  : 'bg-transparent';
              
              const tagColor = isRestrictive 
                ? 'bg-red-500 text-white' 
                : isPermissive 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-gray-600 text-gray-200';

              return (
                <div key={idx} className={`p-6 ${rowColor} hover:bg-white/5 transition-colors`}>
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${tagColor}`}>
                      {clause.classification}
                    </span>
                    <span className="text-xs font-mono text-gray-400 bg-black/50 px-2 py-1 rounded">
                      Sim Score: {clause.similarity_score.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Original Document</h4>
                      <p className="text-gray-300 bg-black/20 p-4 rounded-lg font-serif italic border border-white/5">
                        "{clause.original_clause}"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Corrigendum Amendment</h4>
                      <p className="text-white bg-indigo-500/10 p-4 rounded-lg font-serif border border-indigo-500/20">
                        "{clause.amended_clause}"
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-start space-x-3 bg-black/30 p-3 rounded-lg border border-white/5">
                    <span className="text-xl">🤖</span>
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase">AI Reasoning</h4>
                      <p className="text-sm text-gray-300 mt-1">{clause.reason}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-12 text-center shadow-2xl">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-2xl font-bold text-emerald-400 mb-2">No Tampering Detected</h3>
          <p className="text-emerald-300/70">The semantic differ did not find any restrictive changes in the corrigendum.</p>
        </div>
      )}
    </div>
  );
}
