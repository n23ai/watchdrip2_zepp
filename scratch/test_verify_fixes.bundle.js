'use strict';

var fs = require('@zos/fs');
var app = require('@zos/app');
var utils = require('@zos/utils');
require('@zos/device');

function getGlobal () {
  try {
    if (typeof self !== 'undefined') {
      return self
    }
    if (typeof window !== 'undefined') {
      return window
    }
    if (typeof global !== 'undefined') {
      return global
    }
    if (typeof globalThis !== 'undefined') {
      return globalThis
    }
    if (typeof DeviceRuntimeCore !== 'undefined') {
      return DeviceRuntimeCore
    }
  } catch(e) {
    console.log("getGlobal error: " + e);
  }

  console.log("unable to locate global object");
  return {};
}

try {
  console.log("INIT BUFFER");
  let globalNS = getGlobal();
  if (!globalNS.Buffer) {
    if (typeof Buffer !== 'undefined') {
      globalNS.Buffer = Buffer;
    } else if (typeof DeviceRuntimeCore !== 'undefined' && DeviceRuntimeCore.Buffer) {
      globalNS.Buffer = DeviceRuntimeCore.Buffer;
    } else {
      class PolyfillBuffer extends Uint8Array {
          // simple stub for now
      }
      globalNS.Buffer = PolyfillBuffer;
    }
  }
} catch (e) {
  console.log("BUFFER INIT ERROR: " + e);
}

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

        if (!cbs) return
        const index = cbs.findIndex((i) => i === cb);

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
    for (let cb of(this.map.get(type) ? this.map.get(type) : [])) {
      cb && cb(...args);
    }
  }

  count(type) {
    return this.map.get(type) ? this.map.get(type).length : 0
  }
}

function Deferred() {
  const defer = {};

  defer.promise = new Promise(function (resolve, reject) {
    defer.resolve = resolve;
    defer.reject = reject;
  });

  return defer
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

  return defer.promise
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
  return Buffer.from(str, "utf-8");
}

function buf2str(buf) {
  return buf.toString("utf-8");
}

function bin2buf(bin) {
  return Buffer.from(bin);
}

function buf2hex(buf) {
  return buf.toString("hex");
}

function bin2hex(bin) {
  return buf2hex(bin2buf(bin));
}

function bin2json(bin) {
  return buf2Json(bin2buf(bin));
}

function isHmAppDefined() {
  return typeof hmApp !== 'undefined'
}

let logger;
const globalNS = getGlobal();

if (isHmAppDefined()) {
  logger = globalNS.Logger.getLogger('device-message');
  // logger.level = logger.levels.warn
} else {
  logger = globalNS.Logger.getLogger('side-message');
}

const MessageFlag = {
  App: 0x1,
};

const MessageType = {
  Shake: 0x1,
  Close: 0x2,
  Data: 0x4,
  DataWithSystemTool: 0x5,
  Log: 0x6,
};

const MessageVersion = {
  Version1: 0x1,
};

const MessagePayloadType = {
  Request: 0x1,
  Response: 0x2,
  Notify: 0x3,
};

// 中续，结束
const MessagePayloadOpCode = {
  Continued: 0x0,
  Finished: 0x1,
};

let traceId = 10000;
function genTraceId() {
  return traceId++
}

let spanId = 1000;
function genSpanId() {
  return spanId++
}

function getTimestamp(t = Date.now()) {
  return t % 10000000
}

class Session extends EventBus {
  constructor(id, type, ctx) {
    super();
    this.id = id;
    this.type = type; // payloadType
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
      // logger.error('receive chunk data length error, expect %d but %d', payload.payloadLength, payload.payload.byteLength)
      this.emit('error', Error(`receive chunk data length error, expect ${payload.payloadLength} but ${payload.payload.byteLength}`));
      return
    }

    const alreadyExists = this.chunks.some(c => c.seqId === payload.seqId);
    if (alreadyExists) {
      return
    }

    this.chunks.push(payload);
    this.checkIfReceiveAllChunks();
  }

  checkIfReceiveAllChunks() {
    if (this.count !== this.chunks.length) return

    for (let i = 1; i <= this.count; i++) {
      const chunk = this.chunks.find(c => c.seqId === i);

      if (!chunk) {
        this.releaseBuf();
        this.emit('error', Error('receive data error'));
        return
      }

      const buf = chunk.payload;
      this.tempBuf = this.tempBuf ? Buffer.concat([this.tempBuf, buf]) : buf;
    }

    if (!this.finishChunk) return

    this.finishChunk.payload = this.tempBuf;
    this.finishChunk.payloadLength = this.finishChunk.payload.byteLength;

    if (this.finishChunk.totalLength !== this.finishChunk.payloadLength) {
      // logger.error('receive full data length error, expect %d but %d', this.finishChunk.payloadLength, this.finishChunk.payload.byteLength)
      this.emit('error', Error(`receive full data length error, expect ${this.finishChunk.payloadLength} but ${this.finishChunk.payload.byteLength}`));
      return
    }

    this.emit('data', this.finishChunk);
  }

  getLength() {
    return this.tempBufLength
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
    return `${session.id}:${session.type}`
  }

  newSession(id, type, ctx) {
    const newSession = new Session(id, type, ctx);
    this.sessions.set(this.key(newSession), newSession);
    return newSession
  }

  destroy(session) {
    session.releaseBuf();
    this.sessions.delete(this.key(session));
  }

  has(id, type) {
    return this.sessions.has(this.key({ id, type }))
  }

  getById(id, type) {
    return this.sessions.get(this.key({ id, type }))
  }

  clear() {
    this.sessions.clear();
  }
}

