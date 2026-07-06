import pexpect
import sys
import time
import os

def main():
    print("[Script] Starting zeus bridge...")
    child = pexpect.spawn("zeus bridge", encoding='utf-8', timeout=60)
    child.logfile = sys.stdout
    
    child.expect("bridge\\$", timeout=10)
    
    print("\n[Script] Sending 'connect'...")
    child.sendline("connect")
    
    # We might see a menu or it might connect directly
    idx = child.expect(["Which online target", "successfully connected to app-Android", "successfully connected to Simulator"], timeout=20)
    
    if idx == 0:
        print("\n[Script] Menu detected. Selecting app-Android...")
        time.sleep(2) # Wait for menu to fully render
        buffer = child.before + child.after
        
        # Split buffer into lines to see the options
        lines = [line.strip() for line in buffer.split('\r\n') if line.strip()]
        
        menu_options = []
        for line in lines:
            if "Simulator" in line or "app-Android" in line:
                clean_line = line.replace('\x1b[1a', '').replace('\x1b[2K', '').replace('\x1b[1G', '').strip()
                if "Simulator" in clean_line:
                    menu_options.append("Simulator")
                elif "app-Android" in clean_line:
                    menu_options.append("app-Android")
        
        print(f"[Script] Parsed menu options: {menu_options}")
        
        if "app-Android" in menu_options:
            app_idx = menu_options.index("app-Android")
            # Send down arrow app_idx times
            for _ in range(app_idx):
                child.send("\x1b[B") # Down arrow
                time.sleep(0.5)
            child.sendline("") # Send Enter
        else:
            print("[Script] app-Android not found in menu! Exiting...")
            child.sendline("exit")
            return
            
        child.expect("successfully connected to app-Android", timeout=20)
        print("\n[Script] Successfully connected to app-Android after menu selection!")
        
    elif idx == 1:
        print("\n[Script] Connected directly to app-Android!")
    elif idx == 2:
        print("\n[Script] Connected directly to Simulator. Re-connecting to app-Android...")
        child.sendline("connect")
        child.expect("Which online target", timeout=10)
        time.sleep(2)
        # Select app-Android (should be second option usually, or just look up)
        child.send("\x1b[B") # Try down arrow
        time.sleep(0.5)
        child.sendline("")
        child.expect("successfully connected to app-Android", timeout=20)
        print("\n[Script] Successfully connected to app-Android!")
        
    # 4. Install target common
    print("\n[Script] Installing 'common' target...")
    child.sendline("install -t common")
    
    # Wait for install success
    child.expect("Install lite app result: success", timeout=90)
    print("\n[Script] Installed successfully on watch!")
    
    # Close bridge
    child.sendline("exit")
    child.close()
    print("\n[Script] Done!")

if __name__ == "__main__":
    main()
