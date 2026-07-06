import pexpect
import sys
import time

def main():
    print("[Script] Starting zeus bridge...")
    child = pexpect.spawn("zeus bridge", encoding='utf-8', timeout=60)
    child.logfile = sys.stdout
    
    child.expect("bridge\\$", timeout=10)
    
    print("\n[Script] Sending 'connect'...")
    child.sendline("connect")
    
    # We expect the menu to appear since both Simulator and app-Android might be online
    child.expect("Which online target", timeout=15)
    time.sleep(2)
    
    buffer = child.before + child.after
    print(f"\n[Script] Buffer:\n{buffer}")
    
    # Find Simulator in the menu
    lines = [line.strip() for line in buffer.split('\r\n') if line.strip()]
    menu_options = []
    for line in lines:
        if "Simulator" in line or "app-Android" in line:
            clean_line = line.replace('\x1b[1a', '').replace('\x1b[2K', '').replace('\x1b[1G', '').strip()
            if "Simulator" in clean_line:
                menu_options.append("Simulator")
            elif "app-Android" in clean_line:
                menu_options.append("app-Android")
                
    print(f"[Script] Options found: {menu_options}")
    
    if "Simulator" in menu_options:
        sim_idx = menu_options.index("Simulator")
        # Send down arrow sim_idx times
        for _ in range(sim_idx):
            child.send("\x1b[B")
            time.sleep(0.5)
        child.sendline("") # Enter
    else:
        print("[Script] Simulator not found in menu! Sending Enter anyway...")
        child.sendline("")
        
    child.expect("successfully connected to Simulator", timeout=20)
    print("\n[Script] Connected to Simulator!")
    
    print("\n[Script] Installing 'common' target on Simulator...")
    child.sendline("install -t common")
    
    child.expect("Install lite app result: success", timeout=60)
    print("\n[Script] Installation on Simulator successful!")
    
    child.sendline("exit")
    child.close()
    print("[Script] Done!")

if __name__ == "__main__":
    main()