class MessageBuilder extends EventBus {
  constructor({ appId = 0, appDevicePort = 20, appSidePort = 0, ble = undefined } = {
    appId: 0,
    appDevicePort: 20,
    appSidePort: 0,
  }, ) {
    super();
    this.ble = ble || (typeof hmBle !== 'undefined' ? hmBle : undefined);
    this.isDevice = !!this.ble;
    this.isSide = !this.isDevice;

    this.appId = appId;
    this.appDevicePort = appDevicePort;
    this.appSidePort = appSidePort;
    this.sendMsg = this.getSafeSend();
    this.chunkSize = 2000;
    this.tempBuf = null;
    this.ready = this.isSide;
    this.readyCallbacks = [];
    // Promise is not part of the Zepp OS 3 Device/App Service contract.
    // Keep the legacy Promise path only in Side Service, where it is supported.
    this.shakeTask = this.isSide ? Deferred() : null;
    this.waitingShakePromise = this.shakeTask ? this.shakeTask.promise : null;
    this.sessionMgr = new SessionMgr();
  }

  now(t = Date.now()) {
    return getTimestamp(t)
  }

  connect(cb) {
    if (cb) this.whenReady(cb);
    if (!this._connected || this.count('message') === 0) {
      this._connected = true;
      if (this.count('message') === 0) {
        this.on('message', (message) => {
          this.onMessage(message);
        });
      }

      this.ble &&
        this.ble.createConnect((index, data, size) => {
          this.onFragmentData(data);
        });
    }

    this.sendShake();
  }

  whenReady(cb) {
    if (this.ready && (!this.isDevice || this.appSidePort !== 0)) {
      cb && cb(this);
      return () => {}
    }
    const entry = { cb, cancelled: false };
    this.readyCallbacks.push(entry);
    return () => { entry.cancelled = true; }
  }

  markReady() {
    if (this.isDevice && this.appSidePort === 0) return
    if (this.ready) return
    this.ready = true;
    const callbacks = this.readyCallbacks.slice();
    this.readyCallbacks = [];
    callbacks.forEach((entry) => {
      if (!entry.cancelled && entry.cb) entry.cb(this);
    });
  }

  disConnect(cb) {
    // Do NOT sendClose() or ble.disConnect() — the companion process
    // is shared with the background app-service.
    this.off('message');
    this._connected = false;
    this.ready = false;
    this.readyCallbacks = [];
    cb && cb(this);
  }

  connectStatus() {
    return this.ble && this.ble.connectStatus()
  }

  listen(cb) {
    messaging &&
      messaging.peerSocket.addListener('message', (message) => {
        // logger.warn('[RAW] [R] receive size=>%d bin=>%s', message.byteLength, this.bin2hex(message))
        this.onMessage(message);
      });

    this.ready = true;
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

    return buf
  }

  buildShake() {
    return this.buildBin({
      flag: MessageFlag.App,
      version: MessageVersion.Version1,
      type: MessageType.Shake,
      port1: this.appDevicePort,
      port2: 0,
      appId: this.appId,
      extra: 0,
      payload: Buffer.from([this.appId]),
    })
  }

