import "./shared/device-polyfill";
import { log } from '@zos/utils';
import { markBackgroundDebug } from './utils/watchdrip/background-debug';

const logger = log.getLogger("watchdrip_app");
App({
  globalData: {},
  onCreate(options) {
    console.log("watchdrip app on create invoke");
    logger.log("app on create invoke");
    markBackgroundDebug('app_onCreate');
    // Background refresh is owned by the visible main page timeout.
  },

  onDestroy(options) {
    console.log("watchdrip app on destroy invoke");
    logger.log("app on destroy invoke");
    markBackgroundDebug('app_onDestroy');
  },
});
