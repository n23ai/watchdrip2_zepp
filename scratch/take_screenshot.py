import pexpect
import sys
import time

def main():
    print("[Script] Запуск zeus bridge...")
    child = pexpect.spawn("zeus bridge", encoding='utf-8')
    child.logfile = sys.stdout

    child.expect("bridge\\$", timeout=10)
    
    print("\n[Script] Отправка команды 'connect'...")
    child.sendline("connect")
    
    # Wait for either menu or successful connection
    index = child.expect(["Which online target would you like to connect", "successfully connected to"], timeout=10)
    
    if index == 0:
        print("\n[Script] Анализируем меню...")
        child.expect("app-Android", timeout=2)
        if "Simulator" in child.before:
            child.sendline("\r")
        else:
            child.send("\033[B")
            child.sendline("\r")

        child.expect("successfully connected to", timeout=5)
    
    time.sleep(1) # wait for prompt to be ready
    print("\n[Script] Отправка команды 'screenshot'...")
    child.sendline("screenshot")
    
    child.expect("bridge screenshot success", timeout=10)
    print("\n[Script] --- СКРИНШОТ УСПЕШНО СДЕЛАН ---")
    
    time.sleep(1)
    child.sendline("exit")

if __name__ == "__main__":
    main()
