export function getGlobal () {
  try {
    if (typeof self !== 'undefined') {
      return self
    }
    if (typeof window !== 'undefined') {
      return window
    }
    if (typeof global !== 'undefined') {
      return global
    }
    if (typeof globalThis !== 'undefined') {
      return globalThis
    }
    if (typeof DeviceRuntimeCore !== 'undefined') {
      return DeviceRuntimeCore
    }
  } catch(e) {
    console.log("getGlobal error: " + e);
  }

  console.log("unable to locate global object");
  return {};
}
