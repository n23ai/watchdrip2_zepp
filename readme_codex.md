# WatchDrip2 Zepp OS: обзор проекта и рекомендации

Дата анализа: 2026-07-06.

## Краткое описание

Проект представляет собой приложение **WatchDrip2** для часов и браслетов на **Zepp OS 3.x**. Его цель - получать данные CGM/WatchDrip/xDrip с телефона и показывать актуальное значение глюкозы, тренд, дельту и возраст данных на устройстве Zepp.

Основной сценарий работы:

1. На телефоне приложение Zepp запускает `app-side/index.js`.
2. На часах запускается `app.js`, который пытается стартовать фоновый сервис `app-service/index.js`.
3. `app-service/index.js` через BLE/RPC запрашивает у `app-side/index.js` данные `info.json`.
4. `app-side/index.js` делает HTTP-запрос к локальному серверу `http://localhost:29863/info.json`.
5. Сервис на часах сохраняет ответ в локальный `info.json`.
6. Основная страница `page/index.js` и виджет `data-widget/index.js` читают локальный файл и обновляют UI.

Это не самостоятельный CGM-клиент и не источник медицинских данных. Приложение является дисплеем/компаньоном и зависит от корректной работы WatchDrip/xDrip/Nightscout-совместимого источника на телефоне.

## Архитектура

### `app.json`

Манифест Zepp OS v2. Описывает приложение `WatchDrip2_zepp`, runtime API `3.0.0`, разрешения BLE, фонового сервиса, alarm/bg service и список поддерживаемых устройств.

Сейчас есть два основных target-профиля:

- `mi-band7`: дизайн шириной 194, page/app-side/app-service.
- `common`: дизайн шириной 480, page/app-side/app-service/settings/app-widget/secondary-widget.

### `app.js`

Глобальный entrypoint приложения. При `onCreate` запускает `app-service/index` через `@zos/app-service`. Также подключает device polyfill и общую message-инфраструктуру.

### `app-service/index.js`

Фоновый сервис на часах. Он:

- создает `MessageBuilder` с `@zos/ble`;
- подключается к app-side;
- периодически делает `Commands.getInfo`;
- сохраняет результат в локальный `info.json`;
- записывает служебные timestamp-и в `config.json`.

### `app-side/index.js`

Сервис на стороне телефона внутри Zepp. Он:

- слушает RPC-запросы от часов;
- обрабатывает `CMD_GET_INFO`, `CMD_GET_IMG`, `CMD_PUT_TREATMENTS`;
- ходит HTTP-запросами на локальный сервер `SERVER_URL`;
- умеет вести ограниченный сетевой лог в `settingsStorage` и отправлять лог на webhook.

### `page/index.js`

Главная страница часов. Она:

- создает экран с глюкозой, временем, дельтой и стрелкой тренда;
- читает локальный `info.json`;
- обновляет UI по таймеру;
- показывает экран настроек;
- имеет заглушку для экрана добавления treatment.

Важно: текущий `fetchInfo()` на странице больше не делает удаленный запрос, а только читает локальный файл. Реальная загрузка данных вынесена в `app-service`.

### `data-widget/index.js`

Виджет/shortcut card для быстрого просмотра данных. Он стартует app-service, читает `info.json`, показывает значение, тренд, subtitle с временем/дельтой и цветную шкалу диапазонов.

### `setting/index.js`

Страница настроек в приложении Zepp на телефоне. Сейчас она посвящена сетевому логированию: включение логов, webhook URL, просмотр последних событий, очистка и upload.

### `utils/`

Содержит конфигурацию, стили, пути, модели данных WatchDrip и helper-функции.

Ключевые файлы:

- `utils/config/constants.js` - интервалы, URL, команды, цвета.
- `utils/config/global-constants.js` - app id, имена файлов, дефолтные настройки.
- `utils/config/styles.js` - координаты и размеры UI для разных устройств.
- `utils/watchdrip/watchdrip-data.js` - модель агрегированных данных.
- `utils/watchdrip/model/*` - модели BG/status/treatment/pump.
- `utils/path.js` - обертка над Zepp OS FS.

### `shared/`

Общие полифилы и инфраструктура:

