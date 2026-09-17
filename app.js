import "./shared/device-polyfill";
import { log } from '@zos/utils';
import { markBackgroundDebug } from './utils/watchdrip/background-debug';

import { getAllAppServices, start as startAppService } from '@zos/app-service';

const logger = log.getLogger("watchdrip_app");

function ensureBackgroundService() {
  try {
    const services = getAllAppServices() || [];
    console.log("watchdrip app ensureBackgroundService services=" + JSON.stringify(services));
    logger.log("ensureBackgroundService services=" + JSON.stringify(services));
    const isRunning = services.some(s => String(s).replace(/\.js$/, '') === 'app-service/index');
    if (!isRunning) {
      console.log("watchdrip app: Starting AppService from app.js onCreate");
      logger.log("Starting AppService from app.js onCreate");
      const ret = startAppService({
        file: 'app-service/index',
        param: 'mode=continuous&source=app_onCreate&action=force_fetch',
        reload: true,
        complete_func: (info) => {
          const res = info ? (info.result !== undefined ? info.result : JSON.stringify(info)) : 'no-info';
          console.log("watchdrip app: startAppService complete_func result=" + res);
          logger.log("startAppService complete_func result=" + res);
        }
      });
      console.log("watchdrip app: startAppService ret=" + ret);
      logger.log("startAppService ret=" + ret);
    } else {
      console.log("watchdrip app: AppService is already running, sending force_fetch");
      try {
        startAppService({
          file: 'app-service/index',
          param: 'action=force_fetch',
          complete_func: () => {}
        });
      } catch (eF) {}
    }
  } catch (e) {
    console.log("watchdrip app: Failed to start AppService from app.js: " + e);
    logger.error("Failed to start AppService from app.js: " + e);
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
