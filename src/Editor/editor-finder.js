import { OBFileSystem, OBFStat } from "../FileTree/OBFileSystem.js";
import { OBFinder } from "../FileTree/OBFinder.js";
import { OBLoadBoard } from "../OpenBoard/openboard.js";
import { ShadowElement } from "../Utilities/utils.js";

export class BoardFinder extends ShadowElement {
    /** @type {OBFileSystem} */
    #fs = null;
    #loading = null;
    #lastSelected = null;
	constructor() {
		super("board-finder");
		this.fsUI = this.createChild(OBFinder, {events: {
            "selection-change": e => {
                let selection = this.fsUI.selection;
                this.selectButton.disabled = true;
                this.newBoardButton.disabled = true;
                if (selection.length === 1) {
                    this.newBoardButton.disabled = false;
                    const path = this.fsUI.selection[0];
                    const stat = this.#fs.stat(path);
                    if (stat && stat.isBoard) {
                        this.selectButton.disabled = false;
                        this.#lastSelected = stat;
                    }
                }
            }
        }})

        this.fsUI.onDoubleClick = (e, root, fstat) => {
            if (fstat.isBoard) {
                this._onSelect(fstat);
            }
        }
        
		let options = this.createChild("div", {class: "finder-options"});
        let left = options.createChild("div", {class: "left"});
        let right = options.createChild("div", {class: "right"});
        this.newBoardButton = left.createChild("button", {content: "new board",
            events: {click: () => {
                this.fsUI.newBoard();
            }}
        })
        this.newBoardButton.disabled = true;

        // options.createChild("button", {content: "new board"})
        right.createChild("button", {content: "cancel",
            events: {click: () => {
                this._onSelect(null);
            }}
        })
        this.selectButton = right.createChild("button", {
            content: "select", 
            primary: true,
            events: {click: () => {
                this._onSelect();
            }}
        })
        this.selectButton.disabled = true;
	}

    _onSelect(value = this.#lastSelected){
        if (this.onSelect instanceof Function) {
            let linkedBoard = value instanceof OBFStat ? OBLoadBoard.make({id: value.boardID}) : value;
            this.onSelect(linkedBoard);
        }
    }

    async assignUser(uid) {
		this.#fs = new OBFileSystem(uid)
		this.#loading = this.#fs.watch();
        await this.#loading;
        this.#loading = null;
        console.log("loaded fs", this.#fs)
		this.fsUI.setRoot(this.#fs, "", "")
	}
	
    /**
     * @param {string} id - The board ID to get the file stat for.
     * @returns {Promise<OBFStat|null>} - A promise that resolves to the file stat for the board ID, or null if not found.
     * @async
     */
	async getBoardInfo(id) {
        let info = null;
        if (this.#fs) {
            if (this.#loading) {
                await this.#loading;
            }
            let results = this.#fs.searchFiles(f => f.id === id);
            if (results && results.length > 0) {
                info = results[0];
            }
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
