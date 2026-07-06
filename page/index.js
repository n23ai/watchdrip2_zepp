import {json2str, str2json} from "../shared/data";
import {DebugText} from "../shared/debug";
import {getGlobal} from "../shared/global";
import { MessageBuilder } from "../shared/message";
import { getText } from "@zos/i18n";
import {
    Colors,
    Commands,
    DATA_STALE_TIME_MS,
    DATA_TIMER_UPDATE_INTERVAL_MS,
    DATA_UPDATE_INTERVAL_MS,
    PROGRESS_ANGLE_INC,
    PROGRESS_UPDATE_INTERVAL_MS,
    XDRIP_UPDATE_INTERVAL_MS,
} from "../utils/config/constants";
import {
    WATCHDRIP_ALARM_SETTINGS_DEFAULTS, WF_DIR,
    WF_INFO_FILE,
} from "../utils/config/global-constants";
import {
    BG_DELTA_TEXT,
    BG_STALE_RECT,
    BG_TIME_TEXT,
    BG_TREND_IMAGE,
    BG_VALUE_TEXT,
    COMMON_BUTTON_ADD_TREATMENT,
    COMMON_BUTTON_SETTINGS,
    COMMON_BUTTON_START_BACKGROUND,
    CONFIG_PAGE_SCROLL,
    DEVICE_TYPE,
    IMG_LOADING_PROGRESS,
    MESSAGE_TEXT,
    RADIO_OFF,
    RADIO_ON,
    TITLE_TEXT,
    VERSION_TEXT,
} from "../utils/config/styles";

import * as fs from "./../shared/fs";
import {WatchdripData} from "../utils/watchdrip/watchdrip-data";
import {getDataTypeConfig, img} from "../utils/helper";
import {gotoSubpage} from "../shared/navigate";
import {WatchdripConfig} from "../utils/watchdrip/config";
import {scheduleBackgroundFetchAlarm} from "../utils/watchdrip/background-alarm";
import {getBackgroundDebugText} from "../utils/watchdrip/background-debug";
import {Path} from "../utils/path";
import {DEVICE_WIDTH} from "../utils/config/device";

import { createWidget, widget, prop, setLayerScrolling, setStatusBarVisible, updateStatusBarTitle, align, text_style } from '@zos/ui'
import { Time, Vibrator } from '@zos/sensor'
import { getPackageInfo, queryPermission, requestPermission } from '@zos/app'
import { start as startAppService } from '@zos/app-service'
import { goBack, home, setLaunchAppTimeout, clearLaunchAppTimeout } from '@zos/router'
import { log, px } from '@zos/utils'
import { setPageBrightTime, resetPageBrightTime, setWakeUpRelaunch } from '@zos/display'
import { getSystemInfo } from '@zos/device'

const logger = log.getLogger("watchdrip_app");
const ENABLE_TREATMENT_UI = false;
const BG_SERVICE_PERMISSION = 'device:os.bg_service';

const {appId} = getPackageInfo();
const ble = require('@zos/ble');

var debug = null;
var watchdrip = null;

function savePageBackgroundDebug(stage, fields = {}) {
    if (!(watchdrip && watchdrip.conf)) {
        return;
    }
    watchdrip.conf.backgroundDebug = {
        stage,
        at: watchdrip.timeSensor.getTime(),
        count: ((watchdrip.conf.backgroundDebug && watchdrip.conf.backgroundDebug.count) || 0) + 1,
        ...fields,
    };
    watchdrip.conf.save();
    watchdrip.updateServiceDebugWidget();
}

