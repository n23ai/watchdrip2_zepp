> Всё работает, я проверил .Прошло десять тиков. Теперь нужно вернуть обновление виджета, ведь сейчас запущены тестовые заглушки для отладки. Нужно вернуть, чтобы вызовы в фоне обновляли сахар в виджете. [AGENTS.md](AGENTS.md)

<details><summary>9 previous messages</summary>

> Зафиксировал: clean-run подтверждён десятью фоновыми тиками, значит continuous service теперь считаем рабочей основой. Сначала сверю текущий widget lifecycle, тестовые заглушки и фактический формат `info.json`, чтобы план возврата обновления сахара не затронул уже доказанный минутный контур.
>
> <details><summary>Explored 5 files, a search, ran 2 commands</summary>
>
> <details><summary>Explored 5 files</summary>
>
> - Read `./app-service/index.js`
> - Read `./AGENTS.md`
> - Read `./data-widget/index.js`
> - Read `./app.json`
> - Read `./work_app.md`
>
> </details>
>
> - Ran `git diff -- data-widget/index.js app-service/index.js page/index.js utils/path.js utils/watchdrip/config.js work_app.md`
>
> <details><summary>Explored a search</summary>
>
> - Searched for `AppWidget|SecondaryWidget|DataWidget|infoFile|WF_INFO_FILE|updateUI|onResume|onPause|setInterval|backgroundDebug|serviceControl|placeholder|test|stub|mock` in `data-widget`
>
> </details>
>
> - Ran `git status --short --branch; find dist -maxdepth 1 -type f -name '*.zab' -print | sort | tail -n 3`
>
> </details>
>
> Текущий виджет не совсем заглушка: он уже пытается читать `info.json` и перерисовываться на `onResume`, но есть два слабых места. Запись из App Service сейчас глотает ошибки и всё равно логирует `fetch_saved`, а один файл используется одновременно как `DataWidget`, `app-widget` и `secondary-widget`; проверяю исходную реализацию и lifecycle-конструкторы, чтобы выбрать минимальный воспроизводимый путь.
>
> <details><summary>Explored 4 files, 3 searches, ran a command</summary>
>
> <details><summary>Explored 4 files, 2 searches</summary>
>
> - Read `~/Documents/dev/zepp/specification/AGENT.md`
> - Read `./data-widget/index.js`
> - Read `./utils/path.js`
> - Read `./shared/fs.js`
> - Searched for `File writing|screen is off|AOD|LocalStorage|App Service` in `framework.md`
> - Searched for `app-widget|secondary-widget|DataWidget|AppWidget|SecondaryWidget` in `guides`
>
> </details>
>
> - Ran `git show HEAD:data-widget/index.js | sed -n '1,380p'; git diff -- data-widget/index.js`
>
> <details><summary>Explored a search</summary>
>
> - Searched for `DataWidget\(|AppWidget\(|SecondaryWidget\(` in `specification`
>
> </details>
>
> </details>
>
> Архитектурный вывод такой: production-виджет должен стать действительно read-only и перестать писать `backgroundDebug`; фоновый сервис должен публиковать проверенный snapshot, а два типа виджетов должны иметь корректные отдельные entrypoint (`AppWidget` и `SecondaryWidget`). Один продуктовый выбор остался: какой из двух интерфейсов считать обязательным для приёмки.
>
> User input response
>
> - Какие варианты виджета нужно восстановить и проверить на часах?
>   - Только карточка
>
> <details><summary>Explored 8 files, 3 searches, ran a command</summary>
>
> <details><summary>Explored 9 files, 3 searches</summary>
>
> - Read `./work_app.md`
> - Read `./utils/watchdrip/watchdrip-data.js`
> - Read `./utils/watchdrip/model/bgData.js`
> - Read `./utils/watchdrip/model/statusData.js`
> - Read `~/Documents/dev/zepp/specification/reference/device-app-api/ui.md`
> - Read `~/Documents/dev/zepp/specification/reference/device-app-api/ui.md`
> - Read `~/Documents/dev/zepp/specification/reference/device-app-api/global.md`
> - Read `~/Documents/dev/zepp/specification/guides/framework.md`
> - Searched for `overrideWithText|overrideWithJSON|\.override\(` in `.`
> - Searched for `fetch_saved|saved info.json|CMD_GET_INFO` in `scratch`
> - Searched for `TEST_DATA` in `constants.js`
> - Read `./utils/config/constants.js`
>
> </details>
>
> - Ran `git diff -- AGENTS.md work_app.md; git log -1 --format='%h %s %ad' --date=iso`
>
> </details>
>
> Plan
>
> # Возврат обновления Shortcut Card
>
> ## Итоговая архитектура
>
> - Сохранить доказанный continuous App Service без изменений в запуске, `Time.onPerMinute`, BLE/RPC и stale recovery.
> - Поддерживать только Shortcut Card, как выбрал пользователь.
> - App Service записывает подтверждённый `info.json`; карточка только читает его и никогда не запускает BLE, alarm или service.
> - Удалить тестовый debug-текст и lifecycle-записи из карточки.
>
> ## Изменения
>
> - Заменить `DataWidget(...)` на корректный для Shortcut Card `AppWidget(...)`; `DataWidget` требует API 3.6, тогда как приложение поддерживает API 3.0.
> - В `app.json` оставить `app-widget` с `data-widget/index`, удалить регистрацию и i18n для неиспользуемого `secondary-widget`.
> - Рассчитывать координаты относительно `getAppWidgetSize().w/h`, а не полного экрана часов.
> - В `build` и `onResume` немедленно читать `info.json`; пока карточка в фокусе, перечитывать файл каждые 5 секунд. В `onPause/onDestroy` обязательно останавливать timer.
> - Удалить из карточки `WatchdripConfig`, `markBackgroundDebug`, debug-строку и любые записи в файловую систему.
> - Отображать из кэша значение сахара, trend arrow, возраст измерения, delta, единицу и положение указателя; при отсутствующем или повреждённом файле показывать `--` без падения.
>
> Для проверяемого сохранения в App Service:
>
> - Преобразовывать ответ в объект и добавлять `_watchdrip: { runId, seq, fetchedAt }`.
> - Записывать объект в существующий `info.json`, затем сразу перечитывать его.
> - Считать сохранение успешным только если read-back содержит те же `runId` и `seq`.
> - Логировать `fetch_saved` только после подтверждения; иначе фиксировать `fetch_save_error`.
> - Не менять `graph=1`, команду `GET_INFO`, минутный trigger и защиту зависшего `fetchInFlight`.
>
> Публичных API нет. Внутренний формат `info.json` расширяется необязательным полем `_watchdrip`; существующие потребители его игнорируют.
>
> ## Проверка на часах
>
> 1. Собрать и установить новый `.zab`, записать имя и SHA-256.
> 2. Удалить и повторно добавить Shortcut Card, чтобы исключить старый cached lifecycle.
> 3. Убедиться, что background service показывает `cb=true run=true`, затем закрыть основное приложение.
> 4. На циферблате дождаться минимум трёх фоновых циклов и подтверждённых `fetch_saved` с растущим `seq`.
> 5. Открыть карточку: не позднее 5 секунд она должна показать значение из последнего подтверждённого snapshot, правильные delta/unit/trend и возраст CGM.
> 6. Вернуться на циферблат, дождаться нового измерения/`seq`, снова открыть карточку и подтвердить обновление без запуска основного приложения.
> 7. Повторить десятиминутный background-тест после изменения storage path: минимум 9 успешных вызовов из 10, continuous service не прекращает работу.
> 8. Проверить отсутствующий и повреждённый `info.json`: карточка показывает `--`, не падает и восстанавливается после следующего успешного сохранения.
>
> При открытой карточке запись App Service может быть запрещена прошивкой из-за screen-on ограничения `@zos/fs`. Это не считать регрессией: после возврата на циферблат/off/AOD следующий минутный тик должен сохранить snapshot, а новый `onResume` карточки — отобразить его.
>
> ## Документация
>
> - Дополнить `work_app.md` контрактом `_watchdrip`, правилами read-only Shortcut Card и фактическими результатами проверки.
> - Зафиксировать package/hash, последовательность `seq`, время открытия карточки и обезличенный фрагмент `tick -> FETCH_RES -> verified save -> card read`.
> - Полный bridge-лог и значения сахара не добавлять в репозиторий.
> - Главную диагностическую кнопку запуска сервиса оставить: она относится к доказанному production lifecycle, а не к тестовой заглушке карточки.
>
> Plan implementation
>
> Status: completed
> # Возврат обновления Shortcut Card
>
> ## Итоговая архитектура
>
> - Сохранить доказанный continuous App Service без изменений в запуске, `Time.onPerMinute`, BLE/RPC и stale recovery.
> - Поддерживать только Shortcut Card, как выбрал пользователь.
> - App Service записывает подтверждённый `info.json`; карточка только читает его и никогда не запускает BLE, alarm или service.
> - Удалить тестовый debug-текст и lifecycle-записи из карточки.
>
> ## Изменения
>
> - Заменить `DataWidget(...)` на корректный для Shortcut Card `AppWidget(...)`; `DataWidget` требует API 3.6, тогда как приложение поддерживает API 3.0.
> - В `app.json` оставить `app-widget` с `data-widget/index`, удалить регистрацию и i18n для неиспользуемого `secondary-widget`.
> - Рассчитывать координаты относительно `getAppWidgetSize().w/h`, а не полного экрана часов.
> - В `build` и `onResume` немедленно читать `info.json`; пока карточка в фокусе, перечитывать файл каждые 5 секунд. В `onPause/onDestroy` обязательно останавливать timer.
> - Удалить из карточки `WatchdripConfig`, `markBackgroundDebug`, debug-строку и любые записи в файловую систему.
> - Отображать из кэша значение сахара, trend arrow, возраст измерения, delta, единицу и положение указателя; при отсутствующем или повреждённом файле показывать `--` без падения.
>
> Для проверяемого сохранения в App Service:
>
> - Преобразовывать ответ в объект и добавлять `_watchdrip: { runId, seq, fetchedAt }`.
> - Записывать объект в существующий `info.json`, затем сразу перечитывать его.
> - Считать сохранение успешным только если read-back содержит те же `runId` и `seq`.
> - Логировать `fetch_saved` только после подтверждения; иначе фиксировать `fetch_save_error`.
> - Не менять `graph=1`, команду `GET_INFO`, минутный trigger и защиту зависшего `fetchInFlight`.
>
> Публичных API нет. Внутренний формат `info.json` расширяется необязательным полем `_watchdrip`; существующие потребители его игнорируют.
>
> ## Проверка на часах
>
> 1. Собрать и установить новый `.zab`, записать имя и SHA-256.
> 2. Удалить и повторно добавить Shortcut Card, чтобы исключить старый cached lifecycle.
> 3. Убедиться, что background service показывает `cb=true run=true`, затем закрыть основное приложение.
> 4. На циферблате дождаться минимум трёх фоновых циклов и подтверждённых `fetch_saved` с растущим `seq`.
> 5. Открыть карточку: не позднее 5 секунд она должна показать значение из последнего подтверждённого snapshot, правильные delta/unit/trend и возраст CGM.
> 6. Вернуться на циферблат, дождаться нового измерения/`seq`, снова открыть карточку и подтвердить обновление без запуска основного приложения.
> 7. Повторить десятиминутный background-тест после изменения storage path: минимум 9 успешных вызовов из 10, continuous service не прекращает работу.
> 8. Проверить отсутствующий и повреждённый `info.json`: карточка показывает `--`, не падает и восстанавливается после следующего успешного сохранения.
>
> При открытой карточке запись App Service может быть запрещена прошивкой из-за screen-on ограничения `@zos/fs`. Это не считать регрессией: после возврата на циферблат/off/AOD следующий минутный тик должен сохранить snapshot, а новый `onResume` карточки — отобразить его.
>
> ## Документация
>
> - Дополнить `work_app.md` контрактом `_watchdrip`, правилами read-only Shortcut Card и фактическими результатами проверки.
> - Зафиксировать package/hash, последовательность `seq`, время открытия карточки и обезличенный фрагмент `tick -> FETCH_RES -> verified save -> card read`.
> - Полный bridge-лог и значения сахара не добавлять в репозиторий.
> - Главную диагностическую кнопку запуска сервиса оставить: она относится к доказанному production lifecycle, а не к тестовой заглушке карточки.
</details>

