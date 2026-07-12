import { log } from '@zos/utils'
import { MessageBuilder } from "../shared/message"
import { getPackageInfo } from '@zos/app'
import { WF_INFO_FILE, WATCHDRIP_ALARM_SETTINGS_DEFAULTS } from "../utils/config/global-constants"
import { Commands } from "../utils/config/constants"
import { WatchdripConfig } from "../utils/watchdrip/config"
import { Time } from '@zos/sensor'
import { Path } from "../utils/path"
import { markBackgroundDebug } from "../utils/watchdrip/background-debug"

const logger = log.getLogger("watchdrip_service")
const ble = require('@zos/ble')

let messageBuilder = null
let conf = null
let timeSensor = null
let infoFile = null
let fetchInFlight = false
let lastFetchStarted = 0
let serviceApi = null
let fetchWatchdogTimer = null
let perMinuteInterval = null

const FETCH_TIMEOUT_MS = 15000

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

      timeSensor = new Time()
      timeSensor.onPerMinute(() => {
        logger.log('onPerMinute')
        console.log('watchdrip service onPerMinute')
        markBackgroundDebug('service_minute_tick', { minute: timeSensor.getMinutes() }, Date.now())
        if (serviceApi) serviceApi.fetchInfo()
      })
      markBackgroundDebug('service_time_ready', {}, Date.now())

      // Initial fetch
      this.fetchInfo()
    } catch (e) {
      markBackgroundDebug('service_onInit_error', { error: String(e) }, Date.now())
    }
  },

  fetchInfo() {
    try {
      const now = Date.now()
      if (lastFetchStarted && now - lastFetchStarted < 45000) {
      logger.log('fetchInfo skipped: too soon')
      return
    }
    if (fetchInFlight) {
      const inFlightAge = now - lastFetchStarted
      if (inFlightAge < 45000) {
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

        let {result: info = {}} = data
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
    if (messageBuilder) {
      messageBuilder.disConnect()
    }
    if (fetchWatchdogTimer) {
      clearTimeout(fetchWatchdogTimer)
      fetchWatchdogTimer = null
    }
    if (timeSensor && timeSensor.offPerMinute) timeSensor.offPerMinute()
    timeSensor = null
    fetchInFlight = false
  }
})
