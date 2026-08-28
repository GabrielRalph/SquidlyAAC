
const POPUP_CACHE = {};
const DEBUG = (new URLSearchParams(window.location.search).get("debug") === "true")

function openCachedPopup(id, url) {
    let openedCached = false;
    if (id in POPUP_CACHE) {
        const popup = POPUP_CACHE[id];
        if (!popup.closed) {
            popup.focus();
            openedCached = true;
        }
    }

    if (!openedCached) {
        const popup = window.open(url, id);
        POPUP_CACHE[id] = popup;
    }
}


function openWindow(name, board, other, extraKey = "") {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.delete("tab");
    if (board) {
        urlParams.set("board", board);
    }
    if (other && typeof other === "object") {
        for (let key in other) {
            urlParams.set(key, other[key]);
        }
    }
    const popupID = `${name}-${board}${extraKey}`;
    const url = `../${name}/?${urlParams.toString()}`;
    openCachedPopup(popupID, url);
}

function openEditor(board) {
    openWindow("Editor", board);
}

function openNewEditor() {
    let randomID = Math.random().toString(36).substring(2, 10);
    let urlParams = new URLSearchParams(window.location.search);
    urlParams.delete("board");
    urlParams.delete("tab");
    let paramsString = urlParams.toString();
    if (paramsString) {
        paramsString = `?${paramsString}`;
    }
    openCachedPopup(`Editor-${randomID}`, `../Editor/${paramsString}`);
}

function openViewer(board) {
    openWindow("View", board);
} 

function getViewerURL(board) {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set("board", board);

    const url = new URL(window.location.href);
    url.pathname = "/View/";
    url.search = urlParams.toString();
    return url.toString();
}

function openDraftPreview(board) {
    openWindow("View", board, {mode: "preview-draft"}, "-draft");
}

function openFiles() {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.delete("board");
    urlParams.set("tab", "finder");
    const url = `../?${urlParams.toString()}`
    openCachedPopup("files", url);
}


class Debugger {
    constructor(name, style = "background: #b43113; color: white; padding: 5px; border-radius: 5px;") {
        this.name = name;
        this.style = style;
        this.times = {}
    }

    tic(log) {
        this.times[log] = performance.now();
    }

    toc(log, extraInfo = "") {
        const end = performance.now();
        const duration = end - (this.times[log] || end);
        extraInfo = extraInfo ? ` ${extraInfo}` : "";
        this.logBasic(`${log}${extraInfo}: ${Debugger.fTime(duration)}`);
        return duration;
    }

    logStart(mode, info, ...args) {
        if (DEBUG && !this.disable) {
            console.groupCollapsed(`%c${this.name}: ${mode}`, this.style, info);
            if (args.length > 0) {
                console.log(...args);
            }
        }
    }

    logBasic(...args) {
        if (DEBUG && !this.disable) {
            console.log(`%c${this.name}:`, this.style, ...args);
        }
    }

    logEnd() {
        if (DEBUG && !this.disable) console.groupEnd();
    }

    log(mode, info, ...args) {
        if (DEBUG && !this.disable) {
            this.logStart(mode, info);
            let error = new Error();
            let stack = error.stack.split("\n").slice(2).join("\n");
            args.forEach(arg => console.log(arg));
            console.log(stack);
            this.logEnd();
        }
    }

    static fTime(n) {
        return n < 1000 ? Math.round(n) + "ms" : (n/1000).toFixed(2) + "s";
    }
}


function isEqual(obj1, obj2) {
    if (typeof obj1 !== typeof obj2) return false;
    if (obj1 && obj2 && typeof obj1 === 'object') {
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        if (keys1.length !== keys2.length) return false;
        for (let key of keys1) {
            if (!isEqual(obj1[key], obj2[key])) return false;
        }
        return true;
    }
    return obj1 === obj2;
}

/**
 * Creates a deep copy of the given object.
 * @template {Object} T
 * @param {T} obj
 * @returns {Partial<T>} a deep copy of the object
 */
