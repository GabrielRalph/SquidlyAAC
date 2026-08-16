import { AACBoard, AACGrid } from "../AACWebComponent/aac.js";
import { Icon, SvgPlus } from "../Utilities/utils.js";
import { Path, PATH_SEPERATOR } from "./FileSystem/Path.js";
import { FileSystemUI, FSColumn, FSFileIcon } from "./FileSystem/FileSystemUI.js";
import { getBoard } from "../Firebase/boards.js";
import { registerKeyBindings } from "../Utilities/keybindings.js";
import { openDraftPreview, openEditor, openViewer } from "../shared.js";
import { OBFStats } from "./OBFileSystem.js";
/**
 * @typedef {import("./OBFileSystem.js").OBFileSystem} OBFileSystem
 * @typedef {import("./OBFileSystem.js").OBFStats} OBFStats
 */

class OBFSColumn extends FSColumn {
    constructor(...args) {
        super(...args);
    }

    onContextMenu(event, root, fstat) {
        root.addContextMenu(
            [
                {
                    label: "New Folder",
                    icon: "<i-bw new-folder></i-bw>",
                    action: () => {root.newFolder(fstat.path)}
                },
                {
                    label: "New Board",
                    icon: "<i-bw new-grid></i-bw>",
                    action: () => {root.newBoard(fstat.path)}
                },
                
                // ...(fstat.isBoard ? [
                //     "seperator",
                //     fstat.isFavourite ?  {
                //         label: "Unfavourite",
                //         icon: "<i-c not-favourite></i-c>",
                //         action: () => {root.toggleFavourite(fstat.path, false)},
                //         binding: "F"
                //     } : {
                //         label: "Favourite",
                //         icon: "<i-c favourite></i-c>",
                //         action: () => {root.toggleFavourite(fstat.path, true)},
                //         binding: "F"
                //     },
                //     fstat.public ? {
                //         label: "Make Private",
                //         icon: "<i-c not-favourite-public></i-c>",
                //         action: () => {root.togglePublic(fstat.path, false)},
                //         binding: "P"
                //     } : {
                //         label: "Make Public",
                //         icon: "<i-c favourite-public></i-c>",
                //         action: () => {root.togglePublic(fstat.path, true)},
                //         binding: "P"
                //     },
                // ]: []),
                // TODO
                // {
                //     label: "Copy",
                //     icon: "<i-bw copy></i-bw>",
                //     binding: "⌘C"
                // },
                // {
                //     label: "Paste",
                //     icon: "<i-bw paste></i-bw>",
                //     binding: "⌘V"
                // },
            ], event
        );
        return true;
    }
}

class OBFileIcon extends FSFileIcon {
    /**
     * @param {OBFStats} fstat
     * @param {OBS} root
     */
    constructor(fstat, root) {
        super(fstat, root);
        this.file = fstat;
        let iconArea = this.createChild("div");
        if (fstat.isPublic && !fstat.isFavourite) {
            iconArea.createChild("i-circ", {"name": "Public"});
        } else if (fstat.isPublic || fstat.isFavourite) {
            iconArea.createChild("fs-i", {[fstat.isPublic ? "favourite-public" : "favourite"]: ""});
        }


        switch (fstat.mode) {
            case OBFStats.MODES.Grid:
                iconArea.createChild("fs-i", {"grid": ""});
                break;
            case OBFStats.MODES.GridSet:
                iconArea.createChild("fs-i", {"grid-set": ""});
                break;
            case OBFStats.MODES.Folder:
                iconArea.createChild("fs-i", {"folder": ""});
                break;
        }
       
        this.createChild("span", {innerHTML: fstat.path.name});
        if (fstat.hasChildren) this.createChild("fs-i", {"right-arrow": ""});
    }

