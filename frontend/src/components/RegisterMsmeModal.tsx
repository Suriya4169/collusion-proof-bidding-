'use client';

import React, { useState } from 'react';

interface RegisterMsmeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMsmeId: string) => void;
}

export default function RegisterMsmeModal({ isOpen, onClose, onSuccess }: RegisterMsmeModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [sector, setSector] = useState('IT Services');
  const [turnover, setTurnover] = useState('85.0');
  const [experience, setExperience] = useState('4');
  const [udyam, setUdyam] = useState('UDYAM-DL-01-0098765');
  const [gstin, setGstin] = useState('07AAAAA0000A1Z5');
  const [email, setEmail] = useState('contact@enterprise.in');
  const [isStartup, setIsStartup] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        company_name: companyName.trim(),
        sector: sector,
        annual_turnover_lakhs: parseFloat(turnover) || 0,
        years_of_experience: parseInt(experience) || 0,
        udyam_number: udyam.trim(),
        gstin: gstin.trim(),
        email: email.trim(),
        is_startup_india_recognized: isStartup,
        certifications: ['Udyam Certificate', 'GST Registration', 'PAN Card']
      };

      const res = await fetch('http://localhost:8000/api/msme/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed.');
      }

      setSuccessMsg(data.message || 'Enterprise registered successfully!');
      setTimeout(() => {
        onSuccess(data.msme_id);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Error registering enterprise');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold p-1"
        >
          ✕
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
            <span>🏛️</span> Real-World Business Onboarding
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Register New Enterprise</h2>
          <p className="text-xs text-slate-400 mt-1">
            Persist your actual MSME into the live database with official Udyam & GSTIN verification.
          </p>
        </div>

        {/* Feedback Alerts */}
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
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Company / Enterprise Name</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Kavach Cyber Defense Solutions"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Sector</label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="IT Services">IT Services</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Raw Materials">Raw Materials</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Defense & Aerospace">Defense & Aerospace</option>
                <option value="Solar Energy">Solar Energy</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Experience (Years)</label>
              <input
                type="number"
                min="0"
                required
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              </input>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Turnover (₹ Lakhs)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={turnover}
                onChange={(e) => setTurnover(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">GSTIN (15 Chars)</label>
              <input
                type="text"
                required
                maxLength={15}
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="07AAAAA0000A1Z5"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Udyam Registration Number
            </label>
            <input
              type="text"
              required
              value={udyam}
              onChange={(e) => setUdyam(e.target.value.toUpperCase())}
              placeholder="UDYAM-DL-01-0098765"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Format: UDYAM-STATE-DISTRICT-7DIGITS (e.g. UDYAM-KR-03-0012345)
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={isStartup}
                onChange={(e) => setIsStartup(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
              />
              <span>Startup India Recognized (Eligible for EMD Waivers)</span>
            </label>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-2/3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30"
            >
              {loading ? 'Validating & Persisting...' : 'Register Enterprise →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
