import { zeroPad } from "./date";
import { DEBUG_TEXT } from "../utils/config/styles";
import { createWidget, widget as zosWidget, prop } from "@zos/ui";
import { Time } from "@zos/sensor";
import { getScene, SCENE_AOD } from "@zos/app";
import { log as zosLog } from "@zos/utils";

export class DebugText {
    constructor() {
        this.t = new Time();
        this.debugTextText = "";
        this.widget = createWidget(zosWidget.TEXT, DEBUG_TEXT);
        this.lines = 0;
        this.enabled = false;

        let loggerName = "watchdrip_app";
        if (getScene() === SCENE_AOD) {
            loggerName = loggerName + "-aod";
        }
        this.logger = zosLog.getLogger(loggerName);
    }

    setLines(lines) {
        this.lines = lines;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.clean();
        }
    }

    log(text) {
        let formatted = DebugText.objToString(text);
        this.logger.log(formatted);
        if (!this.enabled) {
            this.debugTextText = "";
            return;
        }
        this.debugTextText +=
            this.getTime() + ":" + formatted + "\r\n";
        var lines = this.debugTextText.split("\r\n");
        if (this.lines !== 0 && lines.length > this.lines) {
            lines.splice(0, lines.length - 1 - this.lines);
        }
        this.debugTextText = lines.join("\r\n");
        this.widget.setProperty(prop.MORE, { text: this.debugTextText });
    }

    getTime() {
        return (
            zeroPad(this.t.getHours()) +
            ":" +
            zeroPad(this.t.getMinutes()) +
            ":" +
            zeroPad(this.t.getSeconds()) +
            "." +
            zeroPad(this.t.getTime() % 1000, 4)
        );
    }

    static objToString(obj, ndeep) {
        if (obj == null) {
            return String(obj);
        }
        switch (typeof obj) {
            case "string":
                return obj;
            case "function":
                return obj.name || obj.toString();
            case "object":
                var indent = Array(ndeep || 1).join(" "),
                    isArray = Array.isArray(obj);
                return (
                    "{["[+isArray] +
                    Object.keys(obj)
                        .map(function (key) {
                            return (
                                "\r\n " +
                                indent +
                                key +
                                ": " +
                                DebugText.objToString(obj[key], (ndeep || 1) + 1)
                            );
                        })
                        .join(",") +
                    "\r\n" +
                    indent +
                    "}]"[+isArray]
                );
            default:
                return obj.toString();
        }
    }

    clean() {
        this.debugTextText = "";
        this.widget.setProperty(prop.MORE, { text: this.debugTextText });
    }
}
