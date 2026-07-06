import { AppService } from '@zos/app-service'
import { log } from '@zos/utils'
import { MessageBuilder } from "../shared/message"
import { WATCHDRIP_APP_ID, WF_INFO_FILE, WATCHDRIP_ALARM_SETTINGS_DEFAULTS } from "../utils/config/global-constants"
import { Commands } from "../utils/config/constants"
import * as ble from '@zos/ble'
import { WatchdripConfig } from "../utils/watchdrip/config"
import { Time } from '@zos/sensor'
import { Path } from "../utils/path"

const logger = log.getLogger("watchdrip_service")

let messageBuilder = null
let intervalTimer = null
let conf = null
let timeSensor = null
let infoFile = null

AppService({
  onInit(params) {
    logger.log('Service onInit')
    
    timeSensor = new Time()
    conf = new WatchdripConfig()
    conf.read()
    
    infoFile = new Path("full", WF_INFO_FILE)

    const appId = WATCHDRIP_APP_ID
    messageBuilder = new MessageBuilder({ appId, ble })
    messageBuilder.connect()
    
    // Start interval
    let fetchInterval = WATCHDRIP_ALARM_SETTINGS_DEFAULTS.fetchInterval * 1000
    if (conf.alarmSettings && conf.alarmSettings.fetchInterval) {
        fetchInterval = conf.alarmSettings.fetchInterval * 1000
    }
    
    intervalTimer = setInterval(() => {
      this.fetchInfo()
    }, fetchInterval)
    
    // Initial fetch
    this.fetchInfo()
  },

  fetchInfo() {
    logger.log('fetchInfo triggered')
    if (messageBuilder.connectStatus() === false) {
      logger.log('No BT Connection')
      return
    }

    let fetchParams = WATCHDRIP_ALARM_SETTINGS_DEFAULTS.fetchParams
    if (conf.alarmSettings && conf.alarmSettings.fetchParams) {
        fetchParams = conf.alarmSettings.fetchParams
    }

    messageBuilder
      .request({
        method: Commands.getInfo,
        params: fetchParams,
      }, {timeout: 5000})
      .then((data) => {
        logger.log("received data")
        let {result: info = {}} = data
        if (info && !info.error) {
            infoFile.overrideWithText(info)
            conf.infoLastUpdAttempt = timeSensor.getTime()
            conf.infoLastUpd = timeSensor.getTime()
            conf.infoLastUpdSucess = true
            conf.save()
            logger.log("saved info.json successfully")
        } else {
            logger.log("error in result: " + JSON.stringify(info))
        }
      })
      .catch((error) => {
        logger.log("fetch error: " + error)
        conf.infoLastUpdAttempt = timeSensor.getTime()
        conf.infoLastUpdSucess = false
        conf.save()
      })
  },

  onDestroy() {
    logger.log('Service onDestroy')
    if (intervalTimer) {
      clearInterval(intervalTimer)
      intervalTimer = null
    }
    if (messageBuilder) {
      messageBuilder.disConnect()
    }
  }
})
