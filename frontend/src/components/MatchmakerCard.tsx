import React from 'react';

interface Tender {
  tender_id: string;
  title: string;
  category: string;
  min_turnover_lakhs: number;
}

interface MatchmakerCardProps {
  tender: Tender;
  score: number;
}

export default function MatchmakerCard({ tender, score }: MatchmakerCardProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all hover:-translate-y-1 shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <span className="bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/30">
          {tender.category}
        </span>
        <span className="bg-emerald-500/20 text-emerald-400 font-black text-sm px-3 py-1 rounded-full border border-emerald-500/30">
          {score}% Match
        </span>
      </div>
      
      <h3 className="text-xl font-bold text-white mb-2">{tender.title}</h3>
      <p className="text-sm text-gray-400 mb-4">ID: {tender.tender_id}</p>
      
      <div className="bg-black/40 rounded-lg p-4 border border-white/5">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Required Turnover:</span>
          <span className="font-bold text-white">₹{tender.min_turnover_lakhs} Lakhs</span>
        </div>
      </div>
      
      <button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg transition-colors">
        Apply Now (Solo)
      </button>
    </div>
  );
}
