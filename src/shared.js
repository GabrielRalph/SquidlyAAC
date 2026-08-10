const POPUP_CACHE = {};
const DEBUG = (new URLSearchParams(window.location.search).get("debug") === "true")
function openWindow(name, board, other, extraKey = "") {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set("board", board);
    if (other && typeof other === "object") {
        for (let key in other) {
            urlParams.set(key, other[key]);
        }
    }
    const popupID = `${name}-${board}${extraKey}`;
    if (popupID in POPUP_CACHE) {
        const popup = POPUP_CACHE[popupID];
        if (!popup.closed) {
            popup.focus();
            return;
        }
    } else {
        const popup = window.open(`../${name}/?${urlParams.toString()}`, popupID);
        POPUP_CACHE[popupID] = popup;
    }
}
function openEditor(board) {
    openWindow("Editor", board);
}
function openViewer(board) {
    openWindow("View", board);
} 
function openDraftPreview(board) {
    openWindow("View", board, {mode: "preview-draft"}, "-draft");
}

class Debugger {
    constructor(name, style = "background: #b43113; color: white; padding: 5px; border-radius: 5px;") {
        this.name = name;
        this.style = style;
    }

    logStart(mode, info, ...args) {
        if (DEBUG) {
            console.groupCollapsed(`%c${this.name}: ${mode}`, this.style, info);
            if (args.length > 0) {
                console.log(...args);
            }
        }
    }

    logEnd() {
        console.groupEnd();
    }

    log(mode, info, ...args) {
        if (DEBUG) {
            this.logStart(mode, info);
            let error = new Error();
            let stack = error.stack.split("\n").slice(2).join("\n");
            args.forEach(arg => console.log(arg));
            console.log(stack);
            this.logEnd();
        }
    }
}


export { Debugger, openWindow, openEditor, openViewer, openDraftPreview };