import pexpect
import sys
import time
import os

log_file_path = "/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/scratch/bridge_minute_live.log"
log_file = open(log_file_path, "w", encoding="utf-8")

class Logger:
    def __init__(self, f):
        self.f = f
    def write(self, data):
        sys.stdout.write(data)
        sys.stdout.flush()
        self.f.write(data)
        self.f.flush()
    def flush(self):
        sys.stdout.flush()
        self.f.flush()

logger = Logger(log_file)
print("[BridgeMinute] Launching zeus bridge...", flush=True)
child = pexpect.spawn('/Users/nikolaj/.nvm/versions/node/v24.14.0/bin/zeus bridge', encoding='utf-8', cwd="/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp")
child.logfile = logger

try:
    child.expect("bridge\\$", timeout=15)
    time.sleep(1)
    print("[BridgeMinute] Sending connect...", flush=True)
    child.sendline("connect")

    index = child.expect(["successfully connected to app-Android", "Client already bound", "successfully connected to Simulator", "Which online target would you like to connect"], timeout=20)
    if index == 3:
        child.send("\r")
        child.expect(["successfully connected to app-Android", "Client already bound"], timeout=20)
    
    print("\n[BridgeMinute] Connected! Now listening for 75 seconds to catch minute tick...", flush=True)
    start_t = time.time()
    while time.time() - start_t < 75:
        try:
            line = child.read_nonblocking(size=2048, timeout=1)
        except pexpect.TIMEOUT:
            pass
        except pexpect.EOF:
            break

    print("\n[BridgeMinute] 75 seconds passed, exiting bridge...", flush=True)
    child.sendline("exit")
    time.sleep(1)
except Exception as e:
    print(f"\n[BridgeMinute] Exception: {e}", flush=True)
finally:
    try:
        child.close(force=True)
    except:
        pass
    log_file.close()
    print("[BridgeMinute] Finished.")
