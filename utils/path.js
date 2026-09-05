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
        try {
            return readFileSync({
                path: this.relativePath
            });
        } catch (e) {
            return null;
        }
    }

    fetchText(limit = Infinity) {
        try {
            const st = this.stat();
            const res = readFileSync({
                path: this.relativePath,
                options: { encoding: 'utf8' }
            });
            console.log('[PATH fetchText] path=' + this.relativePath + ' stat_size=' + (st ? st.size : 'undef') + ' res_type=' + typeof res + ' len=' + (res ? (res.length || res.byteLength) : 0));
            if (typeof res === 'string') {
                return res;
            }
            if (res) {
                return FsTools.ab2str(res);
            }
            return null;
        } catch (e) {
            console.log('[PATH fetchText error] path=' + this.relativePath + ' err=' + e);
            try {
                const raw = readFileSync({
                    path: this.relativePath
                });
                console.log('[PATH fallback] raw_type=' + typeof raw + ' len=' + (raw ? (raw.length || raw.byteLength) : 0));
                if (raw && typeof raw !== 'string') {
                    return FsTools.ab2str(raw);
                }
                return raw || null;
            } catch (e2) {
                console.log('[PATH fallback error] path=' + this.relativePath + ' err=' + e2);
                return null;
            }
        }
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
            text = this.fetchText();
            if (!text) return { data: null, reason: 'missing' };
            try {
                let data = typeof text === 'string' ? JSON.parse(text) : text;
                if (typeof data === 'string') {
                    data = JSON.parse(data);
                }
                return { data: data, reason: '' };
            } catch (err) {
                return { data: null, reason: 'invalid_json' };
            }
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

    static ab2str(buf) {
        if (!buf) return '';
        const uint8 = new Uint8Array(buf);
        const len = uint8.length;
        if (len === 0) return '';
        let result = '';
        const chunkSize = 1024;
        for (let i = 0; i < len; i += chunkSize) {
            const sub = uint8.subarray(i, Math.min(i + chunkSize, len));
            result += String.fromCharCode.apply(null, sub);
        }
        return result;
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
