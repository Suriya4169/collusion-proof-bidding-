import Link from "next/link";
import { Activity, Building2, Fingerprint, GitBranch, Landmark, Network, Scale, Server, FileSearch, GitCompare, Handshake, FolderCheck } from "lucide-react";
import type { ComponentType } from "react";
import { PageShell } from "@/components/ui";

interface Entry {
  href: string;
  title: string;
  desc: string;
  ref: string;
  Icon: ComponentType<{ className?: string }>;
}

const VENDOR: Entry[] = [
  { href: "/dashboard", title: "Compliance Auditor", desc: "Clause-level eligibility against a tender PDF with page citations.", ref: "POST /api/tender/analyze", Icon: FileSearch },
  { href: "/payment-tracker", title: "Payment Recovery", desc: "45-day default, 3× RBI compounding interest and a draft §16 notice.", ref: "POST /api/payments/track", Icon: Scale },
  { href: "/legal-diff", title: "Corrigendum Diff", desc: "Semantic redline of amended clauses with a tampering risk index.", ref: "POST /api/diff", Icon: GitCompare },
  { href: "/matchmaker", title: "Matchmaker", desc: "Solo-qualified tenders and joint-venture consortium partners.", ref: "GET /api/matchmaker/{id}", Icon: Handshake },
  { href: "/documents", title: "Readiness Vault", desc: "Udyam, GSTIN, PAN, ISO and solvency expiry tracking.", ref: "GET /api/documents/{id}", Icon: FolderCheck },
  { href: "/marketplace", title: "Tender Repository", desc: "Live GeM tender listings with eligibility pre-checks.", ref: "GET /api/tenders", Icon: Activity },
];

const AUDITOR: Entry[] = [
  { href: "/cartel-graph", title: "Cartel Graph", desc: "Bipartite network of bidders, owners, IPs and bank codes.", ref: "GET /api/cartel/analyze", Icon: Network },
  { href: "/bot-detection", title: "Bot Detection", desc: "Keystroke flight and dwell-time forensics for scripted bids.", ref: "POST /api/behavior/analyze", Icon: Fingerprint },
  { href: "/m2m-gateway", title: "M2M Gateway", desc: "Server-to-server tender push, compliance query and webhooks.", ref: "/api/m2m/v1/*", Icon: Server },
  { href: "/agent-pipeline", title: "Agent Pipeline", desc: "Six-node LangGraph execution trace and token telemetry.", ref: "POST /api/orchestrator/analyze", Icon: GitBranch },
];

function Section({ title, subtitle, Icon, entries }: { title: string; subtitle: string; Icon: Entry["Icon"]; entries: Entry[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-sky-400" />
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        <span className="text-xs text-slate-500">{subtitle}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(({ href, title: t, desc, ref, Icon: I }) => (
          <Link key={href} href={href} className="group rounded-md border border-slate-800/80 bg-slate-900/90 p-4 transition-colors hover:border-slate-600">
            <div className="flex items-center gap-2">
              <I className="h-4 w-4 text-slate-500 group-hover:text-sky-400" />
              <span className="text-[13px] font-semibold text-slate-100">{t}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{desc}</p>
            <div className="mt-3 font-mono text-[10.5px] text-slate-600">{ref}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <PageShell>
      <header className="border-b border-slate-800/80 pb-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">Public procurement integrity suite</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">ProcureGuard-AI Operations Console</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-400">
          Neurosymbolic tender compliance for MSMEs and collusion, tampering and bot analytics for procuring entities. LLMs extract; deterministic code decides.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["MSMED Act 2006 §15–17", "GFR 2017 Rule 173(i)", "Competition Act 2002 §3(3)(d)", "DPDP Act 2023"].map((s) => (
            <span key={s} className="rounded border border-slate-700/80 bg-slate-900 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-400">
              {s}
            </span>
          ))}
        </div>
      </header>
      <Section title="MSME Vendor Suite" subtitle="Bid, recover, stay compliant" Icon={Building2} entries={VENDOR} />
      <Section title="Government Auditor Suite" subtitle="Detect collusion, tampering and automation" Icon={Landmark} entries={AUDITOR} />
    </PageShell>
  );
}
