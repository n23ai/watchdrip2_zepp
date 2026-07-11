import { AppService } from '@zos/app-service'
import { log } from '@zos/utils'

const logger = log.getLogger('watchdrip_service')

AppService({
  onInit(params) {
    console.log('WATCHDRIP_SERVICE_DISABLED_PENDING_CANARY')
    logger.log('SERVICE_DISABLED_PENDING_CANARY')
  },

  onDestroy() {
    console.log('WATCHDRIP_SERVICE_DISABLED_DESTROY')
    logger.log('SERVICE_DISABLED_DESTROY')
  },
})
