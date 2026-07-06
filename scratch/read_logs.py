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
    child.sendline("install -t common")
    
    # Wait for install success
    try:
        child.expect("result: success", timeout=60)
        print("\n[Script] --- УСТАНОВКА УСПЕШНА ---")
    except pexpect.exceptions.TIMEOUT:
        print("\n[Script] --- ТАЙМАУТ УСТАНОВКИ ---")
    
    print("\n[Script] Читаем логи приложения в течение 10 секунд...")
    try:
        # Ждем 10 секунд, попутно логируя всё, что приходит в stdout
        child.expect("НЕВОЗМОЖНАЯ_СТРОКА", timeout=10)
    except pexpect.exceptions.TIMEOUT:
        pass

    child.sendline("exit")

if __name__ == "__main__":
    main()
