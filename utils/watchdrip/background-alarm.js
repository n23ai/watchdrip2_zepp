import { getPackageInfo } from '@zos/app'
import { setLaunchAppTimeout, clearLaunchAppTimeout } from '@zos/router'
import { cancel as cancelAlarm, getAllAlarms } from '@zos/alarm'
import { log } from '@zos/utils'
import { WatchdripConfig } from './config'
import { markBackgroundDebug, markSchedulerDebug } from './background-debug'

const logger = log.getLogger('watchdrip_alarm')

// Kept for historical canary analysis; no production page/widget path imports this module.

export function clearLegacyProductionAlarmsOnce() {
  const conf = new WatchdripConfig()
  if (Number(conf.legacyAlarmCleanupVersion) >= 1) return

  try {
    const alarmIds = getAllAlarms() || []
    for (let i = 0; i < alarmIds.length; i++) {
      cancelAlarm(alarmIds[i])
    }
    conf.legacyAlarmCleanupVersion = 1
    conf.save()
    markBackgroundDebug('legacy_alarm_cleanup_ok', { count: alarmIds.length })
    logger.log('legacy_alarm_cleanup_ok count=' + alarmIds.length)
  } catch (e) {
    markBackgroundDebug('legacy_alarm_cleanup_error', { error: String(e) })
    logger.error('legacy_alarm_cleanup_error ' + e)
  }
}

function clearRouterTimeout(timeoutId, source) {
  if (Number(timeoutId) <= 0) return false
  try {
    clearLaunchAppTimeout({ timeoutId: Number(timeoutId) })
    logger.log('timeout_cancel_ok source=' + source + ' timeoutId=' + Number(timeoutId))
    markBackgroundDebug('timeout_cancel_ok', {
      source,
      timeoutId: Number(timeoutId),
      api: 'router'
    })
    return true
  } catch (e) {
    logger.error('clearLaunchAppTimeout failed: ' + e)
    markBackgroundDebug('timeout_cancel_error', {
      source,
      timeoutId: Number(timeoutId),
      api: 'router',
      error: String(e)
    })
    return false
  }
}

function clearLegacyAlarm(alarmId, source) {
  if (Number(alarmId) <= 0) return false
  try {
    cancelAlarm(Number(alarmId))
    logger.log('legacy_alarm_cancel_ok source=' + source + ' alarmId=' + Number(alarmId))
    markBackgroundDebug('legacy_alarm_cancel_ok', {
      source,
      alarmId: Number(alarmId),
      api: 'alarm'
    })
    return true
  } catch (e) {
    // Legacy IDs may actually belong to the router timeout API.
    markBackgroundDebug('legacy_alarm_cancel_error', {
      source,
      alarmId: Number(alarmId),
      api: 'alarm',
      error: String(e)
    })
    return false
  }
}

export function cancelHiddenPageFetch() {
  const conf = new WatchdripConfig()
  const pageTimeoutId = Number(conf.page_timeout_id)
  const legacyAlarmId = Number(conf.alarm_id)
  clearRouterTimeout(pageTimeoutId, 'cancel')
  if (legacyAlarmId !== pageTimeoutId) {
    clearRouterTimeout(legacyAlarmId, 'legacy_cleanup')
  }
  clearLegacyAlarm(legacyAlarmId, 'legacy_cleanup')
  conf.page_timeout_id = '-1'
  conf.alarm_id = '-1'
  conf.save()
}

export function scheduleHiddenPageFetch(source = 'unknown', options = {}) {
  const conf = new WatchdripConfig()

  if (conf.settings.disableUpdates || !conf.settings.useAppFetch) {
    markBackgroundDebug('page_timeout_disabled', { source })
    cancelHiddenPageFetch()
    return 0
  }

  const delaySeconds = Number(options.delay || 60)
  const delayMs = delaySeconds * 1000
  const existingPageTimeoutId = Number(conf.page_timeout_id)
  clearRouterTimeout(existingPageTimeoutId, source + '_replace')

  try {
    const { appId } = getPackageInfo()
    markSchedulerDebug({
      source,
      appId,
      url: 'page/index',
      delayMs,
      status: 'setting',
      timeoutId: null,
      error: null,
    })
    markBackgroundDebug('timeout_set_start', {
      source,
      appId,
      url: 'page/index',
      delayMs
    })
    logger.log('timeout_set_start source=' + source + ' appId=' + appId + ' url=page/index delayMs=' + delayMs)
    const timeoutId = setLaunchAppTimeout({
      appId,
      url: 'page/index',
      params: JSON.stringify({
        page: 'update_local',
        source,
        canary: options.canary === true,
      }),
      delay: delayMs
    })
    markSchedulerDebug({
      source,
      appId,
      url: 'page/index',
      delayMs,
      timeoutId,
      status: 'set_ok',
      error: null,
    })
    const debug = markBackgroundDebug('timeout_set_ok', {
      source,
      appId,
      url: 'page/index',
      delayMs,
      timeoutId
    })
    logger.log('timeout_set_ok source=' + source + ' appId=' + appId + ' url=page/index delayMs=' + delayMs + ' timeoutId=' + timeoutId)
    conf.read()
    conf.page_timeout_id = timeoutId
    if (debug) conf.backgroundDebug = debug
    conf.save()
    return timeoutId
  } catch (e) {
    logger.error('setLaunchAppTimeout failed: ' + e)
    markSchedulerDebug({
      source,
      url: 'page/index',
      delayMs,
      timeoutId: null,
      status: 'set_error',
      error: String(e),
    })
    markBackgroundDebug('timeout_set_error', {
      source,
      url: 'page/index',
      delayMs,
      error: String(e)
    })
    return 0
  }
}
