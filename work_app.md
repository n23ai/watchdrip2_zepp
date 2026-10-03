# WatchDrip2: verified background mode (Golden path, v1.0.31)

> First fully working version (2026-10-03, Amazfit Cheetah 2 Ultra, Zepp OS 4.4.0):
> sugar updates every minute inside the app, <1 s after screen wake, and in the
> background on the watchface. Any regression against this document is a bug.

## Architecture

```text
Android: xDrip+ -> WatchDrip2 (NanoHTTPD 127.0.0.1:29863/info.json)
                          ^ HTTP (app-side/index.js inside Zepp App)
                          | BLE RPC CMD_GET_INFO (shared/message.js)
Watch:
  page/index.js (foreground)  --owns BLE while open-->  writes info.json, renders
    onDestroy: MessageBuilder.disConnect() + startAppService(...source=page_release)
  app-service/index.js (continuous) --owns BLE otherwise--> writes info.json
    Time.onPerMinute tick / onEvent(force_fetch)
  data-widget, watchface (1121231) --read-only--> info.json
```

## BLE ownership (single receiver, last `ble.createConnect` wins)

| State | Owner | Who fetches | Who writes info.json |
| --- | --- | --- | --- |
| App page open (screen on) | page | `foregroundFetch()`: 3 s after open, then when data > 60 s (min 25 s spacing) | page (`Path.overrideWithText`) |
| App page open, screen off | nobody runs | page timers frozen, service suspended by OS | — (refresh <1 s after wake) |
| Page closed -> handoff | service | `onEvent(source=page_release)`: `resetConnection()` + fresh Shake + fetch | service |
| Watchface / screen off | service | `Time.onPerMinute` (~every 6 min in deep sleep, every 1 min when awake) | service (writes allowed with screen off) |
| Card widget onResume | service | `startAppService(mode=continuous&action=force_fetch)` -> `onEvent` | service |

## Fixed parameters

| Parameter | Value |
| --- | --- |
| App ID | `43107`, target `common`, version `1.0.31` (code 35) |
| Permission | `device:os.bg_service` (query result `2` = authorized) |
| Service | `app-service/index`, continuous, never `exit()` |
| Service start param | always starts with `mode=continuous` |
| Periodic trigger | `Time.onPerMinute` only (top-level `new Time()`, subscribed once) |
| RPC | `CMD_GET_INFO`, params `graph=1` |
| Request deadline (service) | `15000 ms`, checked on next tick/event (`noTimers: true`) |
| Request timeout (page) | `15000 ms` via `setTimeout` (page has timers) |
| Service save | `info.tmp.json` -> verify size >= 20 -> `renameSync` / direct write; blocked -> keep `pendingInfo` in memory, flush on next tick/event |
| SmartFlush | skip write if `bg.time/val/isError` unchanged |

## Required log chain

Page open:

```text
[WD_PAGE] foreground on
[WD_PAGE] fg fetch sent seq=N reason=open|stale
[WD_PAGE] fg fetch ok seq=N latency=~250ms written=true
```

Page close -> service:

```text
[WD_PAGE] fg ble released
[WD_LIFE] onEvent ...source=page_release
[MSG] resetConnection: page_release
[WD_REQ] sent seq=N forced ... (waiting shake)
[WD_REQ] outcome=ok
[WD_SAVE] verified size=...
```

Background:

```text
[WD_TICK] seq=N gap=60..400s ready=true port2=...
[WD_REQ] outcome=ok latency=...
[WD_SAVE] verified | SmartFlush: skip | deferred (screen on)
```

## Regression guard

- Do NOT route page-open fetches through `startAppService(force_fetch)`: the service is suspended and the ping steals the BLE receiver (1.0.29 failure: every request expired after ~60 s).
- Do NOT remove the `source=page_release` handoff or the `resetConnection()` on it (1.0.30: first post-release request lost for 4 min).
- Do NOT use `setTimeout`/`setInterval` in App Service; expire by deadline on tick.
- Do NOT write info.json/config.json from the service without verification; never in `onDestroy`.
- Do NOT call `ble.disConnect()` / `sendClose()` from the page; only `MessageBuilder.disConnect()`.
- Do NOT create a second `new Time()` in the page or `shared/debug.js`.
- Do NOT expect 1-min cadence on the watchface in deep sleep; ~6 min is the OS limit.
- Do NOT replace `Time.onPerMinute` with `@zos/alarm`, widget wake, `createSysTimer` or `setLaunchAppTimeout`.

## Verified run (v1.0.30/1.0.31, 2026-10-03)

| Phase | Result |
| --- | --- |
| App open, screen on | fetch every ~60 s, 238–303 ms, `written=true`, value matches phone |
| Screen off -> on in app | refresh < 1 s |
| Watchface, screen off | tick 18:00:02 -> 16.6 saved, 654 ms, `verified size=2456` |
| User confirmation | "работает, это первая полностью рабочая версия" |

---

# History (pre-1.0.29 baseline, kept for reference)

## Clean-install verification

| Field | Result |
| --- | --- |
| Package | `43107-WatchDrip2_zepp-1.0.0-20260710203943.zab` |
| SHA-256 | `2d22682d244adae724adeaaa8369d7581f2f7c22c948225b4d0fbe3a2fa9362c` |
| Installed | **Success** (Verified operation without crashes/OOM) |
| UI closed at | `~21:55` (Observation period for 10-minute continuous test) |
| Background minute ticks | **10** (9:56, 9:57, 9:58, 9:59, 10:00, 10:01, 10:02, 10:03, 10:04, 10:05) |
| Full successful cycles | **10** confirmed by CMD_GET_INFO and HTTP fetch in bridge logs |

Keep the full bridge capture under ignored `scratch/`; copy only short sanitized excerpts here. Do not commit glucose values, personal URLs, or a complete bridge log.

## Shortcut Card contract

- The production card is registered with `AppWidget`, which is supported by the application's API 3.0 baseline.
- The card never uses BLE, never writes debug/config files and never requests permissions. Its only side effect: `onResume` calls `startAppService({ file: 'app-service/index', param: 'mode=continuous&action=force_fetch' })` to wake the service (routed to `onEvent`).
- `info.json` is read once in `build` and again on every `onResume`.
- While focused, an in-memory timer updates only the displayed measurement age and is cleared in `onPause` and `onDestroy`.
- Card coordinates are relative to `getAppWidgetSize()`, not the full watch screen.
- Missing or malformed cache renders `--` and recovers on the next `onResume` after a valid foreground/background save.

Real-watch UI evidence on 2026-07-10 confirmed that the Shortcut Card reads the shared `info.json` and renders the value, trend arrow, delta, unit, age, and range pointer. The initial `--` immediately after installation was an empty-cache state, not a widget lifecycle failure.

An attempted synchronous write/read-back verification inside App Service (2026-07) stopped the background sequence after two requests. The 1.0.29+ verified write uses only `statSync` size checks on a temp file; do not add JSON read-back/parsing into the minute callback without an A/B build and a real-watch test.
