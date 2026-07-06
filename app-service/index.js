import { AppService, exit } from '@zos/app-service'
import { log } from '@zos/utils'
import { MessageBuilder } from "../shared/message"
import { WATCHDRIP_APP_ID, WF_INFO_FILE, WATCHDRIP_ALARM_SETTINGS_DEFAULTS } from "../utils/config/global-constants"
import { Commands } from "../utils/config/constants"
import { WatchdripConfig } from "../utils/watchdrip/config"
import { Time } from '@zos/sensor'
import { Path } from "../utils/path"
import { scheduleBackgroundFetchAlarm } from "../utils/watchdrip/background-alarm"
import { markBackgroundDebug } from "../utils/watchdrip/background-debug"

const logger = log.getLogger("watchdrip_service")
const ble = require('@zos/ble')

let messageBuilder = null
let conf = null
let timeSensor = null
let infoFile = null
let fetchInFlight = false
let lastFetchStarted = 0
let exitAfterFetch = false

function isAlarmLaunch(params) {
  return String(params || '').indexOf('source=') !== -1
}

function finishServiceIfNeeded() {
  if (!exitAfterFetch) return
  markBackgroundDebug('service_exit_after_fetch', {}, timeSensor ? timeSensor.getTime() : 0)
  try {
    exit()
  } catch (e) {
    markBackgroundDebug('service_exit_error', { error: String(e) }, timeSensor ? timeSensor.getTime() : 0)
  }
}

AppService({
  onInit(params) {
    console.log('watchdrip Service onInit')
    logger.log('Service onInit')
    
    timeSensor = new Time()
    exitAfterFetch = isAlarmLaunch(params)
    markBackgroundDebug('service_onInit', { params: String(params || ''), result: exitAfterFetch ? 'alarm' : 'service' }, timeSensor.getTime())
    conf = new WatchdripConfig()
    conf.read()
    scheduleBackgroundFetchAlarm('service')
    
    infoFile = new Path("full", WF_INFO_FILE)

    const appId = WATCHDRIP_APP_ID
    messageBuilder = new MessageBuilder({ appId, ble })
    console.log('watchdrip service connect start')
    markBackgroundDebug('service_connect_start', {}, timeSensor.getTime())
    messageBuilder.connect()
    
    if (!exitAfterFetch) {
      timeSensor.onPerMinute(() => {
        logger.log('onPerMinute')
        console.log('watchdrip service onPerMinute')
        this.fetchInfo()
      })
    }
    
    // Initial fetch
    this.fetchInfo()
  },

  fetchInfo() {
    const now = timeSensor.getTime()
    if (lastFetchStarted && now - lastFetchStarted < 45000) {
      logger.log('fetchInfo skipped: too soon')
      return
    }
    if (fetchInFlight) {
      logger.log('fetchInfo skipped: in flight')
      return
    }
    logger.log('fetchInfo triggered')
    console.log('watchdrip service fetchInfo triggered')
    markBackgroundDebug('fetch_start', {}, now)
    fetchInFlight = true
    lastFetchStarted = now

    let fetchParams = WATCHDRIP_ALARM_SETTINGS_DEFAULTS.fetchParams
    if (conf.alarmSettings && conf.alarmSettings.fetchParams) {
        fetchParams = conf.alarmSettings.fetchParams
    }

    messageBuilder
      .requestCb({
        method: Commands.getInfo,
        params: fetchParams,
      }, {timeout: 0}, (error, data) => {
        fetchInFlight = false
        if (error) {
          console.log("watchdrip service fetch error: " + error)
          logger.log("fetch error: " + error)
          conf.infoLastUpdAttempt = timeSensor.getTime()
          conf.infoLastUpdSucess = false
          conf.backgroundDebug = {
            stage: 'fetch_error',
            at: conf.infoLastUpdAttempt,
            error: String(error),
            count: ((conf.backgroundDebug && conf.backgroundDebug.count) || 0) + 1,
          }
          conf.save()
          finishServiceIfNeeded()
          return
        }
        logger.log("received data")
        console.log("watchdrip service received data")
        markBackgroundDebug('fetch_received', {}, timeSensor.getTime())
        let {result: info = {}} = data
        if (info && !info.error) {
            if (typeof info === 'string') {
                infoFile.overrideWithText(info)
            } else {
                infoFile.overrideWithJSON(info)
            }
            conf.infoLastUpdAttempt = timeSensor.getTime()
            conf.infoLastUpd = timeSensor.getTime()
            conf.infoLastUpdSucess = true
            conf.backgroundDebug = {
              stage: 'fetch_saved',
              at: conf.infoLastUpd,
              result: 'ok',
              infoType: typeof info,
              count: ((conf.backgroundDebug && conf.backgroundDebug.count) || 0) + 1,
            }
            conf.save()
            console.log("watchdrip service saved info.json successfully")
            logger.log("saved info.json successfully")
            finishServiceIfNeeded()
        } else {
            logger.log("error in result: " + JSON.stringify(info))
            markBackgroundDebug('fetch_result_error', { error: JSON.stringify(info) }, timeSensor.getTime())
            finishServiceIfNeeded()
        }
      })
  },

  onDestroy() {
    console.log('watchdrip Service onDestroy')
    logger.log('Service onDestroy')
    if (timeSensor) {
      markBackgroundDebug('service_onDestroy', {}, timeSensor.getTime())
    } else {
      markBackgroundDebug('service_onDestroy')
    }
    if (messageBuilder) {
      messageBuilder.disConnect()
    }
    fetchInFlight = false
  }
})