function copy(obj) {
    if (obj && typeof obj === 'object') {
        if (obj.clone instanceof Function || obj.copy instanceof Function) {
            return obj.clone ? obj.clone() : obj.copy();
        }
        const c = Array.isArray(obj) ? [] : {};
        for (let key in obj) {
            c[key] = copy(obj[key]);
        }
        return c;
    }
    return obj;
}

/**
 * Returns the differences between two objects or arrays. If there are no differences, it returns null.
 * If there are differences, it returns an object or array that represents the changes needed to transform oldValue into newValue.
 * If a property in newValue is set to null, it indicates that the property should be deleted from oldValue.
 */
function differences(oldValue, newValue) {
    let change = null;
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
        const maxLength = Math.max(oldValue.length, newValue.length);
        const diff = [];
        let hasChanges = false;
        for (let i = 0; i < maxLength; i++) {
            if (i >= oldValue.length) {
                diff[i] = newValue[i];
                hasChanges = true;
            } else if (i >= newValue.length) {
                diff[i] = null; // Indicate deletion
                hasChanges = true;
            } else {
                const subDiff = differences(oldValue[i], newValue[i]);
                if (subDiff !== null) {
                    diff[i] = subDiff;
                    hasChanges = true;
                }
            }
        }
        if (hasChanges) {
            change = diff;
        }
    } else if ((oldValue && typeof oldValue === "object") && (newValue && typeof newValue === "object")) {
        const oldKeys = Object.keys(oldValue);
        const newKeys = Object.keys(newValue);
        const allKeys = new Set([...oldKeys, ...newKeys]);
        const diff = {};
        let hasChanges = false;

        for (const key of allKeys) {
            if (!(key in oldValue)) {
                diff[key] = newValue[key];
                hasChanges = true;
            } else if (!(key in newValue)) {
                diff[key] = null; // Indicate deletion
                hasChanges = true;
            } else {
                const subDiff = differences(oldValue[key], newValue[key]);
                if (subDiff !== null) {
                    diff[key] = subDiff;
                    hasChanges = true;
                }
            }
        }
        if (hasChanges) {
            change = diff;
        }
    } else if (oldValue !== newValue) {
        change = newValue;
    }
    return change;
}

/**
 * Updates the target object with the changes from the changes object. 
 * If a property in the changes object is set to null, it will be deleted
 * from the target object. If a property in the changes object is an 
 * object or array, it will recursively update the corresponding
 * property in the target object.
 */
function updateObject(target, changes) {
    let updatedValue;
    if (Array.isArray(target) && Array.isArray(changes)) {
        const updatedArray = target.slice();
        let newLength = target.length;

        for (let i = 0; i < changes.length; i++) {
            if (!Object.prototype.hasOwnProperty.call(changes, i)) {
                continue;
            }

            const change = changes[i];
            if (change === null) {
                delete updatedArray[i];
                if (i === newLength - 1) {
                    while (
                        newLength > 0 &&
                        Object.prototype.hasOwnProperty.call(changes, newLength - 1) &&
                        changes[newLength - 1] === null
                    ) {
                        newLength--;
                    }
                }
            } else {
                updatedArray[i] = (i < target.length)
                    ? updateObject(target[i], change)
                    : change;
                if (i >= newLength) {
                    newLength = i + 1;
                }
            }
        }

        updatedArray.length = newLength;
        updatedValue = updatedArray;
    } else if ((target && typeof target === "object") && (changes && typeof changes === "object")) {
        for (const key in changes) {
            if (changes[key] === null) {
                delete target[key];
            } else if (!(key in target)) {
                target[key] = changes[key];
            } else {
                target[key] = updateObject(target[key], changes[key]);
            }
        }
        updatedValue = target;
    } else {
        updatedValue = changes;
    }

    return updatedValue;
}

async function delay(ms) {
    if (typeof ms !== "number" || ms < 0) {
        return new Promise(requestAnimationFrame);
    } else {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const timerLogger = new Debugger("T", "background: #1a73e8; color: white; padding: 5px; border-radius: 5px;");
export { 
    Debugger, 
    getViewerURL, 
    openWindow, openEditor, openViewer, openDraftPreview, openFiles, openNewEditor,
    copy, isEqual, differences, updateObject,

    delay,
    timerLogger
};