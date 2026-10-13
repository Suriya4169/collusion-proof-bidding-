import React from 'react';

interface Tender {
  tender_id: string;
  title: string;
  min_turnover_lakhs: number;
}

interface Partner {
  partner_id: string;
  partner_name: string;
  combined_turnover: number;
  match_score: number;
}

interface JvCardProps {
  tender: Tender;
  partner: Partner;
}

export default function JvCard({ tender, partner }: JvCardProps) {
  return (
    <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/30 rounded-2xl p-6 hover:from-purple-900/60 hover:to-indigo-900/60 transition-all hover:-translate-y-1 shadow-[0_0_15px_rgba(168,85,247,0.15)] relative overflow-hidden">
      {/* Decorative background flair */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-purple-500/20 rounded-full blur-xl pointer-events-none"></div>

      <div className="flex justify-between items-start mb-4 relative z-10">
        <span className="bg-purple-500/20 text-purple-300 text-xs font-bold px-3 py-1 rounded-full border border-purple-500/30 flex items-center gap-1">
          🤝 Consortium Required
        </span>
      </div>
      
      <h3 className="text-xl font-bold text-white mb-1 line-clamp-1">{tender.title}</h3>
      <p className="text-xs text-gray-400 mb-6">Tender: {tender.tender_id} | Requires: ₹{tender.min_turnover_lakhs}L</p>
      
      <div className="bg-black/50 rounded-xl p-4 border border-purple-500/20 relative z-10">
        <h4 className="text-xs text-purple-300 font-bold uppercase tracking-wider mb-3">AI Partner Match</h4>
        
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-bold text-white text-lg">
            {partner.partner_name.charAt(0)}
          </div>
          <div>
            <div className="font-bold text-white text-sm">{partner.partner_name}</div>
            <div className="text-xs text-gray-400">ID: {partner.partner_id}</div>
          </div>
        </div>
        
        <div className="flex justify-between items-center text-sm bg-white/5 px-3 py-2 rounded-lg">
          <span className="text-gray-300">Combined JV Turnover:</span>
          <span className="font-bold text-emerald-400">₹{partner.combined_turnover} Lakhs</span>
        </div>
      </div>
      
      <button className="w-full mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 rounded-lg transition-all shadow-lg relative z-10">
        Initiate Joint Venture
      </button>
    </div>
  );
}
