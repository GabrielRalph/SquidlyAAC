
function openWindow(name, board, other) {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set("board", board);
    if (other && typeof other === "object") {
        for (let key in other) {
            urlParams.set(key, other[key]);
        }
    }
    window.open(`../${name}/?${urlParams.toString()}`, "_blank");
}
function openEditor(board) {
    openWindow("Editor", board);
}
function openViewer(board) {
    openWindow("View", board);
} 
function openDraftPreview(board) {
    openWindow("View", board, {mode: "preview-draft"});
}

export { openWindow, openEditor, openViewer, openDraftPreview };