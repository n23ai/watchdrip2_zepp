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

const deviceID = getDeviceInfo().deviceName;
export const isMiBand7 = false;

export class Path {
    constructor(scope, path, appid = 0) {
        this.localFS = true;
        // Simplify for Zepp OS 3.0+
        if (path.includes('/')) {
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
            return readFileSync({
                path: this.relativePath,
                options: { encoding: 'utf8' }
            });
        } catch (e) {
            return null;
        }
    }

    fetchJSON() {
        const text = this.fetchText();
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch (e) {
            console.log('cannot parse json');
            return null;
        }
    }

    override(buffer) {
        try {
            writeFileSync({
                path: this.relativePath,
                data: buffer
            });
        } catch (e) {
            console.log("override error", e);
        }
    }

    overrideWithText(text) {
        try {
            writeFileSync({
                path: this.relativePath,
                data: text,
                options: { encoding: 'utf8' }
            });
        } catch (e) {
            console.log("overrideWithText error", e);
        }
    }

    overrideWithJSON(data) {
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
        return String.fromCharCode.apply(null, new Uint8Array(buf));
    }

    static str2ab(str) {
        var buf = new ArrayBuffer(str.length)
        var bufView = new Uint8Array(buf)
        for (var i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i)
        }
        return buf
    }
}