- BLE/RPC протокол `shared/message.js`;
- Buffer/Promise/timer/logger polyfills;
- FS helpers;
- navigation/global/debug helpers.

## Текущий статус проверки

Команда `npm test` была запущена и завершилась ошибкой, потому что в `package.json` тесты не настроены:

```text
Error: no test specified
```

То есть автоматической проверки сборки, линтинга или unit-тестов в проекте сейчас нет.

## Найденные проблемы и ошибки

### P0/P1: `SERVER_PUT_TREATMENTS_URL` используется без импорта

Файл: `app-side/index.js`, строки 1-2 и 154-155.

В `constants.js` константа экспортируется, но в `app-side/index.js` импортированы только `Commands`, `SERVER_INFO_URL`, `SERVER_URL`. При вызове `Commands.putTreatment` будет `ReferenceError`.

Рекомендация: добавить импорт `SERVER_PUT_TREATMENTS_URL` или временно отключить обработку `putTreatment`, пока treatment-функция не реализована полностью.

### P1: `fetchInfo()` в `app-side/index.js` некорректно работает без `ctx`

Файл: `app-side/index.js`, строки 38-79 и 81-84.

`sendToWatch()` вызывает `fetchInfo()` без аргументов. Внутри `fetchInfo()` условие `ctx !== false` истинно для `undefined`, поэтому код попытается вызвать `ctx.response(...)`. Кроме того, `return jsonResp` внутри `.finally()` не возвращает значение из внешней async-функции так, как ожидает `sendToWatch()`.

Рекомендация: разделить функцию на две:

- `requestInfo(url)` возвращает результат;
- `respondInfo(ctx, url)` вызывает `ctx.response(...)`.

Либо явно вызывать `fetchInfo(false, url)` и возвращать значение из внешней функции.

### P1: страница `add_treatment` видима, но не реализована

Файл: `page/index.js`, строки 203-205; `app-side/index.js`, строки 154-155.

На главной странице создается кнопка добавления treatment, но `add_treatment_page()` содержит только `//not implemented`. Одновременно app-side уже содержит обработчик `putTreatment`, который сейчас еще и падает из-за отсутствующего импорта.

Рекомендация: либо реализовать экран и полный поток отправки treatment, либо скрыть кнопку и команду до готовности функции.

### P1: настройки мержатся с дефолтами по неправильным ключам

Файл: `utils/watchdrip/config.js`, строки 15-31.

Класс хранит свойства `settings` и `alarmSettings`, а `read()` мержит дефолты в `parsed.watchdripConfig` и `parsed.watchdripAlarmConfig`. Эти поля не совпадают с тем, что сохраняет `save()` через `JSON.stringify(this)`.

Риск: при добавлении новых дефолтных настроек они могут не появиться у пользователей со старым `config.json`.

Рекомендация: мержить именно:

- `parsed.settings = { ...WATCHDRIP_SETTINGS_DEFAULTS, ...parsed.settings }`
- `parsed.alarmSettings = { ...WATCHDRIP_ALARM_SETTINGS_DEFAULTS, ...parsed.alarmSettings }`

### P2: `fetchInfo()` на странице больше не fetch, а чтение локального файла

Файл: `page/index.js`, строки 338-358.

Метод называется `fetchInfo`, но делает только `this.infoFile.fetchJSON()`. Это может путать при сопровождении, особенно потому что рядом остались `fetch_page`, `fetch_page_local`, alarm-логика и старые комментарии про запросы.

Рекомендация: переименовать в `readLocalInfo()` или явно документировать, что remote-fetch теперь выполняет `app-service`.

### P2: hardcoded `localhost:29863`

Файл: `utils/config/constants.js`, строки 8-10.

`SERVER_URL` жестко задан как `http://localhost:29863/`. Это удобно для WatchDrip/xDrip local web server, но плохо для альтернативного источника, Nightscout, другого порта или диагностики.

Рекомендация: вынести URL в настройки телефона (`setting/index.js`) и читать его в app-side через `settingsStorage`, оставив текущий URL дефолтом.

### P2: `package.json` все еще шаблонный

Файл: `package.json`, строки 2-8.

Пакет называется `empty`, описание пустое, тестовый скрипт является заглушкой.

