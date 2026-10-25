import Link from "next/link";
import { Banknote, Fingerprint, GitBranch, Landmark, Network, Server, Trophy, ShieldAlert, ExternalLink } from "lucide-react";
import type { ComponentType } from "react";
import { PageShell } from "@/components/ui";

interface Entry {
  href: string;
  title: string;
  desc: string;
  ref: string;
  Icon: ComponentType<{ className?: string }>;
}

const AUDITOR_MODULES: Entry[] = [
  { href: "/cartel-graph", title: "Cartel Graph Collusion Intelligence", desc: "Bipartite network anomaly detector uncovering shared directors, IPs, bank routing, and cloned machinery.", ref: "GET /api/cartel/analyze", Icon: Network },
  { href: "/solvency", title: "Solvency & Ledger Auditor", desc: "Bank statement forensics detecting window dressing, balance volatility, and Benford's Law anomalies.", ref: "POST /api/v1/agent/solvency/analyze", Icon: Banknote },
  { href: "/bot-detection", title: "Behavioral Biometric Bot Forensics", desc: "Keystroke dynamics and Isolation Forest classifier detecting scripted bids and automated injection bots.", ref: "POST /api/behavior/analyze", Icon: Fingerprint },
  { href: "/trust-optimizer", title: "Hardened Bayesian Trust Optimizer", desc: "Multi-criteria posterior optimization fusing past performance, pricing variance, and collusion penalties.", ref: "GET /api/trust-optimizer/leaderboard/{id}", Icon: Trophy },
  { href: "/m2m-gateway", title: "M2M Programmatic Gateway", desc: "Machine-to-machine public procurement API gateway with webhook signatures and rate limits.", ref: "/api/m2m/v1/*", Icon: Server },
  { href: "/agent-pipeline", title: "Autonomous Multi-Agent Pipeline", desc: "Six-node LangGraph execution trace and sovereign LLM decision graph telemetry.", ref: "POST /api/orchestrator/analyze", Icon: GitBranch },
];

export default function AdminHomePage() {
  return (
    <PageShell>
      <header className="border-b border-amber-900/60 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30">
              GOVERNMENT AUDITOR PORTAL · PORT 3001
            </span>
            <span className="text-xs text-slate-500">GeM Procurement Vigilance</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-50">ProcureGuard Integrity & Anti-Collusion Console</h1>
          <p className="mt-1 text-xs text-slate-400">
            Dedicated portal for Government Procurement Officers, Vigilance Observers, and Anti-Fraud Auditors.
          </p>
        </div>

        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3.5 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-900/40 transition-colors"
        >
          <span>Open MSME Client Portal (:3000)</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </header>

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <h2 className="text-base font-semibold text-slate-100">Audit & Fraud Detection Modules</h2>
          <span className="text-xs text-slate-500">Autonomous Vigilance Stack</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {AUDITOR_MODULES.map(({ href, title: t, desc, ref, Icon: I }) => (
            <Link key={href} href={href} className="group rounded-xl border border-slate-800 bg-slate-900/80 p-5 transition-all hover:border-amber-500/60 hover:shadow-lg hover:shadow-amber-950/20">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400 border border-amber-500/20 group-hover:bg-amber-500/20">
                  <I className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-slate-100 group-hover:text-amber-200">{t}</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">{desc}</p>
              <div className="mt-4 font-mono text-[11px] text-amber-400/70">{ref}</div>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
