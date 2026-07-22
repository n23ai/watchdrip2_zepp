import {BgData} from "./model/bgData";
import {StatusData} from "./model/statusData";
import {MINUTE_IN_MS, niceTime} from "../../shared/date";
import {TreatmentData} from "./model/treatmentData";
import {PumpData} from "./model/pumpData";

const BG_STALE_TIME_MS = 13 * MINUTE_IN_MS;

export class WatchdripData {
    constructor(timeSensor) {
        this.timeSensor = timeSensor;
        /** @var BgData $object */
        this.bg = BgData.createEmpty();
        /** @var StatusData $object */
        this.status = StatusData.createEmpty();
        /** @var TreatmentData $object */
        this.treatment = TreatmentData.createEmpty();
        /** @var PumpData $object */
        this.pump = PumpData.createEmpty();
        this.graph = null;
        /* defines the difference in time between phone and watch*/
        this.timeDiff = 0;
    }

    updateTimeDiff() {
        if (this.getStatus().now == null) {
            this.timeDiff = 0;
        } else {
            this.timeDiff = this.timeSensor.getTime() - this.getStatus().now;
        }
    }

    setData(data) {
        this.graph = data && data.graph && typeof data.graph === 'object' ? data.graph : null;
        if (data['bg'] === undefined) {
            this.bg = BgData.createEmpty();
        } else {
            this.bg = Object.assign(BgData.prototype, data['bg']);
        }

        if (data['status'] === undefined) {
            this.status = StatusData.createEmpty();
        } else {
            this.status = Object.assign(StatusData.prototype, data['status']);
        }
        if (data['treatment'] === undefined) {
            this.treatment = TreatmentData.createEmpty();
        } else {
            this.treatment = Object.assign(TreatmentData.prototype, data['treatment']);
        }
        if (data['pump'] === undefined) {
            this.pump = PumpData.createEmpty();
        } else {
            this.pump = Object.assign(PumpData.prototype, data['pump']);
        }
    }

    /** @return BgData $object */
    getBg() {
        return this.bg;
    }

    /** @return StatusData $object */
    getStatus() {
        return this.status;
    }

    /** @return TreatmentData $object */
    getTreatment() {
        return this.treatment;
    }

    /** @return PumpData $object */
    getPump() {
        return this.pump;
    }

    getGraph() {
        return this.graph;
    }

    isBgStale() {
        return this.getBgStaleReasons().length > 0;
    }

    getBgAgeMs(time = this.getBg().time) {
        if (time == null || time === '') return null;
        const timeInt = Number(time);
        if (!Number.isFinite(timeInt)) return null;

        const now = Number(this.timeSensor.getTime());
        const clockDiff = Number.isFinite(this.timeDiff) ? this.timeDiff : 0;
        if (!Number.isFinite(now)) return null;

        // A future timestamp can occur briefly when phone and watch clocks
        // move in different directions. It is still a fresh reading, not a
        // negative age to pass to the formatter.
        return Math.max(0, now - timeInt - clockDiff);
    }

    getBgStaleReasons() {
        if (!this.getBg().isHasData()) return [];
        const reasons = [];
        if (this.getBg().isStale === true) reasons.push('server');
        const age = this.getBgAgeMs();
        if (age !== null && age > BG_STALE_TIME_MS) reasons.push('local');
        return reasons;
    }

    getTimeAgo(time) {
        const age = this.getBgAgeMs(time);
        if (age === null) return "";
        return niceTime(age);
    }
}
