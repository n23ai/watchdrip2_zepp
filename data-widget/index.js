import { Time } from '@zos/sensor'
import { Path } from '../utils/path'
import { WatchdripData } from '../utils/watchdrip/watchdrip-data'
import { WF_INFO_FILE } from '../utils/config/global-constants'
import { createWidget, getAppWidgetSize, widget, prop, align, text_style } from '@zos/ui'
import { px, log } from '@zos/utils'
import { formatLogLine, summarizeInfo, formatSugarLog } from '../shared/log-format'
import { getAllAppServices, start as startAppService } from '@zos/app-service'

const logger = log.getLogger('watchdrip_widget')
const AGE_REFRESH_MS = 3000
const MAX_GRAPH_POINTS = 48

const CARD_BG = 0x3a3a3a
const TEXT_PRIMARY = 0xffffff
const TEXT_SECONDARY = 0xbdbdbd
const COLOR_LOW = 0xff5252
const COLOR_IN_RANGE = 0x4ddd73
const COLOR_HIGH = 0xffcc4d
const COLOR_VERY_HIGH = 0xff5252
const COLOR_TARGET = 0x778877
const COLOR_PREDICT = 0x8b9aa8
const COLOR_TIME_GRID = 0x666666

function widgetLog(event, fields = {}) {
  logger.log(formatLogLine('WD_WIDGET', 'CARD', event, fields))
}