> "В build и onResume немедленно читать info.json; пока карточка в фокусе, перечитывать файл каждые 5 секунд." Это не повлияет на производительность и расход батареи ?

Да, опрос файла каждые 5 секунд создаёт лишние пробуждения и чтения flash. Расход небольшой, пока карточка открыта, но пользы почти нет: Zepp OS может запрещать App Service записывать файл при включённом экране.

Оптимальнее:

- читать `info.json` один раз в `build`;
- перечитывать при каждом `onResume`;
- не запускать 5-секундный polling;
- при необходимости обновлять только текст возраста раз в минуту без чтения файла;
- останавливать минутный timer в `onPause/onDestroy`.

Так карточка покажет последний фоновый результат сразу при открытии, а большую часть времени вообще не будет потреблять ресурсы. Этот вариант я бы закрепил вместо polling каждые 5 секунд.

> давай

<details><summary>2 previous messages</summary>

> Plan
>
> # Возврат обновления Shortcut Card
>
> ## Архитектура
>
> - Сохранить доказанный continuous App Service: `Time.onPerMinute -> BLE/RPC -> verified info.json`.
> - Поддерживать только Shortcut Card через `AppWidget`.
> - Карточка остаётся read-only и не запускает BLE, service, alarm или файловый polling.
> - Читать данные при `build` и каждом `onResume`; возраст обновлять не чаще раза в минуту.
>
> ## Изменения
>
> - Заменить `DataWidget(...)` на `AppWidget(...)`.
> - В `app.json` оставить только `app-widget`; удалить неиспользуемый `secondary-widget`.
> - Рассчитывать layout относительно `getAppWidgetSize()`.
> - Удалить debug-текст, `markBackgroundDebug`, `WatchdripConfig` и файловые записи из карточки.
> - В `build/onResume` читать `info.json` и отображать сахар, trend, delta, единицу, возраст и указатель диапазона.
> - Не перечитывать файл по timer. При необходимости запустить минутный timer только для пересчёта текста возраста; очищать его в `onPause/onDestroy`.
> - При отсутствующем или повреждённом файле показывать `--` без падения.
>
> App Service при сохранении:
>
> - Добавляет `_watchdrip: { runId, seq, fetchedAt }`.
> - Записывает `info.json`, перечитывает его и сверяет `runId/seq`.
> - Логирует `fetch_saved` только после успешного read-back; иначе `fetch_save_error`.
> - Не меняет `GET_INFO`, `graph=1`, минутный trigger, startup и stale recovery.
>
> Публичных API нет; формат `info.json` получает необязательное поле `_watchdrip`.
>
> ## Проверка
>
> 1. Собрать и установить `.zab`, записать имя и SHA-256.
> 2. Удалить и повторно добавить Shortcut Card.
> 3. Запустить service, закрыть приложение и дождаться минимум трёх подтверждённых сохранений с растущим `seq`.
> 4. Открыть карточку: она сразу показывает последний snapshot без запуска основной страницы.
> 5. Вернуться на циферблат, дождаться нового `seq`, повторно открыть карточку и подтвердить обновление сахара.
> 6. Оставить карточку открытой на минуту: файловых чтений по timer нет, меняется только отображаемый возраст.
> 7. Повторить десятиминутный background-тест; минимум 9 успешных циклов из 10.
> 8. Проверить отсутствующий и повреждённый `info.json`: карточка показывает `--` и восстанавливается после следующего сохранения.
>
> ## Документация
>
> - Обновить `work_app.md`: контракт `_watchdrip`, read-only lifecycle карточки и отсутствие 5-секундного polling.
> - Зафиксировать package/hash, последовательность `seq` и цепочку `tick -> FETCH_RES -> verified save -> card read`.
> - Полные bridge-логи и значения сахара не добавлять в репозиторий.
>
> Plan implementation
>
> Status: completed
> # Возврат обновления Shortcut Card
>
> ## Архитектура
>
> - Сохранить доказанный continuous App Service: `Time.onPerMinute -> BLE/RPC -> verified info.json`.
> - Поддерживать только Shortcut Card через `AppWidget`.
> - Карточка остаётся read-only и не запускает BLE, service, alarm или файловый polling.
> - Читать данные при `build` и каждом `onResume`; возраст обновлять не чаще раза в минуту.
>
> ## Изменения
>
> - Заменить `DataWidget(...)` на `AppWidget(...)`.
> - В `app.json` оставить только `app-widget`; удалить неиспользуемый `secondary-widget`.
> - Рассчитывать layout относительно `getAppWidgetSize()`.
> - Удалить debug-текст, `markBackgroundDebug`, `WatchdripConfig` и файловые записи из карточки.
> - В `build/onResume` читать `info.json` и отображать сахар, trend, delta, единицу, возраст и указатель диапазона.
> - Не перечитывать файл по timer. При необходимости запустить минутный timer только для пересчёта текста возраста; очищать его в `onPause/onDestroy`.
> - При отсутствующем или повреждённом файле показывать `--` без падения.
>
> App Service при сохранении:
>
> - Добавляет `_watchdrip: { runId, seq, fetchedAt }`.
> - Записывает `info.json`, перечитывает его и сверяет `runId/seq`.
> - Логирует `fetch_saved` только после успешного read-back; иначе `fetch_save_error`.
> - Не меняет `GET_INFO`, `graph=1`, минутный trigger, startup и stale recovery.
>
> Публичных API нет; формат `info.json` получает необязательное поле `_watchdrip`.
>
> ## Проверка
>
> 1. Собрать и установить `.zab`, записать имя и SHA-256.
> 2. Удалить и повторно добавить Shortcut Card.
> 3. Запустить service, закрыть приложение и дождаться минимум трёх подтверждённых сохранений с растущим `seq`.
> 4. Открыть карточку: она сразу показывает последний snapshot без запуска основной страницы.
> 5. Вернуться на циферблат, дождаться нового `seq`, повторно открыть карточку и подтвердить обновление сахара.
> 6. Оставить карточку открытой на минуту: файловых чтений по timer нет, меняется только отображаемый возраст.
> 7. Повторить десятиминутный background-тест; минимум 9 успешных циклов из 10.
> 8. Проверить отсутствующий и повреждённый `info.json`: карточка показывает `--` и восстанавливается после следующего сохранения.
>
> ## Документация
>
> - Обновить `work_app.md`: контракт `_watchdrip`, read-only lifecycle карточки и отсутствие 5-секундного polling.
> - Зафиксировать package/hash, последовательность `seq` и цепочку `tick -> FETCH_RES -> verified save -> card read`.
> - Полные bridge-логи и значения сахара не добавлять в репозиторий.
</details>