    onContextMenu(event, root, fstat) {
        root.addContextMenu(
            [
                {
                    label: "New Folder",
                    icon: "<i-bw new-folder></i-bw>",
                    action: () => {root.newFolder(fstat.path)}
                },
                {
                    label: "New Board",
                    icon: "<i-bw new-grid></i-bw>",
                    action: () => {root.newBoard(fstat.path)}
                },
                "seperator",
                ...(fstat.isBoard ? [
                    fstat.isFavourite ?  {
                        label: "Unfavourite",
                        icon: "<i-c not-favourite></i-c>",
                        action: () => {root.toggleFavourite(fstat.path, false)},
                        binding: "F"
                    } : {
                        label: "Favourite",
                        icon: "<i-c favourite></i-c>",
                        action: () => {root.toggleFavourite(fstat.path, true)},
                        binding: "F"
                    },
                    fstat.public ? {
                        label: "Make Private",
                        icon: "<i-c not-favourite-public></i-c>",
                        action: () => {root.togglePublic(fstat.path, false)},
                        binding: "P"
                    } : {
                        label: "Make Public",
                        icon: "<i-c favourite-public></i-c>",
                        action: () => {root.togglePublic(fstat.path, true)},
                        binding: "P"
                    },
                    "seperator"
                ]: []),
                // TODO
                // {
                //     label: "Copy",
                //     icon: "<i-bw copy></i-bw>",
                //     binding: "⌘C"
                // },
                // {
                //     label: "Paste",
                //     icon: "<i-bw paste></i-bw>",
                //     binding: "⌘V"
                // },
                {
                    label: "Delete",
                    icon: "<i-bw trash></i-bw>",
                    binding: "<i-bw delete-key></i-bw>",
                    action: () => root.delete(fstat.path)
                },
                {
                    label: "Rename",
                    icon: "<i-bw edit-name></i-bw>",
                    binding: "⌘R",
                    action: () => root.promtRename(fstat.path)
                },
                ...(fstat.isBoard ? [
                    "seperator",
                    {
                        label: "Open Editor",
                        icon: "<i-bw edit></i-bw>",
                        action: () => openEditor(fstat.boardID)
                    },
                    {
                        label: "Open Viewer",
                        icon: "<i-bw view></i-bw>",
                        action: () => openViewer(fstat.boardID)
                    },
                    // {
                    //     label: "Open Draft Preview",
                    //     icon: "<i-bw draft-view></i-bw>",
                    //     action: () => openDraftPreview(fstat.boardID)
                    // },
                ] : [])
            ], event
        );
        return true;
    }

    onDoubleClick(e, root, fstat) {
        if (root.onDoubleClick instanceof Function) {
            root.onDoubleClick(e, root, fstat);
        } else {
            super.onDoubleClick(e, root, fstat);
        }
    }
}

class OBFileViewer extends SvgPlus {
    constructor(fstat, root) {
        super("fs-file-display");
        this.class = "aac-grid-wrapper";
        
        let resizeObserver = new ResizeObserver(() => {
            this.styles = {
                "--width": `${this.clientWidth}px`,
                "--height": `${this.clientHeight}px`
            }
        });

        resizeObserver.observe(this);

        if (fstat && fstat.isBoard) {
            this.loadBoard(fstat.boardID, root);
        }
    }

    async loadBoard(id, root) {
        if (this._loadedBoardID === id) return;
        this._loadedBoardID = id;
        const board = await getBoard(id);
        this.innerHTML = "";
        let a = this.createChild(AACGrid);
        a.board = board;
        a.addEventListener("aac-click", e => {
            let button = e.button;
            if (button.load_board) {
                let id = button.load_board.id;
                let path = root.fs.getPathByID(id);
                if (path) {
                    root.select(path);
                }
            }
        })
    }
}

export class OBFinder extends FileSystemUI {
    /** @type {OBFileSystems} */
    fs = null;

    constructor() {
        super(OBFileIcon, OBFileViewer, OBFSColumn);
        registerKeyBindings("ob-finder", this.KEY_BINDINGS);
    }

