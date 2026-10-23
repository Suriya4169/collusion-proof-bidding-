# Browser collector (`frontend/biometrics.js`)

A zero-dependency script that records keystroke **timing** in a bid form and builds the payload for `POST /behavior/analyze`. It never reads which key was pressed.

## 1. Use

Serve the file from your own origin (add Subresource Integrity and a CSP in production), then:

```html
<script src="/static/biometrics.js"></script>
<script>
  const collector = Agent4Biometrics.createCollector({
    sessionId: "<opaque token issued by your backend>",   // never a name, e-mail, taxpayer id ...
    endpoint:  "/api/behavior/analyze",                   // YOUR backend, which calls Agent 4
  });
  collector.start();                                      // listens on the whole document

  document.querySelector("#bid-form").addEventListener("submit", () => {
    collector.send().catch(() => { /* advisory only: never block the submission */ });
  });
</script>
```

`send()` resolves to the API response, or to `null` if fewer than `minEvents` (default 10) keystrokes were captured. `collector.getPayload()` returns `{session_id, intervals, hold_durations}` (or `null`) without sending anything.

A runnable demo is `frontend/demo.html` (open it in a browser; point it at a running service).

## 2. What it captures

For every key press in a tracked field: the time of key-down, the time of key-up, and (once) the time the first tracked field was focused. From these it computes only numbers:

* `intervals[0]` = focus → first key-down (the *onset latency*; the model ignores it).
* `intervals[i]` = previous key-up → this key-down (never negative; overlapping keys give 0).
* `hold_durations[i]` = key-down → key-up (always > 0).

Everything is rounded to 0.1 ms. The buffer keeps the most recent `maxEvents` (default 2000) events.

## 3. Privacy behaviour

* Default: **never reads** `event.key`, `event.code`, `event.keyCode`, `event.charCode`, or any input value. Key-ups are paired with key-downs first-in-first-out.
* `precisePairing: true` (opt-in) pairs overlapping keys exactly by using `event.code` *in memory only, transiently*; the code is never stored or sent. Leave it off unless you need the extra accuracy and accept this.
* Ignored: password fields, read-only or disabled fields, non-text inputs (checkboxes, buttons, …), and anything inside an element with `data-agent4-ignore`.
* Auto-repeat key-downs (`event.repeat`) are ignored; a window blur discards unfinished presses.

## 4. Options

| Option | Default | Meaning |
|---|---|---|
| `sessionId` | — (required) | Opaque token; the API only accepts `A–Z a–z 0–9 . _ : -`, 1–128 chars |
| `endpoint` | — | URL `send()` posts to |
| `headers` | `{}` | Extra headers for `send()` (e.g. a CSRF token). Do not put the Agent 4 API key here: call Agent 4 from your backend |
| `minEvents` | `10` | `send()` returns `null` until this many keystrokes were captured |
| `maxEvents` | `2000` | Buffer cap (most recent kept) |
| `fieldFilter` | none | `(element) => boolean` for finer control over which fields are tracked |
| `precisePairing` | `false` | See §3 |
| `onResult` / `onError` | none | Callbacks around `send()` |
| `credentials` | `"same-origin"` | `fetch` credentials mode |
| `now` | `event.timeStamp` | Clock function (for tests) |
| `fetchImpl` | global `fetch` | For tests |

Methods: `start(target?)`, `stop()`, `reset()`, `getPayload()`, `count()`, `send(overrides?)`.

## 5. Things to know

* **Paste, autofill, password managers, voice typing and on-screen keyboards** produce few or no key events. The session then has little or no timing and returns `insufficient_data`. That is *no signal*, not a verdict.
* **Timer resolution.** Some browsers or privacy modes coarsen high-resolution timestamps; regular timing becomes quantised for everyone. The model was not trained for heavily coarsened clocks.
* **Hidden tabs** throttle timers; key events still carry their own timestamps, but long inactivity is capped by the model.
* **Single page apps**: call `collector.reset()` when a new bid session begins, and issue a new `sessionId`.
* **Do not block the form** on the result. `send()` is advisory; handle failures silently.

## 6. Tests

* `frontend/tests/sdk_test.html` — 23 checks (exact timing, rollover, privacy trap on `key`/`code` reads, field filtering, repeat handling, caps, `send()` request and error paths). Open it in any browser, or run it headless:

  ```powershell
  powershell -File frontend\tests\run_sdk_tests.ps1        # Windows, uses Edge or Chrome
  ```
* `tests/test_sdk.py` — runs the self-test and also **replays simulator sessions through the real JavaScript and scores the result**, proving that the collector emits exactly what the model was trained on. Skipped automatically if no Chromium-family browser is installed.

Tested in Chromium (Microsoft Edge). The code uses plain ES2017 and standard DOM APIs, but other browsers have not been tested here.
