import {
    WATCHDRIP_ALARM_SETTINGS_DEFAULTS,
    WATCHDRIP_SETTINGS_DEFAULTS,
    WF_CONFIG_FILE,
} from "../config/global-constants";

import * as fs from "./../../shared/fs";
import {Path} from "../path";

let file;
export class WatchdripConfig {
    constructor() {
        file = new Path("full", WF_CONFIG_FILE);

        this.alarmSettings = {...WATCHDRIP_ALARM_SETTINGS_DEFAULTS};
        this.settings = {...WATCHDRIP_SETTINGS_DEFAULTS};
        this.settingsTime = 0;
        this.infoLastUpd= 0;
        this.infoLastUpdAttempt = 0;
        this.infoLastUpdSucess = false
        this.configVersion = 2;
        this.backgroundDebug = {};

        this.alarm_id = '-1';
        this.page_timeout_id = '-1';
        this.service_alarm_id = '-1';
        this.read();
    }

    read() {
        let parsed = file.fetchJSON();
        if (parsed) {
            const parsedConfigVersion = parsed.configVersion || 1;
            parsed.settings = {...WATCHDRIP_SETTINGS_DEFAULTS, ...parsed.settings};
            if (parsedConfigVersion < 2) {
                parsed.settings.useAppFetch = true;
            }
            parsed.alarmSettings = {...WATCHDRIP_ALARM_SETTINGS_DEFAULTS, ...parsed.alarmSettings};
            if (parsed.page_timeout_id === undefined || parsed.page_timeout_id === null) {
                parsed.page_timeout_id = '-1';
            }
            parsed.alarmSettings.fetchInterval = Math.min(
                parsed.alarmSettings.fetchInterval || WATCHDRIP_ALARM_SETTINGS_DEFAULTS.fetchInterval,
                WATCHDRIP_ALARM_SETTINGS_DEFAULTS.fetchInterval
            );
            parsed.configVersion = 2;
            Object.assign(this, parsed);
        }
    }

    save() {
        file.overrideWithJSON(this);
    }
}
