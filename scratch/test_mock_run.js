
let pageConfig = null;
global.AppSettingsPage = function(cfg) { pageConfig = cfg; };
global.View = (props, children) => ({ type: "View", props, children });
global.Text = (props, children) => ({ type: "Text", props, children });
global.TextInput = (props) => ({ type: "TextInput", props });
global.Button = (props) => ({ type: "Button", props });

try{(()=>{try{(()=>{const e="#2c2c2e",o="#3a3a3c",t="#ffffff",l="#8e8e93",r="#0a84ff",n="#30d158",i={page:{padding:"14px",backgroundColor:"#000000",display:"flex",flexDirection:"column",minHeight:"100vh",boxSizing:"border-box"},card:{backgroundColor:"#1c1c1e",borderRadius:"14px",padding:"14px",marginBottom:"14px",display:"flex",flexDirection:"column"},h1:{color:t,fontSize:"17px",fontWeight:"700",marginBottom:"4px"},caption:{color:l,fontSize:"13px",lineHeight:"1.4",marginBottom:"8px"},field:{backgroundColor:e,borderRadius:"10px",padding:"8px 12px",marginTop:"8px"},fieldLabel:{color:l,fontSize:"12px"},fieldValue:{color:t,fontSize:"15px"},row:{display:"flex",flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:"8px"},btnPrimary:{backgroundColor:r,color:"#ffffff",borderRadius:"10px",marginTop:"10px"},btnSuccess:{backgroundColor:n,color:"#ffffff",borderRadius:"10px",marginTop:"10px"},btnDanger:{backgroundColor:"#ff453a",color:"#ffffff",borderRadius:"10px",marginTop:"10px"},btnBack:{backgroundColor:e,color:r,borderRadius:"10px",marginBottom:"14px"}};AppSettingsPage({build(e){try{const a=e&&e.settingsStorage,s=(e,o="")=>{if(!a)return o;const t=a.getItem(e);return null!=t&&""!==t?t:o},g=(e,o)=>{a&&a.setItem(e,String(o))};if("logs"===s("_view","main")){const e=s("recent_logs","Нет логов / No logs"),o=String(e).slice(-4e3);return View({style:i.page},[Button({label:"‹  Назад в настройки",style:i.btnBack,onClick:()=>g("_view","main")}),View({style:i.card},[Text({style:i.h1},["Последние события / Recent Logs"]),Text({style:i.caption},["Диагностические логи работы WatchDrip2_zepp:"]),View({style:i.field},[TextInput({label:"Logs",value:o,rows:16,multiline:!0,labelStyle:i.fieldLabel,subStyle:{color:t,fontSize:"11px",fontFamily:"monospace"},onChange:()=>{}})])]),Button({label:"Обновить логи (Refresh)",style:i.btnSuccess,onClick:()=>g("_view","logs")}),Button({label:"Очистить логи (Clear)",style:i.btnDanger,onClick:()=>{g("recent_logs",""),g("trigger_clear",Date.now()),g("_view","logs")}})])}const c=s("server_url","http://localhost:29863/"),p="true"===s("network_logging")||"1"===s("network_logging"),f=s("webhook_url","http://127.0.0.1:29863/save_logs");return View({style:i.page},[View({style:i.card},[Text({style:i.h1},["Источник данных (xDrip / WatchDrip)"]),Text({style:i.caption},["URL локального веб-сервера на смартфоне:"]),View({style:i.field},[TextInput({label:"Server URL",placeholder:"http://localhost:29863/",value:c,onChange:e=>g("server_url",e),labelStyle:i.fieldLabel,subStyle:i.fieldValue})])]),View({style:i.card},[Text({style:i.h1},["Фоновое обновление / Background Engine"]),Text({style:i.caption},["Режим: Time.onPerMinute() + Screen Wake"]),Text({style:{color:n,fontSize:"13px",lineHeight:"1.4"}},["• Фоновые тики каждую минуту через аппаратный RTC\n• Мгновенный опрос при активации экрана (onResume в виджете и циферблате)"])]),View({style:i.card},[Text({style:i.h1},["Логирование сети (Network Logging)"]),Text({style:i.caption},["Запись диагностических логов сетевых запросов и BLE пакетов:"]),View({style:i.row},[Text({style:{color:t,fontSize:"15px"}},["Запись логов"]),(l=p,r=()=>g("network_logging",p?"false":"true"),View({style:{width:"46px",height:"28px",borderRadius:"14px",flexShrink:"0",boxSizing:"border-box",padding:"2px",display:"flex",flexDirection:"row",alignItems:"center",justifyContent:l?"flex-end":"flex-start",backgroundColor:l?n:o},onClick:r},[View({style:{width:"24px",height:"24px",borderRadius:"12px",backgroundColor:"#ffffff"}})]))]),View({style:i.field},[TextInput({label:"Webhook URL (для выгрузки логов)",placeholder:"http://127.0.0.1:29863/save_logs",value:f,onChange:e=>g("webhook_url",e),labelStyle:i.fieldLabel,subStyle:i.fieldValue})])]),View({style:i.card},[Text({style:i.h1},["Управление логами"]),Button({label:"Посмотреть логи (View Logs)",style:i.btnPrimary,onClick:()=>g("_view","logs")}),Button({label:"Отправить логи на Webhook",style:i.btnSuccess,onClick:()=>g("trigger_upload",Date.now())}),Button({label:"Очистить логи (Clear Logs)",style:i.btnDanger,onClick:()=>{g("recent_logs",""),g("trigger_clear",Date.now())}})])])}catch(e){return console.log("AppSettingsPage build error: "+e),View({style:{padding:"16px",backgroundColor:"#000000",minHeight:"100vh"}},[View({style:{backgroundColor:"#1c1c1e",borderRadius:"12px",padding:"16px"}},[Text({style:{color:"#ff453a",fontSize:"16px",fontWeight:"bold"}},["Ошибка рендеринга настроек"]),Text({style:{color:"#8e8e93",fontSize:"13px",marginTop:"8px"}},[String(e&&(e.stack||e.message||e))])])])}var l,r}})})()}catch(e){console.log("AppSettingsPage fatal: "+e)}})()}catch(e){console.log(e)}

if (!pageConfig) {
    console.error("FAIL: AppSettingsPage was not called");
    process.exit(1);
}

const mockStore = {
    data: {},
    getItem(k) { return this.data[k]; },
    setItem(k, v) { this.data[k] = v; }
};

// Test main view
const mainResult = pageConfig.build({ settingsStorage: mockStore });
console.log("MAIN VIEW SUCCESS! Type:", mainResult.type, "Children:", mainResult.children.length);

// Test logs view
mockStore.setItem("_view", "logs");
mockStore.setItem("recent_logs", "Sample Log Line 1");
const logsResult = pageConfig.build({ settingsStorage: mockStore });
console.log("LOGS VIEW SUCCESS! Type:", logsResult.type, "Children:", logsResult.children.length);
