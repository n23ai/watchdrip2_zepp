import { 
  writeFileSync, 
  readFileSync, 
  statSync, 
  mkdirSync, 
  readdirSync, 
  rmSync, 
  renameSync,
  openSync,
  readSync,
  writeSync,
  closeSync,
  O_RDONLY,
  O_WRONLY,
  O_CREAT
} from '@zos/fs'
import { getDeviceInfo } from '@zos/device'
import { getPackageInfo } from '@zos/app'

export const isMiBand7 = false;

export class Path {
    constructor(scope, path, appid = 0) {
        this.localFS = true;
        // Simplify for Zepp OS 3.0+
        if (!path.startsWith('data://') && path.includes('/')) {
            path = path.substring(path.lastIndexOf('/') + 1);
        }
        scope = "data";

        this.scope = scope;
        this.path = path;
        this.appid = appid;

        this.relativePath = path;
        this.absolutePath = FsTools.fullDataPath(path);
    }

    get(path) {
        const newPath = this.path === "/" ? path : `${this.path}/${path}`;
        return new Path(this.scope, newPath);
    }

    resolve() {
        return new Path("full", this.absolutePath);
    }

    src() {
        return this.relativePath;
    }

    stat() {
        try {
            return statSync({ path: this.relativePath });
        } catch (e) {
            return undefined;
        }
    }

    size() {
        const st = this.stat();
        if (st && st.size) {
            return st.size;
        }
        return 0;
    }

    open(flags) {
        // Map old hmFS flags if they were numbers
        let zFlags = flags;
        if (flags === 1) zFlags = O_RDONLY;
        else if (flags === 2) zFlags = O_WRONLY;
        else if (flags === 4) zFlags = O_CREAT;

        this._f = openSync({
            path: this.relativePath,
            flag: zFlags
        });
        return this._f;
    }

    remove() {
        try {
            rmSync({ path: this.relativePath });
            return true;
        } catch (e) {
            return false;
        }
    }

    removeTree() {
        this.remove();
    }

    fetch(limit = Infinity) {
        let fd = null;
        try {
            fd = openSync({ path: this.relativePath, flag: O_RDONLY });
            if (fd !== undefined && fd !== null && Number(fd) >= 0) {
                const buf = new ArrayBuffer(16384);
                let bytesRead = 0;
                try {
                    bytesRead = readSync({ fd: Number(fd), buffer: buf });
                } catch (eR1) {
                    try {
                        bytesRead = readSync({ fd: fd, buffer: buf });
                    } catch (eR2) {
                        bytesRead = 0;
                    }
                }
                try { closeSync({ fd: Number(fd) }); } catch (c1) {
                    try { closeSync({ fd: fd }); } catch (c2) {}
                }
                fd = null;
                const numBytes = Number(bytesRead);
                if (!isNaN(numBytes) && numBytes > 0) {
                    return buf.slice(0, numBytes);
                }
            }
        } catch (eOpen) {
            if (fd !== null && fd !== undefined && Number(fd) >= 0) {
                try { closeSync({ fd: Number(fd) }); } catch (c) {}
            }
        }

        try {
            return readFileSync({
                path: this.relativePath
            });
        } catch (e) {
            return null;
        }
    }

