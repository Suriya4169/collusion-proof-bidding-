"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ExternalLink, ShieldCheck, UserPlus } from "lucide-react";
import RegisterMsmeModal from "./RegisterMsmeModal";
import NotificationBell from "./NotificationBell";
import { StatusDot, type Tone } from "./ui";
import { apiRequest, type HealthResponse } from "@/lib/api";

const VENDOR_LINKS = [
  { href: "/marketplace", label: "Tenders" },
  { href: "/dashboard", label: "Compliance Auditor" },
  { href: "/payment-tracker", label: "Payment Recovery" },
  { href: "/legal-diff", label: "Corrigendum Diff" },
  { href: "/matchmaker", label: "Matchmaker" },
  { href: "/documents", label: "Readiness Vault" },
];

interface HealthState {
  tone: Tone;
  label: string;
  detail: string;
}

function useBackendHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ tone: "neutral", label: "Checking", detail: "Contacting GET /health" });

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const { data, latencyMs } = await apiRequest<HealthResponse>("/health");
        if (cancelled) return;
        setState({
          tone: data.status === "ok" ? "pass" : "warn",
          label: data.status === "ok" ? "API online" : "Degraded",
          detail: `${latencyMs} ms · ${data.modules.length} modules`,
        });
      } catch {
        if (!cancelled) setState({ tone: "fail", label: "API offline", detail: "localhost:8000 unreachable" });
      }
    };
    probe();
    const id = setInterval(probe, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}

export default function Navbar() {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const health = useBackendHealth();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-emerald-900/60 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
              <div>
                <span className="text-sm font-bold tracking-tight text-slate-50">ProcureGuard</span>
                <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                  VENDOR PORTAL :3000
                </span>
              </div>
            </Link>

            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 pl-2">
              <Building2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>MSME Sovereign Copilot</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Link to Admin Portal */}
            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded border border-amber-600/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
              title="Open Government Auditor Portal on Port 3001"
            >
              <span>Admin Portal (:3001)</span>
              <ExternalLink className="h-3 w-3" />
            </a>

            <div
              className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1"
              title={`GET /health → ${health.detail}`}
              aria-live="polite"
            >
              <StatusDot tone={health.tone} pulse={health.tone === "pass"} />
              <span className="text-[11px] font-medium text-slate-300">{health.label}</span>
              <span className="hidden font-mono text-[10.5px] text-slate-500 md:inline">{health.detail}</span>
            </div>

            <NotificationBell />

            <button
              onClick={() => setIsModalOpen(true)}
              className="hidden items-center gap-1.5 rounded border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 md:flex"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Register MSME
            </button>

            <Link href="/login" className="rounded border border-emerald-600 bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500">
              Sign in
            </Link>
          </div>
        </div>

        <nav aria-label="Section" className="border-t border-slate-800/60 bg-slate-900/60">
          <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
            {VENDOR_LINKS.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                    active ? "border-emerald-500 text-emerald-300 font-semibold" : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <RegisterMsmeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {}}
      />
    </>
  );
}
