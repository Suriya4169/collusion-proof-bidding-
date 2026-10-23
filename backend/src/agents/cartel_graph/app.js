/* =========================================================
   AEGIS — Cartel Graph
   Force-directed bipartite network: bidders + shared metadata
   (directors, IP fingerprints, settlement routing codes).
========================================================= */

(function () {
  "use strict";

  // Only the metadata catalog stays hardcoded for the demo.
  // Bidders, graph edges, and anomaly scores come from the FastAPI backend.
  const staticMetadataCatalog = [
    { id: "DIR_JD", kind: "director", label: "Jane Doe", detail: "Beneficial owner / director" },
    { id: "DIR_JS", kind: "director", label: "John Silva", detail: "Beneficial owner / director" },
    { id: "DIR_RK", kind: "director", label: "Raj Kapoor", detail: "Beneficial owner / director" },
    { id: "DIR_ML", kind: "director", label: "Maria Lopez", detail: "Beneficial owner / director" },
    { id: "DIR_TW", kind: "director", label: "Tom Wu", detail: "Beneficial owner / director" },
    { id: "DIR_SA", kind: "director", label: "Sara Ahn", detail: "Beneficial owner / director" },

    { id: "IP1", kind: "ip", label: "203.0.113.5", detail: "Submission network fingerprint" },
    { id: "IP2", kind: "ip", label: "198.51.100.22", detail: "Submission network fingerprint" },
    { id: "IP3", kind: "ip", label: "198.51.100.77", detail: "Submission network fingerprint" },
    { id: "IP4", kind: "ip", label: "192.0.2.14", detail: "Submission network fingerprint" },
    { id: "IP5", kind: "ip", label: "192.0.2.91", detail: "Submission network fingerprint" },

    { id: "RTG1", kind: "bank", label: "021000021", detail: "Settlement routing code" },
    { id: "RTG2", kind: "bank", label: "011401533", detail: "Settlement routing code" },
    { id: "RTG3", kind: "bank", label: "071000013", detail: "Settlement routing code" },
    { id: "RTG4", kind: "bank", label: "065400137", detail: "Settlement routing code" },
    { id: "RTG5", kind: "bank", label: "091000019", detail: "Settlement routing code" },
    { id: "RTG6", kind: "bank", label: "121000358", detail: "Settlement routing code" },
  ];

  const KIND_META = {
    bidder: { color: "var(--bidder)", label: "Bidder" },
    director: { color: "var(--director)", label: "Director / Owner" },
    ip: { color: "var(--ip)", label: "IP fingerprint" },
    bank: { color: "var(--bank)", label: "Routing code" },
    asset: { color: "#8ecf72", label: "Declared asset" },
  };

  const svg = d3.select("#cartelSvg");
  const tooltip = d3.select("body").append("div").attr("class", "tooltip");
  let currentGraph = null;

  async function loadOverviewData() {
    try {
      const res = await fetch("http://localhost:8000/analyze");
      if (!res.ok) throw new Error("Analysis API request failed");
      const summary = await res.json();
      const scores = Object.values(summary.anomaly_scores || {}).map(Number);
      const flaggedBidderIds = new Set((summary.flagged_networks || []).flatMap((network) => network.bidders || []));
      const meanScore = scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : 0;

      document.getElementById("kpiBiddersEvaluated").textContent = scores.length;
      document.getElementById("kpiFlaggedNetworks").textContent = (summary.flagged_networks || []).length;
      document.getElementById("kpiBiddersSuspicion").textContent = flaggedBidderIds.size;
      document.getElementById("kpiMeanAnomaly").textContent = meanScore.toFixed(2);
      document.getElementById("overviewNetworkCount").textContent = (summary.flagged_networks || []).length;
    } catch (error) {
      console.warn("Analysis API unavailable; overview values remain at their defaults.", error);
    }
  }

  async function loadGraphData() {
    try {
      const res = await fetch("http://localhost:8000/graph-render");
      if (!res.ok) throw new Error("Graph API request failed");
      const data = await res.json();
      renderGraph(data.bidders || [], data.metadata || staticMetadataCatalog, data.bipartite || [], data.anomalyScores || {});
    } catch (error) {
      console.warn("Graph API unavailable; using metadata-only fallback.", error);
      renderGraph([], staticMetadataCatalog, [], {});
    }
  }

  async function loadBidderRoster() {
    const response = await fetch("http://localhost:8000/bidders");
    if (!response.ok) throw new Error("Bidder API request failed");
    const data = await response.json();
    document.getElementById("rosterCount").textContent = `${data.count} bidder${data.count === 1 ? "" : "s"}`;
    document.getElementById("bidderRoster").innerHTML = data.bidders.map((bidder) =>
      `<li><span class="meta-tag">${bidder.bidder_id}</span> — ${bidder.name}</li>`
    ).join("");
  }

  function splitInputValues(value) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  document.getElementById("bidderForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("bidderFormStatus");
    const submissionMetadata = {};
    const ipAddress = document.getElementById("ipInput").value.trim();
    const bankCode = document.getElementById("bankInput").value.trim();
    if (ipAddress) submissionMetadata.ip_address = ipAddress;
    if (bankCode) submissionMetadata.bank_routing_code = bankCode;

    const bidder = {
      bidder_id: document.getElementById("bidderIdInput").value.trim(),
      name: document.getElementById("bidderNameInput").value.trim(),
      beneficial_owners: splitInputValues(document.getElementById("ownerInput").value).map((name) => ({ name })),
      submission_metadata: submissionMetadata,
      declared_assets: splitInputValues(document.getElementById("assetInput").value),
    };

    try {
      const response = await fetch("http://localhost:8000/bidders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bidder),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail?.[0]?.msg || "Could not save bidder");
      }
      status.textContent = `${bidder.bidder_id} saved. Analysis updated.`;
      event.target.reset();
      await Promise.all([loadOverviewData(), loadGraphData(), loadBidderRoster()]);
    } catch (error) {
      status.textContent = error.message;
    }
  });

  function renderGraph(bidders, metadata, bipartite, anomalyScores) {
    const nodeById = new Map();
    bidders.forEach((b) => nodeById.set(b.id, { ...b, kind: "bidder" }));
    metadata.forEach((m) => nodeById.set(m.id, { ...m }));

    const nodes = Array.from(nodeById.values());
    const structuralLinks = bipartite.map(([bidderId, metaId]) => ({
      source: bidderId,
      target: metaId,
      kind: nodeById.get(metaId)?.kind || "metadata",
    }));

    const byMeta = new Map();
    structuralLinks.forEach((l) => {
      if (!byMeta.has(l.target)) byMeta.set(l.target, []);
      byMeta.get(l.target).push(l.source);
    });

    const collusionMap = new Map();
    const collusionPairKey = (a, b) => [a, b].sort().join("|");

    byMeta.forEach((bidderIds, metaId) => {
      if (bidderIds.length < 2) return;
      const meta = nodeById.get(metaId);
      for (let i = 0; i < bidderIds.length; i++) {
        for (let j = i + 1; j < bidderIds.length; j++) {
          const key = collusionPairKey(bidderIds[i], bidderIds[j]);
          if (!collusionMap.has(key)) {
            collusionMap.set(key, {
              source: bidderIds[i],
              target: bidderIds[j],
              kind: "collusion",
              via: [],
            });
          }
          collusionMap.get(key).via.push(meta);
        }
      }
    });

    const collusionLinks = Array.from(collusionMap.values());
    const flaggedBidderIds = new Set();
    collusionLinks.forEach((l) => {
      flaggedBidderIds.add(l.source);
      flaggedBidderIds.add(l.target);
    });

    const flaggedMetaIds = new Set();
    byMeta.forEach((bidderIds, metaId) => {
      if (bidderIds.length >= 2) flaggedMetaIds.add(metaId);
    });

    const allLinks = structuralLinks.concat(collusionLinks);
    document.getElementById("railFlagCount").textContent = collusionLinks.length
      ? new Set(collusionLinks.flatMap((l) => [l.source, l.target])).size
      : 0;

    function reasonText(a, b, meta) {
      const nameA = nodeById.get(a)?.name || a;
      const nameB = nodeById.get(b)?.name || b;
      const kindLabel = { director: "Director", ip: "IP address", bank: "Bank routing code", asset: "declared asset" }[meta.kind];
      return `${nameA} and ${nameB} share ${kindLabel}: ${meta.label}`;
    }

    function radiusFor(d) { return d.kind === "bidder" ? 17 : 9; }
    function colorFor(d) {
      if (d.kind === "bidder") return getCss("--bidder");
      if (d.kind === "director") return getCss("--director");
      if (d.kind === "ip") return getCss("--ip");
      if (d.kind === "bank") return getCss("--bank");
      if (d.kind === "asset") return "#8ecf72";
      return "#888";
    }
    function getCss(varName) {
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }

    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id", "glowRed").attr("x", "-60%").attr("y", "-60%").attr("width", "220%").attr("height", "220%");
    glow.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", 4.5).attr("result", "blur");
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    const zoomLayer = svg.append("g").attr("class", "zoomLayer");
    const linkLayer = zoomLayer.append("g").attr("class", "link-layer");
    const collusionLayer = zoomLayer.append("g").attr("class", "collusion-layer");
    const nodeLayer = zoomLayer.append("g").attr("class", "node-layer");
    const labelLayer = zoomLayer.append("g").attr("class", "label-layer");

    const zoomBehavior = d3.zoom()
      .scaleExtent([0.4, 2.5])
      .on("zoom", (event) => zoomLayer.attr("transform", event.transform));
    svg.call(zoomBehavior);

    const linkSel = linkLayer.selectAll("line")
      .data(structuralLinks)
      .join("line")
      .attr("class", (d) => "link " + (flaggedMetaIds.has(typeof d.target === "object" ? d.target.id : d.target) ? "collusion" : ""));

    const collusionSel = collusionLayer.selectAll("line")
      .data(collusionLinks)
      .join("line")
      .attr("class", "link collusion")
      .on("mouseenter", (event, d) => handleLinkHover(event, d, true))
      .on("mousemove", moveTooltip)
      .on("mouseleave", (event, d) => handleLinkHover(event, d, false))
      .on("click", (event, d) => {
        event.stopPropagation();
        selectCollusionEdge(d);
      });

    let simulation;
    simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(allLinks).id((d) => d.id)
        .distance((l) => (l.kind === "collusion" ? 95 : 150))
        .strength((l) => (l.kind === "collusion" ? 0.9 : 0.35)))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("collide", d3.forceCollide().radius((d) => radiusFor(d) + 14))
      .force("center", d3.forceCenter(0, 0))
      .force("x", d3.forceX(0).strength(0.04))
      .force("y", d3.forceY(0).strength(0.04));

    const nodeG = nodeLayer.selectAll("g.node")
      .data(nodes)
      .join("g")
      .attr("class", (d) => "node" + (flaggedBidderIds.has(d.id) ? " flagged" : ""))
      .call(drag(simulation))
      .on("mouseenter", (event, d) => handleNodeHover(event, d, true))
      .on("mousemove", moveTooltip)
      .on("mouseleave", (event, d) => handleNodeHover(event, d, false))
      .on("click", (event, d) => {
        event.stopPropagation();
        selectNode(d);
      });

    nodeG.append("circle").attr("r", radiusFor).attr("fill", colorFor);

    const labelSel = labelLayer.selectAll("text")
      .data(nodes)
      .join("text")
      .attr("class", "node-label")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => radiusFor(d) + 12)
      .text((d) => (d.kind === "bidder" ? d.id : d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label));

    currentGraph = {
      nodeG,
      labelSel,
      linkSel,
      collusionSel,
      flaggedBidderIds,
      flaggedMetaIds,
      zoomBehavior,
      nodeById,
      byMeta,
      allLinks,
      reasonText,
      zoomToFit,
    };

    simulation.on("tick", () => {
      linkSel.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      collusionSel.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      nodeG.attr("transform", (d) => `translate(${d.x},${d.y})`);
      labelSel.attr("x", (d) => d.x).attr("y", (d) => d.y);
    });

    simulation.on("end", zoomToFit);

    function zoomToFit() {
      const rect = svg.node().getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const xs = nodes.map((d) => d.x), ys = nodes.map((d) => d.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const pad = 60;
      const spanX = (maxX - minX) + pad * 2;
      const spanY = (maxY - minY) + pad * 2;
      const scale = Math.max(0.4, Math.min(2.5, Math.min(rect.width / spanX, rect.height / spanY)));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity.scale(scale).translate(-cx, -cy));
    }

    function neighborsOf(nodeId) {
      const ids = new Set([nodeId]);
      const touchingLinks = [];
      allLinks.forEach((l) => {
        const s = typeof l.source === "object" ? l.source.id : l.source;
        const t = typeof l.target === "object" ? l.target.id : l.target;
        if (s === nodeId || t === nodeId) {
          ids.add(s); ids.add(t);
          touchingLinks.push(l);
        }
      });
      return { ids, touchingLinks };
    }

    function applyFocus(activeIds, activeLinks) {
      nodeG.classed("dim", (d) => activeIds && !activeIds.has(d.id));
      linkSel.classed("dim", (d) => !!activeIds && !activeLinks.has(d))
        .classed("hot", (d) => !!activeLinks && activeLinks.has(d));
      collusionSel.classed("dim", (d) => !!activeIds && !activeLinks.has(d))
        .classed("hot", (d) => !!activeLinks && activeLinks.has(d));
    }

    function clearFocus() {
      nodeG.classed("dim", false);
      linkSel.classed("dim", false).classed("hot", false);
      collusionSel.classed("dim", false).classed("hot", false);
    }

    function handleNodeHover(event, d, entering) {
      if (entering) {
        const { ids, touchingLinks } = neighborsOf(d.id);
        applyFocus(ids, new Set(touchingLinks));
        showTooltip(event, tooltipForNode(d));
      } else {
        clearFocus();
        hideTooltip();
      }
    }

    function handleLinkHover(event, d, entering) {
      if (entering) {
        const s = typeof d.source === "object" ? d.source.id : d.source;
        const t = typeof d.target === "object" ? d.target.id : d.target;
        applyFocus(new Set([s, t]), new Set([d]));
        showTooltip(event, tooltipForCollusion(d));
      } else {
        clearFocus();
        hideTooltip();
      }
    }

    function tooltipForNode(d) {
      if (d.kind === "bidder") {
        const score = anomalyScores[d.id] ?? 0;
        const flagged = flaggedBidderIds.has(d.id);
        return `<strong>${d.name}</strong><br/>${d.id} · anomaly score ${score.toFixed(2)}<br/>${flagged ? "⚠ part of a flagged network" : "No collusion indicators"}`;
      }
      const info = KIND_META[d.kind];
      const shared = byMeta.get(d.id) || [];
      return `<strong>${d.label}</strong><br/>${info.label}${shared.length > 1 ? `<br/>⚠ shared by ${shared.length} bidders` : ""}`;
    }

    function tooltipForCollusion(d) {
      const reasons = d.via.map((m) => reasonText(d.source.id || d.source, d.target.id || d.target, m));
      return `<strong>Collusion indicator</strong><br/>${reasons.join("<br/>")}`;
    }

    function showTooltip(event, html) {
      tooltip.html(html).style("opacity", 1);
      moveTooltip(event);
    }
    function moveTooltip(event) {
      tooltip.style("left", event.clientX + 16 + "px").style("top", event.clientY + 16 + "px");
    }
    function hideTooltip() { tooltip.style("opacity", 0); }

    svg.on("click", () => clearSelection());

    const inspectorEmpty = document.getElementById("inspectorEmpty");
    const inspectorContent = document.getElementById("inspectorContent");

    function clearSelection() {
      nodeG.classed("selected", false);
      inspectorEmpty.hidden = false;
      inspectorContent.hidden = true;
      inspectorContent.innerHTML = "";
    }

    function selectNode(d) {
      nodeG.classed("selected", (n) => n.id === d.id);
      inspectorEmpty.hidden = true;
      inspectorContent.hidden = false;
      inspectorContent.innerHTML = d.kind === "bidder" ? renderBidderInspector(d) : renderMetaInspector(d);
    }

    function selectCollusionEdge(link) {
      nodeG.classed("selected", (n) => n.id === link.source.id || n.id === link.target.id);
      inspectorEmpty.hidden = true;
      inspectorContent.hidden = false;
      inspectorContent.innerHTML = renderCollusionInspector(link);
    }

    function renderBidderInspector(d) {
      const score = anomalyScores[d.id] ?? 0;
      const flagged = flaggedBidderIds.has(d.id);
      const myMeta = structuralLinks
        .filter((l) => (typeof l.source === "object" ? l.source.id : l.source) === d.id)
        .map((l) => nodeById.get(typeof l.target === "object" ? l.target.id : l.target));

      const myCollusions = collusionLinks.filter((l) => l.source.id === d.id || l.target.id === d.id);
      const metaListHtml = myMeta.map((m) => {
        const shared = (byMeta.get(m.id) || []).length > 1;
        return `<li${shared ? ' class="li-danger"' : ""}><span class="meta-tag">${KIND_META[m.kind].label}</span> — ${m.label}${shared ? " · shared" : ""}</li>`;
      }).join("");

      const collusionListHtml = myCollusions.length
        ? myCollusions.map((l) => {
            const otherId = l.source.id === d.id ? l.target.id : l.source.id;
            const other = nodeById.get(otherId);
            const reasons = l.via.map((m) => reasonText(d.id, otherId, m)).join("; ");
            return `<li class="li-danger"><span class="insp-reason">${d.id} ↔ ${other.id}</span><br/>${reasons}</li>`;
          }).join("")
        : `<li>No overlapping ownership, network fingerprint, or settlement infrastructure detected with other bidders.</li>`;

      return `
        <p class="insp-eyebrow">Bidder</p>
        <h3 class="insp-title">${d.name}
          <span class="insp-badge ${flagged ? "badge-flagged" : "badge-clear"}">${flagged ? "Flagged" : "Clear"}</span>
        </h3>
        <p class="insp-sub">${d.id}</p>

        <div class="insp-score">
          <span class="insp-score-label">Anomaly score (A_i)</span>
          <div class="score-bar"><div class="score-bar-fill" style="width:${Math.round(score * 100)}%"></div></div>
          <span class="insp-score-value">${score.toFixed(2)} / 1.00</span>
        </div>

        <p class="insp-section-title">Declared metadata</p>
        <ul class="insp-list">${metaListHtml}</ul>

        <p class="insp-section-title">Collusion indicators</p>
        <ul class="insp-list">${collusionListHtml}</ul>
      `;
    }

    function renderMetaInspector(d) {
      const info = KIND_META[d.kind];
      const sharedBidderIds = byMeta.get(d.id) || [];
      const isHub = sharedBidderIds.length > 1;

      const bidderListHtml = sharedBidderIds.map((bid) => {
        const b = nodeById.get(bid);
        return `<li${isHub ? ' class="li-danger"' : ""}><span class="meta-tag">${bid}</span> — ${b.name}</li>`;
      }).join("");

      let pairReasonsHtml = "";
      if (isHub) {
        const pairs = [];
        for (let i = 0; i < sharedBidderIds.length; i++) {
          for (let j = i + 1; j < sharedBidderIds.length; j++) {
            pairs.push(`<li class="li-danger">${reasonText(sharedBidderIds[i], sharedBidderIds[j], d)}</li>`);
          }
        }
        pairReasonsHtml = `<p class="insp-section-title">Flagged pairings</p><ul class="insp-list">${pairs.join("")}</ul>`;
      }

      return `
        <p class="insp-eyebrow">${info.label}</p>
        <h3 class="insp-title">${d.label}
          ${isHub ? '<span class="insp-badge badge-hub">Shared node</span>' : '<span class="insp-badge badge-clear">Unique</span>'}
        </h3>
        <p class="insp-sub">${d.detail}</p>

        ${isHub ? `<div class="insp-score"><span class="insp-score-label">Collusion pivot</span>Used by ${sharedBidderIds.length} bidders who otherwise present as independent competitors.</div>` : ""}

        <p class="insp-section-title">Connected bidders</p>
        <ul class="insp-list">${bidderListHtml}</ul>
        ${pairReasonsHtml}
      `;
    }

    function renderCollusionInspector(link) {
      const a = nodeById.get(link.source.id);
      const b = nodeById.get(link.target.id);
      const reasons = link.via.map((m) => `<li class="li-danger">${reasonText(a.id, b.id, m)}</li>`).join("");
      return `
        <p class="insp-eyebrow">Collusion link</p>
        <h3 class="insp-title">${a.id} ↔ ${b.id}<span class="insp-badge badge-flagged">Flagged</span></h3>
        <p class="insp-sub">${a.name} &amp; ${b.name}</p>
        <p class="insp-section-title">Shared metadata</p>
        <ul class="insp-list">${reasons}</ul>
        <p class="insp-section-title">Anomaly scores</p>
        <ul class="insp-list">
          <li><span class="meta-tag">${a.id}</span> — ${(anomalyScores[a.id] ?? 0).toFixed(2)}</li>
          <li><span class="meta-tag">${b.id}</span> — ${(anomalyScores[b.id] ?? 0).toFixed(2)}</li>
        </ul>
      `;
    }

    function drag(sim) {
      return d3.drag()
        .on("start", (event, d) => {
          if (!event.active) sim.alphaTarget(0.25).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x; d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null; d.fy = null;
        });
    }

    const rect = svg.node().getBoundingClientRect();
    if (rect.width && rect.height) {
      svg.attr("viewBox", [-rect.width / 2, -rect.height / 2, rect.width, rect.height]);
    }

    setTimeout(() => {
      if (nodes.length) {
        const xs = nodes.map((d) => d.x), ys = nodes.map((d) => d.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const pad = 60;
        const spanX = (maxX - minX) + pad * 2;
        const spanY = (maxY - minY) + pad * 2;
        const rectNow = svg.node().getBoundingClientRect();
        if (!rectNow.width || !rectNow.height) return;
        const scale = Math.max(0.4, Math.min(2.5, Math.min(rectNow.width / spanX, rectNow.height / spanY)));
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity.scale(scale).translate(-cx, -cy));
      }
    }, 100);
  }

  document.querySelectorAll(".rail-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const selectedTab = tab.dataset.tab;
      document.querySelectorAll(".rail-tab").forEach((item) => item.classList.toggle("active", item === tab));
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `tab-${selectedTab}`);
      });
    });
  });

  document.querySelector('.rail-tab[data-tab="graph"]').addEventListener("click", () => {
    requestAnimationFrame(() => {
      if (currentGraph) {
        const rect = svg.node().getBoundingClientRect();
        if (rect.width && rect.height) {
          svg.attr("viewBox", [-rect.width / 2, -rect.height / 2, rect.width, rect.height]);
          currentGraph.zoomToFit();
        }
      }
    });
  });

  loadOverviewData();
  loadGraphData();
  loadBidderRoster();
})();
