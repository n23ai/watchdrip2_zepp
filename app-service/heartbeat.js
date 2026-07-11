import { AppService } from '@zos/app-service'
import { Time } from '@zos/sensor'

const timeSensor = new Time()

AppService({
  onInit(params) {
    console.log('WATCHDRIP_CANARY_INIT ' + String(params || ''))
    timeSensor.onPerMinute(() => {
      console.log('WATCHDRIP_CANARY_TICK ' + timeSensor.getMinutes())
    })
    console.log('WATCHDRIP_CANARY_READY')
  },
  onDestroy() {
    console.log('WATCHDRIP_CANARY_DESTROY')
  }
})
