# WatchDrip2: verified background mode

## Golden path

The working background architecture is:

```text
visible page -> @zos/app-service.start -> continuous AppService
             -> Time.onPerMinute -> BLE/RPC GET_INFO
             -> phone AppSideService HTTP fetch -> info.json on the watch
             -> read-only widget
```

This path has produced successful requests while the watch application UI was closed and the watch was on the watchface. It is the baseline for all further changes. A process entry or a changing debug label alone is not proof: a successful cycle must contain the minute tick, phone request/response, watch response, and save markers.

**Verification Note**: This architecture successfully completed a strict 10-minute real device stress test, logging continuous minute ticks without being killed by Zepp OS memory optimizations.

## Fixed parameters

| Parameter | Required value |
| --- | --- |
| App ID | `43107` |
| Build target | `common`, real 480x480 watch |
| Permission | `device:os.bg_service`; query result `2` means authorized |
| Service file | `app-service/index` |
| Start parameter | `mode=continuous&source=manual` |
| Service mode | Continuous; do not call `exit()` after a response |
| First fetch | Immediately from `AppService.onInit` |
| Periodic trigger | `Time.onPerMinute` |
| Minimum fetch spacing | `45000 ms` |
| RPC command | `GET_INFO` (`Commands.getInfo`) |
| Fetch parameters | `graph=1` |
| RPC timeout | `15000 ms` |
| Watchdog | `20000 ms` |
| Watch cache | `info.json`; success stage is `fetch_saved` |
| Widget role | Read-only cache consumer; focused refresh every 5 seconds |

The start action is idempotent: the visible page queries `getAllAppServices()` before calling `start()`. The user-facing button owns the permission request. The application does not use alarm or hidden-page wake as part of the production background path.

## Required log chain

After the main UI has been closed, each healthy cycle must show:

```text
watchdrip service onPerMinute
watchdrip service fetchInfo triggered
WATCH_REQ
FETCH_REQ
FETCH_RES Success
watchdrip service received data
watchdrip service saved info.json successfully
```

Expected spacing between minute ticks is approximately 45-75 seconds. The glucose value does not need to change on every request because the CGM source may publish less frequently.

## Regression guard

- Do not remove the visible background-service start action or its permission flow.
- Do not replace `Time.onPerMinute` with `@zos/alarm`, widget wake, or `setLaunchAppTimeout`.
- Do not add `exit()` to the successful continuous path.
- Keep widget code free of BLE/RPC and scheduler ownership.
- Do not report `fetch_saved` unless a non-error response was written to `info.json`.
- Any change to service startup, minute scheduling, MessageBuilder transport, or file saving requires a clean uninstall/install test and at least five background minute cycles.
- If timers become unavailable in App Service and logs stop at `fetch_catch_sync`, restore callback-only `requestCb` with `timeout: 0` and remove the timer watchdog before testing other wake mechanisms.

## Clean-install verification

The successful clean-install evidence must be recorded here after the real-watch run:

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
- Only `app-widget` is registered. The unused `secondary-widget` entry was removed from `app.json`.
- The card is strictly read-only: it does not request permission, start services, schedule wakeups, use BLE, or write debug/config files.
- `info.json` is read once in `build` and again on every `onResume`.
- There is no periodic file polling. While focused, a 60-second in-memory timer updates only the displayed measurement age and is cleared in `onPause` and `onDestroy`.
- Card coordinates are relative to `getAppWidgetSize()`, not the full watch screen.
- Missing or malformed cache renders `--` and recovers on the next `onResume` after a valid foreground/background save.

Real-watch UI evidence on 2026-07-10 confirmed that the new Shortcut Card reads the shared `info.json` after a foreground fetch and renders the value, trend arrow, delta, unit, age, and range pointer. The initial `--` immediately after installation was an empty-cache state, not a widget lifecycle failure.

An attempted synchronous write/read-back verification inside App Service stopped the previously stable background sequence after two requests. It was removed. Do not reintroduce file read-back or extra parsing into the proven minute callback without an isolated A/B build and a new 10-minute test.

Current widget-restoration package:

| Field | Result |
| --- | --- |
| Package | `43107-WatchDrip2_zepp-1.0.0-20260710232845.zab` |
| SHA-256 | `746d2775f2eb0a079ea46920b39db18fc24ba80e2979e8ae86e12212e07cc2bb` |
| Install | Success |
| Shortcut Card foreground-cache read | Success |
| Background-cache refresh | Pending final post-install service run |
