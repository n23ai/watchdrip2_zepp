import { set as setAlarm, cancel as cancelAlarm, getAllAlarms } from '@zos/alarm'
import { log } from '@zos/utils'
import { WATCHDRIP_ALARM_SETTINGS_DEFAULTS } from '../config/global-constants'
import { WatchdripConfig } from './config'
import { markBackgroundDebug } from './background-debug'

const logger = log.getLogger('watchdrip_alarm')
const SERVICE_FILE = 'app-service/index'
const SERVICE_ALARM_URL = 'app-service/index.js'

export function cancelBackgroundFetchAlarm(existingConf = null) {
  const conf = existingConf || new WatchdripConfig()
  const alarmId = Number(conf.service_alarm_id)
  if (alarmId > 0) {
    try {
      cancelAlarm(alarmId)
      logger.log('cancel service alarm id: ' + alarmId)
      markBackgroundDebug('alarm_cancel', { alarmId })
    } catch (e) {
      logger.error('cancel service alarm error: ' + e)
      markBackgroundDebug('alarm_cancel_error', { alarmId, error: String(e) })
    }
  }
  conf.service_alarm_id = '-1'
  conf.save()
}

export function scheduleBackgroundFetchAlarm(source = 'unknown') {
  const conf = new WatchdripConfig()

  if (conf.settings.disableUpdates || !conf.settings.useAppFetch) {
    cancelBackgroundFetchAlarm(conf)
    logger.log('service alarm disabled by settings')
    markBackgroundDebug('alarm_disabled', { source })
    return 0
  }

  cancelBackgroundFetchAlarm(conf)

  const interval = Math.min(
    conf.alarmSettings.fetchInterval || WATCHDRIP_ALARM_SETTINGS_DEFAULTS.fetchInterval,
    WATCHDRIP_ALARM_SETTINGS_DEFAULTS.fetchInterval
  )

  markBackgroundDebug('alarm_set_start', { source, interval })

  try {
    const alarmId = setAlarm({
      url: SERVICE_ALARM_URL,
      delay: interval,
      param: 'source=' + source + '&at=' + Date.now(),
      store: true,
    })

    let alarms = []
    try {
      alarms = getAllAlarms()
    } catch (e) {
      logger.warn('getAllAlarms error: ' + e)
    }

    conf.service_alarm_id = alarmId
    conf.backgroundDebug = {
      stage: 'alarm_set_ok',
      at: Date.now(),
      source,
      interval,
      url: SERVICE_ALARM_URL,
      alarmId,
      alarms: JSON.stringify(alarms),
      count: ((conf.backgroundDebug && conf.backgroundDebug.count) || 0) + 1,
    }
    conf.save()
    logger.log('service alarm id: ' + alarmId + ', source: ' + source + ', alarms: ' + JSON.stringify(alarms))
    return alarmId
  } catch (e) {
    logger.error('service alarm set error: ' + e)
    markBackgroundDebug('alarm_set_error', { source, interval, error: String(e) })
    return 0
  }
}
