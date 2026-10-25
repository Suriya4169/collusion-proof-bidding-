"use client";

import { useState } from "react";
import { Btn, ErrorNotice, Field, Modal, inputClass } from "./ui";
import { apiRequest, errorMessage, type MsmeRegistrationPayload, type MsmeRegistrationResponse } from "@/lib/api";

interface RegisterMsmeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMsmeId: string) => void;
}

const SECTORS = ["IT Services", "Manufacturing", "Raw Materials", "Infrastructure", "Defense & Aerospace", "Solar Energy"] as const;
const UDYAM_PATTERN = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export default function RegisterMsmeModal({ isOpen, onClose, onSuccess }: RegisterMsmeModalProps) {
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState<string>(SECTORS[0]);
  const [turnover, setTurnover] = useState("85.0");
  const [experience, setExperience] = useState("4");
  const [udyam, setUdyam] = useState("");
  const [gstin, setGstin] = useState("");
  const [email, setEmail] = useState("");
  const [isStartup, setIsStartup] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const udyamOk = udyam === "" || UDYAM_PATTERN.test(udyam);
  const gstinOk = gstin === "" || GSTIN_PATTERN.test(gstin);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!UDYAM_PATTERN.test(udyam) || !GSTIN_PATTERN.test(gstin)) {
      setError("Udyam number or GSTIN is not in the statutory format shown below the field.");
      return;
    }
    setLoading(true);
    setError(null);
    const payload: MsmeRegistrationPayload = {
      company_name: companyName.trim(),
      sector,
      annual_turnover_lakhs: Number.parseFloat(turnover) || 0,
      years_of_experience: Number.parseInt(experience, 10) || 0,
      udyam_number: udyam.trim(),
      gstin: gstin.trim(),
      email: email.trim() || "contact@enterprise.in",
      is_startup_india_recognized: isStartup,
      certifications: ["Udyam Certificate", "GST Registration", "PAN Card"],
    };
    try {
      const res = await apiRequest<MsmeRegistrationResponse>("/api/msme/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setDone(res.data.message ?? "Enterprise registered.");
      setTimeout(() => {
        setDone(null);
        onSuccess(res.data.msme_id);
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
      title="Register MSME enterprise"
      subtitle="Persists the enterprise to the live database after Udyam (MSMED Act 2006 §8) and GSTIN (CGST Act 2017) format validation."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <ErrorNotice message={error} />}
        {done && (
          <div role="status" className="rounded border border-emerald-900/70 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
            {done}
          </div>
        )}

        <Field label="Enterprise name" htmlFor="rm-name">
          <input id="rm-name" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Kavach Cyber Defense Solutions" className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Sector" htmlFor="rm-sector">
            <select id="rm-sector" value={sector} onChange={(e) => setSector(e.target.value)} className={inputClass}>
              {SECTORS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Experience (years)" htmlFor="rm-exp">
            <input id="rm-exp" type="number" min={0} required value={experience} onChange={(e) => setExperience(e.target.value)} className={`${inputClass} font-mono`} />
          </Field>
          <Field label="Annual turnover (₹ lakh)" htmlFor="rm-turn">
            <input id="rm-turn" type="number" step="0.1" min={0} required value={turnover} onChange={(e) => setTurnover(e.target.value)} className={`${inputClass} font-mono`} />
          </Field>
          <Field label="Contact email" htmlFor="rm-email">
            <input id="rm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@enterprise.in" className={inputClass} />
          </Field>
        </div>

        <Field label="Udyam registration number" htmlFor="rm-udyam" hint="Format UDYAM-XX-00-0000000, e.g. UDYAM-TN-01-0012345">
          <input
            id="rm-udyam"
            required
            value={udyam}
            onChange={(e) => setUdyam(e.target.value.toUpperCase())}
            placeholder="UDYAM-DL-01-0098765"
            aria-invalid={!udyamOk}
            className={`${inputClass} font-mono ${udyamOk ? "" : "border-rose-700"}`}
          />
        </Field>

        <Field label="GSTIN" htmlFor="rm-gstin" hint="15 characters, e.g. 07AAAAA0000A1Z5">
          <input
            id="rm-gstin"
            required
            maxLength={15}
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="07AAAAA0000A1Z5"
            aria-invalid={!gstinOk}
            className={`${inputClass} font-mono ${gstinOk ? "" : "border-rose-700"}`}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={isStartup} onChange={(e) => setIsStartup(e.target.checked)} className="accent-sky-500" />
          Startup India recognised (eligible for EMD and turnover relaxations)
        </label>

        <div className="flex gap-2 pt-1">
          <Btn type="button" className="w-1/3" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" variant="primary" className="w-2/3" disabled={loading}>
            {loading ? "Validating…" : "Register enterprise"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