let lastColdStartCheck = 0
function ensureBackgroundService() {
  const now = Date.now()
  if (now - lastColdStartCheck < 3000) return
  lastColdStartCheck = now
  try {
    const services = getAllAppServices() || []
    const isRunning = services.some(s => String(s).replace(/\.js$/, '') === 'app-service/index')
    if (!isRunning) {
      widgetLog('WIDGET_STARTING_SERVICE')
      console.log('watchdrip widget: Service not running, initiating cold start with force_fetch')
      logger.log('Service not running, initiating cold start with force_fetch')
      startAppService({
        file: 'app-service/index',
        param: 'mode=continuous&action=force_fetch&source=widget_cold_start',
        complete_func: (info) => {
          const res = info ? (info.result !== undefined ? info.result : JSON.stringify(info)) : 'no-info'
          console.log('watchdrip widget: startAppService complete_func result=' + res)
          logger.log('startAppService complete_func result=' + res)
        }
      })
    } else {
      // Screen-on wake trigger: Route action=force_fetch to onEvent of the running AppService
      widgetLog('WIDGET_FORCE_FETCH')
      console.log('watchdrip widget: screen wake triggering force_fetch')
      logger.log('screen wake triggering force_fetch')
      startAppService({
        file: 'app-service/index',
        param: 'action=force_fetch',
        complete_func: (info) => {
          const res = info ? (info.result !== undefined ? info.result : JSON.stringify(info)) : 'no-info'
          console.log('watchdrip widget: force_fetch complete_func result=' + res)
          logger.log('force_fetch complete_func result=' + res)
        }
      })
    }
  } catch (e) {
    console.log('watchdrip widget: ensureBackgroundService error: ' + e)
    logger.error('widget ensureBackgroundService error: ' + e)
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getCardMetrics() {
  const size = getAppWidgetSize()
  const cardWidth = size && size.w ? size.w : px(400)
  const cardHeight = size && size.h ? size.h : px(220)
  const cardRadius = size && typeof size.radius === 'number' && size.radius > 0
    ? size.radius
    : px(30)
  const cardX = size && typeof size.margin === 'number' && size.margin > 0
    ? size.margin
    : px(40)

  const innerMarginX = px(16)
  const innerX = cardX + innerMarginX
  const innerY = clamp(px(8), 0, Math.floor(cardHeight / 2))
  const innerWidth = Math.max(px(180), cardWidth - innerMarginX * 2)
  const innerHeight = Math.max(px(120), cardHeight - innerY * 2)

  const valueWidth = px(130)
  const unitWidth = px(88)
  const trendWidth = px(41)
  const rowGap = px(8)
  const rowWidth = valueWidth + rowGap + unitWidth + rowGap + trendWidth
  const rowX = innerX + Math.max(0, Math.floor((innerWidth - rowWidth) / 2))
  const graphY = innerY + (cardHeight >= px(200) ? px(104) : px(94))
  const barY = innerY + innerHeight - px(22)
  const graphHeight = Math.max(px(28), barY - graphY - px(8))

  return {
    cardX,
    cardWidth,
    cardHeight,
    cardRadius,
    innerX,
    innerY,
    innerWidth,
    innerHeight,
    rowX,
    valueWidth,
    unitWidth,
    trendWidth,
    titleY: innerY + px(6),
    valueY: innerY + px(31),
    unitY: innerY + px(49),
    trendY: innerY + px(43),
    subtitleY: innerY + px(83),
    graphHeight,
    graphY,
    barY,
  }
}

function numberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function validPoint(point) {
  return Array.isArray(point) && numberValue(point[0]) !== null && numberValue(point[1]) !== null
}

function samplePoints(points, limit) {
  if (points.length <= limit) return points
  const result = []
  const step = (points.length - 1) / (limit - 1)
  for (let i = 0; i < limit; i++) {
    result.push(points[Math.round(i * step)])
  }
  return result
}

AppWidget({
  state: {
    timeSensor: null,
    watchdripData: null,
    infoFile: null,
    ageTimer: null,
    contentX: 0,
    contentWidth: 0,
    barWidth: 0,
    barY: 0,
    graphY: 0,
    graphHeight: 0,
    bgValTextWidget: null,
    bgUnitTextWidget: null,
    bgTrendImageWidget: null,
    bgSubtitleWidget: null,
    graphCanvas: null,
    barPointerWidget: null,
  },

  onInit() {
    widgetLog('WIDGET_INIT')
    try {
      this.state.timeSensor = new Time()
      this.state.watchdripData = new WatchdripData(this.state.timeSensor)
      this.state.infoFile = new Path('full', WF_INFO_FILE)
    } catch (e) {
      widgetLog('WIDGET_INIT_ERROR', { reason: 'setup' })
      logger.error('widget onInit error: ' + e)
    }
  },

  build() {
    widgetLog('WIDGET_BUILD_START')
    try {
      const metrics = getCardMetrics()
      const {
        cardX,
        cardWidth,
        cardHeight,
        cardRadius,
        innerX,
        innerY,
        innerWidth,
        innerHeight,
        rowX,
        valueWidth,
        unitWidth,
        trendWidth,
        titleY,
        valueY,
        unitY,
        trendY,
        subtitleY,
        graphHeight,
        graphY,
        barY,
      } = metrics

      this.state.contentX = innerX
      this.state.contentWidth = innerWidth
      this.state.barWidth = innerWidth
      this.state.barY = barY
      this.state.graphY = graphY
      this.state.graphHeight = graphHeight

      widgetLog('WIDGET_LAYOUT', {
        cardX,
        width: cardWidth,
        height: cardHeight,
        cardRadius,
        innerX,
        innerY,
        innerWidth,
        innerHeight,
        graphHeight,
      })

      createWidget(widget.FILL_RECT, {
        x: cardX,
        y: 0,
        w: cardWidth,
        h: cardHeight,
        radius: cardRadius,
        color: CARD_BG,
      })

      createWidget(widget.TEXT, {
        x: innerX,
        y: titleY,
        w: innerWidth,
        h: px(28),
        color: TEXT_SECONDARY,
        text_size: px(22),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: 'Сахар в крови',
      })

      this.state.bgValTextWidget = createWidget(widget.TEXT, {
        x: rowX,
        y: valueY,
        w: valueWidth,
        h: px(60),
        color: TEXT_PRIMARY,
        text_size: px(56),
        align_h: align.RIGHT,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: '--',
      })

      this.state.bgUnitTextWidget = createWidget(widget.TEXT, {
        x: rowX + valueWidth + px(8),
        y: unitY,
        w: unitWidth,
        h: px(30),
        color: TEXT_SECONDARY,
        text_size: px(22),
        align_h: align.LEFT,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: '',
      })

      this.state.bgTrendImageWidget = createWidget(widget.IMG, {
        x: rowX + valueWidth + px(8) + unitWidth + px(8),
        y: trendY,
        w: trendWidth,
        h: px(39),
        src: 'watchdrip/arrows/None.png',
      })

      this.state.bgSubtitleWidget = createWidget(widget.TEXT, {
        x: innerX,
        y: subtitleY,
        w: innerWidth,
        h: px(25),
        color: TEXT_SECONDARY,
        text_size: px(21),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: '--',
      })

      try {
        this.state.graphCanvas = createWidget(widget.CANVAS, {
          x: innerX,
          y: graphY,
          w: innerWidth,
          h: graphHeight,
        })
        widgetLog('WIDGET_CANVAS_READY')
      } catch (canvasError) {
        this.state.graphCanvas = null
        widgetLog('WIDGET_CANVAS_ERROR', { reason: 'create' })
      }

      try {
        this.createRangeBar(innerX, barY, innerWidth)
      } catch (rangeError) {
        widgetLog('WIDGET_RANGE_ERROR', { reason: 'create' })
      }
      this.readAndRender()
    } catch (e) {
      widgetLog('WIDGET_BUILD_ERROR', { reason: 'build' })
      logger.error('widget build error: ' + e)
    }
  },

  createRangeBar(contentX, barY, contentWidth) {
    const lowWidth = Math.floor(contentWidth * (2 / 18))
    const normalWidth = Math.floor(contentWidth * (6 / 18))
    const highWidth = Math.floor(contentWidth * (5 / 18))
    const veryHighWidth = contentWidth - lowWidth - normalWidth - highWidth
    const height = px(12)

    createWidget(widget.FILL_RECT, {
      x: contentX,
      y: barY,
      w: lowWidth,
      h: height,
      radius: px(6),
      color: COLOR_LOW,
    })
    createWidget(widget.FILL_RECT, {
      x: contentX + lowWidth,
      y: barY,
      w: normalWidth,
      h: height,
      color: COLOR_IN_RANGE,
    })
    createWidget(widget.FILL_RECT, {
      x: contentX + lowWidth + normalWidth,
      y: barY,
      w: highWidth,
      h: height,
      color: COLOR_HIGH,
    })
    createWidget(widget.FILL_RECT, {
      x: contentX + lowWidth + normalWidth + highWidth,
      y: barY,
      w: veryHighWidth,
      h: height,
      radius: px(6),
      color: COLOR_VERY_HIGH,
    })

    this.state.barPointerWidget = createWidget(widget.FILL_RECT, {
      x: contentX,
      y: barY - px(5),
      w: px(5),
      h: px(22),
      radius: px(3),
      color: TEXT_PRIMARY,
    })
  },

  onResume() {
    widgetLog('WIDGET_RESUME')
    try {
      ensureBackgroundService()
      this.readAndRender()
      this.stopAgeTimer()
      this.state.ageTimer = setInterval(() => {
        this.readAndRender()
      }, AGE_REFRESH_MS)
    } catch (e) {
      widgetLog('WIDGET_RESUME_ERROR', { reason: 'resume' })
      logger.error('widget onResume error: ' + e)
    }
  },

  onPause() {
    widgetLog('WIDGET_PAUSE')
    this.stopAgeTimer()
  },

  onDestroy() {
    widgetLog('WIDGET_DESTROY')
    this.stopAgeTimer()
  },

  stopAgeTimer() {
    if (this.state.ageTimer) {
      clearInterval(this.state.ageTimer)
      this.state.ageTimer = null
    }
  },

  readAndRender() {
    try {
      if (!this.state.infoFile) {
        this.state.infoFile = new Path('full', WF_INFO_FILE)
      }
      if (!this.state.watchdripData) {
        if (!this.state.timeSensor) {
          this.state.timeSensor = new Time()
        }
        this.state.watchdripData = new WatchdripData(this.state.timeSensor)
      }
      const result = this.state.infoFile.fetchJSONResult()
      const data = result && result.data
      if (!data || !data.bg || typeof data.bg !== 'object') {
        const failReason = data ? 'invalid_json' : ((result && result.reason) || 'missing')
        widgetLog('WIDGET_CACHE_READ_FAILED', { reason: failReason })
        const logLine = formatSugarLog('[WD_WIDGET CARD READ]', null, { status: 'FAILED', reason: failReason })
        console.log(logLine)
        logger.log(logLine)
        const currentBg = this.state.watchdripData && this.state.watchdripData.getBg()
        if (!currentBg || !currentBg.isHasData()) {
          this.renderNoData()
        } else {
          this.updateSubtitle()
        }
        return
      }

      this.state.watchdripData.setData(data)
      this.state.watchdripData.updateTimeDiff()
      widgetLog('WIDGET_CACHE_READ_OK', {
        graph: data.graph ? 1 : 0,
        ...summarizeInfo(data),
      })
      const sugarLogLine = formatSugarLog('[WD_WIDGET CARD READ]', data, { status: 'OK' })
      console.log(sugarLogLine)
      logger.log(sugarLogLine)
      this.renderData()
    } catch (e) {
      widgetLog('WIDGET_CACHE_READ_FAILED', { reason: 'read_error' })
      const errorLogLine = formatSugarLog('[WD_WIDGET CARD READ]', null, { status: 'ERROR', error: String(e) })
      console.log(errorLogLine)
      logger.error('widget read error: ' + e)
      const currentBg = this.state.watchdripData && this.state.watchdripData.getBg()
      if (!currentBg || !currentBg.isHasData()) {
        this.renderNoData()
      } else {
        this.updateSubtitle()
      }
    }
  },

  renderNoData() {
    if (this.state.bgValTextWidget) {
      this.state.bgValTextWidget.setProperty(prop.MORE, {
        text: '--',
        color: TEXT_PRIMARY,
      })
    }
    if (this.state.bgUnitTextWidget) {
      this.state.bgUnitTextWidget.setProperty(prop.MORE, { text: '' })
    }
    if (this.state.bgSubtitleWidget) {
      this.state.bgSubtitleWidget.setProperty(prop.MORE, {
        text: '--',
        color: TEXT_SECONDARY,
      })
    }
    if (this.state.bgTrendImageWidget) {
      this.state.bgTrendImageWidget.setProperty(prop.SRC, 'watchdrip/arrows/None.png')
    }
    if (this.state.barPointerWidget) {
      this.state.barPointerWidget.setProperty(prop.X, this.state.contentX)
    }
    this.clearGraph()
  },

  renderData() {
    const bg = this.state.watchdripData.getBg()
    const status = this.state.watchdripData.getStatus()
    const valueText = bg.getBGVal() || '--'
    const value = numberValue(valueText)
    const isMgdl = status.isMgdl === true
    const isStale = this.state.watchdripData.isBgStale()
    let valueColor = TEXT_PRIMARY

    if (value !== null) {
      if (isMgdl ? value < 70 || value > 250 : value <= 4 || value > 15) {
        valueColor = COLOR_LOW
      } else if (isMgdl ? value > 180 : value > 10) {
        valueColor = COLOR_HIGH
      }
    }

    this.state.bgValTextWidget.setProperty(prop.MORE, {
      text: valueText,
      color: valueColor,
    })
    this.state.bgUnitTextWidget.setProperty(prop.MORE, {
      text: status.getUnitText(),
      color: TEXT_SECONDARY,
    })
    this.state.bgTrendImageWidget.setProperty(prop.SRC, bg.getArrowResource())
    this.state.bgSubtitleWidget.setProperty(prop.MORE, {
      color: isStale ? COLOR_LOW : TEXT_SECONDARY,
    })

    this.updateSubtitle()
    try {
      this.renderGraph()
    } catch (e) {
      widgetLog('WIDGET_GRAPH_ERROR', { reason: 'draw' })
      this.clearGraph()
    }

    if (value !== null) {
      const min = isMgdl ? 40 : 2
      const max = isMgdl ? 320 : 20
      const fraction = Math.max(0, Math.min(1, (value - min) / (max - min)))
      const pointerWidth = px(5)
      const pointerX = clamp(
        this.state.contentX + Math.floor(this.state.barWidth * fraction) - Math.floor(pointerWidth / 2),
        this.state.contentX,
        this.state.contentX + this.state.barWidth - pointerWidth,
      )
      if (this.state.barPointerWidget) {
        this.state.barPointerWidget.setProperty(prop.X, pointerX)
      }
    } else {
      if (this.state.barPointerWidget) {
        this.state.barPointerWidget.setProperty(prop.X, this.state.contentX)
      }
    }
  },

  updateSubtitle() {
    if (!this.state.watchdripData || !this.state.bgSubtitleWidget) return
    const bg = this.state.watchdripData.getBg()
    if (!bg || !bg.getBGVal()) {
      this.state.bgSubtitleWidget.setProperty(prop.MORE, { text: '--' })
      return
    }

    const timeAgo = this.state.watchdripData.getTimeAgo(bg.time) || ''
    const delta = bg.delta || ''
    const unit = this.state.watchdripData.getStatus().getUnitText()
    this.state.bgSubtitleWidget.setProperty(prop.MORE, {
      text: `${timeAgo}  ${delta} ${unit}`,
    })
  },

  clearGraph() {
    if (!this.state.graphCanvas) return
    this.state.graphCanvas.clear({
      x: 0,
      y: 0,
      w: this.state.contentWidth,
      h: this.state.graphHeight,
    })
  },

  renderGraph() {
    this.clearGraph()
    if (!this.state.graphCanvas) return
    const graph = this.state.watchdripData.getGraph()
    if (!graph || !Array.isArray(graph.lines)) return

    const lineMap = {}
    graph.lines.forEach((line) => {
      if (!line || !Array.isArray(line.points)) return
      const points = line.points.filter(validPoint)
      if (points.length >= 2) lineMap[line.name] = points
    })

    const dataSeries = ['low', 'inRange', 'high']
      .filter((name) => lineMap[name])
      .map((name) => ({name, points: lineMap[name]}))
    const targetSeries = ['lineLow', 'lineHigh']
      .filter((name) => lineMap[name])
      .map((name) => ({name, points: lineMap[name]}))
    const predictSeries = lineMap.predict ? [{name: 'predict', points: lineMap.predict}] : []
    const dataAndPredictSeries = dataSeries.concat(predictSeries)
    const dataPoints = []
    dataAndPredictSeries.forEach((series) => series.points.forEach((point) => dataPoints.push(point)))

    const isMgdl = this.state.watchdripData ? (this.state.watchdripData.getStatus().isMgdl === true) : false
    const baseMin = isMgdl ? 40 : 2
    const baseMax = isMgdl ? 320 : 18

    const xValues = dataPoints.map((point) => numberValue(point[0])).filter((value) => value !== null)
    const nowMs = Date.now()
    const graphStart = graph ? numberValue(graph.start) : null
    const graphEnd = graph ? numberValue(graph.end) : null
    const xMin = graphStart !== null ? graphStart : (xValues.length ? Math.min(...xValues) : nowMs - 3 * 3600 * 1000)
    const maxDataX = xValues.length ? Math.max(...xValues) : nowMs
    const xMax = maxDataX > xMin ? maxDataX : (graphEnd !== null && graphEnd > xMin ? graphEnd : xMin + 3600 * 1000)

    const yValues = dataPoints.map((point) => numberValue(point[1])).filter((value) => value !== null)
    const yMin = Math.min(baseMin, ...yValues)
    const yMax = Math.max(baseMax, ...yValues)
    if (!(yMax > yMin) || !(xMax > xMin)) return

    const drawThresholdLine = (valY, color) => {
      const pt = this.toCanvasPoint([xMin, valY], xMin, xMax, yMin, yMax)
      if (!pt) return
      try {
        const yPos = Math.round(pt.y)
        this.state.graphCanvas.setPaint({ color, line_width: px(1) })
        this.state.graphCanvas.drawLine({
          x1: 0,
          y1: yPos,
          x2: this.state.contentWidth,
          y2: yPos,
          color,
        })
      } catch (e) {
        widgetLog('WIDGET_THRESHOLD_ERROR')
      }
    }

    let targetLowVal = isMgdl ? 70 : 3.9
    let targetHighVal = isMgdl ? 180 : 10.0

    if (lineMap.lineLow && lineMap.lineLow[0]) {
      const rawLow = numberValue(lineMap.lineLow[0][1])
      if (rawLow !== null) {
        targetLowVal = (!isMgdl && rawLow > 30) ? (rawLow / 18.018) : rawLow
      }
    }
    if (lineMap.lineHigh && lineMap.lineHigh[0]) {
      const rawHigh = numberValue(lineMap.lineHigh[0][1])
      if (rawHigh !== null) {
        targetHighVal = (!isMgdl && rawHigh > 30) ? (rawHigh / 18.018) : rawHigh
      }
    }

    const drawTimeGrid = () => {
      const isRawMs = xMax > 100000000000
      const fuzzer = isRawMs ? 1 : ((graph && numberValue(graph.fuzzer)) || 37500)
      const realMinMs = xMin * fuzzer
      const realMaxMs = xMax * fuzzer
      const realDurationMs = realMaxMs - realMinMs
      if (realDurationMs <= 0) return

      const ONE_HOUR = 3600 * 1000
      let stepMs = ONE_HOUR
      if (realDurationMs > 8 * ONE_HOUR) {
        stepMs = 3 * ONE_HOUR
      } else if (realDurationMs > 4 * ONE_HOUR) {
        stepMs = 2 * ONE_HOUR
      }

      const firstTickMs = Math.ceil(realMinMs / stepMs) * stepMs
      let tickCount = 0
      for (let tMs = firstTickMs; tMs < realMaxMs; tMs += stepMs) {
        const posX = Math.round((tMs - realMinMs) / realDurationMs * this.state.contentWidth)
        if (posX >= px(4) && posX <= this.state.contentWidth - px(4)) {
          try {
            this.state.graphCanvas.setPaint({ color: COLOR_TIME_GRID, line_width: px(1) })
            this.state.graphCanvas.drawLine({
              x1: posX,
              y1: 0,
              x2: posX,
              y2: this.state.graphHeight,
              color: COLOR_TIME_GRID,
            })
            tickCount++
          } catch (e) {
            widgetLog('WIDGET_TIME_GRID_ERROR')
          }
        }
      }
      if (tickCount > 0) {
        widgetLog('WIDGET_TIME_GRID_DRAWN', { ticks: tickCount })
      }
    }

    drawTimeGrid()
    drawThresholdLine(targetLowVal, COLOR_TARGET)
    drawThresholdLine(targetHighVal, COLOR_TARGET)

    // Build unified timeline: merge all data points with their category
    const allDataPoints = []
    dataSeries.forEach((series) => {
      series.points.forEach((pt) => {
        allDataPoints.push({ t: numberValue(pt[0]), v: numberValue(pt[1]), cat: series.name })
      })
    })
    allDataPoints.sort((a, b) => a.t - b.t)

    if (allDataPoints.length >= 2) {
      const sampled = samplePoints(
        allDataPoints.map((p) => [p.t, p.v]),
        MAX_GRAPH_POINTS
      )
      // Restore category for each sampled point by matching timestamp
      const sampledWithCat = sampled.map((pt) => {
        let best = allDataPoints[0]
        let bestDist = Math.abs(pt[0] - best.t)
        for (let j = 1; j < allDataPoints.length; j++) {
          const dist = Math.abs(pt[0] - allDataPoints[j].t)
          if (dist < bestDist) { best = allDataPoints[j]; bestDist = dist }
        }
        return { t: pt[0], v: pt[1], cat: best.cat }
      })

      for (let i = 1; i < sampledWithCat.length; i++) {
        const prev = this.toCanvasPoint([sampledWithCat[i - 1].t, sampledWithCat[i - 1].v], xMin, xMax, yMin, yMax)
        const curr = this.toCanvasPoint([sampledWithCat[i].t, sampledWithCat[i].v], xMin, xMax, yMin, yMax)
        if (!prev || !curr) continue
        const cat = sampledWithCat[i].cat
        const color = cat === 'low' ? COLOR_LOW : (cat === 'high' ? COLOR_HIGH : COLOR_IN_RANGE)
        this.state.graphCanvas.setPaint({ color, line_width: px(3) })
        this.state.graphCanvas.drawLine({ x1: prev.x, y1: prev.y, x2: curr.x, y2: curr.y, color })
      }
    }

    // Draw predict series separately (dashed style, thinner)
    if (predictSeries.length > 0) {
      const drawSeries = (series, color, width) => {
        const points = samplePoints(series.points, Math.max(2, Math.floor(MAX_GRAPH_POINTS / 4)))
        this.state.graphCanvas.setPaint({ color, line_width: width })
        for (let i = 1; i < points.length; i++) {
          const previous = this.toCanvasPoint(points[i - 1], xMin, xMax, yMin, yMax)
          const current = this.toCanvasPoint(points[i], xMin, xMax, yMin, yMax)
          if (!previous || !current) continue
          this.state.graphCanvas.drawLine({ x1: previous.x, y1: previous.y, x2: current.x, y2: current.y, color })
        }
      }
      predictSeries.forEach((series) => drawSeries(series, COLOR_PREDICT, px(1)))
    }
  },

  toCanvasPoint(point, xMin, xMax, yMin, yMax) {
    const x = numberValue(point[0])
    const y = numberValue(point[1])
    if (x === null || y === null) return null
    return {
      x: Math.max(0, Math.min(this.state.contentWidth, (x - xMin) /
        (xMax - xMin) * this.state.contentWidth)),
      y: this.state.graphHeight - Math.max(0, Math.min(this.state.graphHeight,
        (y - yMin) / (yMax - yMin) * this.state.graphHeight)),
    }
  },
})
