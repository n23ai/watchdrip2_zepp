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
import {getBackgroundDebugText, markBackgroundDebug} from "../utils/watchdrip/background-debug";
import {Path} from "../utils/path";
import {DEVICE_WIDTH} from "../utils/config/device";

import { createWidget, widget, prop, setLayerScrolling, setStatusBarVisible, updateStatusBarTitle, align, text_style } from '@zos/ui'
import { Time, Vibrator } from '@zos/sensor'
import { getPackageInfo, queryPermission, requestPermission } from '@zos/app'
import { getAllAppServices, start as startAppService, stop as stopAppService } from '@zos/app-service'
import { goBack, home } from '@zos/router'
import { log, px } from '@zos/utils'
import { setPageBrightTime, resetPageBrightTime, setWakeUpRelaunch } from '@zos/display'
import { getSystemInfo } from '@zos/device'

const logger = log.getLogger("watchdrip_app");
const ENABLE_TREATMENT_UI = false;
const BG_SERVICE_PERMISSION = 'device:os.bg_service';
const BG_SERVICE_FILE = 'app-service/index';
const BG_SERVICE_PARAM = 'mode=continuous&source=manual';
const {appId} = getPackageInfo();
const ble = require('@zos/ble');

var debug = null;
var watchdrip = null;
var backgroundServiceStartPending = false;

function setBackgroundServiceControl(stage, text) {
    if (!(watchdrip && watchdrip.conf)) return;
    watchdrip.conf.read();
    watchdrip.conf.serviceControl = {
        stage,
        text,
        at: watchdrip.timeSensor.getTime(),
    };
    watchdrip.conf.save();
    if (watchdrip.backgroundServiceButton) {
        watchdrip.backgroundServiceButton.setProperty(prop.MORE, {text});
    }
}

function savePageBackgroundDebug(stage, fields = {}) {
    if (!(watchdrip && watchdrip.conf)) {
        return;
    }
    watchdrip.conf.read();
    const previous = watchdrip.conf.backgroundDebug || {};
    const at = watchdrip.timeSensor.getTime();
    const item = {
        stage,
        at,
        result: fields.result,
        error: fields.error,
        alarmId: fields.alarmId,
    };
    watchdrip.conf.backgroundDebug = {
        stage,
        at,
        count: (previous.count || 0) + 1,
        history: [...(previous.history || []), item].slice(-6),
        ...fields,
    };
    watchdrip.conf.save();
    watchdrip.updateServiceDebugWidget();
}

function isWatchdripServiceRunning(serviceList) {
    if (!Array.isArray(serviceList)) {
        return false;
    }
    for (let i = 0; i < serviceList.length; i++) {
        if (String(serviceList[i]).replace(/\.js$/, '') === BG_SERVICE_FILE) {
            return true;
        }
    }
    return false;
}

function invokeWatchdripServiceStart() {
    try {
        if (backgroundServiceStartPending) {
            savePageBackgroundDebug('manual_service_start_pending');
            return;
        }

        backgroundServiceStartPending = true;
        console.log("watchdrip app_service_start_call file=" + BG_SERVICE_FILE);
        logger.log("app_service_start_call file=" + BG_SERVICE_FILE);
        savePageBackgroundDebug('manual_service_start_call', {result: BG_SERVICE_PARAM});
        setBackgroundServiceControl('service_start_call', 'BG starting...');
        const startResult = startAppService({
            file: BG_SERVICE_FILE,
            param: BG_SERVICE_PARAM,
            complete_func: (info) => {
                backgroundServiceStartPending = false;
                const result = info ? info.result : 'no-info';
                console.log("watchdrip app-service start callback: " + result);
                logger.log("app-service start callback: " + result);
                savePageBackgroundDebug('manual_service_start_cb', {result: String(result)});
                let running = false;
                try {
                    running = isWatchdripServiceRunning(getAllAppServices() || []);
                } catch (e) {}
                setBackgroundServiceControl(
                    'service_start_cb',
                    'BG cb=' + result + ' run=' + running
                );
            }
        });
        console.log("watchdrip app_service_start_ret: " + startResult);
        logger.log("app_service_start_ret: " + startResult);
        savePageBackgroundDebug('manual_service_start_ret', {result: String(startResult)});
        setBackgroundServiceControl('service_start_ret', 'BG ret=' + startResult);
        if (Number(startResult) !== 0) {
            backgroundServiceStartPending = false;
        }
    } catch (e) {
        backgroundServiceStartPending = false;
        console.log("watchdrip app-service start error: " + e);
        logger.error("app-service start error: " + e);
        savePageBackgroundDebug('manual_service_start_error', {error: String(e)});
        setBackgroundServiceControl('service_start_error', 'BG start error');
    }
}

