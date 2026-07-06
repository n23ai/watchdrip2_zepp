import "./shared/device-polyfill";
import { start as startAppService } from '@zos/app-service';
import { log } from '@zos/utils';
import { queryPermission, requestPermission } from '@zos/app';
import { scheduleBackgroundFetchAlarm } from './utils/watchdrip/background-alarm';
import { markBackgroundDebug } from './utils/watchdrip/background-debug';

const logger = log.getLogger("watchdrip_app");
const BG_SERVICE_PERMISSION = 'device:os.bg_service';

function startWatchdripService(target) {
  console.log("watchdrip app_service_start_call");
  markBackgroundDebug('app_service_start_call');
  target.globalData.appServiceStartRes = startAppService({
    file: 'app-service/index',
    complete_func: (info) => {
      console.log("watchdrip app-service start result: " + info.result);
      logger.log("app-service start result: " + info.result);
      markBackgroundDebug('app_service_start_cb', { result: info.result });
    }
  });
  console.log("watchdrip app_service_start_ret: " + target.globalData.appServiceStartRes);
  markBackgroundDebug('app_service_start_ret', { result: target.globalData.appServiceStartRes });
}

function startWatchdripServiceWithPermission(target) {
  const permissionState = queryPermission({ permissions: [BG_SERVICE_PERMISSION] });
  console.log("watchdrip bg_service permission state: " + JSON.stringify(permissionState));
  logger.log("bg_service permission state: " + JSON.stringify(permissionState));
  markBackgroundDebug('app_permission_state', { result: JSON.stringify(permissionState) });
  if (permissionState && permissionState[0] === 2) {
    startWatchdripService(target);
    return;
  }

  requestPermission({
    permissions: [BG_SERVICE_PERMISSION],
    callback: (result) => {
      console.log("watchdrip bg_service permission request result: " + JSON.stringify(result));
      logger.log("bg_service permission request result: " + JSON.stringify(result));
      markBackgroundDebug('app_permission_request', { result: JSON.stringify(result) });
      if (result && result[0] === 2) {
        startWatchdripService(target);
      }
    }
  });
}

App({
  globalData: {},
  onCreate(options) {
    try {
      console.log("watchdrip app on create invoke");
      logger.log("app on create invoke");
      markBackgroundDebug('app_onCreate');
      scheduleBackgroundFetchAlarm('app');
      startWatchdripServiceWithPermission(this);
    } catch (e) {
      console.log("watchdrip app-service start error: " + e);
      logger.error("app-service start error: " + e);
      markBackgroundDebug('app_error', { error: String(e) });
      this.globalData.appServiceStartRes = 'ERROR: ' + e;
    }
  },

  onDestroy(options) {
    console.log("watchdrip app on destroy invoke");
    logger.log("app on destroy invoke");
    markBackgroundDebug('app_onDestroy');
  },
});
