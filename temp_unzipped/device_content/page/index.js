console.log('current filepath: /page/index.js');
try {
    ((() => {
        const __$$app$$__ = __$$hmAppManager$$__.currentApp;
        function getApp() {
            return __$$app$$__.app;
        }
        function getCurrentPage() {
            return __$$app$$__.current && __$$app$$__.current.module;
        }
        const __$$module$$__ = __$$app$$__.current;
        const h = new DeviceRuntimeCore.WidgetFactory(new DeviceRuntimeCore.HmDomApi(__$$app$$__, __$$module$$__));
        const {px} = __$$app$$__.__globals__;
        const i18n = __$$RQR$$__('@zos/i18n');
        const device = __$$RQR$$__('@zos/device');
        const utils = __$$RQR$$__('@zos/utils');
        const ui = __$$RQR$$__('@zos/ui');
        const sensor = __$$RQR$$__('@zos/sensor');
        const app = __$$RQR$$__('@zos/app');
        const fs = __$$RQR$$__('@zos/fs');
        const router = __$$RQR$$__('@zos/router');
        const display = __$$RQR$$__('@zos/display');
        function str2json(str) {
            return JSON.parse(str);
        }
        const SECOND_IN_MS = 1000;
        const MINUTE_IN_MS = 60000;
        function zeroPad(nr, base = 2) {
            let len = base - String(nr).length + 1;
            return len > 0 ? new Array(len).join('0') + nr : nr;
        }
        function niceTime(t) {
            var unit = 'sec';
            t = t / 1000;
            if (t !== 1)
                unit = 'sec';
            if (t > 59) {
                unit = 'min';
                t = t / 60;
                if (t != 1)
                    unit = 'mins';
                if (t > 59) {
                    unit = 'hour';
                    t = t / 60;
                    if (t != 1)
                        unit = 'hours';
                    if (t > 24) {
                        unit = 'day';
                        t = t / 24;
                        if (t != 1)
                            unit = 'days';
                        if (t > 28) {
                            unit = 'week';
                            t = t / 7;
                            if (t != 1)
                                unit = 'weeks';
                        }
                    }
                }
            } else {
                return 'now';
            }
            return Math.trunc(t) + ' ' + unit;
        }
        const {
            width: DEVICE_WIDTH,
            height: DEVICE_HEIGHT,
            screenShape: DEVICE_SHAPE
        } = device.getDeviceInfo();
        const DATA_TIMER_UPDATE_INTERVAL_MS = SECOND_IN_MS * 10;
        const DATA_UPDATE_INTERVAL_MS = MINUTE_IN_MS * 10;
        const DATA_STALE_TIME_MS = MINUTE_IN_MS * 2;
        const Commands = {
            getInfo: 'CMD_GET_INFO',
            putTreatment: 'CMD_PUT_TREATMENTS',
            getImg: 'CMD_GET_IMG'
        };
        const XDRIP_UPDATE_INTERVAL_MS = MINUTE_IN_MS * 5 + SECOND_IN_MS * 30;
        const ALARM_UPDATE_INTERVAL = 3 * 60;
        const PROGRESS_UPDATE_INTERVAL_MS = 100;
        const PROGRESS_ANGLE_INC = 30;
        const Colors = {
            default: 3355443,
            defaultTransparent: 367351,
            white: 16777215,
            black: 0,
            bgHigh: 16752800,
            bgLow: 9157631,
            accent: 4290707255
        };
        const DEVICE_TYPE = DEVICE_SHAPE ? 'round' : 'square';
        const STATUS_BAR_HEIGHT = 20;
        var TEXT_SIZE = 30;
        var TEXT_HEIGHT = 35;
        var BG_TIME_TEXT_X = DEVICE_WIDTH / 2 + 74;
        var BG_TIME_TEXT_Y = 103;
        var BG_TIME_TEXT_WIDTH = 163;
        var BG_TIME_TEXT_ALIGN_H = ui.align.LEFT;
        var SCROLL_ITEM_HEIGHT = 74;
        var COMMON_BUTTON_PADDING = 0;
        var SCROLL_ITEM_PADDING = 0;
        const MESSAGE_TEXT_SIZE = 31;
        var MESSAGE_TEXT_WIDTH = DEVICE_WIDTH;
        var RADIO_ON = 'radio_on_rect.png';
        var RADIO_OFF = 'radio_off_rect.png';
        var STATE_IMG_WIDTH = 80;
        var STATE_IMG_HEIGHT = 60;
        var SCROLL_PAGE_Y = STATUS_BAR_HEIGHT;
        if (DEVICE_WIDTH < 340) {
            TEXT_SIZE = 22;
            TEXT_HEIGHT = 30;
            BG_TIME_TEXT_X = (DEVICE_WIDTH - BG_TIME_TEXT_WIDTH) / 2;
            BG_TIME_TEXT_Y = 228;
            BG_TIME_TEXT_ALIGN_H = ui.align.CENTER_H;
            RADIO_ON = 'radio_on_tiny.png';
            RADIO_OFF = 'radio_off_tiny.png';
            SCROLL_ITEM_HEIGHT = 57;
            STATE_IMG_WIDTH = 20;
            STATE_IMG_HEIGHT = 20;
        } else if (DEVICE_TYPE === 'round') {
            SCROLL_PAGE_Y = 74;
            COMMON_BUTTON_PADDING = 41;
            SCROLL_ITEM_PADDING = 25;
            RADIO_ON = 'radio_on.png';
            RADIO_OFF = 'radio_off.png';
            MESSAGE_TEXT_WIDTH = DEVICE_WIDTH - 17;
            STATE_IMG_WIDTH = 100;
            STATE_IMG_HEIGHT = 68;
        }
        const DEBUG_TEXT = {
            x: 50,
            y: 50,
            w: 250,
            h: 450,
            text_size: 12,
            char_space: 0,
            color: Colors.white,
            text: '',
            text_style: ui.text_style.NONE,
            align_h: ui.align.LEFT,
            align_v: ui.align.TOP
        };
        const TITLE_TEXT = {
            x: (DEVICE_WIDTH - 234) / 2,
            y: 13,
            w: 234,
            h: TEXT_HEIGHT,
            color: Colors.white,
            text_size: TEXT_SIZE,
            align_h: ui.align.CENTER_H,
            align_v: ui.align.CENTER_V,
            text_style: ui.text_style.NONE
        };
        const MESSAGE_TEXT = {
            x: (DEVICE_WIDTH - MESSAGE_TEXT_WIDTH) / 2,
            y: 74,
            w: MESSAGE_TEXT_WIDTH,
            h: 114,
            color: Colors.white,
            text_size: MESSAGE_TEXT_SIZE,
            align_h: ui.align.CENTER_H,
            align_v: ui.align.CENTER_V,
            text_style: ui.text_style.NONE
        };
        const COMMON_BUTTON_STYLES = {
            x: COMMON_BUTTON_PADDING,
            w: DEVICE_WIDTH - COMMON_BUTTON_PADDING * 2,
            h: 65,
            text_size: TEXT_SIZE,
            radius: 36,
            normal_color: Colors.default,
            press_color: Colors.defaultTransparent
        };
        ({
            ...COMMON_BUTTON_STYLES,
            y: 212,
            text: i18n.getText('fetch_data')
        });
        ({
            ...COMMON_BUTTON_STYLES,
            y: 293,
            text: i18n.getText('fetch_img')
        });
        const COMMON_BUTTON_SETTINGS = {
            ...COMMON_BUTTON_STYLES,
            y: DEVICE_HEIGHT - 82,
            text: i18n.getText('settings')
        };
        const COMMON_BUTTON_ADD_TREATMENT = {
            ...COMMON_BUTTON_STYLES,
            y: DEVICE_HEIGHT - 0,
            text: i18n.getText('add_treatment')
        };
        const VERSION_TEXT = {
            x: (DEVICE_WIDTH - 234) / 2,
            y: DEVICE_HEIGHT + 106,
            w: 234,
            h: 23,
            color: Colors.white,
            text_size: 21,
            align_h: ui.align.CENTER_H,
            align_v: ui.align.CENTER_V,
            text_style: ui.text_style.NONE
        };
        const BG_VALUE_TEXT = {
            x: (DEVICE_WIDTH - 204) / 2,
            y: 65,
            w: 204,
            h: 70,
            color: Colors.white,
            text_size: 61,
            align_h: ui.align.CENTER_H,
            align_v: ui.align.CENTER_V,
            text_style: ui.text_style.NONE
        };
        const BG_TIME_TEXT = {
            x: BG_TIME_TEXT_X,
            y: BG_TIME_TEXT_Y,
            w: BG_TIME_TEXT_WIDTH,
            h: 26,
            color: Colors.white,
            text_size: 21,
            align_h: BG_TIME_TEXT_ALIGN_H,
            align_v: ui.align.CENTER_V,
            text_style: ui.text_style.NONE
        };
        const BG_DELTA_TEXT = {
            x: (DEVICE_WIDTH - 163) / 2,
            y: 187,
            w: 163,
            h: TEXT_HEIGHT,
            color: Colors.white,
            text_size: TEXT_SIZE,
            align_h: ui.align.CENTER_H,
            align_v: ui.align.CENTER_V,
            text_style: ui.text_style.NONE
        };
        const BG_TREND_IMAGE = {
            src: 'watchdrip/arrows/None.png',
            x: (DEVICE_WIDTH - 34) / 2,
            y: 147,
            w: 34,
            h: 32
        };
        const BG_STALE_RECT = {
            x: (DEVICE_WIDTH - 147) / 2,
            y: 106,
            w: 147,
            h: 5,
            color: Colors.white,
            visible: false
        };
        const IMG_LOADING_PROGRESS = {
            x: (DEVICE_WIDTH - 33) / 2,
            y: (DEVICE_HEIGHT - 33) / 2,
            src: 'watchdrip/progress.png',
            angle: 0,
            center_x: 20,
            center_y: 20,
            visible: false
        };
        const CONFIG_PAGE_SCROLL_ITEM_CONFIG = [{
                type_id: 1,
                item_bg_color: Colors.black,
                item_bg_radius: 10,
                text_view: [{
                        x: 13,
                        y: 13,
                        w: DEVICE_WIDTH - SCROLL_ITEM_PADDING * 2 - STATE_IMG_WIDTH - 33,
                        h: SCROLL_ITEM_HEIGHT - 25,
                        key: 'name',
                        color: Colors.white,
                        text_size: TEXT_SIZE,
                        action: false
                    }],
                text_view_count: 1,
                image_view: [{
                        x: DEVICE_WIDTH - SCROLL_ITEM_PADDING * 2 - STATE_IMG_WIDTH - 13,
                        y: SCROLL_ITEM_HEIGHT / 2 - STATE_IMG_HEIGHT / 2,
                        w: STATE_IMG_WIDTH,
                        h: STATE_IMG_HEIGHT,
                        key: 'state_src',
                        action: true
                    }],
                image_view_count: 1,
                item_height: SCROLL_ITEM_HEIGHT
            }];
        const CONFIG_PAGE_SCROLL = {
            x: SCROLL_ITEM_PADDING,
            y: SCROLL_PAGE_Y,
            h: DEVICE_HEIGHT - 17,
            w: DEVICE_WIDTH - SCROLL_ITEM_PADDING * 2,
            item_space: 9,
            item_config: CONFIG_PAGE_SCROLL_ITEM_CONFIG,
            item_config_count: CONFIG_PAGE_SCROLL_ITEM_CONFIG.length
        };
        class DebugText {
            constructor() {
                this.t = new sensor.Time();
                this.debugTextText = '';
                this.widget = ui.createWidget(ui.widget.TEXT, DEBUG_TEXT);
                this.lines = 0;
                this.enabled = false;
                let loggerName = 'watchdrip_app';
                if (app.getScene() === app.SCENE_AOD) {
                    loggerName = loggerName + '-aod';
                }
                this.logger = utils.log.getLogger(loggerName);
            }
            setLines(lines) {
                this.lines = lines;
            }
            setEnabled(enabled) {
                this.enabled = enabled;
                if (!enabled) {
                    this.clean();
                }
            }
            log(text) {
                let formatted = DebugText.objToString(text);
                this.logger.log(formatted);
                if (!this.enabled) {
                    this.debugTextText = '';
                    return;
                }
                this.debugTextText += this.getTime() + ':' + formatted + '\r\n';
                var lines = this.debugTextText.split('\r\n');
                if (this.lines !== 0 && lines.length > this.lines) {
                    lines.splice(0, lines.length - 1 - this.lines);
                }
                this.debugTextText = lines.join('\r\n');
                this.widget.setProperty(ui.prop.MORE, { text: this.debugTextText });
            }
            getTime() {
                return zeroPad(this.t.hour) + ':' + zeroPad(this.t.minute) + ':' + zeroPad(this.t.second) + '.' + zeroPad(this.t.utc % 1000, 4);
            }
            static objToString(obj, ndeep) {
                if (obj == null) {
                    return String(obj);
                }
                switch (typeof obj) {
                case 'string':
                    return obj;
                case 'function':
                    return obj.name || obj.toString();
                case 'object':
                    var indent = Array(ndeep || 1).join(' '), isArray = Array.isArray(obj);
                    return '{['[+isArray] + Object.keys(obj).map(function (key) {
                        return '\r\n ' + indent + key + ': ' + DebugText.objToString(obj[key], (ndeep || 1) + 1);
                    }).join(',') + '\r\n' + indent + '}]'[+isArray];
                default:
                    return obj.toString();
                }
            }
            clean() {
                this.debugTextText = '';
                this.widget.setProperty(ui.prop.MORE, { text: this.debugTextText });
            }
        }
        function getGlobal() {
            try {
                if (typeof self !== 'undefined') {
                    return self;
                }
                if (typeof window !== 'undefined') {
                    return window;
                }
                if (typeof global !== 'undefined') {
                    return global;
                }
                if (typeof globalThis !== 'undefined') {
                    return globalThis;
                }
            } catch (e) {
                console.log('getGlobal error: ' + e);
            }
            console.log('unable to locate global object');
            return {};
        }
        const WF_DIR = '/storage/js_apps/data/watchdrip';
        const WF_INFO_FILE = WF_DIR + '/info.json';
        const WF_CONFIG_FILE = WF_DIR + '/config.json';
        const WATCHDRIP_SETTINGS_DEFAULTS = {
            disableUpdates: false,
            showLog: false,
            useAppFetch: false
        };
        const WATCHDRIP_ALARM_SETTINGS_DEFAULTS = {
            fetchInterval: ALARM_UPDATE_INTERVAL,
            fetchParams: 'graph=1'
        };
        utils.log.getLogger('fs.js');
        class BgData {
            constructor(val, delta, trend, isHigh, isLow, time, isStale) {
                this.val = val;
                this.delta = delta;
                this.trend = trend;
                this.isHigh = isHigh;
                this.isLow = isLow;
                this.time = time;
                this.isStale = isStale;
            }
            getBGVal() {
                if (this.isHasData()) {
                    return this.val;
                }
                return '';
            }
            isHasData() {
                return this.val !== '';
            }
            static createEmpty() {
                return new BgData('', '', '', false, false, null, true);
            }
            getArrowText() {
                switch (this.trend) {
                case 'FortyFiveDown':
                    return '\u2198';
                case 'FortyFiveUp':
                    return '\u2197';
                case 'Flat':
                    return '\u2192';
                case 'SingleDown':
                    return '\u2193';
                case 'DoubleDown':
                    return '\u2193\u2193';
                case 'SingleUp':
                    return '\u2191';
                case 'DoubleUp':
                    return '\u2191\u2191';
                default:
                    return '';
                }
            }
            getArrowResource() {
                let fileName = this.trend;
                if (fileName === void 0 || fileName === '') {
                    fileName = 'None';
                }
                return `watchdrip/arrows/${ fileName }.png`;
            }
        }
        class StatusData {
            constructor(now, isMgdl, bat) {
                this.now = now;
                this.isMgdl = isMgdl;
                this.bat = bat;
            }
            getBatVal() {
                if (this.bat === '') {
                    return '--';
                }
                return this.bat + '%';
            }
            getUnitText() {
                if (this.isMgdl == null) {
                    return '';
                }
                if (this.isMgdl) {
                    return 'mg/dl';
                }
                return 'mmol';
            }
            static createEmpty() {
                return new StatusData(null, null, '');
            }
        }
        class TreatmentData {
            constructor(insulin, carbs, time, predictIOB, predictBWP) {
                this.insulin = insulin;
                this.carbs = carbs;
                this.time = time;
                this.predictIOB = predictIOB;
                this.predictBWP = predictBWP;
            }
            getPredictIOB() {
                if (this.predictIOB === '' || this.predictIOB === void 0) {
                    return '';
                }
                return 'IOB: ' + this.predictIOB;
            }
            getPredictBWP() {
                if (this.predictBWP === '' || this.predictBWP === void 0) {
                    return '';
                }
                return 'BWP: ' + this.predictBWP;
            }
            getTreatments() {
                let treatmentText = '';
                if (this.insulin > 0) {
                    let insText = this.insulin + 'u';
                    insText = insText.replace('.0u', 'u');
                    treatmentText = treatmentText + insText;
                } else if (this.carbs > 0) {
                    let carbText = this.carbs + 'g';
                    carbText = carbText.replace('.0g', 'g');
                    treatmentText = treatmentText + carbText;
                }
                return treatmentText;
            }
            static createEmpty() {
                return new TreatmentData('', '', null, '', '');
            }
        }
        class PumpData {
            constructor(reservoir, iob, bat) {
                this.reservoir = reservoir;
                this.iob = iob;
                this.bat = bat;
            }
            static createEmpty() {
                return new PumpData('', '', '');
            }
        }
        const BG_STALE_TIME_MS = 13 * MINUTE_IN_MS;
        class WatchdripData {
            constructor(timeSensor) {
                this.timeSensor = timeSensor;
                this.bg = BgData.createEmpty();
                this.status = StatusData.createEmpty();
                this.treatment = TreatmentData.createEmpty();
                this.pump = PumpData.createEmpty();
                this.timeDiff = 0;
            }
            updateTimeDiff() {
                if (this.getStatus().now == null) {
                    this.timeDiff = 0;
                } else {
                    this.timeDiff = this.timeSensor.utc - this.getStatus().now;
                }
            }
            setData(data) {
                if (data['bg'] === void 0) {
                    this.bg = BgData.createEmpty();
                } else {
                    this.bg = Object.assign(BgData.prototype, data['bg']);
                }
                if (data['status'] === void 0) {
                    this.status = StatusData.createEmpty();
                } else {
                    this.status = Object.assign(StatusData.prototype, data['status']);
                }
                if (data['treatment'] === void 0) {
                    this.treatment = TreatmentData.createEmpty();
                } else {
                    this.treatment = Object.assign(TreatmentData.prototype, data['treatment']);
                }
                if (data['pump'] === void 0) {
                    this.pump = PumpData.createEmpty();
                } else {
                    this.pump = Object.assign(PumpData.prototype, data['pump']);
                }
            }
            getBg() {
                return this.bg;
            }
            getStatus() {
                return this.status;
            }
            getTreatment() {
                return this.treatment;
            }
            getPump() {
                return this.pump;
            }
            isBgStale() {
                if (this.getBg().isHasData()) {
                    return this.getBg().isStale || this.timeSensor.utc - this.getBg().time - this.timeDiff > BG_STALE_TIME_MS;
                } else {
                    return false;
                }
            }
            getTimeAgo(time) {
                if (time == null || 0)
                    return '';
                let timeInt = parseInt(time);
                return niceTime(this.timeSensor.utc - timeInt - this.timeDiff);
            }
        }
        const img = function (type) {
            return path => type + '/' + path;
        }('images');
        const getDataTypeConfig = (id_type, i_start, i_end) => {
            return {
                start: i_start,
                end: i_end,
                type_id: id_type
            };
        };
        function gotoSubpage(page, params, appid) {
            if (!params)
                params = {};
            let url = 'page/index';
            if (page.indexOf('.') !== -1) {
                let r = page.split('.');
                url = 'page/' + r[0];
                page = r[1];
            }
            const queryParams = {
                page,
                ...params
            };
            if (appid) {
                router.launchApp({
                    appId: appid,
                    url,
                    params: queryParams
                });
            } else {
                router.push({
                    url,
                    params: JSON.stringify(queryParams)
                });
            }
        }
        device.getDeviceInfo().deviceName;
        class Path {
            constructor(scope, path, appid = 0) {
                this.localFS = true;
                if (path.includes('/')) {
                    path = path.substring(path.lastIndexOf('/') + 1);
                }
                scope = 'data';
                this.scope = scope;
                this.path = path;
                this.appid = appid;
                this.relativePath = path;
                this.absolutePath = FsTools.fullDataPath(path);
            }
            get(path) {
                const newPath = this.path === '/' ? path : `${ this.path }/${ path }`;
                return new Path(this.scope, newPath);
            }
            resolve() {
                return new Path('full', this.absolutePath);
            }
            src() {
                return this.relativePath;
            }
            stat() {
                try {
                    return fs.statSync({ path: this.relativePath });
                } catch (e) {
                    return void 0;
                }
            }
            size() {
                const st = this.stat();
                if (st && st.size) {
                    return st.size;
                }
                return 0;
            }
            open(flags) {
                let zFlags = flags;
                if (flags === 1)
                    zFlags = fs.O_RDONLY;
                else if (flags === 2)
                    zFlags = fs.O_WRONLY;
                else if (flags === 4)
                    zFlags = fs.O_CREAT;
                this._f = fs.openSync({
                    path: this.relativePath,
                    flag: zFlags
                });
                return this._f;
            }
            remove() {
                try {
                    fs.rmSync({ path: this.relativePath });
                    return true;
                } catch (e) {
                    return false;
                }
            }
            removeTree() {
                this.remove();
            }
            fetch(limit = Infinity) {
                try {
                    return fs.readFileSync({ path: this.relativePath });
                } catch (e) {
                    return null;
                }
            }
            fetchText(limit = Infinity) {
                try {
                    return fs.readFileSync({
                        path: this.relativePath,
                        options: { encoding: 'utf8' }
                    });
                } catch (e) {
                    return null;
                }
            }
            fetchJSON() {
                const text = this.fetchText();
                if (!text)
                    return null;
                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.log('cannot parse json');
                    return null;
                }
            }
            override(buffer) {
                try {
                    fs.writeFileSync({
                        path: this.relativePath,
                        data: buffer
                    });
                } catch (e) {
                    console.log('override error', e);
                }
            }
            overrideWithText(text) {
                try {
                    fs.writeFileSync({
                        path: this.relativePath,
                        data: text,
                        options: { encoding: 'utf8' }
                    });
                } catch (e) {
                    console.log('overrideWithText error', e);
                }
            }
            overrideWithJSON(data) {
                return this.overrideWithText(JSON.stringify(data));
            }
            copy(destEntry) {
                const buf = this.fetch();
                destEntry.override(buf);
            }
            copyTree(destEntry, move = false) {
                this.copy(destEntry);
                if (move)
                    this.removeTree();
            }
            isFile() {
                return !!this.stat();
            }
            isFolder() {
                return false;
            }
            exists() {
                return !!this.stat();
            }
            list() {
                try {
                    return [
                        fs.readdirSync({ path: this.relativePath }),
                        0
                    ];
                } catch (e) {
                    return [
                        [],
                        -1
                    ];
                }
            }
            mkdir() {
                try {
                    fs.mkdirSync({ path: this.relativePath });
                    return 0;
                } catch (e) {
                    return -1;
                }
            }
            seek(val) {
            }
            read(buffer, offset, length) {
                return fs.readSync({
                    fd: this._f,
                    buffer,
                    options: {
                        offset,
                        length
                    }
                });
            }
            write(buffer, offset, length) {
                fs.writeSync({
                    fd: this._f,
                    buffer,
                    options: {
                        offset,
                        length
                    }
                });
            }
            close() {
                fs.closeSync({ fd: this._f });
            }
        }
        class FsTools {
            static getAppLocation() {
                const packageInfo = app.getPackageInfo();
                const idn = packageInfo.appId.toString(16).padStart(8, '0').toUpperCase();
                return [
                    `js_${ packageInfo.type }s`,
                    idn
                ];
            }
            static fullAssetPath(path) {
                const [base, idn] = FsTools.getAppLocation();
                return `/storage/${ base }/${ idn }/assets${ path }`;
            }
            static fullDataPath(path) {
                const [base, idn] = FsTools.getAppLocation();
                return `/storage/${ base }/data/${ idn }${ path }`;
            }
            static ab2str(buf) {
                return String.fromCharCode.apply(null, new Uint8Array(buf));
            }
            static str2ab(str) {
                var buf = new ArrayBuffer(str.length);
                var bufView = new Uint8Array(buf);
                for (var i = 0, strLen = str.length; i < strLen; i++) {
                    bufView[i] = str.charCodeAt(i);
                }
                return buf;
            }
        }
        let file;
        class WatchdripConfig {
            constructor() {
                file = new Path('full', WF_CONFIG_FILE);
                this.alarmSettings = WATCHDRIP_ALARM_SETTINGS_DEFAULTS;
                this.settings = WATCHDRIP_SETTINGS_DEFAULTS;
                this.settingsTime = 0;
                this.infoLastUpd = 0;
                this.infoLastUpdAttempt = 0;
                this.infoLastUpdSucess = false;
                this.alarm_id = '-1';
                this.read();
            }
            read() {
                let parsed = file.fetchJSON();
                if (parsed) {
                    parsed.watchdripConfig = {
                        ...WATCHDRIP_SETTINGS_DEFAULTS,
                        ...parsed.watchdripConfig
                    };
                    parsed.watchdripAlarmConfig = {
                        ...WATCHDRIP_ALARM_SETTINGS_DEFAULTS,
                        ...parsed.watchdripAlarmConfig
                    };
                    Object.assign(this, parsed);
                }
            }
            save() {
                file.overrideWithJSON(this);
            }
        }
        const logger = utils.log.getLogger('watchdrip_app');
        let messageBuilder = null;
        const {appId} = app.getPackageInfo();
        var debug = null;
        var watchdrip = null;
        const GoBackType = {
            NONE: 'none',
            GO_BACK: 'go_back',
            HIDE_PAGE: 'hide_page',
            HIDE: 'hide'
        };
        const PagesType = {
            MAIN: 'main',
            UPDATE: 'update',
            UPDATE_LOCAL: 'update_local',
            HIDE: 'hide',
            CONFIG: 'config',
            ADD_TREATMENT: 'add_treatment'
        };
        const FetchMode = {
            DISPLAY: 'display',
            HIDDEN: 'hidden'
        };
        class Watchdrip {
            constructor() {
                this.createWatchdripDir();
                this.timeSensor = new sensor.Time();
                this.vibrate = new sensor.Vibrate();
                this.globalNS = getGlobal();
                this.goBackType = GoBackType.NONE;
                this.intervalWatchdog = null;
                this.system_alarm_id = null;
                this.lastInfoUpdate = 0;
                this.lastUpdateAttempt = null;
                this.lastUpdateSucessful = false;
                this.updatingData = false;
                this.intervalTimer = null;
                this.updateIntervals = DATA_UPDATE_INTERVAL_MS;
                this.fetchMode = FetchMode.DISPLAY;
                this.conf = new WatchdripConfig();
                debug.setEnabled(this.conf.settings.showLog);
                this.infoFile = new Path('full', WF_INFO_FILE);
            }
            start(data) {
                debug.log('start');
                debug.log(data);
                let pageTitle = '';
                this.goBackType = GoBackType.NONE;
                switch (data.page) {
                case PagesType.MAIN:
                    let pkg = app.getPackageInfo();
                    pageTitle = pkg.name;
                    this.main_page();
                    break;
                case PagesType.UPDATE:
                    this.goBackType = GoBackType.HIDE;
                    this.conf.alarmSettings = {
                        ...this.conf.alarmSettings,
                        ...data.params
                    };
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
                    pageTitle = i18n.getText('settings');
                    this.config_page();
                    break;
                case PagesType.ADD_TREATMENT:
                    pageTitle = i18n.getText('add_treatment');
                    this.add_treatment_page();
                    break;
                }
                if (pageTitle) {
                    if (DEVICE_TYPE === 'round') {
                        this.titleTextWidget = ui.createWidget(ui.widget.TEXT, {
                            ...TITLE_TEXT,
                            text: pageTitle
                        });
                    } else {
                        ui.updateStatusBarTitle(pageTitle);
                    }
                }
            }
            main_page() {
                display.setPageBrightTime({ brightTime: 60000 });
                display.setWakeUpRelaunch(true);
                this.watchdripData = new WatchdripData(this.timeSensor);
                let pkg = app.getPackageInfo();
                this.versionTextWidget = ui.createWidget(ui.widget.TEXT, {
                    ...VERSION_TEXT,
                    text: 'v' + pkg.version
                });
                this.messageTextWidget = ui.createWidget(ui.widget.TEXT, {
                    ...MESSAGE_TEXT,
                    text: ''
                });
                this.bgValTextWidget = ui.createWidget(ui.widget.TEXT, BG_VALUE_TEXT);
                this.bgValTimeTextWidget = ui.createWidget(ui.widget.TEXT, BG_TIME_TEXT);
                this.bgDeltaTextWidget = ui.createWidget(ui.widget.TEXT, BG_DELTA_TEXT);
                this.bgTrendImageWidget = ui.createWidget(ui.widget.IMG, BG_TREND_IMAGE);
                this.bgStaleLine = ui.createWidget(ui.widget.FILL_RECT, BG_STALE_RECT);
                this.bgStaleLine.setProperty(ui.prop.VISIBLE, false);
                if (this.conf.settings.disableUpdates) {
                    this.showMessage(i18n.getText('data_upd_disabled'));
                } else {
                    if (this.readInfo()) {
                        this.updateWidgets();
                    }
                    this.fetchInfo();
                    this.startDataUpdates();
                }
                ui.createWidget(ui.widget.BUTTON, {
                    ...COMMON_BUTTON_SETTINGS,
                    click_func: button_widget => {
                        gotoSubpage(PagesType.CONFIG);
                    }
                });
                ui.createWidget(ui.widget.BUTTON, {
                    ...COMMON_BUTTON_ADD_TREATMENT,
                    click_func: button_widget => {
                        gotoSubpage(PagesType.ADD_TREATMENT);
                    }
                });
            }
            getConfigData() {
                let dataList = [];
                Object.entries(this.conf.settings).forEach(entry => {
                    const [key, value] = entry;
                    let stateImg = RADIO_OFF;
                    if (value) {
                        stateImg = RADIO_ON;
                    }
                    dataList.push({
                        key,
                        name: i18n.getText(key),
                        state_src: img('icons/' + stateImg)
                    });
                });
                this.configDataList = dataList;
                let dataTypeConfig = [getDataTypeConfig(1, 0, dataList.length)];
                return {
                    data_array: dataList,
                    data_count: dataList.length,
                    data_type_config: dataTypeConfig,
                    data_type_config_count: dataTypeConfig.length
                };
            }
            add_treatment_page() {
            }
            config_page() {
                ui.setLayerScrolling(false);
                this.configScrollList = ui.createWidget(ui.widget.SCROLL_LIST, {
                    ...CONFIG_PAGE_SCROLL,
                    item_click_func: (list, index) => {
                        debug.log(index);
                        const key = this.configDataList[index].key;
                        let val = this.conf.settings[key];
                        this.conf.settings[key] = !val;
                        this.conf.settingsTime = this.timeSensor.utc;
                        this.configScrollList.setProperty(ui.prop.UPDATE_DATA, {
                            ...this.getConfigData(),
                            on_page: 1
                        });
                    },
                    ...this.getConfigData()
                });
            }
            startDataUpdates() {
                if (this.intervalTimer != null)
                    return;
                debug.log('startDataUpdates');
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
                return this.timeSensor.utc - time > timeout_ms;
            }
            handleRareCases() {
                let fetch = false;
                if (this.lastUpdateAttempt == null) {
                    debug.log('initial fetch');
                    fetch = true;
                } else if (this.isTimeout(this.lastUpdateAttempt, DATA_STALE_TIME_MS)) {
                    debug.log('the side app not responding, force update again');
                    fetch = true;
                }
                if (fetch) {
                    this.fetchInfo();
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
                            debug.log('update from remote');
                            this.readInfo();
                            this.lastInfoUpdate = lastInfoUpdate;
                            this.updateWidgets();
                            return;
                        }
                        if (this.isTimeout(lastInfoUpdate, this.updateIntervals)) {
                            debug.log('reached updateIntervals');
                            this.fetchInfo();
                            return;
                        }
                        const bgTimeOlder = this.isTimeout(this.watchdripData.getBg().time, XDRIP_UPDATE_INTERVAL_MS);
                        const statusNowOlder = this.isTimeout(this.watchdripData.getStatus().now, XDRIP_UPDATE_INTERVAL_MS);
                        if (bgTimeOlder || statusNowOlder) {
                            if (!this.isTimeout(this.lastUpdateAttempt, DATA_STALE_TIME_MS)) {
                                debug.log('wait DATA_STALE_TIME');
                                return;
                            }
                            debug.log('data older than sensor update interval');
                            this.fetchInfo();
                            return;
                        }
                        debug.log('data not modified');
                    } else {
                        this.handleRareCases();
                    }
                }
            }
            fetch_page() {
                debug.log('fetch_page');
                ui.setStatusBarVisible(false);
                this.prepareNextAlarm();
                if (this.conf.settings.disableUpdates || !this.conf.settings.useAppFetch) {
                    this.handleGoBack();
                    return;
                }
                display.setPageBrightTime({ brightTime: 999000 });
                this.progressWidget = ui.createWidget(ui.widget.IMG, IMG_LOADING_PROGRESS);
                this.progressAngle = 0;
                this.stopLoader();
                this.fetchMode = FetchMode.HIDDEN;
                this.fetchInfo(this.conf.alarmSettings.fetchParams);
            }
            fetch_page_local() {
                debug.log('fetch_page');
                ui.setStatusBarVisible(false);
                this.progressWidget = ui.createWidget(ui.widget.IMG, IMG_LOADING_PROGRESS);
                this.progressAngle = 0;
                this.stopLoader();
                this.fetchMode = FetchMode.HIDDEN;
                this.fetchInfo(this.conf.alarmSettings.fetchParams);
            }
            hide_page() {
                router.home();
            }
            fetchInfo(params = '') {
                debug.log('fetchInfo');
                let isDisplay = true;
                if (this.fetchMode === FetchMode.HIDDEN) {
                    isDisplay = false;
                }
                this.resetLastUpdate();
                if (messageBuilder.connectStatus() === false) {
                    debug.log('No BT Connection');
                    if (isDisplay) {
                        this.showMessage(i18n.getText('status_no_bt'));
                    } else {
                        this.handleGoBack();
                    }
                    return;
                }
                if (params === '') {
                    params = WATCHDRIP_ALARM_SETTINGS_DEFAULTS.fetchParams;
                }
                if (isDisplay) {
                    this.showMessage(i18n.getText('connecting'));
                } else {
                    this.startLoader();
                    if (this.intervalWatchdog === null) {
                        this.intervalWatchdog = this.globalNS.setTimeout(() => {
                            this.stopLoader();
                            this.handleGoBack();
                        }, 5000);
                    }
                }
                this.updatingData = true;
                messageBuilder.request({
                    method: Commands.getInfo,
                    params
                }, { timeout: 5000 }).then(data => {
                    debug.log('received data');
                    let {
                        result: info = {}
                    } = data;
                    try {
                        if (info.error) {
                            debug.log('Error');
                            debug.log(info);
                            return;
                        }
                        let dataInfo = str2json(info);
                        this.lastInfoUpdate = this.saveInfo(info);
                        info = null;
                        if (isDisplay) {
                            this.watchdripData.setData(dataInfo);
                            this.watchdripData.updateTimeDiff();
                            dataInfo = null;
                            this.updateWidgets();
                        }
                    } catch (e) {
                        debug.log('error:' + e);
                    }
                }).catch(error => {
                    debug.log('fetch error:' + error);
                }).finally(() => {
                    this.updatingData = false;
                    if (isDisplay && !this.lastUpdateSucessful) {
                        this.showMessage(i18n.getText('status_start_watchdrip'));
                    }
                    if (!isDisplay) {
                        this.stopLoader();
                        this.handleGoBack();
                    }
                });
            }
            startLoader() {
                this.progressWidget.setProperty(ui.prop.VISIBLE, true);
                this.progressWidget.setProperty(ui.prop.MORE, { angle: this.progressAngle });
                this.progressTimer = this.globalNS.setInterval(() => {
                    this.updateLoader();
                }, PROGRESS_UPDATE_INTERVAL_MS);
            }
            updateLoader() {
                this.progressAngle = this.progressAngle + PROGRESS_ANGLE_INC;
                if (this.progressAngle >= 360)
                    this.progressAngle = 0;
                this.progressWidget.setProperty(ui.prop.MORE, { angle: this.progressAngle });
            }
            stopLoader() {
                if (this.progressTimer !== null) {
                    this.globalNS.clearInterval(this.progressTimer);
                    this.progressTimer = null;
                }
                this.progressWidget.setProperty(ui.prop.VISIBLE, false);
            }
            updateWidgets() {
                debug.log('updateWidgets');
                this.setMessageVisibility(false);
                this.setBgElementsVisibility(true);
                this.updateValuesWidget();
                this.updateTimesWidget();
            }
            updateValuesWidget() {
                let bgValColor = Colors.white;
                let bgObj = this.watchdripData.getBg();
                if (bgObj.isHigh) {
                    bgValColor = Colors.bgHigh;
                } else if (bgObj.isLow) {
                    bgValColor = Colors.bgLow;
                }
                this.bgValTextWidget.setProperty(ui.prop.MORE, {
                    text: bgObj.getBGVal(),
                    color: bgValColor
                });
                this.bgDeltaTextWidget.setProperty(ui.prop.MORE, { text: bgObj.delta + ' ' + this.watchdripData.getStatus().getUnitText() });
                this.bgTrendImageWidget.setProperty(ui.prop.SRC, bgObj.getArrowResource());
                this.bgStaleLine.setProperty(ui.prop.VISIBLE, this.watchdripData.isBgStale());
            }
            updateTimesWidget() {
                let bgObj = this.watchdripData.getBg();
                this.bgValTimeTextWidget.setProperty(ui.prop.MORE, { text: this.watchdripData.getTimeAgo(bgObj.time) });
            }
            showMessage(text) {
                this.setBgElementsVisibility(false);
                this.messageTextWidget.setProperty(ui.prop.MORE, { text });
                this.setMessageVisibility(true);
            }
            setBgElementsVisibility(visibility) {
                this.bgValTextWidget.setProperty(ui.prop.VISIBLE, visibility);
                this.bgValTimeTextWidget.setProperty(ui.prop.VISIBLE, visibility);
                this.bgTrendImageWidget.setProperty(ui.prop.VISIBLE, visibility);
                this.bgStaleLine.setProperty(ui.prop.VISIBLE, visibility);
                this.bgDeltaTextWidget.setProperty(ui.prop.VISIBLE, visibility);
            }
            setMessageVisibility(visibility) {
                this.messageTextWidget.setProperty(ui.prop.VISIBLE, visibility);
            }
            readInfo() {
                let data = this.infoFile.fetchJSON();
                if (data) {
                    debug.log('data was read');
                    this.watchdripData.setData(data);
                    this.watchdripData.timeDiff = 0;
                    data = null;
                    return true;
                }
                return false;
            }
            readLastUpdate() {
                debug.log('readLastUpdate');
                this.conf.read();
                this.lastUpdateAttempt = this.conf.infoLastUpdAttempt;
                this.lastUpdateSucessful = this.conf.infoLastUpdSucess;
                return this.conf.infoLastUpd;
            }
            resetLastUpdate() {
                debug.log('resetLastUpdate');
                this.lastUpdateAttempt = this.timeSensor.utc;
                this.lastUpdateSucessful = false;
                this.conf.infoLastUpdAttempt = this.lastUpdateAttempt;
                this.conf.infoLastUpdSucess = this.lastUpdateSucessful;
            }
            createWatchdripDir() {
                let osVersion;
                try {
                    let systemInfo = device.getSystemInfo();
                    osVersion = Number(systemInfo.osVersion);
                } catch (e) {
                    osVersion = 1;
                }
                if (osVersion < 3) {
                    let dir = new Path('full', WF_DIR);
                    if (!dir.exists()) {
                        dir.mkdir();
                    }
                }
            }
            saveInfo(info) {
                debug.log('saveInfo');
                this.infoFile.overrideWithText(info);
                this.lastUpdateSucessful = true;
                let time = this.timeSensor.utc;
                this.conf.infoLastUpd = time;
                this.conf.infoLastUpdSucess = this.lastUpdateSucessful;
                return time;
            }
            saveAlarmId(alarm_id) {
                debug.log('saveAlarmId');
                this.conf.alarm_id = alarm_id;
            }
            disableCurrentAlarm() {
                debug.log('disableCurrentAlarm');
                const alarm_id = this.conf.alarm_id;
                if (alarm_id && alarm_id !== -1) {
                    debug.log('stop old app alarm');
                    router.clearLaunchAppTimeout({ timeoutId: alarm_id });
                    this.saveAlarmId('-1');
                }
            }
            prepareNextAlarm() {
                this.disableCurrentAlarm();
                if (this.conf.settings.disableUpdates || !this.conf.settings.useAppFetch) {
                    if (this.system_alarm_id !== null) {
                        router.clearLaunchAppTimeout({ timeoutId: this.system_alarm_id });
                    }
                    return;
                }
                debug.log('Next alarm in ' + this.conf.alarmSettings.fetchInterval + 's');
                if (this.system_alarm_id == null) {
                    this.system_alarm_id = router.setLaunchAppTimeout({
                        appId,
                        url: 'page/index',
                        params: PagesType.UPDATE_LOCAL,
                        delay: this.conf.alarmSettings.fetchInterval * 1000
                    });
                    this.saveAlarmId(this.system_alarm_id);
                }
            }
            handleGoBack() {
                switch (this.goBackType) {
                case GoBackType.NONE:
                    break;
                case GoBackType.GO_BACK:
                    router.goBack();
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
                this.vibrate.scene = 24;
                this.vibrate.start();
            }
            onDestroy() {
                this.conf.save();
                this.stopDataUpdates();
                this.vibrate.stop();
                display.resetPageBrightTime();
            }
        }
        __$$module$$__.module = DeviceRuntimeCore.Page({
            onInit(p) {
                logger.debug('page onInit invoked');
                this.p = p;
            },
            build() {
                logger.debug('page build invoked');
                try {
                    const globalData = getApp().globalData || getApp()._options && getApp()._options.globalData || {};
                    messageBuilder = globalData.messageBuilder;
                    debug = new DebugText();
                    debug.setLines(20);
                    console.log('page build widgets');
                    let data = { page: PagesType.MAIN };
                    try {
                        if (!(!this.p || this.p === 'undefined')) {
                            data = JSON.parse(this.p);
                        }
                    } catch (e) {
                        data = { page: this.p };
                    }
                    watchdrip = new Watchdrip();
                    watchdrip.start(data);
                } catch (e) {
                    console.log('LifeCycle Error ' + e);
                    if (debug) {
                        debug.log('LifeCycle Error ' + e);
                        e && e.stack && e.stack.split(/\n/).forEach(i => debug.log('error stack:' + i));
                    }
                }
            },
            onDestroy() {
                logger.debug('page onDestroy invoked');
                if (watchdrip) {
                    watchdrip.onDestroy();
                }
            }
        });
        ;
    })());
} catch (e) {
    console.log('Mini Program Error', e);
    e && e.stack && e.stack.split(/\n/).forEach(i => console.log('error stack', i));
    ;
}