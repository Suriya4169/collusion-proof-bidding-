"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  Network,
  RefreshCw,
  ShieldAlert,
  Upload,
  Download,
  RotateCcw,
  Plus,
  Trash2,
  X,
  CheckCircle,
  AlertTriangle,
  ZoomIn,
  Eye,
  Sliders,
} from "lucide-react";
import { apiRequest, apiUpload, errorMessage } from "@/lib/api";

const KIND_META: Record<string, { color: string; label: string }> = {
  bidder: { color: "#63b8e8", label: "Bidder" },
  director: { color: "#f0b45d", label: "Director / Owner" },
  ip: { color: "#9eb4b0", label: "IP fingerprint" },
  bank: { color: "#c9a1f2", label: "Routing code" },
  asset: { color: "#8ecf72", label: "Declared asset" },
};

interface Bidder {
  bidder_id: string;
  name: string;
  beneficial_owners: { name: string }[];
  submission_metadata: {
    ip_address?: string | null;
    bank_routing_code?: string | null;
  };
  declared_assets: string[];
}

interface MetaNode {
  id: string;
  kind: "director" | "ip" | "bank" | "asset";
  label: string;
  detail: string;
}

interface CartelSummary {
  cartel_detected: boolean;
  flagged_networks: { bidders: string[]; reason: string }[];
  anomaly_scores: Record<string, number>;
}

interface GraphData {
  bidders: { id: string; name: string }[];
  metadata: MetaNode[];
  bipartite: [string, string][];
  anomalyScores: Record<string, number>;
}

