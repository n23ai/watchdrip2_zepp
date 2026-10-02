import "./shared/device-polyfill";
import { log } from '@zos/utils';
import { markBackgroundDebug } from './utils/watchdrip/background-debug';
import { queryPermission } from '@zos/app';
import { getAllAppServices, start as startAppService } from '@zos/app-service';

const logger = log.getLogger("watchdrip_app");

function ensureBackgroundService() {
  try {
    const services = getAllAppServices() || [];
    const isRunning = services.some(s => String(s).replace(/\.js$/, '') === 'app-service/index');
    if (!isRunning) {
      logger.log("app onCreate starting background service...");
      const res = startAppService({
        file: 'app-service/index',
        param: 'mode=continuous&source=app_onCreate&action=force_fetch',
        reload: true,
        complete_func: (info) => {
          logger.log("app onCreate startAppService complete: " + (info && info.result !== undefined ? info.result : JSON.stringify(info)));
        }
      });
      logger.log("app onCreate startAppService result: " + res);
    } else {
      logger.log("app onCreate background service is already running, triggering force_fetch");
      startAppService({
        file: 'app-service/index',
        param: 'mode=continuous&action=force_fetch',
        complete_func: () => {}
      });
    }
  } catch (e) {
    logger.error("app onCreate error: " + e);
  }
}

App({
  globalData: {},
  onCreate(options) {
    console.log("watchdrip app on create invoke");
    logger.log("app on create invoke");
    markBackgroundDebug('app_onCreate');
    ensureBackgroundService();
  },

  onDestroy(options) {
    console.log("watchdrip app on destroy invoke");
    logger.log("app on destroy invoke");
    markBackgroundDebug('app_onDestroy');
  },
});
