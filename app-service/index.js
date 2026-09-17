import { log } from '@zos/utils'
import { MessageBuilder } from "../shared/message"
import { getPackageInfo } from '@zos/app'
import { WF_INFO_FILE, WATCHDRIP_ALARM_SETTINGS_DEFAULTS } from "../utils/config/global-constants"
import { Commands } from "../utils/config/constants"
import { WatchdripConfig } from "../utils/watchdrip/config"
import { Time } from '@zos/sensor'
import { Path } from "../utils/path"
import { markBackgroundDebug } from "../utils/watchdrip/background-debug"
import { formatSugarLog } from "../shared/log-format"
import { getSettings as getDisplaySettings } from '@zos/display'

console.log("watchdrip service: module loading start")
const logger = log.getLogger("watchdrip_service")
const ble = require('@zos/ble')

let timeSensor = null
try {
  timeSensor = new Time()
  console.log("watchdrip service: Time sensor instantiated")
} catch (eTime) {
  console.log("watchdrip service: error creating Time sensor: " + eTime)
}

let messageBuilder = null
let conf = null
let isMinuteSubscribed = false
let infoFile = null
let fetchInFlight = false
let lastFetchStarted = 0
let fetchWatchdogTimer = null
let heartbeatTimer = null
let lastMinuteTick = 0

const FETCH_TIMEOUT_MS = 15000

function onMinuteCallback() {
  lastMinuteTick = Date.now()
  logger.log('onPerMinute tick')
  console.log('watchdrip service onPerMinute tick')
  markBackgroundDebug('service_minute_tick', { minute: timeSensor ? timeSensor.getMinutes() : -1 }, Date.now())
  fetchInfo(false)
}

function applyTimerConfig(configuredMode = 'on_per_minute') {
  // Requirement: Strictly use Time.onPerMinute() as the sole background update engine
  if (!timeSensor) {
    try { timeSensor = new Time() } catch (e) {}
  }
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

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setTimeout(function heartbeat() {
    const now = Date.now()
    let isScreenOn = false
    try {
      const display = getDisplaySettings()
      isScreenOn = display && display.screen && display.screen.status === 1
    } catch (e) {}

    const dataAge = lastFetchStarted ? (now - lastFetchStarted) : Infinity

    // If screen is ON and data is older than 60 seconds (or not yet fetched), trigger immediate fetch
    if (isScreenOn && dataAge >= 60000 && !fetchInFlight) {
      console.log('watchdrip service: screen ON with stale data (age=' + Math.round(dataAge / 1000) + 's), triggering fetch')
      logger.log('screen ON fetch triggered (age=' + Math.round(dataAge / 1000) + 's)')
      fetchInfo(true)
    } else if (lastMinuteTick && (now - lastMinuteTick > 95000)) {
      // Watchdog for onPerMinute: if more than 95 seconds have passed without a tick
      console.log('watchdrip service: onPerMinute watchdog stale, triggering fetch')
      logger.warn('onPerMinute watchdog stale, triggering fetch')
      fetchInfo(false)
      lastMinuteTick = now
    }

    const nextInterval = isScreenOn ? 10000 : 30000
    heartbeatTimer = setTimeout(heartbeat, nextInterval)
  }, 10000)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer)
    heartbeatTimer = null
  }
}

function finishServiceIfNeeded() {
  if (fetchWatchdogTimer) {
    clearTimeout(fetchWatchdogTimer)
    fetchWatchdogTimer = null
  }
}

function saveFetchState(stage, fields = {}) {
  const now = Date.now()
  const debug = markBackgroundDebug(stage, fields, now)
  if (conf && debug) {
    conf.read()
    conf.backgroundDebug = debug
  }
  return now
}

function markFetchFailure(stage, error) {
  const now = saveFetchState(stage, { error: String(error || stage) })
  if (conf) {
    conf.infoLastUpdAttempt = now
    conf.infoLastUpdSucess = false
    conf.save()
  }
}

