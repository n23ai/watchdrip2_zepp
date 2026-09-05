import {ALARM_UPDATE_INTERVAL} from "./constants";

export const WATCHDRIP_APP_ID = "43107";


 export const WF_DIR = "/storage/js_apps/data/watchdrip";
 // @zos/fs resolves this relative path against the Mini Program's shared /data.
// App Service, page, and Shortcut Card intentionally use the same filename.
export const WF_INFO_FILE = "info.json";
 export const WF_CONFIG_FILE = "config.json";

export const WATCHDRIP_SETTINGS_DEFAULTS = {
    disableUpdates: false,
    showLog: true,
    useAppFetch: true,
    timerType: 'auto',
};

export const WATCHDRIP_ALARM_SETTINGS_DEFAULTS = {
    fetchInterval: ALARM_UPDATE_INTERVAL,
    fetchParams: "graph=1"
};