  sendShake() {
    if (this.appSidePort === 0 || !this.ready) {
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
      payload: Buffer.from([this.appId]),
    })
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
      payload,
    }
  }

  // opts 覆盖头部选项
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
      payload,
    })
  }

  json2Buf(obj) {
    return json2Buf(obj)
  }

  buf2Json(buf) {
    return buf2Json(buf)
  }

  buf2hex(buf) {
    return buf2hex(buf)
  }

  bin2hex(bin) {
    return bin2hex(bin)
  }

  bin2json(bin) {
    return bin2json(bin)
  }

  sendBin(buf) {
    // ble 发送消息
    // logger.warn('[RAW] [S] send size=%d bin=%s', buf.byteLength, this.bin2hex(buf.buffer))
    console.log('sendBin-------', buf.byteLength);

    this.ble.send(buf.buffer, buf.byteLength);
  }

  sendBinBySide(buf) {
    // side 发送消息
    // logger.warn('[RAW] [S] send size=%d bin=%s', buf.byteLength, this.bin2hex(buf.buffer))
    messaging.peerSocket.send(buf.buffer);
  }

  // 通用获取逻辑
  getSafeSend() {
    if (this.isDevice) {
      return this.sendBin.bind(this)
    } else {
      return this.sendBinBySide.bind(this)
    }
  }

  _logSend(buf) {
    // 日志的 send 里面不要打日志
    if (this.isDevice) {
      this.ble.send(buf.buffer, buf.byteLength);
    } else {
      messaging.peerSocket.send(buf.buffer);
    }
  }

  // 大数据的复杂头部分包协议
  sendHmProtocol({ requestId, dataBin, type }, { messageType = MessageType.Data } = {}) {
    const dataSize = this.chunkSize;
    const headerSize = 0;
    const userDataLength = dataBin.byteLength;

    let offset = 0;
    const _buf = Buffer.alloc(dataSize);
    const traceId = requestId ? requestId : genTraceId();
    const spanId = genSpanId();
    let seqId = 1;

    const count = Math.ceil(userDataLength / dataSize);

    function genSeqId() {
      return seqId++
    }

    for (let i = 1; i <= count; i++) {
      if (i === count) {
        // last
        const tailSize = userDataLength - offset;
        const tailBuf = Buffer.alloc(headerSize + tailSize);

        dataBin.copy(tailBuf, headerSize, offset, offset + tailSize);
        offset += tailSize;
        this.sendDataWithSession({
          traceId,
          spanId: spanId,
          seqId: genSeqId(),
          payload: tailBuf,
          type,
          opCode: MessagePayloadOpCode.Finished,
          totalLength: userDataLength,
        }, { messageType });

        break
      }

      dataBin.copy(_buf, headerSize, offset, offset + dataSize);
      offset += dataSize;

      this.sendDataWithSession({
        traceId,
        spanId: spanId,
        seqId: genSeqId(),
        payload: _buf,
        type,
        opCode: MessagePayloadOpCode.Continued,
        totalLength: userDataLength,
      }, { messageType });
    }
  }

  // 大数据的简单分包协议
  sendSimpleProtocol({ dataBin }, { messageType = MessageType.Data } = {}) {
    const dataSize = this.chunkSize;
    const headerSize = 0;
    const userDataLength = dataBin.byteLength;

    let offset = 0;
    const _buf = Buffer.alloc(dataSize);

    const count = Math.ceil(userDataLength / dataSize);

    for (let i = 1; i <= count; i++) {
      if (i === count) {
        // last
        const tailSize = userDataLength - offset;
        const tailBuf = Buffer.alloc(headerSize + tailSize);

        dataBin.copy(tailBuf, headerSize, offset, offset + tailSize);
        offset += tailSize;
        this.sendSimpleData({ payload: tailBuf }, { messageType });

        break
      }

      dataBin.copy(_buf, headerSize, offset, offset + dataSize);
      offset += dataSize;

      this.sendSimpleData({ payload: _buf }, { messageType });
    }
  }

  sendJson({ requestId = 0, json, type = MessagePayloadType.Request }) {
    const packageBin = this.json2Buf(json);
    const traceId = requestId ? requestId : genTraceId();

    this.sendHmProtocol({ requestId: traceId, dataBin: packageBin, type });
  }

  sendLog(str) {
    const packageBuf = str2buf(str);

    this.sendSimpleProtocol({ dataBin: packageBuf }, { messageType: MessageType.Log });
  }

  sendDataWithSession({ traceId, spanId, seqId, payload, type, opCode, totalLength }, { messageType }, ) {
    const payloadBin = this.buildPayload({
      traceId,
      spanId,
      seqId,
      totalLength,
      type,
      opCode,
      payload,
    });

    let data = this.isDevice ? this.buildData(payloadBin, { type: messageType }) : payloadBin;

    this.sendMsg(data);
  }

  sendSimpleData({ payload }, { messageType }) {
    let data = this.isDevice ? this.buildData(payload, { type: messageType }) : payload;

    this._logSend(data);
  }

  buildPayload(data) {
    const size = 66 + data.payload.byteLength;
    let buf = Buffer.alloc(size);
    let offset = 0;

    // header
    // traceId
    buf.writeUInt32LE(data.traceId, offset);
    offset += 4;

    // parentId
    buf.writeUInt32LE(0, offset);
    offset += 4;

    // spanId
    buf.writeUInt32LE(data.spanId, offset);
    offset += 4;

    // seqId // 顺序 id,消息部分顺序序列号
    buf.writeUInt32LE(data.seqId, offset);
    offset += 4;

    // message total length
    buf.writeUInt32LE(data.totalLength, offset);
    offset += 4;

    // payload length 当前
    buf.writeUInt32LE(data.payload.byteLength, offset);
    offset += 4;

    // payload type
    buf.writeUInt8(data.type, offset);
    offset += 1;

    // opCode
    buf.writeUInt8(data.opCode, offset);
    offset += 1;

    // timestamp1
    buf.writeUInt32LE(this.now(), offset);
    offset += 4;

    // timestamp2
    buf.writeUInt32LE(0, offset);
    offset += 4;

    // timestamp3
    buf.writeUInt32LE(0, offset);
    offset += 4;

    // timestamp4
    buf.writeUInt32LE(0, offset);
    offset += 4;

    // timestamp5
    buf.writeUInt32LE(0, offset);
    offset += 4;

    // timestamp6
    buf.writeUInt32LE(0, offset);
    offset += 4;

    // timestamp7
    buf.writeUInt32LE(0, offset);
    offset += 4;

    // timestamp8
    buf.writeUInt32LE(0, offset);
    offset += 4;

    // extra1
    buf.writeUInt32LE(0, offset);
    offset += 4;

    // extra2
    buf.writeUInt32LE(0, offset);
    offset += 4;

    // payload
    buf.fill(data.payload, offset, data.payload.byteLength + offset);

    return buf
  }

  readPayload(arrayBuf) {
    const buf = Buffer.from(arrayBuf);
    let offset = 0;

    const traceId = buf.readUInt32LE(offset);
    offset += 4;

    const parentId = buf.readUInt32LE(offset);
    offset += 4;

    const spanId = buf.readUInt32LE(offset);
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
      traceId,
      parentId,
      spanId,
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
      payload,
    }
  }

  onFragmentData(bin) {
    const data = this.readBin(bin);
    this.emit('raw', bin);

    // logger.debug('receive data=>', JSON.stringify(data))
    if (data.flag === MessageFlag.App && data.type === MessageType.Shake) {
      this.appSidePort = data.port2;
      // logger.debug('appSidePort=>', data.port2)
      if (this.isDevice) {
        this.markReady();
      } else if (this.shakeTask) {
        this.shakeTask.resolve();
      }
    } else if (
      data.flag === MessageFlag.App &&
      (data.type === MessageType.Data || data.type === MessageType.DataWithSystemTool)
    ) {
      if (this.appSidePort === 0 || (data.port2 && this.appSidePort !== data.port2)) {
        this.appSidePort = data.port2;
      }
      if (!this.ready && this.isDevice) {
        this.markReady();
      }
      this.emit('message', data.payload);
      this.emit('read', data);
    } else if (
      data.flag === MessageFlag.App &&
      data.type === MessageType.Log
    ) {
      if (this.appSidePort === 0 || (data.port2 && this.appSidePort !== data.port2)) {
        this.appSidePort = data.port2;
      }
      this.emit('log', data.payload);
    } else if (
      data.flag === MessageFlag.App &&
      data.type === MessageType.Close
    ) {
      logger.warn('[MSG] Received Close from phone, resetting connection state. port2=%d', data.port2);
      this.appSidePort = 0;
      this.ready = false;
      this.emit('close', data);
      this.emit('error', Error('Connection closed by phone'));
    } else ;
  }

  onMessage(messagePayload) {
    const payload = this.readPayload(messagePayload);
    let session = this.sessionMgr.getById(payload.traceId, payload.payloadType);

    if (!session) {
      session = this.sessionMgr.newSession(payload.traceId, payload.payloadType, this);

      session.on('data', (fullPayload) => {
        if (fullPayload.opCode === MessagePayloadOpCode.Finished) {
          if (fullPayload.payloadType === MessagePayloadType.Request) {
            this.emit('request', {
              request: fullPayload,
              response: ({ data }) => {
                this.response({ requestId: fullPayload.traceId, data });
              },
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

      session.on('error', (error) => {
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

      const error = (error) => {
        this.off('error', error);
        defer.reject(error);
      };

      const transact = ({ traceId, payload }) => {
        // logger.debug('traceId=>%d payload=>%s', traceId, payload.toString('hex'))
        if (traceId === requestId) {
          const resultJson = this.buf2Json(payload);
          // logger.debug('request id=>%d payload=>%j', requestId, data)
          // logger.debug('response id=>%d payload=>%j', requestId, resultJson)

          this.off('response', transact);
          this.off('error', error);
          defer.resolve(resultJson);
        }
      };

      this.on('response', transact);
      this.on('error', error);
      this.sendJson({ requestId, json: data, type: MessagePayloadType.Request });

      let hasReturned = false;

      return Promise.race([
        timeout(opts.timeout, (resolve, reject) => {
          if (hasReturned) {
            return resolve()
          }

          // logger.error(`request timeout in ${opts.timeout}ms error=> %d data=> %j`, requestId, data)
          this.off('response', transact);

          reject(Error(`Timed out in ${opts.timeout}ms.`));
        }),
        defer.promise.finally(() => {
          hasReturned = true;
        }),
      ])
    };

    return this.waitingShakePromise.then(_request)
  }

  requestCb(data, opts, cb) {
    const defaultOpts = { timeout: 60000 };
    if (typeof opts === 'function') {
      cb = opts;
      opts = defaultOpts;
    } else {
      opts = Object.assign(defaultOpts, opts);
    }

    let cancelled = false;
    let hasReturned = false;
    let timer1 = null;
    let readyTimer = null;
    let cancelReady = null;
    let cleanupActiveRequest = null;

    const finish = (error, result) => {
      if (hasReturned || cancelled) return
      hasReturned = true;
      if (readyTimer) {
        clearTimeout(readyTimer);
        readyTimer = null;
      }
      if (cancelReady) {
        cancelReady();
        cancelReady = null;
      }
      if (timer1) {
        clearTimeout(timer1);
        timer1 = null;
      }
      if (cleanupActiveRequest) {
        cleanupActiveRequest();
        cleanupActiveRequest = null;
      }
      if (typeof cb === 'function') {
        cb(error, result);
      }
    };

    const _requestCb = () => {
      if (cancelled || hasReturned) return
      const requestId = genTraceId();

      const transact = ({ traceId, payload }) => {
        // logger.debug('traceId=>%d payload=>%s', traceId, payload.toString('hex'))
        if (traceId === requestId) {
          try {
            finish(null, this.buf2Json(payload));
          } catch (error) {
            finish(error);
          }
        }
      };

      const onError = (error) => finish(error);

      this.on('response', transact);
      this.on('error', onError);
      this.sendJson({ requestId, json: data, type: MessagePayloadType.Request });

      cleanupActiveRequest = () => {
        this.off('response', transact);
        this.off('error', onError);
      };

      if (opts.timeout > 0) {
        timer1 = setTimeout(() => {
          timer1 = null;
          finish(Error(`Timed out in ${opts.timeout}ms.`));
        }, opts.timeout);
      }
    };

    if (this.isDevice) {
      if (this.ready && this.appSidePort !== 0) {
        _requestCb();
      } else {
        cancelReady = this.whenReady(() => {
          if (readyTimer) {
            clearTimeout(readyTimer);
            readyTimer = null;
          }
          cancelReady = null;
          _requestCb();
        });
        if (opts.timeout > 0) {
          readyTimer = setTimeout(() => {
            readyTimer = null;
            if (cancelReady) {
              cancelReady();
              cancelReady = null;
            }
            finish(Error(`Timed out waiting for connection ready in ${opts.timeout}ms.`));
          }, opts.timeout);
        }
        // Re-send shake to nudge the connection in case the first one was lost
        try { this.sendShake(); } catch(e) {}
      }
    } else {
      this.waitingShakePromise.then(_requestCb);
    }

    return () => {
      cancelled = true;
      if (readyTimer) {
        clearTimeout(readyTimer);
        readyTimer = null;
      }
      if (cancelReady) {
        cancelReady();
        cancelReady = null;
      }
      if (timer1) {
        clearTimeout(timer1);
        timer1 = null;
      }
      if (cleanupActiveRequest) {
        cleanupActiveRequest();
        cleanupActiveRequest = null;
      }
    }
  }

  response({ requestId, data }) {
    this.sendJson({ requestId, json: data, type: MessagePayloadType.Response });
  }

  call(data) {
    return this.waitingShakePromise.then(() => {
      return this.sendJson({ json: data, type: MessagePayloadType.Notify })
    })
  }

  log(str) {
    return this.waitingShakePromise.then(() => {
      return this.sendLog(str)
    })
  }
}

const ALARM_UPDATE_INTERVAL = 60; //(in seconds)

const WF_CONFIG_FILE = "config.json";

const WATCHDRIP_SETTINGS_DEFAULTS = {
    disableUpdates: false,
    showLog: true,
    useAppFetch: true,
    timerType: 'on_per_minute',
};

const WATCHDRIP_ALARM_SETTINGS_DEFAULTS = {
    fetchInterval: ALARM_UPDATE_INTERVAL,
    fetchParams: "graph=1"
};

utils.log.getLogger("fs.js");

class Path {
    constructor(scope, path, appid = 0) {
        this.localFS = true;
        // Simplify for Zepp OS 3.0+
        if (!path.startsWith('data://') && path.includes('/')) {
            path = path.substring(path.lastIndexOf('/') + 1);
        }
        scope = "data";

        this.scope = scope;
        this.path = path;
        this.appid = appid;

        this.relativePath = path;
        this.absolutePath = FsTools.fullDataPath(path);
    }

    get(path) {
        const newPath = this.path === "/" ? path : `${this.path}/${path}`;
        return new Path(this.scope, newPath);
    }

    resolve() {
        return new Path("full", this.absolutePath);
    }

    src() {
        return this.relativePath;
    }

    stat() {
        try {
            return fs.statSync({ path: this.relativePath });
        } catch (e) {
            return undefined;
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
        // Map old hmFS flags if they were numbers
        let zFlags = flags;
        if (flags === 1) zFlags = fs.O_RDONLY;
        else if (flags === 2) zFlags = fs.O_WRONLY;
        else if (flags === 4) zFlags = fs.O_CREAT;

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
            return fs.readFileSync({
                path: this.relativePath
            });
        } catch (e) {
            return null;
        }
    }

    fetchText(limit = Infinity) {
        try {
            const st = this.stat();
            const res = fs.readFileSync({
                path: this.relativePath,
                options: { encoding: 'utf8' }
            });
            console.log('[PATH fetchText] path=' + this.relativePath + ' stat_size=' + (st ? st.size : 'undef') + ' res_type=' + typeof res + ' len=' + (res ? (res.length || res.byteLength) : 0));
            if (typeof res === 'string') {
                return res;
            }
            if (res) {
                return FsTools.ab2str(res);
            }
            return null;
        } catch (e) {
            console.log('[PATH fetchText error] path=' + this.relativePath + ' err=' + e);
            try {
                const raw = fs.readFileSync({
                    path: this.relativePath
                });
                console.log('[PATH fallback] raw_type=' + typeof raw + ' len=' + (raw ? (raw.length || raw.byteLength) : 0));
                if (raw && typeof raw !== 'string') {
                    return FsTools.ab2str(raw);
                }
                return raw || null;
            } catch (e2) {
                console.log('[PATH fallback error] path=' + this.relativePath + ' err=' + e2);
                return null;
            }
        }
    }

    fetchJSON() {
        return this.fetchJSONResult().data;
    }

    fetchJSONResult() {
        let text = this.fetchText();
        if (!text) return { data: null, reason: 'missing' };
        try {
            let data = typeof text === 'string' ? JSON.parse(text) : text;
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            return { data: data, reason: '' };
        } catch (e) {
            text = this.fetchText();
            if (!text) return { data: null, reason: 'missing' };
            try {
                let data = typeof text === 'string' ? JSON.parse(text) : text;
                if (typeof data === 'string') {
                    data = JSON.parse(data);
                }
                return { data: data, reason: '' };
            } catch (err) {
                return { data: null, reason: 'invalid_json' };
            }
        }
    }

    override(buffer) {
        try {
            fs.writeFileSync({
                path: this.relativePath,
                data: buffer
            });
            return true;
        } catch (e) {
            console.log("override error", e);
            return false;
        }
    }

    overrideWithText(text) {
        if (typeof text !== 'string') {
            text = String(text !== undefined && text !== null ? text : '');
        }
        try {
            const buf = FsTools.str2ab(text);
            const tmpPath = this.relativePath + '.tmp';
            
            // 1. Write to temporary file as binary ArrayBuffer
            fs.writeFileSync({
                path: tmpPath,
                data: buf
            });
            
            // 2. Verify temporary file was written
            const st = fs.statSync({ path: tmpPath });
            const writtenSize = st ? st.size : 0;
            console.log('[PATH overrideWithText] tmp=' + tmpPath + ' target=' + this.relativePath + ' bufLen=' + buf.byteLength + ' stat_size=' + writtenSize);
            
            if (writtenSize > 0 || buf.byteLength === 0) {
                try {
                    fs.rmSync({ path: this.relativePath });
                } catch (eRm) {}
                const renRes = fs.renameSync({
                    oldPath: tmpPath,
                    newPath: this.relativePath
                });
                console.log('[PATH overrideWithText] renameSync=' + renRes);
                return true;
            } else {
                console.log('[PATH overrideWithText] tmp size 0, writing directly');
                fs.writeFileSync({
                    path: this.relativePath,
                    data: buf
                });
                return true;
            }
        } catch (e) {
            console.log('[PATH overrideWithText error] ' + e);
            try {
                const buf = FsTools.str2ab(text);
                fs.writeFileSync({
                    path: this.relativePath,
                    data: buf
                });
                return true;
            } catch (e2) {
                console.log('[PATH overrideWithText direct error] ' + e2);
                return false;
            }
        }
    }

    overrideWithJSON(data) {
        if (typeof data === 'string') {
            return this.overrideWithText(data);
        }
        return this.overrideWithText(JSON.stringify(data));
    }

    copy(destEntry) {
        const buf = this.fetch();
        destEntry.override(buf);
    }

    copyTree(destEntry, move = false) {
        this.copy(destEntry);
        if (move) this.removeTree();
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
            return [fs.readdirSync({ path: this.relativePath }), 0];
        } catch (e) {
            return [[], -1];
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
        // No native seekSync wrapper needed if we don't do low-level chunked reads
    }

    read(buffer, offset, length) {
        return fs.readSync({
            fd: this._f,
            buffer: buffer,
            options: { offset, length }
        });
    }

    write(buffer, offset, length) {
        fs.writeSync({
            fd: this._f,
            buffer: buffer,
            options: { offset, length }
        });
    }

    close() {
        fs.closeSync({ fd: this._f });
    }
}

class FsTools {
    static getAppLocation() {
        const packageInfo = app.getPackageInfo();
        const idn = packageInfo.appId.toString(16).padStart(8, "0").toUpperCase();
        return [`js_${packageInfo.type}s`, idn];
    }

    static fullAssetPath(path) {
        const [base, idn] = FsTools.getAppLocation();
        return `/storage/${base}/${idn}/assets${path}`;
    }

    static fullDataPath(path) {
        const [base, idn] = FsTools.getAppLocation();
        return `/storage/${base}/data/${idn}${path}`;
    }

    static ab2str(buf) {
        if (!buf) return '';
        const uint8 = new Uint8Array(buf);
        const len = uint8.length;
        if (len === 0) return '';
        let result = '';
        const chunkSize = 1024;
        for (let i = 0; i < len; i += chunkSize) {
            const sub = uint8.subarray(i, Math.min(i + chunkSize, len));
            result += String.fromCharCode.apply(null, sub);
        }
        return result;
    }

    static str2ab(str) {
        if (!str) return new ArrayBuffer(0);
        let utf8 = [];
        for (let i = 0; i < str.length; i++) {
            let charcode = str.charCodeAt(i);
            if (charcode < 0x80) utf8.push(charcode);
            else if (charcode < 0x800) {
                utf8.push(0xc0 | (charcode >> 6), 
                          0x80 | (charcode & 0x3f));
            }
            else if (charcode < 0xd800 || charcode >= 0xe000) {
                utf8.push(0xe0 | (charcode >> 12), 
                          0x80 | ((charcode >> 6) & 0x3f), 
                          0x80 | (charcode & 0x3f));
            }
            else {
                i++;
                charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                utf8.push(0xf0 | (charcode >> 18), 
                          0x80 | ((charcode >> 12) & 0x3f), 
                          0x80 | ((charcode >> 6) & 0x3f), 
                          0x80 | (charcode & 0x3f));
            }
        }
        const buf = new ArrayBuffer(utf8.length);
        const bufView = new Uint8Array(buf);
        for (let i = 0; i < utf8.length; i++) {
            bufView[i] = utf8[i];
        }
        return buf;
    }
}

let file;
class WatchdripConfig {
    constructor() {
        file = new Path("full", WF_CONFIG_FILE);

        this.alarmSettings = {...WATCHDRIP_ALARM_SETTINGS_DEFAULTS};
        this.settings = {...WATCHDRIP_SETTINGS_DEFAULTS};
        this.settingsTime = 0;
        this.infoLastUpd= 0;
        this.infoLastUpdAttempt = 0;
        this.infoLastUpdSucess = false;
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

function nowMs(explicitTime) {
  if (explicitTime) return explicitTime
  try {
    return Date.now()
  } catch (e) {
    return 0
  }
}

let inMemoryDebug = null;

function getInMemoryDebug() {
  return inMemoryDebug
}

function markBackgroundDebug(stage, fields = {}, explicitTime = 0) {
  try {
    const at = nowMs(explicitTime);
    const item = {
      stage,
      at,
      ...fields,
      result: fields.result,
      error: fields.error,
      alarmId: fields.alarmId,
      timeoutId: fields.timeoutId,
    };
    if (!inMemoryDebug) {
      try {
        const conf = new WatchdripConfig();
        if (conf && conf.backgroundDebug && conf.backgroundDebug.stage) {
          inMemoryDebug = conf.backgroundDebug;
        }
      } catch (eInit) {}
    }
    const previous = inMemoryDebug || {};
    const history = [...(previous.history || []), item].slice(-12);
    const debug = {
      stage,
      at,
      count: (previous.count || 0) + 1,
      history,
      ...fields,
    };
    inMemoryDebug = debug;

    // Do NOT synchronously read/save config on routine minute ticks.
    // Only persist synchronously on fatal errors or failures to protect the SoC Deep Sleep window.
    const isFatal = !!(
      fields.error ||
      (fields.result && fields.result !== 'ok' && fields.result !== 'continuous') ||
      (typeof stage === 'string' && (stage.indexOf('error') !== -1 || stage.indexOf('timeout') !== -1 || stage.indexOf('fail') !== -1))
    );
    if (isFatal) {
      try {
        const conf = new WatchdripConfig();
        conf.backgroundDebug = debug;
        conf.save();
      } catch (eSave) {}
    }

    return debug
  } catch (e) {
    return null
  }
}

function getBackgroundDebugText(conf, timeSensor = null) {
  const debug = inMemoryDebug || (conf);
  if (!debug || !debug.stage) return 'dbg: none'

  let age = '?';
  if (debug.at && timeSensor && typeof timeSensor.getTime === 'function') {
    const diff = Math.max(0, timeSensor.getTime() - debug.at);
    age = Math.floor(diff / 60000) + 'm';
  }

  let suffix = '';
  if (debug.result !== undefined) suffix = ' r=' + debug.result;
  if (debug.error) suffix = ' err';
  if (debug.alarmId !== undefined) suffix = ' id=' + debug.alarmId;
  if (debug.timeoutId !== undefined) suffix = ' id=' + debug.timeoutId;

  let trail = '';
  if (debug.history && debug.history.length > 1) {
    const recent = debug.history.slice(-3, -1).map((item) => item.stage).join('>');
    if (recent) trail = ' [' + recent + ']';
  }

  let schedulerText = '';
  if (debug.scheduler && debug.scheduler.timeoutId !== undefined) {
    schedulerText = ' sched=' + (debug.scheduler.source || '?') + '/' + debug.scheduler.timeoutId;
  }

  return 'dbg ' + age + ': ' + debug.stage + suffix + trail + schedulerText
}

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('  PASS: ' + msg);
    passed++;
  } else {
    console.error('  FAIL: ' + msg);
    failed++;
  }
}

async function runTests() {
  console.log('=== Test 1: MessageBuilder initialization and ready state ===');
  const mockBle = {
    connectStatus: () => true,
    createConnect: (cb) => { mockBle.cb = cb; },
    send: (buf, len) => { mockBle.sent = buf; }
  };
  const mb = new MessageBuilder({ appId: 43107, ble: mockBle });
  assert(mb.isDevice === true, 'mb.isDevice is true');
  assert(mb.ready === false, 'mb.ready is false before handshake');
  assert(mb.appSidePort === 0, 'mb.appSidePort is 0 initially');

  mb.connect();
  assert(mb.ready === false, 'mb.ready remains false after connect() until shake reply');
  assert(mockBle.sent !== undefined, 'connect() triggered sendShake');

  console.log('\n=== Test 2: requestCb when not ready -> readyTimer timeout safely calls finish without ReferenceError ===');
  let timeoutFired = false;
  let timeoutErr = null;
  await new Promise((resolve) => {
    mb.requestCb({ method: 'TEST' }, { timeout: 100 }, (err, res) => {
      timeoutFired = true;
      timeoutErr = err;
      resolve();
    });
  });
  assert(timeoutFired === true, 'timeout callback fired');
  assert(timeoutErr !== null, 'error was received');
  assert(timeoutErr.message.includes('Timed out waiting for connection ready'), 'correct error message: ' + (timeoutErr && timeoutErr.message));

  console.log('\n=== Test 3: Shake response establishes port and marks ready ===');
  // Construct a mock Shake reply from phone (flag=1, version=1, type=Shake(1), port1=20, port2=1055, appId=43107)
  const shakeResp = mb.buildBin({
    flag: MessageFlag.App,
    version: 1,
    type: MessageType.Shake,
    port1: 20,
    port2: 1055,
    appId: 43107,
    extra: 0,
    payload: Buffer.from([43107 % 256])
  });
  mb.onFragmentData(shakeResp);
  assert(mb.appSidePort === 1055, 'appSidePort set to 1055: ' + mb.appSidePort);
  assert(mb.ready === true, 'mb.ready is true after shake response');

  console.log('\n=== Test 4: MessageType.Close from phone resets state and aborts in-flight request ===');
  let closeErr = null;
  let reqCalled = false;
  mb.requestCb({ method: 'IN_FLIGHT' }, { timeout: 5000 }, (err, res) => {
    reqCalled = true;
    closeErr = err;
  });

  const closePacket = mb.buildBin({
    flag: MessageFlag.App,
    version: 1,
    type: MessageType.Close,
    port1: 20,
    port2: 1055,
    appId: 43107,
    extra: 0,
    payload: Buffer.from([43107 % 256])
  });
  mb.onFragmentData(closePacket);
  assert(mb.appSidePort === 0, 'appSidePort reset to 0 after Close');
  assert(mb.ready === false, 'mb.ready reset to false after Close');
  assert(reqCalled === true, 'in-flight request aborted immediately on Close');
  assert(closeErr && closeErr.message.includes('closed by phone'), 'in-flight request got error on Close: ' + (closeErr && closeErr.message));

  console.log('\n=== Test 5: Reconnection after Close waits for new Shake ===');
  let reconnectedDone = false;
  mb.requestCb({ method: 'AFTER_CLOSE' }, { timeout: 5000 }, (err, res) => {
    reconnectedDone = true;
  });
  assert(mb.ready === false, 'still not ready');
  assert(reconnectedDone === false, 'request queued waiting for shake');

  // New phone process started with new port 1088
  const newShakeResp = mb.buildBin({
    flag: MessageFlag.App,
    version: 1,
    type: MessageType.Shake,
    port1: 20,
    port2: 1088,
    appId: 43107,
    extra: 0,
    payload: Buffer.from([43107 % 256])
  });
  mb.onFragmentData(newShakeResp);
  assert(mb.appSidePort === 1088, 'appSidePort updated to new port 1088');
  assert(mb.ready === true, 'mb.ready restored to true');

  console.log('\n=== Test 6: inMemoryDebug and getBackgroundDebugText ===');
  markBackgroundDebug('service_minute_tick', { minute: 42 });
  assert(getInMemoryDebug() !== null, 'inMemoryDebug is populated');
  assert(getInMemoryDebug().stage === 'service_minute_tick', 'latest stage is service_minute_tick');
  const dbgText = getBackgroundDebugText(null, null);
  assert(dbgText.includes('service_minute_tick'), 'debug text contains latest in-memory stage: ' + dbgText);

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('Test run crashed: ', e);
  process.exit(1);
});
