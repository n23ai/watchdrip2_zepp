import { WatchdripConfig } from './config'

function nowMs(explicitTime) {
  if (explicitTime) return explicitTime
  try {
    return Date.now()
  } catch (e) {
    return 0
  }
}

let inMemoryDebug = null

export function getInMemoryDebug() {
  return inMemoryDebug
}

export function flushBackgroundDebugToDisk() {
  try {
    if (!inMemoryDebug) return
    const conf = new WatchdripConfig()
    conf.backgroundDebug = inMemoryDebug
    conf.save()
  } catch (e) {}
}

export function markBackgroundDebug(stage, fields = {}, explicitTime = 0) {
  try {
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
    if (!inMemoryDebug) {
      try {
        const conf = new WatchdripConfig()
        if (conf && conf.backgroundDebug && conf.backgroundDebug.stage) {
          inMemoryDebug = conf.backgroundDebug
        }
      } catch (eInit) {}
    }
    const previous = inMemoryDebug || {}
    const history = [...(previous.history || []), item].slice(-12)
    const debug = {
      stage,
      at,
      count: (previous.count || 0) + 1,
      history,
      ...fields,
    }
    inMemoryDebug = debug

    // Do NOT synchronously read/save config on routine minute ticks.
    // Only persist synchronously on fatal errors or failures to protect the SoC Deep Sleep window.
    const isFatal = !!(
      fields.error ||
      (fields.result && fields.result !== 'ok' && fields.result !== 'continuous') ||
      (typeof stage === 'string' && (stage.indexOf('error') !== -1 || stage.indexOf('timeout') !== -1 || stage.indexOf('fail') !== -1))
    )
    if (isFatal) {
      try {
        const conf = new WatchdripConfig()
        conf.backgroundDebug = debug
        conf.save()
      } catch (eSave) {}
    }

    return debug
  } catch (e) {
    return null
  }
}

export function markSchedulerDebug(fields = {}, explicitTime = 0) {
  try {
    const previous = inMemoryDebug || {}
    const scheduler = previous.scheduler || {}
    inMemoryDebug = {
      ...previous,
      scheduler: {
        ...scheduler,
        ...fields,
        at: nowMs(explicitTime),
      },
    }
    return inMemoryDebug.scheduler
  } catch (e) {
    return null
  }
}

export function getBackgroundDebugText(conf, timeSensor = null) {
  const debug = inMemoryDebug || (conf && conf.backgroundDebug)
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
