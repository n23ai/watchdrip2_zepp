import pexpect
import sys
import time
import os

log_file_path = "/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/scratch/live_bridge_captured.log"
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
print("[BridgeCmd] Launching zeus bridge...")
child = pexpect.spawn('/Users/nikolaj/.nvm/versions/node/v24.14.0/bin/zeus bridge', encoding='utf-8', cwd="/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp")
child.logfile = logger

try:
    child.expect("bridge\\$", timeout=15)
    time.sleep(1)
    print("[BridgeCmd] Sending connect...")
    child.sendline("connect")

    index = child.expect(["successfully connected to app-Android", "Client already bound", "successfully connected to Simulator", "Which online target would you like to connect"], timeout=20)
    if index == 3:
        child.send("\r")
        child.expect(["successfully connected to app-Android", "Client already bound"], timeout=20)
    
    print("\n[BridgeCmd] Connected! Waiting 2s, then sending screenshot...")
    time.sleep(2)
    child.sendline("screenshot")
    
    # Wait for response or screenshot output
    start_t = time.time()
    while time.time() - start_t < 15:
        try:
            line = child.read_nonblocking(size=1024, timeout=1)
        except pexpect.TIMEOUT:
            pass
        except pexpect.EOF:
            break

    print("\n[BridgeCmd] Done, exiting...")
    child.sendline("exit")
    time.sleep(1)
except Exception as e:
    print(f"\n[BridgeCmd] Exception: {e}")
finally:
    try:
        child.close(force=True)
    except:
        pass
    log_file.close()