    fetchText(limit = Infinity) {
        // 1. Primary: openSync + readSync into ArrayBuffer (fast & reliable on Zepp OS 3+/4+)
        const pathCandidates = [
            this.relativePath,
            'data://' + this.relativePath,
            { path: this.relativePath, flag: O_RDONLY, options: { appId: 43107 } },
            { path: 'data://' + this.relativePath, flag: O_RDONLY, options: { appId: 43107 } }
        ];

        for (let i = 0; i < pathCandidates.length; i++) {
            const cand = pathCandidates[i];
            let fd = null;
            try {
                if (typeof cand === 'object') {
                    fd = openSync(cand);
                } else {
                    fd = openSync({ path: cand, flag: O_RDONLY });
                }
                if (fd !== undefined && fd !== null && Number(fd) >= 0) {
                    const buf = new ArrayBuffer(16384);
                    let bytesRead = 0;
                    try {
                        bytesRead = readSync({ fd: Number(fd), buffer: buf });
                    } catch (eR1) {
                        try {
                            bytesRead = readSync({ fd: fd, buffer: buf });
                        } catch (eR2) {
                            bytesRead = 0;
                        }
                    }
                    try { closeSync({ fd: Number(fd) }); } catch (c1) {
                        try { closeSync({ fd: fd }); } catch (c2) {}
                    }
                    fd = null;

                    const numBytes = Number(bytesRead);
                    if (!isNaN(numBytes) && numBytes > 0) {
                        const u8 = new Uint8Array(buf, 0, numBytes);
                        const str = FsTools.decodeUtf8(u8, numBytes);
                        if (str && str.length > 0) {
                            return str;
                        }
                    }
                }
            } catch (eOpen) {
                if (fd !== null && fd !== undefined && Number(fd) >= 0) {
                    try { closeSync({ fd: Number(fd) }); } catch (c) {}
                }
            }
        }

        // 2. Fallback: readFileSync raw buffer
        try {
            const raw = readFileSync({ path: this.relativePath });
            if (typeof raw === 'string' && raw.length > 0) {
                return raw;
            }
            if (raw && (raw instanceof ArrayBuffer || raw.byteLength !== undefined)) {
                const u8 = new Uint8Array(raw);
                const str = FsTools.decodeUtf8(u8, u8.length);
                if (str && str.length > 0) {
                    return str;
                }
            }
        } catch (eRaw) {}

        // 3. Fallback: readFileSync with utf8 encoding option
        try {
            const res = readFileSync({
                path: this.relativePath,
                options: { encoding: 'utf8' }
            });
            if (typeof res === 'string' && res.length > 0) {
                return res;
            }
        } catch (eRes) {}

        return null;
    }

    fetchJSON() {
        return this.fetchJSONResult().data;
    }

    fetchJSONResult() {
        let text = this.fetchText();
        if (!text) return { data: null, reason: 'missing' };
        try {
            let data = typeof text === 'string' ? JSON.parse(text) : text;
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            return { data: data, reason: '' };
        } catch (e) {
            return { data: null, reason: 'invalid_json' };
        }
    }

    override(buffer) {
        try {
            writeFileSync({
                path: this.relativePath,
                data: buffer
            });
            return true;
        } catch (e) {
            console.log("override error", e);
            return false;
        }
    }

    overrideWithText(text) {
        if (typeof text !== 'string') {
            text = String(text !== undefined && text !== null ? text : '');
        }
        try {
            const buf = FsTools.str2ab(text);
            const tmpPath = this.relativePath + '.tmp';
            
            // 1. Write to temporary file as binary ArrayBuffer
            writeFileSync({
                path: tmpPath,
                data: buf
            });
            
            // 2. Verify temporary file was written
            const st = statSync({ path: tmpPath });
            const writtenSize = st ? st.size : 0;
            console.log('[PATH overrideWithText] tmp=' + tmpPath + ' target=' + this.relativePath + ' bufLen=' + buf.byteLength + ' stat_size=' + writtenSize);
            
            if (writtenSize > 0 || buf.byteLength === 0) {
                try {
                    rmSync({ path: this.relativePath });
                } catch (eRm) {}
                const renRes = renameSync({
                    oldPath: tmpPath,
                    newPath: this.relativePath
                });
                console.log('[PATH overrideWithText] renameSync=' + renRes);
                return true;
            } else {
                console.log('[PATH overrideWithText] tmp size 0, writing directly');
                writeFileSync({
                    path: this.relativePath,
                    data: buf
                });
                return true;
            }
        } catch (e) {
            console.log('[PATH overrideWithText error] ' + e);
            try {
                const buf = FsTools.str2ab(text);
                writeFileSync({
                    path: this.relativePath,
                    data: buf
                });
                return true;
            } catch (e2) {
                console.log('[PATH overrideWithText direct error] ' + e2);
                return false;
            }
        }
    }

