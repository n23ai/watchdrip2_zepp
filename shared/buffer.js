import { getGlobal } from './global';

try {
  console.log("INIT BUFFER");
  let globalNS = getGlobal();
  if (!globalNS.Buffer) {
    if (typeof Buffer !== 'undefined') {
      globalNS.Buffer = Buffer;
    } else if (typeof DeviceRuntimeCore !== 'undefined' && DeviceRuntimeCore.Buffer) {
      globalNS.Buffer = DeviceRuntimeCore.Buffer;
    } else {
      class PolyfillBuffer extends Uint8Array {
          // simple stub for now
      }
      globalNS.Buffer = PolyfillBuffer;
    }
  }
} catch (e) {
  console.log("BUFFER INIT ERROR: " + e);
}