> PLEASE IMPLEMENT THIS PLAN:
> # Возврат обновления Shortcut Card
>
> ## Архитектура
>
> - Сохранить доказанный continuous App Service: `Time.onPerMinute -> BLE/RPC -> verified info.json`.
> - Поддерживать только Shortcut Card через `AppWidget`.
> - Карточка остаётся read-only и не запускает BLE, service, alarm или файловый polling.
> - Читать данные при `build` и каждом `onResume`; возраст обновлять не чаще раза в минуту.
>
> ## Изменения
>
> - Заменить `DataWidget(...)` на `AppWidget(...)`.
> - В `app.json` оставить только `app-widget`; удалить неиспользуемый `secondary-widget`.
> - Рассчитывать layout относительно `getAppWidgetSize()`.
> - Удалить debug-текст, `markBackgroundDebug`, `WatchdripConfig` и файловые записи из карточки.
> - В `build/onResume` читать `info.json` и отображать сахар, trend, delta, единицу, возраст и указатель диапазона.
> - Не перечитывать файл по timer. При необходимости запустить минутный timer только для пересчёта текста возраста; очищать его в `onPause/onDestroy`.
> - При отсутствующем или повреждённом файле показывать `--` без падения.
>
> App Service при сохранении:
>
> - Добавляет `_watchdrip: { runId, seq, fetchedAt }`.
> - Записывает `info.json`, перечитывает его и сверяет `runId/seq`.
> - Логирует `fetch_saved` только после успешного read-back; иначе `fetch_save_error`.
> - Не меняет `GET_INFO`, `graph=1`, минутный trigger, startup и stale recovery.
>
> Публичных API нет; формат `info.json` получает необязательное поле `_watchdrip`.
>
> ## Проверка
>
> 1. Собрать и установить `.zab`, записать имя и SHA-256.
> 2. Удалить и повторно добавить Shortcut Card.
> 3. Запустить service, закрыть приложение и дождаться минимум трёх подтверждённых сохранений с растущим `seq`.
> 4. Открыть карточку: она сразу показывает последний snapshot без запуска основной страницы.
> 5. Вернуться на циферблат, дождаться нового `seq`, повторно открыть карточку и подтвердить обновление сахара.
> 6. Оставить карточку открытой на минуту: файловых чтений по timer нет, меняется только отображаемый возраст.
> 7. Повторить десятиминутный background-тест; минимум 9 успешных циклов из 10.
> 8. Проверить отсутствующий и повреждённый `info.json`: карточка показывает `--` и восстанавливается после следующего сохранения.
>
> ## Документация
>
> - Обновить `work_app.md`: контракт `_watchdrip`, read-only lifecycle карточки и отсутствие 5-секундного polling.
> - Зафиксировать package/hash, последовательность `seq` и цепочку `tick -> FETCH_RES -> verified save -> card read`.
> - Полные bridge-логи и значения сахара не добавлять в репозиторий.