    KEY_BINDINGS = {
        "f": e => {
            if (this.fs && this.selection.length > 0) {
                this.fs.toggleFavourite(this.selection);
            }
        },
        "p": e => {
             if (this.fs && this.selection.length > 0) {
                this.fs.togglePublic(this.selection);
            }
        },
        "Meta+r": e => {
            if (this.fs && this.isSingleSelection && this.selected) {
                this.promtRename(this.selected);
                e.preventDefault();
            }
        },
        "Meta+z": e => {
            console.log("Undo");
            if (this.fs) {
                this.fs.undo();
            }
        },
        "Meta+y": e => {
            if (this.fs) {
                this.fs.redo();
            }
        }
    }

    redo() {

    }

    undo() {

    }

    setRoot(fs, rootName) {
        super.setRoot(fs, rootName);
        fs.onAfterCommitHistory = () => {
            console.log("History committed, re-rendering", this.selection);
        }
        this.fs = fs;
    }

    async newBoard(path, newName = null) {
        if (!this.fs) return;
        path = Path.parse(path);
        if (newName === null) {
            let name = await this.prompt({
                message: "Enter a name for the new board:",
                placeholder: "New Board",
                validator: (name) => {
                    if (!name) return "Name cannot be empty";
                    if (name.includes(PATH_SEPERATOR)) return `Name cannot contain "${PATH_SEPERATOR}"`;
                    if (this.fs.exists(path.join(name))) {
                        return "A file or folder with this name already exists";
                    }
                    return true;
                },
                yesValue: "Create",
                noValue: "Cancel"
            })
            if (!name) return;
            newName = name;
        }
        let id = null;
        const newPath = path.join(newName);
        if (!this.fs.exists(newPath)) {
            id = this.fs.newBoard(newPath);
            if (id) {
                this.select(newPath);
            }
        }
    }

    async newFolder(path, newName = null) {
        if (!this.fs) return;
        path = Path.parse(path);
        if (!newName) {
            newName = await this.prompt({
                message: "Enter a name for the new folder:",
                defaultValue: "New Folder",
                validator: (name) => {
                    const newPath = path.join(name);
                    if (!name) return "Name cannot be empty";
                    if (name.includes(PATH_SEPERATOR)) return `Name cannot contain "${PATH_SEPERATOR}"`;
                    if (this.fs.exists(newPath)) {
                        return "A file or folder with this name already exists";
                    }
                    return true;
                },
                yesValue: "Create",
                noValue: "Cancel"
            })
        }

        let id = null;
        if (newName) {
            const newPath = path.join(newName);
            console.log("Creating new folder at path:", newPath.toString(), this.fs.exists(newPath));
            if (!this.fs.exists(newPath)) {
                id = this.fs.newFolder(newPath);
                if (id) {
                    this.select(newPath);
                }
            }
        }
        return id;
    }

    async delete(path) {
        if (!this.fs) return;
        let files = this.fs.readdir(path, true, true);
        let includesBoards = files.some(f => f.isBoard);
        let confirm = true;
        if (includesBoards) {
            confirm = await this.confirm(
                `Are you sure you want to delete "${path.name}"?`,
                [["Cancel", false], ["Delete", true]]
            )
        }

        if (confirm) {
            this.fs.delete(path);
        }
    }

    toggleFavourite(path, bool) {
        if (this.fs) {
            this.fs.toggleFavourite(path, bool);
        }
    }

    togglePublic(path, bool) {
        if (this.fs) {
            this.fs.togglePublic(path, bool);
        }
    }

    select(...args) {
        super.select(...args);
        let files = this.fs.readdir(this.selected);
        for (let file of files) {
            if (file.isBoard) {
                getBoard(file.boardID)
            }
        }
    }

    static get usedStyleSheets() {
        return [
            ...FileSystemUI.usedStyleSheets,
            ...AACBoard.usedStyleSheets,
            import.meta.resolve("./style.css"),
            import.meta.resolve("../../Assets/Icons/icons.css"),
        ]
    }
}
