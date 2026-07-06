# Handoff: WatchDrip2 Zepp Background Widget

## Goal
Make the WatchDrip2 Zepp OS 3+ widget/card update glucose in the background without opening the main watch app. Verify only on real watch through `zeus bridge`.

## Current Status
- Not solved: user reports widget still does not update in background.
- Foreground works: opening WatchDrip2 on the watch triggers fresh `GET_INFO` and saves data.
- Widget UI works but appears to read stale local `info.json` while on watchface/card.
- Watch settings are not the blocker: WatchDrip2 is enabled as the background app on the watch.
- Latest installed build attempted alarm-based App Service wake, but user reports no background widget update.

## Key Decisions
- Do not do direct BLE/MessageBuilder fetch inside `data-widget/index.js`; it previously broke package/install behavior.
- Widget should remain mostly read-only: render local `info.json`, schedule/check background path, show temporary debug.
- `@zos/app-service start/stop` must use `file: 'app-service/index'`, not `url`.
- Continuous App Service start from page/widget currently returns `result=false` on the real watch.
- `@zos/alarm` is still the best Zepp OS 3+ candidate for background wake, but it is not proven here.
- Separate two failures: background fetch not happening vs. fetch happening but widget runtime not repainting.

## Important Files
- `/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/app.js`
- `/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/app-service/index.js`
- `/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/data-widget/index.js`
- `/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/page/index.js`
- `/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/app-side/index.js`
- `/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/utils/watchdrip/background-alarm.js`
- `/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/utils/watchdrip/background-debug.js`
- `/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/history_debug.md`
- `/Users/nikolaj/Documents/dev/zepp/specification/AGENT.md`

## Already Tried
- Foreground fetch from app page: works.
- `device:os.bg_service` permission in manifest and query/request calls: added.
- App Service start from app/page/widget with `file`: callback returns false in observed cases.
- `@zos/alarm` helper from app/page/widget/service.
- Repeat minute alarm, then one-shot self-rescheduling alarm.
- App Service short-run mode: fetch once after alarm launch, then `exit()`.
- Removed timers/polyfill from App Service path.
- Persistent debug state and visible debug text on app/widget.
- Widget layout fixes including wider/thicker graph bar.
- Install/verify via real `zeus bridge`.

## Commands
Build:
```bash
zeus build
```

Bridge:
```bash
zeus bridge
```

Inside bridge:
```text
connect
install /Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/dist/<latest>.zab
screenshot
exit
```

Install helper:
```bash
python3 /Users/nikolaj/Documents/dev/zepp/simulator/install_android_cheetah.py
```

## Next Options To Check
1. Add a visible button in the main watch app: `Start background service`. On tap, request `device:os.bg_service`, call `start({ file: 'app-service/index' })`, schedule alarm, and show exact result/error. This may match older Zepp OS patterns where user action explicitly starts background work.
2. Add a second button: `Test alarm now`. It schedules `@zos/alarm` with a short delay to `app-service/index.js`; verify whether `service_onInit`, `fetch_start`, `fetch_saved` appear while the app is closed.
3. Add a file-based heartbeat: service writes `lastServiceRun`, `lastAlarmSource`, `lastFetchSaved`; widget only displays those values. This proves whether fetch file updates happen even if glucose UI is stale.
4. If alarm/service fetch succeeds but widget stays stale, investigate widget repaint/cache limitations and consider showing only values refreshed on widget resume.
5. If alarm never fires and service start keeps returning false, consider a user-facing requirement: open WatchDrip2 once and press `Start background service`, or accept that OS 3+ on this device blocks true per-minute widget background fetch.
