import { log } from '@zos/utils'
import { writeFileSync } from '@zos/fs'
import { MessageBuilder } from '../shared/message'
import { getPackageInfo } from '@zos/app'
import { WF_INFO_FILE, WATCHDRIP_ALARM_SETTINGS_DEFAULTS } from '../utils/config/global-constants'
import { Commands } from '../utils/config/constants'
import { Time } from '@zos/sensor'
import { formatLogLine, summarizeInfo } from '../shared/log-format'

const logger = log.getLogger('watchdrip-bg')
const ble = require('@zos/ble')
const MIN_FETCH_SPACING_MS = 45000

let messageBuilder = null
let timeSensor = null
let serviceApi = null
let cancelActiveRequest = null
let fetchInFlight = false
let fetchStartedAt = 0
let lastFetchStartedAt = 0
let runId = 0
let tickSequence = 0
let requestGeneration = 0
let lastTerminalStage = 'NONE'
let lastErrorCode = ''
let serviceActive = false

function safeText(value, maxLength = 100) {
  return String(value && (value.message || value.stack) || value || '')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, maxLength)
}

function lifecycleLog(event, fields = {}, level = 'log') {
  const logFields = {
    run: runId,
    tick: tickSequence,
    request: fields.requestId || 'none',
    stage: fields.stage || lastTerminalStage,
  }
  if (fields.errorCode) logFields.errorCode = fields.errorCode
  if (fields.code) logFields.code = fields.code
  if (fields.age !== undefined) logFields.age = fields.age
  if (fields.value !== undefined) logFields.value = fields.value
  if (fields.unit !== undefined) logFields.unit = fields.unit
  if (fields.stale !== undefined) logFields.stale = fields.stale
  if (fields.error) logFields.error = safeText(fields.error)
  const text = formatLogLine('WD_BG', 'SERVICE', event, logFields)

  if (level === 'error') logger.error(text)
  else if (level === 'warn') logger.warn(text)
  else logger.log(text)

}

function finishRequest(generation) {
  if (generation !== requestGeneration) return false
  fetchInFlight = false
  cancelActiveRequest = null
  return true
}

