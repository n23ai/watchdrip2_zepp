import { Time } from '@zos/sensor'
import { Path } from '../utils/path'
import { WatchdripData } from '../utils/watchdrip/watchdrip-data'
import { WF_INFO_FILE } from '../utils/config/global-constants'
import { Colors } from '../utils/config/constants'
import { createWidget, widget, prop, align, text_style } from '@zos/ui'
import { px } from '@zos/utils'
import { getDeviceInfo } from '@zos/device'
import { start as startAppService } from '@zos/app-service'
const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()
const centerX = DEVICE_WIDTH / 2
const topOffset = DEVICE_HEIGHT > 400 ? px(68) : px(60)

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
    barPointerWidget: null,
  },

  onInit() {
    console.log('Workout widget: onInit')
    try {
      this.state.timeSensor = new Time()
      this.state.watchdripData = new WatchdripData(this.state.timeSensor)
      this.state.infoFile = new Path("full", WF_INFO_FILE)

      if (typeof startAppService === 'function') {
        startAppService({ 
          file: 'app-service/index',
          complete_func: (info) => {
            console.log("data-widget app-service start result: " + info.result);
          }
        })
      } else {
        console.log("data-widget startAppService is not available")
      }
    } catch (e) {
      console.log('Workout widget: onInit error', e)
    }
  },

  build() {
    console.log('Workout widget: build')
    try {
      // The Shortcut Card container is centered on the device screen.
      // We center our content relative to the entire screen width to ensure it perfectly aligns inside the card.
      const contentWidth = px(340) // Safe width that fits inside the rounded card
      const contentX = (DEVICE_WIDTH - contentWidth) / 2
      const barY = px(130)
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
      const BAR_H = px(8)
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
        y: barY - px(4),
        w: px(4),
        h: px(16),
        color: Colors.white,
        radius: px(2)
      })

      this.updateUI()
    } catch (e) {
      console.log('Workout widget: build error', e)
    }
  },

  onResume() {
    console.log('Workout widget: onResume')
    try {
      this.updateUI()
      this.state.updateTimer = setInterval(() => {
        this.updateUI()
      }, 15000)
    } catch (e) {
      console.log('Workout widget: onResume error', e)
    }
  },

  onPause() {
    console.log('Workout widget: onPause')
    try {
      if (this.state.updateTimer) {
        clearInterval(this.state.updateTimer)
        this.state.updateTimer = null
      }
    } catch (e) {
      console.log('Workout widget: onPause error', e)
    }
  },

  onDestroy() {
    console.log('Workout widget: onDestroy')
    try {
      if (this.state.updateTimer) {
        clearInterval(this.state.updateTimer)
        this.state.updateTimer = null
      }
    } catch (e) {
      console.log('Workout widget: onDestroy error', e)
    }
  },

  updateUI() {
    console.log('Workout widget: updateUI')
    try {
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
          const BAR_TOTAL_W = px(340) // same as contentWidth
          const contentX = (DEVICE_WIDTH - BAR_TOTAL_W) / 2
          let pointerX = contentX + Math.floor(BAR_TOTAL_W * fraction) - px(2)
          this.state.barPointerWidget.setProperty(prop.X, pointerX)
        }
      }
    } catch (e) {
      console.log('Workout widget: updateUI error', e)
    }
  }
})