export default function CartelGraphPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "graph" | "input">("graph");
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [summary, setSummary] = useState<CartelSummary | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Graph state
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{ x: number; y: number; html: string } | null>(null);

  // Add Bidder Form
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newOwners, setNewOwners] = useState("");
  const [newIp, setNewIp] = useState("");
  const [newBank, setNewBank] = useState("");
  const [newAssets, setNewAssets] = useState("");
  const [formBusy, setFormBusy] = useState(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomResetRef = useRef<(() => void) | null>(null);

  // Tender-specific scoping state
  const [selectedTender, setSelectedTender] = useState<string>("GEM/2026/B/9292805");
  const [availableTenders, setAvailableTenders] = useState<string[]>([
    "GEM/2026/B/9292805",
    "T2001",
    "T2003",
    "ALL"
  ]);

  // Load all cartel data from API (scoped per tender)
  const loadData = useCallback(async (targetTender?: string) => {
    setLoading(true);
    setError(null);
    const tId = targetTender !== undefined ? targetTender : selectedTender;
    const query = tId && tId !== "ALL" ? `?tender_id=${encodeURIComponent(tId)}` : "";
    try {
      const [bRes, sRes, gRes] = await Promise.all([
        apiRequest<{ bidders: Bidder[]; count: number }>(`/api/cartel/bidders${query}`),
        apiRequest<CartelSummary>(`/api/cartel/analyze${query}`),
        apiRequest<GraphData>(`/api/cartel/graph-render${query}`),
      ]);
      setBidders(bRes.data.bidders);
      setSummary(sRes.data);
      setGraphData(gRes.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedTender]);

  useEffect(() => {
    loadData(selectedTender);
  }, [loadData, selectedTender]);

  // CSV Upload
  const handleUploadCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiUpload<any>("/api/cartel/upload-csv", formData);
      setNotice(res.data.message || `Loaded ${file.name} successfully.`);
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Sample CSV Download
  const handleDownloadSample = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/cartel/sample-csv");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bidders_cartel_sample.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download sample CSV template.");
    }
  };

  // Reset Dataset
  const handleReset = async (mode: "benchmark" | "clear") => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/api/cartel/reset?mode=${mode}`, { method: "POST" });
      setNotice(mode === "benchmark" ? "Reset to benchmark dataset (bidders.csv)." : "Active pool cleared.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Delete Bidder
  const handleDeleteBidder = async (bidderId: string) => {
    if (!confirm(`Disqualify & delete bidder '${bidderId}' from active analysis pool?`)) return;
    try {
      await apiRequest(`/api/cartel/bidders/${bidderId}`, { method: "DELETE" });
      setNotice(`Removed bidder ${bidderId}. Anomaly graph recomputed.`);
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // Add Bidder Submit
  const handleAddBidder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newName.trim()) return;
    setFormBusy(true);
    try {
      const payload = {
        bidder_id: newId.trim(),
        name: newName.trim(),
        beneficial_owners: newOwners
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((n) => ({ name: n })),
        submission_metadata: {
          ip_address: newIp.trim() || null,
          bank_routing_code: newBank.trim() || null,
        },
        declared_assets: newAssets
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      await apiRequest("/api/cartel/bidders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setNewId("");
      setNewName("");
      setNewOwners("");
      setNewIp("");
      setNewBank("");
      setNewAssets("");
      setNotice(`Added entity '${payload.name}'. Simulation recalculated.`);
      await loadData();
      setActiveTab("graph");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setFormBusy(false);
    }
  };

  // D3 Force Simulation Effect
  useEffect(() => {
    if (activeTab !== "graph" || !svgRef.current || !graphData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { bidders: rawBidders, metadata: rawMetadata, bipartite, anomalyScores } = graphData;

    // Node maps
    const nodeById = new Map<string, any>();
    rawBidders.forEach((b) => nodeById.set(b.id, { ...b, kind: "bidder" }));
    rawMetadata.forEach((m) => nodeById.set(m.id, { ...m }));

    // Structural bipartite links
    const structuralLinks = bipartite
      .filter(([bId, mId]) => nodeById.has(bId) && nodeById.has(mId))
      .map(([bidderId, metaId]) => ({
        source: bidderId,
        target: metaId,
        kind: nodeById.get(metaId)?.kind || "metadata",
      }));

    // Group bidders by metadata node
    const byMeta = new Map<string, string[]>();
    structuralLinks.forEach((l) => {
      const targetId = typeof l.target === "string" ? l.target : (l.target as any).id;
      const sourceId = typeof l.source === "string" ? l.source : (l.source as any).id;
      if (!byMeta.has(targetId)) byMeta.set(targetId, []);
      byMeta.get(targetId)!.push(sourceId);
    });

    // Compute pairwise collusion links
    const collusionMap = new Map<string, any>();
    const pairKey = (a: string, b: string) => [a, b].sort().join("|");

    byMeta.forEach((bidderIds, metaId) => {
      if (bidderIds.length < 2) return;
      const meta = nodeById.get(metaId);
      for (let i = 0; i < bidderIds.length; i++) {
        for (let j = i + 1; j < bidderIds.length; j++) {
          const key = pairKey(bidderIds[i], bidderIds[j]);
          if (!collusionMap.has(key)) {
            collusionMap.set(key, {
              source: bidderIds[i],
              target: bidderIds[j],
              kind: "collusion",
              via: [],
            });
          }
          collusionMap.get(key)!.via.push(meta);
        }
      }
    });

    const collusionLinks = Array.from(collusionMap.values());
    const flaggedBidderIds = new Set<string>();
    collusionLinks.forEach((l) => {
      flaggedBidderIds.add(typeof l.source === "string" ? l.source : l.source.id);
      flaggedBidderIds.add(typeof l.target === "string" ? l.target : l.target.id);
    });

    const flaggedMetaIds = new Set<string>();
    byMeta.forEach((bIds, metaId) => {
      if (bIds.length >= 2) flaggedMetaIds.add(metaId);
    });

    // Filter nodes if flaggedOnly toggle is active
    let activeNodes = Array.from(nodeById.values());
    let activeLinks = structuralLinks.concat(collusionLinks);

    if (flaggedOnly) {
      activeNodes = activeNodes.filter(
        (n) => flaggedBidderIds.has(n.id) || flaggedMetaIds.has(n.id)
      );
      const activeIds = new Set(activeNodes.map((n) => n.id));
      activeLinks = activeLinks.filter((l: any) => {
        const s = l.source?.id !== undefined ? l.source.id : l.source;
        const t = l.target?.id !== undefined ? l.target.id : l.target;
        return activeIds.has(s) && activeIds.has(t);
      });
    }

    // Glow filter definitions
    const defs = svg.append("defs");
    const glow = defs
      .append("filter")
      .attr("id", "glowRed")
      .attr("x", "-60%")
      .attr("y", "-60%")
      .attr("width", "220%")
      .attr("height", "220%");
    glow.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", 4.5).attr("result", "blur");
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    // Container groups for zooming
    const zoomLayer = svg.append("g").attr("class", "zoomLayer");
    const linkLayer = zoomLayer.append("g").attr("class", "link-layer");
    const collusionLayer = zoomLayer.append("g").attr("class", "collusion-layer");
    const nodeLayer = zoomLayer.append("g").attr("class", "node-layer");
    const labelLayer = zoomLayer.append("g").attr("class", "label-layer");

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => zoomLayer.attr("transform", event.transform));

    svg.call(zoomBehavior);

    if (activeNodes.length === 0) {
      zoomLayer
        .append("text")
        .attr("x", 0)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("fill", "rgba(255, 255, 255, 0.6)")
        .attr("font-size", "15px")
        .attr("font-weight", "500")
        .text("No bidding entities currently registered in active pool");

      zoomLayer
        .append("text")
        .attr("x", 0)
        .attr("y", 18)
        .attr("text-anchor", "middle")
        .attr("fill", "rgba(148, 163, 255, 0.45)")
        .attr("font-size", "12px")
        .text("System standing by for online GeM submissions · True network IP telemetry active");
      return;
    }

    const radiusFor = (d: any) => (d.kind === "bidder" ? 18 : 10);
    const colorFor = (d: any) => KIND_META[d.kind]?.color || "#888";

    // Structural links
    const linkSel = linkLayer
      .selectAll<SVGLineElement, any>("line")
      .data(activeLinks.filter((l) => l.kind !== "collusion"))
      .join("line")
      .attr("stroke", "rgba(148, 163, 255, 0.25)")
      .attr("stroke-width", 1.4);

    // Collusion links (glowing red)
    const collusionSel = collusionLayer
      .selectAll<SVGLineElement, any>("line")
      .data(activeLinks.filter((l) => l.kind === "collusion"))
      .join("line")
      .attr("stroke", "#ef6d78")
      .attr("stroke-width", 2.4)
      .attr("stroke-dasharray", "4,2")
      .style("cursor", "pointer")
      .on("mouseenter", (event, d: any) => {
        const s = d.source?.id !== undefined ? d.source.id : d.source;
        const t = d.target?.id !== undefined ? d.target.id : d.target;
        highlightNeighborhood(new Set([s, t]), new Set([d]));
        const reasons = (d.via || []).map((m: any) => `${s} ↔ ${t} share ${m.label} (${KIND_META[m.kind]?.label || m.kind})`).join("<br/>");
        setHoverTooltip({
          x: event.clientX,
          y: event.clientY,
          html: `<strong>Collusion Link</strong><br/>${reasons}`,
        });
      })
      .on("mouseleave", () => {
        clearHighlight();
        setHoverTooltip(null);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedEntity(null);
        setSelectedEdge(d);
      });

    // Force simulation
    const simulation = d3
      .forceSimulation(activeNodes)
      .force(
        "link",
        d3
          .forceLink(activeLinks)
          .id((d: any) => d.id)
          .distance((l: any) => (l.kind === "collusion" ? 110 : 160))
          .strength((l: any) => (l.kind === "collusion" ? 0.8 : 0.35))
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("collide", d3.forceCollide().radius((d: any) => radiusFor(d) + 14))
      .force("center", d3.forceCenter(0, 0))
      .force("x", d3.forceX(0).strength(0.05))
      .force("y", d3.forceY(0).strength(0.05));

    // Drag behavior
    const drag = d3
      .drag<SVGGElement, any>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // Node groups
    const nodeG = nodeLayer
      .selectAll<SVGGElement, any>("g.node")
      .data(activeNodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(drag)
      .on("mouseenter", (event, d) => {
        const { ids, links } = getNeighbors(d.id);
        highlightNeighborhood(ids, links);

        const score = anomalyScores[d.id] ?? 0;
        const isFlagged = flaggedBidderIds.has(d.id);
        const sharedCount = (byMeta.get(d.id) || []).length;

        let tooltipHtml = "";
        if (d.kind === "bidder") {
          tooltipHtml = `<strong>${d.name}</strong> (${d.id})<br/>Anomaly Score: <strong>${score.toFixed(
            2
          )}</strong><br/>${isFlagged ? "⚠️ Collusion Network Member" : "✅ Clean Bidder"}`;
        } else {
          tooltipHtml = `<strong>${d.label}</strong><br/>Type: ${KIND_META[d.kind]?.label || d.kind}${
            sharedCount > 1 ? `<br/>⚠️ Shared across ${sharedCount} competitors` : ""
          }`;
        }

        setHoverTooltip({ x: event.clientX, y: event.clientY, html: tooltipHtml });
      })
      .on("mouseleave", () => {
        clearHighlight();
        setHoverTooltip(null);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedEdge(null);
        setSelectedEntity({
          ...d,
          score: anomalyScores[d.id] ?? 0,
          isFlagged: flaggedBidderIds.has(d.id),
          sharedBidders: byMeta.get(d.id) || [],
          myMeta: structuralLinks
            .filter((l: any) => (l.source?.id !== undefined ? l.source.id : l.source) === d.id)
            .map((l: any) => nodeById.get(l.target?.id !== undefined ? l.target.id : l.target)),
          myCollusions: collusionLinks.filter((l: any) => {
            const s = l.source?.id !== undefined ? l.source.id : l.source;
            const t = l.target?.id !== undefined ? l.target.id : l.target;
            return s === d.id || t === d.id;
          }),
        });
      });

    nodeG
      .append("circle")
      .attr("r", radiusFor)
      .attr("fill", colorFor)
      .attr("stroke", (d: any) => (flaggedBidderIds.has(d.id) ? "#ef6d78" : "rgba(255,255,255,0.4)"))
      .attr("stroke-width", (d: any) => (flaggedBidderIds.has(d.id) ? 2.5 : 1))
      .attr("filter", (d: any) => (flaggedBidderIds.has(d.id) ? "url(#glowRed)" : null));

    // Node Labels
    const labelSel = labelLayer
      .selectAll<SVGTextElement, any>("text")
      .data(activeNodes)
      .join("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d: any) => radiusFor(d) + 12)
      .attr("fill", "#b9c9c4")
      .attr("font-size", "10px")
      .attr("pointer-events", "none")
      .text((d: any) => (d.kind === "bidder" ? d.id : d.label.length > 15 ? d.label.slice(0, 14) + "…" : d.label));

    // Neighborhood helper
    function getNeighbors(nodeId: string) {
      const ids = new Set([nodeId]);
      const links = new Set<any>();
      activeLinks.forEach((l: any) => {
        const s = l.source?.id !== undefined ? l.source.id : l.source;
        const t = l.target?.id !== undefined ? l.target.id : l.target;
        if (s === nodeId || t === nodeId) {
          ids.add(s);
          ids.add(t);
          links.add(l);
        }
      });
      return { ids, links };
    }

    function highlightNeighborhood(ids: Set<string>, links: Set<any>) {
      nodeG.style("opacity", (d: any) => (ids.has(d.id) ? 1 : 0.12));
      labelSel.style("opacity", (d: any) => (ids.has(d.id) ? 1 : 0.12));
      linkSel
        .style("opacity", (l: any) => (links.has(l) ? 1 : 0.08))
        .attr("stroke", (l: any) => (links.has(l) ? "#70e0cf" : "rgba(148, 163, 255, 0.25)"));
      collusionSel.style("opacity", (l: any) => (links.has(l) ? 1 : 0.08));
    }

    function clearHighlight() {
      nodeG.style("opacity", 1);
      labelSel.style("opacity", 1);
      linkSel.style("opacity", 1).attr("stroke", "rgba(148, 163, 255, 0.25)");
      collusionSel.style("opacity", 1);
    }

    // Tick update
    simulation.on("tick", () => {
      linkSel
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      collusionSel
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeG.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      labelSel.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    // Zoom to fit function
    const zoomToFit = () => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height || activeNodes.length === 0) return;
      const xs = activeNodes.map((d: any) => d.x || 0);
      const ys = activeNodes.map((d: any) => d.y || 0);
      const minX = Math.min(...xs),
        maxX = Math.max(...xs);
      const minY = Math.min(...ys),
        maxY = Math.max(...ys);
      const spanX = maxX - minX + 120;
      const spanY = maxY - minY + 120;
      const scale = Math.max(0.35, Math.min(2.5, Math.min(rect.width / spanX, rect.height / spanY)));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      svg
        .transition()
        .duration(600)
        .call(
          zoomBehavior.transform,
          d3.zoomIdentity.translate(rect.width / 2, rect.height / 2).scale(scale).translate(-cx, -cy)
        );
    };

    zoomResetRef.current = zoomToFit;
    simulation.on("end", zoomToFit);

    // Initial center transform
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width && rect.height) {
      svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(rect.width / 2, rect.height / 2).scale(0.8));
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graphData, activeTab, flaggedOnly]);

  const flaggedBidderCount = summary
    ? Object.values(summary.anomaly_scores).filter((s) => s >= 0.35).length
    : 0;
  const meanAnomaly = summary && Object.keys(summary.anomaly_scores).length > 0
    ? Object.values(summary.anomaly_scores).reduce((a, b) => a + b, 0) / Object.keys(summary.anomaly_scores).length
    : 0;

  return (
    <div className="min-h-screen bg-[#070914] text-[#f3f5ff] flex flex-col font-sans">
      {/* Top Header Rail */}
      <header className="border-b border-[#94a3ff]/20 bg-[#0c1030]/80 backdrop-blur-md px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#4fd7ff] to-[#7c6bff] flex items-center justify-center font-bold text-black text-lg shadow-lg shadow-[#7c6bff]/30">
            Æ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-widest text-sm text-white">AEGIS</span>
              <span className="text-[11px] rounded bg-[#7c6bff]/20 px-1.5 py-0.5 text-[#7c6bff] border border-[#7c6bff]/40 font-mono">
                Agent 2C · Collusion Graph
              </span>
            </div>
            <p className="text-[11px] text-[#7d84b8]">Bipartite Force-Directed Collusion Intelligence</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-[#070914]/80 p-1 rounded-xl border border-[#94a3ff]/20 text-xs font-medium">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "overview"
                ? "bg-[#7c6bff] text-white shadow-md shadow-[#7c6bff]/30"
                : "text-[#b9beed] hover:text-white"
            }`}
          >
            01 Bid Overview
          </button>
          <button
            onClick={() => setActiveTab("graph")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "graph"
                ? "bg-[#7c6bff] text-white shadow-md shadow-[#7c6bff]/30"
                : "text-[#b9beed] hover:text-white"
            }`}
          >
            02 Cartel Graph
            {flaggedBidderCount > 0 && (
              <span className="rounded-full bg-[#ef6d78] px-1.5 py-0.2 text-[10px] font-bold text-white">
                {flaggedBidderCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("input")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "input"
                ? "bg-[#7c6bff] text-white shadow-md shadow-[#7c6bff]/30"
                : "text-[#b9beed] hover:text-white"
            }`}
          >
            03 Add Bidder & CSV
          </button>
        </div>

        {/* Tender Scope Selector */}
        <div className="flex items-center gap-2 bg-[#070914]/90 px-3 py-1.5 rounded-xl border border-[#7c6bff]/40">
          <span className="text-[11px] font-mono text-[#b9beed] uppercase font-semibold">Tender Scope:</span>
          <select
            value={selectedTender}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedTender(val);
              loadData(val);
            }}
            className="bg-[#0c1030] border border-[#94a3ff]/30 text-xs font-mono text-white rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#7c6bff]"
          >
            <option value="GEM/2026/B/9292805">GEM/2026/B/9292805 (Aerospace CNC)</option>
            <option value="T2001">T2001 (Cloud Infrastructure)</option>
            <option value="T2003">T2003 (Heavy Machinery)</option>
            <option value="ALL">🌐 All Tenders (Global Network)</option>
          </select>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleUploadCsv} accept=".csv" className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-[#4fd7ff]/40 bg-[#4fd7ff]/10 px-3 py-1.5 text-xs text-[#4fd7ff] hover:bg-[#4fd7ff]/20 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload CSV
          </button>
          <button
            onClick={handleDownloadSample}
            className="flex items-center gap-1.5 rounded-lg border border-[#94a3ff]/30 px-3 py-1.5 text-xs text-[#b9beed] hover:bg-white/5 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Sample CSV
          </button>
          <button
            onClick={() => handleReset("benchmark")}
            disabled={loading}
            title="Reset to benchmark bidders.csv"
            className="flex items-center gap-1.5 rounded-lg border border-[#94a3ff]/30 px-3 py-1.5 text-xs text-[#b9beed] hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-[#7c6bff] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#6a57ff] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Re-evaluate
          </button>
        </div>
      </header>

      {notice && (
        <div className="bg-[#4ee6a0]/15 border-b border-[#4ee6a0]/30 px-6 py-2 text-xs text-[#7cf0bb] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[#7cf0bb]" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-[#7cf0bb] hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-[#ff4d5e]/15 border-b border-[#ff4d5e]/30 px-6 py-2 text-xs text-[#ff8f9a] flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#ff4d5e]" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Body */}
      <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
        {/* TAB 1: BID OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-mono text-[#7d84b8] uppercase tracking-wider">
                GFR 2017 Rule 173(xvi) &middot; Competition Act 2002 § 3(3)(d)
              </p>
              <h1 className="text-2xl font-bold text-white mt-1">Bid Integrity & Collusion Overview</h1>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-[#94a3ff]/20 bg-[#0c1030]/60 p-5 backdrop-blur-sm">
                <span className="text-xs font-medium text-[#7d84b8]">Bidders Evaluated</span>
                <div className="text-3xl font-bold text-white mt-2">{bidders.length}</div>
                <span className="text-[11px] text-[#b9beed] mt-1 block">Active procurement entities</span>
              </div>
              <div className="rounded-xl border border-[#ef6d78]/40 bg-[#ef6d78]/10 p-5 backdrop-blur-sm">
                <span className="text-xs font-medium text-[#ef6d78]">Flagged Collusion Networks</span>
                <div className="text-3xl font-bold text-[#ef6d78] mt-2">
                  {summary ? summary.flagged_networks.length : 0}
                </div>
                <span className="text-[11px] text-[#ff8f9a] mt-1 block">Independent sub-clusters</span>
              </div>
              <div className="rounded-xl border border-[#ef6d78]/40 bg-[#ef6d78]/10 p-5 backdrop-blur-sm">
                <span className="text-xs font-medium text-[#ef6d78]">Bidders Under Suspicion</span>
                <div className="text-3xl font-bold text-[#ef6d78] mt-2">{flaggedBidderCount}</div>
                <span className="text-[11px] text-[#ff8f9a] mt-1 block">High anomaly score (≥ 0.35)</span>
              </div>
              <div className="rounded-xl border border-[#94a3ff]/20 bg-[#0c1030]/60 p-5 backdrop-blur-sm">
                <span className="text-xs font-medium text-[#7d84b8]">Mean Anomaly Score</span>
                <div className="text-3xl font-bold text-[#4fd7ff] mt-2">{meanAnomaly.toFixed(2)}</div>
                <span className="text-[11px] text-[#b9beed] mt-1 block">Scale 0.00 – 1.00</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#94a3ff]/20 bg-[#0c1030]/40 p-6 backdrop-blur-md leading-relaxed text-sm text-[#b9beed] space-y-3">
              <p>
                The <strong>NetworkX Bipartite Collusion Agent</strong> has processed submission metadata across all{" "}
                <strong className="text-white">{bidders.length} bidders</strong> — tracking beneficial owners, submission IP
                addresses, settlement bank routing codes, and declared asset machinery serials.
              </p>
              <p>
                It identified{" "}
                <strong className="text-[#ef6d78]">
                  {summary ? summary.flagged_networks.length : 0} collusion clusters
                </strong>{" "}
                where supposedly independent bidders share physical or legal infrastructure. Open the{" "}
                <button onClick={() => setActiveTab("graph")} className="text-[#4fd7ff] underline hover:text-white font-medium">
                  Cartel Graph tab
                </button>{" "}
                to interact with the force-directed physics graph and inspect connected nodes.
              </p>
            </div>

            {/* Collusion alerts table */}
            {summary && summary.flagged_networks.length > 0 && (
              <div className="rounded-xl border border-[#94a3ff]/20 bg-[#0c1030]/60 p-5">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[#ef6d78]" />
                  Active Collusion Alerts
                </h3>
                <div className="space-y-3">
                  {summary.flagged_networks.map((net, i) => (
                    <div key={i} className="rounded-lg border border-[#ef6d78]/30 bg-[#ef6d78]/10 p-3.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#ef6d78] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                          CLUSTER {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-semibold text-white">{net.bidders.join("  ·  ")}</span>
                      </div>
                      <p className="mt-1.5 text-[#b9beed] leading-relaxed">
                        <strong className="text-slate-200">Evidence: </strong>
                        {net.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CARTEL GRAPH (D3 Force Simulation) */}
        {activeTab === "graph" && (
          <div className="space-y-4">
            {/* Graph Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c1030]/80 p-3.5 rounded-xl border border-[#94a3ff]/20 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 text-[#b9beed]">
                  <span className="h-3 w-3 rounded-full bg-[#63b8e8]" />
                  Bidder
                </span>
                <span className="flex items-center gap-1.5 text-[#b9beed]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f0b45d]" />
                  Director / Owner
                </span>
                <span className="flex items-center gap-1.5 text-[#b9beed]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#9eb4b0]" />
                  IP Fingerprint
                </span>
                <span className="flex items-center gap-1.5 text-[#b9beed]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#c9a1f2]" />
                  Bank Routing
                </span>
                <span className="flex items-center gap-1.5 text-[#b9beed]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#8ecf72]" />
                  Declared Asset
                </span>
                <span className="flex items-center gap-1.5 text-[#ef6d78] font-semibold">
                  <span className="h-0.5 w-4 bg-[#ef6d78]" />
                  Collusion Link (Pulsing)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-[#b9beed] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flaggedOnly}
                    onChange={(e) => setFlaggedOnly(e.target.checked)}
                    className="accent-[#7c6bff] cursor-pointer"
                  />
                  Flagged connections only
                </label>
                <button
                  onClick={() => zoomResetRef.current?.()}
                  className="flex items-center gap-1 rounded border border-[#94a3ff]/30 px-2.5 py-1 text-xs text-[#b9beed] hover:bg-white/5"
                >
                  <ZoomIn className="h-3 w-3" />
                  Reset View
                </button>
              </div>
            </div>

            {/* D3 Simulation Canvas + Inspector Drawer */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[720px]">
              {/* Canvas Card */}
              <div className="lg:col-span-3 rounded-xl border border-[#94a3ff]/20 bg-[#070914] relative overflow-hidden flex flex-col">
                <div className="absolute top-3 left-4 z-10 text-[11px] text-[#7d84b8] font-mono pointer-events-none bg-[#070914]/80 px-2 py-1 rounded border border-white/5">
                  Tip: Drag nodes with physics &middot; Mousewheel to zoom &middot; Click node or red line to inspect
                </div>
                <svg ref={svgRef} className="w-full h-full flex-1" />

                {/* Floating hover tooltip */}
                {hoverTooltip && (
                  <div
                    className="fixed z-50 pointer-events-none rounded-lg border border-[#94a3ff]/40 bg-[#0c1030]/95 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-md max-w-xs leading-relaxed"
                    style={{ left: hoverTooltip.x + 16, top: hoverTooltip.y + 16 }}
                    dangerouslySetInnerHTML={{ __html: hoverTooltip.html }}
                  />
                )}
              </div>

              {/* Inspector Drawer */}
              <aside className="rounded-xl border border-[#94a3ff]/20 bg-[#0c1030]/80 p-5 backdrop-blur-md overflow-y-auto flex flex-col justify-between">
                {!selectedEntity && !selectedEdge && (
                  <div className="my-auto text-center py-12 text-[#7d84b8] text-xs space-y-2">
                    <div className="text-3xl text-[#7d84b8]">◎</div>
                    <p className="font-medium text-slate-300">Inspector Console</p>
                    <p>Select any bidder, director, IP, bank routing code, or red collusion line to inspect evidence.</p>
                  </div>
                )}

                {/* Selected Node Details */}
                {selectedEntity && (
                  <div className="space-y-4 text-xs">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase text-[#7d84b8]">
                          {selectedEntity.kind === "bidder" ? "Bidder Entity" : "Infrastructure Node"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            selectedEntity.isFlagged || (selectedEntity.sharedBidders?.length > 1)
                              ? "bg-[#ef6d78]/20 text-[#ff8f9a] border border-[#ef6d78]/40"
                              : "bg-[#4ee6a0]/20 text-[#7cf0bb] border border-[#4ee6a0]/40"
                          }`}
                        >
                          {selectedEntity.isFlagged || (selectedEntity.sharedBidders?.length > 1)
                            ? "Flagged"
                            : "Clear"}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-white mt-1">
                        {selectedEntity.name || selectedEntity.label}
                      </h2>
                      <p className="font-mono text-[11px] text-[#4fd7ff]">{selectedEntity.id}</p>
                    </div>

                    {/* Anomaly Gauge for Bidder */}
                    {selectedEntity.kind === "bidder" && (
                      <div className="rounded-lg border border-[#94a3ff]/20 bg-white/5 p-3 space-y-1.5">
                        <div className="flex justify-between text-[11px] font-medium">
                          <span className="text-[#7d84b8]">Anomaly Score (A_i)</span>
                          <span className="font-mono text-white font-bold">
                            {selectedEntity.score.toFixed(2)} / 1.00
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#4fd7ff] via-[#f0b45d] to-[#ef6d78]"
                            style={{ width: `${Math.round(selectedEntity.score * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Collusion Indicators */}
                    {selectedEntity.kind === "bidder" && (
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#7d84b8] mb-2">
                          Collusion Rings Detected
                        </h4>
                        {selectedEntity.myCollusions?.length > 0 ? (
                          <div className="space-y-2">
                            {selectedEntity.myCollusions.map((l: any, i: number) => {
                              const s = typeof l.source === "object" ? l.source.id : l.source;
                              const t = typeof l.target === "object" ? l.target.id : l.target;
                              const other = s === selectedEntity.id ? t : s;
                              const reasons = l.via
                                .map((m: any) => `${m.label} (${KIND_META[m.kind]?.label || m.kind})`)
                                .join("; ");
                              return (
                                <div
                                  key={i}
                                  className="rounded border border-[#ef6d78]/40 bg-[#ef6d78]/10 p-2.5 text-[11px]"
                                >
                                  <div className="font-semibold text-white">
                                    {selectedEntity.id} ↔ {other}
                                  </div>
                                  <div className="text-[#ff8f9a] mt-1">{reasons}</div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[#7d84b8]">No shared metadata detected with other bidders.</p>
                        )}
                      </div>
                    )}

                    {/* Shared Infrastructure Hubs */}
                    {selectedEntity.kind !== "bidder" && (
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#7d84b8] mb-2">
                          Linked Competitors ({selectedEntity.sharedBidders?.length || 0})
                        </h4>
                        <div className="space-y-1.5">
                          {selectedEntity.sharedBidders?.map((bId: string) => (
                            <div
                              key={bId}
                              className="rounded border border-[#94a3ff]/20 bg-white/5 px-2.5 py-1.5 font-mono text-[#b9beed] flex items-center justify-between"
                            >
                              <span>{bId}</span>
                              <span className="text-[10px] text-[#4fd7ff]">Competitor</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Declared Metadata */}
                    {selectedEntity.kind === "bidder" && selectedEntity.myMeta?.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#7d84b8] mb-2">
                          Declared Submissions
                        </h4>
                        <div className="space-y-1">
                          {selectedEntity.myMeta.map((m: any, i: number) => (
                            <div
                              key={i}
                              className="rounded bg-white/5 px-2.5 py-1.5 flex items-center justify-between text-[11px]"
                            >
                              <span className="text-white font-mono">{m.label}</span>
                              <span className="text-[#7d84b8] text-[10px]">
                                {KIND_META[m.kind]?.label || m.kind}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Collusion Link Details */}
                {selectedEdge && (
                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="rounded bg-[#ef6d78] px-2 py-0.5 text-[10px] font-bold text-white">
                        COLLUSION EDGE
                      </span>
                      <h2 className="text-base font-bold text-white mt-2">
                        {typeof selectedEdge.source === "object" ? selectedEdge.source.id : selectedEdge.source} ↔{" "}
                        {typeof selectedEdge.target === "object" ? selectedEdge.target.id : selectedEdge.target}
                      </h2>
                    </div>

                    <div className="rounded border border-[#ef6d78]/40 bg-[#ef6d78]/10 p-3 text-xs text-[#ff8f9a] space-y-1.5">
                      <p className="font-semibold text-white">Shared Infrastructure Points:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        {selectedEdge.via?.map((m: any, i: number) => (
                          <li key={i}>
                            <strong>{m.label}</strong> — {KIND_META[m.kind]?.label || m.kind}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <p className="text-[#7d84b8] text-[11px] leading-relaxed">
                      Statutory violation under Competition Act 2002 Section 3(3)(d). Bids sharing identical beneficial
                      ownership or physical networks cannot be treated as arms-length competitive tenders.
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-[#94a3ff]/20 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedEntity(null);
                      setSelectedEdge(null);
                    }}
                    className="text-xs text-[#7d84b8] hover:text-white"
                  >
                    Clear selection
                  </button>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* TAB 3: ADD BIDDER & CSV MANAGEMENT */}
        {activeTab === "input" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="rounded-xl border border-[#94a3ff]/20 bg-[#0c1030]/60 p-6 backdrop-blur-md">
              <h2 className="text-lg font-bold text-white mb-1">Add or Update Bidding Entity</h2>
              <p className="text-xs text-[#7d84b8] mb-4">
                Saves directly to <code>bidders.csv</code> and updates active network analysis in real-time.
              </p>

              <form onSubmit={handleAddBidder} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Bidder ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B009"
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-[#070914] px-3 py-2 text-slate-100 placeholder-slate-600 focus:border-[#7c6bff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Company / Enterprise Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Skyline Construction Pvt Ltd"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-[#070914] px-3 py-2 text-slate-100 placeholder-slate-600 focus:border-[#7c6bff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Beneficial Owners / Directors (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Doe, Rajesh Sharma"
                    value={newOwners}
                    onChange={(e) => setNewOwners(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-[#070914] px-3 py-2 text-slate-100 placeholder-slate-600 focus:border-[#7c6bff] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Submission IP Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 203.0.113.5"
                      value={newIp}
                      onChange={(e) => setNewIp(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-[#070914] px-3 py-2 font-mono text-slate-100 placeholder-slate-600 focus:border-[#7c6bff] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Bank Routing / IFSC Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 021000021"
                      value={newBank}
                      onChange={(e) => setNewBank(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-[#070914] px-3 py-2 font-mono text-slate-100 placeholder-slate-600 focus:border-[#7c6bff] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Declared Assets / Machinery Serials (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ASSET-1001, ASSET-9999"
                    value={newAssets}
                    onChange={(e) => setNewAssets(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-[#070914] px-3 py-2 font-mono text-slate-100 placeholder-slate-600 focus:border-[#7c6bff] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={formBusy}
                  className="w-full rounded bg-[#7c6bff] py-2.5 font-bold text-white hover:bg-[#6a57ff] transition-colors disabled:opacity-50"
                >
                  {formBusy ? "Saving Bidder…" : "Save Bidder & Re-simulate"}
                </button>
              </form>
            </div>

            {/* Active Bidders Roster */}
            <div className="rounded-xl border border-[#94a3ff]/20 bg-[#0c1030]/60 p-6 backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">Active Bidder Roster</h2>
                    <p className="text-xs text-[#7d84b8]">{bidders.length} entities in database</p>
                  </div>
                  <button
                    onClick={() => handleReset("clear")}
                    className="text-xs text-[#ef6d78] hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                  {bidders.map((b) => (
                    <div key={b.bidder_id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#4fd7ff]">{b.bidder_id}</span>
                          <span className="font-semibold text-white">{b.name}</span>
                        </div>
                        <div className="text-[11px] text-[#7d84b8] mt-0.5">
                          Owners: {b.beneficial_owners.map((o) => o.name).join(", ") || "None"} &middot; IP:{" "}
                          {b.submission_metadata.ip_address || "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteBidder(b.bidder_id)}
                        className="rounded p-1 text-[#7d84b8] hover:text-[#ef6d78] hover:bg-[#ef6d78]/10"
                        title="Delete bidder"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
