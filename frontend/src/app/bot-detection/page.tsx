"use client";

import { useState, useRef } from "react";

interface Deviation {
  feature: string;
  z: number;
}

interface BehaviorResponse {
  session_id: string;
  status: string;
  scoring_mode: string;
  behavioral_risk_score?: number;
  risk_category?: string;
  behavioral_anomaly?: boolean;
  reliability?: string;
  events_received: number;
  events_scored: number;
  behavioral_evidence: string[];
  model_version: string;
  message?: string;
}

export default function BotDetectionPage() {
  const [inputText, setInputText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<BehaviorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Timing tracking refs
  const keyPressTimestamps = useRef<number[]>([]);
  const intervals = useRef<number[]>([]);
  const holdDurations = useRef<number[]>([]);
  const lastReleaseTime = useRef<number | null>(null);
  const keyDownMap = useRef<Record<string, number>>({});

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const now = performance.now();
    if (!keyDownMap.current[e.code]) {
      keyDownMap.current[e.code] = now;
    }

    if (lastReleaseTime.current !== null) {
      const flight = Math.max(0, now - lastReleaseTime.current);
      intervals.current.push(Number(flight.toFixed(2)));
    } else {
      // First onset latency
      intervals.current.push(100.0);
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const now = performance.now();
    lastReleaseTime.current = now;

    const start = keyDownMap.current[e.code];
    if (start) {
      const hold = Math.max(1, now - start);
      holdDurations.current.push(Number(hold.toFixed(2)));
      delete keyDownMap.current[e.code];
    }
  };

  const resetCapture = () => {
    setInputText("");
    intervals.current = [];
    holdDurations.current = [];
    lastReleaseTime.current = null;
    keyDownMap.current = {};
    setResult(null);
    setError(null);
  };

  const analyzeTyping = async (
    customIntervals?: number[],
    customHolds?: number[]
  ) => {
    setAnalyzing(true);
    setError(null);

    const payloadIntervals = customIntervals || intervals.current;
    const payloadHolds = customHolds || holdDurations.current;

    if (payloadIntervals.length < 5) {
      setError("Please type at least 15-20 characters to generate sufficient telemetry events.");
      setAnalyzing(false);
      return;
    }

    // Align lengths if needed
    const count = Math.min(payloadIntervals.length, payloadHolds.length);
    const trimmedIntervals = payloadIntervals.slice(0, count);
    const trimmedHolds = payloadHolds.slice(0, count);

    try {
      const response = await fetch("http://localhost:8000/api/behavior/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: `bid-session-${Date.now()}`,
          intervals: trimmedIntervals,
          hold_durations: trimmedHolds,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to Behavioral Biometrics service.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Bot Simulator: Instantaneous automated keystrokes with zero human latency
  const simulateBotAttack = () => {
    resetCapture();
    setInputText("AUTOMATED_BID_BOT_DIRECT_INJECTION_RATE_INR_4800000");
    // Synthetic robotic timing: exactly 12ms intervals and 8ms holds
    const botIntervals = Array(45).fill(12.0);
    const botHolds = Array(45).fill(8.0);
    analyzeTyping(botIntervals, botHolds);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                Agent 4 Intelligence
              </span>
              <span className="text-xs text-slate-400">Keystroke Flight & Hold Dynamics</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Behavioral Biometrics & Bot Detection
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Analyzes micro-timing rhythms of bid submissions to differentiate authentic human bidders from automated script bots without inspecting typed content.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={simulateBotAttack}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/40 font-medium rounded-lg text-sm transition-all"
            >
              Simulate Script Bot
            </button>
            <button
              onClick={resetCapture}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-sm transition-all"
            >
              Reset
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-rose-300 text-sm">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        {/* Live Typing Interactive Console */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Live Typing Sandbox</h2>
            <span className="text-xs font-mono text-slate-400">
              Captured Keystrokes: {intervals.current.length}
            </span>
          </div>

          <textarea
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            placeholder="Type your bid declaration here naturally (e.g., 'We hereby confirm compliance with all technical specifications for Tender GeM-2026-9292805')..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
          />

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              Captures release-to-press flight times and key-down durations. No private credentials or passwords are logged.
            </p>
            <button
              onClick={() => analyzeTyping()}
              disabled={analyzing}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm shadow-lg shadow-cyan-900/30 transition-all"
            >
              {analyzing ? "Auditing Timing..." : "Evaluate Biometric Authenticity"}
            </button>
          </div>
        </div>

        {/* Audit Results Card */}
        {result && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono text-slate-400">Session: {result.session_id}</span>
                <h3 className="text-xl font-bold text-white mt-1">Biometric Audit Report</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">Model: {result.model_version}</span>
                <span className={`px-3 py-1 text-xs font-bold font-mono rounded-full uppercase ${
                  result.risk_category === "HIGH_ANOMALY"
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                    : result.risk_category === "MODERATE_ANOMALY"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                }`}>
                  {result.risk_category || "SCORED"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <span className="text-xs text-slate-400 font-semibold uppercase">Behavioral Risk Score</span>
                <div className={`text-4xl font-extrabold mt-2 ${
                  (result.behavioral_risk_score ?? 0) >= 75
                    ? "text-rose-400"
                    : (result.behavioral_risk_score ?? 0) >= 50
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}>
                  {result.behavioral_risk_score !== undefined
                    ? `${result.behavioral_risk_score.toFixed(1)} / 100`
                    : "N/A"}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {(result.behavioral_risk_score ?? 0) >= 50 ? "Flagged for human audit" : "Within genuine human band"}
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <span className="text-xs text-slate-400 font-semibold uppercase">Reliability Index</span>
                <div className="text-4xl font-extrabold text-cyan-400 mt-2 capitalize">
                  {result.reliability || "Medium"}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Based on {result.events_scored} scored timing events
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <span className="text-xs text-slate-400 font-semibold uppercase">Scoring Mode</span>
                <div className="text-4xl font-extrabold text-purple-400 mt-2 uppercase">
                  {result.scoring_mode}
                </div>
                <p className="text-xs text-slate-500 mt-1">Dual flight + hold duration</p>
              </div>
            </div>

            {/* Explainable Evidence */}
            {result.behavioral_evidence && result.behavioral_evidence.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                  Audit Telemetry Evidence
                </h4>
                <ul className="space-y-2">
                  {result.behavioral_evidence.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-300 bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
