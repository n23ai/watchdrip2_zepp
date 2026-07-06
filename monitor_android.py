import pexpect
import sys
import time

child = pexpect.spawn('zeus bridge', encoding='utf-8')
child.logfile = sys.stdout

child.expect("bridge\\$", timeout=10)
time.sleep(1)
child.sendline("connect")

child.expect("Which online target would you like to connect", timeout=10)
child.expect(pexpect.TIMEOUT, timeout=1)

buffer = child.before
if "❯ app-Android" in buffer:
    child.send("\r")
elif "❯ Simulator" in buffer:
    child.send("\x1b[B\r")
else:
    child.send("\x1b[B\r")

child.expect("successfully connected to app-Android", timeout=25)
print("\n--- CONNECTED. MONITORING RUNTIME LOGS FOR 90 SECONDS. START OR USE THE APP ON YOUR WATCH NOW! ---")

try:
    start_time = time.time()
    while time.time() - start_time < 90:
        try:
            child.expect('\r?\n', timeout=2)
        except pexpect.TIMEOUT:
            pass
except Exception as e:
    print(f"\nMonitoring ended: {e}")

print("\n--- MONITORING FINISHED ---")
