import { Path } from "../FileTree/FileSystem/Path.js";
import { OBFileSystem, OBFStats } from "../FileTree/OBFileSystem.js";
import { OBFinder } from "../FileTree/OBFinder.js";
import { OBLoadBoard } from "../OpenBoard/openboard.js";
import { Icon } from "../Utilities/icons.js";
import { ShadowElement } from "../SvgPlus/shadow-element.js";
import { SvgPlus } from "../SvgPlus/4.js";

export class BoardFinder extends ShadowElement {
    /** @type {OBFileSystem} */
    #fs = null;
    #loading = null;
    #lastSelected = null;
	constructor() {
		super("board-finder");

        const bg = new SvgPlus("div");
        bg.class = "background"
        this.shadowRoot.appendChild(bg)

		this.fsUI = this.createChild(OBFinder, {events: {
            "selection-change": e => {
                let selection = this.fsUI.selection;
                if (!this.isSaveMode) {
                    this.selectButton.disabled = true;
                    if (selection.length === 1) {
                        const path = this.fsUI.selection[0];
                        const stat = this.#fs.stat(path);
                        if (stat && stat.isBoard) {
                            this.selectButton.disabled = false;
                            this.#lastSelected = stat;
                        }
                    }
                } 
            }
        }})

        // Create the new board button
        let button = this.fsUI.head.createChild("button", {
            class: "new-board",
            events: {
                click: () => {
                    let selected = "";
                    let selection = this.fsUI.selection;
                    if (selection.length > 1) {
                        selected = selection[0].parent
                    } else if (selection.length == 1) {
                        selected = selection[0];
                    }
                    this.fsUI.newBoard(selected);
                }
            }
        });
        button.createChild("span", {content: "New Board"});
        button.createChild(Icon, {}, "new-grid");

        // Set double click event to select a board
        this.fsUI.onDoubleClick = (e, root, fstat) => {
            if (fstat.isBoard && !this.isSaveMode) {
                this._onSelect(fstat);
            }
        }
        
		let options = this.createChild("div", {class: "finder-options"});
        this.input = options.createChild("input", {
            type: "text", 
            placeholder: "Filename", 
            value: "Untitled Board",
            events: {
                input: e => { 
                    this.selectButton.disabled = !this.input.value || this.input.value.trim() === "";
                }
            }
        })

        options.createChild("button", {
            content: "cancel",
            class: "cancel",
            events: {click: () => {
                this._onSelect(null);
            }}
        })
        
        this.selectButton = options.createChild("button", {
            content: "select", 
            class: "select",
            primary: true,
            events: {click: async () => {
                if (this.isSaveMode) {
                    let selected = new Path("");
                    let selection = this.fsUI.selection;
                    if (selection.length > 1) {
                        selected = selection[0].parent
                    } else if (selection.length == 1) {
                        selected = selection[0];
                    }

                    let name = this.input.value.trim();
                    let path = selected.join(name);
                    let confirm = true;
                    if (this.#fs.exists(path)) {
                        confirm = await this.fsUI.confirm(`A file with the name "${name}" already exists.`, [["Cacel", false]])
                    }

                    if (confirm) {
                        let newBoardID = this.#fs.newBoard(path);
                        if (newBoardID) {
                            this._onSelect(newBoardID);
                        } else {
                            this._onSelect();
                        }
                    } 
                } else {
                    this._onSelect();
                }
            }}
        })
        this.selectButton.disabled = true;
	}

    resetInput() {
        this.input.value = "Untitled Board";
    }

    _onSelect(value = this.#lastSelected){
        if (this.onSelect instanceof Function) {
            let linkedBoard = value instanceof OBFStats ? OBLoadBoard.make({id: value.boardID}) : value;
            this.onSelect(linkedBoard);
        }
    }

    set mode(value) {
        this.root.toggleAttribute("save-mode", value === "save");
        this.selectButton.innerHTML = value === "save" ? "Save" : "Select";
        this._isSaveMode = value === "save";
        if (this.isSaveMode) {
            this.selectButton.disabled = false;
        }
    }
    get isSaveMode() {
        return this._isSaveMode;
    }

    async assignUser(uid) {
		this.#fs = new OBFileSystem(uid)
		this.#loading = this.#fs.watch();
        await this.#loading;
        this.#loading = null;
		this.fsUI.setRoot(this.#fs, "", "")
	}
	
    /**
     * @param {string} id - The board ID to get the file stat for.
     * @returns {Promise<OBFStats|null>} - A promise that resolves to the file stat for the board ID, or null if not found.
     * @async
     */
	async getBoardInfo(id) {
        let info = null;
        if (this.#fs) {
            if (this.#loading) {
                await this.#loading;
            }
            info = this.#fs.statByID(id)
        }
        return info;
	}
	
	static get usedStyleSheets() {
		return [
			...OBFinder.usedStyleSheets,
            import.meta.resolve("./finder-styles.css"),
		]
	}
}
