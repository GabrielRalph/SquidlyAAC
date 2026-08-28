import { OBBoard, OBButton, OBImage } from "../OpenBoard/openboard.js";
import { GridCard, GridIcon, GridLayout } from "../Utilities/GridLayout/grid-icons.js";
import { ShadowElement } from "../SvgPlus/shadow-element.js"
import { AccessTextarea } from "../Utilities/Textarea/textarea.js";
import { Color } from "../Utilities/color.js";

import { Debugger, delay } from "../Utilities/shared.js";
import { AccessEvent } from "../Utilities/Access/access-buttons.js";

const debug = new Debugger(
    "AACBoard",
    "background: #b43113; color: white; padding: 5px; border-radius: 5px;"
);


class AACClick extends AccessEvent {
    /** @type {OBButton} */
    button = null;

    /** @type {AACButton} */
    element = null
    
    constructor(e, button, element) {
        super("aac-click", e, {
            bubbles: true,
        });
        this.button = button;
        this.element = element;
    }
}

class AACChange extends AccessEvent {
    constructor(e, changes) {
        super("change", e, {
            bubbles: true,
        });
        this.changes = changes;
    }
}

class AACInsert extends AccessEvent {
    constructor(e, text) {
        super("insert", e, {
            bubbles: true,
        });
        this.text = text;
        this.button = e.button;
    }
}

/**
 * @typedef {HTMLElementEventMap & {
 *   "aac-click": AACClick
 * }} AACGridEventMap
 */

/**
 * @typedef {HTMLElementEventMap & {
 *   "aac-click": AACClick,
 *   "change": AACChange,
 *   "insert": AACInsert
 * }} AACBoardEventMap
 */

class AACButton extends GridIcon {
    #button = null; 

    /**
     * @param {string} button_id
     * @param  {OBBoard} board
     * @param {string} group
     */
    constructor(button_id, board, group) {
        const button = board.getButtonByID(button_id);
        const image = board.getImageByID(button.image_id);
        const symbol = image ? image.resolvedURL : null;
        super({
            displayValue: button.label,
            symbol: symbol,
            type: button.load_board ? "folder" : "plain",
            colorTheme: "white",
            events: {
                "access-click": (e) => this.dispatchEvent(new AACClick(e, button, this))
            },
        }, group);


        let fontSize = button.font_size || "medium";
        if (fontSize !== "medium") {
            this.setAttribute("font-size", fontSize);
        }

        this.toggleAttribute("bold", button.bold);
        this.toggleAttribute("italic", button.italic);
        this.toggleAttribute("label-at-bottom", button.label_at_bottom)

        this.styles = Object.fromEntries(
            Object.entries(button.colorTheme)
                .map(([k, v]) => [`--${k}`, v])
        );
        this.#button = button;
    }

    /** @returns {OBButton} */
    get button() {
        return this.#button
    }
}

/**
 * @fires AACClick
 */
class AACGrid extends GridLayout {
    /**
     * @param {OBBoard} board
     */
    constructor() {
        super(1,1);
        this.toggleAttribute("aac", true);
    }

    /**
     * @template {keyof AACGridEventMap} K
     * @param {K} type
     * @param {(this: AACGrid, ev: AACGridEventMap[K]) => any} listener
     * @param {boolean | AddEventListenerOptions} [options]
     */
    addEventListener(type, listener, options) {
        EventTarget.prototype.addEventListener.call(this, type, listener, options);
    }


    /**
     * @param {OBBoard} board
     * @returns {new () => AACButton}
     */
    getAACButtonClass(board) {
        class B extends AACButton { 
            constructor(button_id, group) { super(button_id, board, "aac-"+group); } 
        }
        return B;
    }

    
    /**
     * @override
     */
    onBoardSet() { }


    /**
     * @param {OBBoard} board
     */
    set board(board) { 
        this.innerHTML = "";
        if (board instanceof OBBoard) {
            const {columns, rows} = board.grid;
            this.size = [rows, columns];
            const buttonLocations = board.getButtonLocations().filter(b => b.buttonID !== null);
            const bClass = this.getAACButtonClass(board);
            for (let {rowRange, colRange, buttonID} of buttonLocations) {
                this.add(new bClass(buttonID, rowRange[0]), rowRange, colRange)
            }
        } else {
            this.size = [1, 1];
        }
        this.onBoardSet(board);
    }
}

class AACBoard extends ShadowElement {
    keepCornerFree = false;
    #history = [];
    #renderedBoardID = null;
    #boardCache = {};

    /** @type {GridLayout} */
    #grid = null;

    /** @type {GridLayout} */
    #rootGrid = null;

    #closeButton = null;
    #backspaceButton = null;

    /** @type {AccessTextarea} */
    #textArea = null;

    #textAreaCard = null;

    #board = null;
    #holdBoard = null;
    #manager = null;
    constructor(el) {
        super(el, "aac-board-contents");
        this.#rootGrid = this.createChild(GridLayout, {
            events: {"aac-click":  this.#onButtonClick.bind(this)}
        }, 2, 1);
        
