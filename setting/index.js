import { gettext } from 'i18n'

AppSettingsPage({
  state: {
    network_logging: false,
    server_url: 'http://localhost:29863/',
    webhook_url: 'http://127.0.0.1:29863/save_logs',
    timer_type: 'auto',
    page: 'main', // 'main' or 'logs'
    recentLogs: ''
  },
  
  build(props) {
    this.getStorage(props)
    
    if (this.state.page === 'logs') {
      return this.renderLogsPage(props)
    }
    return this.renderMainPage(props)
  },

  getStorage(props) {
    try {
      const enabled = props.settingsStorage.getItem('network_logging')
      if (enabled !== undefined && enabled !== null) {
        this.state.network_logging = typeof enabled === 'string' ? JSON.parse(enabled) : Boolean(enabled)
      }
      const timerType = props.settingsStorage.getItem('timer_type')
      if (timerType) {
        this.state.timer_type = timerType
      }
      const url = props.settingsStorage.getItem('webhook_url')
      if (url) {
        this.state.webhook_url = url
      }
      const serverUrl = props.settingsStorage.getItem('server_url')
      if (serverUrl) {
        this.state.server_url = serverUrl
      }
      const logs = props.settingsStorage.getItem('recent_logs')
      this.state.recentLogs = logs || 'Нет логов / No logs'
      
      const page = props.settingsStorage.getItem('_nav_page')
      if (page && (page === 'main' || page === 'logs')) {
        this.state.page = page
      }
    } catch (e) {
      console.log('getStorage error: ' + e)
    }
  },

  renderMainPage(props) {
    return View(
      { style: { padding: '10px' } },
      [
        Section(
          { title: 'Источник данных / Data Source' },
          [
            TextInput({
              label: 'WatchDrip/xDrip URL',
              settingsKey: 'server_url',
              value: this.state.server_url,
              subStyle: { color: '#333', fontSize: '14px' },
              onChange: (val) => {
                this.state.server_url = val
                props.settingsStorage.setItem('server_url', val)
              }
            })
          ]
        ),
        Section(
          { title: 'Фоновый таймер / Background Timer' },
          [
            Select({
              label: 'Тип таймера (Timer Engine)',
              settingsKey: 'timer_type',
              value: this.state.timer_type,
              options: [
                { name: 'Авто (Zepp OS 4+ -> SysTimer, 3.x -> onPerMinute)', value: 'auto' },
                { name: 'Time.onPerMinute() (Zepp OS 3.x)', value: 'on_per_minute' },
                { name: 'createSysTimer (Zepp OS 4.0+)', value: 'sys_timer' }
              ],
              onChange: (val) => {
                this.state.timer_type = val
                props.settingsStorage.setItem('timer_type', val)
              }
            }),
            Text({
              style: { color: '#666', fontSize: '12px', marginTop: '6px' }
            }, 'createSysTimer работает в глубоком сне на Zepp OS 4.0+ (Amazfit Balance 2, T-Rex 3, Active 2). На Zepp OS 3.x (Cheetah, Balance 1, Falcon) используется Time.onPerMinute с аппаратным объединением тиков.')
          ]
        ),
        Section(
          { title: 'Логирование сети / Network Logging' },
          [
            Toggle({
              settingsKey: 'network_logging',
              title: 'Включить запись логов (Enable Logging)',
              label: '',
              checked: this.state.network_logging,
              onChange: (val) => {
                this.state.network_logging = val
                props.settingsStorage.setItem('network_logging', JSON.stringify(val))
              }
            }),
            TextInput({
              label: 'Webhook URL (для выгрузки полных логов)',
              settingsKey: 'webhook_url',
              value: this.state.webhook_url,
              subStyle: { color: '#333', fontSize: '14px' },
              onChange: (val) => {
                this.state.webhook_url = val
                props.settingsStorage.setItem('webhook_url', val)
              }
            })
          ]
        ),
        Section(
          { title: 'Управление логами / Log Management' },
          [
            Button({
              label: 'Посмотреть логи (View Logs)',
              style: { marginTop: '10px', background: '#007AFF', color: 'white', borderRadius: '8px' },
              onClick: () => {
                this.state.page = 'logs'
                props.settingsStorage.setItem('_nav_page', 'logs') 
              }
            }),
            Button({
              label: 'Отправить полные логи на сервер',
              style: { marginTop: '10px', background: '#34C759', color: 'white', borderRadius: '8px' },
              onClick: () => {
                props.settingsStorage.setItem('trigger_upload', Date.now().toString())
              }
            }),
            Button({
              label: 'Очистить логи (Clear Logs)',
              style: { marginTop: '10px', background: '#FF3B30', color: 'white', borderRadius: '8px' },
              onClick: () => {
                props.settingsStorage.setItem('trigger_clear', Date.now().toString())
              }
            })
          ]
        )
      ]
    )
  },

  renderLogsPage(props) {
    return View(
      { style: { padding: '10px' } },
      [
        Section({ title: 'Последние события / Recent Logs' }, [
          Text({
            style: { color: '#333', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }
          }, this.state.recentLogs)
        ]),
        Button({
          label: 'Назад (Back)',
          style: { marginTop: '20px', background: '#007AFF', color: 'white', borderRadius: '8px' },
          onClick: () => {
            this.state.page = 'main'
            props.settingsStorage.setItem('_nav_page', 'main')
          }
        })
      ]
    )
  }
})
