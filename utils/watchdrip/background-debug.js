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
    const at = nowMs(explicitTime)
    const item = {
      stage,
      at,
      ...fields,
      result: fields.result,
      error: fields.error,
      alarmId: fields.alarmId,
      timeoutId: fields.timeoutId,
    }
    const history = [...(previous.history || []), item].slice(-6)
    const debug = {
      stage,
      at,
      count: (previous.count || 0) + 1,
      history,
      ...fields,
    }
    conf.backgroundDebug = debug
    conf.save()
    return debug
  } catch (e) {
    return null
  }
}

export function markSchedulerDebug(fields = {}, explicitTime = 0) {
  try {
    const conf = new WatchdripConfig()
    const previous = conf.backgroundDebug || {}
    const scheduler = previous.scheduler || {}
    conf.backgroundDebug = {
      ...previous,
      scheduler: {
        ...scheduler,
        ...fields,
        at: nowMs(explicitTime),
      },
    }
    conf.save()
    return conf.backgroundDebug.scheduler
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
  if (debug.timeoutId !== undefined) suffix = ' id=' + debug.timeoutId

  let trail = ''
  if (debug.history && debug.history.length > 1) {
    const recent = debug.history.slice(-3, -1).map((item) => item.stage).join('>')
    if (recent) trail = ' [' + recent + ']'
  }

  let schedulerText = ''
  if (debug.scheduler && debug.scheduler.timeoutId !== undefined) {
    schedulerText = ' sched=' + (debug.scheduler.source || '?') + '/' + debug.scheduler.timeoutId
  }

  return 'dbg ' + age + ': ' + debug.stage + suffix + trail + schedulerText
}
