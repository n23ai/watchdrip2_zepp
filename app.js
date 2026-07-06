console.log("APP.JS START LOAD");
import "./shared/device-polyfill";
import { MessageBuilder } from "./shared/message";
import { WATCHDRIP_APP_ID } from "./utils/config/global-constants";

import { start as startAppService } from '@zos/app-service';

console.log("APP.JS IMPORTS DONE");
const appId = WATCHDRIP_APP_ID;

App({
  globalData: {},
  onCreate(options) {
    console.log("app on create invoke");
    if (typeof startAppService === 'function') {
      this.globalData.appServiceStartRes = startAppService({ 
        file: 'app-service/index',
        complete_func: (info) => {
          console.log("app-service start result: " + info.result);
        }
      });
    } else {
      console.log("startAppService is not a function: " + typeof startAppService);
      this.globalData.appServiceStartRes = 'NO: ' + typeof startAppService;
    }
  },

  onDestroy(options) {
    console.log("app on destroy invoke");
  },
});
