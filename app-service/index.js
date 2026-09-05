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

const logger = log.getLogger("watchdrip_service")
const ble = require('@zos/ble')

let sysTimerModule = null
try {
  sysTimerModule = require('@zos/timer')
} catch (e) {
  sysTimerModule = null
}

const timeSensor = new Time()

let messageBuilder = null
let conf = null
let isMinuteSubscribed = false
let infoFile = null
let fetchInFlight = false
let lastFetchStarted = 0
let serviceApi = null
let fetchWatchdogTimer = null
let heartbeatTimer = null
let lastMinuteTick = 0
let activeTimerEngine = 'on_per_minute' // 'on_per_minute' | 'sys_timer'
let sysTimerId = null

const FETCH_TIMEOUT_MS = 15000
const HEARTBEAT_INTERVAL_MS = 25000

function onMinuteCallback() {
  if (activeTimerEngine && activeTimerEngine !== 'on_per_minute') {
    return
  }
  lastMinuteTick = Date.now()
  logger.log('onPerMinute tick')
  console.log('watchdrip service onPerMinute tick')
  markBackgroundDebug('service_minute_tick', { minute: timeSensor ? timeSensor.getMinutes() : -1 }, Date.now())
  if (serviceApi) serviceApi.fetchInfo()
}

function onSysTimerCallback() {
  if (activeTimerEngine && activeTimerEngine !== 'sys_timer') {
    return
  }
  lastMinuteTick = Date.now()
  logger.log('createSysTimer tick')
  console.log('watchdrip service createSysTimer tick')
  markBackgroundDebug('service_sys_timer_tick', {}, Date.now())
  if (serviceApi) serviceApi.fetchInfo()
}

