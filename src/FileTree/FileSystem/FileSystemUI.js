import { SvgPlus } from "../../Utilities/utils.js";
import { ContextMenu } from "../../ContextMenu/context-menu.js";
import { Path, PATH_SEPERATOR } from "./Path.js";

/**
 * @typedef {import("./FileSystemInterface.js").FileSystemInterface} FileSystemInterface
 */

const DEFAULT_PROMT_OPTIONS = {
    message: "",
    defaultValue: "", 
    yesValue: "Rename", 
    noValue: "Cancel",
    validator: () => true
}

/********************************************************************************
 * Drag Methods
 ********************************************************************************/

const DRAG_STATE = { }

function startDrag(e, fstats, root) {
    fstats = Array.isArray(fstats) ? fstats : [fstats];
    fstats = fstats.filter(Boolean);
    const paths = fstats.map(f => f.path.toString());
    e.dataTransfer.setData("text/plain", paths.join("\n"));
    e.dataTransfer.effectAllowed = "move";
    DRAG_STATE.draggedFiles = fstats;

    const preview = root.makeDragIcon(fstats);
    e.dataTransfer.setDragImage(preview, 18, 14);
}

function endDrag(e, fstat) {
    DRAG_STATE.draggedFiles = null;
}

function getDraggedFiles() {
    return DRAG_STATE.draggedFiles || [];
}

class DragableLocation extends SvgPlus {
    addDragListeners(onDrop, thisPath){
        thisPath = thisPath instanceof Path ? thisPath : new Path(thisPath);
        this.addEventListener("dragover", e => {
            let droppable = false;
            const draggedFiles = getDraggedFiles();
            if (draggedFiles.length > 0) {
                const allDroppable = draggedFiles.every(draggedFile => {
                    let dragPath = draggedFile.path;
                    return !dragPath.same(thisPath)
                        && !dragPath.isParentOf(thisPath)
                        && !dragPath.parent.same(thisPath);
                });

                if (allDroppable) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                    droppable = true;
                }
            }
            this.toggleAttribute("drag-over", droppable);
        });

        this.addEventListener("dragleave", e => {
            this.toggleAttribute("drag-over", false);

        });

        this.addEventListener("drop", e => {
            const draggedFiles = getDraggedFiles();
            this.toggleAttribute("drag-over", false);
            if (draggedFiles.length > 0) {
                onDrop(draggedFiles.map(file => file.path), thisPath);
                e.preventDefault();
                e.stopImmediatePropagation();
                e.stopPropagation();
            }
        });
    }
}

/********************************************************************************
 * FS Files Icons and Columns
 ********************************************************************************/

class FSFileIcon extends DragableLocation {
    /**
     * @param {FStats} fstat
     * @param {FileSystemUIClass} root
     */
    constructor(fstat, root) {
        super("fs-file");
        this.setAttribute("data-file-path", fstat.path.toString());
        this.props = {
            "draggable": true,
        }
        this.addEventListener("dblclick", e => {
           this.onDoubleClick(e, root, fstat);
        });

        this.addEventListener("dragstart", e => {
            const selectedPaths = root.selection;
            const isSelected = selectedPaths.some(path => path.same(fstat.path));

            let dragStats = [fstat];

            if (isSelected) {
                dragStats = selectedPaths
                    .map(path => root.fs.stat(path))
                    .filter(Boolean);
            } 

            startDrag(e, dragStats, root);
        });
        this.addEventListener("dragend", e =>  endDrag(e, fstat));

        if (root.fs.isDirectory(fstat.path)) {
            this.addDragListeners(root.moveMultiple.bind(root), fstat.path);
        }
    }

    onDoubleClick(e, root, fstat) {
    }

    onContextMenu(e, root) {}
}