function startWatchdripServiceFromPage(source = 'auto') {
    try {
        const permissionState = queryPermission({permissions: [BG_SERVICE_PERMISSION]});
        console.log("watchdrip page bg_service permission state: " + JSON.stringify(permissionState));
        savePageBackgroundDebug(source + '_permission_state', {result: JSON.stringify(permissionState)});

        if (permissionState && permissionState[0] === 2) {
            startWatchdripServiceNow(source);
            return;
        }

        const requestResult = requestPermission({
            permissions: [BG_SERVICE_PERMISSION],
            callback: (result) => {
                console.log("watchdrip page bg_service permission request result: " + JSON.stringify(result));
                savePageBackgroundDebug(source + '_permission_request', {result: JSON.stringify(result)});
                if (result && result[0] === 2) {
                    startWatchdripServiceNow(source);
                }
            }
        });
        console.log("watchdrip page permission request ret: " + requestResult);
    } catch (e) {
        console.log("watchdrip page service permission error: " + e);
        savePageBackgroundDebug(source + '_permission_error', {error: String(e)});
    }
}

function startWatchdripServiceNow(source = 'auto') {
    try {
        console.log("watchdrip page app_service_start_call");
        savePageBackgroundDebug(source + '_service_start_call');
        const ret = startAppService({
            file: 'app-service/index',
            param: 'source=' + source + '&manual=' + (source === 'manual' ? '1' : '0'),
            complete_func: (info) => {
                const result = info ? info.result : 'no-info';
                console.log("watchdrip page app-service start result: " + result);
                savePageBackgroundDebug(source + '_service_start_cb', {result: String(result)});
            }
        });
        console.log("watchdrip page app_service_start_ret: " + ret);
        savePageBackgroundDebug(source + '_service_start_ret', {result: String(ret)});
    } catch (e) {
        console.log("watchdrip page app-service start error: " + e);
        savePageBackgroundDebug(source + '_service_start_error', {error: String(e)});
    }
}

const GoBackType = {NONE: 'none', GO_BACK: 'go_back', HIDE_PAGE: 'hide_page', HIDE: 'hide'};
const PagesType = {
    MAIN: 'main',
    UPDATE: 'update',
    UPDATE_LOCAL: 'update_local',
    HIDE: 'hide',
    CONFIG: 'config',
    ADD_TREATMENT: 'add_treatment'
};
const FetchMode = {DISPLAY: 'display', HIDDEN: 'hidden'};

class Watchdrip {
    constructor() {
        this.createWatchdripDir();
        this.timeSensor = new Time();
        this.vibrate = new Vibrator();
        this.globalNS = getGlobal();
        this.goBackType = GoBackType.NONE;
        this.intervalWatchdog = null;
        this.system_alarm_id = null;
        this.lastInfoUpdate = 0;
        this.lastUpdateAttempt = null;
        this.lastUpdateSucessful = false;
        this.updatingData = false;
        this.foregroundMessageBuilder = null;
        this.foregroundFetchInFlight = false;
        this.intervalTimer = null;
        this.progressTimer = null;
        this.serviceDebugTextWidget = null;
        this.updateIntervals = DATA_UPDATE_INTERVAL_MS;
        this.fetchMode = FetchMode.DISPLAY;
        this.conf = new WatchdripConfig();
        debug.setEnabled(this.conf.settings.showLog);

        this.infoFile = new Path("full", WF_INFO_FILE);
        this.watchdripData = new WatchdripData(this.timeSensor);
    }

    start(data) {
        debug.log("start");
        this.globalNS = getGlobal();
        debug.log(data);
        
        let pageTitle = '';
        this.goBackType = GoBackType.NONE;
        switch (data.page) {
            case PagesType.MAIN:
                let pkg = getPackageInfo();
                pageTitle = pkg.name
                this.main_page();
                break;
            case PagesType.UPDATE:
                this.goBackType = GoBackType.HIDE;
                this.conf.alarmSettings = {...this.conf.alarmSettings, ...data.params};
                this.fetch_page();
                break;
            case PagesType.UPDATE_LOCAL:
                this.goBackType = GoBackType.HIDE;
                this.fetch_page_local();
                break;
            case PagesType.HIDE:
                this.hide_page();
                break;
            case PagesType.CONFIG:
                pageTitle = getText("settings");
                this.config_page();
                break;
            case PagesType.ADD_TREATMENT:
                pageTitle = getText("add_treatment");
                this.add_treatment_page()
                break;
        }

        if (pageTitle) {
            if (DEVICE_TYPE === "round") {
                this.titleTextWidget = createWidget(widget.TEXT, {...TITLE_TEXT, text: pageTitle})
            } else {
                updateStatusBarTitle(pageTitle);
            }
        }
    }

