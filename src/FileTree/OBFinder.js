import { AACBoard, AACGrid } from "../AACWebComponent/aac.js";
import { SvgPlus } from "../Utilities/utils.js";
import { Path } from "./FileSystem/path.js";
import { FileSystemUI, FSColumn, FSFileIcon } from "./FileSystem/FileSystemUI.js";
import { getBoard } from "../Firebase/boards.js";
import { OBFStat } from "./OBFileSystem.js";
import { registerKeyBindings } from "../Utilities/keybindings.js";

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
                "seperator",
                ...(fstat.isBoard ? [
                    fstat.isFavourite ?  {
                        label: "Unfavourite",
                        icon: "<i-c not-favourite></i-c>",
                        action: () => {root.favourite(fstat.path, false)},
                        binding: "F"
                    } : {
                        label: "Favourite",
                        icon: "<i-c favourite></i-c>",
                        action: () => {root.favourite(fstat.path, true)},
                        binding: "F"
                    },
                    fstat.public ? {
                        label: "Make Private",
                        icon: "<i-c not-favourite-public></i-c>",
                        action: () => {root.makePublic(fstat.path, false)},
                        binding: "P"
                    } : {
                        label: "Make Public",
                        icon: "<i-c favourite-public></i-c>",
                        action: () => {root.makePublic(fstat.path, true)},
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
                    icon: "<i-bw edit></i-bw>",
                    binding: "⌘R",
                    action: () => root.promtRename(fstat.path)
                }
            ], event
        );
        return true;
    }
}

class OBFileIcon extends FSFileIcon {
    /**
     * @param {OBFStat} fstat
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
        if (fstat.isDirectory && fstat.isBoard) {
            iconArea.createChild("fs-i", {"f-grid": ""});
        } else if (fstat.isDirectory) iconArea.createChild("fs-i")
        else iconArea.createChild("fs-i", {grid: ""});

        this.createChild("span", {innerHTML: fstat.path.name});
        if (fstat.isDirectory) this.createChild("fs-i", {"right-arrow": ""});
    }

    onContextMenu(event, root, fstat) {
        let userParam = new URLSearchParams(window.location.search).get("user");
        userParam = userParam ? `&user=${userParam}` : "";
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
                        action: () => {root.favourite(fstat.path, false)},
                        binding: "F"
                    } : {
                        label: "Favourite",
                        icon: "<i-c favourite></i-c>",
                        action: () => {root.favourite(fstat.path, true)},
                        binding: "F"
                    },
                    fstat.public ? {
                        label: "Make Private",
                        icon: "<i-c not-favourite-public></i-c>",
                        action: () => {root.makePublic(fstat.path, false)},
                        binding: "P"
                    } : {
                        label: "Make Public",
                        icon: "<i-c favourite-public></i-c>",
                        action: () => {root.makePublic(fstat.path, true)},
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
                        action: () => window.open(`../Editor/?board=${fstat.boardID}${userParam}`, "_blank")
                    },
                    {
                        label: "Open Viewer",
                        icon: "<i-bw view></i-bw>",
                        action: () => window.open(`../View/?board=${fstat.boardID}`, "_blank")
                    },
                    {
                        label: "Open Draft Preview",
                        icon: "<i-bw draft-view></i-bw>",
                        action: () => window.open(`../View/?board=${fstat.boardID}&mode=preview-draft`, "_blank")
                    },
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
            }
        });

        resizeObserver.observe(this);

        if (fstat.isBoard) {
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
                let files = root.fs.searchFiles(f => f.id === id);
                if (files.length > 0) {
                    root.select(new Path(files[0].path));
                }
            }
        })
    }
}

export class OBFinder extends FileSystemUI {
    constructor() {
        super(OBFileIcon, OBFileViewer, OBFSColumn);
        registerKeyBindings("ob-finder", this.KEY_BINDINGS);
    }

    KEY_BINDINGS = {
        "f": e => {
            if (this.fs && this.selection.length > 0) {
                for (let path of this.selection) {
                    let stat = this.fs.stat(path);
                    if (stat.isBoard) {
                        this.favourite(path, !stat.isFavourite);
                    }
                }
            }
        },
        "p": e => {
             if (this.fs && this.selection.length > 0) {
                for (let path of this.selection) {
                    let stat = this.fs.stat(path);
                    if (stat.isBoard) {
                        this.makePublic(path, !stat.isPublic);
                    }
                }
            }
        },
        "Meta+r": e => {
            if (this.fs && this.isSingleSelection && this.selected) {
                this.promtRename(this.selected);
                e.preventDefault();
            }
        },
        "Meta+z": e => {
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


    async newBoard(path) {
        path = path instanceof Path ? path : new Path(path);
        let newName = await this.prompt({
            message: `New board name:`, 
            defaultValue: "New Board", 
            yesValue: "Create", 
            noValue: "Cancel",
            validator: (value) => value.indexOf("\\") === -1 ? true : "Board name cannot contain '\\'"
        });
        if (newName) {
            let newPath = path.join(newName);
            const result = this.fs.getCreateBoardExecuter(newPath);
            if (result.conflict) {
                this.confirm(`An item named “${newName}” already exists in this location!`, [["Cancel"]])
            } else {
                result.execute();
            }
        }
    }

    isRootBoardSet(fstat) {
        if (this.fs) {
            return this.fs.isRootBoardSet(fstat.path);
        }
        return false;
    }

    favourite(path, bool) {
        if (this.fs) {
            this.fs.favourite(path, bool);
        }
    }

    makePublic(path, bool) {
        if (this.fs) {
            this.fs.makePublic(path, bool);
        }
    }

    select(...args) {
        super.select(...args);
        let files = this.fs.readdir(this.selected);
        for (let file of files) {
            if (file.isBoard) {
                getBoard(file.boardID, file.metadata.lastUpdated)
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
