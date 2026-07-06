console.log('current filepath: /data-widget/index.js');
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
        const sensor = __$$RQR$$__('@zos/sensor');
        const fs = __$$RQR$$__('@zos/fs');
        const device = __$$RQR$$__('@zos/device');
        const app = __$$RQR$$__('@zos/app');
        const ui = __$$RQR$$__('@zos/ui');
        const utils = __$$RQR$$__('@zos/utils');
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
        const MINUTE_IN_MS = 60000;
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
        const Colors = {
            default: 3355443,
            defaultTransparent: 367351,
            white: 16777215,
            black: 0,
            bgHigh: 16752800,
            bgLow: 9157631,
            accent: 4290707255
        };
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
        const WF_DIR = '/storage/js_apps/data/watchdrip';
        const WF_INFO_FILE = WF_DIR + '/info.json';
        const {
            width: DEVICE_WIDTH,
            height: DEVICE_HEIGHT
        } = device.getDeviceInfo();
        const centerX = DEVICE_WIDTH / 2;
        const topOffset = DEVICE_HEIGHT > 400 ? 56 : 49;
        __$$module$$__.module = DeviceRuntimeCore.DataWidget({
            state: {
                timeSensor: null,
                watchdripData: null,
                infoFile: null,
                updateTimer: null,
                bgValTextWidget: null,
                bgTrendImageWidget: null,
                bgDeltaTextWidget: null,
                bgValTimeTextWidget: null
            },
            onInit() {
                console.log('Workout widget: onInit');
                try {
                    this.state.timeSensor = new sensor.Time();
                    this.state.watchdripData = new WatchdripData(this.state.timeSensor);
                    this.state.infoFile = new Path('full', WF_INFO_FILE);
                } catch (e) {
                    console.log('Workout widget: onInit error', e);
                }
            },
            build() {
                console.log('Workout widget: build');
                try {
                    this.state.bgValTextWidget = ui.createWidget(ui.widget.TEXT, {
                        x: centerX - 122,
                        y: topOffset + 25,
                        w: 244,
                        h: 70,
                        color: Colors.white,
                        text_size: 61,
                        align_h: ui.align.CENTER_H,
                        align_v: ui.align.CENTER_V,
                        text_style: ui.text_style.NONE,
                        text: '--'
                    });
                    this.state.bgTrendImageWidget = ui.createWidget(ui.widget.IMG, {
                        x: centerX - 17,
                        y: topOffset + 102,
                        w: 34,
                        h: 32,
                        src: 'watchdrip/arrows/None.png'
                    });
                    this.state.bgDeltaTextWidget = ui.createWidget(ui.widget.TEXT, {
                        x: centerX - 122,
                        y: topOffset + 143,
                        w: 244,
                        h: 33,
                        color: 11184810,
                        text_size: 25,
                        align_h: ui.align.CENTER_H,
                        align_v: ui.align.CENTER_V,
                        text_style: ui.text_style.NONE,
                        text: '--'
                    });
                    this.state.bgValTimeTextWidget = ui.createWidget(ui.widget.TEXT, {
                        x: centerX - 122,
                        y: topOffset + 179,
                        w: 244,
                        h: 25,
                        color: 8947848,
                        text_size: 20,
                        align_h: ui.align.CENTER_H,
                        align_v: ui.align.CENTER_V,
                        text_style: ui.text_style.NONE,
                        text: '--'
                    });
                    this.updateUI();
                } catch (e) {
                    console.log('Workout widget: build error', e);
                }
            },
            onResume() {
                console.log('Workout widget: onResume');
                try {
                    this.updateUI();
                    this.state.updateTimer = setInterval(() => {
                        this.updateUI();
                    }, 15000);
                } catch (e) {
                    console.log('Workout widget: onResume error', e);
                }
            },
            onPause() {
                console.log('Workout widget: onPause');
                try {
                    if (this.state.updateTimer) {
                        clearInterval(this.state.updateTimer);
                        this.state.updateTimer = null;
                    }
                } catch (e) {
                    console.log('Workout widget: onPause error', e);
                }
            },
            onDestroy() {
                console.log('Workout widget: onDestroy');
                try {
                    if (this.state.updateTimer) {
                        clearInterval(this.state.updateTimer);
                        this.state.updateTimer = null;
                    }
                } catch (e) {
                    console.log('Workout widget: onDestroy error', e);
                }
            },
            updateUI() {
                console.log('Workout widget: updateUI');
                try {
                    const data = this.state.infoFile.fetchJSON();
                    if (data) {
                        this.state.watchdripData.setData(data);
                        this.state.watchdripData.timeDiff = 0;
                        const bgObj = this.state.watchdripData.getBg();
                        let bgValColor = Colors.white;
                        if (bgObj.isHigh) {
                            bgValColor = Colors.bgHigh;
                        } else if (bgObj.isLow) {
                            bgValColor = Colors.bgLow;
                        }
                        this.state.bgValTextWidget.setProperty(ui.prop.MORE, {
                            text: bgObj.getBGVal() || '--',
                            color: bgValColor
                        });
                        this.state.bgDeltaTextWidget.setProperty(ui.prop.MORE, { text: (bgObj.delta || '') + ' ' + this.state.watchdripData.getStatus().getUnitText() });
                        this.state.bgTrendImageWidget.setProperty(ui.prop.SRC, bgObj.getArrowResource());
                        this.state.bgValTimeTextWidget.setProperty(ui.prop.MORE, { text: this.state.watchdripData.getTimeAgo(bgObj.time) || '--' });
                    }
                } catch (e) {
                    console.log('Workout widget: updateUI error', e);
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