function applyTimerConfig(configuredMode = 'auto') {
  const isSysTimerSupported = !!(
    sysTimerModule &&
    typeof sysTimerModule.createSysTimer === 'function' &&
    typeof sysTimerModule.stopTimer === 'function'
  )

  let targetEngine = 'on_per_minute'
  if (configuredMode === 'sys_timer') {
    if (isSysTimerSupported) {
      targetEngine = 'sys_timer'
    } else {
      console.log('watchdrip service: @zos/timer createSysTimer unsupported on this OS (API < 4.0), falling back to onPerMinute')
      logger.warn('createSysTimer unsupported on this OS, fallback to onPerMinute')
      targetEngine = 'on_per_minute'
    }
  } else if (configuredMode === 'auto') {
    targetEngine = isSysTimerSupported ? 'sys_timer' : 'on_per_minute'
  } else {
    targetEngine = 'on_per_minute'
  }

  if (targetEngine === activeTimerEngine) {
    if (targetEngine === 'sys_timer' && sysTimerId !== null) return
    if (targetEngine === 'on_per_minute' && isMinuteSubscribed) return
  }

  console.log('watchdrip service: switching timer engine from ' + activeTimerEngine + ' to ' + targetEngine)
  logger.log('switching timer engine to ' + targetEngine)
  activeTimerEngine = targetEngine

  if (activeTimerEngine === 'sys_timer') {
    if (sysTimerId !== null && sysTimerModule) {
      try {
        sysTimerModule.stopTimer(sysTimerId)
      } catch (e) {}
      sysTimerId = null
    }
    try {
      sysTimerId = sysTimerModule.createSysTimer(true, 60000, onSysTimerCallback)
      console.log('watchdrip service: createSysTimer started id=' + sysTimerId)
      logger.log('createSysTimer started id=' + sysTimerId)
      markBackgroundDebug('timer_engine_sys_timer', { timerId: sysTimerId }, Date.now())
    } catch (e) {
      console.log('watchdrip service: failed to createSysTimer: ' + e)
      logger.error('failed to createSysTimer: ' + e)
      activeTimerEngine = 'on_per_minute'
    }
  }

  if (activeTimerEngine === 'on_per_minute') {
    if (sysTimerId !== null && sysTimerModule) {
      try {
        sysTimerModule.stopTimer(sysTimerId)
      } catch (e) {}
      sysTimerId = null
    }
    if (!isMinuteSubscribed) {
      timeSensor.onPerMinute(onMinuteCallback)
      isMinuteSubscribed = true
    }
    markBackgroundDebug('timer_engine_on_per_minute', {}, Date.now())
  }
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

    // Если экран включен и данные старше 60 секунд (или еще не получены) — немедленно запрашиваем свежие
    if (isScreenOn && dataAge >= 60000 && !fetchInFlight) {
      console.log('watchdrip service: screen ON with stale data (age=' + Math.round(dataAge / 1000) + 's), triggering fetch')
      logger.log('screen ON fetch triggered (age=' + Math.round(dataAge / 1000) + 's)')
      if (serviceApi) {
        serviceApi.fetchInfo()
      }
    } else if (lastMinuteTick && (now - lastMinuteTick > 95000)) {
      // Watchdog for onPerMinute: if more than 95 seconds have passed without a tick
      console.log('watchdrip service: onPerMinute watchdog stale, triggering fetch')
      logger.warn('onPerMinute watchdog stale, triggering fetch')
      if (serviceApi) {
        serviceApi.fetchInfo()
      }
      lastMinuteTick = now
    }

    // Пока экран активен — опрашиваем каждые 10 секунд; в фоне/при погасшем экране — каждые 30 секунд
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

AppService({
  onEvent(params) {
    try {
      console.log('watchdrip service onEvent: ' + params)
      logger.log('service onEvent: ' + params)
      markBackgroundDebug('service_onEvent', { params: String(params || '') }, Date.now())
      if (serviceApi) {
        serviceApi.fetchInfo()
      }
    } catch (e) {
      console.log('watchdrip service onEvent error: ' + e)
    }
  },

  onInit(params) {
    try {
      console.log('watchdrip Service onInit')
      logger.log('Service onInit')

      serviceApi = this
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
      const configuredTimerType = (conf.settings && conf.settings.timerType) || 'auto'
      applyTimerConfig(configuredTimerType)
      markBackgroundDebug('service_time_ready', { engine: activeTimerEngine }, Date.now())

      // Start periodic heartbeat to keep process alive in OS scheduler
      startHeartbeat()

      // Initial fetch
      this.fetchInfo()
    } catch (e) {
      markBackgroundDebug('service_onInit_error', { error: String(e) }, Date.now())
    }
  },

  fetchInfo() {
    try {
      const now = Date.now()
      if (lastFetchStarted && now - lastFetchStarted < 20000) {
        logger.log('fetchInfo skipped: too soon')
        return
      }
      if (fetchInFlight) {
        const inFlightAge = now - lastFetchStarted
        if (inFlightAge < 20000) {
          logger.log('fetchInfo skipped: in flight')
          return
        }
        console.log('watchdrip service recovering stale fetch age=' + inFlightAge)
        logger.log('recovering stale fetch age=' + inFlightAge)
        markBackgroundDebug('fetch_stale_recovered', { age: inFlightAge }, now)
        fetchInFlight = false
      }
    logger.log('fetchInfo triggered')
    console.log('watchdrip service fetchInfo triggered')
    markBackgroundDebug('fetch_start', {}, now)
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
    if (conf.alarmSettings && conf.alarmSettings.fetchParams) {
        fetchParams = conf.alarmSettings.fetchParams
    }

    if (ble && ble.createConnect && messageBuilder) {
      try {
        ble.createConnect((index, data, size) => {
          messageBuilder.onFragmentData(data)
        })
      } catch (e) {
        logger.error('failed to rebind ble: ' + e)
      }
    }

    messageBuilder
      .requestCb({
        method: Commands.getInfo,
        params: fetchParams,
      }, {timeout: FETCH_TIMEOUT_MS}, (error, data) => {
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

        let {result: info = {}, meta = {}} = data
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
            conf.read()
            conf.infoLastUpdAttempt = Date.now()
            conf.infoLastUpd = conf.infoLastUpdAttempt
            conf.infoLastUpdSucess = true
            if (debug) conf.backgroundDebug = debug
            conf.save()
            const verifyRes = infoFile.fetchJSONResult()
            const verifiedSize = infoFile.size()
            if (!verifyRes || !verifyRes.data) {
              console.log("watchdrip service verify save FAILED reason=" + (verifyRes ? verifyRes.reason : 'null') + " size=" + verifiedSize)
              logger.warn("verify save failed: " + (verifyRes ? verifyRes.reason : 'null'))
            } else {
              console.log("watchdrip service verified info.json OK, size=" + verifiedSize)
            }
            const sugarLogLine = formatSugarLog('[WD_BG SERVICE WRITE]', info, { file: WF_INFO_FILE, size: verifiedSize })
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
  },

  onDestroy() {
    console.log('watchdrip service onDestroy')
    logger.log('Service onDestroy')
    markBackgroundDebug('service_onDestroy', {}, Date.now())
    stopHeartbeat()
    if (sysTimerId !== null && sysTimerModule) {
      try {
        sysTimerModule.stopTimer(sysTimerId)
      } catch (e) {}
      sysTimerId = null
    }
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