class FSColumn extends DragableLocation {
    /**
     * @param {Path} path
     * @param {FStats[]} files
     * @param {FileSystemUIClass} root
     * @param {string} name
     */
    constructor(path, files, root, name, i) {
        super("fs-column");
        this.setAttribute("data-column-path", path.toString());
        const div = this.createChild("div"); 

        files.forEach(f => {
            let fsf = div.createChild(root.fileIconClass, {
                events: {
                    click: (event) => {
                        root.select(f.path, {
                            event,
                            columnPath: path,
                            columnFiles: files,
                        });
                        event.stopPropagation();
                    },
                    contextmenu: (event) => {
                        let inSelection = root.selection.some(sel => sel.same(f.path));
                        if (!inSelection) {
                            root.select(f.path, {
                                event,
                                columnPath: path,
                                columnFiles: files,
                            });
                        }
                        if (fsf.onContextMenu(event, root, f)) {
                            event.preventDefault();
                            event.stopImmediatePropagation();
                        }
                    }
                }
            }, f, root);
            fsf.toggleAttribute("selected", root.isPathSelected(f.path, path));
            fsf.toggleAttribute("in-selected-path", f.path.name === name && i > 0);
        });

        this.addEventListener("contextmenu", e => {
            if (this.onContextMenu(e, root, root.fs.stat(path))) {
                e.preventDefault();
            }
        });

        this.addEventListener("click", e => {
            root.select(path, {
                event: e,
            });
        });

        // let path = new Path([root.selected.parts[i]]);
        this.addDragListeners(root.moveMultiple.bind(root), path);
    }

    onContextMenu(e, root) {}
}

/********************************************************************************
 * File System UI
 ********************************************************************************/

class FileSystemUI extends SvgPlus {
    #selected = new Path("");
    #selection = [];
    #selectionDir = new Path("");
    #selectionAnchor = null;
    #columnScrollTops = new Map();

    /** @type {FileSystemInterface} */
    fs = null;

    
    constructor(fileIconClass, fileDisplayClass, columnClass) {
        super("file-system");
        this.dragIconArea = this.createChild("div", {style: {
            position: "absolute",
            top: "-10000%",
            left: "-10000%",
            "pointer-events": "none",
            "z-index": "999999",
            "height": "30em",
        }});
        this.popup = this.createChild("fs-popup", {hidden: true});
        this.head = this.createChild("fs-head");
        this.head.titleEl = this.head.createChild("div");
        this.main = this.createChild("fs-main").createChild("div");
        this.fileIconClass = fileIconClass || FSFileIcon;
        this.fileDisplayClass = fileDisplayClass || "div";
        this.columnClass = columnClass || FSColumn;
    }


    /**
     * @param {Path} path
     */
    get selected() {
        return this.#selected instanceof Path ? this.#selected.clone() : this.#selected;
    }

    /**
     * @param {Path[]} path
     */
    get selection() {
        return this.#selection.map(path => path.clone());
    }

    get isSingleSelection() {
        return this.#selection.length === 1;
    }


    async confirm(message, options = [["Stop", false], ["Replace", true]]) {
        this.popup.innerHTML = "";
        this.popup.class = "confirm";
        this.popup.createChild("div", {content: message});
        this.popup.styles = {"--n": options.length};
        let row = this.popup.createChild("div", {class: "buttons"});
        let promise = new Promise((resolve, reject) => {
            for (let option of options) {
                row.createChild("div")
                .createChild("button", {
                    content: option[0],
                    events: {
                        click: () => resolve(option[1])
                    }
                });
            }
        })
        this.popup.toggleAttribute("hidden", false);
        let result = await promise;
        this.popup.toggleAttribute("hidden", true);
        return result;
    }

    async prompt(options = DEFAULT_PROMT_OPTIONS) {
        const {
            message,
            defaultValue,
            yesValue,
            noValue,
            validator,
        } = {...DEFAULT_PROMT_OPTIONS, ...(options && typeof options === "object" ? options : {})};

        this.popup.innerHTML = "";
        this.popup.class = "prompt";
        this.popup.styles = {"--n": 2};
        this.popup.toggleAttribute("invalid", false);

        this.popup.createChild("div", {content: message});
        let input = this.popup.createChild("input", {
            type: "text",
            value: defaultValue || "",
        });
        setTimeout(() => {
            input.focus();
            input.select();
        }, 10);
        let promise = new Promise((resolve, reject) => {
            let lastValidity = null;
            let updateValidity = () => {
                let isValid = validator(input.value);
                if (lastValidity !== isValid) {
                    if (isValid !== true) {
                        input.setCustomValidity(isValid || "Invalid input");
                        input.reportValidity();
                    } else {
                        input.setCustomValidity("");
                    }
                    this.popup.toggleAttribute("invalid", isValid !== true);
                    lastValidity = isValid;
                }
            }

            let row = this.popup.createChild("div", {class: "buttons"});
            row.createChild("div")
            .createChild("button", {
                content: noValue,
                events: {
                    click: () => resolve(null)
                }
            });
            row.createChild("div")
            .createChild("button", {
                primary: true,
                content: yesValue,
                events: {
                    click: () => resolve(input.value)
                }
            });
            input.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    updateValidity();
                    if (lastValidity === true) {
                        resolve(input.value);
                    }
                } else if (e.key === "Escape") {
                    resolve(null);
                }
            });

