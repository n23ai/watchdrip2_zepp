import { Time } from '@zos/sensor'
import { Path } from '../utils/path'
import { WatchdripData } from '../utils/watchdrip/watchdrip-data'
import { WF_INFO_FILE } from '../utils/config/global-constants'
import { createWidget, getAppWidgetSize, widget, prop, align, text_style } from '@zos/ui'
import { px, log } from '@zos/utils'
import { formatLogLine, summarizeInfo } from '../shared/log-format'

const logger = log.getLogger('watchdrip_widget')
const AGE_REFRESH_MS = 60000
const MAX_GRAPH_POINTS = 48

const CARD_BG = 0x3a3a3a
const TEXT_PRIMARY = 0xffffff
const TEXT_SECONDARY = 0xbdbdbd
const COLOR_LOW = 0xff5252
const COLOR_IN_RANGE = 0x4ddd73
const COLOR_HIGH = 0xffcc4d
const COLOR_VERY_HIGH = 0xff5252
const COLOR_TARGET = 0x4c5d54
const COLOR_PREDICT = 0x8b9aa8

function widgetLog(event, fields = {}) {
  logger.log(formatLogLine('WD_WIDGET', 'CARD', event, fields))
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
      this.readAndRender()
      this.stopAgeTimer()
      this.state.ageTimer = setInterval(() => {
        this.updateSubtitle()
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
      const result = this.state.infoFile && this.state.infoFile.fetchJSONResult()
      const data = result && result.data
      if (!data || !data.bg || typeof data.bg !== 'object') {
        widgetLog('WIDGET_CACHE_READ_FAILED', {
          reason: data ? 'invalid_json' : ((result && result.reason) || 'missing'),
        })
        this.renderNoData()
        return
      }

      this.state.watchdripData.setData(data)
      this.state.watchdripData.updateTimeDiff()
      widgetLog('WIDGET_CACHE_READ_OK', {
        graph: data.graph ? 1 : 0,
        ...summarizeInfo(data),
      })
      this.renderData()
    } catch (e) {
      widgetLog('WIDGET_CACHE_READ_FAILED', { reason: 'read_error' })
      logger.error('widget read error: ' + e)
      this.renderNoData()
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
    const allSeries = dataSeries.concat(targetSeries, predictSeries)
    widgetLog('WIDGET_GRAPH_SERIES', {
      series: allSeries.length
        ? allSeries.map((series) => series.name + ':' + series.points.length).join(',')
        : 'none',
    })
    const allPoints = []
    allSeries.forEach((series) => series.points.forEach((point) => allPoints.push(point)))
    if (allPoints.length < 2) return

    const xValues = allPoints.map((point) => numberValue(point[0])).filter((value) => value !== null)
    const graphStart = numberValue(graph.start)
    const graphEnd = numberValue(graph.end)
    const xMin = graphStart !== null ? graphStart : Math.min(...xValues)
    const maxDataX = Math.max(...xValues)
    const xMax = maxDataX > xMin ? maxDataX : (graphEnd !== null && graphEnd > xMin ? graphEnd : xMin + 1)
    if (!(xMax > xMin)) return

    const isMgdl = this.state.watchdripData.getStatus().isMgdl === true
    const baseMin = isMgdl ? 40 : 2
    const baseMax = isMgdl ? 320 : 18
    const yValues = allPoints.map((point) => numberValue(point[1])).filter((value) => value !== null)
    const yMin = Math.min(baseMin, ...yValues)
    const yMax = Math.max(baseMax, ...yValues)
    if (!(yMax > yMin)) return

    const totalDataPoints = dataSeries.reduce((sum, series) => sum + series.points.length, 0)
    const drawSeries = (series, color, width) => {
      const budget = Math.max(2, Math.floor(MAX_GRAPH_POINTS * series.points.length /
        Math.max(1, totalDataPoints)))
      const points = samplePoints(series.points, budget)
      this.state.graphCanvas.setPaint({color, line_width: width})
      for (let i = 1; i < points.length; i++) {
        const previous = this.toCanvasPoint(points[i - 1], xMin, xMax, yMin, yMax)
        const current = this.toCanvasPoint(points[i], xMin, xMax, yMin, yMax)
        if (!previous || !current) continue
        this.state.graphCanvas.drawLine({
          x1: previous.x,
          y1: previous.y,
          x2: current.x,
          y2: current.y,
          color,
        })
      }
    }

    const drawSafeSeries = (series, color, width) => {
      try {
        drawSeries(series, color, width)
      } catch (e) {
        widgetLog('WIDGET_GRAPH_SERIES_ERROR', { reason: series.name })
      }
    }

    targetSeries.forEach((series) => drawSafeSeries(series, COLOR_TARGET, px(1)))
    dataSeries.forEach((series) => {
      const color = series.name === 'low' ? COLOR_LOW :
        (series.name === 'high' ? COLOR_HIGH : COLOR_IN_RANGE)
      drawSafeSeries(series, color, px(3))
    })
    predictSeries.forEach((series) => drawSafeSeries(series, COLOR_PREDICT, px(1)))
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
