import pexpect
import sys
import time
import os

log_file_path = "/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp/scratch/current_bridge_live.log"
os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
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
print(f"[Script] Starting zeus bridge to monitor logs...")
child = pexpect.spawn('/Users/nikolaj/.nvm/versions/node/v24.14.0/bin/zeus bridge', encoding='utf-8', cwd="/Users/nikolaj/Documents/dev/zepp/watchdrip2_zepp")
child.logfile = logger

child.expect("bridge\\$", timeout=20)
time.sleep(1)
print("\n[Script] Sending connect...")
child.sendline("connect")

try:
    index = child.expect(["successfully connected to app-Android", "Client already bound", "successfully connected to Simulator", "Which online target would you like to connect"], timeout=20)
    if index == 3:
        child.send("\r")
        index_conn = child.expect(["successfully connected to app-Android", "Client already bound", "successfully connected to Simulator"], timeout=20)
        if index_conn == 2:
            print("\n[Script] Connected to Simulator instead of Android")
    print("\n[Script] Connected successfully! Monitoring logs for 75 seconds...")
except Exception as e:
    print(f"\n[Script] Error connecting: {e}")
    sys.exit(1)

# Now just listen and record everything for 75 seconds
start_t = time.time()
while time.time() - start_t < 75:
    try:
        line = child.read_nonblocking(size=1024, timeout=1)
    except pexpect.TIMEOUT:
        pass
    except pexpect.EOF:
        break

print("\n[Script] Done monitoring, exiting bridge.")
try:
    child.sendline("exit")
    time.sleep(1)
except:
    pass
log_file.close()
