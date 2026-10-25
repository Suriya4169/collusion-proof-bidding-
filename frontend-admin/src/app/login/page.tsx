"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Landmark, ShieldCheck } from "lucide-react";
import { Btn, ErrorNotice, Field, inputClass } from "@/components/ui";
import { apiRequest, errorMessage, PERSONA_STORAGE_KEY, personaForRole, type LoginResponse, type Persona } from "@/lib/api";

const DEMO: Record<Persona, { email: string; landing: string; label: string }> = {
  vendor: { email: "msme@apex.in", landing: "/dashboard", label: "MSME Vendor" },
  auditor: { email: "auditor@gem.gov.in", landing: "/cartel-graph", label: "Govt Auditor" },
};

export default function Login() {
  const router = useRouter();
  const [persona, setPersona] = useState<Persona>("vendor");
  const [email, setEmail] = useState(DEMO.vendor.email);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (p: Persona) => {
    setPersona(p);
    setEmail(DEMO[p].email);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiRequest<LoginResponse>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      // The account's server-side role is authoritative for the persona.
      const effective = personaForRole(data.user.role);
      try {
        localStorage.setItem("procureguard_token", data.access_token);
        localStorage.setItem("procureguard_user", JSON.stringify(data.user));
        localStorage.setItem(PERSONA_STORAGE_KEY, effective);
        if (data.user.msme_id) localStorage.setItem("active_msme_id", data.user.msme_id);
      } catch {
        /* storage blocked: continue without persisting the session */
      }
      router.push(DEMO[effective].landing);
    } catch (err) {
      setError(errorMessage(err, "Authentication failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 text-center">
          <ShieldCheck className="mx-auto h-7 w-7 text-sky-400" />
          <h1 className="mt-2 text-lg font-semibold text-slate-50">Sign in to ProcureGuard-AI</h1>
          <p className="mt-1 text-xs text-slate-500">JWT authentication with role-based access control</p>
        </div>

        <div role="tablist" aria-label="Role" className="mb-3 grid grid-cols-2 rounded border border-slate-800 bg-slate-900 p-0.5 text-xs">
          {(["vendor", "auditor"] as const).map((p) => {
            const Icon = p === "vendor" ? Building2 : Landmark;
            return (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={persona === p}
                onClick={() => choose(p)}
                className={`flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 font-medium transition-colors ${persona === p ? "bg-slate-700/70 text-slate-50" : "text-slate-400 hover:text-slate-200"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {DEMO[p].label}
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-md border border-slate-800/80 bg-slate-900/90 p-4">
          {error && <ErrorNotice message={error} />}
          <Field label="Official email" htmlFor="email">
            <input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} font-mono`} />
          </Field>
          <Field label="Password" htmlFor="password" hint="Seeded demo accounts use the password documented in backend/src/db/seed.py">
            <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </Field>
          <Btn type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? "Verifying…" : `Sign in as ${DEMO[persona].label}`}
          </Btn>
          <p className="border-t border-slate-800 pt-3 text-center text-[11.5px] text-slate-500">
            No enterprise account?{" "}
            <Link href="/documents" className="text-sky-400 hover:underline">
              Register an MSME
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
