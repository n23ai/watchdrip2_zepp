import { WatchdripConfig } from './config'

function nowMs(explicitTime) {
  if (explicitTime) return explicitTime
  try {
    return Date.now()
  } catch (e) {
    return 0
  }
}

export function markBackgroundDebug(stage, fields = {}, explicitTime = 0) {
  try {
    const conf = new WatchdripConfig()
    const previous = conf.backgroundDebug || {}
    const debug = {
      stage,
      at: nowMs(explicitTime),
      count: (previous.count || 0) + 1,
      ...fields,
    }
    conf.backgroundDebug = debug
    conf.save()
    return debug
  } catch (e) {
    return null
  }
}

export function getBackgroundDebugText(conf, timeSensor = null) {
  const debug = conf && conf.backgroundDebug
  if (!debug || !debug.stage) return 'dbg: none'

  let age = '?'
  if (debug.at && timeSensor && typeof timeSensor.getTime === 'function') {
    const diff = Math.max(0, timeSensor.getTime() - debug.at)
    age = Math.floor(diff / 60000) + 'm'
  }

  let suffix = ''
  if (debug.result !== undefined) suffix = ' r=' + debug.result
  if (debug.error) suffix = ' err'
  if (debug.alarmId !== undefined) suffix = ' id=' + debug.alarmId

  return 'dbg ' + age + ': ' + debug.stage + suffix
}
