import { MessageBuilder, MessageType, MessageFlag, MessagePayloadType } from '../shared/message.js'
import { markBackgroundDebug, getBackgroundDebugText, getInMemoryDebug } from '../utils/watchdrip/background-debug.js'

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    console.log('  PASS: ' + msg)
    passed++
  } else {
    console.error('  FAIL: ' + msg)
    failed++
  }
}

async function runTests() {
  console.log('=== Test 1: MessageBuilder initialization and ready state ===')
  const mockBle = {
    connectStatus: () => true,
    createConnect: (cb) => { mockBle.cb = cb },
    send: (buf, len) => { mockBle.sent = buf }
  }
  const mb = new MessageBuilder({ appId: 43107, ble: mockBle })
  assert(mb.isDevice === true, 'mb.isDevice is true')
  assert(mb.ready === false, 'mb.ready is false before handshake')
  assert(mb.appSidePort === 0, 'mb.appSidePort is 0 initially')

  mb.connect()
  assert(mb.ready === false, 'mb.ready remains false after connect() until shake reply')
  assert(mockBle.sent !== undefined, 'connect() triggered sendShake')

  console.log('\n=== Test 2: requestCb when not ready -> readyTimer timeout safely calls finish without ReferenceError ===')
  let timeoutFired = false
  let timeoutErr = null
  await new Promise((resolve) => {
    mb.requestCb({ method: 'TEST' }, { timeout: 100 }, (err, res) => {
      timeoutFired = true
      timeoutErr = err
      resolve()
    })
  })
  assert(timeoutFired === true, 'timeout callback fired')
  assert(timeoutErr !== null, 'error was received')
  assert(timeoutErr.message.includes('Timed out waiting for connection ready'), 'correct error message: ' + (timeoutErr && timeoutErr.message))

  console.log('\n=== Test 3: Shake response establishes port and marks ready ===')
  // Construct a mock Shake reply from phone (flag=1, version=1, type=Shake(1), port1=20, port2=1055, appId=43107)
  const shakeResp = mb.buildBin({
    flag: MessageFlag.App,
    version: 1,
    type: MessageType.Shake,
    port1: 20,
    port2: 1055,
    appId: 43107,
    extra: 0,
    payload: Buffer.from([43107 % 256])
  })
  mb.onFragmentData(shakeResp)
  assert(mb.appSidePort === 1055, 'appSidePort set to 1055: ' + mb.appSidePort)
  assert(mb.ready === true, 'mb.ready is true after shake response')

  console.log('\n=== Test 4: MessageType.Close from phone resets state and aborts in-flight request ===')
  let closeErr = null
  let reqCalled = false
  const cancelReq = mb.requestCb({ method: 'IN_FLIGHT' }, { timeout: 5000 }, (err, res) => {
    reqCalled = true
    closeErr = err
  })

  const closePacket = mb.buildBin({
    flag: MessageFlag.App,
    version: 1,
    type: MessageType.Close,
    port1: 20,
    port2: 1055,
    appId: 43107,
    extra: 0,
    payload: Buffer.from([43107 % 256])
  })
  mb.onFragmentData(closePacket)
  assert(mb.appSidePort === 0, 'appSidePort reset to 0 after Close')
  assert(mb.ready === false, 'mb.ready reset to false after Close')
  assert(reqCalled === true, 'in-flight request aborted immediately on Close')
  assert(closeErr && closeErr.message.includes('closed by phone'), 'in-flight request got error on Close: ' + (closeErr && closeErr.message))

  console.log('\n=== Test 5: Reconnection after Close waits for new Shake ===')
  let reconnectedDone = false
  let reconnectedData = null
  mb.requestCb({ method: 'AFTER_CLOSE' }, { timeout: 5000 }, (err, res) => {
    reconnectedDone = true
    reconnectedData = res
  })
  assert(mb.ready === false, 'still not ready')
  assert(reconnectedDone === false, 'request queued waiting for shake')

  // New phone process started with new port 1088
  const newShakeResp = mb.buildBin({
    flag: MessageFlag.App,
    version: 1,
    type: MessageType.Shake,
    port1: 20,
    port2: 1088,
    appId: 43107,
    extra: 0,
    payload: Buffer.from([43107 % 256])
  })
  mb.onFragmentData(newShakeResp)
  assert(mb.appSidePort === 1088, 'appSidePort updated to new port 1088')
  assert(mb.ready === true, 'mb.ready restored to true')

  console.log('\n=== Test 6: inMemoryDebug and getBackgroundDebugText ===')
  const dbg1 = markBackgroundDebug('service_minute_tick', { minute: 42 })
  assert(getInMemoryDebug() !== null, 'inMemoryDebug is populated')
  assert(getInMemoryDebug().stage === 'service_minute_tick', 'latest stage is service_minute_tick')
  const dbgText = getBackgroundDebugText(null, null)
  assert(dbgText.includes('service_minute_tick'), 'debug text contains latest in-memory stage: ' + dbgText)

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`)
  if (failed > 0) process.exit(1)
}

runTests().catch((e) => {
  console.error('Test run crashed: ', e)
  process.exit(1)
})
