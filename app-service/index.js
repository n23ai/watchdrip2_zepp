import { log } from '@zos/utils'
import { writeFileSync, statSync, renameSync } from '@zos/fs'
import { MessageBuilder } from "../shared/message"
import { getPackageInfo } from '@zos/app'
import { WF_INFO_FILE, WATCHDRIP_ALARM_SETTINGS_DEFAULTS } from "../utils/config/global-constants"
import { Commands } from "../utils/config/constants"
import { WatchdripConfig } from "../utils/watchdrip/config"
import { Time } from '@zos/sensor'
import { markBackgroundDebug } from "../utils/watchdrip/background-debug"
import { formatSugarLog } from "../shared/log-format"
import { FsTools } from "../utils/path"
console.log("watchdrip service: module loading start")
const logger = log.getLogger("watchdrip_service")
const ble = require('@zos/ble')

// Temporary file used for verified writes. The main info.json is only replaced after
// the temp file is confirmed non-empty, so a blocked write (spec: App Service file
// writes are only allowed with the screen off / AOD) can never truncate info.json.
const WF_INFO_TMP_FILE = 'info.tmp.json'
// App Service has no JS timers (spec guides/framework.md:189). A request is
// considered lost when it is still in flight on the next minute tick older than this.
const REQUEST_DEADLINE_MS = 15000

let rawTimeSensor = null
try {
  rawTimeSensor = new Time()
  console.log("watchdrip service: Time sensor instantiated")
} catch (eTime) {
  console.log("watchdrip service: error creating Time sensor: " + eTime)
}
const timeSensor = rawTimeSensor

let messageBuilder = null
let conf = null
let isMinuteSubscribed = false
let fetchInFlight = false
let lastFetchStarted = 0
let lastMinuteTick = 0
let cancelActiveRequest = null
let lastSavedSignature = { time: null, val: null, isError: null }

// Diagnostics (kept in memory; never written to flash on routine ticks).
let serviceStartedAt = 0
let tickSeq = 0
let fetchSeq = 0
let lastStage = 'none'
let okCount = 0
let failCount = 0
let deferredCount = 0

// Latest fetched payload that could not be persisted yet (screen on).
let pendingInfo = null
// Re-register the BLE receiver only after a connection reset, not on every fetch.
let needsBleRebind = false

function wdLog(tag, text) {
  const line = '[' + tag + '] ' + text
  console.log('watchdrip service ' + line)
  logger.log(line)
}

function setStage(stage) {
  lastStage = stage
}

function uptimeSec() {
  return serviceStartedAt ? Math.round((Date.now() - serviceStartedAt) / 1000) : 0
}

function rebindBle(reason) {
  if (!ble || typeof ble.createConnect !== 'function' || !messageBuilder) return
  try {
    ble.createConnect((index, data, size) => {
      messageBuilder.onFragmentData(data)
    })
    wdLog('WD_REQ', 'ble_rebind reason=' + reason)
  } catch (e) {
    logger.error('failed to rebind ble: ' + e)
  }
}

function expireActiveRequest(reason, age) {
  wdLog('WD_REQ', 'outcome=expired reason=' + reason + ' seq=' + fetchSeq + ' age=' + age + 'ms')
  markBackgroundDebug('fetch_expired', { reason, age }, Date.now())
  failCount++
  if (cancelActiveRequest) {
    try { cancelActiveRequest() } catch (eCancel) {}
    cancelActiveRequest = null
  }
  if (messageBuilder) {
    try { messageBuilder.resetConnection(reason) } catch (eReset) {}
  }
  needsBleRebind = true
  fetchInFlight = false
}

