'use client';

import { useState } from 'react';
import Link from 'next/link';
import RegisterMsmeModal from './RegisterMsmeModal';

export default function Navbar() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <nav className="bg-slate-900 border-b border-slate-800 relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex-shrink-0 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-900/40">
                  <span className="text-white font-bold text-lg">P</span>
                </div>
                <div>
                  <span className="text-white font-bold text-lg tracking-tight">ProcureGuard</span>
                  <span className="text-blue-400 font-semibold text-xs ml-1 px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-800/60">AI Suite</span>
                </div>
              </Link>
              <div className="hidden lg:block ml-8">
                <div className="flex items-baseline space-x-2">
                  <Link href="/marketplace" className="text-slate-300 hover:text-white px-2.5 py-2 rounded-md text-xs font-medium transition-colors">
                    Tenders
                  </Link>
                  <Link href="/dashboard" className="text-slate-300 hover:text-white px-2.5 py-2 rounded-md text-xs font-medium transition-colors">
                    Compliance
                  </Link>
                  <Link href="/payment-tracker" className="text-slate-300 hover:text-white px-2.5 py-2 rounded-md text-xs font-medium transition-colors">
                    Payment Tracker
                  </Link>
                  <Link href="/legal-diff" className="text-slate-300 hover:text-white px-2.5 py-2 rounded-md text-xs font-medium transition-colors">
                    Legal Diff
                  </Link>
                  <Link href="/matchmaker" className="text-slate-300 hover:text-white px-2.5 py-2 rounded-md text-xs font-medium transition-colors">
                    Matchmaker
                  </Link>
                  <Link href="/documents" className="text-slate-300 hover:text-white px-2.5 py-2 rounded-md text-xs font-medium transition-colors">
                    Vault
                  </Link>
                  <Link href="/cartel-graph" className="text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-900/50 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors">
                    Cartel Graph
                  </Link>
                  <Link href="/bot-detection" className="text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border border-cyan-900/50 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors">
                    Bot Biometrics
                  </Link>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-4 flex items-center gap-3 md:ml-6">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Register MSME</span>
                </button>
                <Link href="/login" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <RegisterMsmeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(id) => {
          window.location.href = `/documents?msme_id=${id}`;
        }}
      />
    </>
  );
}
