import { MessageBuilder } from '../shared/message'
import {
  Commands,
  SERVER_INFO_URL,
  SERVER_PUT_TREATMENTS_URL,
  SERVER_URL,
} from '../utils/config/constants'
import { formatLogLine, summarizeInfo } from '../shared/log-format'

const messageBuilder = new MessageBuilder()
const MAX_LOG_LINES = 50
const HTTP_TIMEOUT_MS = 5000

let logBuffer = []

function getSettingsStorage() {
  try {
    if (typeof settings !== 'undefined' && settings.settingsStorage) {
      return settings.settingsStorage
    }
  } catch (e) {}
  return null
}

function loadPersistedLogs() {
  const storage = getSettingsStorage()
  if (!storage) return
  const existing = storage.getItem('recent_logs')
  if (existing && !logBuffer.length) {
    logBuffer = String(existing).split('\n').slice(-MAX_LOG_LINES)
  }
}

function persistLogs() {
  const storage = getSettingsStorage()
  if (!storage) return
  try {
    storage.setItem('recent_logs', logBuffer.slice(-MAX_LOG_LINES).join('\n'))
  } catch (e) {
    console.log(formatLogLine('WD_BG', 'SIDE', 'LOG_PERSIST_ERROR', {code: 'SETTINGS_IO'}))
  }
}

function addCritical(event, meta = {}, fields = {}) {
  loadPersistedLogs()
  const logFields = {
    run: meta.runId || 0,
    tick: meta.tick || 0,
    request: meta.requestId || 'none',
  }
  if (meta.priorStage) logFields.prior = meta.priorStage
  if (meta.priorErrorCode) logFields.priorError = meta.priorErrorCode
  if (fields.code !== undefined) logFields.code = fields.code
  if (fields.value !== undefined) logFields.value = fields.value
  if (fields.unit !== undefined) logFields.unit = fields.unit
  if (fields.stale !== undefined) logFields.stale = fields.stale
  if (fields.duration !== undefined) logFields.ms = fields.duration
  if (fields.bytes !== undefined) logFields.bytes = fields.bytes
  if (fields.error !== undefined) logFields.error = fields.error
  const line = formatLogLine('WD_BG', 'SIDE', event, logFields)
  console.log(line)
  logBuffer.push(line)
  if (logBuffer.length > MAX_LOG_LINES) logBuffer = logBuffer.slice(-MAX_LOG_LINES)
}

function addVerbose(event, meta = {}, fields = {}) {
  const storage = getSettingsStorage()
  const enabled = storage && (storage.getItem('network_logging') === 'true' ||
    storage.getItem('network_logging') === true)
  if (!enabled) return
  addCritical('VERBOSE_' + event, meta, fields)
}

function getServerUrl() {
  const storage = getSettingsStorage()
  let url = storage && storage.getItem('server_url')
  if (!url) url = SERVER_URL
  return url.endsWith('/') ? url : url + '/'
}

async function requestInfo(url, meta) {
  const startedAt = Date.now()
  addCritical('HTTP_START', meta)
  try {
    const fetchPromise = fetch({ url, method: 'GET' })
    const timeoutPromise = new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('HTTP_TIMEOUT')), HTTP_TIMEOUT_MS)
    })
    const response = await Promise.race([fetchPromise, timeoutPromise])
    if (!response.body) throw Error('NO_DATA')
    const data = response.body
    addCritical('HTTP_OK', meta, {
      code: response.status || 200,
      duration: Date.now() - startedAt,
      bytes: JSON.stringify(data).length,
      ...summarizeInfo(data),
    })
    return data
  } catch (error) {
    const code = String(error && error.message || error || 'HTTP_ERROR').slice(0, 40)
    addCritical('HTTP_ERROR', meta, { code, duration: Date.now() - startedAt })
    return { error: true, message: code }
  }
}

async function fetchInfo(ctx, url, meta) {
  const result = await requestInfo(url, meta)
  try {
    ctx.response({ data: { result, meta } })
    addCritical('RESPONSE_ENQUEUED', meta, {
      code: result && result.error ? 'REMOTE_ERROR' : 'OK',
      ...summarizeInfo(result),
    })
  } catch (error) {
    addCritical('RESPONSE_ERROR', meta, {
      code: String(error && error.message || error || 'RESPONSE_ERROR').slice(0, 40),
    })
  }
  persistLogs()
}

async function fetchRaw(ctx, url, meta) {
  const startedAt = Date.now()
  addCritical('RAW_HTTP_START', meta)
  try {
    const fetchPromise = fetch({ url, method: 'GET' })
    const timeoutPromise = new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('HTTP_TIMEOUT')), HTTP_TIMEOUT_MS)
    })
    const response = await Promise.race([fetchPromise, timeoutPromise])
    ctx.response({ data: { result: response.body } })
    addCritical('RAW_HTTP_OK', meta, {
      code: response.status || 200,
      duration: Date.now() - startedAt,
    })
  } catch (error) {
    ctx.response({ data: { result: 'ERROR' } })
    addCritical('RAW_HTTP_ERROR', meta, {
      code: String(error && error.message || error || 'HTTP_ERROR').slice(0, 40),
    })
  }
  persistLogs()
}

AppSideService({
  onInit() {
    loadPersistedLogs()
    messageBuilder.listen(() => {})

    try {
      const storage = getSettingsStorage()
      if (storage) {
        storage.addListener('change', async ({ key }) => {
          if (key === 'trigger_clear') {
            logBuffer = []
            persistLogs()
          } else if (key === 'trigger_upload') {
            const uploadUrl = storage.getItem('webhook_url') || 'http://127.0.0.1:29863/save_logs'
            try {
              await fetch({
                url: uploadUrl,
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: logBuffer.join('\n') || 'No logs',
              })
              addVerbose('UPLOAD_OK')
            } catch (error) {
              addCritical('UPLOAD_ERROR', {}, { code: 'UPLOAD_FAILED' })
              persistLogs()
            }
          }
        })
      }
    } catch (error) {
      addCritical('SETTINGS_LISTENER_ERROR', {}, { code: 'SETTINGS_LISTENER' })
      persistLogs()
    }

    messageBuilder.on('request', (ctx) => {
      let jsonRpc
      try {
        jsonRpc = messageBuilder.buf2Json(ctx.request.payload)
      } catch (error) {
        addCritical('REQUEST_DECODE_ERROR', {}, { code: 'BAD_JSON' })
        persistLogs()
        return
      }

      const params = jsonRpc.params || ''
      const meta = jsonRpc.meta || {}
      addCritical('REQUEST_RECEIVED', meta, { code: jsonRpc.method || 'UNKNOWN' })
      const baseUrl = getServerUrl()
      switch (jsonRpc.method) {
        case Commands.getInfo:
          return fetchInfo(ctx, baseUrl + SERVER_INFO_URL + '?' + params, meta)
        case Commands.getImg:
          return fetchRaw(ctx, baseUrl + 'get_img.php?' + params, meta)
        case Commands.putTreatment:
          return fetchRaw(ctx, baseUrl + SERVER_PUT_TREATMENTS_URL + '?' + params, meta)
        default:
          addCritical('REQUEST_UNKNOWN', meta, { code: 'UNKNOWN_METHOD' })
          persistLogs()
      }
    })
  },

  onRun() {},
  onDestroy() {
    persistLogs()
  },
})
