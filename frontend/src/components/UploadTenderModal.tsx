"use client";

import { useState } from "react";
import { Btn, ErrorNotice, Modal, PdfDropzone } from "./ui";
import { apiRequest, errorMessage, type TenderUploadResponse } from "@/lib/api";

interface UploadTenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadTenderModal({ isOpen, onClose, onSuccess }: UploadTenderModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await apiRequest<TenderUploadResponse>("/api/tenders/upload-pdf", { method: "POST", body: form });
      setDone(res.data.message ?? "Tender ingested.");
      setTimeout(() => {
        setDone(null);
        setFile(null);
        onSuccess();
        onClose();
      }, 900);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Ingest tender PDF"
      subtitle="Upload a public GeM / CPPP bid document. Bid ID, ministry, EMD, turnover and category are parsed into the repository."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <ErrorNotice message={error} />}
        {done && (
          <div role="status" className="rounded border border-emerald-900/70 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
            {done}
          </div>
        )}
        <PdfDropzone label="Tender PDF" file={file} onFile={setFile} disabled={loading} hint="Multi-page GeM bidding documents · PDF only · max 10 MB" />
        <div className="flex gap-2 pt-1">
          <Btn type="button" className="w-1/3" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" variant="primary" className="w-2/3" disabled={loading || !file}>
            {loading ? "Parsing…" : "Parse and add to repository"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
