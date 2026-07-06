import pexpect
import sys
import time

child = pexpect.spawn('zeus bridge', encoding='utf-8')
child.logfile = sys.stdout

child.expect("bridge\\$")
time.sleep(1)
child.sendline("connect")

# Wait for the menu prompt
child.expect("Which online target would you like to connect", timeout=10)
# Use a dummy timeout to let the menu render fully
child.expect(pexpect.TIMEOUT, timeout=1)

# Inspect the buffer to see the selection state
buffer = child.before
print(f"\n--- DEBUG MENU BUFFER ---\n{buffer}\n-------------------------")

if "❯ app-Android" in buffer:
    print("app-Android is already selected. Sending Enter...")
    child.send("\r")
elif "❯ Simulator" in buffer:
    print("Simulator is selected. Sending Down Arrow + Enter...")
    child.send("\x1b[B\r")
else:
    # Fallback to checking lines
    lines = [line.strip() for line in buffer.split('\n') if 'app-Android' in line or 'Simulator' in line]
    print(f"Fallback lines: {lines}")
    idx = -1
    for i, line in enumerate(lines):
        if 'app-Android' in line:
            idx = i
            break
    if idx == 0:
        child.send("\r")
    elif idx == 1:
        child.send("\x1b[B\r")
    else:
        child.send("\x1b[B\r")

# Expect connection success
try:
    child.expect("successfully connected to app-Android", timeout=25)
except pexpect.TIMEOUT:
    print("\nFAILED TO CONNECT TO APP-ANDROID.")
    sys.exit(1)

time.sleep(1)
print("Sending install command for common target...")
child.sendline("install -t common")

# Wait for success message
try:
    # Success string for app-Android is "Install lite app result: success"
    child.expect("Install lite app result: success", timeout=120)
    print("\n--- INSTALLED ON WATCH SUCCESSFULLY ---")
except pexpect.TIMEOUT:
    print("\nINSTALL TIMEOUT OR FAILED.")
    sys.exit(1)

# Now enter a loop to print all runtime logs from the bridge for 45 seconds
print("\n--- STARTING RUNTIME LOG MONITORING (45 SECONDS) ---")
try:
    start_time = time.time()
    while time.time() - start_time < 45:
        try:
            # child.readline() will block until a line is available or timeout occurs (default is None, but let's check)
            # Actually, child.expect('\n', timeout=1) is safer and less blocking
            child.expect('\r?\n', timeout=2)
        except pexpect.TIMEOUT:
            pass
except Exception as e:
    print(f"\nLog monitoring ended: {e}")

print("\n--- MONITORING FINISHED ---")
