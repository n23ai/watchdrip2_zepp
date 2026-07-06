import { json2str, str2json } from "./data";
import { 
  writeFileSync as zosWriteFileSync, 
  readFileSync as zosReadFileSync, 
  statSync as zosStatSync, 
  statAssetsSync as zosStatAssetsSync,
  mkdirSync as zosMkdirSync, 
  readdirSync as zosReaddirSync, 
  rmSync as zosRmSync, 
  renameSync as zosRenameSync 
} from '@zos/fs'
import { getPackageInfo } from '@zos/app'
import { log } from '@zos/utils'

const logger = log.getLogger("fs.js");

export function stat(path) {
    if (path.startsWith("/storage")) {
        const statPath = "../../../" + path.substring(9);
        return zosStatAssetsSync({ path: statPath });
    }
    return zosStatSync({ path: path });
}

export function statSync(filename) {
    return stat(filename);
}

export function writeFileSync(filename, data, options) {
    logger.log("writeFileSync begin -->", filename);
    zosWriteFileSync({
        path: filename,
        data: data,
        options: options || { encoding: 'utf8' }
    });
    logger.log("writeFileSync success -->", filename);
}

export function writeRawFileSync(filename, source_buf, options) {
    zosWriteFileSync({
        path: filename,
        data: source_buf,
        options: options
    });
}

export function readFileSync(filename, options) {
    const fs_stat = statSync(filename);
    if (!fs_stat) return undefined;
    
    return zosReadFileSync({
        path: filename,
        options: options || { encoding: 'utf8' }
    });
}

export function unlinkSync(filename) {
    try {
        return zosRmSync({ path: filename });
    } catch (e) {
        return -1;
    }
}

export function renameSync(oldFilename, newFilename) {
    return zosRenameSync({
        oldPath: oldFilename,
        newPath: newFilename
    });
}

export function mkdirSync(path, options) {
    return zosMkdirSync({ path: path });
}

export function readdirSync(path, options) {
    return zosReaddirSync({ path: path });
}

export function getSelfPath() {
    const pkg = getPackageInfo();
    const idn = pkg.appId.toString(16).padStart(8, "0").toUpperCase();
    return "/storage/js_" + pkg.type + "s/" + idn;
}

export function fullPath(path) {
    return getSelfPath() + "/assets/" + path;
}

export function readTextFile(filename) {
    if (!filename.startsWith("/storage")) filename = fullPath(filename);
    return readFileSync(filename);
}

export function writeTextFile(filename, data) {
    if (!filename.startsWith("/storage")) filename = fullPath(filename);
    try {
        unlinkSync(filename);
    } catch (e) {
    }
    writeFileSync(filename, data);
}

export function writeJSON(filename, data) {
    let str = json2str(data);
    writeTextFile(filename, str);
}

export function readJSON(filename) {
    let str = readTextFile(filename);
    if (!str) {
        return false;
    }
    return str2json(str);
}