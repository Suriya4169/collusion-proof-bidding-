'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import UploadTenderModal from "@/components/UploadTenderModal";

interface Tender {
  tender_id: string;
  title: string;
  department: string;
  category: string;
  min_turnover_lakhs: number;
  min_experience_years: number;
  emd_amount_inr: number;
  estimated_value_inr: string;
  submission_deadline: string;
  allows_startup_exemption: boolean;
  status: string;
}

export default function Marketplace() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTenders = async (category: string = "All", search: string = "") => {
    setLoading(true);
    setError(null);
    try {
      let url = "http://localhost:8000/api/tenders";
      const params = new URLSearchParams();
      if (category && category !== "All") params.append("category", category);
      if (search.trim()) params.append("search", search.trim());

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load tenders: ${response.statusText}`);
      }
      const data = await response.json();
      setTenders(data.tenders || []);
      if (data.available_categories && data.available_categories.length > 0) {
        setCategories(["All", ...data.available_categories]);
      }
    } catch (err: any) {
      console.warn("Backend API unavailable, using offline fallback:", err.message);
      // Resilient fallback for offline testing
      setTenders([
        {
          tender_id: "GEM/2026/B/9292805",
          title: "Supply of Precision Machined Components for Aerospace Division",
          department: "Ministry of Defence (HAL)",
          category: "Manufacturing",
          min_turnover_lakhs: 250.0,
          min_experience_years: 3,
          emd_amount_inr: 50000.0,
          estimated_value_inr: "₹ 2.5 Crores",
          submission_deadline: "2026-10-15",
          allows_startup_exemption: true,
          status: "Active"
        },
        {
          tender_id: "GEM/2026/B/9394343",
          title: "Procurement of High-Grade Steel Alloy Sheets (Grade 304)",
          department: "Ministry of Railways",
          category: "Raw Materials",
          min_turnover_lakhs: 120.0,
          min_experience_years: 2,
          emd_amount_inr: 25000.0,
          estimated_value_inr: "₹ 1.2 Crores",
          submission_deadline: "2026-10-22",
          allows_startup_exemption: true,
          status: "Active"
        },
        {
          tender_id: "GEM/2026/B/9472132",
          title: "Annual Maintenance Contract for IT Infrastructure",
          department: "Ministry of Finance",
          category: "IT Services",
          min_turnover_lakhs: 85.0,
          min_experience_years: 3,
          emd_amount_inr: 0.0,
          estimated_value_inr: "₹ 85 Lakhs",
          submission_deadline: "2026-11-05",
          allows_startup_exemption: true,
          status: "Active"
        },
        {
          tender_id: "GEM/2026/B/9558683",
          title: "Installation of Solar Panels (50KW) in Government Quarters",
          department: "Ministry of New and Renewable Energy",
          category: "Infrastructure",
          min_turnover_lakhs: 340.0,
          min_experience_years: 4,
          emd_amount_inr: 100000.0,
          estimated_value_inr: "₹ 3.4 Crores",
          submission_deadline: "2026-11-12",
          allows_startup_exemption: false,
          status: "Active"
        }
      ]);
      setCategories(["All", "Manufacturing", "Raw Materials", "IT Services", "Infrastructure"]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenders(selectedCategory, searchQuery);
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTenders(selectedCategory, searchQuery);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Section */}
      <div className="md:flex md:items-center md:justify-between mb-8 pb-6 border-b border-slate-800">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="bg-blue-600/20 text-blue-400 font-semibold text-xs px-3 py-1 rounded-full border border-blue-500/30">
              Live GeM Repository
            </span>
            <span className="text-slate-400 text-sm">
              {tenders.length} Active Bids
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl mt-2 tracking-tight">
            Government Tender Marketplace
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time public procurement repository. One-click pass to Neurosymbolic AI eligibility verification.
          </p>
        </div>
        <div className="mt-4 flex gap-3 md:mt-0 md:ml-4">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
          >
            + Upload Custom PDF
          </button>
          <Link
            href="/matchmaker"
            className="inline-flex items-center px-4 py-2 border border-purple-500/30 rounded-lg shadow-sm text-sm font-semibold text-purple-300 bg-purple-950/40 hover:bg-purple-900/50 transition-colors"
          >
            AI Joint Venture Match
          </Link>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-8">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keyword or ID..."
            className="bg-slate-900 border border-slate-800 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 w-full sm:w-64"
          />
          <button
            type="submit"
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-slate-700"
          >
            Search
          </button>
        </form>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Tender Cards Grid */}
      {!loading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {tenders.map((tender) => (
            <div
              key={tender.tender_id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col hover:border-blue-500/50 hover:shadow-blue-500/10 transition-all hover:-translate-y-0.5"
            >
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {tender.status || "Active"}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                      {tender.category}
                    </span>
                    {tender.allows_startup_exemption && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        Startup Exempted
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-800/60 px-2 py-1 rounded">
                    {tender.tender_id}
                  </span>
                </div>

                <h3 className="mt-4 text-xl font-bold text-white line-clamp-2 leading-snug">
                  {tender.title}
                </h3>
                <p className="mt-1 text-xs text-slate-400 font-medium">
                  🏛️ {tender.department}
                </p>

                <div className="mt-6 bg-slate-950/60 rounded-xl p-4 border border-slate-800/80">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-1">Est. Value</span>
                      <span className="text-white font-bold">{tender.estimated_value_inr}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Min. Turnover</span>
                      <span className="text-white font-bold">₹{tender.min_turnover_lakhs} Lakhs</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">EMD Required</span>
                      <span className="text-white font-bold">
                        {tender.emd_amount_inr > 0 ? `₹${tender.emd_amount_inr.toLocaleString()}` : "Exempted"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                  <span>📅 Deadline: <strong className="text-slate-200">{tender.submission_deadline}</strong></span>
                  <span>⏳ Experience: <strong className="text-slate-200">{tender.min_experience_years} Years</strong></span>
                </div>
              </div>

              <div className="bg-slate-950/40 px-6 py-4 border-t border-slate-800/80 flex gap-3">
                <Link
                  href={`/dashboard?tender_id=${encodeURIComponent(tender.tender_id)}&title=${encodeURIComponent(tender.title)}`}
                  className="flex-1 flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-md shadow-blue-600/20"
                >
                  Analyze with AI Copilot
                </Link>
                <Link
                  href={`/matchmaker?msme_id=M101`}
                  className="flex items-center justify-center py-2.5 px-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
                  title="Check Consortium Joint Venture"
                >
                  🤝 JV
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && tenders.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center">
          <p className="text-slate-400 text-lg mb-2">No tenders match your selected filters.</p>
          <button
            onClick={() => { setSelectedCategory("All"); setSearchQuery(""); fetchTenders("All", ""); }}
            className="text-blue-500 hover:underline text-sm font-semibold"
          >
            Clear all filters
          </button>
        </div>
      )}

      <UploadTenderModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => fetchTenders(selectedCategory, searchQuery)}
      />
    </div>
  );
}