        this.#closeButton = this.#rootGrid.addGridIcon({
            symbol: "home",
            colorTheme: "action",
            events: {"access-click": () => this.gotoBoard(this.#manager.rootBoardID)},
            accessGroup: "apps",
            // labelOnBottom: true,
        });

        this.#closeButton.toggleAttribute("hide-for-squidly", true);
       
        this.#backspaceButton = this.#rootGrid.addGridIcon({
            symbol: "backspace",
            colorTheme: "action",
            events: {"access-click": (e) => this.#ACTION_SET.delete_word.call(this, e)},
            accessGroup: "apps",
            // labelOnBottom: true,
        });
       
        this.#textAreaCard = this.#rootGrid.createChild(GridCard, {}, "div", "plain", "textarea");
        this.#textArea = this.#textAreaCard.content.createChild(AccessTextarea, {});
    }

    /**
     * @template {keyof AACBoardEventMap} K
     * @param {K} type
     * @param {(this: AACBoard, ev: AACBoardEventMap[K]) => any} listener
     * @param {boolean | AddEventListenerOptions} [options]
     */
    addEventListener(type, listener, options) {
        EventTarget.prototype.addEventListener.call(this, type, listener, options);
    }

    /**
     * @param {AACClick} e
     */
    #runActions(e, actions, button) {
        let proms = []
        for (const action of actions) {
            if (action.mode in this.#ACTION_SET) {
                debug.log("action " + action.mode, action.value, this.historyString);
                const prom = this.#ACTION_SET[action.mode].call(this, e, action.value, button);
                if (prom instanceof Promise) {
                    proms.push(prom);
                }
            }
        }
        return Promise.all(proms);
    }

    /**
     * @param {AACClick} e
     */
    async #onButtonClick(e) {
        const {element, button} = e;
        const {load_board, allActions} = button;
        debug.logStart("button click", button.id, button)
        let gotoProm = null;
        if (load_board) {
            const id = load_board.id;
            gotoProm = this.gotoBoard(id, e);
            debug.log("gotoBoard", id, this.historyString);
        }
        let actionPorm = this.#runActions(e, allActions, button);
        debug.logEnd();
        await e.waitFor(Promise.all([gotoProm, actionPorm]));
    }

    #onStateChange(e, ...changes) {
        this.dispatchEvent(new AACChange(e, changes));
    }

    /**
     * @param  {OBBoard|string} board
     */
    async #setBoard(id) {
        let board = typeof id === "string" ? await this.#manager.getBoard(id) : id;
        if (!(board instanceof OBBoard)) {
            console.warn("Invalid board:", board, id);
        }
        if (this.#renderedBoardID !== board.id) {
            const {columns, rows} = board.grid;
            this.#rootGrid.innerHTML = "";
            this.#rootGrid.size = [rows+1, columns];
            let x = this.keepCornerFree ? 1 : 0;
            this.#rootGrid.add(this.#closeButton, 0, x);
            this.#rootGrid.add(this.#backspaceButton, 0, columns-1);
            this.#rootGrid.add(this.#textAreaCard, 0, [1 + x, columns-2]);
            let grid;
            if (board.id in this.#boardCache) {
                grid = this.#boardCache[board.id];
            } else {
                grid = new AACGrid();
                grid.board = board;
                this.#boardCache[board.id] = grid;
            }
            this.#rootGrid.add(grid, [1, rows], [0, columns-1]);
            this.#renderedBoardID = board.id;
            await delay();
            this.#textArea.updateCaretPosition(true);
            await delay(200)
        }
    }

    get historyString() {
        const holdBoard = this.#holdBoard || this.#manager.rootBoardID;
        let historyStr = this.#history.map(id => id === holdBoard ? `[${id}]` : id).join(" -> ");
        return historyStr;
    }

    #ACTION_SET = {
        space(e) {
            this.#textArea.insert(" ");
            this.#onStateChange(e, "text", "caretPosition");
        },

        return(e) {
            debug.log("return", this.historyString);
            return this.gotoBoard(null, e);
        },

        home(e) {
            debug.log("home", this.historyString);
            return this.gotoBoard(this.#manager.rootBoardID, e);
        },

        back(e) {
            debug.log("back", this.historyString);
            return this.gotoBoard(this.#history[this.#history.length - 2], e);
        },

        /**  @this {AACBoard} */
        clear(e) {
            this.#textArea.clear();
            this.#onStateChange(e, "text", "caretPosition");

        },

        delete_word(e) {
            let valueUpToCaret = this.#textArea.valueUpToCaret.trimEnd();
            let valueAfterCaret = this.#textArea.valueAfterCaret.trimStart();
            let lastSpaceIndex = valueUpToCaret.lastIndexOf(" ");
            if (lastSpaceIndex === -1) {
                this.#textArea.value = valueAfterCaret;
                this.#textArea.caretPosition = 0;
            } else {
                this.#textArea.value = valueUpToCaret.slice(0, lastSpaceIndex) + valueAfterCaret;
                this.#textArea.caretPosition = lastSpaceIndex;
            }
            this.#onStateChange(e, "text", "caretPosition");
        },

        /**  @this {AACBoard} */
        backspace(e) {
            this.#textArea.backspace();
            this.#onStateChange(e, "text", "caretPosition");
        },

        hold(e) {
            this.#ACTION_SET.hold_page.call(this, e);
        },

        hold_page(e) {
            this.#holdBoard = this.currentBoardID;
            this.#onStateChange(e, "holdBoard");
        },

        append_text(e, s, button) {
            s = s || button.label || "";
            this.#textArea.insert(s);
            this.#onStateChange(e, "text", "caretPosition");
        },

        insert_text(e, s, button) {
            s = s || button.label || "";
            let charBeforeCursor = this.#textArea.valueUpToCaret;
            let charAfterCursor = this.#textArea.valueAfterCaret;
            if (charBeforeCursor.length > 0 && !charBeforeCursor.endsWith(" ")) {
                s = " " + s;
            } 
            if (charAfterCursor.length > 0 && !charAfterCursor.startsWith(" ")) {
                s = s + " ";
            }
            this.#textArea.insert(s);
            this.dispatchEvent(new AACInsert(e, s));

            this.#onStateChange(e, "text", "caretPosition");
        },

        cursor_left(e) {
            this.#textArea.moveCaret(-1);
            this.#onStateChange(e, "caretPosition");
        },

        /**  @this {AACBoard} */
        cursor_right(e) {
            this.#textArea.moveCaret(1);
            this.#onStateChange(e, "caretPosition");
        },

        /**  @this {AACBoard} */
        cursor_down(e) {
            this.#textArea.moveCaretVertically(1);
            this.#onStateChange(e, "caretPosition");
        },

        /**  @this {AACBoard} */
        cursor_up(e) {
            this.#textArea.moveCaretVertically(-1);
            this.#onStateChange(e, "caretPosition");
        }
    }

    get history() {
        return [...this.#history];
    }

    get currentBoardID() {
        return this.#history[this.#history.length - 1] || this.#manager.rootBoardID;
    }

    get state() {
        return {
            text: this.#textArea.value,
            history: [...this.#history],
            holdBoard: this.#holdBoard,
            caretPosition: this.#textArea.caretPosition || 0
        }
    }

    set state(state) {
        if (state.text !== undefined) {
            this.#textArea.value = state.text;
        }
        if (Array.isArray(state.history)) {
            this.#history = state.history;
            this.#setBoard(this.currentBoardID);
        } 
        if (state.holdBoard !== undefined) {
            this.#holdBoard = state.holdBoard;
        }
        if (state.caretPosition !== undefined) {
            this.#textArea.caretPosition = state.caretPosition;
        }
    }

    set manager(manager) {
        this.#manager = manager;
        this.#history = [manager.rootBoardID];
        this.#holdBoard = null;
        this.#textArea.value = "";
        this.#boardCache = {};
        this.#setBoard(manager.rootBoard)
        this.#onStateChange(new AccessEvent("manager-set"), "history", "holdBoard", "text", "caretPosition");
    }

    /**
     * @param {string} boardID
     * @param {Event} e
     * @return {Promise} Resolves when the board transition is complete
     */
    async gotoBoard(boardID, e) {
        let transistionPromise = null;
        if (this.#manager) {
            const homeID = this.#manager.rootBoardID;
            
            if (!boardID || typeof boardID !== "string") {
                boardID = this.#holdBoard || homeID;
            }

            transistionPromise = this.#setBoard(boardID);
            if (boardID === homeID) {
                this.#history = [homeID];
                this.#holdBoard = null;
            } else  {
                let i = this.#history.indexOf(boardID);
                if (i === -1) {
                    this.#history.push(boardID);
                } else {
                    this.#history = this.#history.slice(0, i + 1);
                }
            }

            this.#onStateChange(e, "history", "holdBoard");
        } else {
            console.warn("No board manager set");
        }

        return transistionPromise;
    }
    
    static get usedStyleSheets() {
        return [
            import.meta.resolve("../../Assets/AACIcons/icons.css"),
            import.meta.resolve("./aac-style.css"),
            ...GridIcon.usedStyleSheets,
            ...AccessTextarea.usedStyleSheets,
        ];
    }
}

class AACGridWrapper extends ShadowElement {
    constructor(el) {
        super(el, "aac-grid-wrapper");
    }

    set board(board) {
        this.root.innerHTML = "";
        const grid = new AACGrid();
        grid.board = board;
        this.root.appendChild(grid);
    }

    static get usedStyleSheets() {
        return AACBoard.usedStyleSheets;
    }
}
export { AACBoard, AACGrid, AACGridWrapper, AACButton, AACClick, AACChange, AACInsert }