function startFetch(source) {
  if (!serviceActive || !serviceApi || !messageBuilder) {
    lifecycleLog('FETCH_SKIP', { code: 'INACTIVE' }, 'warn')
    return
  }

  const now = Date.now()
  if (fetchInFlight) {
    const age = now - fetchStartedAt
    if (age < MIN_FETCH_SPACING_MS) {
      lifecycleLog('BUSY', { code: source, age }, 'warn')
      return
    }
    if (cancelActiveRequest) cancelActiveRequest()
    cancelActiveRequest = null
    fetchInFlight = false
    requestGeneration += 1
    lifecycleLog('STALE_RECOVERED', { code: source, age }, 'warn')
  }

  if (lastFetchStartedAt && now - lastFetchStartedAt < MIN_FETCH_SPACING_MS) {
    lifecycleLog('SPACING_SKIP', { code: source, age: now - lastFetchStartedAt })
    return
  }

  const generation = ++requestGeneration
  const requestId = runId + '-' + generation
  fetchInFlight = true
  fetchStartedAt = now
  lastFetchStartedAt = now
  lifecycleLog('FETCH_START', { requestId, code: source })

  try {
    cancelActiveRequest = messageBuilder.requestCb({
      method: Commands.getInfo,
      params: WATCHDRIP_ALARM_SETTINGS_DEFAULTS.fetchParams,
      meta: {
        runId,
        tick: tickSequence,
        requestId,
        priorStage: lastTerminalStage,
        priorErrorCode: lastErrorCode,
      },
    }, { timeout: 0 }, (error, data) => {
    if (generation !== requestGeneration) {
      lifecycleLog('LATE_CALLBACK', { requestId, code: 'STALE_GENERATION' }, 'warn')
      return
    }
    if (!finishRequest(generation)) return
    if (!serviceActive) {
      lifecycleLog('LATE_CALLBACK', { requestId, code: 'SERVICE_INACTIVE' }, 'warn')
      return
    }

    if (error) {
      lastTerminalStage = 'ERROR'
      lastErrorCode = 'TRANSPORT'
      lifecycleLog('TRANSPORT_ERROR', {
        requestId,
        code: 'TRANSPORT',
        errorCode: lastErrorCode,
        error,
      }, 'error')
      return
    }

    const info = data && data.result
    const infoSummary = summarizeInfo(info)
    lifecycleLog('CALLBACK', { requestId, code: 'OK', ...infoSummary })
    if (!info || (typeof info === 'object' && info.error)) {
      lastTerminalStage = 'ERROR'
      lastErrorCode = 'REMOTE_ERROR'
      lifecycleLog('REQUEST_ERROR', {
        requestId,
        code: 'REMOTE_ERROR',
        errorCode: lastErrorCode,
      }, 'error')
      return
    }

    try {
      writeFileSync({
        path: WF_INFO_FILE,
        data: typeof info === 'string' ? info : JSON.stringify(info),
        options: { encoding: 'utf8' },
      })
      lastTerminalStage = 'SAVE_OK'
      lastErrorCode = ''
      lifecycleLog('SAVE_OK', { requestId, code: 'OK', ...infoSummary })
    } catch (writeError) {
      lastTerminalStage = 'ERROR'
      lastErrorCode = 'INFO_IO'
      lifecycleLog('SAVE_ERROR', {
        requestId,
        code: 'INFO_IO',
        errorCode: lastErrorCode,
        error: writeError,
      }, 'error')
    }
    })
  } catch (requestError) {
    fetchInFlight = false
    cancelActiveRequest = null
    lastTerminalStage = 'ERROR'
    lastErrorCode = 'REQUEST_START'
    lifecycleLog('REQUEST_ERROR', {
      requestId,
      code: 'REQUEST_START',
      errorCode: lastErrorCode,
      error: requestError,
    }, 'error')
  }
}

AppService({
  onInit(params) {
    try {
      runId = Date.now() % 100000000
      tickSequence = 0
      requestGeneration = 0
      lastTerminalStage = 'NONE'
      lastErrorCode = ''
      fetchInFlight = false
      fetchStartedAt = 0
      lastFetchStartedAt = 0
      cancelActiveRequest = null
      serviceActive = true
      serviceApi = this
      lifecycleLog('INIT', { code: safeText(params || 'continuous', 40) })

      const { appId } = getPackageInfo()
      messageBuilder = new MessageBuilder({ appId, ble })
      timeSensor = new Time()
      timeSensor.onPerMinute(() => {
        if (!serviceActive) return
        tickSequence += 1
        lifecycleLog('TICK', { code: 'PER_MINUTE' })
        if (serviceApi) startFetch('PER_MINUTE')
      })

      messageBuilder.connect(() => {
        if (!serviceActive) {
          lifecycleLog('TRANSPORT_SKIP', { code: 'INACTIVE' }, 'warn')
          return
        }
        lifecycleLog('TRANSPORT_READY', { code: 'OK' })
        startFetch('INITIAL')
      })
    } catch (error) {
      lastTerminalStage = 'ERROR'
      lastErrorCode = 'INIT'
      serviceActive = false
      lifecycleLog('INIT_ERROR', { code: 'INIT', error }, 'error')
    }
  },

  onDestroy() {
    lifecycleLog('DESTROY', { code: 'OS', stage: 'DESTROY' }, 'warn')
    serviceActive = false
    if (cancelActiveRequest) cancelActiveRequest()
    cancelActiveRequest = null
    try {
      if (messageBuilder) messageBuilder.disConnect()
    } catch (error) {
      lifecycleLog('DESTROY_ERROR', {
        code: 'DISCONNECT',
        errorCode: 'DISCONNECT',
        error,
      }, 'error')
    }
    messageBuilder = null
    timeSensor = null
    serviceApi = null
    fetchInFlight = false
  },
})
