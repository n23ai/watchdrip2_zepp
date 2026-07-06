import json
import os

def main():
    devices_path = os.path.expanduser("~/.zepp/.zeus_devices")
    if not os.path.exists(devices_path):
        print(f"Error: {devices_path} does not exist!")
        return
        
    print(f"Loading {devices_path}...")
    with open(devices_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    devices = data.get("devices", [])
    
    # Check if they are already present
    present_sources = {d.get("deviceSource") for d in devices}
    
    new_devices = [
        {
            "settingName": "meta",
            "deviceSource": 9961728,
            "productName": "Amazfit Cheetah 2 Ultra",
            "code": "cheetah2_ultra_1",
            "value": {
                "os": {
                    "name": "ZeppOS",
                    "version": "3.0",
                    "apiLevel": "3.0",
                    "apiLevelLimitMax": "4.3",
                    "apiLevelLimitMin": "1.0"
                },
                "nfc": False,
                "chip": {
                    "type": "SOC",
                    "manufacturer": "NXP"
                },
                "code": "cheetah2_ultra_1",
                "brand": "Amazfit",
                "model": "A2292",
                "shape": "round",
                "voice": True,
                "nfcExt": {},
                "screen": {
                    "size": "480*480",
                    "previewSize": "324*324",
                    "iconSize": 124
                },
                "series": "GT手表",
                "bluetooth": "Amazfit Cheetah 2 Ultra",
                "productId": 124,
                "thumbnail": "",
                "deviceType": 0,
                "productLine": "GT",
                "productName": "Amazfit Cheetah 2 Ultra",
                "supportDiff": True,
                "capabilities": ["gps"],
                "productNameEN": "Amazfit Cheetah 2 Ultra",
                "productVersion": 256,
                "exemptBindCheck": False,
                "pixelDensity": "m"
            },
            "createTime": "2024-03-28 09:00:24",
            "updateTime": "2026-02-26 15:54:25"
        },
        {
            "settingName": "meta",
            "deviceSource": 9961729,
            "productName": "Amazfit Cheetah 2 Ultra",
            "code": "cheetah2_ultra_2",
            "value": {
                "os": {
                    "name": "ZeppOS",
                    "version": "3.0",
                    "apiLevel": "3.0",
                    "apiLevelLimitMax": "4.3",
                    "apiLevelLimitMin": "1.0"
                },
                "nfc": False,
                "chip": {
                    "type": "SOC",
                    "manufacturer": "NXP"
                },
                "code": "cheetah2_ultra_2",
                "brand": "Amazfit",
                "model": "A2292",
                "shape": "round",
                "voice": True,
                "nfcExt": {},
                "screen": {
                    "size": "480*480",
                    "previewSize": "324*324",
                    "iconSize": 124
                },
                "series": "GT手表",
                "bluetooth": "Amazfit Cheetah 2 Ultra",
                "productId": 124,
                "thumbnail": "",
                "deviceType": 0,
                "productLine": "GT",
                "productName": "Amazfit Cheetah 2 Ultra",
                "supportDiff": True,
                "capabilities": ["gps"],
                "productNameEN": "Amazfit Cheetah 2 Ultra",
                "productVersion": 257,
                "exemptBindCheck": False,
                "pixelDensity": "m"
            },
            "createTime": "2024-03-28 09:00:24",
            "updateTime": "2026-02-26 15:54:25"
        }
    ]
    
    added_count = 0
    for nd in new_devices:
        if nd["deviceSource"] not in present_sources:
            devices.append(nd)
            added_count += 1
            
    if added_count > 0:
        data["devices"] = devices
        print(f"Saving patched devices to {devices_path} (added {added_count} devices)...")
        with open(devices_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        print("Success!")
    else:
        print("Devices already patched.")

if __name__ == "__main__":
    main()
