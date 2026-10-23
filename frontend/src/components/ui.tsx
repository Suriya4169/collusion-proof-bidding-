"use client";

import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronRight, Copy, Download, FileText, Loader2, RotateCw, UploadCloud, X } from "lucide-react";
import { downloadJson } from "@/lib/api";

// ───────────────────────── Tone system ─────────────────────────

export type Tone = "pass" | "warn" | "fail" | "info" | "neutral";

export const toneText: Record<Tone, string> = {
  pass: "text-emerald-400",
  warn: "text-amber-400",
  fail: "text-rose-400",
  info: "text-sky-400",
  neutral: "text-slate-400",
};

const toneBox: Record<Tone, string> = {
  pass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  warn: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  fail: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  info: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  neutral: "bg-slate-800/60 text-slate-300 border-slate-700/80",
};

const toneStroke: Record<Tone, string> = {
  pass: "#34d399",
  warn: "#fbbf24",
  fail: "#fb7185",
  info: "#38bdf8",
  neutral: "#94a3b8",
};

/** Higher-is-better score → tone (compliance, readiness). */
export function scoreTone(v: number): Tone {
  return v >= 80 ? "pass" : v >= 60 ? "warn" : "fail";
}
/** Higher-is-worse score → tone (risk, tamper index). */
export function riskTone(v: number): Tone {
  return v >= 70 ? "fail" : v >= 40 ? "warn" : "pass";
}

