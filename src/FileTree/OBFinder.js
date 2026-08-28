import { AACBoard, AACGrid } from "../AACWebComponent/aac.js";
import { SvgPlus } from "../SvgPlus/4.js";
import { Path, PATH_SEPERATOR } from "./FileSystem/Path.js";
import { FileSystemUI, FSColumn, FSFileIcon } from "./FileSystem/FileSystemUI.js";
import { getBoard } from "../Firebase/boards.js";
import { META_KEY, registerKeyBindings } from "../Utilities/keybindings.js";
import { openDraftPreview, openEditor, openViewer } from "../Utilities/shared.js";
import { OBFStats } from "./OBFileSystem.js";
import { AACGridCanvas } from "../AACWebComponent/aac-canvas.js";
import { Icon } from "../Utilities/icons.js";

/**
 * @typedef {import("./OBFileSystem.js").OBFileSystem} OBFileSystem
 * @typedef {import("./OBFileSystem.js").OBFStats} OBFStats
 */

class OBFSColumn extends FSColumn {
    constructor(path, files, ...args) {
        files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            if (a.hasChildren && !b.hasChildren) return -1;
            if (!a.hasChildren && b.hasChildren) return 1;
            return a.path.name.localeCompare(b.path.name);
        });
        super(path, files, ...args);
    }

    onContextMenu(event, root, fstat) {
        root.addContextMenu(
            [
                {
                    label: "New Folder",
                    icon: "<i-bw new-folder></i-bw>",
                    binding: META_KEY + "F",
                    action: () => {root.newFolder(fstat.path)}
                },
                {
                    label: "New Board",
                    icon: "<i-bw new-grid></i-bw>",
                    binding: META_KEY + "B",
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


        let icon = [
            fstat.favourite ? "favourite" : "",
            fstat.isPublic ? (fstat.public ? "public" : "effective-public") : ""
        ].filter(Boolean).join("-");
        if (icon) {
            iconArea.createChild("fs-i", {[icon]: true});
        }
           
       
        let imain = iconArea.createChild("fs-i");
        switch (fstat.mode) {
            case OBFStats.MODES.Grid:
                imain.toggleAttribute("grid", true);
                break;
            case OBFStats.MODES.GridSet:
                imain.toggleAttribute("grid-set", true);
                break;
            case OBFStats.MODES.Folder:
                imain.toggleAttribute("folder", true);
                break;
        }
        
        if (fstat.thumbnail) {
            imain.styles = {"--i-bg": `url(${fstat.thumbnail})`};
        }

        this.createChild("span", {innerHTML: fstat.path.name});
        if (fstat.hasChildren) this.createChild(Icon, {}, "right-arrow");
    }

    onContextMenu(event, root, fstat) {
        root.addContextMenu(
            [
                {
                    label: "New Folder",
                    icon: "<i-bw new-folder></i-bw>",
                    binding: META_KEY + "F",
                    action: () => {root.newFolder(fstat.path)}
                },
                {
                    label: "New Board",
                    icon: "<i-bw new-grid></i-bw>",
                    binding: META_KEY + "B",
                    action: () => {root.newBoard(fstat.path)}
                },
                "seperator",
                ...(fstat.isBoard ? [
                    fstat.favourite ?  {
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
                        icon: "<i-c public></i-c>",
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
                    action: () => {
                        root.deleteFromSelection(fstat.path);
                    }
                },
                {
                    label: "Rename",
                    icon: "<i-bw edit-name></i-bw>",
                    binding: META_KEY + "R",
                    action: () => root.rename(fstat.path)
                },


                ...(fstat.isBoard ? [
                    {
                        label: "Upload Icon",
                        icon: "<i-bw image></i-bw>",
                        binding: META_KEY + "I",
                        action: () => {
                            let selection = root.selection;
                            if (!selection.some(p => p.same(fstat.path))) {
                                selection = [fstat.path];
                            }
                            root.uploadThumbnail(selection)
                        }
                    },
                    ...(fstat.thumbnail ? [
                        {
                            label: "Delete Icon",
                            icon: "<i-bw delete-image></i-bw>",
                            binding:  META_KEY + "J",
                            action: () => {
                                let selection = root.selection;
                                if (!selection.some(p => p.same(fstat.path))) {
                                    selection = [fstat.path];
                                }
                                root.removeThumbnail(selection)
                            }
                        }
                    ] : []),
                    "seperator",
                    {
                        label: "Open Editor",
                        icon: "<i-bw edit></i-bw>",
                        binding: "E",
                        action: () => openEditor(fstat.boardID)
                    },
                    {
                        label: "Open Viewer",
                        icon: "<i-bw view></i-bw>",
                        binding: "V",
                        action: () => openViewer(fstat.boardID)
                    },
                    {
                        label: "Export",
                        icon: "<i-bw print></i-bw>",
                        binding: META_KEY + "E",
                        action: () => root.downloadBoardImage(fstat)
                    },
                    "seperator",
                    {
                        label: "Copy Board ID",
                        icon: "<i-bw copy></i-bw>",
                        action: () => {
                            navigator.clipboard.writeText(fstat.boardID);
                        }
                    }
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
        "Backspace": e => {
            if (this.fs && this.selection.length > 0) {
                this.delete(this.selection);
            }
        },
        "Meta+r": e => {
            if (this.fs && this.isSingleSelection && this.selected) {
                this.rename(this.selected);
                e.preventDefault();
            }
        },
        "Meta+z": e => {
            if (this.fs) {
                this.fs.undo();
            }
        },
        "Shift+Meta+z": e => {
            if (this.fs) {
                this.fs.redo();
            }
        },
        "Meta+y": e => {
            if (this.fs) {
                this.fs.redo();
            }
        },
        "v": e => {
            if (this.fs && this.isSingleSelection && this.selected) {
                openViewer(this.fs.stat(this.selected).boardID);
            }
        },
        "e": e => {
            if (this.fs && this.isSingleSelection && this.selected) {
                openEditor(this.fs.stat(this.selected).boardID);
            }
        },
        "Meta+e": e => {
            if (this.fs && this.isSingleSelection && this.selected) {
                this.downloadBoardImage(this.fs.stat(this.selected));
            }
        },
        "Meta+i": e => {
            if (this.fs && this.selection.length > 0) {
                this.uploadThumbnail(this.selection);
            }
        },
        "Meta+j": e => {
            if (this.fs && this.selection.length > 0) {
                this.removeThumbnail(this.selection);
            }
        },
        "Meta+f": e => {
            if (this.fs && this.isSingleSelection && this.selected) {
                this.newFolder(this.selected);
            }
        },
        "Meta+b": e => {
            if (this.fs && this.isSingleSelection && this.selected) {
                this.newBoard(this.selected);
            }
        }
    }

    async uploadThumbnail(path) {
        if (!this.fs) return false;
        await this.fs.uploadThumbnail(path);
    }
    async removeThumbnail(path) {
        if (!this.fs) return false;
        await this.fs.removeThumbnail(path);
    }

    async newBoard(path, newName = null) {
        if (!this.fs) return;
        path = Path.parse(path);
        if (newName === null) {
            let name = await this.prompt({
                message: "Enter a name for the new board:",
                defaultValue: "New Board",
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
            if (!this.fs.exists(newPath)) {
                id = this.fs.newFolder(newPath);
                if (id) {
                    this.select(newPath);
                }
            }
        }
        return id;
    }

    async deleteFromSelection(path) {
        path = Path.parse(path).toString();

        let paths = []
        let selection = new Set(this.selection.map(p => p.toString()));
        if (selection.has(path)) {
            paths = [...selection];
        } else {
            paths = [path];
        }

        await this.delete(paths);
    }

    async delete(paths) {
        if (!this.fs) return;
        if (!Array.isArray(paths)) paths = [paths];
        if (paths.length === 0) return;
        paths = paths.map(p => Path.parse(p));
        let files = paths.flatMap(p => this.fs.readdir(p, true, true));

        let includesBoards = files.some(f => f.isBoard);
        let confirm = true;
        if (includesBoards) {
            confirm = await this.confirm(
                `Are you sure you want to delete ${paths.map(p => `<b>${p.name}</b>`).join(", ")}?`,
                [["Cancel", false], ["Delete", true]]
            )
        }

        if (confirm) {
            if (this.fs.deleteMultiple(paths)) {
                this.select(paths[0].parent);
            }
        }
    }

    async downloadBoardImage(fstat) {
        if (fstat && fstat.isBoard) {
            const board = await getBoard(fstat.boardID);
            await AACGridCanvas.exportBoard(board, fstat.path.name);
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