function onMinuteCallback() {
  const now = Date.now()
  tickSeq++
  const gapSec = lastMinuteTick ? Math.round((now - lastMinuteTick) / 1000) : 0
  lastMinuteTick = now
  const minute = timeSensor ? timeSensor.getMinutes() : -1
  const bleStatus = ble && typeof ble.connectStatus === 'function' ? ble.connectStatus() : 'na'
  const ready = messageBuilder ? messageBuilder.ready : false
  const port2 = messageBuilder ? messageBuilder.appSidePort : 0
  wdLog('WD_TICK', 'seq=' + tickSeq + ' gap=' + gapSec + 's min=' + minute + ' ble=' + bleStatus +
    ' ready=' + ready + ' port2=' + port2 + ' inFlight=' + fetchInFlight +
    ' pending=' + !!pendingInfo + ' uptime=' + uptimeSec() + 's ok=' + okCount +
    ' fail=' + failCount + ' deferred=' + deferredCount)
  markBackgroundDebug('service_minute_tick', { minute, bleStatus, port2, seq: tickSeq, gap: gapSec }, now)
  setStage('tick')

  // Retry persisting a payload that could not be written while the screen was on.
  if (pendingInfo) {
    flushPendingInfo('tick')
  }

  if (fetchInFlight) {
    const inFlightAge = now - lastFetchStarted
    if (inFlightAge > REQUEST_DEADLINE_MS) {
      expireActiveRequest('watchdog_stale_15s', inFlightAge)
    } else {
      wdLog('WD_REQ', 'skip tick: in flight age=' + inFlightAge + 'ms')
      return
    }
  }

  fetchInfo(false)
}

function applyTimerConfig(configuredMode = 'on_per_minute') {
  // Requirement: Strictly use Time.onPerMinute() as the sole background update engine
  if (!isMinuteSubscribed && timeSensor) {
    try {
      timeSensor.onPerMinute(onMinuteCallback)
      isMinuteSubscribed = true
      console.log('watchdrip service: subscribed to Time.onPerMinute')
      logger.log('subscribed to Time.onPerMinute')
    } catch (e) {
      logger.error('failed to subscribe onPerMinute: ' + e)
    }
  }

  console.log('watchdrip service: strictly using Time.onPerMinute engine (configuredMode=' + configuredMode + ')')
  logger.log('strictly using Time.onPerMinute engine (configuredMode=' + configuredMode + ')')
  markBackgroundDebug('timer_engine_on_per_minute', { mode: configuredMode }, Date.now())
}

function saveFetchState(stage, fields = {}) {
  const now = Date.now()
  const debug = markBackgroundDebug(stage, fields, now)
  if (conf && debug) {
    conf.backgroundDebug = debug
  }
  return now
}

function markFetchFailure(stage, error) {
  const now = saveFetchState(stage, { error: String(error || stage) })
  if (conf) {
    conf.infoLastUpdAttempt = now
    conf.infoLastUpdSucess = false
  }
}

function fileSize(path) {
  try {
    const st = statSync({ path })
    return st ? st.size : 0
  } catch (e) {
    return 0
  }
}

/**
 * Writes dataStr to info.json without ever truncating the existing file.
 * 1. write to info.tmp.json and verify its size;
 * 2. rename it over info.json (fallback: direct write, now known to be allowed).
 * Returns the verified size of info.json, or 0 when writing is currently blocked.
 */
function writeInfoVerified(dataStr) {
  const expected = dataStr.length
  let tmpSize = 0
  try {
    writeFileSync({ path: WF_INFO_TMP_FILE, data: FsTools.str2ab(dataStr) })
    tmpSize = fileSize(WF_INFO_TMP_FILE)
  } catch (eTmp) {
    wdLog('WD_SAVE', 'tmp write error=' + eTmp)
  }
  if (tmpSize < 20) {
    wdLog('WD_SAVE', 'blocked tmpSize=' + tmpSize + ' expected=' + expected)
    return 0
  }

  let renamed = false
  try {
    const res = renameSync({ oldPath: WF_INFO_TMP_FILE, newPath: WF_INFO_FILE })
    renamed = res === 0 || res === true || res === undefined
    if (!renamed) wdLog('WD_SAVE', 'rename result=' + res)
  } catch (eRename) {
    wdLog('WD_SAVE', 'rename error=' + eRename)
  }

  let finalSize = renamed ? fileSize(WF_INFO_FILE) : 0
  if (finalSize < 20) {
    // Rename unsupported/failed: writing is allowed right now (tmp verified), so write directly.
    try {
      writeFileSync({ path: WF_INFO_FILE, data: FsTools.str2ab(dataStr) })
      finalSize = fileSize(WF_INFO_FILE)
    } catch (eDirect) {
      wdLog('WD_SAVE', 'direct write error=' + eDirect)
    }
  }
  return finalSize >= 20 ? finalSize : 0
}