<details><summary>43 previous messages</summary>

> Начинаю с двух изолированных изменений: App Service получит проверяемую запись с `runId/seq`, а Shortcut Card станет настоящим `AppWidget`, который читает файл только при `build/onResume`. Доказанный запуск, минутный trigger, transport и stale recovery не меняю.
>
> <details><summary>Explored 3 files, ran a command</summary>
>
> <details><summary>Explored 3 files</summary>
>
> - Read `./app-service/index.js`
> - Read `./data-widget/index.js`
> - Read `./app.json`
>
> </details>
>
> - Ran `git diff --check; git status --short`
>
> </details>
>
> Редактирую карточку целиком, сохраняя её визуальную структуру: корректный `AppWidget`, координаты относительно реальной области карточки, чтение только при входе и минутное обновление возраста из памяти. Debug overlay и любые записи из widget lifecycle удаляются.
>
> <details><summary>Created a file</summary>
>
> - Wrote `./data-widget/index.js` (+264 -0)
>
> </details>
>
> Теперь усиливаю только последнюю стадию App Service: каждый полученный ответ получает уникальные `runId/seq`, а `fetch_saved` появляется лишь после чтения этих же значений обратно из `info.json`. Это даст карточке надёжный снимок и исключит ложный success при запрещённой записи.
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./app-service/index.js` (+33 -7)
>
> </details>
>
> Следующая правка только в манифесте: оставляю Shortcut Card и убираю регистрацию Secondary Widget, чтобы один entrypoint больше не загружался системой под несовместимым lifecycle.
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./app.json` (+0 -27)
>
> </details>
>
> Карточка и манифест готовы. Сейчас запускаю статические проверки и сборку; особое внимание проверю на валидность `app.json`, поддержку `AppWidget` при API 3.0 и отсутствие любых 5-секундных чтений/записей из карточки.
>
> <details><summary>Edited a file, explored a search, ran 4 commands</summary>
>
> - Ran `git diff --check -- data-widget/index.js app-service/index.js app.json work_app.md`
>
> <details><summary>Explored a search</summary>
>
> - Searched for `DataWidget|SecondaryWidget|secondary-widget|markBackgroundDebug|WatchdripConfig|5000|fetchJSON|setInterval` in `index.js`
>
> </details>
>
> - Ran `git diff --stat -- data-widget/index.js app-service/index.js app.json; git diff -- app.json`
>
> - Ran `node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('app.json ok')"`
>
> - Wrote `./app-service/index.js` (+4 -4)
>
> - Ran `zeus build`
>
> </details>
>
> Сборка прошла, и число device entrypoint уменьшилось с 7 до 6 ожидаемо из-за удаления Secondary Widget. Устанавливаю пакет на часы; затем проверим сначала фоновые `seq`, после чего карточку нужно будет удалить и добавить заново, чтобы Zepp OS не держала старый `DataWidget` в кэше.
>
> <details><summary>Explored a search, ran 3 commands</summary>
>
> - Ran `python3 /Users/nikolaj/Documents/dev/zepp/simulator/install_android_cheetah.py`
>
> - Ran `stat -f '%Sm %z %N' -t '%Y-%m-%d %H:%M:%S' dist/*.zab`
>
> <details><summary>Explored a search</summary>
>
> - Searched for `*.zab` in `dist`
>
> </details>
>
> - Ran `shasum -a 256 dist/*.zab`
>
> </details>
>
> Установка успешна. На часах теперь нужно: удалить старую Shortcut Card из списка, добавить её заново, затем открыть WatchDrip2, нажать кнопку запуска background service и закрыть приложение на циферблат. Напишите «готово» после этих действий; bridge уже запускаю, затем проверю три `seq` и сниму карточку.
>
> <details><summary>Ran a command</summary>
>
> - Ran `zeus bridge`
>
> </details>
>
> Код, сборка и установка завершены; сейчас единственный незавершённый этап зависит от действий на часах: пере-добавление карточки и запуск сервиса после обновления. Bridge подключён и ждёт, так что после «готово» сразу проверю записи и внешний вид.
>
> <details><summary>Ran a command</summary>
>
> - Ran `date '+%H:%M:%S'`
>
> </details>
>
> Сделай скриншот. На виджете пропал сахар.
>
> Viewed an image
>
> Скриншот снят: новый `AppWidget` загрузился и layout корректен, но карточка показывает `--`, то есть не видит валидный `info.json`. В bridge также нет новых фоновых запросов после `23:17:55`, поэтому сейчас одновременно не подтверждены и cache, и продолжение service после установки.
>
> Откройте основное приложение, дождитесь появления сахара, затем сразу вернитесь в Shortcut Card, не переустанавливая ничего. Это отделит проблему чтения карточкой от проблемы фонового сохранения; после перехода я сразу сниму второй скриншот и логи.
>
> Viewed an image
>
> Второй скриншот подтверждает: карточка теперь правильно читает общий `info.json` и показывает сахар `9.8`, trend, delta, возраст и указатель. Значит Shortcut Card восстановлена; первоначальный `--` был из-за отсутствия свежего cache после установки.
>
> Теперь нажмите в основном приложении `Start background service` и закройте его на циферблат. Я проверю три фоновых запроса; после них откроем карточку ещё раз и подтвердим, что значение пришло именно из фона.
>
> у меня вместо "Start background service" кнопка с надписью BG cb=true run=true
>
> Это та же кнопка, только она показывает сохранённый результат диагностики. Нажмите `BG cb=true run=true` один раз: обработчик тот же, он проверит `getAllAppServices()` и либо подтвердит уже работающий сервис, либо запустит его заново. После нажатия закройте приложение.
>
> Нажал и закрыл.
>
> Сервис после явного нажатия работает: запросы пришли в `23:23:42` и `23:25:13`. Второй интервал длиннее обычного, поэтому жду третий цикл и только после него проверю карточку на новом snapshot.
>
> <details><summary>Ran a command</summary>
>
> - Ran `date '+%H:%M:%S'`
>
> </details>
>
> Третий тик не пришёл и процесс снова остановился после добавления read-back. Это именно та регрессия, от которой вы предупреждали: verified save внутри App Service меняет доказанный runtime и нарушает его долгую жизнь. Откатываю только новый `runId/seq/read-back`, возвращая ранее проверенную запись `info.json`; `AppWidget` и read-only lifecycle карточки оставляю. Затем пересоберу и повторю тест вызовов.
>
> <details><summary>Edited a file, ran 2 commands</summary>
>
> - Wrote `./app-service/index.js` (+7 -33)
> - Ran `zeus build`
> - Ran `python3 /Users/nikolaj/Documents/dev/zepp/simulator/install_android_cheetah.py`
>
> </details>
>
> Сборка с восстановленным золотым App Service установлена. Нажмите `BG cb=true run=true` ещё раз и закройте приложение: обновление пакета останавливает старый процесс, поэтому сервис нужно запустить после каждой диагностической установки. Карточку повторно добавлять уже не нужно.
>
> <details><summary>Ran a command</summary>
>
> - Ran `zeus bridge`
>
> </details>
>
> Пока часы ждут запуска сервиса, обновляю `work_app.md`: фиксирую, что карточка теперь `AppWidget`, читает файл только при `build/onResume`, а попытка read-back внутри App Service была отклонена как регрессия и не входит в золотой путь. Результат финального фонового теста допишу после тиков.
>
> <details><summary>Edited a file, explored a search, ran 2 commands</summary>
>
> - Ran `stat -f '%Sm %z %N' -t '%Y-%m-%d %H:%M:%S' dist/*.zab`
>
> <details><summary>Explored a search</summary>
>
> - Searched for `*.zab` in `dist`
>
> </details>
>
> - Ran `shasum -a 256 dist/*.zab`
>
> - Wrote `./work_app.md` (+24 -0)
>
> </details>
>
> Запуск пойман: первый запрос новой сборки пришёл в `23:31:11`. Считаю его стартовым и жду следующие фоновые минуты; приложение больше не открывайте до проверки карточки.
>
> После стартового foreground-запроса `23:31:11` минутные вызовы не продолжились, значит текущий клик не запустил новый service после установки, вероятно кнопка приняла сохранённый `run=true` за актуальное состояние. Откройте приложение, нажмите статус-кнопку и оставьте страницу открытой на 10 секунд; я сниму свежий `cb/run` этой установки, затем снова закроем.
>
> Viewed an image
>
> Свежий статус подтверждён: `BG already running`, то есть сервис действительно зарегистрирован в ОС; проблема была не в сохранённой надписи. Закройте приложение сейчас на циферблат. Я начну новый отсчёт от этого момента и не буду учитывать foreground-запрос `23:35`.
>
> Поведение воспроизводится только после обновления пакета: `getAllAppServices()` возвращает «running», но этот сохранённый экземпляр даёт один тик и замирает; кнопка сейчас делает no-op из-за idempotent-check. Исправляю ручную кнопку как безопасный repair: если сервис уже числится запущенным, она выполнит `stop -> start` текущего `app-service/index`. На чистой установке по-прежнему будет обычный `start`; минутный код не меняется.
>
> <details><summary>Edited a file, explored a file, ran 2 commands</summary>
>
> <details><summary>Explored a file</summary>
>
> - Read `./page/index.js`
>
> </details>
>
> - Wrote `./page/index.js` (+65 -25)
>
> <details><summary>Explored a file</summary>
>
> - Read `./page/index.js`
>
> </details>
>
> - Ran `git diff --check -- page/index.js data-widget/index.js app-service/index.js app.json work_app.md`
>
> - Ran `node -e "JSON.parse(require('fs').readFileSync('app.json')); console.log('json ok')"`
>
> </details>
>
> Repair-кнопка готова и проверки проходят. Пересобираю и устанавливаю последнюю сборку; после неё одно нажатие гарантированно заменит stale-экземпляр сервиса на новый, вместо прежнего no-op.
>
> <details><summary>Ran 2 commands</summary>
>
> - Ran `zeus build`
> - Ran `python3 /Users/nikolaj/Documents/dev/zepp/simulator/install_android_cheetah.py`
>
> </details>
>
> Последняя сборка установлена. Откройте приложение и нажмите текущую BG-кнопку один раз; теперь она выполнит принудительный `stop -> start`. Оставьте страницу открытой 10 секунд, чтобы я увидел `cb=true run=true`, затем закроем и проверим несколько минут подряд.
>
> <details><summary>Ran 2 commands</summary>
>
> - Ran `zeus bridge`
> - Ran `connect`
>
> </details>
>
> System error
>
> You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at Jul 11th, 2026 3:54 AM.
</details>
