"use client";

import { useState } from "react";
import { GitCompare } from "lucide-react";
import DualFileDropzone from "@/components/DualFileDropzone";
import DiffReport from "@/components/DiffReport";
import { EmptyState, ErrorNotice, PageHeader, PageShell, Panel, Spinner } from "@/components/ui";
import { apiRequest, errorMessage, type DiffReportData } from "@/lib/api";

export default function LegalDiffPage() {
  const [report, setReport] = useState<DiffReportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  const run = async (original: File, corrigendum: File, days: number) => {
    setBusy(true);
    setError(null);
    setReport(null);
    setRetry(() => () => run(original, corrigendum, days));
    const form = new FormData();
    form.append("original_pdf", original);
    form.append("corrigendum_pdf", corrigendum);
    form.append("days_before_deadline", String(days));
    try {
      const res = await apiRequest<DiffReportData>("/api/diff", { method: "POST", body: form });
      setReport(res.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Agent 5 · Integrity"
        title="Corrigendum Semantic Diff"
        subtitle="Compares an original RFP with its corrigendum using dense sentence embeddings, flags restrictive or discriminatory amendments and weights them by proximity to bid closing."
        statutes={["GFR 2017 Rule 173", "CVC Guidelines on Transparency", "MiniLM-L6-v2 embeddings"]}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel title="Documents under comparison">
          <DualFileDropzone onAnalyze={run} isProcessing={busy} />
        </Panel>
        <div className="min-w-0">
          {busy ? (
            <Panel>
              <div className="flex min-h-[320px] items-center justify-center">
                <Spinner label="Extracting clauses and computing embeddings" />
              </div>
            </Panel>
          ) : error ? (
            <ErrorNotice message={error} onRetry={retry ?? undefined} />
          ) : report ? (
            <DiffReport data={report} />
          ) : (
            <EmptyState
              icon={<GitCompare className="h-8 w-8" />}
              title="No documents compared"
              body="Provide the original RFP and the corrigendum PDF to see the tampering risk index and a clause-level redline."
            />
          )}
        </div>
      </div>
    </PageShell>
  );
}