Рекомендация: обновить metadata и добавить рабочие команды, например `lint`, `test`, `build`/`dev` для используемого Zepp/Zeus toolchain.

### P2: много отладочных артефактов и untracked-каталогов

В рабочем дереве присутствуют `scratch/`, `temp_unzipped/`, `sim-debug.log`, `zeus_bridge_log.txt`, `zeus_bridge_simulator_log.txt`, `app.json.bak`, временно распакованные `.zpk`.

Рекомендация: решить, какие из них нужны как исходники/инструменты. Остальное добавить в `.gitignore`, например:

```gitignore
scratch/unzipped_*/
temp_unzipped/
*.log
*.zpk
app.json.bak
```

Если `scratch/*.py` и install-скрипты являются рабочими инструментами, лучше перенести их в `tools/` и описать назначение.

### P2: debug/logging включены по умолчанию

Файлы: `app.json`, `utils/config/global-constants.js`, `app-side/index.js`.

В `app.json` включен `"debug": true`, а `showLog` по умолчанию `true`. Для приложения, работающего с данными здоровья, лучше минимизировать логирование в production-сборке.

Рекомендация: сделать production/debug профили, отключить debug по умолчанию и явно предупреждать пользователя перед upload логов.

### P3: `Path` принудительно отбрасывает директории

Файл: `utils/path.js`, строки 23-37.

Любой путь с `/` превращается в basename и scope становится `data`. Сейчас это упрощает работу Zepp OS 3.x с `info.json` и `config.json`, но может привести к коллизиям, если появятся файлы с одинаковыми именами в разных логических папках.

Рекомендация: либо оставить как сознательное ограничение и описать его, либо вернуть поддержку namespace-папок в data storage.

## Рекомендации по развитию

1. Сначала исправить явные runtime-ошибки в `app-side/index.js`: импорт `SERVER_PUT_TREATMENTS_URL`, поведение `fetchInfo()` без `ctx`, обработку ошибок `ctx.response`.
2. Привести в порядок настройки: корректный merge дефолтов, пользовательский `SERVER_URL`, безопасные production-дефолты.
3. Определиться с treatment-функцией: реализовать полностью или убрать UI/команду до готовности.
4. Разделить ответственность методов в `page/index.js`: локальное чтение, запуск фоновой загрузки, обновление UI и alarm-management лучше назвать явно.
5. Добавить минимальную автоматическую проверку:
   - статический импорт/синтаксис для локальных JS-файлов;
   - lint для неиспользуемых импортов и несуществующих символов;
   - smoke-тест моделей `WatchdripData`, `BgData`, `StatusData`;
   - тест `WatchdripConfig.read()` на миграцию старого `config.json`.
6. Описать сборку и установку: какой Zepp/Zeus CLI используется, какие устройства проверены, как собрать `.zab`, как установить на симулятор и реальные часы.
7. Почистить репозиторий: отделить исходники от временных распаковок, логов и экспериментальных скриптов.
8. Добавить privacy/security note: какие данные логируются, куда отправляются, как отключить логи и что попадает в webhook.

## Минимальный план исправлений

Самый короткий безопасный порядок:

1. Починить `app-side/index.js`:
   - импортировать `SERVER_PUT_TREATMENTS_URL`;
   - переписать `fetchInfo()` так, чтобы она возвращала данные и отдельно отвечала в `ctx`.
2. Починить `WatchdripConfig.read()` для `settings`/`alarmSettings`.
3. Скрыть кнопку `add_treatment`, если экран пока не нужен.
4. Переименовать `page/index.js::fetchInfo()` в `readLocalInfo()` и обновить вызовы.
5. Обновить `package.json` и добавить хотя бы `npm test`, который не падает заглушкой.

## Итог

Проект уже имеет рабочую архитектурную основу для Zepp OS 3.x: есть приложение часов, телефонный side-service, фоновый app-service, виджет, настройки и модели данных. Главные риски сейчас не в общей идее, а в незавершенной миграции/доработке: часть старой fetch/alarm-логики осталась в именах и UI, treatment-поток недоделан, а автоматической проверки нет. После исправления нескольких runtime-ошибок и наведения порядка в конфигурации проект станет заметно легче сопровождать и тестировать.
