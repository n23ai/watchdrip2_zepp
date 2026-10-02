# Repository Guidelines

## Core Specification & Guidelines
You MUST read and strictly adhere to the global AI guidelines located at [specification/AGENT.md](file:///Users/nikolaj/Documents/dev/zepp/specification/AGENT.md) before making architectural decisions or modifying code. It contains critical constraints (e.g., regarding API imports, QuickJS limitations, and Zepp OS 3+ features).

## Project Structure & Module Organization

This repository is a Zepp OS 3+ WatchDrip2 app. Main device entry points live at the repository root and in feature folders:

- `app.js` starts app-level initialization and background scheduling.
- `page/` contains the main watch UI and page i18n files.
- `data-widget/` contains the shortcut card/widget UI.
- `app-service/` contains watch-side background service code.
- `app-side/` contains phone-side service/settings bridge logic.
- `setting/` contains Zepp app settings UI.
- `utils/` and `shared/` contain reusable config, data, BLE, message, and filesystem helpers.
- `assets/` contains per-device and common images.
- `dist/`, `scratch/`, `temp_unzipped/`, and bridge logs are generated/debug artifacts; avoid committing new generated files unless needed for a release/debug handoff.

## Background Execution & Architecture on Zepp OS 3+

Based on extensive real-watch testing, you MUST follow this "Golden path" architecture for background updates:
1. **Continuous App Service**: Do NOT rely on `@zos/alarm` or `setLaunchAppTimeout` to wake the app from the background. Start a Continuous App Service (`mode=continuous`) from the foreground UI (`app.js` or `page/index.js`), and do NOT call `exit()` after responses.
2. **System Ticks**: Inside the continuous service, use `Time.onPerMinute()` to trigger cyclical background work (e.g., BLE fetches).
3. **Read-Only Widgets**: Do NOT attempt to schedule alarms, timeouts, or perform BLE fetches from the widget context. The OS blocks wake-mechanisms initiated by widgets. Widgets must be strictly read-only, simply reading `info.json` and rendering the UI on `onResume`.
4. **Stale Recovery / Watchdogs**: The background service must be resilient. If a BLE fetch hangs, a promise is unhandled, or a callback is missed, the service must not stay permanently locked (e.g., stuck with `fetchInFlight = true`). Implement watchdogs to clear stale state on subsequent `onPerMinute` ticks so the cycle continues.
5. **Widget Layout & Alignment**: For shortcut card widgets (`data-widget/index.js`), use `getAppWidgetSize()` metrics: set card background at `x: size.margin` (`cardX = px(40)`) with `w: size.w` (`cardWidth = px(400)`), content at `innerX = cardX + px(16)` and `innerWidth = cardWidth - px(32)`. Compute canvas graph `xMax` via `Math.max(...xValues)` to fill the card completely to the right boundary.
6. **CGM Sensor Update Cadence (1-Minute Rate)**: The user's CGM sensor transmits glucose readings every 1 minute (not 5 minutes). Background fetching via `Time.onPerMinute()` in the continuous App Service runs every minute to match this cadence. Time-ago calculations, watchdog triggers, and stale-data diagnostics must reflect a 1-minute expected cycle (e.g., age >= 5m indicates multiple missed readings, while 1m is normal).
7. **Time Sensor & Callback Singleton**: Declare `const timeSensor = new Time()` at module top-level in `app-service/index.js` to prevent QuickJS GC deallocation during deep sleep. Guard `timeSensor.onPerMinute()` so it is subscribed strictly ONCE (Zepp OS lacks `offPerMinute()`; re-subscribing in watchdogs creates duplicate listeners). Never import `@zos/sensor` on `app-side` (phone-only runtime lacks it) or at module top-level in `data-widget/` (widgets must be read-only).
8. **Dynamic Companion Port Tracking**: The phone-side process (`app-side`) may restart and assign dynamic ports (e.g. 1053, 1064). In `MessageBuilder.onFragmentData()`, update `this.appSidePort = data.port2` dynamically for valid app packets rather than discarding packets due to a mismatched static port.
9. **Screen-On & Widget Wake-Up Triggers**: Do NOT use `emitCustomSystemEvent` to signal an already running continuous `AppService`. Zepp OS only routes custom events to `onInit` when launching an inactive service; a running continuous service will ignore it. To trigger an immediate fetch from the widget when the user wakes the screen, call `startAppService({ file: 'app-service/index', param: 'action=force_fetch' })` in `data-widget/index.js` `onResume()`. Do NOT check `if (isRunning) return` before calling `startAppService`, because Zepp OS routes parameters of subsequent `startAppService` calls to `onEvent(params)` of the active service. Alternatively, use a shared file timestamp marker (`wake_marker.json`).
10. **Deep Sleep Hardware Suspend & Timers**: When the screen is OFF, the watch SoC suspends: `setTimeout` and `setInterval` are FROZEN. They only execute while the CPU is awake (screen ON or during an RTC wake). `@zos/display` has no event listener (`onChange`). Never rely on an internal service timer to detect screen-on events while sleeping; rely on UI `onResume()` hooks. Short interval timers (e.g. 5–10s) in `app-service` can only be used as opportunistic active-screen keepalives while `getSettings().screen.status === 1`.
11. **Background Ticker Invariant (Strict `Time.onPerMinute` vs `createSysTimer`)**: Despite official documentation claiming `createSysTimer` runs regardless of screen state, empirical testing on Zepp OS 4.4.0 (Amazfit Cheetah 2 Ultra) proves the SoC FreeRTOS scheduler freezes software timers during hardware deep sleep when the display is suspended. Only `Time.onPerMinute()` (from `@zos/sensor`) connects to the physical hardware RTC interrupt pin, firing reliably on `:00` seconds of every minute across all Zepp OS versions (3.x and 4.x). NEVER rely on `createSysTimer` for background cycles. `Time.onPerMinute()` is the strict sole engine for cyclical background updates.
12. **Watchface Awake Refresh Pattern**: When waking the screen, triggering `startAppService({ file: 'app-service/index', param: 'action=force_fetch' })` starts an async BLE fetch that takes ~1–2 seconds. Rendering immediately in `resume_call` / `onResume` reads old cached data. To ensure instant updates during a glance, implement an awake polling loop (`startAwakeRefresh` every 2–2.5s) guarded between `resume_call` and `pause_call` (or `onDestroy`) that reads `info.json` and updates the UI the moment fresh data arrives.
13. **PNG Transparency & Zeus CLI `[PNG2TGA]`**: Zeus CLI automatically converts PNGs into internal Zepp bitmap textures via `[PNG2TGA]`. 8-bit indexed palette PNGs (ColorType 3) without `tRNS` chunks will bake opaque black (`#000000`) into the texture, creating ugly black boxes on non-black surfaces (like widget cards with `CARD_BG = 0x3a3a3a`). All UI assets (arrows, icons, status marks) MUST be saved in 32-bit RGBA (ColorType 6) with true alpha transparency (`alpha=0` on background pixels).
14. **Single BLE Receiver Invariant (`@zos/ble.createConnect`)**: Zepp OS FreeRTOS supports strictly ONE global C-level receiver for incoming BLE packets registered via `@zos/ble.createConnect(cb)`. Only `app-service/index.js` must own `ble.createConnect` and the active `MessageBuilder` instance. Foreground UI (`page/index.js`) must NEVER call `createConnect` or create an independent `MessageBuilder`. If foreground UI creates a separate `MessageBuilder`, closing the page (`page.onDestroy` -> `disConnect()`) blinds the background service, leaving `ble.createConnect` routing fragments to a dead listener. Foreground UI must strictly delegate fetches to the background service via `startAppService({ file: 'app-service/index', param: 'action=force_fetch' })` and poll `info.json`. Proactively rebind `ble.createConnect` at the start of each `fetchInfo()` cycle in `app-service`.
15. **Watchface Cross-App Security Barrier**: Zepp OS strictly blocks watchfaces from launching background services or apps with other app IDs (`startAppService` / `startService({ appId: ... })`). Any such call is rejected or fails silently. Watchfaces must be purely passive read-only observers, reading `info.json` from the target app's data directory via `tryReadFile({ path: 'info.json', flag: O_RDONLY, options: { appId: 43107 } })`.
16. **QuickJS Scope Integrity & Connection Reset on `MessageType.Close`**: In QuickJS closures (such as `requestCb`), all termination callbacks (`finish`) and timer IDs (`timer1`, `readyTimer`, `cancelReady`, `hasReturned`) must be declared at the outer function scope. If `finish` is declared in an inner function, outer timers firing on failure throw a fatal `ReferenceError: finish is not defined` in QuickJS and freeze active promises. Additionally, when Android Zepp kills the companion process on idle (10-minute timeout) and sends `MessageType.Close`, `MessageBuilder` must immediately emit `'error'`, abort in-flight requests, reset `appSidePort = 0` and `ready = false`, and require a fresh `sendShake` handshake.
17. **Flash I/O Starvation Prevention in Deep Sleep**: The CPU wake window during hardware RTC interrupts (`Time.onPerMinute`) is extremely short. Synchronous flash writes (`conf.save()`, `fs.writeFileSync`) on every minute tick risk FreeRTOS watchdog starvation. Only write to flash memory when persistent settings actually change or on explicit user action. Keep minute diagnostic traces in memory.
18. **Mandatory Explicit ES Module Imports**: In Zepp OS 3+, all platform functions (including `getPackageInfo` from `@zos/app`, `Time` from `@zos/sensor`, etc.) require explicit ES module imports. Never assume runtime globals exist. Missing an import results in a fatal `LifeCycle Error TypeError: not a function` during `Page.build()` or `Watchdrip.start()`.

## Build, Test, and Development Commands

Use the Zepp CLI from the repository root:

```bash
zeus build
```

Builds the `.zab` package into `dist/`.

```bash
zeus bridge
```

Starts an interactive bridge session. Useful bridge commands are `connect`, `install <dist/latest.zab>`, `screenshot`, and `exit`.

```bash
python3 /Users/nikolaj/Documents/dev/zepp/simulator/install_android_cheetah.py
```

Installs the latest package on the connected real watch through the Android bridge helper.

```bash
# Universal Bridge Monitor & Screenshot Tool (Do NOT create ad-hoc python scripts in this repo):
# Instant screenshot:
python3 /Users/nikolaj/Documents/dev/zepp/simulator/zeus_monitor.py --screenshot -o /path/to/screen.png
# Observation session (10m) with periodic screenshots and logging:
python3 /Users/nikolaj/Documents/dev/zepp/simulator/zeus_monitor.py --duration 10m --screenshot-interval 3m --log /tmp/bridge.log
# Filter background ticks and BLE traffic:
python3 /Users/nikolaj/Documents/dev/zepp/simulator/zeus_monitor.py --duration 15m --filter "onPerMinute,CMD_GET_INFO,WD_BG,processInfo" -q
```

`npm test` is currently a placeholder and exits with an error. `test_logs.js` is a local diagnostic helper, not a formal test suite.

## Coding Style & Naming Conventions

Use JavaScript modules matching the existing style: two-space indentation in newer helper files, semicolons optional but keep local consistency. Prefer descriptive camelCase for functions/variables and UPPER_SNAKE_CASE for constants, for example `WATCHDRIP_APP_ID` or `fetchDataInFlight`.

Keep Zepp OS API usage explicit. For `@zos/app-service` use `file: 'app-service/index'`.

## Testing Guidelines

Manual testing on a real watch is required for background behavior. After changes, run `zeus build`, install through `zeus bridge`, capture a screenshot, and inspect bridge logs for `WATCH_REQ`, `FETCH_REQ`, `FETCH_RES Success`, App Service lifecycle logs, and `processInfo list`.

## Commit & Pull Request Guidelines

Git history uses short imperative/descriptive messages, for example `add_app-side(config and log)` or `Added Active Max device sources`. Keep commits focused. PRs should include a summary, target device(s), build/install result, screenshots for UI changes, and bridge-log evidence for background or BLE changes.

## Security & Configuration Tips

Do not commit personal bridge logs, glucose data, local URLs, or generated unpacked packages. Keep health-data logging minimal outside debug builds.
