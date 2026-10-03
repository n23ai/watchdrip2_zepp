try {
  (() => {
    const C = {
      bg: '#000000',
      card: '#1c1c1e',
      field: '#2c2c2e',
      line: '#3a3a3c',
      text: '#ffffff',
      sub: '#8e8e93',
      accent: '#0a84ff',
      green: '#30d158',
      red: '#ff453a'
    };

    const S = {
      page: {
        flex: 1,
        padding: '14px',
        backgroundColor: C.bg,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      },
      card: {
        backgroundColor: C.card,
        borderRadius: '14px',
        padding: '14px',
        marginBottom: '14px',
        display: 'flex',
        flexDirection: 'column'
      },
      h1: {
        color: C.text,
        fontSize: '17px',
        fontWeight: '700',
        marginBottom: '4px'
      },
      caption: {
        color: C.sub,
        fontSize: '13px',
        lineHeight: '18px',
        marginBottom: '8px'
      },
      row: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '8px',
        marginBottom: '4px'
      },
      field: {
        backgroundColor: C.field,
        borderRadius: '10px',
        padding: '8px 12px',
        marginTop: '8px'
      },
      fieldLabel: {
        color: C.sub,
        fontSize: '12px'
      },
      fieldValue: {
        color: C.text,
        fontSize: '15px'
      },
      btnPrimary: {
        backgroundColor: C.accent,
        color: '#ffffff',
        borderRadius: '10px',
        marginTop: '10px'
      },
      btnSuccess: {
        backgroundColor: C.green,
        color: '#ffffff',
        borderRadius: '10px',
        marginTop: '10px'
      },
      btnDanger: {
        backgroundColor: C.red,
        color: '#ffffff',
        borderRadius: '10px',
        marginTop: '10px'
      },
      logBox: {
        backgroundColor: '#121214',
        borderRadius: '8px',
        padding: '10px',
        marginTop: '8px',
        borderWidth: '1px',
        borderColor: '#2c2c2e'
      },
      logText: {
        color: '#a0a0a5',
        fontSize: '11px',
        lineHeight: '16px',
        fontFamily: 'monospace'
      }
    };

    AppSettingsPage({
      build(props) {
        try {
          const store = props && props.settingsStorage;
          const get = (k, def = '') => {
            if (!store) return def;
            try {
              const v = store.getItem(k);
              return (v !== undefined && v !== null && v !== '') ? v : def;
            } catch (e) {
              return def;
            }
          };
          const set = (k, v) => {
            if (store) {
              try {
                store.setItem(k, String(v));
              } catch (e) {}
            }
          };

          const parseBool = (v) => {
            if (v && typeof v === 'object') {
              if ('value' in v) return Boolean(v.value);
              if ('checked' in v) return Boolean(v.checked);
            }
            return v === true || v === 'true' || v === 1 || v === '1';
          };
          const parseStr = (v) => {
            if (v && typeof v === 'object' && 'value' in v) return String(v.value);
            return String(v !== undefined && v !== null ? v : '');
          };

          const serverUrl = get('server_url', 'http://127.0.0.1:29863/');
          const rawLogging = get('network_logging', 'false');
          const loggingOn = rawLogging === 'true' || rawLogging === true || rawLogging === '1';
          const webhookUrl = get('webhook_url', 'http://127.0.0.1:29863/save_logs');

          let logsSnippet = 'Нет логов / No logs';
          if (store) {
            try {
              const rawLogs = store.getItem('recent_logs');
              if (rawLogs) {
                const lines = String(rawLogs).trim().split('\n');
                logsSnippet = lines.slice(-15).join('\n');
              }
            } catch (eLogs) {}
          }
          if (!logsSnippet || !logsSnippet.trim()) {
            logsSnippet = 'Нет логов / No logs';
          }

          return View({ style: S.page }, [
            // Card 1: Data Source
            View({ style: S.card }, [
              Text({ style: S.h1 }, ['Источник данных (xDrip / WatchDrip)']),
              Text({ style: S.caption }, ['URL локального веб-сервера на смартфоне:']),
              View({ style: S.field }, [
                TextInput({
                  label: 'Server URL',
                  settingsKey: 'server_url',
                  placeholder: 'http://127.0.0.1:29863/',
                  value: serverUrl,
                  onChange: (v) => set('server_url', parseStr(v)),
                  labelStyle: S.fieldLabel,
                  subStyle: S.fieldValue
                })
              ])
            ]),

            // Card 2: Background Engine Info
            View({ style: S.card }, [
              Text({ style: S.h1 }, ['Фоновое обновление / Background Engine']),
              Text({ style: S.caption }, ['Режим: Time.onPerMinute() + Screen Wake']),
              Text({ style: { color: C.green, fontSize: '13px', lineHeight: '18px' } }, [
                '• Фоновые тики каждую минуту через аппаратный RTC\n• Мгновенный опрос при активации экрана (onResume в виджете и циферблате)'
              ])
            ]),

            // Card 3: Network Logging
            View({ style: S.card }, [
              Text({ style: S.h1 }, ['Логирование сети (Network Logging)']),
              Text({ style: S.caption }, ['Запись диагностических логов сетевых запросов и BLE пакетов:']),
              View({ style: S.row }, [
                Text({ style: { color: C.text, fontSize: '15px' } }, ['Запись логов: ' + (loggingOn ? 'ВКЛ' : 'ВЫКЛ')]),
                Toggle({
                  settingsKey: 'network_logging',
                  value: loggingOn,
                  onChange: (v) => set('network_logging', parseBool(v) ? 'true' : 'false')
                })
              ]),
              View({ style: S.field }, [
                TextInput({
                  label: 'Webhook URL (для выгрузки логов)',
                  settingsKey: 'webhook_url',
                  placeholder: 'http://127.0.0.1:29863/save_logs',
                  value: webhookUrl,
                  onChange: (v) => set('webhook_url', parseStr(v)),
                  labelStyle: S.fieldLabel,
                  subStyle: S.fieldValue
                })
              ])
            ]),

            // Card 4: Log Management
            View({ style: S.card }, [
              Text({ style: S.h1 }, ['Управление логами и диагностика']),
              Button({
                label: 'Отправить логи на Webhook',
                style: S.btnSuccess,
                onClick: () => {
                  set('trigger_upload', Date.now());
                }
              }),
              Button({
                label: 'Очистить логи (Clear Logs)',
                style: S.btnDanger,
                onClick: () => {
                  set('recent_logs', '');
                  set('trigger_clear', Date.now());
                }
              })
            ]),

            // Card 5: Recent Logs Viewer
            View({ style: S.card }, [
              Text({ style: S.h1 }, ['Последние события / Recent Logs']),
              Text({ style: S.caption }, ['Последние 15 строк буфера логов:']),
              View({ style: S.logBox }, [
                Text({ paragraph: true, style: S.logText }, [logsSnippet])
              ]),
              Button({
                label: 'Обновить просмотр логов',
                style: S.btnPrimary,
                onClick: () => {
                  set('_refresh', Date.now());
                }
              })
            ])
          ]);
        } catch (err) {
          console.log('AppSettingsPage build error: ' + err);
          return View({ style: { flex: 1, padding: '16px', backgroundColor: '#000000' } }, [
            View({ style: { backgroundColor: '#1c1c1e', borderRadius: '12px', padding: '16px' } }, [
              Text({ style: { color: '#ff453a', fontSize: '16px', fontWeight: 'bold' } }, ['Ошибка рендеринга настроек']),
              Text({ style: { color: '#8e8e93', fontSize: '13px', marginTop: '8px' } }, [String(err && (err.stack || err.message || err))])
            ])
          ]);
        }
      }
    });
  })();
} catch (e) {
  console.log('AppSettingsPage fatal: ' + e);
}
