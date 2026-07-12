import { Time } from '@zos/sensor'

const timeSensor = new Time()

AppService({
  onInit(params) {
    console.log('WATCHDRIP_HEARTBEAT_INIT ' + String(params || ''))
    timeSensor.onPerMinute(() => {
      console.log('WATCHDRIP_HEARTBEAT_TICK ' + timeSensor.getMinutes())
    })
    console.log('WATCHDRIP_HEARTBEAT_READY')
  },
  onDestroy() {
    console.log('WATCHDRIP_HEARTBEAT_DESTROY')
  }
})
