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
        padding: '14px',
        backgroundColor: C.bg,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
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
        lineHeight: '1.4',
        marginBottom: '8px'
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
      row: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '8px'
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
      btnBack: {
        backgroundColor: C.field,
        color: C.accent,
        borderRadius: '10px',
        marginBottom: '14px'
      }
    };

    const toggleView = (on, onClick) => View({
      style: {
        width: '46px',
        height: '28px',
        borderRadius: '14px',
        flexShrink: '0',
        boxSizing: 'border-box',
        padding: '2px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
        backgroundColor: on ? C.green : C.line
      },
      onClick
    }, [View({
      style: {
        width: '24px',
        height: '24px',
        borderRadius: '12px',
        backgroundColor: '#ffffff'
      }
    })]);

    AppSettingsPage({
      build(props) {
        try {
          const store = props && props.settingsStorage;
          const get = (k, def = '') => {
            if (!store) return def;
            const v = store.getItem(k);
            return (v !== undefined && v !== null && v !== '') ? v : def;
          };
          const set = (k, v) => {
            if (store) store.setItem(k, String(v));
          };

          const view = get('_view', 'main');

          // Render Logs View
          if (view === 'logs') {
            const rawLogs = get('recent_logs', 'Нет логов / No logs');
            const logsSnippet = String(rawLogs).slice(-4000);
            return View({ style: S.page }, [
              Button({
                label: '‹  Назад в настройки',
                style: S.btnBack,
                onClick: () => set('_view', 'main')
              }),
              View({ style: S.card }, [
                Text({ style: S.h1 }, ['Последние события / Recent Logs']),
                Text({ style: S.caption }, ['Диагностические логи работы WatchDrip2_zepp:']),
                View({ style: S.field }, [
                  TextInput({
                    label: 'Logs',
                    value: logsSnippet,
                    rows: 16,
                    multiline: true,
                    labelStyle: S.fieldLabel,
                    subStyle: { color: C.text, fontSize: '11px', fontFamily: 'monospace' },
                    onChange: () => {}
                  })
                ])
              ]),
              Button({
                label: 'Обновить логи (Refresh)',
                style: S.btnSuccess,
                onClick: () => set('_view', 'logs')
              }),
              Button({
                label: 'Очистить логи (Clear)',
                style: S.btnDanger,
                onClick: () => {
                  set('recent_logs', '');
                  set('trigger_clear', Date.now());
                  set('_view', 'logs');
                }
              })
            ]);
          }

          // Render Main View
          const serverUrl = get('server_url', 'http://127.0.0.1:29863/');
          const loggingOn = get('network_logging') === 'true' || get('network_logging') === '1';
          const webhookUrl = get('webhook_url', 'http://127.0.0.1:29863/save_logs');

          return View({ style: S.page }, [
            // Card 1: Data Source
            View({ style: S.card }, [
              Text({ style: S.h1 }, ['Источник данных (xDrip / WatchDrip)']),
              Text({ style: S.caption }, ['URL локального веб-сервера на смартфоне:']),
              View({ style: S.field }, [
                TextInput({
                  label: 'Server URL',
                  placeholder: 'http://127.0.0.1:29863/',
                  value: serverUrl,
                  onChange: v => set('server_url', v),
                  labelStyle: S.fieldLabel,
                  subStyle: S.fieldValue
                })
              ])
            ]),

            // Card 2: Background Engine Info
            View({ style: S.card }, [
              Text({ style: S.h1 }, ['Фоновое обновление / Background Engine']),
              Text({ style: S.caption }, ['Режим: Time.onPerMinute() + Screen Wake']),
              Text({ style: { color: C.green, fontSize: '13px', lineHeight: '1.4' } }, [
                '• Фоновые тики каждую минуту через аппаратный RTC\n• Мгновенный опрос при активации экрана (onResume в виджете и циферблате)'
              ])
            ]),

            // Card 3: Network Logging
            View({ style: S.card }, [
              Text({ style: S.h1 }, ['Логирование сети (Network Logging)']),
              Text({ style: S.caption }, ['Запись диагностических логов сетевых запросов и BLE пакетов:']),
              View({ style: S.row }, [
                Text({ style: { color: C.text, fontSize: '15px' } }, ['Запись логов']),
                toggleView(loggingOn, () => set('network_logging', loggingOn ? 'false' : 'true'))
              ]),
              View({ style: S.field }, [
                TextInput({
                  label: 'Webhook URL (для выгрузки логов)',
                  placeholder: 'http://127.0.0.1:29863/save_logs',
                  value: webhookUrl,
                  onChange: v => set('webhook_url', v),
                  labelStyle: S.fieldLabel,
                  subStyle: S.fieldValue
                })
              ])
            ]),

            // Card 4: Log Management
            View({ style: S.card }, [
              Text({ style: S.h1 }, ['Управление логами']),
              Button({
                label: 'Посмотреть логи (View Logs)',
                style: S.btnPrimary,
                onClick: () => set('_view', 'logs')
              }),
              Button({
                label: 'Отправить логи на Webhook',
                style: S.btnSuccess,
                onClick: () => set('trigger_upload', Date.now())
              }),
              Button({
                label: 'Очистить логи (Clear Logs)',
                style: S.btnDanger,
                onClick: () => {
                  set('recent_logs', '');
                  set('trigger_clear', Date.now());
                }
              })
            ])
          ]);
        } catch (err) {
          console.log('AppSettingsPage build error: ' + err);
          return View({ style: { padding: '16px', backgroundColor: '#000000', minHeight: '100vh' } }, [
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