function ensureInitialInfoFile() {
  try {
    if (fileSize(WF_INFO_FILE) < 20) {
      console.log('watchdrip service initializing fallback info.json')
      const fallbackObj = {
        bg: {
          val: '--',
          time: 0,
          isStale: true,
          trend: 'None'
        },
        status: {
          now: Date.now()
        }
      }
      writeInfoVerified(JSON.stringify(fallbackObj))
    }
  } catch (e) {
    logger.error('ensureInitialInfoFile error: ' + e)
  }
}

function signatureOf(bg) {
  return {
    time: bg && bg.time !== undefined ? bg.time : null,
    val: bg && bg.val !== undefined ? bg.val : null,
    isError: bg && bg.isError !== undefined ? bg.isError : null,
  }
}

function saveInfoFile(jsonString, newInfo = null) {
  if (!newInfo && typeof jsonString === 'string') {
    try {
      newInfo = JSON.parse(jsonString)
    } catch (e) {
      newInfo = null
    }
  } else if (!newInfo && typeof jsonString === 'object') {
    newInfo = jsonString
  }

  const bg = newInfo && typeof newInfo === 'object' && newInfo.bg ? newInfo.bg : null

  if (bg && lastSavedSignature.time !== null && fileSize(WF_INFO_FILE) > 20) {
    const sig = signatureOf(bg)
    if (
      sig.time === lastSavedSignature.time &&
      sig.val === lastSavedSignature.val &&
      sig.isError === lastSavedSignature.isError
    ) {
      wdLog('WD_SAVE', 'SmartFlush: skip write, data unchanged')
      pendingInfo = null
      return -1
    }
  }

  const dataToWrite = typeof jsonString === 'string' ? jsonString : JSON.stringify(jsonString)
  if (!dataToWrite || dataToWrite.length < 20) {
    logger.error('[SAVE_INFO] skip write: dataToWrite too short or empty')
    return 0
  }

  const finalSize = writeInfoVerified(dataToWrite)
  if (finalSize > 0) {
    if (bg) lastSavedSignature = signatureOf(bg)
    pendingInfo = null
    wdLog('WD_SAVE', 'verified size=' + finalSize)
  } else {
    // Keep the payload in memory and retry on the next tick / event (screen likely on).
    pendingInfo = { json: dataToWrite, obj: newInfo }
    deferredCount++
    wdLog('WD_SAVE', 'deferred (write blocked) count=' + deferredCount)
  }
  return finalSize
}

function flushPendingInfo(source) {
  if (!pendingInfo) return
  const { json, obj } = pendingInfo
  const size = saveInfoFile(json, obj)
  if (size > 0) {
    wdLog('WD_SAVE', 'pending flushed source=' + source + ' size=' + size)
    markBackgroundDebug('pending_flushed', { source, bytes: size }, Date.now())
  }
}

