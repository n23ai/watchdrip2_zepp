import pexpect
import sys
import time

child = pexpect.spawn('zeus bridge', encoding='utf-8')
child.logfile = sys.stdout

child.expect("bridge\\$")
time.sleep(1)
child.sendline("connect")

child.expect("Which online target would you like to connect", timeout=10)
time.sleep(1)

child.send("\x1b[B\r")

try:
    child.expect("successfully connected to Simulator", timeout=10)
except pexpect.TIMEOUT:
    print("\nFAILED TO CONNECT TO SIMULATOR.")
    sys.exit(1)

time.sleep(1)
child.sendline("install -t bip6")

child.expect("install success", timeout=120)
print("\n--- INSTALLED SUCCESSFULLY ---")
time.sleep(2)
# No screenshot command
