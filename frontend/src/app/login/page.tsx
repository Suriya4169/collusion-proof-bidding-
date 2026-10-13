'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('msme@apex.in');
  const [password, setPassword] = useState('Password123!');
  const [role, setRole] = useState<'msme' | 'government_auditor'>('msme');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed. Please check credentials.');
      }

      // Store Enterprise JWT Bearer Token and user session
      localStorage.setItem('procureguard_token', data.access_token);
      localStorage.setItem('procureguard_user', JSON.stringify(data.user));

      if (data.user.msme_id) {
        localStorage.setItem('active_msme_id', data.user.msme_id);
      }

      // Redirect based on persona
      if (data.user.role === 'government_auditor') {
        router.push('/marketplace?role=auditor');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoCredentials = (targetRole: 'msme' | 'government_auditor') => {
    setRole(targetRole);
    if (targetRole === 'msme') {
      setEmail('msme@apex.in');
      setPassword('Password123!');
    } else {
      setEmail('auditor@gem.gov.in');
      setPassword('Password123!');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[#0F172A]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
          <span className="text-white font-bold text-2xl">M</span>
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-white tracking-tight">
          ProcureGuard AI Enterprise
        </h2>
        <p className="mt-2 text-center text-xs text-slate-400">
          Sign in with JWT Authentication & Role-Based Access Control
        </p>

        {/* Persona Selector Tabs */}
        <div className="mt-6 flex bg-slate-800/80 p-1 rounded-xl border border-slate-700 max-w-xs mx-auto">
          <button
            type="button"
            onClick={() => setDemoCredentials('msme')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${role === 'msme' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            🏢 MSME Portal
          </button>
          <button
            type="button"
            onClick={() => setDemoCredentials('government_auditor')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${role === 'government_auditor' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            🏛️ Govt Auditor
          </button>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-slate-800 relative">
          {error && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1">
                Official Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-700 bg-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-700 bg-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Demo Password: <code className="text-blue-400 font-mono">Password123!</code>
              </span>
              <span className="text-slate-500">256-bit JWT Encrypted</span>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-lg shadow-blue-900/30 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
              >
                {isLoading ? 'Verifying Credentials...' : `Sign in as ${role === 'msme' ? 'MSME Enterprise' : 'Government Auditor'} →`}
              </button>
            </div>
          </form>

          {/* Quick Demo Credentials Footer */}
          <div className="mt-6 pt-5 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
            <span>Don't have an enterprise account?</span>
            <Link href="/documents" className="text-blue-400 hover:underline font-semibold">
              + Register MSME
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
