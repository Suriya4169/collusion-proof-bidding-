'use client';

import { useState, useEffect } from 'react';
import MatchmakerCard from '@/components/MatchmakerCard';
import JvCard from '@/components/JvCard';

export default function MatchmakerPage() {
  const [msmeId, setMsmeId] = useState('M101');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/api/matchmaker/${id}`);
      if (!response.ok) {
        throw new Error("Failed to load matchmaker data");
      }
      const data = await response.json();
      setDashboardData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(msmeId);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (msmeId) fetchDashboard(msmeId);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
          <div>
            <h1 className="text-4xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
              Proactive Matchmaker
            </h1>
            <p className="text-gray-400">AI-powered Tender Discovery & Consortium Builder</p>
          </div>
          
          <form onSubmit={handleSearch} className="flex gap-2">
            <input 
              type="text" 
              value={msmeId}
              onChange={(e) => setMsmeId(e.target.value)}
              placeholder="Enter MSME ID (e.g. M101)"
              className="bg-white/5 border border-white/20 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 w-48"
            />
            <button 
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold transition-colors"
            >
              Scan
            </button>
          </form>
        </header>

        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-red-400 text-center mb-8">
            {error}
          </div>
        )}

        {dashboardData && !loading && (
          <div className="space-y-12 animate-fade-in-up">
            
            {/* Profile Overview */}
            <div className="bg-gradient-to-r from-indigo-900/30 to-blue-900/30 border border-indigo-500/20 rounded-2xl p-6 flex flex-wrap gap-8 items-center">
              <div>
                <p className="text-sm text-gray-400">Active Profile</p>
                <h2 className="text-2xl font-bold text-white">{dashboardData.msme_profile.company_name}</h2>
              </div>
              <div className="h-10 w-px bg-white/10 hidden md:block"></div>
              <div>
                <p className="text-sm text-gray-400">Sector</p>
                <p className="font-bold text-white">{dashboardData.msme_profile.sector}</p>
              </div>
              <div className="h-10 w-px bg-white/10 hidden md:block"></div>
              <div>
                <p className="text-sm text-gray-400">Turnover</p>
                <p className="font-bold text-white">₹{dashboardData.msme_profile.annual_turnover_lakhs} Lakhs</p>
              </div>
              <div className="h-10 w-px bg-white/10 hidden md:block"></div>
              <div>
                <p className="text-sm text-gray-400">Experience</p>
                <p className="font-bold text-white">{dashboardData.msme_profile.years_of_experience} Years</p>
              </div>
            </div>

            {/* Solo Opportunities */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold">Solo Opportunities</h2>
                <span className="bg-indigo-500/20 text-indigo-400 font-bold px-3 py-1 rounded-full text-sm border border-indigo-500/30">
                  {dashboardData.solo_opportunities.count} Matches
                </span>
              </div>
              
              {dashboardData.solo_opportunities.count > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {dashboardData.solo_opportunities.tenders.map((item: any, idx: number) => (
                    <MatchmakerCard key={idx} tender={item.tender} score={item.score} />
                  ))}
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-gray-400">
                  No solo tenders matched your exact profile.
                </div>
              )}
            </section>

            {/* Consortium / JV Opportunities */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                  Consortium Builder (Joint Ventures)
                </h2>
                <span className="bg-purple-500/20 text-purple-400 font-bold px-3 py-1 rounded-full text-sm border border-purple-500/30">
                  {dashboardData.joint_venture_opportunities.count} Salvaged
                </span>
              </div>
              
              <p className="text-gray-400 mb-6 max-w-3xl">
                These are highly lucrative tenders that you failed to qualify for alone. However, our AI has found a perfect partner company in our database to bridge your gap.
              </p>
              
              {dashboardData.joint_venture_opportunities.count > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {dashboardData.joint_venture_opportunities.tenders.map((item: any, idx: number) => (
                    <JvCard key={idx} tender={item.tender} partner={item.recommended_partner} />
                  ))}
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-gray-400">
                  No Joint Ventures available at this time.
                </div>
              )}
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
