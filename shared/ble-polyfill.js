import { getGlobal } from './global';

const ble = require('@zos/ble');

try {
  console.log("INIT BLE POLYFILL");
  let globalNS = getGlobal();

  if (typeof globalNS.hmBle === 'undefined') {
    globalNS.hmBle = {
      createConnect(cb) {
        return ble.createConnect(cb);
      },
      disConnect() {
        return ble.disConnect();
      },
      connectStatus() {
        return ble.connectStatus();
      },
      send(buf, size) {
        return ble.send(buf, size);
      }
    };
    console.log("hmBle polyfill registered successfully");
  }
} catch (e) {
  console.log("BLE POLYFILL ERROR: " + e);
}
