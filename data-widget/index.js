import { Time } from '@zos/sensor'
import { Path } from '../utils/path'
import { WatchdripData } from '../utils/watchdrip/watchdrip-data'
import { WF_INFO_FILE } from '../utils/config/global-constants'
import { Colors } from '../utils/config/constants'
import { scheduleBackgroundFetchAlarm } from '../utils/watchdrip/background-alarm'
import { WatchdripConfig } from '../utils/watchdrip/config'
import { getBackgroundDebugText, markBackgroundDebug } from '../utils/watchdrip/background-debug'
import { createWidget, widget, prop, align, text_style } from '@zos/ui'
import { px, log } from '@zos/utils'
import { getDeviceInfo } from '@zos/device'
import { start as startAppService } from '@zos/app-service'
import { queryPermission, requestPermission } from '@zos/app'
const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()
const centerX = DEVICE_WIDTH / 2
const topOffset = DEVICE_HEIGHT > 400 ? px(68) : px(60)
const logger = log.getLogger('watchdrip_widget')
const BG_SERVICE_PERMISSION = 'device:os.bg_service'

const getCardContentMetrics = () => {
  const contentWidth = Math.min(px(380), DEVICE_WIDTH - px(80))
  return {
    contentWidth,
    contentX: (DEVICE_WIDTH - contentWidth) / 2,
  }
}

const startWatchdripService = () => {
  if (typeof startAppService !== 'function') {
    logger.warn("data-widget startAppService is not available")
    markBackgroundDebug('widget_service_unavailable')
    return
  }

  const result = startAppService({
    file: 'app-service/index',
    complete_func: (info) => {
      const cbResult = info ? info.result : 'no-info'
      logger.log("data-widget app-service start result: " + cbResult)
      markBackgroundDebug('widget_service_start_cb', { result: String(cbResult) })
    }
  })
  markBackgroundDebug('widget_service_start_ret', { result: String(result) })
}

const startWatchdripServiceWithPermission = () => {
  try {
    const permissionState = queryPermission({ permissions: [BG_SERVICE_PERMISSION] })
    logger.log("data-widget bg_service permission state: " + JSON.stringify(permissionState))
    markBackgroundDebug('widget_permission_state', { result: JSON.stringify(permissionState) })
    if (permissionState && permissionState[0] === 2) {
      startWatchdripService()
      return
    }

    requestPermission({
      permissions: [BG_SERVICE_PERMISSION],
      callback: (result) => {
        logger.log("data-widget bg_service permission request result: " + JSON.stringify(result))
        markBackgroundDebug('widget_permission_request', { result: JSON.stringify(result) })
        if (result && result[0] === 2) {
          startWatchdripService()
        }
      }
    })
  } catch (e) {
    logger.error('data-widget permission error: ' + e)
    markBackgroundDebug('widget_permission_error', { error: String(e) })
    startWatchdripService()
  }
}

const scheduleWatchdripServiceAlarm = () => {
  try {
    const alarmId = scheduleBackgroundFetchAlarm('widget')
    logger.log('data-widget service alarm id: ' + alarmId)
    markBackgroundDebug('widget_alarm_scheduled', { alarmId })
  } catch (e) {
    logger.error('data-widget schedule alarm error: ' + e)
    markBackgroundDebug('widget_alarm_error', { error: String(e) })
  }
}

