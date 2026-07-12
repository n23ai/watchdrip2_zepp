import {ALARM_UPDATE_INTERVAL} from "./constants";

export const WATCHDRIP_APP_ID = "43107";


 export const WF_DIR = "/storage/js_apps/data/watchdrip";
 // @zos/fs resolves relative paths against the Mini Program's shared /data.
// Use the explicit shared mini-app data URI.  App Service and page/widget
// runtimes can otherwise resolve a relative path against different roots.
export const WF_INFO_FILE = "data://info.json";
 export const WF_CONFIG_FILE = "config.json";

export const WATCHDRIP_SETTINGS_DEFAULTS = {
    disableUpdates: false,
    showLog: true,
    useAppFetch: true,
};

export const WATCHDRIP_ALARM_SETTINGS_DEFAULTS = {
    fetchInterval: ALARM_UPDATE_INTERVAL,
    fetchParams: "graph=1"
};
