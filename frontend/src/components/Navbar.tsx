"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Landmark, ShieldCheck, UserPlus } from "lucide-react";
import RegisterMsmeModal from "./RegisterMsmeModal";
import NotificationBell from "./NotificationBell";
import { StatusDot, type Tone } from "./ui";
import { apiRequest, PERSONA_STORAGE_KEY, type HealthResponse, type Persona } from "@/lib/api";

const VENDOR_LINKS = [
  { href: "/marketplace", label: "Tenders" },
  { href: "/dashboard", label: "Compliance Auditor" },
  { href: "/payment-tracker", label: "Payment Recovery" },
  { href: "/legal-diff", label: "Corrigendum Diff" },
  { href: "/matchmaker", label: "Matchmaker" },
  { href: "/documents", label: "Readiness Vault" },
];

const AUDITOR_LINKS = [
  { href: "/cartel-graph", label: "Cartel Graph" },
  { href: "/solvency", label: "Solvency Auditor" },
  { href: "/bot-detection", label: "Bot Detection" },
  { href: "/m2m-gateway", label: "M2M Gateway" },
  { href: "/agent-pipeline", label: "Agent Pipeline" },
];

const AUDITOR_PREFIXES = AUDITOR_LINKS.map((l) => l.href);
const VENDOR_PREFIXES = VENDOR_LINKS.map((l) => l.href);
const STORAGE_KEY = PERSONA_STORAGE_KEY;

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
  const health = useBackendHealth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stored, setStored] = useState<Persona>("vendor");

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s === "vendor" || s === "auditor") setStored(s);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Route decides persona when unambiguous; otherwise fall back to last choice.
  const persona: Persona = AUDITOR_PREFIXES.some((p) => pathname.startsWith(p))
    ? "auditor"
    : VENDOR_PREFIXES.some((p) => pathname.startsWith(p))
      ? "vendor"
      : stored;

  const choose = (p: Persona) => {
    setStored(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
  };

  const links = persona === "vendor" ? VENDOR_LINKS : AUDITOR_LINKS;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-sky-400" />
              <span className="text-sm font-semibold tracking-tight text-slate-50">ProcureGuard-AI</span>
            </Link>

            <div role="tablist" aria-label="Role" className="flex rounded border border-slate-800 bg-slate-900 p-0.5 text-xs">
              <Link
                href="/dashboard"
                role="tab"
                aria-selected={persona === "vendor"}
                onClick={() => choose("vendor")}
                className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-medium transition-colors ${
                  persona === "vendor" ? "bg-slate-700/70 text-slate-50" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">MSME Vendor Suite</span>
                <span className="sm:hidden">Vendor</span>
              </Link>
              <Link
                href="/cartel-graph"
                role="tab"
                aria-selected={persona === "auditor"}
                onClick={() => choose("auditor")}
                className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-medium transition-colors ${
                  persona === "auditor" ? "bg-slate-700/70 text-slate-50" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Landmark className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Government Auditor Suite</span>
                <span className="sm:hidden">Auditor</span>
              </Link>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div
              className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1"
              title={`GET /health → ${health.detail}`}
              aria-live="polite"
            >
              <StatusDot tone={health.tone} pulse={health.tone === "pass"} />
              <span className="text-[11px] font-medium text-slate-300">{health.label}</span>
              <span className="hidden font-mono text-[10.5px] text-slate-500 md:inline">{health.detail}</span>
            </div>
            {persona === "vendor" && <NotificationBell />}
            {persona === "vendor" && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="hidden items-center gap-1.5 rounded border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 md:flex"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Register MSME
              </button>
            )}
            <Link href="/login" className="rounded border border-sky-600 bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500">
              Sign in
            </Link>
          </div>
        </div>

        <nav aria-label="Section" className="border-t border-slate-800/60 bg-slate-900/60">
          <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
            {links.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                    active ? "border-sky-500 text-slate-50" : "border-transparent text-slate-400 hover:text-slate-200"
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
        onSuccess={(id) => {
          window.location.href = `/documents?msme_id=${id}`;
        }}
      />
    </>
  );
}
