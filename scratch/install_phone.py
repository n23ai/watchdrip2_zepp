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
    
    index = child.expect(["Which online target would you like to connect", "successfully connected to"], timeout=10)
    
    if index == 0:
        print("\n[Script] Анализируем меню...")
        child.expect("app-Android", timeout=2)
        if "Simulator" in child.before:
            print("\n[Script] Simulator первый. Жмем вниз для app-Android...")
            child.send("\033[B")
            child.sendline("\r")
        else:
            print("\n[Script] Simulator не первый. Значит app-Android первый, жмем Enter...")
            child.sendline("\r")

        child.expect("successfully connected to", timeout=10)
    
    time.sleep(1)
    
    print("\n[Script] Отправка команды 'install'...")
    child.sendline("install")
    
    # Wait for install success
    try:
        child.expect("install success", timeout=60)
        print("\n[Script] --- УСТАНОВКА УСПЕШНА ---")
    except pexpect.exceptions.TIMEOUT:
        print("\n[Script] --- ТАЙМАУТ УСТАНОВКИ ---")
    
    time.sleep(1)
    child.sendline("exit")

if __name__ == "__main__":
    main()