function fetchInfo(force = false) {
  try {
    const now = Date.now()

    if (!messageBuilder) {
      const { appId } = getPackageInfo()
      messageBuilder = new MessageBuilder({ appId, ble })
      messageBuilder.connect()
    }

    // The foreground page owns the BLE receiver while it is open (it registers its own
    // ble.createConnect). Re-register ours on every cycle - before any skip check - so an
    // in-flight answer is not delivered to a released page callback.
    needsBleRebind = false
    rebindBle(force ? 'event' : 'tick')

    const minInterval = force ? 4000 : 10000
    if (lastFetchStarted && (now - lastFetchStarted) < minInterval) {
      wdLog('WD_REQ', 'skip: too soon (' + (now - lastFetchStarted) + 'ms)')
      return
    }
    if (fetchInFlight) {
      const inFlightAge = now - lastFetchStarted
      const staleThreshold = force ? 10000 : REQUEST_DEADLINE_MS
      if (inFlightAge < staleThreshold) {
        wdLog('WD_REQ', 'skip: in flight (' + inFlightAge + 'ms)')
        return
      }
      expireActiveRequest('fetch_stale_recovered', inFlightAge)
    }

    let fetchParams = WATCHDRIP_ALARM_SETTINGS_DEFAULTS.fetchParams
    if (conf && conf.alarmSettings && conf.alarmSettings.fetchParams) {
      fetchParams = conf.alarmSettings.fetchParams
    }
    fetchSeq++
    const seq = fetchSeq
    const readyAtSend = messageBuilder.ready
    const portAtSend = messageBuilder.appSidePort
    wdLog('WD_REQ', 'sent seq=' + seq + (force ? ' forced' : '') + ' ready=' + readyAtSend + ' port2=' + portAtSend +
      (readyAtSend && portAtSend ? '' : ' (waiting shake)'))
    markBackgroundDebug('fetch_start', { force: !!force, seq }, now)
    setStage('fetch_sent')
    fetchInFlight = true
    lastFetchStarted = now

    cancelActiveRequest = messageBuilder.requestCb({
      method: Commands.getInfo,
      params: fetchParams,
    }, { timeout: REQUEST_DEADLINE_MS, noTimers: true }, (error, data) => {
      if (seq !== fetchSeq) {
        // Late answer for an already expired request: ignore state, but keep data if valid.
        wdLog('WD_REQ', 'late response seq=' + seq + ' current=' + fetchSeq)
      } else {
        cancelActiveRequest = null
        fetchInFlight = false
      }
      const latency = Date.now() - now
      if (error) {
        failCount++
        setStage('fetch_error')
        wdLog('WD_REQ', 'outcome=error seq=' + seq + ' latency=' + latency + 'ms error=' + error)
        markFetchFailure('fetch_error', String(error))
        return
      }
      okCount++
      setStage('fetch_received')
      wdLog('WD_REQ', 'outcome=ok seq=' + seq + ' latency=' + latency + 'ms')
      markBackgroundDebug('fetch_received', { seq, latency }, Date.now())

      let { result: info = {}, meta = {} } = data || {}
      if (meta && meta.timerType && conf && conf.settings && conf.settings.timerType !== meta.timerType) {
        console.log('watchdrip service: timerType config updated from phone: ' + meta.timerType)
        logger.log('timerType updated from phone: ' + meta.timerType)
        conf.settings.timerType = meta.timerType
        applyTimerConfig(meta.timerType)
      }
      if (info && !info.error) {
        try {
          const infoObj = typeof info === 'string' ? JSON.parse(info) : info
          const jsonString = typeof info === 'string' ? info : JSON.stringify(info)
          const savedSize = saveInfoFile(jsonString, infoObj)
          const flush = savedSize > 0 ? 'WRITTEN' : (savedSize < 0 ? 'SKIPPED' : 'DEFERRED')
          if (savedSize > 0) {
            const debug = markBackgroundDebug('fetch_saved', { result: 'ok', infoType: typeof info, bytes: savedSize }, Date.now())
            if (conf && debug) conf.backgroundDebug = debug
          } else {
            markBackgroundDebug(savedSize < 0 ? 'fetch_smart_flush_skip' : 'fetch_save_deferred',
              { val: infoObj && infoObj.bg && infoObj.bg.val }, Date.now())
          }
          if (conf) {
            conf.infoLastUpdAttempt = Date.now()
            conf.infoLastUpd = conf.infoLastUpdAttempt
            conf.infoLastUpdSucess = true
          }
          const sugarLogLine = formatSugarLog('[WD_BG SERVICE WRITE]', info, { file: WF_INFO_FILE, flush })
          console.log(sugarLogLine)
          logger.log(sugarLogLine)
        } catch (e) {
          markFetchFailure('fetch_save_error', String(e))
        }
      } else {
        logger.log("error in result: " + JSON.stringify(info))
        markFetchFailure('fetch_result_error', JSON.stringify(info))
      }
    })
  } catch (e) {
    setStage('fetch_catch_sync')
    wdLog('WD_REQ', 'sync error=' + e)
    markBackgroundDebug('fetch_catch_sync', { error: String(e) }, Date.now())
  }
}

