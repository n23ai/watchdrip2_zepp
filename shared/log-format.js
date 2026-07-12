const LOG_OFFSET_MINUTES = 180
const LOG_TIMEZONE = 'UTC+03:00'

function pad(value) {
  return String(value).padStart(2, '0')
}

function safeField(value, maxLength = 120) {
  return String(value)
    .replace(/[\r\n|\[\]]/g, ' ')
    .replace(/\s+/g, '_')
    .slice(0, maxLength)
}

export function formatLogTime(timestamp = Date.now()) {
  const numericTimestamp = Number(timestamp)
  const safeTimestamp = Number.isFinite(numericTimestamp) ? numericTimestamp : Date.now()
  const date = new Date(safeTimestamp + LOG_OFFSET_MINUTES * 60 * 1000)
  return date.getUTCFullYear() + '-' +
    pad(date.getUTCMonth() + 1) + '-' +
    pad(date.getUTCDate()) + ' ' +
    pad(date.getUTCHours()) + ':' +
    pad(date.getUTCMinutes()) + ':' +
    pad(date.getUTCSeconds()) + ' ' + LOG_TIMEZONE
}

export function formatLogLine(tag, component, event, fields = {}, timestamp = Date.now()) {
  const parts = [
    '[' + formatLogTime(timestamp) + ']',
    tag,
    component,
    '|',
    event,
  ]
  const order = [
    'run', 'tick', 'request', 'prior', 'priorError', 'code',
    'value', 'unit', 'stale', 'ms', 'bytes', 'age', 'ageSec',
    'attempt', 'reason', 'source', 'detail', 'error',
  ]
  const printed = {}

  order.forEach((key) => {
    if (fields[key] !== undefined && fields[key] !== null && fields[key] !== '') {
      parts.push(key + '=' + safeField(fields[key]))
      printed[key] = true
    }
  })

  Object.keys(fields).forEach((key) => {
    if (!printed[key] && fields[key] !== undefined && fields[key] !== null && fields[key] !== '') {
      parts.push(key + '=' + safeField(fields[key]))
    }
  })

  return parts.join(' ')
}

export function summarizeInfo(info) {
  let parsed = info
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch (e) {
      return {}
    }
  }

  if (!parsed || typeof parsed !== 'object') return {}
  const fields = {}
  const bg = parsed.bg
  const status = parsed.status

  if (bg && bg.val !== undefined && bg.val !== '') fields.value = bg.val
  if (status && status.isMgdl !== undefined) {
    fields.unit = status.isMgdl ? 'mg/dL' : 'mmol/L'
  }
  if (bg && bg.isStale !== undefined) fields.stale = bg.isStale ? 1 : 0
  return fields
}