    main_page() {
        setPageBrightTime({ brightTime: 60000 });
        setWakeUpRelaunch(true);
        this.prepareNextAlarm();
        scheduleBackgroundFetchAlarm('page');
        let pkg = getPackageInfo();
        this.versionTextWidget = createWidget(widget.TEXT, {...VERSION_TEXT, text: "v" + pkg.version});
        this.messageTextWidget = createWidget(widget.TEXT, {...MESSAGE_TEXT, text: ""});
        this.bgValTextWidget = createWidget(widget.TEXT, BG_VALUE_TEXT);
        this.bgValTimeTextWidget = createWidget(widget.TEXT, BG_TIME_TEXT);
        this.bgDeltaTextWidget = createWidget(widget.TEXT, BG_DELTA_TEXT);
        this.bgTrendImageWidget = createWidget(widget.IMG, BG_TREND_IMAGE);
        this.bgStaleLine = createWidget(widget.FILL_RECT, BG_STALE_RECT);
        this.bgStaleLine.setProperty(prop.VISIBLE, false);
        this.serviceDebugTextWidget = createWidget(widget.TEXT, {
            x: px(30),
            y: px(285),
            w: DEVICE_WIDTH - px(60),
            h: px(28),
            color: 0x999999,
            text_size: px(18),
            align_h: align.CENTER_H,
            align_v: align.CENTER_V,
            text_style: text_style.NONE,
            text: getBackgroundDebugText(this.conf, this.timeSensor),
        });

        if (this.conf.settings.disableUpdates) {
            this.showMessage(getText("data_upd_disabled"));
        } else {
            if (this.readInfo()) {
                this.updateWidgets();
            }
            this.readLocalInfo();
            this.fetchRemoteInfo();
            this.startDataUpdates();
        }

        createWidget(widget.BUTTON, {
            ...COMMON_BUTTON_SETTINGS,
            click_func: (button_widget) => {
                gotoSubpage(PagesType.CONFIG);
            },
        });

        createWidget(widget.BUTTON, {
            ...COMMON_BUTTON_START_BACKGROUND,
            click_func: (button_widget) => {
                this.startBackgroundServiceManual();
            },
        });

        if (ENABLE_TREATMENT_UI) {
            createWidget(widget.BUTTON, {
                ...COMMON_BUTTON_ADD_TREATMENT,
                click_func: (button_widget) => {
                    gotoSubpage(PagesType.ADD_TREATMENT);
                },
            });
        }
    }

    startBackgroundServiceManual() {
        debug.log("manual background service start");
        try {
            this.vibrateNow();
            savePageBackgroundDebug('manual_button_pressed');
            const alarmId = scheduleBackgroundFetchAlarm('manual_button');
            savePageBackgroundDebug('manual_alarm_scheduled', {alarmId});
            startWatchdripServiceFromPage('manual');
        } catch (e) {
            debug.log("manual background start error: " + e);
            savePageBackgroundDebug('manual_start_error', {error: String(e)});
        }
    }

    getConfigData() {
        let dataList = [];

        Object.entries(this.conf.settings).forEach(entry => {
            const [key, value] = entry;
            let stateImg = RADIO_OFF
            if (value) {
                stateImg = RADIO_ON
            }
            dataList.push({
                key: key,
                name: getText(key),
                state_src: img('icons/' + stateImg)
            });
        });
        this.configDataList = dataList;

        let dataTypeConfig = [
            getDataTypeConfig(1, 0, dataList.length)
        ]
        return {
            data_array: dataList,
            data_count: dataList.length,
            data_type_config: dataTypeConfig,
            data_type_config_count: dataTypeConfig.length
        }
    }

    add_treatment_page() {
        //not implemented
    }

