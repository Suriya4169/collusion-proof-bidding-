"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Handshake, Target } from "lucide-react";
import { Pill } from "./ui";
import { apiRequest, getActiveMsmeId, type MatchNotification, type NotificationsResponse } from "@/lib/api";

const POLL_MS = 30_000;

function timeAgo(iso: string): string {
  const t = Date.parse(`${iso}Z`);
  if (Number.isNaN(t)) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export default function NotificationBell() {
  const [msmeId, setMsmeId] = useState("");
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setMsmeId(getActiveMsmeId());
    sync();
    window.addEventListener("pg-active-msme", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("pg-active-msme", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const load = useCallback(async () => {
    if (!msmeId) return;
    try {
      const res = await apiRequest<NotificationsResponse>(`/api/notifications/${encodeURIComponent(msmeId)}?limit=20`);
      setData(res.data);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [msmeId]);

  useEffect(() => {
    load();
    const id = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => rootRef.current && !rootRef.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = async (n: MatchNotification) => {
    if (n.read) return;
    setData((d) => d && { ...d, unread_count: Math.max(0, d.unread_count - 1), notifications: d.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)) });
    try {
      await apiRequest(`/api/notifications/item/${n.id}/read`, { method: "POST" });
    } catch {
      load();
    }
  };

  const markAll = async () => {
    setData((d) => d && { ...d, unread_count: 0, notifications: d.notifications.map((x) => ({ ...x, read: true })) });
    try {
      await apiRequest(`/api/notifications/${encodeURIComponent(msmeId)}/read-all`, { method: "POST" });
    } catch {
      load();
    }
  };

  const unread = data?.unread_count ?? 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Tender match alerts${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        className="relative rounded border border-slate-800 bg-slate-900 p-1.5 text-slate-300 hover:text-slate-50"
      >
        <Bell className="h-3.5 w-3.5" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-sky-500 px-1 text-center font-mono text-[9.5px] font-semibold leading-4 text-slate-950">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Tender match alerts" className="absolute right-0 z-[70] mt-2 w-[min(92vw,380px)] rounded-md border border-slate-700/80 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <div>
              <div className="text-[13px] font-semibold text-slate-100">Match alerts</div>
              <div className="font-mono text-[10.5px] text-slate-500">{msmeId}</div>
            </div>
            <button onClick={markAll} disabled={unread === 0} className="text-[11px] font-medium text-sky-400 hover:underline disabled:cursor-not-allowed disabled:text-slate-600 disabled:no-underline">
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {offline && !data && <p className="px-3 py-6 text-center text-xs text-rose-300">Cannot reach the notification service.</p>}
            {data && data.notifications.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-500">No matches yet. The matcher scans for new tenders automatically.</p>}
            <ul className="divide-y divide-slate-800/70">
              {data?.notifications.map((n) => {
                const href = n.kind === "SOLO" ? `/dashboard?tender_id=${encodeURIComponent(n.tender_id)}&title=${encodeURIComponent(n.title)}` : "/matchmaker";
                const Icon = n.kind === "SOLO" ? Target : Handshake;
                return (
                  <li key={n.id}>
                    <Link
                      href={href}
                      onClick={() => {
                        markRead(n);
                        setOpen(false);
                      }}
                      className={`flex gap-2.5 px-3 py-2.5 hover:bg-slate-800/50 ${n.read ? "opacity-60" : ""}`}
                    >
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${n.kind === "SOLO" ? "text-emerald-400" : "text-sky-400"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Pill tone={n.kind === "SOLO" ? "pass" : "info"} mono>
                            {n.kind}
                          </Pill>
                          <span className="truncate font-mono text-[10.5px] text-slate-500">{n.tender_id}</span>
                          {!n.read && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />}
                        </div>
                        <div className="mt-0.5 truncate text-xs font-medium text-slate-100">{n.title}</div>
                        <p className="mt-0.5 text-[11.5px] leading-snug text-slate-400">{n.message}</p>
                        <div className="mt-1 text-[10.5px] text-slate-600">{timeAgo(n.created_at)}</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
