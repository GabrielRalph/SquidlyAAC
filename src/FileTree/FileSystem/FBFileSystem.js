import { FirebaseFrame } from "../../Firebase/firebase-frame.js";
import { FileSystem, FStats } from "./FileSystem.js";
/**
 * @typedef {Object} FileDescriptor
 * @property {boolean} isDirectory - Indicates if the descriptor represents a directory.
 * @property {?string} [fileID] - Indicates if the descriptor represents a file.
 * @property {number} [dateCreated] - The timestamp when the file or directory was created.
 * @property {number} [lastUpdated] - The timestamp when the file or directory was last updated.
 */

const P2K_REPLACERS = [
    [/\//g, "~0~"],
    [/\./g, "~1~"],
    [/#/g,  "~2~"],
    [/\$/g, "~3~"],
    [/\[/g, "~4~"],
    [/\]/g, "~5~"],
]

const K2P_REPLACES = [
    [/~0~/g, "/"],
    [/~1~/g, "."],
    [/~2~/g, "#"],
    [/~3~/g, "$"],
    [/~4~/g, "["],
    [/~5~/g, "]"],
]

function path2key(path) {
    if (/~\[0-5]+~/.test(path)) {
        throw new Error("File paths cannot contain the sequence ~[0-5]+~ as it is reserved for escaping special characters.");
    }
    for (const [regex, repl] of P2K_REPLACERS) {
        path = path.replace(regex, repl);
    }
    return path;
}

function key2path(key) {
    let path = key;
    for (const [reg, val] of K2P_REPLACES) {
        path = path.replace(reg, val);
    }
    return path;
}

/**
 * @template {FStats} T
 * @extends {FileSystem<T>}
 * @classdesc A file system that interacts with Firebase Realtime Database.
 */
export class FBFileSystem extends FileSystem {
     /** @type {FirebaseFrame} */
    #frame = null;
    #changedKeySet = {};
    #changedKeySetTimeout = false;

    /**
     * @param {string} ref The Firebase reference path for the file system.
     * @param {new (path: string, contents: any, dirOverride: boolean) => T} fstatClass The class to use for file statistics.
     * @constructor
     */
    constructor(ref, fstatClass = FStats) {
        super(fstatClass);
        this.#frame = new FirebaseFrame(ref);
    }


    get frame() {
        return this.#frame;
    }


    _deleteFile(path) {
        let isChanged = super._deleteFile(path);
        if (isChanged) {
            this.#setPath(path, null);
        }
    }

    _set(path, value, commitHistory = true) {
        let isChanged = super._set(path, value, commitHistory);
        if (isChanged) {
            this.#setPath(path, value);
        }
    }

    #setPath(path, value) {
        let key = path2key(path.toString());
        this.#changedKeySet[key] = value;
        if (!this.#changedKeySetTimeout) {
            this.#changedKeySetTimeout = true;
            window.requestAnimationFrame(() => {
                let changedKeySet = this.#changedKeySet;
                console.log("Updating: ", Object.keys(changedKeySet).length, "keys");
                this.#changedKeySet = {};
                this.#changedKeySetTimeout = false;
                this.frame.update(null, changedKeySet);
            })
        }
    }

    #updateKey(key, value, triggerUpdate = true) {
        let path = key2path(key);
        let change = super._set(path, value);
        if (triggerUpdate && change) {
            this._onUpdate();
            this._commitHistory();
        }
    }

    async watch() {
        let state = await this.frame.get() || {}
        Object.entries(state)
            .forEach(([k, v]) => this.#updateKey(k, v, false));
        this._discardCurrentHistory();
        this._onUpdate();

        this.frame.onChildAdded(null, (v, k) => this.#updateKey(k, v));
        this.frame.onChildRemoved(null, (v, k) => this.#updateKey(k, null));
        this.frame.onChildChanged(null, (v, k) => this.#updateKey(k, v));
    }
    
    stopWatch() {
        this.frame.close();
    }

}
