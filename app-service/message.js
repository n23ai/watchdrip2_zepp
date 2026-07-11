import '../shared/buffer'
import { json2Buf, buf2Json } from '../shared/data'

const MessageFlag = { App: 0x1 }
const MessageType = { Shake: 0x1, Close: 0x2, Data: 0x4, DataWithSystemTool: 0x5 }
const MessageVersion = { Version1: 0x1 }
const PayloadType = { Request: 0x1, Response: 0x2 }
const PayloadOpCode = { Continued: 0x0, Finished: 0x1 }

let traceId = 10000
let spanId = 1000

function nextTraceId() {
  return traceId++
}

function nextSpanId() {
  return spanId++
}

function timestamp() {
  return Date.now() % 10000000
}

export class ServiceMessageBuilder {
  constructor({ appId, ble, appDevicePort = 20, appSidePort = 0 }) {
    this.appId = appId
    this.ble = ble
    this.appDevicePort = appDevicePort
    this.appSidePort = appSidePort
    this.chunkSize = 2000
    this.connected = false
    this.pendingRequest = null
    this.activeRequest = null
    this.sessions = {}
  }

  connect() {
    this.ble.createConnect((index, data, size) => {
      this.onFragmentData(data)
    })
    this.sendShake()
  }

  disconnect() {
    this.cancelRequest()
    if (this.appSidePort !== 0) {
      this.sendBuffer(this.buildEnvelope(MessageType.Close, Buffer.from([this.appId])))
    }
    this.ble.disConnect()
    this.connected = false
    this.appSidePort = 0
    this.sessions = {}
  }

  requestCb(data, callback) {
    this.cancelRequest()
    const request = {
      id: nextTraceId(),
      data,
      callback,
      canceled: false,
      sent: false,
    }
    this.activeRequest = request
    if (this.connected && this.appSidePort !== 0) {
      this.sendRequest(request)
    } else {
      this.pendingRequest = request
      this.sendShake()
    }
    return {
      cancel: () => {
        if (request.canceled) return
        request.canceled = true
        if (this.pendingRequest === request) this.pendingRequest = null
        if (this.activeRequest === request) this.activeRequest = null
      },
    }
  }

  cancelRequest() {
    if (this.pendingRequest) this.pendingRequest.canceled = true
    if (this.activeRequest) this.activeRequest.canceled = true
    this.pendingRequest = null
    this.activeRequest = null
  }

  sendRequest(request) {
    if (!request || request.canceled || request.sent) return
    request.sent = true
    this.pendingRequest = null
    this.sendJson(request.id, request.data, PayloadType.Request)
  }

  sendShake() {
    if (this.appSidePort !== 0) return
    this.sendBuffer(this.buildEnvelope(MessageType.Shake, Buffer.from([this.appId])))
  }

  sendJson(requestId, value, type) {
    const data = json2Buf(value)
    const currentSpanId = nextSpanId()
    const count = Math.ceil(data.byteLength / this.chunkSize)
    let offset = 0
    for (let seqId = 1; seqId <= count; seqId++) {
      const size = Math.min(this.chunkSize, data.byteLength - offset)
      const chunk = Buffer.alloc(size)
      data.copy(chunk, 0, offset, offset + size)
      offset += size
      const payload = this.buildPayload({
        traceId: requestId,
        spanId: currentSpanId,
        seqId,
        totalLength: data.byteLength,
        type,
        opCode: seqId === count ? PayloadOpCode.Finished : PayloadOpCode.Continued,
        payload: chunk,
      })
      this.sendBuffer(this.buildEnvelope(MessageType.Data, payload))
    }
  }

  sendBuffer(buffer) {
    this.ble.send(buffer.buffer, buffer.byteLength)
  }

  buildEnvelope(type, payload) {
    const buffer = Buffer.alloc(16 + payload.byteLength)
    let offset = 0
    buffer.writeUInt8(MessageFlag.App, offset++)
    buffer.writeUInt8(MessageVersion.Version1, offset++)
    buffer.writeUInt16LE(type, offset); offset += 2
    buffer.writeUInt16LE(this.appDevicePort, offset); offset += 2
    buffer.writeUInt16LE(this.appSidePort, offset); offset += 2
    buffer.writeUInt32LE(this.appId, offset); offset += 4
    buffer.writeUInt32LE(0, offset); offset += 4
    buffer.fill(payload, offset, offset + payload.byteLength)
    return buffer
  }

