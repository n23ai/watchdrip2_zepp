# Repository Guidelines

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

`npm test` is currently a placeholder and exits with an error. `test_logs.js` is a local diagnostic helper, not a formal test suite.

## Coding Style & Naming Conventions

Use JavaScript modules matching the existing style: two-space indentation in newer helper files, semicolons optional but keep local consistency. Prefer descriptive camelCase for functions/variables and UPPER_SNAKE_CASE for constants, for example `WATCHDRIP_APP_ID` or `scheduleBackgroundFetchAlarm`.

Keep Zepp OS API usage explicit. For `@zos/app-service` use `file: 'app-service/index'`; for `@zos/alarm` use `url`.

## Testing Guidelines

Manual testing on a real watch is required for background behavior. After changes, run `zeus build`, install through `zeus bridge`, capture a screenshot, and inspect bridge logs for `WATCH_REQ`, `FETCH_REQ`, `FETCH_RES Success`, App Service lifecycle logs, and `processInfo list`.

## Commit & Pull Request Guidelines

Git history uses short imperative/descriptive messages, for example `add_app-side(config and log)` or `Added Active Max device sources`. Keep commits focused. PRs should include a summary, target device(s), build/install result, screenshots for UI changes, and bridge-log evidence for background or BLE changes.

## Security & Configuration Tips

Do not commit personal bridge logs, glucose data, local URLs, or generated unpacked packages. Keep health-data logging minimal outside debug builds.
