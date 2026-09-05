export const SECOND_IN_MS = 1000;
export const MINUTE_IN_MS = 60000;

export function zeroPad(nr, base = 2) {
    let len = base - String(nr).length + 1;
    return len > 0 ? new Array(len).join("0") + nr : nr;
}

export function DateToHumanString(date) {
    let st =
        date.getHours() +
        ":" +
        zeroPad(date.getMinutes(), 2) +
        ":" +
        zeroPad(date.getSeconds(), 2) +
        " " +
        zeroPad(date.getDate(), 2) +
        "/" +
        zeroPad(date.getMonth() + 1, 2);

    return st;
}

export function getMinutesAgo(msSince) {
    if (msSince == null || msSince < 0) return "now";
    let minutes = Math.floor(msSince / MINUTE_IN_MS);
    if (minutes < 1) return "now";
    if (minutes < 60) return minutes + " " + (minutes === 1 ? "min" : "mins");
    let hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " " + (hours === 1 ? "hour" : "hours");
    let days = Math.floor(hours / 24);
    return days + " " + (days === 1 ? "day" : "days");
}

export function niceTime(t) {
    return getMinutesAgo(t);
}