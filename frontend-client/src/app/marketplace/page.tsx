"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Handshake, Search, Upload } from "lucide-react";
import UploadTenderModal from "@/components/UploadTenderModal";
import { Btn, EmptyState, ErrorNotice, PageHeader, PageShell, Panel, Pill, Spinner, inputClass } from "@/components/ui";
import { ALL_SECTORS, apiRequest, errorMessage, formatINR, formatLakhs, type Tender, type TenderFilters, type TendersResponse } from "@/lib/api";

const DEFAULT_FILTERS: TenderFilters = { category: ALL_SECTORS, search: "" };

function daysUntil(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000);
}

export default function Marketplace() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [filters, setFilters] = useState<TenderFilters>(DEFAULT_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async (f: TenderFilters) => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams();
    if (f.category !== ALL_SECTORS) q.set("category", f.category);
    if (f.search.trim()) q.set("search", f.search.trim());
    try {
      const res = await apiRequest<TendersResponse>(`/api/tenders${q.size ? `?${q}` : ""}`);
      setTenders(res.data.tenders);
      if (res.data.available_categories.length) setSectors(res.data.available_categories);
    } catch (e) {
      setTenders([]);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchDraft }));
  };

  const clear = () => {
    setSearchDraft("");
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="GeM / CPPP repository"
        title="Government Tender Repository"
        subtitle="Open tenders with eligibility thresholds. Select a tender to run the compliance auditor against your Udyam profile."
        statutes={["GFR 2017 Rule 173", "Public Procurement Policy for MSEs Order 2012"]}
        actions={
          <Btn variant="primary" onClick={() => setUploadOpen(true)} icon={<Upload className="h-3.5 w-3.5" />}>
            Ingest tender PDF
          </Btn>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Sector filter" className="flex flex-wrap gap-1.5">
          {[ALL_SECTORS, ...sectors].map((s) => (
            <button
              key={s}
              aria-pressed={filters.category === s}
              onClick={() => setFilters((f) => ({ ...f, category: s }))}
              className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                filters.category === s ? "border-sky-600 bg-sky-600/15 text-sky-200" : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={apply} className="flex gap-2">
          <input aria-label="Search tenders" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Keyword, department or bid ID" className={`${inputClass} sm:w-64`} />
          <Btn type="submit" icon={<Search className="h-3 w-3" />}>
            Search
          </Btn>
        </form>
      </div>

      {loading && <Spinner label="Loading tenders…" />}
      {error && <ErrorNotice message={error} onRetry={() => load(filters)} />}

      {!loading && !error && tenders.length === 0 && (
        <EmptyState icon={<Search className="h-8 w-8" />} title="No tenders match the filters" body="Adjust the sector or keyword, or clear the filters." />
      )}
      {!loading && !error && tenders.length === 0 && (filters.category !== ALL_SECTORS || filters.search) && (
        <div className="text-center">
          <Btn onClick={clear}>Clear filters</Btn>
        </div>
      )}

      {!loading && tenders.length > 0 && (
        <>
          <div className="font-mono text-[11px] text-slate-500">{tenders.length} active tenders</div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {tenders.map((t) => {
              const left = daysUntil(t.submission_deadline);
              return (
                <Panel key={t.tender_id} flush>
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill tone="pass">{t.status || "Active"}</Pill>
                        <Pill>{t.category}</Pill>
                        {t.allows_startup_exemption && <Pill tone="info">Startup relaxation</Pill>}
                      </div>
                      <span className="font-mono text-[11px] text-slate-500">{t.tender_id}</span>
                    </div>
                    <div>
                      <h3 className="text-[13.5px] font-semibold leading-snug text-slate-100">{t.title}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{t.department}</p>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 rounded border border-slate-800 bg-slate-950/50 p-3 text-xs sm:grid-cols-4">
                      {[
                        ["Est. value", t.estimated_value_inr],
                        ["Min. turnover", formatLakhs(t.min_turnover_lakhs)],
                        ["EMD", t.emd_amount_inr > 0 ? formatINR(t.emd_amount_inr, true) : "Nil"],
                        ["Experience", `${t.min_experience_years} yr`],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-[10.5px] uppercase tracking-wider text-slate-500">{k}</dt>
                          <dd className="mt-0.5 font-mono tabular-nums text-slate-200">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Closes <span className="font-mono text-slate-200">{t.submission_deadline}</span>
                      {left !== null && (
                        <Pill tone={left < 0 ? "fail" : left <= 7 ? "warn" : "neutral"} mono>
                          {left < 0 ? "closed" : `${left}d left`}
                        </Pill>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 border-t border-slate-800/80 px-4 py-2.5">
                    <Link
                      href={`/dashboard?tender_id=${encodeURIComponent(t.tender_id)}&title=${encodeURIComponent(t.title)}`}
                      className="flex-1 rounded border border-sky-600 bg-sky-600 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-sky-500"
                    >
                      Run compliance audit
                    </Link>
                    <Link href="/matchmaker" className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800">
                      <Handshake className="h-3.5 w-3.5" />
                      JV match
                    </Link>
                  </div>
                </Panel>
              );
            })}
          </div>
        </>
      )}

      <UploadTenderModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={() => load(filters)} />
    </PageShell>
  );
}