// ───────────────────────── Layout ─────────────────────────

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6 space-y-5">{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  statutes,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  statutes?: string[];
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-slate-800/80 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">{eyebrow}</div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-400">{subtitle}</p>
        {statutes && statutes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {statutes.map((s) => (
              <span key={s} className="rounded border border-slate-700/80 bg-slate-900 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-400">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
  flush = false,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`rounded-md border border-slate-800/80 bg-slate-900/90 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="truncate text-[13px] font-semibold text-slate-100">{title}</h2>}
            {subtitle && <p className="truncate text-[11.5px] text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

// ───────────────────────── Atoms ─────────────────────────

export function Pill({
  tone = "neutral",
  children,
  icon,
  mono = false,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
  mono?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4 ${mono ? "font-mono" : ""} ${toneBox[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

export function StatusDot({ tone, pulse = false }: { tone: Tone; pulse?: boolean }) {
  const bg: Record<Tone, string> = {
    pass: "bg-emerald-400",
    warn: "bg-amber-400",
    fail: "bg-rose-400",
    info: "bg-sky-400",
    neutral: "bg-slate-500",
  };
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${bg[tone]}`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${bg[tone]}`} />
    </span>
  );
}

export function Stat({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: string; tone?: Tone }) {
  return (
    <div className="rounded-md border border-slate-800/80 bg-slate-900/90 px-4 py-3">
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${tone === "neutral" ? "text-slate-100" : toneText[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

export function Btn({
  variant = "secondary",
  icon,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger"; icon?: ReactNode }) {
  const styles = {
    primary: "border-sky-600 bg-sky-600 text-white hover:bg-sky-500 hover:border-sky-500",
    secondary: "border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-800 hover:border-slate-600",
    danger: "border-rose-700/70 bg-rose-950/50 text-rose-300 hover:bg-rose-950",
  }[variant];
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${styles} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </span>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-md border border-rose-900/70 bg-rose-950/30 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-rose-200">Request failed</div>
        <p className="mt-0.5 break-words text-xs leading-relaxed text-rose-300/80">{message}</p>
      </div>
      {onRetry && (
        <Btn variant="secondary" onClick={onRetry} icon={<RotateCw className="h-3 w-3" />}>
          Retry
        </Btn>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-md border border-dashed border-slate-800 bg-slate-900/40 px-6 text-center">
      <div className="text-slate-600">{icon}</div>
      <div className="mt-3 text-sm font-medium text-slate-300">{title}</div>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

// ───────────────────────── Gauge ─────────────────────────

export function Gauge({
  value,
  tone,
  label,
  size = 148,
  suffix = "%",
}: {
  value: number;
  tone: Tone;
  label: string;
  size?: number;
  suffix?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`${label}: ${clamped.toFixed(1)}${suffix}`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1e293b" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={toneStroke[tone]}
          strokeWidth="9"
          strokeLinecap="butt"
          strokeDasharray={`${(clamped / 100) * c} ${c}`}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
        <text x="60" y="59" textAnchor="middle" className="fill-slate-50 font-mono" fontSize="22" fontWeight="600">
          {clamped.toFixed(1)}
        </text>
        <text x="60" y="76" textAnchor="middle" className="fill-slate-500 font-mono" fontSize="9">
          {suffix === "%" ? "PERCENT" : suffix}
        </text>
      </svg>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

// ───────────────────────── Clipboard / export ─────────────────────────

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setFailed(false);
      setTimeout(() => setDone(false), 1500);
    } catch {
      setFailed(true);
    }
  };
  return (
    <Btn onClick={copy} icon={done ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}>
      {done ? "Copied" : failed ? "Copy blocked" : label}
    </Btn>
  );
}

export function ExportJsonButton({ data, filename }: { data: unknown; filename: string }) {
  return (
    <Btn onClick={() => downloadJson(filename, data)} icon={<Download className="h-3 w-3" />}>
      Export JSON
    </Btn>
  );
}

/** Collapsible raw-payload inspector with copy + export. */
export function JsonDrawer({ title = "Raw response", data, filename = "payload.json" }: { title?: string; data: unknown; filename?: string }) {
  const [open, setOpen] = useState(false);
  const text = JSON.stringify(data, null, 2);
  return (
    <div className="rounded-md border border-slate-800/80 bg-slate-950/60">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1.5 font-mono text-[11.5px] text-slate-400 hover:text-slate-200"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
          {title}
          <span className="text-slate-600">{text.length.toLocaleString("en-IN")} B</span>
        </button>
        <div className="flex gap-1.5">
          <CopyButton text={text} />
          <ExportJsonButton data={data} filename={filename} />
        </div>
      </div>
      {open && (
        <pre className="max-h-96 overflow-auto border-t border-slate-800/80 p-3 font-mono text-[11px] leading-relaxed text-slate-300">{text}</pre>
      )}
    </div>
  );
}

// ───────────────────────── PDF dropzone ─────────────────────────

export function PdfDropzone({
  label,
  hint,
  file,
  onFile,
  maxMb = 10,
  disabled = false,
}: {
  label: string;
  hint?: string;
  file: File | null;
  onFile: (f: File | null) => void;
  maxMb?: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const accept = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setProblem(`"${f.name}" is not a PDF. Only .pdf documents are accepted.`);
        return;
      }
      if (f.size > maxMb * 1024 * 1024) {
        setProblem(`"${f.name}" is ${(f.size / 1048576).toFixed(1)} MB; the limit is ${maxMb} MB.`);
        return;
      }
      setProblem(null);
      onFile(f);
    },
    [maxMb, onFile],
  );

  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) accept(e.dataTransfer.files[0]);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && inputRef.current?.click()}
        className={`flex cursor-pointer items-center gap-3 rounded border border-dashed px-3 py-4 transition-colors ${
          dragging ? "border-sky-500 bg-sky-500/10" : "border-slate-700 bg-slate-950/50 hover:border-slate-600"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => accept(e.target.files?.[0])} />
        {file ? (
          <>
            <FileText className="h-5 w-5 shrink-0 text-sky-400" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-xs text-slate-200">{file.name}</div>
              <div className="font-mono text-[11px] text-slate-500">{(file.size / 1024).toFixed(1)} KB · application/pdf</div>
            </div>
            <button
              type="button"
              aria-label="Remove file"
              onClick={(e) => {
                e.stopPropagation();
                onFile(null);
              }}
              className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <UploadCloud className="h-5 w-5 shrink-0 text-slate-500" />
            <div className="text-xs text-slate-400">
              <span className="font-medium text-slate-200">Select or drop a PDF</span>
              <span className="block text-[11px] text-slate-500">{hint ?? `PDF only · max ${maxMb} MB`}</span>
            </div>
          </>
        )}
      </div>
      {problem && <p className="mt-1 text-[11.5px] text-rose-400">{problem}</p>}
    </div>
  );
}

// ───────────────────────── Modal ─────────────────────────

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="my-6 w-full max-w-lg rounded-md border border-slate-700/80 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export const inputClass =
  "w-full rounded border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-600";

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
