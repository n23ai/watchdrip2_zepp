import { getGlobal } from './global';

let log;
try {
  log = require('@zos/utils').log;
} catch (e) {
  // Ignore
}

try {
  console.log("INIT LOGGER");
  let globalNS = getGlobal();
  if (!globalNS.Logger) {
    if (typeof DeviceRuntimeCore !== 'undefined' && DeviceRuntimeCore.HmLogger) {
      globalNS.Logger = DeviceRuntimeCore.HmLogger;
    } else if (typeof log !== 'undefined' && log && log.getLogger) {
      globalNS.Logger = log;
    } else {
      // Phone companion app fallback (console logger)
      globalNS.Logger = {
        getLogger(name) {
          return {
            debug(...args) { console.log(`[${name}]`, ...args); },
            log(...args) { console.log(`[${name}]`, ...args); },
            warn(...args) { console.warn(`[${name}]`, ...args); },
            error(...args) { console.error(`[${name}]`, ...args); }
          };
        }
      };
      console.log("Console-based Logger polyfill registered for phone-side");
    }
  }
} catch (e) {
  console.log("LOGGER INIT ERROR: " + e);
}