function restartWatchdripBackgroundService() {
    backgroundServiceStartPending = true;
    savePageBackgroundDebug('manual_service_restart_call');
    setBackgroundServiceControl('service_restart_call', 'BG restarting...');
    const stopResult = stopAppService({
        file: BG_SERVICE_FILE,
        complete_func: (info) => {
            backgroundServiceStartPending = false;
            const result = !!(info && info.result);
            savePageBackgroundDebug('manual_service_stop_cb', {result: String(result)});
            if (result) {
                invokeWatchdripServiceStart();
            } else {
                setBackgroundServiceControl('service_stop_error', 'BG stop failed');
            }
        }
    });
    savePageBackgroundDebug('manual_service_stop_ret', {result: String(stopResult)});
    if (Number(stopResult) !== 0) {
        backgroundServiceStartPending = false;
        setBackgroundServiceControl('service_stop_error', 'BG stop ret=' + stopResult);
    }
}

function startWatchdripBackgroundService() {
    try {
        if (backgroundServiceStartPending) {
            savePageBackgroundDebug('manual_service_start_pending');
            return;
        }

        let serviceList = [];
        let serviceListKnown = false;
        try {
            serviceList = getAllAppServices() || [];
            serviceListKnown = true;
            const serviceListText = JSON.stringify(serviceList);
            console.log("watchdrip running app services: " + serviceListText);
            logger.log("running app services: " + serviceListText);
            savePageBackgroundDebug('manual_service_list', {result: serviceListText});
            setBackgroundServiceControl('service_list', 'BG list=' + serviceList.length);
        } catch (e) {
            console.log("watchdrip getAllAppServices error: " + e);
            logger.error("getAllAppServices error: " + e);
            savePageBackgroundDebug('manual_service_list_error', {error: String(e)});
        }

        if (serviceListKnown && isWatchdripServiceRunning(serviceList)) {
            console.log("watchdrip background service restart requested");
            logger.log("background service restart requested");
            restartWatchdripBackgroundService();
            return;
        }
        invokeWatchdripServiceStart();
    } catch (e) {
        backgroundServiceStartPending = false;
        console.log("watchdrip app-service start error: " + e);
        logger.error("app-service start error: " + e);
        savePageBackgroundDebug('manual_service_start_error', {error: String(e)});
        setBackgroundServiceControl('service_start_error', 'BG start error');
    }
}

function requestAndStartWatchdripBackgroundService() {
    try {
        const permissionState = queryPermission({permissions: [BG_SERVICE_PERMISSION]});
        console.log("watchdrip bg_service permission state: " + JSON.stringify(permissionState));
        logger.log("bg_service permission state: " + JSON.stringify(permissionState));
        savePageBackgroundDebug('manual_permission_state', {result: JSON.stringify(permissionState)});
        setBackgroundServiceControl('permission_state', 'BG permission=' + (permissionState ? permissionState[0] : '?'));
        if (permissionState && permissionState[0] === 2) {
            startWatchdripBackgroundService();
            return;
        }

        let permissionHandled = false;
        const handlePermissionResult = (result) => {
            if (permissionHandled) return;
            permissionHandled = true;
            console.log("watchdrip bg_service permission callback: " + JSON.stringify(result));
            logger.log("bg_service permission callback: " + JSON.stringify(result));
            savePageBackgroundDebug('manual_permission_cb', {result: JSON.stringify(result)});
            setBackgroundServiceControl('permission_cb', 'BG permission=' + (result ? result[0] : '?'));
            if (result && result[0] === 2) {
                startWatchdripBackgroundService();
            }
        };
        const requestResult = requestPermission({
            permissions: [BG_SERVICE_PERMISSION],
            callback: handlePermissionResult,
        });
        console.log("watchdrip bg_service permission request ret: " + requestResult);
        logger.log("bg_service permission request ret: " + requestResult);
        savePageBackgroundDebug('manual_permission_ret', {result: String(requestResult)});
        if (requestResult === 2) {
            handlePermissionResult([2]);
        }
    } catch (e) {
        console.log("watchdrip bg_service permission error: " + e);
        logger.error("bg_service permission error: " + e);
        savePageBackgroundDebug('manual_permission_error', {error: String(e)});
        setBackgroundServiceControl('permission_error', 'BG permission error');
    }
}

const GoBackType = {NONE: 'none', GO_BACK: 'go_back', HIDE_PAGE: 'hide_page', HIDE: 'hide'};
const PagesType = {
    MAIN: 'main',
    UPDATE: 'update',
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
            y: px(250),
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

        const serviceControlText = this.conf.serviceControl && this.conf.serviceControl.text;
        this.backgroundServiceButton = createWidget(widget.BUTTON, {
            ...COMMON_BUTTON_START_BACKGROUND,
            text: serviceControlText || getText("start_background_service"),
            click_func: () => {
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
        this.vibrateNow();
        savePageBackgroundDebug('manual_button_pressed');
        requestAndStartWatchdripBackgroundService();
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
        markBackgroundDebug('fetch_start', { mode: this.fetchMode });
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
                    markBackgroundDebug('fetch_success', { result: 'saved' });
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

        // The next timeout is scheduled once when the hidden page starts.
    }
}

Page({
    onInit(p) {
        markBackgroundDebug('wake_entered', { params: String(p || '') });
        logger.debug("page onInit invoked: " + String(p));
        markBackgroundDebug('page_onInit', { params: String(p || '') });
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

            markBackgroundDebug('page_params_parsed', {
                page: data.page,
                source: data.source || ''
            });

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