  readEnvelope(arrayBuffer) {
    const buffer = Buffer.from(arrayBuffer)
    let offset = 0
    const flag = buffer.readUInt8(offset++)
    const version = buffer.readUInt8(offset++)
    const type = buffer.readUInt16LE(offset); offset += 2
    const port1 = buffer.readUInt16LE(offset); offset += 2
    const port2 = buffer.readUInt16LE(offset); offset += 2
    const appId = buffer.readUInt32LE(offset); offset += 4
    const extra = buffer.readUInt32LE(offset); offset += 4
    return { flag, version, type, port1, port2, appId, extra, payload: buffer.subarray(offset) }
  }

  buildPayload(data) {
    const buffer = Buffer.alloc(66 + data.payload.byteLength)
    let offset = 0
    buffer.writeUInt32LE(data.traceId, offset); offset += 4
    buffer.writeUInt32LE(0, offset); offset += 4
    buffer.writeUInt32LE(data.spanId, offset); offset += 4
    buffer.writeUInt32LE(data.seqId, offset); offset += 4
    buffer.writeUInt32LE(data.totalLength, offset); offset += 4
    buffer.writeUInt32LE(data.payload.byteLength, offset); offset += 4
    buffer.writeUInt8(data.type, offset++)
    buffer.writeUInt8(data.opCode, offset++)
    buffer.writeUInt32LE(timestamp(), offset); offset += 4
    for (let i = 0; i < 9; i++) {
      buffer.writeUInt32LE(0, offset)
      offset += 4
    }
    buffer.fill(data.payload, offset, offset + data.payload.byteLength)
    return buffer
  }

  readPayload(arrayBuffer) {
    const buffer = Buffer.from(arrayBuffer)
    let offset = 0
    const result = {}
    result.traceId = buffer.readUInt32LE(offset); offset += 4
    offset += 8
    result.seqId = buffer.readUInt32LE(offset); offset += 4
    result.totalLength = buffer.readUInt32LE(offset); offset += 4
    result.payloadLength = buffer.readUInt32LE(offset); offset += 4
    result.payloadType = buffer.readUInt8(offset++)
    result.opCode = buffer.readUInt8(offset++)
    offset += 40
    result.payload = buffer.subarray(offset)
    return result
  }

  onFragmentData(arrayBuffer) {
    const envelope = this.readEnvelope(arrayBuffer)
    if (envelope.flag !== MessageFlag.App) return
    if (envelope.type === MessageType.Shake) {
      this.appSidePort = envelope.port2
      this.connected = this.appSidePort !== 0
      console.log('watchdrip service handshake sidePort=' + this.appSidePort)
      if (this.connected && this.pendingRequest) this.sendRequest(this.pendingRequest)
      return
    }
    if (envelope.type !== MessageType.Data && envelope.type !== MessageType.DataWithSystemTool) return
    if (envelope.port2 !== this.appSidePort) return
    this.onPayload(this.readPayload(envelope.payload))
  }

  onPayload(payload) {
    if (payload.payloadType !== PayloadType.Response) return
    const key = String(payload.traceId)
    let session = this.sessions[key]
    if (!session) {
      session = { chunks: {}, count: 0, totalLength: payload.totalLength }
      this.sessions[key] = session
    }
    session.chunks[payload.seqId] = payload.payload
    if (payload.opCode === PayloadOpCode.Finished) session.count = payload.seqId
    if (!session.count) return
    for (let i = 1; i <= session.count; i++) {
      if (!session.chunks[i]) return
    }
    let combined = null
    for (let i = 1; i <= session.count; i++) {
      combined = combined ? Buffer.concat([combined, session.chunks[i]]) : session.chunks[i]
    }
    delete this.sessions[key]
    if (!combined || combined.byteLength !== session.totalLength) return
    const request = this.activeRequest
    if (!request || request.canceled || request.id !== payload.traceId) return
    this.activeRequest = null
    request.callback(null, buf2Json(combined))
  }
}