    overrideWithJSON(data) {
        if (typeof data === 'string') {
            return this.overrideWithText(data);
        }
        return this.overrideWithText(JSON.stringify(data));
    }

    copy(destEntry) {
        const buf = this.fetch();
        destEntry.override(buf);
    }

    copyTree(destEntry, move = false) {
        this.copy(destEntry);
        if (move) this.removeTree();
    }

    isFile() {
        return !!this.stat();
    }

    isFolder() {
        return false;
    }

    exists() {
        return !!this.stat();
    }

    list() {
        try {
            return [readdirSync({ path: this.relativePath }), 0];
        } catch (e) {
            return [[], -1];
        }
    }

    mkdir() {
        try {
            mkdirSync({ path: this.relativePath });
            return 0;
        } catch (e) {
            return -1;
        }
    }

    seek(val) {
        // No native seekSync wrapper needed if we don't do low-level chunked reads
    }

    read(buffer, offset, length) {
        return readSync({
            fd: this._f,
            buffer: buffer,
            options: { offset, length }
        });
    }

    write(buffer, offset, length) {
        writeSync({
            fd: this._f,
            buffer: buffer,
            options: { offset, length }
        });
    }

    close() {
        closeSync({ fd: this._f });
    }
}

export class FsTools {
    static getAppLocation() {
        const packageInfo = getPackageInfo();
        const idn = packageInfo.appId.toString(16).padStart(8, "0").toUpperCase();
        return [`js_${packageInfo.type}s`, idn];
    }

    static fullAssetPath(path) {
        const [base, idn] = FsTools.getAppLocation();
        return `/storage/${base}/${idn}/assets${path}`;
    }

    static fullDataPath(path) {
        const [base, idn] = FsTools.getAppLocation();
        return `/storage/${base}/data/${idn}${path}`;
    }

    static decodeUtf8(uint8, len) {
        if (!uint8 || len <= 0) return '';
        let out = '';
        let i = 0;
        while (i < len) {
            const c = uint8[i++];
            if (c < 0x80) {
                out += String.fromCharCode(c);
            } else if (c > 0xbf && c < 0xe0) {
                if (i >= len) break;
                const c2 = uint8[i++];
                out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
            } else if (c > 0xdf && c < 0xf0) {
                if (i + 1 >= len) break;
                const c2 = uint8[i++];
                const c3 = uint8[i++];
                out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
            } else if (c > 0xef && c < 0xf8) {
                if (i + 2 >= len) break;
                const c2 = uint8[i++];
                const c3 = uint8[i++];
                const c4 = uint8[i++];
                let u = (((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f)) - 0x10000;
                out += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
            } else {
                out += String.fromCharCode(c);
            }
        }
        return out;
    }

    static ab2str(buf) {
        if (!buf) return '';
        const uint8 = new Uint8Array(buf);
        return FsTools.decodeUtf8(uint8, uint8.length);
    }

    static str2ab(str) {
        if (!str) return new ArrayBuffer(0);
        let utf8 = [];
        for (let i = 0; i < str.length; i++) {
            let charcode = str.charCodeAt(i);
            if (charcode < 0x80) utf8.push(charcode);
            else if (charcode < 0x800) {
                utf8.push(0xc0 | (charcode >> 6), 
                          0x80 | (charcode & 0x3f));
            }
            else if (charcode < 0xd800 || charcode >= 0xe000) {
                utf8.push(0xe0 | (charcode >> 12), 
                          0x80 | ((charcode >> 6) & 0x3f), 
                          0x80 | (charcode & 0x3f));
            }
            else {
                i++;
                charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                utf8.push(0xf0 | (charcode >> 18), 
                          0x80 | ((charcode >> 12) & 0x3f), 
                          0x80 | ((charcode >> 6) & 0x3f), 
                          0x80 | (charcode & 0x3f));
            }
        }
        const buf = new ArrayBuffer(utf8.length);
        const bufView = new Uint8Array(buf);
        for (let i = 0; i < utf8.length; i++) {
            bufView[i] = utf8[i];
        }
        return buf;
    }
}
