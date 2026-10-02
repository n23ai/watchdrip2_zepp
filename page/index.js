import {DebugText} from "../shared/debug";
import {getGlobal} from "../shared/global";
import { getText } from "@zos/i18n";
import {
    Colors,
    Commands,
    DATA_STALE_TIME_MS,
    DATA_TIMER_UPDATE_INTERVAL_MS,
    DATA_UPDATE_INTERVAL_MS,
    PROGRESS_ANGLE_INC,
    PROGRESS_UPDATE_INTERVAL_MS,
} from "../utils/config/constants";
import {
    WATCHDRIP_ALARM_SETTINGS_DEFAULTS, WF_DIR,
    WF_INFO_FILE,
} from "../utils/config/global-constants";
import { formatSugarLog } from "../shared/log-format";
import {
    BG_DELTA_TEXT,
    BG_STALE_RECT,
    BG_TIME_TEXT,
    BG_TREND_IMAGE,
    BG_VALUE_TEXT,
    COMMON_BUTTON_ADD_TREATMENT,
    COMMON_BUTTON_SETTINGS,
    CONFIG_PAGE_SCROLL,
    DEVICE_TYPE,
    IMG_LOADING_PROGRESS,
    MESSAGE_TEXT,
    RADIO_OFF,
    RADIO_ON,
    TITLE_TEXT,
    VERSION_TEXT,
} from "../utils/config/styles";
 
import {WatchdripData} from "../utils/watchdrip/watchdrip-data";
import {getDataTypeConfig, img} from "../utils/helper";
import {gotoSubpage} from "../shared/navigate";
import {WatchdripConfig} from "../utils/watchdrip/config";
import {markBackgroundDebug} from "../utils/watchdrip/background-debug";
import {Path} from "../utils/path";
import {formatLogLine} from "../shared/log-format";
import {DEVICE_WIDTH} from "../utils/config/device";

import { createWidget, widget, prop, setLayerScrolling, setStatusBarVisible, updateStatusBarTitle, align, text_style } from '@zos/ui'
import { Time, Vibrator } from '@zos/sensor'
import { queryPermission, requestPermission, getPackageInfo } from '@zos/app'
import { getAllAppServices, start as startAppService, stop as stopAppService } from '@zos/app-service'
import { goBack, home } from '@zos/router'
import { log, px } from '@zos/utils'
import { setPageBrightTime, resetPageBrightTime, setWakeUpRelaunch } from '@zos/display'
import { getSystemInfo } from '@zos/device'

const logger = log.getLogger("watchdrip_app");
const ENABLE_TREATMENT_UI = false;
const BG_SERVICE_PERMISSION = 'device:os.bg_service';
const BG_SERVICE_FILE = 'app-service/index';
const BG_SERVICE_PARAM = 'mode=continuous&source=manual&action=force_fetch';
const BG_SERVICE_VERIFY_DELAY_MS = 1500;
const BG_SERVICE_RETRY_DELAY_MS = 2000;
const BG_SERVICE_MAX_ATTEMPTS = 2;
const CACHE_READ_RETRY_DELAYS_MS = [250, 750, 1500, 2500];
const POST_START_CACHE_REFRESH_DELAYS_MS = [500, 1200, 2000, 3000, 4500, 6500, 10000, 15000];
const AGE_REFRESH_INTERVAL_MS = 10000;

var debug = null;
var watchdrip = null;
var backgroundServiceOperationPending = false;
var backgroundServiceRunSequence = 0;
var backgroundServiceCheckTimer = null;
var backgroundServiceRetryTimer = null;

function bgPageLog(stage, detail = '') {
    logger.log(formatLogLine('WD_BG', 'PAGE', stage, detail ? {detail} : {}));
}

function uiLog(event, fields = {}) {
    const text = formatLogLine('WD_UI', 'PAGE', event, fields);
    logger.log(text);
}

