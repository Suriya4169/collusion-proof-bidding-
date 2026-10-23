/*!
 * Agent 4 - Behavioral Biometrics collector (browser SDK)
 *
 * Collects keystroke TIMING only and builds the payload for POST /behavior/analyze:
 *   { session_id, intervals: [ms...], hold_durations: [ms...] }
 *
 * Privacy contract (enforced by the code, verified by frontend/tests/sdk_test.html):
 *   - Never reads event.key, event.code, event.keyCode, event.charCode or any input value.
 *     Key-ups are paired with key-downs in first-in-first-out order, so no key identity is used.
 *     (Optional `precisePairing: true` uses event.code transiently, in memory only, to pair
 *     overlapping keys more exactly; it is off by default and the code is never stored or sent.)
 *   - Stores only numbers (timestamps converted to durations). No strings are retained.
 *   - Ignores password fields, read-only/disabled fields and any element marked data-agent4-ignore.
 *
 * Zero dependencies. Works in any modern browser (ES2017).
 *
 * Usage:
 *   const collector = Agent4Biometrics.createCollector({
 *     sessionId: "opaque-session-token",          // must NOT encode personal information
 *     endpoint: "/api/behavior/analyze",          // recommended: your own backend, which calls Agent 4
 *   });
 *   collector.start();                            // listens on document by default
 *   ...user types...
 *   const result = await collector.send();        // null until enough keystrokes were captured
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Agent4Biometrics = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TEXT_INPUT_TYPES = { text: 1, search: 1, tel: 1, url: 1, email: 1, number: 1 };

  function defaultNow(event) {
    var t = event && event.timeStamp;
    return typeof t === "number" && isFinite(t) && t > 0 ? t : performance.now();
  }

  function isTrackedTarget(el, opts) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toUpperCase();
    if (tag !== "INPUT" && tag !== "TEXTAREA") return false;
    if (tag === "INPUT" && !TEXT_INPUT_TYPES[(el.type || "text").toLowerCase()]) return false; // excludes password
    if (el.readOnly || el.disabled) return false;
    if (el.closest && el.closest("[data-agent4-ignore]")) return false;
    return opts.fieldFilter ? !!opts.fieldFilter(el) : true;
  }

  function round1(x) {
    return Math.round(x * 10) / 10;
  }

  function createCollector(options) {
    var opts = options || {};
    if (!opts.sessionId || typeof opts.sessionId !== "string") {
      throw new Error("Agent4Biometrics: `sessionId` (opaque string) is required.");
    }
    var now = opts.now || defaultNow;
    var maxEvents = opts.maxEvents || 2000;
    var minEvents = opts.minEvents || 10;
    var precise = !!opts.precisePairing;
    var fetchImpl = opts.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);

    var anchor = null; // time the first tracked field was focused/typed in: start of the onset latency
    var pendingDowns = []; // FIFO of key-down times (numbers only)
    var pendingByCode = {}; // used only when precisePairing is on; entries removed on key-up
    var events = []; // { down: number, up: number } - numbers only
    var root = null;
    var listeners = [];

    function onFocusIn(e) {
      if (anchor === null && isTrackedTarget(e.target, opts)) anchor = now(e);
    }

    function onKeyDown(e) {
      if (e.repeat || !isTrackedTarget(e.target, opts)) return;
      var t = now(e);
      if (anchor === null) anchor = t;
      if (precise) pendingByCode[e.code] = t;
      else pendingDowns.push(t);
    }

    function onKeyUp(e) {
      if (!isTrackedTarget(e.target, opts)) return;
      var up = now(e);
      var down;
      if (precise) {
        down = pendingByCode[e.code];
        delete pendingByCode[e.code];
      } else {
        down = pendingDowns.shift();
      }
      if (typeof down !== "number") return; // key-up whose key-down was not seen
      events.push({ down: down, up: Math.max(up, down + 0.1) });
      if (events.length > maxEvents) events.shift();
    }

    function onBlur() {
      pendingDowns.length = 0;
      pendingByCode = {};
    }

    function listen(target, type, fn) {
      target.addEventListener(type, fn, true);
      listeners.push([target, type, fn]);
    }

    function start(target) {
      if (root) return api;
      root = target || (typeof document !== "undefined" ? document : null);
      if (!root) throw new Error("Agent4Biometrics: no event target available.");
      listen(root, "focusin", onFocusIn);
      listen(root, "keydown", onKeyDown);
      listen(root, "keyup", onKeyUp);
      if (typeof window !== "undefined") listen(window, "blur", onBlur);
      return api;
    }

    function stop() {
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], true); });
      listeners = [];
      root = null;
      return api;
    }

    function reset() {
      anchor = null;
      pendingDowns.length = 0;
      pendingByCode = {};
      events = [];
      return api;
    }

    /** Numbers only: the timing arrays the API expects, or null if nothing was captured. */
    function getPayload() {
      if (!events.length) return null;
      var ordered = events.slice().sort(function (a, b) { return a.down - b.down; });
      var intervals = [];
      var holds = [];
      for (var i = 0; i < ordered.length; i++) {
        var prevUp = i === 0 ? (anchor === null ? ordered[0].down : anchor) : ordered[i - 1].up;
        // Overlapping keys (rollover) give a negative gap; the API requires >= 0.
        intervals.push(round1(Math.max(0, ordered[i].down - prevUp)));
        holds.push(round1(Math.max(0.1, ordered[i].up - ordered[i].down)));
      }
      return { session_id: opts.sessionId, intervals: intervals, hold_durations: holds };
    }

    function count() {
      return events.length;
    }

    /** Send the captured timing. Resolves to the API response, or null if too few keystrokes yet. */
    function send(overrides) {
      var o = overrides || {};
      var url = o.endpoint || opts.endpoint;
      if (!url) return Promise.reject(new Error("Agent4Biometrics: `endpoint` is required to send."));
      if (!fetchImpl) return Promise.reject(new Error("Agent4Biometrics: fetch is not available."));
      if (events.length < minEvents) return Promise.resolve(null);
      var headers = { "Content-Type": "application/json" };
      var extra = o.headers || opts.headers || {};
      Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
      return fetchImpl(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(getPayload()),
        keepalive: true,
        credentials: opts.credentials || "same-origin",
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            var err = new Error("Agent4Biometrics: server responded " + res.status);
            err.status = res.status;
            err.body = data;
            throw err;
          }
          if (typeof opts.onResult === "function") opts.onResult(data);
          return data;
        });
      }).catch(function (err) {
        if (typeof opts.onError === "function") opts.onError(err);
        throw err;
      });
    }

    var api = { start: start, stop: stop, reset: reset, getPayload: getPayload, count: count, send: send };
    return api;
  }

  return { createCollector: createCollector, version: "2.0.0" };
});
