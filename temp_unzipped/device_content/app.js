console.log('current filepath: /app.js');
try {
    ((() => {
        const __$$app$$__ = __$$hmAppManager$$__.currentApp;
        function getApp() {
            return __$$app$$__.app;
        }
        function getCurrentPage() {
            return __$$app$$__.current && __$$app$$__.current.module;
        }
        __$$app$$__.__globals__ = {
            lang: new DeviceRuntimeCore.HmUtils.Lang(DeviceRuntimeCore.HmUtils.getLanguage()),
            px: DeviceRuntimeCore.HmUtils.getPx(480)
        };
        const {px} = __$$app$$__.__globals__;
        const timer = __$$RQR$$__('@zos/timer');
        function _interopNamespaceCompat(e) {
            if (e && typeof e === 'object' && 'default' in e)
                return e;
            const n = Object.create(null, { [Symbol.toStringTag]: { value: 'Module' } });
            if (e) {
                for (const k in e) {
                    if (k !== 'default') {
                        const d = Object.getOwnPropertyDescriptor(e, k);
                        Object.defineProperty(n, k, d.get ? d : {
                            enumerable: true,
                            get: () => e[k]
                        });
                    }
                }
            }
            n.default = e;
            return Object.freeze(n);
        }
        const timer__namespace = _interopNamespaceCompat(timer);
        const languageTable = {
            'en-US': {
                fetch_data: 'Get Data',
                fetch_img: 'Fetch Image',
                settings: 'Settings',
                add_treatment: 'Add treatment',
                disableUpdates: 'Disable updates',
                showLog: 'Show log',
                useAppFetch: 'Use Alarms for fetch',
                data_upd_disabled: 'Data updates disabled',
                connecting: 'Connecting...',
                no_data: 'No Data',
                status_no_bt: 'Please "make" sure\nthe bluetooth is enabled\non your phone',
                status_start_watchdrip: 'Launch "Watchdrip+" app\non your phone and activate\n"web server" option'
            }
        };
        __$$app$$__.__globals__.gettext = DeviceRuntimeCore.HmUtils.gettextFactory(languageTable, __$$app$$__.__globals__.lang, 'en-US');
        var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};
        function getDefaultExportFromCjs(x) {
            return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
        }
        function getAugmentedNamespace(n) {
            if (Object.prototype.hasOwnProperty.call(n, '__esModule'))
                return n;
            var f = n.default;
            if (typeof f == 'function') {
                var a = function a() {
                    var isInstance = false;
                    try {
                        isInstance = this instanceof a;
                    } catch (e) {
                    }
                    if (isInstance) {
                        return Reflect.construct(f, arguments, this.constructor);
                    }
                    return f.apply(this, arguments);
                };
                a.prototype = f.prototype;
            } else
                a = {};
            Object.defineProperty(a, '__esModule', { value: true });
            Object.keys(n).forEach(function (k) {
                var d = Object.getOwnPropertyDescriptor(n, k);
                Object.defineProperty(a, k, d.get ? d : {
                    enumerable: true,
                    get: function () {
                        return n[k];
                    }
                });
            });
            return a;
        }
        var logger$1 = {};
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
        const global$1 = Object.freeze(Object.defineProperty({
            __proto__: null,
            getGlobal
        }, Symbol.toStringTag, { value: 'Module' }));
        const require$$0 = getAugmentedNamespace(global$1);
        var hasRequiredLogger;
        function requireLogger() {
            if (hasRequiredLogger)
                return logger$1;
            hasRequiredLogger = 1;
            try {
                console.log('INIT LOGGER');
                const {getGlobal} = require$$0;
                let globalNS = getGlobal();
                if (!globalNS.Logger) {
                    if (typeof DeviceRuntimeCore !== 'undefined') {
                        globalNS.Logger = DeviceRuntimeCore.HmLogger;
                    }
                }
            } catch (e) {
                console.log('LOGGER INIT ERROR: ' + e);
            }
            return logger$1;
        }
        var loggerExports = requireLogger();
        getDefaultExportFromCjs(loggerExports);
        var buffer = {};
        var hasRequiredBuffer;
        function requireBuffer() {
            if (hasRequiredBuffer)
                return buffer;
            hasRequiredBuffer = 1;
            try {
                console.log('INIT BUFFER');
                const {getGlobal} = require$$0;
                let globalNS = getGlobal();
                if (!globalNS.Buffer) {
                    if (typeof Buffer !== 'undefined') {
                        globalNS.Buffer = Buffer;
                    } else if (typeof DeviceRuntimeCore !== 'undefined' && DeviceRuntimeCore.Buffer) {
                        globalNS.Buffer = DeviceRuntimeCore.Buffer;
                    } else {
                        class PolyfillBuffer extends Uint8Array {
                        }
                        globalNS.Buffer = PolyfillBuffer;
                    }
                }
            } catch (e) {
                console.log('BUFFER INIT ERROR: ' + e);
            }
            return buffer;
        }
        var bufferExports = requireBuffer();
        getDefaultExportFromCjs(bufferExports);
        let globalNS = getGlobal();
        if (typeof setTimeout === 'undefined') {
            globalNS.clearTimeout = function clearTimeout(timerRef) {
                timerRef && timer__namespace.stopTimer(timerRef);
            };
            globalNS.setTimeout = function setTimeout2(func, ns) {
                const timer1 = timer__namespace.createTimer(ns || 1, Number.MAX_SAFE_INTEGER, function () {
                    globalNS.clearTimeout(timer1);
                    func && func();
                }, {});
                return timer1;
            };
            globalNS.clearImmediate = function clearImmediate(timerRef) {
                timerRef && timer__namespace.stopTimer(timerRef);
            };
            globalNS.setImmediate = function setImmediate(func) {
                const timer1 = timer__namespace.createTimer(1, Number.MAX_SAFE_INTEGER, function () {
                    globalNS.clearImmediate(timer1);
                    func && func();
                }, {});
                return timer1;
            };
            globalNS.clearInterval = function clearInterval(timerRef) {
                timerRef && timer__namespace.stopTimer(timerRef);
            };
            globalNS.setInterval = function setInterval(func, ms) {
                const timer1 = timer__namespace.createTimer(1, ms, function () {
                    func && func();
                }, {});
                return timer1;
            };
        }
        var promise = { exports: {} };
        var hasRequiredPromise;
        function requirePromise() {
            if (hasRequiredPromise)
                return promise.exports;
            hasRequiredPromise = 1;
            (function (module, exports) {
                (function (global, factory) {
                    if (typeof global.Promise !== 'undefined')
                        return;
                    factory();
                }(globalThis, function () {
                    function finallyConstructor(callback) {
                        var constructor = this.constructor;
                        return this.then(function (value) {
                            return constructor.resolve(callback()).then(function () {
                                return value;
                            });
                        }, function (reason) {
                            return constructor.resolve(callback()).then(function () {
                                return constructor.reject(reason);
                            });
                        });
                    }
                    function allSettled(arr) {
                        var P = this;
                        return new P(function (resolve2, reject2) {
                            if (!(arr && typeof arr.length !== 'undefined')) {
                                return reject2(new TypeError(typeof arr + ' ' + arr + ' is not iterable(cannot read property Symbol(Symbol.iterator))'));
                            }
                            var args = Array.prototype.slice.call(arr);
                            if (args.length === 0)
                                return resolve2([]);
                            var remaining = args.length;
                            function res(i2, val) {
                                if (val && (typeof val === 'object' || typeof val === 'function')) {
                                    var then = val.then;
                                    if (typeof then === 'function') {
                                        then.call(val, function (val2) {
                                            res(i2, val2);
                                        }, function (e) {
                                            args[i2] = {
                                                status: 'rejected',
                                                reason: e
                                            };
                                            if (--remaining === 0) {
                                                resolve2(args);
                                            }
                                        });
                                        return;
                                    }
                                }
                                args[i2] = {
                                    status: 'fulfilled',
                                    value: val
                                };
                                if (--remaining === 0) {
                                    resolve2(args);
                                }
                            }
                            for (var i = 0; i < args.length; i++) {
                                res(i, args[i]);
                            }
                        });
                    }
                    var setTimeoutFunc = setTimeout;
                    function isArray(x) {
                        return Boolean(x && typeof x.length !== 'undefined');
                    }
                    function noop() {
                    }
                    function bind(fn, thisArg) {
                        return function () {
                            fn.apply(thisArg, arguments);
                        };
                    }
                    function Promise(fn) {
                        if (!(this instanceof Promise))
                            throw new TypeError('Promises must be constructed via new');
                        if (typeof fn !== 'function')
                            throw new TypeError('not a function');
                        this._state = 0;
                        this._handled = false;
                        this._value = void 0;
                        this._deferreds = [];
                        doResolve(fn, this);
                    }
                    function handle(self2, deferred) {
                        while (self2._state === 3) {
                            self2 = self2._value;
                        }
                        if (self2._state === 0) {
                            self2._deferreds.push(deferred);
                            return;
                        }
                        self2._handled = true;
                        Promise._immediateFn(function () {
                            var cb = self2._state === 1 ? deferred.onFulfilled : deferred.onRejected;
                            if (cb === null) {
                                (self2._state === 1 ? resolve : reject)(deferred.promise, self2._value);
                                return;
                            }
                            var ret;
                            try {
                                ret = cb(self2._value);
                            } catch (e) {
                                reject(deferred.promise, e);
                                return;
                            }
                            resolve(deferred.promise, ret);
                        });
                    }
                    function resolve(self2, newValue) {
                        try {
                            if (newValue === self2)
                                throw new TypeError('A promise cannot be resolved with itself.');
                            if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
                                var then = newValue.then;
                                if (newValue instanceof Promise) {
                                    self2._state = 3;
                                    self2._value = newValue;
                                    finale(self2);
                                    return;
                                } else if (typeof then === 'function') {
                                    doResolve(bind(then, newValue), self2);
                                    return;
                                }
                            }
                            self2._state = 1;
                            self2._value = newValue;
                            finale(self2);
                        } catch (e) {
                            reject(self2, e);
                        }
                    }
                    function reject(self2, newValue) {
                        self2._state = 2;
                        self2._value = newValue;
                        finale(self2);
                    }
                    function finale(self2) {
                        if (self2._state === 2 && self2._deferreds.length === 0) {
                            Promise._immediateFn(function () {
                                if (!self2._handled) {
                                    Promise._unhandledRejectionFn(self2._value);
                                }
                            });
                        }
                        for (var i = 0, len = self2._deferreds.length; i < len; i++) {
                            handle(self2, self2._deferreds[i]);
                        }
                        self2._deferreds = null;
                    }
                    function Handler(onFulfilled, onRejected, promise2) {
                        this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
                        this.onRejected = typeof onRejected === 'function' ? onRejected : null;
                        this.promise = promise2;
                    }
                    function doResolve(fn, self2) {
                        var done = false;
                        try {
                            fn(function (value) {
                                if (done)
                                    return;
                                done = true;
                                resolve(self2, value);
                            }, function (reason) {
                                if (done)
                                    return;
                                done = true;
                                reject(self2, reason);
                            });
                        } catch (ex) {
                            if (done)
                                return;
                            done = true;
                            reject(self2, ex);
                        }
                    }
                    Promise.prototype['catch'] = function (onRejected) {
                        return this.then(null, onRejected);
                    };
                    Promise.prototype.then = function (onFulfilled, onRejected) {
                        var prom = new this.constructor(noop);
                        handle(this, new Handler(onFulfilled, onRejected, prom));
                        return prom;
                    };
                    Promise.prototype['finally'] = finallyConstructor;
                    Promise.all = function (arr) {
                        return new Promise(function (resolve2, reject2) {
                            if (!isArray(arr)) {
                                return reject2(new TypeError('Promise.all accepts an array'));
                            }
                            var args = Array.prototype.slice.call(arr);
                            if (args.length === 0)
                                return resolve2([]);
                            var remaining = args.length;
                            function res(i2, val) {
                                try {
                                    if (val && (typeof val === 'object' || typeof val === 'function')) {
                                        var then = val.then;
                                        if (typeof then === 'function') {
                                            then.call(val, function (val2) {
                                                res(i2, val2);
                                            }, reject2);
                                            return;
                                        }
                                    }
                                    args[i2] = val;
                                    if (--remaining === 0) {
                                        resolve2(args);
                                    }
                                } catch (ex) {
                                    reject2(ex);
                                }
                            }
                            for (var i = 0; i < args.length; i++) {
                                res(i, args[i]);
                            }
                        });
                    };
                    Promise.allSettled = allSettled;
                    Promise.resolve = function (value) {
                        if (value && typeof value === 'object' && value.constructor === Promise) {
                            return value;
                        }
                        return new Promise(function (resolve2) {
                            resolve2(value);
                        });
                    };
                    Promise.reject = function (value) {
                        return new Promise(function (resolve2, reject2) {
                            reject2(value);
                        });
                    };
                    Promise.race = function (arr) {
                        return new Promise(function (resolve2, reject2) {
                            if (!isArray(arr)) {
                                return reject2(new TypeError('Promise.race accepts an array'));
                            }
                            for (var i = 0, len = arr.length; i < len; i++) {
                                Promise.resolve(arr[i]).then(resolve2, reject2);
                            }
                        });
                    };
                    Promise._immediateFn = typeof setImmediate === 'function' && function (fn) {
                        setImmediate(fn);
                    } || function (fn) {
                        setTimeoutFunc(fn, 0);
                    };
                    Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
                        if (typeof console !== 'undefined' && console) {
                            console.log('[jsfwk.error  ] Possible Unhandled Promise Rejection:', err);
                        }
                    };
                    var globalNS = (function () {
                        if (typeof self !== 'undefined') {
                            return self;
                        }
                        if (typeof window !== 'undefined') {
                            return window;
                        }
                        if (typeof commonjsGlobal !== 'undefined') {
                            return commonjsGlobal;
                        }
                        if (typeof globalThis !== 'undefined') {
                            return globalThis;
                        }
                        try {
                            if (typeof DeviceRuntimeCore !== 'undefined')
                                return DeviceRuntimeCore;
                        } catch (e) {
                        }
                        return {};
                    }());
                    globalNS['Promise'] = Promise;
                }));
            }());
            return promise.exports;
        }
        var promiseExports = requirePromise();
        getDefaultExportFromCjs(promiseExports);
        console.log('DEVICE_POLYFILL START');
        console.log('DEVICE_POLYFILL END');
        class EventBus {
            constructor() {
                this.map = new Map();
            }
            on(type, cb) {
                if (this.map.has(type)) {
                    this.map.get(type).push(cb);
                } else {
                    this.map.set(type, [cb]);
                }
            }
            off(type, cb) {
                if (type) {
                    if (cb) {
                        const cbs = this.map.get(type);
                        if (!cbs)
                            return;
                        const index = cbs.findIndex(i => i === cb);
                        if (index >= 0) {
                            cbs.splice(index, 1);
                        }
                    } else {
                        this.map.delete(type);
                    }
                } else {
                    this.map.clear();
                }
            }
            emit(type, ...args) {
                for (let cb of this.map.get(type) ? this.map.get(type) : []) {
                    cb && cb(...args);
                }
            }
            count(type) {
                return this.map.get(type) ? this.map.get(type).length : 0;
            }
        }
        function Deferred() {
            const defer = {};
            defer.promise = new Promise(function (resolve, reject) {
                defer.resolve = resolve;
                defer.reject = reject;
            });
            return defer;
        }
        function timeout(ms, cb) {
            const defer = Deferred();
            ms = ms || 1000;
            const wait = setTimeout(() => {
                clearTimeout(wait);
                if (cb) {
                    cb && cb(defer.resolve, defer.reject);
                } else {
                    defer.reject('Timed out in ' + ms + 'ms.');
                }
            }, ms);
            return defer.promise;
        }
        function json2Buf(json) {
            return str2buf(json2str(json));
        }
        function buf2Json(buf) {
            return str2json(buf2str(buf));
        }
        function str2json(str) {
            return JSON.parse(str);
        }
        function json2str(json) {
            return JSON.stringify(json);
        }
        function str2buf(str) {
            return Buffer.from(str, 'utf-8');
        }
        function buf2str(buf) {
            return buf.toString('utf-8');
        }
        function bin2buf(bin) {
            return Buffer.from(bin);
        }
        function buf2hex(buf) {
            return buf.toString('hex');
        }
        function bin2hex(bin) {
            return buf2hex(bin2buf(bin));
        }
        function bin2json(bin) {
            return buf2Json(bin2buf(bin));
        }
        function isHmBleDefined() {
            return typeof hmBle !== 'undefined';
        }
        function isHmAppDefined() {
            return typeof hmApp !== 'undefined';
        }
        let logger;
        if (isHmAppDefined()) {
            logger = Logger.getLogger('device-message');
        } else {
            logger = Logger.getLogger('side-message');
        }
        const DEBUG = false;
        const MessageFlag = { App: 1 };
        const MessageType = {
            Shake: 1,
            Close: 2,
            Heart: 3,
            Data: 4,
            DataWithSystemTool: 5,
            Log: 6
        };
        const MessageVersion = { Version1: 1 };
        const MessagePayloadType = {
            Request: 1,
            Response: 2,
            Notify: 3
        };
        const MessagePayloadOpCode = {
            Continued: 0,
            Finished: 1
        };
        let traceId = 10000;
        function genTraceId() {
            return traceId++;
        }
        let spanId = 1000;
        function genSpanId() {
            return spanId++;
        }
        function getTimestamp(t = Date.now()) {
            return t % 10000000;
        }
        class Session extends EventBus {
            constructor(id, type, ctx) {
                super();
                this.id = id;
                this.type = type;
                this.ctx = ctx;
                this.tempBuf = null;
                this.chunks = [];
                this.count = 0;
                this.finishChunk = null;
            }
            addChunk(payload) {
                if (payload.opCode === MessagePayloadOpCode.Finished) {
                    this.count = payload.seqId;
                    this.finishChunk = payload;
                }
                if (payload.payloadLength !== payload.payload.byteLength) {
                    this.emit('error', Error(`receive chunk data length error, expect ${ payload.payloadLength } but ${ payload.payload.byteLength }`));
                    return;
                }
                this.chunks.push(payload);
                this.checkIfReceiveAllChunks();
            }
            checkIfReceiveAllChunks() {
                if (this.count !== this.chunks.length)
                    return;
                for (let i = 1; i <= this.count; i++) {
                    const chunk = this.chunks.find(c => c.seqId === i);
                    if (!chunk) {
                        this.releaseBuf();
                        this.emit('error', Error('receive data error'));
                        return;
                    }
                    const buf = chunk.payload;
                    this.tempBuf = this.tempBuf ? Buffer.concat([
                        this.tempBuf,
                        buf
                    ]) : buf;
                }
                if (!this.finishChunk)
                    return;
                this.finishChunk.payload = this.tempBuf;
                this.finishChunk.payloadLength = this.finishChunk.payload.byteLength;
                if (this.finishChunk.totalLength !== this.finishChunk.payloadLength) {
                    this.emit('error', Error(`receive full data length error, expect ${ this.finishChunk.payloadLength } but ${ this.finishChunk.payload.byteLength }`));
                    return;
                }
                this.emit('data', this.finishChunk);
            }
            getLength() {
                return this.tempBufLength;
            }
            releaseBuf() {
                this.tempBuf = null;
                this.chunks = [];
                this.finishChunk = null;
                this.count = 0;
            }
        }
        class SessionMgr {
            constructor() {
                this.sessions = new Map();
            }
            key(session) {
                return `${ session.id }:${ session.type }`;
            }
            newSession(id, type, ctx) {
                const newSession = new Session(id, type, ctx);
                this.sessions.set(this.key(newSession), newSession);
                return newSession;
            }
            destroy(session) {
                session.releaseBuf();
                this.sessions.delete(this.key(session));
            }
            has(id, type) {
                return this.sessions.has(this.key({
                    id,
                    type
                }));
            }
            getById(id, type) {
                return this.sessions.get(this.key({
                    id,
                    type
                }));
            }
            clear() {
                this.sessions.clear();
            }
        }
        class MessageBuilder extends EventBus {
            constructor({appId = 0, appDevicePort = 20, appSidePort = 0} = {
                appId: 0,
                appDevicePort: 20,
                appSidePort: 0
            }) {
                super();
                this.isDevice = isHmBleDefined();
                this.isSide = !this.isDevice;
                this.appId = appId;
                this.appDevicePort = appDevicePort;
                this.appSidePort = appSidePort;
                this.sendMsg = this.getSafeSend();
                this.chunkSize = 2000;
                this.tempBuf = null;
                this.shakeTask = Deferred();
                this.waitingShakePromise = this.shakeTask.promise;
                this.sessionMgr = new SessionMgr();
                if (isHmAppDefined() && DEBUG) {
                    logger.connect({
                        log: logEvent => {
                            this.log(JSON.stringify(logEvent));
                        }
                    });
                }
            }
            now(t = Date.now()) {
                return getTimestamp(t);
            }
            connect(cb) {
                this.on('message', message => {
                    this.onMessage(message);
                });
                hmBle && hmBle.createConnect((index, data, size) => {
                    console.log('createConnect-------', size);
                    this.onFragmentData(data);
                });
                this.sendShake();
                cb && cb(this);
            }
            disConnect(cb) {
                this.sendClose();
                this.off('message');
                hmBle && hmBle.disConnect();
                cb && cb(this);
            }
            connectStatus() {
                return hmBle && hmBle.connectStatus();
            }
            listen(cb) {
                messaging && messaging.peerSocket.addListener('message', message => {
                    this.onMessage(message);
                });
                this.waitingShakePromise = Promise.resolve();
                cb && cb(this);
            }
            buildBin(data) {
                const size = 16 + data.payload.byteLength;
                let buf = Buffer.alloc(size);
                let offset = 0;
                buf.writeUInt8(data.flag, offset);
                offset += 1;
                buf.writeUInt8(data.version, offset);
                offset += 1;
                buf.writeUInt16LE(data.type, offset);
                offset += 2;
                buf.writeUInt16LE(data.port1, offset);
                offset += 2;
                buf.writeUInt16LE(data.port2, offset);
                offset += 2;
                buf.writeUInt32LE(data.appId, offset);
                offset += 4;
                buf.writeUInt32LE(data.extra, offset);
                offset += 4;
                buf.fill(data.payload, offset, data.payload.byteLength + offset);
                return buf;
            }
            buildShake() {
                return this.buildBin({
                    flag: MessageFlag.App,
                    version: MessageVersion.Version1,
                    type: MessageType.Shake,
                    port1: this.appDevicePort,
                    port2: this.appSidePort,
                    appId: this.appId,
                    extra: 0,
                    payload: Buffer.from([this.appId])
                });
            }
            sendShake() {
                if (this.appSidePort === 0) {
                    const shake = this.buildShake();
                    this.sendMsg(shake);
                }
            }
            buildClose() {
                return this.buildBin({
                    flag: MessageFlag.App,
                    version: MessageVersion.Version1,
                    type: MessageType.Close,
                    port1: this.appDevicePort,
                    port2: this.appSidePort,
                    appId: this.appId,
                    extra: 0,
                    payload: Buffer.from([this.appId])
                });
            }
            sendClose() {
                if (this.appSidePort !== 0) {
                    const close = this.buildClose();
                    this.sendMsg(close);
                }
            }
            readBin(arrayBuf) {
                const buf = Buffer.from(arrayBuf);
                let offset = 0;
                const flag = buf.readUInt8(offset);
                offset += 1;
                const version = buf.readUInt8(offset);
                offset += 1;
                const type = buf.readUInt16LE(offset);
                offset += 2;
                const port1 = buf.readUInt16LE(offset);
                offset += 2;
                const port2 = buf.readUInt16LE(offset);
                offset += 2;
                const appId = buf.readUInt32LE(offset);
                offset += 4;
                const extra = buf.readUInt32LE(offset);
                offset += 4;
                const payload = buf.subarray(offset);
                return {
                    flag,
                    version,
                    type,
                    port1,
                    port2,
                    appId,
                    extra,
                    payload
                };
            }
            buildData(payload, opts = {}) {
                return this.buildBin({
                    flag: MessageFlag.App,
                    version: MessageVersion.Version1,
                    type: MessageType.Data,
                    port1: this.appDevicePort,
                    port2: this.appSidePort,
                    appId: this.appId,
                    extra: 0,
                    ...opts,
                    payload
                });
            }
            json2Buf(obj) {
                return json2Buf(obj);
            }
            buf2Json(buf) {
                return buf2Json(buf);
            }
            buf2hex(buf) {
                return buf2hex(buf);
            }
            bin2hex(bin) {
                return bin2hex(bin);
            }
            bin2json(bin) {
                return bin2json(bin);
            }
            sendBin(buf) {
                console.log('sendBin-------', buf.byteLength);
                hmBle.send(buf.buffer, buf.byteLength);
            }
            sendBinBySide(buf) {
                messaging.peerSocket.send(buf.buffer);
            }
            getSafeSend() {
                if (this.isDevice) {
                    return this.sendBin.bind(this);
                } else {
                    return this.sendBinBySide.bind(this);
                }
            }
            _logSend(buf) {
                if (this.isDevice) {
                    hmBle.send(buf.buffer, buf.byteLength);
                } else {
                    messaging.peerSocket.send(buf.buffer);
                }
            }
            sendHmProtocol({requestId, dataBin, type}, {
                messageType = MessageType.Data
            } = {}) {
                const dataSize = this.chunkSize;
                const headerSize = 0;
                const userDataLength = dataBin.byteLength;
                let offset = 0;
                const _buf = Buffer.alloc(dataSize);
                const traceId2 = requestId ? requestId : genTraceId();
                const spanId2 = genSpanId();
                let seqId = 1;
                const count = Math.ceil(userDataLength / dataSize);
                function genSeqId() {
                    return seqId++;
                }
                for (let i = 1; i <= count; i++) {
                    if (i === count) {
                        const tailSize = userDataLength - offset;
                        const tailBuf = Buffer.alloc(headerSize + tailSize);
                        dataBin.copy(tailBuf, headerSize, offset, offset + tailSize);
                        offset += tailSize;
                        this.sendDataWithSession({
                            traceId: traceId2,
                            spanId: spanId2,
                            seqId: genSeqId(),
                            payload: tailBuf,
                            type,
                            opCode: MessagePayloadOpCode.Finished,
                            totalLength: userDataLength
                        }, { messageType });
                        break;
                    }
                    dataBin.copy(_buf, headerSize, offset, offset + dataSize);
                    offset += dataSize;
                    this.sendDataWithSession({
                        traceId: traceId2,
                        spanId: spanId2,
                        seqId: genSeqId(),
                        payload: _buf,
                        type,
                        opCode: MessagePayloadOpCode.Continued,
                        totalLength: userDataLength
                    }, { messageType });
                }
            }
            sendSimpleProtocol({dataBin}, {
                messageType = MessageType.Data
            } = {}) {
                const dataSize = this.chunkSize;
                const headerSize = 0;
                const userDataLength = dataBin.byteLength;
                let offset = 0;
                const _buf = Buffer.alloc(dataSize);
                const count = Math.ceil(userDataLength / dataSize);
                for (let i = 1; i <= count; i++) {
                    if (i === count) {
                        const tailSize = userDataLength - offset;
                        const tailBuf = Buffer.alloc(headerSize + tailSize);
                        dataBin.copy(tailBuf, headerSize, offset, offset + tailSize);
                        offset += tailSize;
                        this.sendSimpleData({ payload: tailBuf }, { messageType });
                        break;
                    }
                    dataBin.copy(_buf, headerSize, offset, offset + dataSize);
                    offset += dataSize;
                    this.sendSimpleData({ payload: _buf }, { messageType });
                }
            }
            sendJson({requestId = 0, json, type = MessagePayloadType.Request}) {
                const packageBin = this.json2Buf(json);
                const traceId2 = requestId ? requestId : genTraceId();
                this.sendHmProtocol({
                    requestId: traceId2,
                    dataBin: packageBin,
                    type
                });
            }
            sendLog(str) {
                const packageBuf = str2buf(str);
                this.sendSimpleProtocol({ dataBin: packageBuf }, { messageType: MessageType.Log });
            }
            sendDataWithSession({
                traceId: traceId2,
                spanId: spanId2,
                seqId,
                payload,
                type,
                opCode,
                totalLength
            }, {messageType}) {
                const payloadBin = this.buildPayload({
                    traceId: traceId2,
                    spanId: spanId2,
                    seqId,
                    totalLength,
                    type,
                    opCode,
                    payload
                });
                let data = this.isDevice ? this.buildData(payloadBin, { type: messageType }) : payloadBin;
                this.sendMsg(data);
            }
            sendSimpleData({payload}, {messageType}) {
                let data = this.isDevice ? this.buildData(payload, { type: messageType }) : payload;
                this._logSend(data);
            }
            buildPayload(data) {
                const size = 66 + data.payload.byteLength;
                let buf = Buffer.alloc(size);
                let offset = 0;
                buf.writeUInt32LE(data.traceId, offset);
                offset += 4;
                buf.writeUInt32LE(0, offset);
                offset += 4;
                buf.writeUInt32LE(data.spanId, offset);
                offset += 4;
                buf.writeUInt32LE(data.seqId, offset);
                offset += 4;
                buf.writeUInt32LE(data.totalLength, offset);
                offset += 4;
                buf.writeUInt32LE(data.payload.byteLength, offset);
                offset += 4;
                buf.writeUInt8(data.type, offset);
                offset += 1;
                buf.writeUInt8(data.opCode, offset);
                offset += 1;
                buf.writeUInt32LE(this.now(), offset);
                offset += 4;
                buf.writeUInt32LE(0, offset);
                offset += 4;
                buf.writeUInt32LE(0, offset);
                offset += 4;
                buf.writeUInt32LE(0, offset);
                offset += 4;
                buf.writeUInt32LE(0, offset);
                offset += 4;
                buf.writeUInt32LE(0, offset);
                offset += 4;
                buf.writeUInt32LE(0, offset);
                offset += 4;
                buf.writeUInt32LE(0, offset);
                offset += 4;
                buf.writeUInt32LE(0, offset);
                offset += 4;
                buf.writeUInt32LE(0, offset);
                offset += 4;
                buf.fill(data.payload, offset, data.payload.byteLength + offset);
                return buf;
            }
            readPayload(arrayBuf) {
                const buf = Buffer.from(arrayBuf);
                let offset = 0;
                const traceId2 = buf.readUInt32LE(offset);
                offset += 4;
                const parentId = buf.readUInt32LE(offset);
                offset += 4;
                const spanId2 = buf.readUInt32LE(offset);
                offset += 4;
                const seqId = buf.readUInt32LE(offset);
                offset += 4;
                const totalLength = buf.readUInt32LE(offset);
                offset += 4;
                const payloadLength = buf.readUInt32LE(offset);
                offset += 4;
                const payloadType = buf.readUInt8(offset);
                offset += 1;
                const opCode = buf.readUInt8(offset);
                offset += 1;
                const timestamp1 = buf.readUInt32LE(offset);
                offset += 4;
                const timestamp2 = buf.readUInt32LE(offset);
                offset += 4;
                const timestamp3 = buf.readUInt32LE(offset);
                offset += 4;
                const timestamp4 = buf.readUInt32LE(offset);
                offset += 4;
                const timestamp5 = buf.readUInt32LE(offset);
                offset += 4;
                const timestamp6 = buf.readUInt32LE(offset);
                offset += 4;
                const timestamp7 = buf.readUInt32LE(offset);
                offset += 4;
                const timestamp8 = buf.readUInt32LE(offset);
                offset += 4;
                const extra1 = buf.readUInt32LE(offset);
                offset += 4;
                const extra2 = buf.readUInt32LE(offset);
                offset += 4;
                const payload = buf.subarray(offset);
                return {
                    traceId: traceId2,
                    parentId,
                    spanId: spanId2,
                    seqId,
                    totalLength,
                    payloadLength,
                    payloadType,
                    opCode,
                    timestamp1,
                    timestamp2,
                    timestamp3,
                    timestamp4,
                    timestamp5,
                    timestamp6,
                    timestamp7,
                    timestamp8,
                    extra1,
                    extra2,
                    payload
                };
            }
            onFragmentData(bin) {
                const data = this.readBin(bin);
                this.emit('raw', bin);
                if (data.flag === MessageFlag.App && data.type === MessageType.Shake) {
                    this.appSidePort = data.port2;
                    this.shakeTask.resolve();
                } else if (data.flag === MessageFlag.App && data.type === MessageType.Data && data.port2 === this.appSidePort) {
                    this.emit('message', data.payload);
                    this.emit('read', data);
                } else if (data.flag === MessageFlag.App && data.type === MessageType.DataWithSystemTool && data.port2 === this.appSidePort) {
                    this.emit('message', data.payload);
                    this.emit('read', data);
                } else if (data.flag === MessageFlag.App && data.type === MessageType.Log && data.port2 === this.appSidePort) {
                    this.emit('log', data.payload);
                } else ;
            }
            onMessage(messagePayload) {
                const payload = this.readPayload(messagePayload);
                let session = this.sessionMgr.getById(payload.traceId, payload.payloadType);
                if (!session) {
                    session = this.sessionMgr.newSession(payload.traceId, payload.payloadType, this);
                    session.on('data', fullPayload => {
                        if (fullPayload.opCode === MessagePayloadOpCode.Finished) {
                            if (fullPayload.payloadType === MessagePayloadType.Request) {
                                this.emit('request', {
                                    request: fullPayload,
                                    response: ({data}) => {
                                        this.response({
                                            requestId: fullPayload.traceId,
                                            data
                                        });
                                    }
                                });
                            } else if (fullPayload.payloadType === MessagePayloadType.Response) {
                                this.emit('response', fullPayload);
                            } else if (fullPayload.payloadType === MessagePayloadType.Notify) {
                                this.emit('call', fullPayload);
                            }
                            this.emit('data', fullPayload);
                            this.sessionMgr.destroy(session);
                        }
                    });
                    session.on('error', error => {
                        this.sessionMgr.destroy(session);
                        this.emit('error', error);
                    });
                }
                session.addChunk(payload);
            }
            request(data, opts) {
                const _request = () => {
                    const defaultOpts = { timeout: 60000 };
                    const requestId = genTraceId();
                    const defer = Deferred();
                    opts = Object.assign(defaultOpts, opts);
                    const error = error2 => {
                        this.off('error', error2);
                        defer.reject(error2);
                    };
                    const transact = ({
                        traceId: traceId2,
                        payload
                    }) => {
                        if (traceId2 === requestId) {
                            const resultJson = this.buf2Json(payload);
                            this.off('response', transact);
                            this.off('error', error);
                            defer.resolve(resultJson);
                        }
                    };
                    this.on('response', transact);
                    this.on('error', error);
                    this.sendJson({
                        requestId,
                        json: data,
                        type: MessagePayloadType.Request
                    });
                    let hasReturned = false;
                    return Promise.race([
                        timeout(opts.timeout, (resolve, reject) => {
                            if (hasReturned) {
                                return resolve();
                            }
                            this.off('response', transact);
                            reject(Error(`Timed out in ${ opts.timeout }ms.`));
                        }),
                        defer.promise.finally(() => {
                            hasReturned = true;
                        })
                    ]);
                };
                return this.waitingShakePromise.then(_request);
            }
            requestCb(data, opts, cb) {
                const _requestCb = () => {
                    const defaultOpts = { timeout: 60000 };
                    if (typeof opts === 'function') {
                        cb = opts;
                        opts = defaultOpts;
                    } else {
                        opts = Object.assign(defaultOpts, opts);
                    }
                    const requestId = genTraceId();
                    let timer1 = null;
                    let hasReturned = false;
                    const transact = ({
                        traceId: traceId2,
                        payload
                    }) => {
                        if (traceId2 === requestId) {
                            const resultJson = this.buf2Json(payload);
                            this.off('response', transact);
                            timer1 && clearTimeout(timer1);
                            timer1 = null;
                            hasReturned = true;
                            cb(null, resultJson);
                        }
                    };
                    this.on('response', transact);
                    this.sendJson({
                        requestId,
                        json: data,
                        type: MessagePayloadType.Request
                    });
                    timer1 = setTimeout(() => {
                        timer1 = null;
                        if (hasReturned) {
                            return;
                        }
                        this.off('response', transact);
                        cb(Error(`Timed out in ${ opts.timeout }ms.`));
                    }, opts.timeout);
                };
                return this.waitingShakePromise.then(_requestCb);
            }
            response({requestId, data}) {
                this.sendJson({
                    requestId,
                    json: data,
                    type: MessagePayloadType.Response
                });
            }
            call(data) {
                return this.waitingShakePromise.then(() => {
                    return this.sendJson({
                        json: data,
                        type: MessagePayloadType.Notify
                    });
                });
            }
            log(str) {
                return this.waitingShakePromise.then(() => {
                    return this.sendLog(str);
                });
            }
        }
        const WATCHDRIP_APP_ID = '43107';
        console.log('APP.JS START LOAD');
        console.log('APP.JS IMPORTS DONE');
        const appId = WATCHDRIP_APP_ID;
        const messageBuilder = new MessageBuilder({ appId });
        __$$app$$__.app = DeviceRuntimeCore.App({
            globalData: { messageBuilder },
            onCreate(options) {
                console.log('app on create invoke');
                messageBuilder.connect();
            },
            onDestroy(options) {
                console.log('app on destroy invoke');
                messageBuilder.disConnect();
            }
        });
        ;
    })());
} catch (e) {
    console.log('Mini Program Error', e);
    e && e.stack && e.stack.split(/\n/).forEach(i => console.log('error stack', i));
    ;
}