DataWidget({
  state: {
    timeSensor: null,
    watchdripData: null,
    infoFile: null,
    updateTimer: null,
    // Widgets
    titleWidget: null,
    bgValTextWidget: null,
    bgTrendImageWidget: null,
    bgSubtitleWidget: null,
    debugTextWidget: null,
    barPointerWidget: null,
  },

  onInit() {
    logger.log('widget onInit')
    try {
      this.state.timeSensor = new Time()
      this.state.watchdripData = new WatchdripData(this.state.timeSensor)
      this.state.infoFile = new Path("full", WF_INFO_FILE)
      scheduleWatchdripServiceAlarm()
      startWatchdripServiceWithPermission()
      markBackgroundDebug('widget_onInit')
    } catch (e) {
      logger.error('widget onInit error: ' + e)
      markBackgroundDebug('widget_onInit_error', { error: String(e) })
    }
  },

  build() {
    logger.log('widget build')
    try {
      // The Shortcut Card container is centered on the device screen.
      // We center our content relative to the entire screen width to ensure it perfectly aligns inside the card.
      const { contentWidth, contentX } = getCardContentMetrics()
      const barY = px(138)
      const BAR_TOTAL_W = contentWidth
      
      // Title
      this.state.titleWidget = createWidget(widget.TEXT, {
        x: contentX,
        y: px(20),
        w: contentWidth,
        h: px(30),
        color: 0xdddddd,
        text_size: px(22),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: 'WatchDrip2'
      })

      // Big value
      const valW = px(110)
      const arrowW = px(41)
      const centerOffsetX = contentX + (contentWidth - (valW + arrowW)) / 2

      this.state.bgValTextWidget = createWidget(widget.TEXT, {
        x: centerOffsetX,
        y: px(50),
        w: valW,
        h: px(55),
        color: Colors.white,
        text_size: px(50),
        align_h: align.RIGHT,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: '--'
      })

      // Trend arrow
      this.state.bgTrendImageWidget = createWidget(widget.IMG, {
        x: centerOffsetX + valW + px(10), // slight padding between text and arrow
        y: px(58),
        w: arrowW,
        h: px(39),
        src: 'watchdrip/arrows/None.png'
      })

      // Subtitle (Time + Delta)
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
        text: 'Сейчас'
      })

      // Progress bar zones
      const BAR_H = px(16)
      const W_LOW = Math.floor(BAR_TOTAL_W * (2/18))
      const W_NORM = Math.floor(BAR_TOTAL_W * (6/18))
      const W_HIGH = Math.floor(BAR_TOTAL_W * (5/18))
      const W_VERY_HIGH = BAR_TOTAL_W - W_LOW - W_NORM - W_HIGH

      // Progress bar colors
      const COLOR_RED = 0xFF4444
      const COLOR_GREEN = 0x44FF44
      const COLOR_YELLOW = 0xFFCC00

      // Low (< 4) -> Red
      createWidget(widget.FILL_RECT, {
        x: contentX,
        y: barY,
        w: W_LOW,
        h: BAR_H,
        color: COLOR_RED,
        radius: px(4)
      })

      // Normal (4 - 10) -> Green
      createWidget(widget.FILL_RECT, {
        x: contentX + W_LOW,
        y: barY,
        w: W_NORM,
        h: BAR_H,
        color: COLOR_GREEN
      })

      // High (10 - 15) -> Yellow
      createWidget(widget.FILL_RECT, {
        x: contentX + W_LOW + W_NORM,
        y: barY,
        w: W_HIGH,
        h: BAR_H,
        color: COLOR_YELLOW
      })

      // Very High (> 15) -> Red
      createWidget(widget.FILL_RECT, {
        x: contentX + W_LOW + W_NORM + W_HIGH,
        y: barY,
        w: W_VERY_HIGH,
        h: BAR_H,
        color: COLOR_RED,
        radius: px(4)
      })

      // Pointer (White vertical line)
      this.state.barPointerWidget = createWidget(widget.FILL_RECT, {
        x: contentX,
        y: barY - px(5),
        w: px(5),
        h: px(26),
        color: Colors.white,
        radius: px(3)
      })

      this.state.debugTextWidget = createWidget(widget.TEXT, {
        x: contentX,
        y: barY + px(24),
        w: contentWidth,
        h: px(20),
        color: 0x777777,
        text_size: px(16),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: 'dbg: init'
      })

      this.updateUI()
    } catch (e) {
      logger.error('widget build error: ' + e)
      markBackgroundDebug('widget_build_error', { error: String(e) })
    }
  },

  onResume() {
    logger.log('widget onResume')
    try {
      scheduleWatchdripServiceAlarm()
      startWatchdripServiceWithPermission()
      markBackgroundDebug('widget_onResume')
      this.updateUI()
      if (this.state.updateTimer) {
        clearInterval(this.state.updateTimer)
        this.state.updateTimer = null
      }
      this.state.updateTimer = setInterval(() => {
        this.updateUI()
      }, 5000)
    } catch (e) {
      logger.error('widget onResume error: ' + e)
      markBackgroundDebug('widget_onResume_error', { error: String(e) })
    }
  },

  onPause() {
    logger.log('widget onPause')
    try {
      if (this.state.updateTimer) {
        clearInterval(this.state.updateTimer)
        this.state.updateTimer = null
      }
    } catch (e) {
      logger.error('widget onPause error: ' + e)
      markBackgroundDebug('widget_onPause_error', { error: String(e) })
    }
  },

  onDestroy() {
    logger.log('widget onDestroy')
    try {
      if (this.state.updateTimer) {
        clearInterval(this.state.updateTimer)
        this.state.updateTimer = null
      }
    } catch (e) {
      logger.error('widget onDestroy error: ' + e)
      markBackgroundDebug('widget_onDestroy_error', { error: String(e) })
    }
  },

  updateUI() {
    logger.log('widget updateUI')
    try {
      const conf = new WatchdripConfig()
      if (this.state.debugTextWidget) {
        this.state.debugTextWidget.setProperty(prop.MORE, {
          text: getBackgroundDebugText(conf, this.state.timeSensor)
        })
      }

      const data = this.state.infoFile.fetchJSON()
      if (data) {
        this.state.watchdripData.setData(data)
        this.state.watchdripData.timeDiff = 0

        const bgObj = this.state.watchdripData.getBg()
        let val = parseFloat(bgObj.getBGVal())

        const COLOR_RED = 0xFF4444
        const COLOR_YELLOW = 0xFFCC00
        let bgValColor = Colors.white

        if (!isNaN(val)) {
          if (val <= 4.0) {
            bgValColor = COLOR_RED
          } else if (val <= 10.0) {
            bgValColor = Colors.white
          } else if (val <= 15.0) {
            bgValColor = COLOR_YELLOW
          } else {
            bgValColor = COLOR_RED
          }
        }

        this.state.bgValTextWidget.setProperty(prop.MORE, {
          text: bgObj.getBGVal() || '--',
          color: bgValColor
        })

        // Subtitle: Time ago + Delta
        let timeAgo = this.state.watchdripData.getTimeAgo(bgObj.time) || ''
        let delta = bgObj.delta || ''
        let unit = this.state.watchdripData.getStatus().getUnitText()
        this.state.bgSubtitleWidget.setProperty(prop.MORE, {
          text: `${timeAgo}  ${delta} ${unit}`
        })

        this.state.bgTrendImageWidget.setProperty(prop.SRC, bgObj.getArrowResource())

        // Update pointer position
        if (!isNaN(val)) {
          // Normalize val between 2.0 and 20.0
          if (val < 2.0) val = 2.0
          if (val > 20.0) val = 20.0
          
          let fraction = (val - 2.0) / 18.0
          const { contentWidth: BAR_TOTAL_W, contentX } = getCardContentMetrics()
          let pointerX = contentX + Math.floor(BAR_TOTAL_W * fraction) - px(2)
          this.state.barPointerWidget.setProperty(prop.X, pointerX)
        }
      }
    } catch (e) {
      logger.error('widget updateUI error: ' + e)
      markBackgroundDebug('widget_update_error', { error: String(e) })
    }
  }
})
