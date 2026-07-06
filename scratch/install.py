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
        print("\n[Script] Выбираем устройство...")
        child.sendline("\r")
        child.expect("successfully connected to", timeout=10)
    
    time.sleep(2)
    
    print("\n[Script] Отправка команды 'install'...")
    child.sendline("install")
    
    # Wait for install success
    try:
        index = child.expect(["Which project do you want to install", "bridge install success", "install failed"], timeout=60)
        if index == 0:
            child.sendline("\r")
            child.expect("bridge install success", timeout=60)
            print("\n[Script] --- УСТАНОВКА ЗАВЕРШЕНА ---")
        elif index == 1:
            print("\n[Script] --- УСТАНОВКА ЗАВЕРШЕНА ---")
        elif index == 2:
            print("\n[Script] --- ОШИБКА УСТАНОВКИ ---")
    except pexpect.TIMEOUT:
        print("\n[Script] --- ТАЙМАУТ УСТАНОВКИ ---")
        
    time.sleep(1)
    child.sendline("exit")

if __name__ == "__main__":
    main()
