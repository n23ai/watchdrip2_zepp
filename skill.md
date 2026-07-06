# Antigravity 2.0 Skill: Zepp OS Bridge Testing

Use this skill when testing or debugging a Zepp OS 3+ app on a real watch or in the Zepp simulator through `zeus bridge`.

This project was debugged primarily on a real Android phone + Amazfit/Cheetah-class watch using:

- Project root: `/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp`
- Real-device install helper: `/Users/nikolaj/Documents/dev/zepp/simulator/install_android_cheetah.py`
- App id: `43107`
- Bridge command: `zeus bridge`

## Core Rules

- Always build or install from the project root.
- Prefer `rg` for code and log searches.
- Use `zeus build` before installing when you need to validate packaging.
- Use interactive `zeus bridge` when the Python installer reports a false timeout.
- Do not leave `zeus bridge` running after the test. Send `exit` before finishing.
- Use `screenshot` inside the bridge shell for UI validation.
- Treat bridge logs as the source of truth for real-device behavior.

## Real Watch Workflow

1. Confirm the phone has Zepp Developer Bridge enabled.
2. Start an interactive bridge session:

```bash
zeus bridge
```

3. In the bridge shell, connect:

```text
connect
```

Expected success:

```text
successfully connected to app-Android
```

4. Install the latest package:

```text
install /Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/dist/<latest>.zab
```

Expected success:

```text
Install lite app result: success
```

5. Take a screenshot:

```text
screenshot
```

The bridge commonly saves screenshots to:

```text
/Users/nikolaj/desktop/screenShot.png
```

6. Close the bridge session:

```text
exit
```

## Build And Install

Run a normal build first:

```bash
zeus build
```

Find the newest `.zab`:

```bash
ls -lt dist
```

The helper script can install to the real watch:

```bash
python3 /Users/nikolaj/Documents/dev/zepp/simulator/install_android_cheetah.py /Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/dist/<latest>.zab
```

Known issue: the script may print `successfully connected to app-Android` and then still fail with a timeout. This is usually a script detection problem, not a real bridge failure. Fall back to interactive `zeus bridge`.

## Common Bridge Problems

`1006: Client already bound`

Cause: another bridge session is still connected, or the phone bridge process is stuck.

Fix:

- Close any active bridge shell with `exit`.
- Toggle Developer Bridge off/on in the Zepp phone app.
- If needed, force quit and reopen the Zepp phone app.

`process[43107] is not existed, cant close`

This usually appears during install when the app was not running. It is not fatal if install later reports success.

`processInfo list => []`

No app/device-side process is running. If the widget shows stale data and this line repeats every minute, no background updater is active.

`processInfo list => [{"appId":43107,...}]`

The app process exists. Check whether logs also show actual fetch activity; a running process alone does not prove data is updating.

## Logs To Look For

Successful watch-to-phone data flow usually includes messages like:

```text
CMD_GET_INFO
WATCH_REQ
FETCH_REQ
FETCH_RES Success
received data
saved info.json successfully
```

Important distinction:

- Opening the main app can trigger a fresh fetch immediately.
- Watching only the shortcut card/widget does not prove background fetch works.
- If the value age grows on the widget while logs show no `FETCH_RES Success`, the widget is only reading stale `info.json`.

## Screenshot Review Checklist

For each UI change, take a screenshot and inspect the actual image.

Check:

- Text is not clipped.
- Card content is centered inside the visible card, not the full round screen unless intentional.
- Shortcut card coordinates may be relative to the full screen, while the visible gray card is narrower.
- Progress bars do not touch adjacent labels unless requested.
- `px()` scaling is used for fixed visual sizes.
- Widget data age is plausible after background update tests.

## Widget And Background Fetch Limits

Zepp shortcut cards and secondary widgets are not reliable places for Bluetooth/network-style real-time data fetching.

Use the widget primarily to:

- Render current data from a local file such as `info.json`.
- Start or schedule a Device/App Service when the runtime allows it.
- Refresh UI from local storage on `onResume` and short UI timers.

Use Page/App Service/Side Service for:

- BLE `MessageBuilder` exchange.
- Phone-side HTTP `fetch`.
- Saving fresh `info.json`.

If a widget remains stale:

1. Confirm whether `info.json` was updated.
2. Check bridge logs for `FETCH_RES Success`.
3. Check whether the app process is running.
4. Confirm the user has granted `device:os.bg_service`.
5. Confirm alarm/background settings are enabled.

## Background Update Strategy

For Zepp OS 3+ compatibility, prefer `@zos/alarm` for persistent background wakeups.

Relevant API:

- `@zos/alarm set`
- `@zos/alarm cancel`
- `REPEAT_MINUTE`
- `url: 'app-service/index'`
- permission: `device:os.alarm`

For Zepp OS 4+, `@zos/timer createSysTimer` may be useful inside App Service, but it raises compatibility concerns if the app declares `minVersion: 3.0.0`.

Avoid relying only on ordinary `setInterval` in App Service. In real-device logs, the process can remain alive while ordinary intervals do not produce periodic fetches.

## App Service Rules

Continuous App Service requires:

- `device:os.bg_service` in `app.json`
- runtime permission request via `queryPermission` / `requestPermission`
- `start({ file: 'app-service/index', complete_func })`

Use `file`, not `url`, for `@zos/app-service start`.

Single execution App Service can be woken by `@zos/alarm` with:

```javascript
setAlarm({
  url: 'app-service/index',
  delay: 60,
  store: true,
  repeat_type: REPEAT_MINUTE,
  repeat_period: 1,
  repeat_duration: 1,
})
```

## WatchDrip2-Specific Notes

Current settings meaning:

- `Disable updates`: disables all data updates.
- `Use Alarms for fetch`: enables background fetch via Zepp alarm/service mechanisms.
- `Show log`: shows watch-side debug text/log UI.

The label `Use Alarms for fetch` is technically accurate but user-hostile. Prefer renaming it to `Background fetch` or Russian `Фоновое обновление`.

Known stale-widget scenario:

- User opens the app.
- Data updates immediately.
- User returns to watchface/widget.
- Widget data age grows.

This means app-open fetch works, but background wakeup is not proven. Validate with bridge logs after leaving the main app closed for several minutes.

## Minimal Real-Device Test Plan

1. Install latest `.zab`.
2. Open WatchDrip2 once to grant/activate permissions if needed.
3. Return to watchface and focus the WatchDrip2 widget.
4. Wait at least 2 minutes.
5. Take a screenshot.
6. Check whether widget age reset or kept growing.
7. Check logs for `FETCH_RES Success` during the period when the app UI was not open.

Pass condition:

- The widget age stays near current time, and bridge logs show background fetches without manually opening the app.

Fail condition:

- Widget age grows, `processInfo list => []` repeats, or there are no `FETCH_RES Success` logs while only the widget is visible.

## Simulator Notes

Simulator is useful for UI and packaging checks but can differ from real watches.

Common simulator quirks:

- Side Service/BLE handshake can hang.
- HTTP POST may fail with `411 Length Required` unless `Content-Length` or a body is supplied.
- Asset resolution can differ from real device targets.

For real background behavior, prefer a physical watch test.

## Final Safety Checklist

Before reporting success:

- `zeus build` succeeded.
- Latest `.zab` was installed or the exact failure was captured.
- Screenshot was inspected when UI changed.
- Bridge logs were checked for the behavior under test.
- Bridge shell was closed with `exit`.
- The final answer states whether the behavior was actually verified on watch.