    config_page() {
        setLayerScrolling(false);

        this.configScrollList = createWidget(widget.SCROLL_LIST,
            {
                ...CONFIG_PAGE_SCROLL,
                item_click_func: (list, index) => {
                    debug.log(index);
                    const key = this.configDataList[index].key
                    let val = this.conf.settings[key]
                    this.conf.settings[key] = !val;
                    this.conf.settingsTime = this.timeSensor.getTime(); // upd settings time
                    //update list
                    this.configScrollList.setProperty(prop.UPDATE_DATA, {
                        ...this.getConfigData(),
                        //Refresh the data and stay on the current page. If it is not set or set to 0, it will return to the top of the list.
                        on_page: 1
                    })
                },
                ...this.getConfigData()
            });
    }

    startDataUpdates() {
        if (this.intervalTimer != null) return; //already started
        debug.log("startDataUpdates");
        this.intervalTimer = this.globalNS.setInterval(() => {
            this.checkUpdates();
        }, DATA_TIMER_UPDATE_INTERVAL_MS);
    }

    stopDataUpdates() {
        if (this.intervalTimer !== null) {
            this.globalNS.clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }

    isTimeout(time, timeout_ms) {
        if (!time) {
            return false;
        }
        return this.timeSensor.getTime() - time > timeout_ms;
    }

    handleRareCases() {
        let fetch = false;
        if (this.lastUpdateAttempt == null) {
            debug.log("initial fetch");
            fetch = true;
        } else if (this.isTimeout(this.lastUpdateAttempt, DATA_STALE_TIME_MS)) {
            debug.log("the side app not responding, force update again");
            fetch = true;
        }
        if (fetch) {
            this.fetchRemoteInfo();
        }
    }

    checkUpdates() {
        this.updateTimesWidget();
        if (this.updatingData) {
            return;
        }
        let lastInfoUpdate = this.readLastUpdate();
        if (!lastInfoUpdate) {
            this.handleRareCases();
        } else {
            if (this.lastUpdateSucessful) {
                if (this.lastInfoUpdate !== lastInfoUpdate) {
                    debug.log("update from remote");
                    this.readInfo();
                    this.lastInfoUpdate = lastInfoUpdate;
                    this.updateWidgets();
                    return;
                }
                if (this.isTimeout(lastInfoUpdate, this.updateIntervals)) {
                    debug.log("reached updateIntervals");
                    this.fetchRemoteInfo();
                    return;
                }
                const bgTimeOlder = this.isTimeout(this.watchdripData.getBg().time, XDRIP_UPDATE_INTERVAL_MS);
                const statusNowOlder = this.isTimeout(this.watchdripData.getStatus().now, XDRIP_UPDATE_INTERVAL_MS);
                if (bgTimeOlder || statusNowOlder) {
                    if (!this.isTimeout(this.lastUpdateAttempt, DATA_STALE_TIME_MS)) {
                        debug.log("wait DATA_STALE_TIME");
                        return;
                    }
                    debug.log("data older than sensor update interval");
                    this.fetchRemoteInfo();
                    return;
                }
                debug.log("data not modified");
            } else {
                this.handleRareCases();
            }
        }
    }

    fetch_page() {
        debug.log("fetch_page");
        setStatusBarVisible(false);
        this.prepareNextAlarm();
        if (this.conf.settings.disableUpdates || !this.conf.settings.useAppFetch) {
            this.handleGoBack();
            return;
        }
        setPageBrightTime({ brightTime: 999000 });
        this.progressWidget = createWidget(widget.IMG, IMG_LOADING_PROGRESS);
        this.progressAngle = 0;
        this.fetchMode = FetchMode.HIDDEN;
        this.startLoader();
        this.fetchRemoteInfo({
            updateUI: false,
            onDone: () => {
                this.stopLoader();
                this.handleGoBack();
            }
        });
    }

    fetch_page_local() {
        debug.log("fetch_page_local");
        setStatusBarVisible(false);
        this.prepareNextAlarm();
        if (this.conf.settings.disableUpdates || !this.conf.settings.useAppFetch) {
            this.handleGoBack();
            return;
        }
        setPageBrightTime({ brightTime: 999000 });
        this.progressWidget = createWidget(widget.IMG, IMG_LOADING_PROGRESS);
        this.progressAngle = 0;
        this.fetchMode = FetchMode.HIDDEN;
        this.startLoader();
        this.fetchRemoteInfo({
            updateUI: false,
            onDone: () => {
                this.stopLoader();
                this.handleGoBack();
            }
        });
    }

    hide_page() {
        home();
    }

    readLocalInfo(params = '') {
        debug.log("readLocalInfo");
        if (this.fetchMode === FetchMode.DISPLAY) {
            this.showMessage(getText("connecting"));
        }
        
        let data = this.infoFile.fetchJSON();
        if (data) {
            this.watchdripData.setData(data);
            this.watchdripData.updateTimeDiff();
            this.updateWidgets();
        }
        
        if (this.fetchMode === FetchMode.DISPLAY) {
            this.setMessageVisibility(false);
            this.setBgElementsVisibility(true);
        } else {
            this.stopLoader();
            this.handleGoBack();
        }
    }

    getForegroundMessageBuilder() {
        if (!this.foregroundMessageBuilder) {
            this.foregroundMessageBuilder = new MessageBuilder({ appId, ble });
            this.foregroundMessageBuilder.connect();
        }
        return this.foregroundMessageBuilder;
    }

    fetchRemoteInfo(options = {}) {
        const updateUI = options.updateUI !== false;
        const onDone = typeof options.onDone === "function" ? options.onDone : null;
        const finish = () => {
            if (onDone) {
                onDone();
            }
        };

        if (this.foregroundFetchInFlight) {
            debug.log("fetchRemoteInfo already running");
            finish();
            return;
        }
        debug.log("fetchRemoteInfo");
        this.foregroundFetchInFlight = true;
        this.updatingData = true;
        this.lastUpdateAttempt = this.timeSensor.getTime();
        this.conf.infoLastUpdAttempt = this.lastUpdateAttempt;
        this.conf.infoLastUpdSucess = false;
        this.conf.save();

        let fetchParams = WATCHDRIP_ALARM_SETTINGS_DEFAULTS.fetchParams;
        if (this.conf.alarmSettings && this.conf.alarmSettings.fetchParams) {
            fetchParams = this.conf.alarmSettings.fetchParams;
        }

        try {
            this.getForegroundMessageBuilder().requestCb({
                method: Commands.getInfo,
                params: fetchParams,
            }, {timeout: 5000}, (error, data) => {
                this.foregroundFetchInFlight = false;
                this.updatingData = false;
                if (error) {
                    debug.log("fetchRemoteInfo error: " + error);
                    this.lastUpdateSucessful = false;
                    this.conf.infoLastUpdAttempt = this.timeSensor.getTime();
                    this.conf.infoLastUpdSucess = false;
                    this.conf.save();
                    finish();
                    return;
                }

                let {result: info = {}} = data;
                if (info && !info.error) {
                    const updateTime = this.saveInfo(info);
                    this.lastInfoUpdate = updateTime;
                    this.lastUpdateSucessful = true;
                    this.conf.infoLastUpdAttempt = updateTime;
                    this.conf.infoLastUpd = updateTime;
                    this.conf.infoLastUpdSucess = true;
                    this.conf.save();
                    if (updateUI) {
                        this.readInfo();
                        this.updateWidgets();
                    }
                    debug.log("fetchRemoteInfo success");
                } else {
                    debug.log("fetchRemoteInfo bad result: " + JSON.stringify(info));
                    this.lastUpdateSucessful = false;
                    this.conf.infoLastUpdAttempt = this.timeSensor.getTime();
                    this.conf.infoLastUpdSucess = false;
                    this.conf.save();
                }
                finish();
            });
        } catch (e) {
            this.foregroundFetchInFlight = false;
            this.updatingData = false;
            this.lastUpdateSucessful = false;
            this.conf.infoLastUpdAttempt = this.timeSensor.getTime();
            this.conf.infoLastUpdSucess = false;
            this.conf.save();
            debug.log("fetchRemoteInfo exception: " + e);
            finish();
        }
    }

    startLoader() {
        if (!this.progressWidget) {
            return;
        }
        this.progressWidget.setProperty(prop.VISIBLE, true);
        this.progressWidget.setProperty(prop.MORE, {angle: this.progressAngle});
        this.progressTimer = this.globalNS.setInterval(() => {
            this.updateLoader();
        }, PROGRESS_UPDATE_INTERVAL_MS);
    }

    updateLoader() {
        this.progressAngle = this.progressAngle + PROGRESS_ANGLE_INC;
        if (this.progressAngle >= 360) this.progressAngle = 0;
        this.progressWidget.setProperty(prop.MORE, {angle: this.progressAngle});
    }

    stopLoader() {
        if (this.progressTimer !== null) {
            this.globalNS.clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
        if (!this.progressWidget) {
            return;
        }
        this.progressWidget.setProperty(prop.VISIBLE, false);
    }

    updateWidgets() {
        debug.log('updateWidgets');
        this.updateServiceDebugWidget();
        this.setMessageVisibility(false);
        this.setBgElementsVisibility(true);
        this.updateValuesWidget()
        this.updateTimesWidget()
    }

    updateServiceDebugWidget() {
        if (!this.serviceDebugTextWidget) {
            return;
        }
        this.conf.read();
        this.serviceDebugTextWidget.setProperty(prop.MORE, {
            text: getBackgroundDebugText(this.conf, this.timeSensor),
        });
    }

    updateValuesWidget() {
        let bgValColor = Colors.white;
        let bgObj = this.watchdripData.getBg();
        if (bgObj.isHigh) {
            bgValColor = Colors.bgHigh;
        } else if (bgObj.isLow) {
            bgValColor = Colors.bgLow;
        }

        this.bgValTextWidget.setProperty(prop.MORE, {
            text: bgObj.getBGVal(),
            color: bgValColor,
        });

        this.bgDeltaTextWidget.setProperty(prop.MORE, {
            text: bgObj.delta + " " + this.watchdripData.getStatus().getUnitText()
        });

        this.bgTrendImageWidget.setProperty(prop.SRC, bgObj.getArrowResource());
        this.bgStaleLine.setProperty(prop.VISIBLE, this.watchdripData.isBgStale());
    }

    updateTimesWidget() {
        let bgObj = this.watchdripData.getBg();
        this.bgValTimeTextWidget.setProperty(prop.MORE, {
            text: this.watchdripData.getTimeAgo(bgObj.time),
        });
    }

    showMessage(text) {
        this.setBgElementsVisibility(false);
        this.messageTextWidget.setProperty(prop.MORE, {text: text});
        this.setMessageVisibility(true);
    }

    setBgElementsVisibility(visibility) {
        this.bgValTextWidget.setProperty(prop.VISIBLE, visibility);
        this.bgValTimeTextWidget.setProperty(prop.VISIBLE, visibility);
        this.bgTrendImageWidget.setProperty(prop.VISIBLE, visibility);
        this.bgStaleLine.setProperty(prop.VISIBLE, visibility);
        this.bgDeltaTextWidget.setProperty(prop.VISIBLE, visibility);
    }

    setMessageVisibility(visibility) {
        this.messageTextWidget.setProperty(prop.VISIBLE, visibility);
    }

    readInfo() {
        let data = this.infoFile.fetchJSON();
        if (data) {
            debug.log("data was read");
            this.watchdripData.setData(data);
            this.watchdripData.timeDiff = 0;
            data = null;
            return true
        }
        return false;
    }

    readLastUpdate() {
        debug.log("readLastUpdate");
        this.conf.read();
        this.lastUpdateAttempt = this.conf.infoLastUpdAttempt;
        this.lastUpdateSucessful = this.conf.infoLastUpdSucess;

        return this.conf.infoLastUpd;
    }

    resetLastUpdate() {
        debug.log("resetLastUpdate");
        this.lastUpdateAttempt = this.timeSensor.getTime();
        this.lastUpdateSucessful = false;
        this.conf.infoLastUpdAttempt = this.lastUpdateAttempt
        this.conf.infoLastUpdSucess = this.lastUpdateSucessful;
    }

    createWatchdripDir() {
        let osVersion;
        try {
            let systemInfo = getSystemInfo();
            osVersion = Number(systemInfo.osVersion)
        } catch (e) {
            osVersion = 1;
        }
        if (osVersion < 3) {
            let dir = new Path("full", WF_DIR);
            if (!dir.exists()) {
                dir.mkdir();
            }
        }
    }

    saveInfo(info) {
        debug.log("saveInfo");
        if (typeof info === 'string') {
            this.infoFile.overrideWithText(info);
        } else {
            this.infoFile.overrideWithJSON(info);
        }
        this.lastUpdateSucessful = true;
        let time = this.timeSensor.getTime();
        this.conf.infoLastUpd = time
        this.conf.infoLastUpdSucess = this.lastUpdateSucessful;
        this.conf.save();
        return time;
    }

    saveAlarmId(alarm_id) {
        debug.log("saveAlarmId");
        this.conf.alarm_id = alarm_id;
    }

    disableCurrentAlarm() {
        debug.log("disableCurrentAlarm");
        const alarm_id = this.conf.alarm_id;
        if (alarm_id && alarm_id !== -1) {
            debug.log("stop old app alarm");
            clearLaunchAppTimeout({ timeoutId: alarm_id });
            this.saveAlarmId('-1');
        }
    }

    prepareNextAlarm() {
        this.disableCurrentAlarm();
        if (this.conf.settings.disableUpdates || !this.conf.settings.useAppFetch) {
            if (this.system_alarm_id !== null) {
                clearLaunchAppTimeout({ timeoutId: this.system_alarm_id });
            }
            return;
        }
        debug.log("Next alarm in " + this.conf.alarmSettings.fetchInterval + "s");
        if (this.system_alarm_id == null) {
            this.system_alarm_id = setLaunchAppTimeout({
                appId: appId,
                url: "page/index",
                params: json2str({ page: PagesType.UPDATE_LOCAL }),
                delay: this.conf.alarmSettings.fetchInterval * 1000,
            });
            this.saveAlarmId(this.system_alarm_id);
        }
    }

    handleGoBack() {
        switch (this.goBackType) {
            case GoBackType.NONE:
                break;
            case GoBackType.GO_BACK:
                goBack();
                break;
            case GoBackType.HIDE:
                this.hide_page();
                break;
            case GoBackType.HIDE_PAGE:
                gotoSubpage(PagesType.HIDE);
                break;
        }
    }

    vibrateNow() {
        this.vibrate.stop();
        this.vibrate.setMode(24);
        this.vibrate.start();
    }

    onDestroy() {
        this.conf.save();
        this.stopDataUpdates();
        if (this.foregroundMessageBuilder) {
            this.foregroundMessageBuilder.disConnect();
            this.foregroundMessageBuilder = null;
        }
        this.vibrate.stop();
        resetPageBrightTime();
    }
}

Page({
    onInit(p) {
        logger.debug("page onInit invoked");
        this.p = p;
    },
    build() {
        logger.debug("page build invoked");
        try {
            debug = new DebugText();
            debug.setLines(20);
            logger.log("page build widgets");
            let data = {page: PagesType.MAIN};
            try {
                if (!(!this.p || this.p === 'undefined')) {
                    data = JSON.parse(this.p);
                }
            } catch (e) {
                data = {page: this.p}
            }

            watchdrip = new Watchdrip()
            watchdrip.start(data);
        } catch (e) {
            logger.error('LifeCycle Error ' + e)
            if (debug) {
                debug.log('LifeCycle Error ' + e)
                e && e.stack && e.stack.split(/\n/).forEach((i) => debug.log('error stack:' + i))
            }
        }
    },
    onDestroy() {
        logger.debug("page onDestroy invoked");
        if (watchdrip) {
            watchdrip.onDestroy();
        }
    },
});
