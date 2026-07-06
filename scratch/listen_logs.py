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
    
    print("\n[Script] ПОДКЛЮЧЕНО! Ждем логи 20 секунд. ПОЛЬЗОВАТЕЛЬ, ПОЖАЛУЙСТА, ВОСПРОИЗВЕДИТЕ ОШИБКУ НА ЧАСАХ!")
    try:
        child.expect("НЕВОЗМОЖНАЯ_СТРОКА", timeout=20)
    except pexpect.exceptions.TIMEOUT:
        pass
    
    child.sendline("exit")

if __name__ == "__main__":
    main()