function fetchInfo(force = false) {
  try {
    const now = Date.now()
    const minInterval = force ? 5000 : 20000
    if (lastFetchStarted && (now - lastFetchStarted) < minInterval) {
      logger.log('fetchInfo skipped: too soon (' + (now - lastFetchStarted) + 'ms)')
      return
    }
    if (fetchInFlight) {
      const inFlightAge = now - lastFetchStarted
      const staleThreshold = force ? 10000 : 20000
      if (inFlightAge < staleThreshold) {
        logger.log('fetchInfo skipped: in flight (' + inFlightAge + 'ms)')
        return
      }
      console.log('watchdrip service recovering stale fetch age=' + inFlightAge)
      logger.log('recovering stale fetch age=' + inFlightAge)
      markBackgroundDebug('fetch_stale_recovered', { age: inFlightAge }, now)
      fetchInFlight = false
    }
    logger.log('fetchInfo triggered' + (force ? ' (forced)' : ''))
    console.log('watchdrip service fetchInfo triggered' + (force ? ' (forced)' : ''))
    markBackgroundDebug('fetch_start', { force: !!force }, now)
    fetchInFlight = true
    lastFetchStarted = now

    if (fetchWatchdogTimer) {
      clearTimeout(fetchWatchdogTimer)
      fetchWatchdogTimer = null
    }
    fetchWatchdogTimer = setTimeout(() => {
      if (!fetchInFlight) return
      fetchInFlight = false
      console.log("watchdrip service fetch watchdog timeout")
      logger.log("fetch watchdog timeout")
      markFetchFailure('fetch_watchdog_timeout', 'no response before watchdog')
      finishServiceIfNeeded()
    }, FETCH_TIMEOUT_MS + 5000)

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

    messageBuilder.requestCb({
      method: Commands.getInfo,
      params: fetchParams,
    }, { timeout: FETCH_TIMEOUT_MS }, (error, data) => {
      if (fetchWatchdogTimer) {
        clearTimeout(fetchWatchdogTimer)
        fetchWatchdogTimer = null
      }
      fetchInFlight = false
      if (error) {
        console.log("watchdrip service fetch error: " + error)
        logger.log("fetch error: " + error)
        markFetchFailure('fetch_error', String(error))
        finishServiceIfNeeded()
        return
      }
      logger.log("received data")
      console.log("watchdrip service received data")
      markBackgroundDebug('fetch_received', {}, Date.now())

      let { result: info = {}, meta = {} } = data || {}
      if (meta && meta.timerType && conf) {
        conf.read()
        if (conf.settings && conf.settings.timerType !== meta.timerType) {
          console.log('watchdrip service: timerType config updated from phone: ' + meta.timerType)
          logger.log('timerType updated from phone: ' + meta.timerType)
          conf.settings.timerType = meta.timerType
          conf.save()
          applyTimerConfig(meta.timerType)
        }
      }
      if (info && !info.error) {
        try {
          if (typeof info === 'string') {
            infoFile.overrideWithText(info)
          } else {
            infoFile.overrideWithJSON(info)
          }
          const debug = markBackgroundDebug('fetch_saved', { result: 'ok', infoType: typeof info }, Date.now())
          if (conf) {
            conf.read()
            conf.infoLastUpdAttempt = Date.now()
            conf.infoLastUpd = conf.infoLastUpdAttempt
            conf.infoLastUpdSucess = true
            if (debug) conf.backgroundDebug = debug
            conf.save()
          }
          const sugarLogLine = formatSugarLog('[WD_BG SERVICE WRITE]', info, { file: WF_INFO_FILE })
          console.log(sugarLogLine)
          logger.log(sugarLogLine)
          console.log("watchdrip service saved info.json successfully")
          logger.log("saved info.json successfully")
          finishServiceIfNeeded()
        } catch (e) {
          markFetchFailure('fetch_save_error', String(e))
          finishServiceIfNeeded()
        }
      } else {
        logger.log("error in result: " + JSON.stringify(info))
        markFetchFailure('fetch_result_error', JSON.stringify(info))
        finishServiceIfNeeded()
      }
    })
  } catch (e) {
    markBackgroundDebug('fetch_catch_sync', { error: String(e) }, Date.now())
    finishServiceIfNeeded()
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
      console.log('watchdrip Service onInit')
      logger.log('Service onInit')

      markBackgroundDebug('service_onInit', { params: String(params || ''), result: 'continuous' }, Date.now())
      conf = new WatchdripConfig()
      conf.read()

      infoFile = new Path("full", WF_INFO_FILE)

      const { appId } = getPackageInfo()
      messageBuilder = new MessageBuilder({ appId, ble })
      console.log('watchdrip service connect start')
      markBackgroundDebug('service_connect_start', {}, Date.now())
      messageBuilder.connect()

      lastMinuteTick = Date.now()
      const configuredTimerType = (conf.settings && conf.settings.timerType) || 'on_per_minute'
      applyTimerConfig(configuredTimerType)
      markBackgroundDebug('service_time_ready', { engine: 'on_per_minute' }, Date.now())

      // Start periodic heartbeat to keep process alive in OS scheduler
      startHeartbeat()

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
    stopHeartbeat()
    if (messageBuilder) {
      messageBuilder.disConnect()
    }
    if (fetchWatchdogTimer) {
      clearTimeout(fetchWatchdogTimer)
      fetchWatchdogTimer = null
    }
    fetchInFlight = false
  }
})
