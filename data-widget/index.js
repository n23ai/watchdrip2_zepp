import { Time } from '@zos/sensor'
import { Path } from '../utils/path'
import { WatchdripData } from '../utils/watchdrip/watchdrip-data'
import { WF_INFO_FILE } from '../utils/config/global-constants'
import { Colors } from '../utils/config/constants'
import { createWidget, getAppWidgetSize, widget, prop, align, text_style } from '@zos/ui'
import { px, log } from '@zos/utils'

const logger = log.getLogger('watchdrip_widget')
const AGE_REFRESH_MS = 60000
const COLOR_RED = 0xFF4444
const COLOR_GREEN = 0x44FF44
const COLOR_YELLOW = 0xFFCC00

function getCardMetrics() {
  const size = getAppWidgetSize()
  const cardWidth = size && size.w ? size.w : px(400)
  const cardHeight = size && size.h ? size.h : px(220)
  const contentWidth = Math.max(px(180), Math.min(px(380), cardWidth - px(40)))
  return {
    cardWidth,
    cardHeight,
    contentWidth,
    contentX: (cardWidth - contentWidth) / 2,
  }
}

AppWidget({
  state: {
    timeSensor: null,
    watchdripData: null,
    infoFile: null,
    ageTimer: null,
    contentX: 0,
    barWidth: 0,
    bgValTextWidget: null,
    bgTrendImageWidget: null,
    bgSubtitleWidget: null,
    barPointerWidget: null,
  },

  onInit() {
    try {
      this.state.timeSensor = new Time()
      this.state.watchdripData = new WatchdripData(this.state.timeSensor)
      this.state.infoFile = new Path('full', WF_INFO_FILE)
    } catch (e) {
      logger.error('widget onInit error: ' + e)
    }
  },

  build() {
    try {
      const { contentWidth, contentX } = getCardMetrics()
      const barY = px(138)
      const barHeight = px(16)
      const lowWidth = Math.floor(contentWidth * (2 / 18))
      const normalWidth = Math.floor(contentWidth * (6 / 18))
      const highWidth = Math.floor(contentWidth * (5 / 18))
      const veryHighWidth = contentWidth - lowWidth - normalWidth - highWidth
      const valueWidth = px(110)
      const arrowWidth = px(41)
      const valueX = contentX + (contentWidth - valueWidth - arrowWidth) / 2

      this.state.contentX = contentX
      this.state.barWidth = contentWidth

      createWidget(widget.TEXT, {
        x: contentX,
        y: px(20),
        w: contentWidth,
        h: px(30),
        color: 0xdddddd,
        text_size: px(22),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: 'WatchDrip2',
      })

      this.state.bgValTextWidget = createWidget(widget.TEXT, {
        x: valueX,
        y: px(50),
        w: valueWidth,
        h: px(55),
        color: Colors.white,
        text_size: px(50),
        align_h: align.RIGHT,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: '--',
      })

      this.state.bgTrendImageWidget = createWidget(widget.IMG, {
        x: valueX + valueWidth + px(10),
        y: px(58),
        w: arrowWidth,
        h: px(39),
        src: 'watchdrip/arrows/None.png',
      })

      this.state.bgSubtitleWidget = createWidget(widget.TEXT, {
        x: contentX,
        y: px(100),
        w: contentWidth,
        h: px(30),
        color: 0xaaaaaa,
        text_size: px(24),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: '--',
      })

      createWidget(widget.FILL_RECT, {
        x: contentX,
        y: barY,
        w: lowWidth,
        h: barHeight,
        color: COLOR_RED,
        radius: px(4),
      })
      createWidget(widget.FILL_RECT, {
        x: contentX + lowWidth,
        y: barY,
        w: normalWidth,
        h: barHeight,
        color: COLOR_GREEN,
      })
      createWidget(widget.FILL_RECT, {
        x: contentX + lowWidth + normalWidth,
        y: barY,
        w: highWidth,
        h: barHeight,
        color: COLOR_YELLOW,
      })
      createWidget(widget.FILL_RECT, {
        x: contentX + lowWidth + normalWidth + highWidth,
        y: barY,
        w: veryHighWidth,
        h: barHeight,
        color: COLOR_RED,
        radius: px(4),
      })

      this.state.barPointerWidget = createWidget(widget.FILL_RECT, {
        x: contentX,
        y: barY - px(5),
        w: px(5),
        h: px(26),
        color: Colors.white,
        radius: px(3),
      })

      this.readAndRender()
    } catch (e) {
      logger.error('widget build error: ' + e)
    }
  },

  onResume() {
    try {
      this.readAndRender()
      this.stopAgeTimer()
      this.state.ageTimer = setInterval(() => {
        this.updateSubtitle()
      }, AGE_REFRESH_MS)
    } catch (e) {
      logger.error('widget onResume error: ' + e)
    }
  },

  onPause() {
    this.stopAgeTimer()
  },

  onDestroy() {
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
      const data = this.state.infoFile && this.state.infoFile.fetchJSON()
      if (!data || !data.bg || typeof data.bg !== 'object') {
        this.renderNoData()
        return
      }

      this.state.watchdripData.setData(data)
      this.state.watchdripData.updateTimeDiff()
      this.renderData()
    } catch (e) {
      logger.error('widget read error: ' + e)
      this.renderNoData()
    }
  },

  renderNoData() {
    if (this.state.bgValTextWidget) {
      this.state.bgValTextWidget.setProperty(prop.MORE, {
        text: '--',
        color: Colors.white,
      })
    }
    if (this.state.bgSubtitleWidget) {
      this.state.bgSubtitleWidget.setProperty(prop.MORE, { text: '--' })
    }
    if (this.state.bgTrendImageWidget) {
      this.state.bgTrendImageWidget.setProperty(prop.SRC, 'watchdrip/arrows/None.png')
    }
    if (this.state.barPointerWidget) {
      this.state.barPointerWidget.setProperty(prop.X, this.state.contentX)
    }
  },

  renderData() {
    const bg = this.state.watchdripData.getBg()
    const valueText = bg.getBGVal() || '--'
    let value = parseFloat(valueText)
    let valueColor = Colors.white

    if (!isNaN(value)) {
      if (value <= 4 || value > 15) valueColor = COLOR_RED
      else if (value > 10) valueColor = COLOR_YELLOW
    }

    this.state.bgValTextWidget.setProperty(prop.MORE, {
      text: valueText,
      color: valueColor,
    })
    this.state.bgTrendImageWidget.setProperty(prop.SRC, bg.getArrowResource())
    this.updateSubtitle()

    if (!isNaN(value)) {
      value = Math.max(2, Math.min(20, value))
      const fraction = (value - 2) / 18
      const pointerX = this.state.contentX + Math.floor(this.state.barWidth * fraction) - px(2)
      this.state.barPointerWidget.setProperty(prop.X, pointerX)
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
})