function formatError(error) {
    if (!error) return '';
    return String(error.stack || error.message || error);
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

function schedulePageTask(callback, delay) {
    const globalNS = watchdrip && watchdrip.globalNS ? watchdrip.globalNS : getGlobal();
    return globalNS.setTimeout(callback, delay);
}

function getServiceList(stage) {
    try {
        const serviceList = getAllAppServices() || [];
        bgPageLog(stage, JSON.stringify(serviceList));
        return serviceList;
    } catch (e) {
        bgPageLog(stage + '_ERROR', formatError(e));
        return null;
    }
}

function finishBackgroundServiceEnsure(run, attempt, success, onReady, reason = '') {
    backgroundServiceOperationPending = false;
    if (success) {
        bgPageLog('ENSURE_OK', 'run=' + run + ' attempt=' + attempt + (reason ? ' reason=' + reason : ''));
        if (onReady) onReady();
        return;
    }

    if (attempt < BG_SERVICE_MAX_ATTEMPTS) {
        bgPageLog('RECOVERY_RETRY', 'run=' + run + ' attempt=' + attempt + ' reason=' + (reason || 'unknown'));
        if (backgroundServiceRetryTimer !== null) {
            const globalNS = watchdrip && watchdrip.globalNS ? watchdrip.globalNS : getGlobal();
            globalNS.clearTimeout(backgroundServiceRetryTimer);
        }
        backgroundServiceRetryTimer = schedulePageTask(() => {
            backgroundServiceRetryTimer = null;
            startWatchdripBackgroundService(onReady, attempt + 1, run);
        }, BG_SERVICE_RETRY_DELAY_MS);
        return;
    }

    bgPageLog('ENSURE_FAILED', 'run=' + run + ' attempt=' + attempt + ' reason=' + (reason || 'unknown'));
}

function invokeWatchdripServiceStart(onReady, attempt, run) {
    try {
        backgroundServiceOperationPending = true;
        let callbackReceived = false;
        let callbackSuccess = false;
        const startResult = startAppService({
            file: BG_SERVICE_FILE,
            param: BG_SERVICE_PARAM,
            reload: true,
            complete_func: (info) => {
                callbackReceived = true;
                callbackSuccess = !!(info && info.result);
                const result = info ? info.result : 'no-info';
                bgPageLog('START_CB', 'run=' + run + ' attempt=' + attempt + ' result=' + result);
            }
        });
        const syncSuccess = startResult === 0 || startResult === true;
        bgPageLog('START_RET', 'run=' + run + ' attempt=' + attempt + ' result=' + startResult);
        if (!syncSuccess) {
            finishBackgroundServiceEnsure(run, attempt, false, onReady, 'sync_' + startResult);
            return;
        }

        backgroundServiceCheckTimer = schedulePageTask(() => {
            backgroundServiceCheckTimer = null;
            const list = getServiceList('LIST_AFTER');
            const running = isWatchdripServiceRunning(list);
            const callbackOk = callbackReceived && callbackSuccess;
            bgPageLog('START_LIST_CHECK', 'run=' + run + ' attempt=' + attempt +
                ' listed=' + running + ' callback=' + callbackOk);
            if (syncSuccess && callbackOk && running) {
                finishBackgroundServiceEnsure(run, attempt, true, onReady, 'started');
            } else {
                const reason = !callbackReceived ? 'callback_missing' :
                    (!callbackSuccess ? 'callback_failed' :
                        (!running ? 'service_missing' : 'verification_failed'));
                finishBackgroundServiceEnsure(run, attempt, false, onReady, reason);
            }
        }, BG_SERVICE_VERIFY_DELAY_MS);
    } catch (e) {
        bgPageLog('START_ERROR', 'run=' + run + ' attempt=' + attempt + ' error=' + formatError(e));
        finishBackgroundServiceEnsure(run, attempt, false, onReady, 'exception');
    }
}

function startWatchdripBackgroundService(onReady, attempt = 1, run = 0) {
    try {
        if (backgroundServiceOperationPending || backgroundServiceRetryTimer !== null) {
            bgPageLog('OPERATION_PENDING');
            return;
        }
        const operationRun = run || ++backgroundServiceRunSequence;
        bgPageLog('ENSURE_BEGIN', 'run=' + operationRun + ' attempt=' + attempt);
        const serviceList = getServiceList('LIST_BEFORE_START');
        if (serviceList && isWatchdripServiceRunning(serviceList)) {
            bgPageLog('ALREADY_RUNNING', 'run=' + operationRun + ' attempt=' + attempt);
            try {
                startAppService({
                    file: BG_SERVICE_FILE,
                    param: 'mode=continuous&action=force_fetch',
                    complete_func: () => {}
                });
            } catch (eParam) {}
            finishBackgroundServiceEnsure(operationRun, attempt, true, onReady, 'already_running');
            return;
        }
        invokeWatchdripServiceStart(onReady, attempt, operationRun);
    } catch (e) {
        backgroundServiceOperationPending = false;
        bgPageLog('CONTROL_ERROR', 'error=' + formatError(e));
    }
}

function requestAndStartWatchdripBackgroundService(onReady) {
    try {
        const permissionState = queryPermission({permissions: [BG_SERVICE_PERMISSION]});
        bgPageLog('PERMISSION_STATE', JSON.stringify(permissionState));
        if (permissionState && permissionState[0] === 2) {
            startWatchdripBackgroundService(onReady);
            return;
        }

        let permissionHandled = false;
        const handlePermissionResult = (result) => {
            if (permissionHandled) return;
            permissionHandled = true;
            bgPageLog('PERMISSION_CB', JSON.stringify(result));
            if (result && result[0] === 2) {
                startWatchdripBackgroundService(onReady);
            }
        };
        const requestResult = requestPermission({
            permissions: [BG_SERVICE_PERMISSION],
            callback: handlePermissionResult,
        });
        bgPageLog('PERMISSION_RET', String(requestResult));
        if (requestResult === 2) {
            handlePermissionResult([2]);
        }
    } catch (e) {
        bgPageLog('PERMISSION_ERROR', formatError(e));
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
        this.intervalTimer = null;
        this.ageRefreshTimer = null;
        this.progressTimer = null;
        this.cacheReadRetryTimer = null;
        this.cacheRefreshTimer = null;
        this.cacheRefreshToken = 0;
        this.cacheSnapshotKey = null;
        this.cacheRefreshActive = false;
        this.destroyed = false;
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
        this.startAgeRefresh();
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
            text: '',
        });

        if (this.conf.settings.disableUpdates) {
            this.showMessage(getText("data_upd_disabled"));
        } else {
            this.readLocalInfo();
            requestAndStartWatchdripBackgroundService(() => {
                if (watchdrip) {
                    watchdrip.schedulePostStartCacheRefresh();
                }
            });
            this.startDataUpdates();
        }

        createWidget(widget.BUTTON, {
            ...COMMON_BUTTON_SETTINGS,
            click_func: (button_widget) => {
                gotoSubpage(PagesType.CONFIG);
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
                    this.conf.settingsTime = Date.now(); // upd settings time
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

    startAgeRefresh() {
        if (this.ageRefreshTimer !== null) return;
        this.ageRefreshTimer = this.globalNS.setInterval(() => {
            if (this.destroyed) return;
            try {
                this.updateAgePresentation();
            } catch (e) {
                uiLog('AGE_REFRESH_ERROR', {reason: 'render'});
            }
        }, AGE_REFRESH_INTERVAL_MS);
    }

    stopAgeRefresh() {
        if (this.ageRefreshTimer !== null) {
            this.globalNS.clearInterval(this.ageRefreshTimer);
            this.ageRefreshTimer = null;
        }
    }

    updateAgePresentation() {
        if (!this.bgValTimeTextWidget || !this.bgStaleLine) return;
        const readRes = this.readInfoResult();
        if (readRes.ok && readRes.changed) {
            this.updateWidgets();
        }
        this.updateTimesWidget();
        const staleReasons = this.watchdripData.getBgStaleReasons();
        this.bgStaleLine.setProperty(prop.VISIBLE, staleReasons.length > 0);
    }

    isTimeout(time, timeout_ms) {
        if (!time) {
            return false;
        }
        return Date.now() - time > timeout_ms;
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
        if (this.updatingData) {
            return;
        }

        const readRes = this.readInfoResult();
        if (readRes.ok && readRes.changed) {
            this.updateWidgets();
        }
        this.updateTimesWidget();

        const bgTime = this.watchdripData.getBg() ? this.watchdripData.getBg().time : null;
        const bgAgeMs = bgTime ? Date.now() - Number(bgTime) : Infinity;

        // If BG data is older than 2 minutes or periodic refresh needed, trigger cache refresh
        if (bgAgeMs > 2 * 60 * 1000 || !this.lastUpdateAttempt || (Date.now() - this.lastUpdateAttempt > 60 * 1000)) {
            debug.log("data stale or periodic refresh needed, polling cache");
            this.lastUpdateAttempt = Date.now();
            this.schedulePostStartCacheRefresh();
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
        this.cancelCacheReadRetry();
        this.cancelCacheRefresh();

        const initialResult = this.readInfoResult();
        if (initialResult.ok) {
            uiLog('CACHE_READ_OK', {attempt: 0});
            this.updateWidgets();
            this.finishLocalInfoRead();
            return;
        }

        if (this.fetchMode === FetchMode.DISPLAY) {
            this.showMessage(getText("connecting"));
        }
        this.readLocalInfoAttempt(0);
    }

    readLocalInfoAttempt(attempt) {
        const result = this.readInfoResult();
        if (result.ok) {
            uiLog('CACHE_READ_OK', {attempt});
            this.updateWidgets();
            this.finishLocalInfoRead();
            return;
        }

        if (attempt < CACHE_READ_RETRY_DELAYS_MS.length) {
            const nextAttempt = attempt + 1;
            const delay = CACHE_READ_RETRY_DELAYS_MS[attempt];
            uiLog('CACHE_READ_RETRY', {attempt: nextAttempt, reason: result.reason});
            this.cacheReadRetryTimer = this.globalNS.setTimeout(() => {
                this.cacheReadRetryTimer = null;
                this.readLocalInfoAttempt(nextAttempt);
            }, delay);
            return;
        }

        uiLog('CACHE_READ_FAILED', {attempt, reason: result.reason});
        if (!this.cacheRefreshActive) {
            this.finishLocalInfoRead();
        }
        this.fetchRemoteInfo();
    }

    finishLocalInfoRead() {
        if (this.fetchMode === FetchMode.DISPLAY) {
            this.setMessageVisibility(false);
            this.setBgElementsVisibility(true);
        } else {
            this.stopLoader();
            this.handleGoBack();
        }
    }

    cancelCacheReadRetry() {
        if (this.cacheReadRetryTimer !== null) {
            this.globalNS.clearTimeout(this.cacheReadRetryTimer);
            this.cacheReadRetryTimer = null;
        }
    }

    cancelCacheRefresh() {
        this.cacheRefreshToken += 1;
        this.cacheRefreshActive = false;
        if (this.cacheRefreshTimer !== null) {
            this.globalNS.clearTimeout(this.cacheRefreshTimer);
            this.cacheRefreshTimer = null;
        }
    }

    schedulePostStartCacheRefresh() {
        if (this.destroyed) return;
        this.cancelCacheRefresh();
        this.cacheRefreshActive = true;
        const token = this.cacheRefreshToken;
        let attempt = 0;
        let sawValidSnapshot = false;

        const refresh = () => {
            if (token !== this.cacheRefreshToken) return;
            this.cacheRefreshTimer = null;

            const result = this.readInfoResult();
            if (result.ok) {
                sawValidSnapshot = true;
                if (result.changed) {
                    uiLog('CACHE_REFRESH_OK', {
                        attempt,
                        changed: 1,
                    });
                    this.updateWidgets();
                    this.finishLocalInfoRead();
                    this.cacheRefreshActive = false;
                    uiLog('CACHE_REFRESH_DONE', {attempt, reason: 'new_snapshot'});
                    return;
                }
            } else {
                uiLog('CACHE_REFRESH_RETRY', {attempt, reason: result.reason});
            }

            if (attempt >= POST_START_CACHE_REFRESH_DELAYS_MS.length - 1) {
                this.cacheRefreshActive = false;
                if (!sawValidSnapshot) {
                    uiLog('CACHE_REFRESH_FAILED', {attempt, reason: 'no_valid_snapshot'});
                    const hasData = this.watchdripData && this.watchdripData.getBg() && this.watchdripData.getBg().isHasData();
                    if (!hasData && this.fetchMode === FetchMode.DISPLAY && this.messageTextWidget) {
                        this.showMessage("Нет данных");
                    }
                } else {
                    this.updateWidgets();
                    this.finishLocalInfoRead();
                    uiLog('CACHE_REFRESH_DONE', {attempt, reason: 'unchanged'});
                }
                return;
            }

            const delay = POST_START_CACHE_REFRESH_DELAYS_MS[attempt + 1] -
                POST_START_CACHE_REFRESH_DELAYS_MS[attempt];
            attempt += 1;
            this.cacheRefreshTimer = this.globalNS.setTimeout(refresh, delay);
        };

        this.cacheRefreshTimer = this.globalNS.setTimeout(refresh,
            POST_START_CACHE_REFRESH_DELAYS_MS[attempt]);
    }

    fetchRemoteInfo(options = {}) {
        const onDone = typeof options.onDone === "function" ? options.onDone : null;
        debug.log("fetchRemoteInfo triggering force_fetch on background service");
        try {
            startAppService({
                file: BG_SERVICE_FILE,
                param: 'mode=continuous&action=force_fetch',
                complete_func: () => {}
            });
        } catch (eFetch) {
            debug.log("fetchRemoteInfo startAppService error: " + eFetch);
        }
        this.lastUpdateAttempt = Date.now();
        this.schedulePostStartCacheRefresh();
        if (onDone) {
            this.globalNS.setTimeout(onDone, 2000);
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
        this.serviceDebugTextWidget.setProperty(prop.MORE, {
            text: '',
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

        const valText = String(bgObj.getBGVal() || '');
        this.bgValTextWidget.setProperty(prop.TEXT, valText);
        this.bgValTextWidget.setProperty(prop.COLOR, bgValColor);
        this.bgValTextWidget.setProperty(prop.MORE, {
            text: valText,
            color: bgValColor,
        });

        const deltaText = (bgObj.delta ? String(bgObj.delta) : '') + " " + this.watchdripData.getStatus().getUnitText();
        this.bgDeltaTextWidget.setProperty(prop.TEXT, deltaText);
        this.bgDeltaTextWidget.setProperty(prop.MORE, {
            text: deltaText,
        });

        this.bgTrendImageWidget.setProperty(prop.SRC, bgObj.getArrowResource());
        this.updateAgePresentation();
        const staleReasons = this.watchdripData.getBgStaleReasons();
        if (staleReasons.length > 0) {
            const age = this.watchdripData.getBgAgeMs();
            uiLog('BG_STALE', {
                reason: staleReasons.join(','),
                ageSec: age === null ? 'unknown' : Math.floor(age / 1000),
            });
        }
    }

    updateTimesWidget() {
        let bgObj = this.watchdripData.getBg();
        const timeText = this.watchdripData.getTimeAgo(bgObj.time);
        this.bgValTimeTextWidget.setProperty(prop.TEXT, timeText);
        this.bgValTimeTextWidget.setProperty(prop.MORE, {
            text: timeText,
        });
    }

    showMessage(text) {
        this.setBgElementsVisibility(false);
        this.bgStaleLine.setProperty(prop.VISIBLE, false);
        this.messageTextWidget.setProperty(prop.TEXT, text);
        this.messageTextWidget.setProperty(prop.MORE, {text: text});
        this.setMessageVisibility(true);
    }

    setBgElementsVisibility(visibility) {
        this.bgValTextWidget.setProperty(prop.VISIBLE, visibility);
        this.bgValTimeTextWidget.setProperty(prop.VISIBLE, visibility);
        this.bgTrendImageWidget.setProperty(prop.VISIBLE, visibility);
        this.bgDeltaTextWidget.setProperty(prop.VISIBLE, visibility);
    }

    setMessageVisibility(visibility) {
        this.messageTextWidget.setProperty(prop.VISIBLE, visibility);
    }

    readInfoResult() {
        const result = this.infoFile.fetchJSONResult();
        const data = result.data;
        if (data && data.bg && typeof data.bg === 'object') {
            debug.log("READ BG: " + JSON.stringify(data.bg));
            const bgTime = data.bg.time == null ? '' : String(data.bg.time);
            const statusNow = data.status && data.status.now != null
                ? String(data.status.now)
                : '';
            const snapshotKey = [bgTime, statusNow].join('|');
            const changed = this.cacheSnapshotKey !== snapshotKey;
            this.cacheSnapshotKey = snapshotKey;
            this.watchdripData.setData(data);
            this.watchdripData.updateTimeDiff();
            const sugarLogLine = formatSugarLog('[WD_PAGE APP READ]', data, { status: 'OK', changed: changed ? 1 : 0 });
            console.log(sugarLogLine);
            return { ok: true, reason: '', changed, snapshotKey };
        }
        const failReason = result.reason || (data ? 'missing_bg' : 'missing');
        const failLogLine = formatSugarLog('[WD_PAGE APP READ]', null, { status: 'FAILED', reason: failReason });
        console.log(failLogLine);
        return {
            ok: false,
            reason: failReason,
        };
    }

    readInfo() {
        return this.readInfoResult().ok;
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
        this.lastUpdateAttempt = Date.now();
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
        let time = Date.now();
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
        this.destroyed = true;
        this.cancelCacheReadRetry();
        this.cancelCacheRefresh();
        this.conf.save();
        this.stopAgeRefresh();
        this.stopDataUpdates();
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
            debug.setLines(10);
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
        watchdrip = null;
    },
});
