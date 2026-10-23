/* Bid portal: collects keystroke TIMING with the Agent 4 SDK and shows what the platform learned.
   The form text never leaves the browser; only timing numbers are sent. */
(function () {
  "use strict";

  var LIVE_DEBOUNCE_MS = 600;
  var MIN_EVENTS = 10;
  var CATEGORY = {
    LOW_ANOMALY: { cls: "low", ico: "●", label: "Low", meaning: "Typing looks like a genuine person of this session length." },
    MODERATE_ANOMALY: { cls: "moderate", ico: "▲", label: "Moderate", meaning: "More unusual than 95% of genuine typists of this session length." },
    HIGH_ANOMALY: { cls: "high", ico: "◆", label: "High", meaning: "More unusual than 99% of genuine typists of this session length." }
  };
  var RELIABILITY = {
    low: "Low (under 30 keystrokes): treat with caution",
    medium: "Medium (30 to 99 keystrokes)",
    high: "High (100 or more keystrokes)"
  };
  var WORDS = ("supply delivery contract tender road bridge school hospital water equipment maintenance services " +
    "technical compliance warranty schedule materials labour quality inspection transport project phase budget").split(" ");

  function el(id) { return document.getElementById(id); }
  function makeId() {
    var a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return "pip-" + Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function pretty(descriptor) {
    var s = String(descriptor).replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function postJson(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" })
      .then(function (r) { return r.json(); });
  }

  var session = null;
  window.pipDemo = { ready: false, done: false, sessionId: null, lastBehavior: null, bid: null, collector: null };

  function newSession() {
    if (session) { session.collector.stop(); clearTimeout(session.timer); }
    var id = makeId();
    var collector = Agent4Biometrics.createCollector({
      sessionId: id,
      endpoint: "/demo/api/behavior",
      minEvents: MIN_EVENTS,
      fieldFilter: function (node) { return node.hasAttribute("data-track"); },
      onResult: function (data) { window.pipDemo.lastBehavior = data; renderBehavior(data); }
    });
    collector.start();
    session = { id: id, collector: collector, timer: null, inflight: false, submitted: false, scripting: false };
    window.pipDemo.sessionId = id;
    window.pipDemo.collector = collector;
    window.pipDemo.done = false;
    window.pipDemo.lastBehavior = null;
    window.pipDemo.bid = null;
    return session;
  }

  // ---- rendering ---------------------------------------------------------------
  function showEmpty(text) {
    el("panel").hidden = true;
    el("panel-empty").hidden = false;
    el("panel-empty").textContent = text;
  }

  function renderBehavior(data) {
    if (!data || data.status !== "scored") {
      showEmpty(data && data.message ? data.message : "Type at least " + MIN_EVENTS + " keystrokes and the signal appears here.");
      return;
    }
    var cat = CATEGORY[data.risk_category] || CATEGORY.LOW_ANOMALY;
    el("panel-empty").hidden = true;
    el("panel").hidden = false;
    el("risk-num").textContent = Math.round(data.behavioral_risk_score);
    el("risk-chip").className = "chip " + cat.cls;
    el("risk-ico").textContent = cat.ico;
    el("risk-label").textContent = cat.label + " anomaly";
    el("risk-marker").style.left = Math.max(0, Math.min(100, data.behavioral_risk_score)) + "%";
    el("risk-meaning").textContent = cat.meaning;
    el("f-events").textContent = data.events_scored + (data.events_received > data.events_scored ? " of " + data.events_received + " (most recent window)" : "");
    el("f-reliability").textContent = RELIABILITY[data.reliability] || data.reliability;
    el("f-model").textContent = data.model_version + " (" + data.scoring_mode.replace("_", "-") + ")";
    var list = el("evidence");
    list.textContent = "";
    (data.behavioral_evidence || []).forEach(function (d) {
      var li = document.createElement("li");
      li.textContent = pretty(d);
      list.appendChild(li);
    });
  }

  function renderBid(bid) {
    el("bid-result").hidden = false;
    el("bid-ref").textContent = "Bid " + bid.reference + " accepted";
    el("bid-note").textContent = bid.platform_note;
    if (bid.behavior) renderBehavior(bid.behavior);
    else showEmpty("No keystroke timing was captured for this bid, so there is nothing to score.");
  }

  function refreshCounter() {
    if (!session) return;
    var n = session.collector.count();
    el("count").textContent = n;
    var p = session.collector.getPayload();
    if (!p) { el("payload").textContent = "Nothing captured yet."; return; }
    var cut = function (a) { return a.length > 40 ? a.slice(0, 40).concat(["... (" + (a.length - 40) + " more)"]) : a; };
    el("payload").textContent = JSON.stringify({ session_id: p.session_id, intervals: cut(p.intervals), hold_durations: cut(p.hold_durations) }, null, 1);
  }

  // ---- live scoring ------------------------------------------------------------
  function scheduleLive() {
    if (!session) return;
    clearTimeout(session.timer);
    var s = session;
    s.timer = setTimeout(function () {
      if (s !== session || s.inflight || s.submitted || s.collector.count() < MIN_EVENTS) return;
      s.inflight = true;
      s.collector.send().catch(function () { /* the panel keeps its last answer */ }).then(function () { s.inflight = false; });
    }, LIVE_DEBOUNCE_MS);
  }

  document.addEventListener("keyup", function () {
    setTimeout(function () { refreshCounter(); scheduleLive(); }, 0);
  }, true);

  // ---- actions -----------------------------------------------------------------
  function clearForm() {
    ["company", "amount", "justification", "passphrase"].forEach(function (id) { el(id).value = ""; });
    el("submit-msg").textContent = "";
    el("bid-result").hidden = true;
    showEmpty("Type at least " + MIN_EVENTS + " keystrokes and the signal appears here.");
    refreshCounter();
  }

  function restart() { newSession(); clearForm(); setBusy(false); }

  function setBusy(busy) {
    el("submit").disabled = busy;
    Array.prototype.forEach.call(document.querySelectorAll("[data-script]"), function (b) { b.disabled = busy; });
  }

  el("new-bid").addEventListener("click", restart);

  el("submit").addEventListener("click", function () {
    var s = session;
    if (s.submitted) { el("submit-msg").textContent = "This bid was already submitted. Press New bid to start another."; return; }
    setBusy(true);
    clearTimeout(s.timer);
    el("submit-msg").textContent = "Submitting...";
    s.collector.send()
      .catch(function () { return null; })           // a failed signal must never stop the bid
      .then(function () { return postJson("/demo/api/bids", { session_id: s.id }); })
      .then(function (bid) {
        s.submitted = true;
        window.pipDemo.bid = bid;
        window.pipDemo.lastBehavior = bid.behavior;
        renderBid(bid);
        el("submit-msg").textContent = "Done. Press New bid to try again.";
        window.pipDemo.done = true;
      })
      .catch(function () { el("submit-msg").textContent = "The portal could not be reached. Nothing was submitted."; })
      .then(function () { el("submit").disabled = false; });
  });

  // ---- built-in script bots (synthetic key events produced by JavaScript in this page) --------
  function randBetween(lo, hi) { return lo + Math.random() * (hi - lo); }
  function words(length) {
    var out = "";
    while (out.length < length) out += WORDS[Math.floor(Math.random() * WORDS.length)] + " ";
    return out.slice(0, length);
  }
  var SCRIPTS = {
    instant: { title: "In-page script, instant", hold: function () { return 0; }, flight: function () { return 0; } },
    steady: { title: "In-page script, steady rhythm", hold: function () { return 60; }, flight: function () { return 110; } },
    random: { title: "In-page script, random delays", hold: function () { return randBetween(45, 140); }, flight: function () { return randBetween(70, 260); } }
  };

  function runScript(kind) {
    var spec = SCRIPTS[kind];
    var s = newSession();
    clearForm();
    setBusy(true);
    s.scripting = true;
    var sequence = [];
    var digits = "";
    for (var d = 0; d < 7; d++) digits += String(d === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10));
    [["company", words(16)], ["amount", digits], ["justification", words(40)]].forEach(function (pair) {
      pair[1].split("").forEach(function (ch) { sequence.push({ field: pair[0], ch: ch }); });
    });
    postJson("/demo/api/truth", { session_id: s.id, truth: "bot", scenario: "inpage_" + kind, tool: "JavaScript in the page (synthetic key events)" })
      .catch(function () { /* labelling is optional */ })
      .then(function () {
        var i = 0;
        (function next() {
          if (i >= sequence.length) { s.scripting = false; setBusy(false); scheduleLive(); return; }
          var k = sequence[i++];
          var target = el(k.field);
          if (document.activeElement !== target) target.focus();
          target.dispatchEvent(new KeyboardEvent("keydown", { key: k.ch, bubbles: true, cancelable: true }));
          setTimeout(function () {
            target.value += k.ch;
            target.dispatchEvent(new Event("input", { bubbles: true }));
            target.dispatchEvent(new KeyboardEvent("keyup", { key: k.ch, bubbles: true, cancelable: true }));
            setTimeout(next, spec.flight());
          }, spec.hold());
        })();
      });
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-script]"), function (button) {
    button.addEventListener("click", function () { runScript(button.getAttribute("data-script")); });
  });

  // ---- start ---------------------------------------------------------------------
  // Positions of the meter ticks (CSSOM, so no inline style attributes are needed).
  [["tick0", 0], ["tick50", 50], ["tick75", 75], ["tick100", 100]].forEach(function (t) { el(t[0]).style.left = t[1] + "%"; });
  newSession();
  clearForm();
  window.pipDemo.ready = true;
})();