AppService({
  onEvent(params) {
    try {
      wdLog('WD_LIFE', 'onEvent params=' + params + ' uptime=' + uptimeSec() + 's')
      markBackgroundDebug('service_onEvent', { params: String(params || '') }, Date.now())
      if (pendingInfo) {
        flushPendingInfo('event')
      }
      const paramStr = typeof params === 'string' ? params : (params && typeof params === 'object' ? JSON.stringify(params) : '')
      const isForceFetch = paramStr.indexOf('action=force_fetch') !== -1 || (params && params.action === 'force_fetch')
      if (paramStr.indexOf('source=page_release') !== -1 && messageBuilder) {
        // The page just dropped its BLE receiver; our ready/port2 state is not trustworthy
        // (1.0.30 test: first request after release never reached the phone). Re-shake.
        if (cancelActiveRequest) {
          try { cancelActiveRequest() } catch (eCancel) {}
          cancelActiveRequest = null
        }
        fetchInFlight = false
        lastFetchStarted = 0
        try { messageBuilder.resetConnection('page_release') } catch (eReset) {}
      }
      fetchInfo(isForceFetch)
    } catch (e) {
      console.log('watchdrip service onEvent error: ' + e)
    }
  },

  onInit(params) {
    try {
      serviceStartedAt = Date.now()
      wdLog('WD_LIFE', 'onInit params=' + params)
      console.log('watchdrip Service onInit: ' + params)

      markBackgroundDebug('service_onInit', { params: String(params || ''), result: 'continuous' }, Date.now())
      conf = new WatchdripConfig()
      conf.read()
      ensureInitialInfoFile()

      const { appId } = getPackageInfo()
      messageBuilder = new MessageBuilder({ appId, ble })
      console.log('watchdrip service connect start')
      markBackgroundDebug('service_connect_start', {}, Date.now())
      messageBuilder.connect()

      lastMinuteTick = Date.now()
      const configuredTimerType = (conf.settings && conf.settings.timerType) || 'on_per_minute'
      applyTimerConfig(configuredTimerType)
      markBackgroundDebug('service_time_ready', { engine: 'on_per_minute' }, Date.now())

      // Initial fetch
      const paramStr = typeof params === 'string' ? params : ''
      const isForceFetch = paramStr.indexOf('action=force_fetch') !== -1
      fetchInfo(isForceFetch)
    } catch (e) {
      markBackgroundDebug('service_onInit_error', { error: String(e) }, Date.now())
    }
  },

  fetchInfo(force = false) {
    return fetchInfo(force)
  },

  onDestroy() {
    wdLog('WD_LIFE', 'onDestroy uptime=' + uptimeSec() + 's ticks=' + tickSeq + ' fetches=' + fetchSeq +
      ' ok=' + okCount + ' fail=' + failCount + ' deferred=' + deferredCount +
      ' lastStage=' + lastStage + ' inFlight=' + fetchInFlight + ' pending=' + !!pendingInfo)
    markBackgroundDebug('service_onDestroy', {
      uptime: uptimeSec(), ticks: tickSeq, fetches: fetchSeq, ok: okCount, fail: failCount, lastStage,
    }, Date.now())
    // No flash write here: if the screen is on, an App Service write may be blocked or
    // truncate config.json (spec guides/framework.md:202). The WD_LIFE log line is the record.
    if (cancelActiveRequest) {
      try { cancelActiveRequest(); } catch (eCancel) {}
      cancelActiveRequest = null
    }
    if (messageBuilder) {
      messageBuilder.disConnect()
    }
    fetchInFlight = false
  }
})