            input.addEventListener("input", e => {
                updateValidity();
            })

            updateValidity();
        })

        this.popup.toggleAttribute("hidden", false);
        let result = await promise;
        this.popup.toggleAttribute("hidden", true);
        return result;
    }

    /**
     * @param {FileSystem}  fs the file system to set as the root
     * @param {string|Path} path the path to set as the root
     * */
    setRoot(fs, rootName) {
        this.fs = fs;
        this.rootName = rootName || "My Files";
        this.fs.addOnUpdateCallback(this.render.bind(this));
        this.render();
    }

    async rename(path, newName) {
        path = Path.parse(path);
        if (!newName || typeof newName !== "string" || newName.trim() === "") {
            newName = await this.prompt({
                message: `Enter a new name for “${path.name}”:`,
                defaultValue: path.name,
                yesValue: "Rename",
                noValue: "Cancel",
                validator: (value) => {
                    if (!value || value.trim() === "") {
                        return "Name cannot be empty";
                    }
                    if (value.includes(PATH_SEPERATOR)) {
                        return `Name cannot contain the character “${PATH_SEPERATOR}”`;
                    }
                    return true;
                }
            });
        }
        
        let confirmed = false;
        let newPath;
        if (newName && typeof newName === "string" && newName.trim() !== "" ) {
            confirmed = true;
            newPath = path.parent.join(newName);
            if (this.fs.exists(newPath)) {
                confirmed = await this.confirm(
                    `An item named “${newName}” already exists in this location. Do you want to replace it with the one you’re renaming?`,
                    [["Stop", false], ["Replace", true]]
                );
            }
        }

        if (confirmed) {
            if (this.fs.rename(path, newName)) {
                this.#setSingleSelection(newPath);
            }
        }
    }

    async _checkMoveConflict(fromPath, toPath) {
        fromPath = Path.parse(fromPath);
        toPath = Path.parse(toPath);
        const newPath = toPath.join(fromPath.name);
        let confirmed = true;
         if (this.fs.exists(newPath)) {
            confirmed = await this.confirm(
                `An item named “${fromPath.name}” already exists in this location. Do you want to replace it with the one you’re moving?`,
                [["Stop", false], ["Replace", true]]
            )
        }

        return [confirmed, newPath];
    }

    async move(fromPath, toPath) {
        if (!this.fs) return;
        if (this.fs.isDirectory(toPath)) {
            const [confirmed, newPath] = await this._checkMoveConflict(fromPath, toPath);
            if (confirmed) {
                if (this.fs.move(fromPath, toPath)) {
                    this.#setSingleSelection(newPath);
                }
            }
        }
    }

    async moveMultiple(fromPaths, toPath) {
        if (!this.fs) return;
        fromPaths = fromPaths.map(path => Path.parse(path)).filter(Boolean);
        toPath = Path.parse(toPath);    

        if (this.fs.isDirectory(toPath)) {
            let movePaths = []
            for (let fromPath of fromPaths) {
                const [confirmed, newPath] = await this._checkMoveConflict(fromPath, toPath);
                if (confirmed) {
                    movePaths.push([fromPath, newPath]);
                }
            }
            if (this.fs.moveMultiple(movePaths.map(([from, to]) => from), toPath)) {
                movePaths = movePaths.map(([from, to]) => to);
                this.#selected = movePaths[movePaths.length - 1]
                this.#selection = movePaths;
                this.#selectionDir = toPath;
                this.#selectionAnchor = this.#selected;
            }
        }

    }

    addContextMenu(items, e) {
        this.createChild(ContextMenu, {}, items, {x: e.clientX, y: e.clientY});
    }

    #captureColumnScrolls() {
        const columns = this.main.querySelectorAll("fs-column[data-column-path]");
        columns.forEach(column => {
            const key = column.getAttribute("data-column-path");
            const scroller = column.firstElementChild;
            if (key != null && scroller) {
                this.#columnScrollTops.set(key, scroller.scrollTop);
            }
        });
    }

    #restoreColumnScroll(path, column) {
        const key = path.toString();
        const scroller = column?.firstElementChild;
        if (!scroller) return;

        const savedTop = this.#columnScrollTops.get(key);
        if (typeof savedTop === "number") {
            scroller.scrollTop = savedTop;
        }

        scroller.addEventListener("scroll", () => {
            this.#columnScrollTops.set(key, scroller.scrollTop);
        }, {passive: true});
    }

    #ensurePrimarySelectionVisible() {
        const columnPath = this.#selectionDir?.toString();
        const selectedPath = this.#selected?.toString();
        if (!columnPath || !selectedPath) return;

        const columns = this.main.querySelectorAll("fs-column[data-column-path]");
        let column = null;
        columns.forEach(col => {
            if (!column && col.getAttribute("data-column-path") === columnPath) {
                column = col;
            }
        });
        if (!column) return;

        const scroller = column.firstElementChild;
        if (!scroller) return;

        const selectedFiles = scroller.querySelectorAll("[data-file-path]");
        let selectedFile = null;
        selectedFiles.forEach(file => {
            if (!selectedFile && file.getAttribute("data-file-path") === selectedPath) {
                selectedFile = file;
            }
        });
        if (!selectedFile) return;

        const itemTop = selectedFile.offsetTop;
        const itemBottom = itemTop + selectedFile.offsetHeight;
        const viewTop = scroller.scrollTop;
        const viewBottom = viewTop + scroller.clientHeight;

        if (itemTop < viewTop) {
            scroller.scrollTop = itemTop;
        } else if (itemBottom > viewBottom) {
            scroller.scrollTop = itemBottom - scroller.clientHeight;
        }
    }

    #render() {
        this.#captureColumnScrolls();
        this.main.innerHTML = "";
        this.head.titleEl.innerHTML = "";
        if (!this.fs) return;
        const Column = this.columnClass;
        let fileList = this.fs.readdir("");
        this.#normalizeSelection();

        let selectedFile = this.fs.stat(this.selected);
        if (!selectedFile) {
            this.#selected = this.#selection[0] || new Path("");
            selectedFile = this.fs.stat(this.selected);
        } 

        
        let headerName = selectedFile.isDirectory ? this.selected.name : this.selected.parent.name + " / " + this.selected.name;
        headerName ||= this.rootName;
        this.head.titleEl.createChild("span", {content: headerName});

        let parts = this.selected.parts;
        let pslice = ["", ...parts];
        const n = pslice.length;
        let nAdjusted = 0;
        for (let i = 0; i < n; i++) {
            let path = new Path(pslice.slice(0, i+1));
            const stat = this.fs.stat(path);
            const files = this.fs.readdir(path);
            if (files.length > 0) {
                let name = parts[i];
                let nameIndex = n - i - 2;
                const column = this.main.createChild(Column, {}, path, files, this, name, nameIndex);
                this.#restoreColumnScroll(path, column);
                nAdjusted++;
            }
            if (i === n - 1) {
                this.main.createChild(this.fileDisplayClass, {}, stat, this);
            }
        }
        this.main.styles = {"--n": nAdjusted};
        this.main.parentNode.scrollLeft = this.main.scrollWidth;
        this.#ensurePrimarySelectionVisible();
    }

    render() {
        if (this._renderScheduled) return;
        this._renderScheduled = true;
        window.requestAnimationFrame(() => {
            this._renderScheduled = false;
            this.#render();
        });
    }


    makeDragIcon(selectedFS) {
        this.dragIconArea.innerHTML = "";
        const column = this.dragIconArea.createChild("fs-column", {dummy: true});
        const div = column.createChild("div");
        selectedFS.forEach(stat => {
            let fsf = div.createChild(this.fileIconClass, {}, stat, this);
            fsf.toggleAttribute("selected", true);
        });
        return column;
    }

    /**
     * @param {Path|string} path
     * @param {Path|string} columnPath
     */
    isPathSelected(path, columnPath) {
        path = path instanceof Path ? path : new Path(path);
        columnPath = columnPath instanceof Path ? columnPath : new Path(columnPath);
        if (!this.#selectionDir.same(columnPath)) return false;
        return this.#selection.some(sel => sel.same(path));
    }

    #normalizeSelection() {
        this.#selection = this.#selection.filter(path => this.fs.stat(path));
        if (!this.#selection.some(path => path.same(this.#selected))) {
            this.#selected = this.#selection[0] || this.#selected;
        }
        if (this.#selection.length === 0 && this.fs.stat(this.#selected)) {
            this.#selection = [this.#selected];
            this.#selectionDir = this.#selected.parent || new Path("");
            this.#selectionAnchor = this.#selected;
        }
    }

    #getSelectionState() {
        return {
            selected: this.#selected?.toString() || "",
            selectionDir: this.#selectionDir?.toString() || "",
            selectionAnchor: this.#selectionAnchor?.toString() || "",
            selection: this.#selection.map(path => path.toString()),
        };
    }

    #isSameSelectionState(a, b) {
        if (a.selected !== b.selected) return false;
        if (a.selectionDir !== b.selectionDir) return false;
        if (a.selectionAnchor !== b.selectionAnchor) return false;
        if (a.selection.length !== b.selection.length) return false;
        for (let i = 0; i < a.selection.length; i++) {
            if (a.selection[i] !== b.selection[i]) return false;
        }
        return true;
    }

    #setSingleSelection(path, columnPath) {
        const before = this.#getSelectionState();
        path = path instanceof Path ? path : new Path(path);
        columnPath = columnPath instanceof Path ? columnPath : (path.parent || new Path(""));

        this.#selected = path;
        this.#selection = [path];
        this.#selectionDir = columnPath;
        this.#selectionAnchor = path;
        return !this.#isSameSelectionState(before, this.#getSelectionState());
    }

    #toggleSelection(path, columnPath) {
        const before = this.#getSelectionState();
        path = path instanceof Path ? path : new Path(path);
        columnPath = columnPath instanceof Path ? columnPath : (path.parent || new Path(""));

        if (!this.#selectionDir.same(columnPath)) {
            return this.#setSingleSelection(path, columnPath);
        }

        const index = this.#selection.findIndex(sel => sel.same(path));
        if (index === -1) {
            this.#selection.push(path);
            this.#selected = path;
            if (!this.#selectionAnchor) this.#selectionAnchor = path;
        } else if (this.#selection.length > 1) {
            this.#selection.splice(index, 1);
            if (this.#selected.same(path)) {
                this.#selected = this.#selection[this.#selection.length - 1];
            }
            if (this.#selectionAnchor && this.#selectionAnchor.same(path)) {
                this.#selectionAnchor = this.#selection[0] || null;
            }
        }

        return !this.#isSameSelectionState(before, this.#getSelectionState());
    }

    #setRangeSelection(path, columnPath, columnFiles) {
        const before = this.#getSelectionState();
        path = path instanceof Path ? path : new Path(path);
        columnPath = columnPath instanceof Path ? columnPath : (path.parent || new Path(""));
        columnFiles = Array.isArray(columnFiles) ? columnFiles : [];

        if (!this.#selectionDir.same(columnPath)) {
            return this.#setSingleSelection(path, columnPath);
        }

        let anchor = this.#selectionAnchor;
        if (!anchor || !anchor.parent || !anchor.parent.same(columnPath)) {
            anchor = this.#selected;
        }
        if (!anchor || !anchor.parent || !anchor.parent.same(columnPath)) {
            return this.#setSingleSelection(path, columnPath);
        }

        const ordered = columnFiles.map(file => file.path);
        const anchorIndex = ordered.findIndex(p => p.same(anchor));
        const targetIndex = ordered.findIndex(p => p.same(path));

        if (anchorIndex === -1 || targetIndex === -1) {
            return this.#setSingleSelection(path, columnPath);
        }

        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        this.#selection = ordered.slice(start, end + 1);
        this.#selected = path;
        this.#selectionDir = columnPath;
        return !this.#isSameSelectionState(before, this.#getSelectionState());
    }


    select(path, options = {}) {
        path = Path.parse(path);
       
        const event = options.event || null;
        const columnPath = options.columnPath instanceof Path
            ? options.columnPath
            : (options.columnPath ? new Path(options.columnPath) : (path.parent || new Path("")));
        const columnFiles = Array.isArray(options.columnFiles) ? options.columnFiles : [];

        const withMeta = !!(event && (event.metaKey || event.ctrlKey));
        const withShift = !!(event && event.shiftKey);

        let changed = false;

        if (withShift) {
            changed = this.#setRangeSelection(path, columnPath, columnFiles);
        } else if (withMeta) {
            changed = this.#toggleSelection(path, columnPath);
        } else {
            changed = this.#setSingleSelection(path, columnPath);
        }

        if (changed) {
            this.render();
            this.dispatchEvent(new CustomEvent("selection-change"));
        }
        return changed;
    }

    static get usedStyleSheets() {
        return [
            ...ContextMenu.usedStyleSheets,
        ]
    }
}

export { FileSystemUI, FSFileIcon, FSColumn };