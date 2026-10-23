"use client";

import { useCallback, useEffect, useState } from "react";
import { Handshake, UserPlus } from "lucide-react";
import RegisterMsmeModal from "@/components/RegisterMsmeModal";
import { Btn, EmptyState, ErrorNotice, JsonDrawer, PageHeader, PageShell, Panel, Pill, Spinner, Stat, scoreTone } from "@/components/ui";
import { apiRequest, errorMessage, formatLakhs, getActiveMsmeId, setActiveMsmeId, type MatchmakerDashboard, type MsmeSummary } from "@/lib/api";

export default function MatchmakerPage() {
  const [msmeId, setMsmeId] = useState("M101");
  const [msmes, setMsmes] = useState<MsmeSummary[]>([]);
  const [data, setData] = useState<MatchmakerDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const loadMsmes = useCallback(async () => {
    try {
      const res = await apiRequest<MsmeSummary[]>("/api/msme/all");
      setMsmes(res.data);
    } catch {
      /* selector falls back to the default id; dashboard load reports connectivity errors */
    }
  }, []);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<MatchmakerDashboard>(`/api/matchmaker/${encodeURIComponent(id)}`);
      setData(res.data);
    } catch (e) {
      setData(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = getActiveMsmeId();
    setMsmeId(id);
    loadMsmes();
    load(id);
  }, [loadMsmes, load]);

  const select = (id: string) => {
    setMsmeId(id);
    setActiveMsmeId(id);
    load(id);
  };

  const lead = data?.msme_profile;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Module 2 · Matchmaker"
        title="Solo & Consortium Matchmaker"
        subtitle="Ranks open tenders you qualify for alone and, where turnover or certification gaps block you, assembles a joint-venture partner that closes the gap."
        statutes={["GFR 2017 Rule 173(i)", "Public Procurement Policy for MSEs Order 2012"]}
        actions={
          <>
            <select
              aria-label="Enterprise"
              value={msmeId}
              onChange={(e) => select(e.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-600"
            >
              {msmes.length === 0 && <option value={msmeId}>{msmeId}</option>}
              {msmes.map((m) => (
                <option key={m.msme_id} value={m.msme_id}>
                  {m.msme_id} · {m.company_name}
                </option>
              ))}
            </select>
            <Btn onClick={() => setRegisterOpen(true)} icon={<UserPlus className="h-3 w-3" />}>
              Register MSME
            </Btn>
          </>
        }
      />

      {loading && <Spinner label="Matching tenders…" />}
      {error && <ErrorNotice message={error} onRetry={() => load(msmeId)} />}

      {data && lead && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Enterprise" value={<span className="block truncate text-base">{lead.company_name}</span>} hint={lead.sector} />
            <Stat label="Turnover" value={formatLakhs(lead.annual_turnover_lakhs)} hint={`${lead.years_of_experience} yrs experience`} />
            <Stat label="Solo-qualified" value={data.solo_opportunities.count} tone="pass" hint="tenders" />
            <Stat label="Consortium-salvaged" value={data.joint_venture_opportunities.count} tone="info" hint="tenders via JV" />
          </div>

          <Panel title="Solo-qualified tenders" subtitle="Sector, turnover, experience and certification all satisfied" flush>
            {data.solo_opportunities.count === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">No tenders match the current profile on a solo basis.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/50 text-[10.5px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Tender ID</th>
                      <th className="px-4 py-2 font-medium">Title</th>
                      <th className="px-4 py-2 font-medium">Category</th>
                      <th className="px-4 py-2 text-right font-medium">Min. turnover</th>
                      <th className="px-4 py-2 text-right font-medium">Min. exp.</th>
                      <th className="px-4 py-2 text-right font-medium">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {[...data.solo_opportunities.tenders]
                      .sort((a, b) => b.score - a.score)
                      .map(({ tender, score }) => (
                        <tr key={tender.tender_id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2 font-mono text-slate-400">{tender.tender_id}</td>
                          <td className="px-4 py-2 font-medium text-slate-100">{tender.title}</td>
                          <td className="px-4 py-2 text-slate-400">{tender.category}</td>
                          <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-300">{formatLakhs(tender.min_turnover_lakhs)}</td>
                          <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-300">
                            {tender.min_experience_years != null ? `${tender.min_experience_years} yr` : "—"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Pill tone={scoreTone(score)} mono>
                              {score}%
                            </Pill>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Joint-venture consortium builder" subtitle="Tenders beyond solo qualification, bridged by a complementary partner in the same sector">
            {data.joint_venture_opportunities.count === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">No viable consortium partner found for the current gaps.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {data.joint_venture_opportunities.tenders.map(({ tender, recommended_partner: p }) => {
                  const ownShare = Math.min(100, Math.max(0, (lead.annual_turnover_lakhs / p.combined_turnover) * 100));
                  return (
                    <article key={tender.tender_id} className="rounded-md border border-slate-800 bg-slate-950/50">
                      <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-slate-100">{tender.title}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {tender.tender_id} · requires {formatLakhs(tender.min_turnover_lakhs)}
                          </div>
                        </div>
                        <Pill tone="info" icon={<Handshake className="h-3 w-3" />}>
                          Consortium
                        </Pill>
                      </header>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-xs">
                        <div>
                          <dt className="text-[10.5px] uppercase tracking-wider text-slate-500">Lead partner</dt>
                          <dd className="mt-0.5 text-slate-200">{lead.company_name}</dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] uppercase tracking-wider text-slate-500">Co-partner</dt>
                          <dd className="mt-0.5 text-slate-200">
                            {p.partner_name} <span className="font-mono text-slate-500">({p.partner_id})</span>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] uppercase tracking-wider text-slate-500">Combined turnover</dt>
                          <dd className="mt-0.5 font-mono tabular-nums text-emerald-300">{formatLakhs(p.combined_turnover)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] uppercase tracking-wider text-slate-500">Fit score</dt>
                          <dd className="mt-0.5 font-mono tabular-nums text-slate-200">{p.match_score}%</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="mb-1 flex justify-between text-[10.5px] uppercase tracking-wider text-slate-500">
                            <span>Indicative equity (turnover-weighted)</span>
                            <span className="font-mono normal-case text-slate-400">
                              {ownShare.toFixed(1)} / {(100 - ownShare).toFixed(1)}
                            </span>
                          </dt>
                          <dd className="flex h-1.5 overflow-hidden rounded bg-slate-800">
                            <span className="bg-sky-500" style={{ width: `${ownShare}%` }} />
                            <span className="bg-slate-500" style={{ width: `${100 - ownShare}%` }} />
                          </dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            )}
          </Panel>

          <JsonDrawer title={`GET /api/matchmaker/${msmeId}`} data={data} filename={`matchmaker-${msmeId}.json`} />
        </>
      )}

      {!data && !loading && !error && (
        <EmptyState icon={<Handshake className="h-8 w-8" />} title="No enterprise loaded" body="Select a registered MSME to compute tender matches." />
      )}

      <RegisterMsmeModal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSuccess={async (id) => {
          await loadMsmes();
          select(id);
        }}
      />
    </PageShell>
  );
}
