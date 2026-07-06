import pexpect
import sys
import time

def main():
    print("[Script] Starting zeus bridge for monitoring...")
    child = pexpect.spawn('zeus bridge', encoding='utf-8', timeout=120)
    child.logfile = sys.stdout
    
    child.expect("bridge\\$", timeout=10)
    time.sleep(1)
    
    print("\n[Script] Sending 'connect'...")
    child.sendline("connect")
    
    idx = child.expect(["Which online target", "successfully connected to app-Android", "successfully connected to Simulator"], timeout=20)
    
    if idx == 0:
        print("\n[Script] Menu detected. Selecting app-Android...")
        time.sleep(2)
        # Assuming app-Android is the selected item (first)
        child.sendline("")
        child.expect("successfully connected to app-Android", timeout=20)
        
    print("\n--- CONNECTED. STREAMING LOGS FOR 90 SECONDS. START OR RUN APP NOW! ---")
    
    start_time = time.time()
    while time.time() - start_time < 90:
        try:
            child.expect('\r?\n', timeout=2)
        except pexpect.TIMEOUT:
            pass
        except pexpect.EOF:
            print("\nConnection closed by bridge.")
            break
            
    print("\n--- MONITORING FINISHED ---")
    child.sendline("exit")
    child.close()

if __name__ == "__main__":
    main()
