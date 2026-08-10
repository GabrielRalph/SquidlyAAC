const POPUP_CACHE = {};

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

export { openWindow, openEditor, openViewer, openDraftPreview };