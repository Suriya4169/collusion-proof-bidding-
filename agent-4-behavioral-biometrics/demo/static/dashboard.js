/* Live detection dashboard. Polls the demo platform backend; all text is inserted with textContent. */
(function () {
  "use strict";

  var POLL_MS = 1000;
  var SLOW_POLL_MS = 3000;
  var MAX_POINTS = 120;
  var SVG_NS = "http://www.w3.org/2000/svg";
  var CATEGORY = {
    LOW_ANOMALY: { cls: "low", ico: "●", label: "Low" },
    MODERATE_ANOMALY: { cls: "moderate", ico: "▲", label: "Moderate" },
    HIGH_ANOMALY: { cls: "high", ico: "◆", label: "High" }
  };
  var STATUS = {
    "PASS": { cls: "pass", ico: "✓", label: "Pass" },
    "FAIL": { cls: "fail", ico: "✕", label: "Fail" },
    "INCONCLUSIVE": { cls: "info", ico: "?", label: "Inconclusive" },
    "INFO": { cls: "info", ico: "ℹ", label: "Info" },
    "NOT RUN": { cls: "none", ico: "–", label: "Not run" }
  };

  var sessions = {};          // session_id -> public record
  var afterSeq = 0;
  var status = null;
  var evaluation = null;
  var jobs = [];
  var scenarioTitles = {};
  var dirty = false;
  var evalTimer = null;
  var hoverPoints = [];

  function $(id) { return document.getElementById(id); }
  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "class") node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return node;
  }
  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }
  function pretty(descriptor) {
    var s = String(descriptor).replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function pct(x, digits) { return x === null || x === undefined ? "-" : (x * 100).toFixed(digits || 0) + "%"; }
  function api(path, options) {
    return fetch(path, Object.assign({ credentials: "same-origin", headers: { "Content-Type": "application/json" } }, options || {}))
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.detail || r.status); return j; }); });
  }
  function submitted() {
    return Object.keys(sessions).map(function (k) { return sessions[k]; })
      .filter(function (r) { return r.bid_submitted; })
      .sort(function (a, b) { return a.created_at - b.created_at; });
  }
  function group(r) { return r.truth === "bot" ? "bot" : r.truth === "human" ? "human" : "visitor"; }
  function who(r) {
    if (r.scenario && scenarioTitles[r.scenario]) return scenarioTitles[r.scenario];
    if (r.scenario) return r.scenario.replace(/_/g, " ");
    return "Visitor (typed by hand)";
  }
  function riskChip(r) {
    if (r.outcome !== "scored") {
      var none = h("span", { class: "chip none" }, [h("span", { class: "ico", text: "–" }), h("span", { text: r.outcome === "no_data" ? "No data" : r.outcome === "insufficient_data" ? "Too short" : "No verdict" })]);
      return none;
    }
    var c = CATEGORY[r.category] || CATEGORY.LOW_ANOMALY;
    return h("span", { class: "chip " + c.cls }, [h("span", { class: "ico", text: c.ico }), h("span", { text: c.label })]);
  }
  function groupTag(r) {
    var g = group(r);
    var label = g === "bot" ? "Bot" : g === "human" ? "Human (labelled)" : "Visitor";
    return h("span", { class: "tag " + g }, [h("span", { class: "sw" }), label]);
  }

  // ---- KPIs ---------------------------------------------------------------------------
  function renderKpis() {
    var rows = submitted();
    var scored = rows.filter(function (r) { return r.outcome === "scored"; });
    var latencies = rows.map(function (r) { return r.agent4_latency_ms; }).filter(function (x) { return typeof x === "number"; }).sort(function (a, b) { return a - b; });
    $("k-sessions").textContent = rows.length;
    $("k-flagged").textContent = scored.filter(function (r) { return r.flagged; }).length;
    $("k-high").textContent = scored.filter(function (r) { return r.high; }).length;
    $("k-noverdict").textContent = rows.length - scored.length;
    $("k-latency").textContent = latencies.length ? latencies[Math.floor(latencies.length / 2)].toFixed(1) : "-";
  }

  // ---- chart --------------------------------------------------------------------------
  function legend() {
    var box = $("legend");
    if (box.childNodes.length) return;
    function item(shape, text) {
      var s = svg("svg", { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": "true" });
      s.appendChild(shape);
      return h("span", {}, [s, text]);
    }
    box.appendChild(item(svg("circle", { cx: 8, cy: 8, r: 5, class: "pt pt-human" }), "Human (labelled)"));
    box.appendChild(item(svg("polygon", { points: "8,1.5 14.5,8 8,14.5 1.5,8", class: "pt pt-bot" }), "Bot"));
    box.appendChild(item(svg("rect", { x: 3.5, y: 3.5, width: 9, height: 9, class: "pt pt-visitor" }), "Visitor (typed by hand)"));
    var x = svg("g", {});
    x.appendChild(svg("path", { d: "M4 4 L12 12 M12 4 L4 12", class: "pt-none" }));
    box.appendChild(item(x, "No verdict"));
  }

  function renderChart() {
    var rows = submitted().slice(-MAX_POINTS);
    var chart = $("chart");
    $("chart-empty").hidden = rows.length > 0;
    chart.hidden = rows.length === 0;
    hoverPoints = [];
    if (!rows.length) return;

    var W = Math.max(320, $("chart-wrap").clientWidth);
    var H = W < 520 ? 250 : 300;
    var m = { l: 34, r: 78, t: 12, b: 30 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var y = function (v) { return m.t + ih * (1 - v / 100); };
    var x = function (i) { return m.l + (rows.length === 1 ? iw / 2 : (iw * i) / (rows.length - 1)); };

    chart.textContent = "";
    chart.setAttribute("viewBox", "0 0 " + W + " " + H);
    [0, 25, 50, 75, 100].forEach(function (v) {
      chart.appendChild(svg("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: v === 0 ? "axis" : "grid" }));
      var t = svg("text", { x: m.l - 6, y: y(v) + 4, "text-anchor": "end" });
      t.textContent = v;
      chart.appendChild(t);
    });
    [[50, "50  flagged"], [75, "75  high"]].forEach(function (p) {
      chart.appendChild(svg("line", { x1: m.l, x2: W - m.r, y1: y(p[0]), y2: y(p[0]), class: "thresh" }));
      var t = svg("text", { x: W - m.r + 6, y: y(p[0]) + 4 });
      t.textContent = p[1];
      chart.appendChild(t);
    });
    var xl = svg("text", { x: m.l + iw / 2, y: H - 6, "text-anchor": "middle" });
    xl.textContent = "Bids, oldest to newest";
    chart.appendChild(xl);

    rows.forEach(function (r, i) {
      var cx = x(i);
      var g = group(r);
      var node;
      var cy;
      if (r.outcome !== "scored") {
        cy = y(0) - 8;
        node = svg("path", { d: "M" + (cx - 4) + " " + (cy - 4) + " L" + (cx + 4) + " " + (cy + 4) + " M" + (cx + 4) + " " + (cy - 4) + " L" + (cx - 4) + " " + (cy + 4), class: "pt-none" });
      } else {
        cy = y(r.risk);
        if (g === "bot") node = svg("polygon", { points: [cx, cy - 6.5, cx + 6.5, cy, cx, cy + 6.5, cx - 6.5, cy].join(","), class: "pt pt-bot" });
        else if (g === "visitor") node = svg("rect", { x: cx - 4.5, y: cy - 4.5, width: 9, height: 9, class: "pt pt-visitor" });
        else node = svg("circle", { cx: cx, cy: cy, r: 5, class: "pt pt-human" });
      }
      chart.appendChild(node);
      hoverPoints.push({ x: cx, y: cy, r: r });
    });
  }

  function tooltipFor(p) {
    var r = p.r;
    var lines = [who(r) + (r.truth ? " (really a " + r.truth + ")" : "")];
    lines.push(r.outcome === "scored" ? "Risk " + Math.round(r.risk) + " - " + (CATEGORY[r.category] || {}).label + ", " + r.events + " keys" : "No verdict (" + (r.outcome === "no_data" ? "no timing received" : "too few keystrokes") + ")");
    if (r.evidence && r.evidence.length && r.outcome === "scored") lines.push(pretty(r.evidence[0]));
    return lines;
  }

  function wireHover() {
    var chart = $("chart"), tip = $("tooltip"), wrap = $("chart-wrap");
    chart.addEventListener("pointermove", function (ev) {
      var box = chart.getBoundingClientRect();
      var scale = chart.viewBox.baseVal.width / box.width;
      var px = (ev.clientX - box.left) * scale, py = (ev.clientY - box.top) * scale;
      var best = null, bestD = 20 * 20;
      hoverPoints.forEach(function (p) {
        var d = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
        if (d < bestD) { best = p; bestD = d; }
      });
      if (!best) { tip.hidden = true; return; }
      tip.textContent = "";
      tooltipFor(best).forEach(function (line, i) { tip.appendChild(h(i === 0 ? "strong" : "div", { text: line })); });
      tip.hidden = false;
      var wb = wrap.getBoundingClientRect();
      var left = best.x / scale + 12, top = best.y / scale - 12;
      tip.style.left = Math.min(left, wb.width - 230) + "px";
      tip.style.top = Math.max(0, top - 50) + "px";
    });
    chart.addEventListener("pointerleave", function () { tip.hidden = true; });
  }

  // ---- results table --------------------------------------------------------------------------
  function renderEvaluation() {
    if (!evaluation) return;
    var body = $("eval-table").querySelector("tbody");
    body.textContent = "";
    evaluation.scenarios.forEach(function (row) {
      var s = row.summary;
      var st = STATUS[row.status] || STATUS["NOT RUN"];
      var bandText = Object.keys(s.by_length).map(function (k) { return k + ": " + pct(s.by_length[k].rate) + " (n=" + s.by_length[k].n + ")"; }).join("  ");
      var flaggedCell = s.n ? [h("span", { text: s.flagged + "/" + s.n + "  " + pct(s.flagged_rate.rate) }),
        h("div", { class: "bar", "aria-hidden": "true" }, [(function () { var i = h("i"); i.style.width = Math.round((s.flagged_rate.rate || 0) * 100) + "%"; return i; })()])] : ["-"];
      var tr = h("tr", {}, [
        h("td", {}, [row.title, h("small", { text: row.expectation.statement })]),
        h("td", {}, [h("span", { class: "tag " + (row.truth === "bot" ? "bot" : "human") }, [h("span", { class: "sw" }), row.truth === "bot" ? "Bot" : "Human (simulated)"])]),
        h("td", { class: "num", text: s.n ? String(s.n) : "-" }),
        h("td", {}, flaggedCell),
        h("td", { class: "num", text: s.median_risk === null ? "-" : String(s.median_risk) }),
        h("td", { text: bandText || "-" }),
        h("td", { class: "num", text: row.synthetic_reference_rate === null ? "-" : pct(row.synthetic_reference_rate) }),
        h("td", {}, [h("span", { class: "chip " + st.cls }, [h("span", { class: "ico", text: st.ico }), h("span", { text: st.label })]), h("small", { text: row.detail })])
      ]);
      body.appendChild(tr);
    });
    var b = evaluation.bots, hum = evaluation.simulated_humans, v = evaluation.real_visitors;
    var parts = [];
    if (b.n) parts.push("Bots flagged: " + b.flagged + " of " + b.n + " (" + pct(b.flagged_rate.rate) + ")" + (b.no_data ? ", plus " + b.no_data + " with no data" : ""));
    if (hum.n) parts.push("Simulated humans flagged: " + hum.flagged + " of " + hum.n + " (" + pct(hum.flagged_rate.rate) + ")");
    if (v.n) parts.push("Real visitors flagged: " + v.flagged + " of " + v.n);
    var c = evaluation.status_counts;
    var verdict = c.PASS + c.FAIL + c.INCONCLUSIVE ? " Expectations: " + c.PASS + " passed, " + c.FAIL + " failed, " + c.INCONCLUSIVE + " inconclusive." : "";
    $("eval-summary").textContent = (parts.length ? parts.join(" · ") + "." : "Run the bots (or type on the portal) to fill this in.") + verdict;
  }

  // ---- latest -----------------------------------------------------------------------
  function renderLatest() {
    var body = $("latest-table").querySelector("tbody");
    body.textContent = "";
    submitted().slice(-20).reverse().forEach(function (r) {
      var risk = r.outcome === "scored" ? [h("span", { text: String(Math.round(r.risk)) }), h("div", { class: "bar", "aria-hidden": "true" }, [(function () { var i = h("i"); i.style.width = Math.round(r.risk) + "%"; return i; })()])] : ["-"];
      body.appendChild(h("tr", {}, [
        h("td", { text: new Date(r.created_at * 1000).toLocaleTimeString() }),
        h("td", {}, [who(r), h("div", {}, [groupTag(r)])]),
        h("td", { class: "num", text: r.events === null || r.events === undefined ? "0" : String(r.events) }),
        h("td", {}, risk),
        h("td", {}, [riskChip(r)]),
        h("td", { text: r.outcome === "scored" ? (r.evidence || []).slice(0, 2).map(pretty).join("; ") : (r.outcome === "no_data" ? "No keystroke timing received" : (r.message || "")) }),
        h("td", { class: "num", text: typeof r.agent4_latency_ms === "number" ? r.agent4_latency_ms.toFixed(1) : "-" })
      ]));
    });
    if (!body.childNodes.length) body.appendChild(h("tr", {}, [h("td", { colspan: 7, class: "empty", text: "Nothing yet." })]));
  }

  // ---- bot lab ----------------------------------------------------------------------------------
  function activeJob() {
    return jobs.filter(function (j) { return j.status === "running" || j.status === "starting"; })[0] || null;
  }

  function renderLab() {
    if (!status) return;
    var lab = status.bot_lab;
    lab.scenarios.forEach(function (s) { scenarioTitles[s.key] = s.title; });
    $("lab-disabled").hidden = lab.enabled;
    $("lab").hidden = !lab.enabled;
    if (!lab.enabled) return;
    var running = !!activeJob();
    var grid = $("lab-grid");
    if (!grid.childNodes.length) {
      lab.scenarios.forEach(function (s) {
        var runs = h("input", { type: "number", min: 1, max: lab.max_runs, value: 5, "aria-label": "Runs for " + s.title });
        var button = h("button", { type: "button", class: "small", "data-key": s.key, text: "Run" });
        button.addEventListener("click", function () { startJob(s.key, parseInt(runs.value, 10) || 1, button); });
        grid.appendChild(h("div", { class: "lab-item" }, [
          h("h3", { text: s.title }),
          h("p", { text: s.description + " " }),
          h("p", {}, [h("span", { class: "tag " + (s.truth === "bot" ? "bot" : "human") }, [h("span", { class: "sw" }), s.truth === "bot" ? "Bot" : "Human (simulated)"]), " " + s.tool]),
          h("div", { class: "row" }, [runs, h("span", { class: "note", text: "runs" }), button])
        ]));
      });
    }
    Array.prototype.forEach.call(grid.querySelectorAll("button[data-key]"), function (b) {
      var s = lab.scenarios.filter(function (x) { return x.key === b.getAttribute("data-key"); })[0];
      b.disabled = running || !s.available;
      b.title = s.available ? "" : "Needs a recorded visitor: submit a bid on the portal first";
    });
    $("run-all").disabled = running;
    $("cancel-job").hidden = !running;
    var job = activeJob() || jobs[0] || null;
    $("job").hidden = !job;
    if (job) {
      $("job-bar").style.width = (job.total ? Math.round((100 * job.done) / job.total) : 0) + "%";
      $("job-text").textContent = (job.status === "running" || job.status === "starting" ? "Running " : job.status === "finished" ? "Finished " : job.status === "cancelled" ? "Cancelled " : "Failed ") +
        (job.scenarios === "all" ? "all scenarios" : (scenarioTitles[job.scenarios] || job.scenarios)) + ": " + job.done + " of " + (job.total || "?") + " sessions.";
      $("job-log").textContent = job.log.join("\n");
    }
  }

  function startJob(scenarios, runs, button) {
    if (button) button.disabled = true;
    api("/demo/api/bots", { method: "POST", body: JSON.stringify({ scenarios: scenarios, runs: runs, headed: $("headed").checked }) })
      .then(pollJobs)
      .catch(function (err) { $("job").hidden = false; $("job-text").textContent = "Could not start: " + err.message; });
  }

  // ---- polling ------------------------------------------------------------------------------------
  function refreshEvaluation() {
    clearTimeout(evalTimer);
    evalTimer = setTimeout(function () {
      api("/demo/api/evaluation").then(function (e) { evaluation = e; renderEvaluation(); }).catch(function () {});
    }, 400);
  }

  function pollSessions() {
    api("/demo/api/sessions?after=" + afterSeq + "&limit=500").then(function (data) {
      setConnected(true);
      if (data.seq < afterSeq) { sessions = {}; afterSeq = 0; dirty = true; }   // server was reset
      var newest = afterSeq;
      data.sessions.forEach(function (r) { sessions[r.session_id] = r; if (r.seq > newest) newest = r.seq; });
      if (data.sessions.length) { afterSeq = newest; dirty = true; }
      if (dirty) { dirty = false; renderKpis(); renderChart(); renderLatest(); refreshEvaluation(); }
    }).catch(function () { setConnected(false); })
      .then(function () { setTimeout(pollSessions, POLL_MS); });
  }

  function pollStatus() {
    api("/demo/api/status").then(function (res) {
      status = res;
      var a = status.agent4.health;
      $("conn-text").textContent = "Agent 4 " + (a.model_loaded ? "ready" : a.status) + " (" + status.agent4.mode + ")" +
        (a.model_version ? " · model " + a.model_version : "") + " · scores use the shipped model in models/";
      $("conn-dot").className = "status-dot " + (a.model_loaded ? "ok" : "bad");
      renderLab();
      renderLatest();
      return pollJobs();
    }).catch(function () { setConnected(false); })
      .then(function () { setTimeout(pollStatus, SLOW_POLL_MS); });
  }

  function pollJobs() {
    if (!status || !status.bot_lab.enabled) return Promise.resolve();   // the jobs endpoint does not exist when the lab is off
    return api("/demo/api/bots").then(function (res) { jobs = res.jobs; renderLab(); }).catch(function () {});
  }

  function setConnected(ok) {
    if (!ok) { $("conn-text").textContent = "Cannot reach the demo server. Retrying..."; $("conn-dot").className = "status-dot bad"; }
  }

  // ---- wiring ------------------------------------------------------------------------------------
  $("run-all").addEventListener("click", function () { startJob("all", parseInt($("all-runs").value, 10) || 1, $("run-all")); });
  $("cancel-job").addEventListener("click", function () {
    var job = activeJob();
    if (job) api("/demo/api/bots/" + job.id + "/cancel", { method: "POST" }).then(pollJobs);
  });
  $("reset-data").addEventListener("click", function () {
    if (!window.confirm("Clear all sessions from the dashboard? (Saved portal recordings stay on disk.)")) return;
    api("/demo/api/reset", { method: "POST" }).then(function () { sessions = {}; afterSeq = 0; evaluation = null; dirty = true; renderKpis(); renderChart(); renderLatest(); refreshEvaluation(); });
  });
  window.addEventListener("resize", renderChart);
  document.addEventListener("themechange", renderChart);

  legend();
  wireHover();
  renderKpis();
  renderLatest();
  pollSessions();
  pollStatus();
  setInterval(pollJobs, 1500);
})();
