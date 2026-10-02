import { log } from '@zos/utils'
import { writeFileSync, statSync } from '@zos/fs'
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

function onMinuteCallback() {
  lastMinuteTick = Date.now()
  const minute = timeSensor ? timeSensor.getMinutes() : -1
  const bleStatus = ble && typeof ble.connectStatus === 'function' ? ble.connectStatus() : 'na'
  const currentPort2 = messageBuilder ? messageBuilder.appSidePort : 0
  const tickLog = '[WD_TICK] min=' + minute + ' ble=' + bleStatus + ' port2=' + currentPort2 + ' inFlight=' + fetchInFlight
  logger.log(tickLog)
  console.log('watchdrip service ' + tickLog)
  markBackgroundDebug('service_minute_tick', { minute, bleStatus, port2: currentPort2 }, Date.now())

  if (fetchInFlight) {
    const inFlightAge = Date.now() - lastFetchStarted
    if (inFlightAge > 15000) {
      console.log('watchdrip service: watchdog recovery stale fetch age=' + inFlightAge + 'ms')
      logger.log('Watchdog: fetch stuck for ' + inFlightAge + 'ms, resetting connection')
      markBackgroundDebug('fetch_stale_watchdog_15s', { age: inFlightAge }, Date.now())
      if (cancelActiveRequest) {
        try { cancelActiveRequest() } catch (eCancel) {}
        cancelActiveRequest = null
      }
      if (messageBuilder) {
        try { messageBuilder.resetConnection('watchdog_stale_15s') } catch (eReset) {}
      }
      fetchInFlight = false
    } else {
      logger.log('fetch in flight, skipping tick')
      return
    }
  }

  if (messageBuilder && (!messageBuilder.ready || messageBuilder.appSidePort === 0)) {
    try { messageBuilder.sendShake() } catch (eShake) {}
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

function ensureInitialInfoFile() {
  try {
    let fileSize = 0
    try {
      const st = statSync({ path: WF_INFO_FILE })
      fileSize = st ? st.size : 0
    } catch (eStat) {}
    if (fileSize < 20) {
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
      writeFileSync({
        path: WF_INFO_FILE,
        data: JSON.stringify(fallbackObj),
        options: { encoding: 'utf8' }
      })
    }
  } catch (e) {
    logger.error('ensureInitialInfoFile error: ' + e)
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

  let currentFileSize = 0
  try {
    const st = statSync({ path: WF_INFO_FILE })
    currentFileSize = st ? st.size : 0
  } catch (eSt) {}

  if (currentFileSize > 20 && bg && lastSavedSignature.time !== null) {
    const bgTime = bg.time !== undefined ? bg.time : null
    const bgVal = bg.val !== undefined ? bg.val : null
    const bgIsError = bg.isError !== undefined ? bg.isError : null

    if (
      bgTime === lastSavedSignature.time &&
      bgVal === lastSavedSignature.val &&
      bgIsError === lastSavedSignature.isError
    ) {
      logger.log('SmartFlush: skip write, data unchanged')
      console.log('watchdrip service SmartFlush: skip write, data unchanged')
      return 0
    }
  }

  const dataToWrite = typeof jsonString === 'string' ? jsonString : JSON.stringify(jsonString)
  if (!dataToWrite || dataToWrite.length < 20) {
    logger.error('[SAVE_INFO] skip write: dataToWrite too short or empty')
    return 0
  }

  let writeSuccess = false
  try {
    writeFileSync({
      path: WF_INFO_FILE,
      data: dataToWrite,
      options: { encoding: 'utf8' }
    })
    writeSuccess = true
  } catch (e1) {
    logger.error('[SAVE_INFO] utf8 write error: ' + e1)
    try {
      const buf = FsTools.str2ab(dataToWrite)
      writeFileSync({
        path: WF_INFO_FILE,
        data: buf
      })
      writeSuccess = true
    } catch (e2) {
      logger.error('[SAVE_INFO] ArrayBuffer write error: ' + e2)
    }
  }

  if (writeSuccess && bg) {
    lastSavedSignature = {
      time: bg.time !== undefined ? bg.time : null,
      val: bg.val !== undefined ? bg.val : null,
      isError: bg.isError !== undefined ? bg.isError : null,
    }
  }

  let finalSize = 0
  try {
    const stFinal = statSync({ path: WF_INFO_FILE })
    finalSize = stFinal ? stFinal.size : 0
  } catch (eFinal) {}
  logger.log('[SAVE_INFO] final info.json size=' + finalSize)
  console.log('watchdrip service [SAVE_INFO] final info.json size=' + finalSize)
  return finalSize
}

function fetchInfo(force = false) {
  try {
    const now = Date.now()
    const minInterval = force ? 4000 : 10000
    if (lastFetchStarted && (now - lastFetchStarted) < minInterval) {
      logger.log('fetchInfo skipped: too soon (' + (now - lastFetchStarted) + 'ms)')
      return
    }
    if (fetchInFlight) {
      const inFlightAge = now - lastFetchStarted
      const staleThreshold = force ? 10000 : 15000
      if (inFlightAge < staleThreshold) {
        logger.log('fetchInfo skipped: in flight (' + inFlightAge + 'ms)')
        return
      }
      console.log('watchdrip service recovering stale fetch age=' + inFlightAge)
      logger.log('recovering stale fetch age=' + inFlightAge)
      markBackgroundDebug('fetch_stale_recovered', { age: inFlightAge }, now)
      if (cancelActiveRequest) {
        try { cancelActiveRequest() } catch (eCancel) {}
        cancelActiveRequest = null
      }
      if (messageBuilder) {
        try { messageBuilder.resetConnection('fetch_stale_recovered') } catch (eReset) {}
      }
      fetchInFlight = false
    }
    logger.log('fetchInfo triggered' + (force ? ' (forced)' : ''))
    console.log('watchdrip service fetchInfo triggered' + (force ? ' (forced)' : ''))
    markBackgroundDebug('fetch_start', { force: !!force }, now)
    fetchInFlight = true
    lastFetchStarted = now

    let fetchParams = WATCHDRIP_ALARM_SETTINGS_DEFAULTS.fetchParams
    if (conf && conf.alarmSettings && conf.alarmSettings.fetchParams) {
      fetchParams = conf.alarmSettings.fetchParams
    }

    if (!messageBuilder) {
      const { appId } = getPackageInfo()
      messageBuilder = new MessageBuilder({ appId, ble })
      messageBuilder.connect()
    }

    if (ble && typeof ble.createConnect === 'function' && messageBuilder) {
      try {
        ble.createConnect((index, data, size) => {
          messageBuilder.onFragmentData(data)
        })
      } catch (e) {
        logger.error('failed to rebind ble: ' + e)
      }
    }

    cancelActiveRequest = messageBuilder.requestCb({
      method: Commands.getInfo,
      params: fetchParams,
    }, { timeout: 15000 }, (error, data) => {
      cancelActiveRequest = null
      fetchInFlight = false
      if (error) {
        console.log("watchdrip service fetch error: " + error)
        logger.log("fetch error: " + error)
        markFetchFailure('fetch_error', String(error))
        return
      }
      logger.log("received data")
      console.log("watchdrip service received data")
      markBackgroundDebug('fetch_received', {}, Date.now())

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
          if (savedSize === 0) {
            markBackgroundDebug('fetch_smart_flush_skip', { val: infoObj && infoObj.bg && infoObj.bg.val }, Date.now())
          } else {
            const debug = markBackgroundDebug('fetch_saved', { result: 'ok', infoType: typeof info, bytes: savedSize }, Date.now())
            if (conf && debug) conf.backgroundDebug = debug
          }
          if (conf) {
            conf.infoLastUpdAttempt = Date.now()
            conf.infoLastUpd = conf.infoLastUpdAttempt
            conf.infoLastUpdSucess = true
          }
          const sugarLogLine = formatSugarLog('[WD_BG SERVICE WRITE]', info, { file: WF_INFO_FILE, flush: savedSize === 0 ? 'SKIPPED' : 'WRITTEN' })
          console.log(sugarLogLine)
          logger.log(sugarLogLine)
          if (savedSize > 0) {
            console.log("watchdrip service saved info.json successfully bytes=" + savedSize)
            logger.log("saved info.json successfully bytes=" + savedSize)
          }
        } catch (e) {
          markFetchFailure('fetch_save_error', String(e))
        }
      } else {
        logger.log("error in result: " + JSON.stringify(info))
        markFetchFailure('fetch_result_error', JSON.stringify(info))
      }
    })
  } catch (e) {
    markBackgroundDebug('fetch_catch_sync', { error: String(e) }, Date.now())
  }
}

AppService({
  onEvent(params) {
    try {
      console.log('watchdrip service onEvent: ' + params)
      logger.log('service onEvent: ' + params)
      markBackgroundDebug('service_onEvent', { params: String(params || '') }, Date.now())
      const paramStr = typeof params === 'string' ? params : (params && typeof params === 'object' ? JSON.stringify(params) : '')
      const isForceFetch = paramStr.indexOf('action=force_fetch') !== -1 || (params && params.action === 'force_fetch')
      if (isForceFetch) {
        console.log('watchdrip service: screen wake force_fetch received')
        logger.log('screen wake force_fetch received')
        fetchInfo(true)
      } else {
        fetchInfo(false)
      }
    } catch (e) {
      console.log('watchdrip service onEvent error: ' + e)
    }
  },

  onInit(params) {
    try {
      console.log('watchdrip Service onInit: ' + params)
      logger.log('Service onInit: ' + params)

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
    console.log('watchdrip service onDestroy')
    logger.log('Service onDestroy')
    markBackgroundDebug('service_onDestroy', {}, Date.now())
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
