import {MessageBuilder} from "../shared/message";
import {Commands, SERVER_INFO_URL, SERVER_PUT_TREATMENTS_URL, SERVER_URL,} from "../utils/config/constants";

// const logger = DeviceRuntimeCore.HmLogger.getLogger("watchdrip_side");
const messageBuilder = new MessageBuilder();

// Логирование сети
let logBuffer = [];
const addLog = (type, message) => {
    let networkLogging = false;
    try {
        if (typeof settings !== 'undefined' && settings.settingsStorage) {
            const flag = settings.settingsStorage.getItem('network_logging');
            if (flag === 'true' || flag === true) networkLogging = true;
        }
    } catch(e) {}
    
    if (!networkLogging) return;
    
    const time = new Date().toISOString();
    const logStr = `[${time}] [${type}] ${message}`;
    console.log(logStr);
    logBuffer.push(logStr);
    
    // Ограничиваем буфер
    if (logBuffer.length > 30) logBuffer = logBuffer.slice(-30);
    
    // Обновляем последние 20 событий для UI "Просмотр логов"
    try {
        if (typeof settings !== 'undefined' && settings.settingsStorage) {
            const recent = logBuffer.slice(-20).join('\n');
            settings.settingsStorage.setItem('recent_logs', recent);
        }
    } catch (e) {}
};

const getSettingsStorage = () => {
    try {
        if (typeof settings !== 'undefined' && settings.settingsStorage) {
            return settings.settingsStorage;
        }
    } catch (e) {}
    return null;
};

const getServerUrl = () => {
    const storage = getSettingsStorage();
    let url = storage && storage.getItem('server_url');
    if (!url) {
        url = SERVER_URL;
    }
    return url.endsWith('/') ? url : url + '/';
};

// Функция для получения информации с сервера с таймаутом
const requestInfo = async (url) => {
    addLog("WATCH_REQ", `GET_INFO requested for url: ${url}`);
    addLog("FETCH_REQ", `Sending GET to ${url}`);

    const fetchPromise = fetch({
        url: url,
        method: "GET",
    });

    const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error("Request timed out after 5 seconds")), 5000);
    });

    return Promise.race([fetchPromise, timeoutPromise])
        .then((response) => {
            if (!response.body) throw Error('No Data');
            return response.body;
        })
        .then((data) => {
            try {
                addLog("FETCH_RES", `Success. Response length: ${JSON.stringify(data).length}`);
                console.log("log", data);
                return data;
            } catch (error) {
                throw Error(error.message);
            }
        })
        .catch(function (error) {
            addLog("FETCH_ERR", `Error: ${error.message || error}`);
            console.log("fetchInfo error", error);
            return {error: true, message: error.message};
        });
};

const fetchInfo = async (ctx, url) => {
    const resp = await requestInfo(url);
    const jsonResp = {data: {result: resp}};
    if (ctx && typeof ctx.response === 'function') {
        ctx.response(jsonResp);
    }
    return jsonResp;
};

const sendToWatch = async () => {
    console.log("log", "sendToWatch");
    const result = await fetchInfo(false, getServerUrl() + SERVER_INFO_URL);
    messageBuilder.call(result);
};

const fetchRaw = async (ctx, url) => {
    addLog("WATCH_REQ", `GET_RAW requested for url: ${url}`);
    try {
        const fetchPromise = fetch({
            url: url,
            method: "GET",
        });
        const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error("Timeout 5s")), 5000);
        });

        const {body: data} = await Promise.race([fetchPromise, timeoutPromise]);
        
        addLog("FETCH_RES", `GET_RAW Success`);
        console.log("log", data);
        ctx.response({
            data: {result: data},
        });
    } catch (error) {
        addLog("FETCH_ERR", `GET_RAW Error: ${error.message}`);
        ctx.response({
            data: {result: "ERROR"},
        });
    }
};

AppSideService({
    onInit() {
        messageBuilder.listen(() => {});

        try {
            if (typeof settings !== 'undefined' && settings.settingsStorage) {
                settings.settingsStorage.addListener('change', async ({ key, newValue, oldValue }) => {
                    if (key === 'trigger_clear') {
                        logBuffer = [];
                        settings.settingsStorage.setItem('recent_logs', 'Logs cleared.');
                    } else if (key === 'trigger_upload') {
                        const uploadUrl = settings.settingsStorage.getItem('webhook_url') || 'http://127.0.0.1:29863/save_logs';
                        const logsTxt = logBuffer.join('\n');
                        console.log("Uploading logs to", uploadUrl);
                        try {
                            await fetch({
                                url: uploadUrl,
                                method: "POST",
                                headers: { "Content-Type": "text/plain" },
                                body: logsTxt || "No logs"
                            });
                            console.log("Logs uploaded successfully");
                        } catch(e) {
                            console.log("Failed to upload logs", e);
                        }
                    }
                });
            }
        } catch(e) {
            console.log("Failed to bind settings listener", e);
        }

        messageBuilder.on("request", (ctx) => {
            const jsonRpc = messageBuilder.buf2Json(ctx.request.payload);
            const {params = {}} = jsonRpc;
            let url = getServerUrl();
            switch (jsonRpc.method) {
                case Commands.getInfo:
                    return fetchInfo(ctx, url + SERVER_INFO_URL + "?" + params);
                case Commands.getImg:
                    return fetchRaw(ctx, url + "get_img.php?" + params);
                case Commands.putTreatment:
                    return fetchRaw(ctx, url + SERVER_PUT_TREATMENTS_URL + "?" + params);
                default:
                    break;
            }
        });
    },

    onRun() {},
    onDestroy() {},
});
