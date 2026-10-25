import Link from "next/link";
import { Activity, Building2, FileSearch, FolderCheck, GitCompare, Handshake, Scale, ExternalLink } from "lucide-react";
import type { ComponentType } from "react";
import { PageShell } from "@/components/ui";

interface Entry {
  href: string;
  title: string;
  desc: string;
  ref: string;
  Icon: ComponentType<{ className?: string }>;
}

const VENDOR_MODULES: Entry[] = [
  { href: "/dashboard", title: "Tender Compliance Auditor", desc: "Upload GeM tender PDFs to extract EMD waivers, turnover criteria, and get Hindi translations.", ref: "POST /api/tender/analyze", Icon: FileSearch },
  { href: "/marketplace", title: "GeM Tender Marketplace", desc: "Discover active government opportunities with instant qualification matching and budget alerts.", ref: "GET /api/tenders", Icon: Activity },
  { href: "/payment-tracker", title: "Delayed Payment Recovery", desc: "Samadhaan interest calculator enforcing 45-day default rules and 3× RBI compounding interest.", ref: "POST /api/payments/track", Icon: Scale },
  { href: "/legal-diff", title: "Corrigendum Diff & Amendment Guard", desc: "Semantic NLP redline of modified tender clauses with sudden qualification tampering alerts.", ref: "POST /api/diff", Icon: GitCompare },
  { href: "/matchmaker", title: "Consortium Partner Matchmaker", desc: "Find qualified joint-venture partners to bridge technical or financial tender gaps.", ref: "GET /api/matchmaker/{id}", Icon: Handshake },
  { href: "/documents", title: "Readiness Document Vault", desc: "Store and track Udyam, GSTIN, PAN, ISO certificates, and financial solvency proofs.", ref: "GET /api/documents/{id}", Icon: FolderCheck },
];

export default function ClientHomePage() {
  return (
    <PageShell>
      <header className="border-b border-emerald-900/60 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
              MSME VENDOR PORTAL · PORT 3000
            </span>
            <span className="text-xs text-slate-500">Public Procurement Empowerment</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-50">ProcureGuard MSME Vendor Copilot</h1>
          <p className="mt-1 text-xs text-slate-400">
            Dedicated workspace for Micro, Small & Medium Enterprises bidding on Indian public tenders.
          </p>
        </div>

        <a
          href="http://localhost:3001"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3.5 py-2 text-xs font-medium text-amber-300 hover:bg-amber-900/40 transition-colors"
        >
          <span>Open Government Auditor Portal (:3001)</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </header>

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-emerald-400" />
          <h2 className="text-base font-semibold text-slate-100">MSME Growth & Bidding Tools</h2>
          <span className="text-xs text-slate-500">Autonomous Copilot Modules</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {VENDOR_MODULES.map(({ href, title: t, desc, ref, Icon: I }) => (
            <Link key={href} href={href} className="group rounded-xl border border-slate-800 bg-slate-900/80 p-5 transition-all hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-950/20">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20">
                  <I className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-slate-100 group-hover:text-emerald-200">{t}</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">{desc}</p>
              <div className="mt-4 font-mono text-[11px] text-emerald-400/70">{ref}</div>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
