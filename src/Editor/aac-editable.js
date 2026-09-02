import { AACButton, AACClick, AACGrid } from "../AACWebComponent/aac.js";
import { OBBoard } from "../OpenBoard/openboard.js";
import { OBBoardEditable } from "../OpenBoard/openboard-editable.js";

/**
 * Editor AAC Variations
 */
class AACButtonEditable extends AACButton {
     /**
     * @param {string} button_id
     * @param  {OBBoard} board
     * @param {string} group
     */
    constructor(button_id, board, group) {
        super(button_id, board, group)
        const {button} = this;
        if (!button || button.hidden) {
            this.colorTheme = "hidden";
        }
    }

    get buttonID() { return this.button.id }

    /**
     * This method allows the user to edit the label of the button.
     * @param {(value: string) => any} onUpdate - A callback function that is called whenever the label is updated.
     * @return {Promise<string>} - A promise that resolves to the new label value when the user finishes editing.
     */
    async editLabel(onUpdate) {
        this.toggleAttribute("editing", true);
        const result = await new Promise((resolve, reject) => {
            this.displayValueElement.setAttribute("contenteditable", "plaintext-only");
            
            this.displayValueElement.addEventListener("input", (e) => {
                if (onUpdate instanceof Function) onUpdate(this.displayValueElement.innerText);
            })

            this.displayValueElement.addEventListener("blur", (e) => {
                const newValue = this.displayValueElement.innerText;
                this.displayValueElement.removeAttribute("contenteditable");
                resolve(newValue);
            })

            this.displayValueElement.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    this.displayValueElement.blur();
                }
            })

            this.displayValueElement.focus();
            document.execCommand("selectAll", false, null);
        })
        return result;
    }
}


/**
 * AACEditorGrid is a specialized grid layout for editing AAC boards. 
 * It allows for selecting and editing buttons within the grid, supporting multi-selection 
 * with the Shift key. The class manages the selection state and provides
 * methods for editing button labels.
 */
class AACEditorGrid extends AACGrid {
    #selectedButtonIDs = new Set();
    #isMultiSelectOn = false;


    constructor() {
        super();
        window.addEventListener("keydown", (e) => {
            if (e.key === "Shift") { this.#isMultiSelectOn = true; }
        });
        window.addEventListener("keyup", (e) => {
            if (e.key === "Shift") { this.#isMultiSelectOn = false; }
        });

        let dragStarted = null;
        let dragSelection = []
        let removeSelection = () => {
            if (dragStarted) {
                dragStarted.selection.remove();
                if (dragSelection.length > 0 && dragStarted.valid) {
                    let oldSelection = this.#isMultiSelectOn ? new Set(this.#selectedButtonIDs) : [];
                    this.#selectedButtonIDs = new Set([...oldSelection, ...dragSelection])
                    this.#updateSelection();
                    this.triggerSelectionUpdate();
                }   
            }
            dragStarted = null;
        }

        this.events = {
            mousemove: (e) => {
                if (e.buttons === 1) {
                    if (!dragStarted) {
                        dragStarted = {
                            event: e,
                            selection: this.createChild("div", {
                                class: "drag-selection",
                                styles: {
                                    position: "fixed",
                                    "pointer-events": "none",
                                }
                            })
                        }
                    } else {
                        const {event, selection} = dragStarted;
                        const x1 = Math.min(event.clientX, e.clientX);
                        const y1 = Math.min(event.clientY, e.clientY);
                        const x2 = Math.max(event.clientX, e.clientX);
                        const y2 = Math.max(event.clientY, e.clientY);
                        const width = x2 - x1;
                        const height = y2 - y1;
                        
                        selection.style.left = `${x1}px`;
                        selection.style.top = `${y1}px`;
                        selection.style.width = `${width}px`;
                        selection.style.height = `${height}px`;

                        if (width > 10 || height > 10) {
                            selection.style.border = "2px dashed rgb(65, 96, 248)"
                            dragStarted.valid = true;
                        }

                        dragSelection = [];
                        for (let button of this.querySelectorAll("access-button")) {
                            const rect = button.getBoundingClientRect();
                            const isIntersecting = !(rect.right < x1 || rect.left > x2 || rect.bottom < y1 || rect.top > y2);
                            button.highlight = isIntersecting || this.#selectedButtonIDs.has(button.buttonID);
                            if (isIntersecting) {
                                dragSelection.push(button.buttonID);
                            } 
                        }
                    }
                } else {
                    removeSelection()
                }
            },
            mouseleave: (e) => removeSelection(),
            mouseup: (e) => removeSelection(),

            /** @param {AACClick} e */
            ["aac-click"](e) {
                this.select(e.button.id)
            }
        }
    }

    triggerSelectionUpdate() {
        if (this.onSelection instanceof Function) {
            this.onSelection([...this.#selectedButtonIDs]);
        }
    }

    getAACButtonClass(board) {
        const root = this;
        class B extends AACButtonEditable { 
            constructor(button_id, group) { 
                super(button_id, board, "aa-"+group); 
                this.events = {
                    "dblclick": () => {
                        if (root.onDoubleClick instanceof Function) {
                            root.onDoubleClick(button_id);
                        }
                    }
                }
            } 
        }
        return B;
    }   


    /**
     * Applies the current selection to the buttons in the grid,
     * highlighting and selecting them as appropriate.
     */
    #updateSelection() {
        let newSelection = new Set();
        for (let button of this.querySelectorAll("access-button")) {
            button.highlight = this.#selectedButtonIDs.has(button.buttonID);
            button.selected = this.#selectedButtonIDs.has(button.buttonID);
            if (this.#selectedButtonIDs.has(button.buttonID)) {
                newSelection.add(button.buttonID);
            }
        }
        this.#selectedButtonIDs = newSelection;
    }


    /**
     * @param {OBBoardEditable} board
     */
    onBoardSet(board){  
        this.#updateSelection();
        this._boardOrder = board?.grid?.order ?? [[]]
        this._boardSize = [
            board?.grid?.rows ?? 1,  board?.grid?.columns ?? 1
        ];
    }


    /**
     * Selects the next button in the specified direction relative to the current selection.
     * If the selection is at the edge of the grid, it will wrap around to the opposite side.
     * @param {string} direction - The direction to move the selection ("up", "down", "left", "right").
     */
    selectNextCell(direction) {
        const order = this._boardOrder;
        const dirs = {"up": [0, -1], "down": [0, 1], "left": [-1, 0], "right": [1, 0]};
        const [rows, cols] = this._boardSize;

        let id2pos = {}
        order.forEach((row, r) => {
            row.forEach((id, c) => {
                if (id) {
                    id2pos[id] = [r, c];
                }
            });
        });

        const dir = dirs[direction] ?? [1, 0];

        let oldIDs = [...this.#selectedButtonIDs];
        let newIDs = oldIDs.map(id => {
            let [r, c] = id2pos[id];
            let [dc, dr] = dir;
            let newR = r + dr;
            let newC = c + dc;

            // wrap around logic
            if (newC < 0) {
                if (newR > 0) {
                    newC = cols-1;
                    newR -= 1;
                } else {
                    newR = 0;
                    newC = 0;
                }
            } else if (newC >= cols) {
                if (newR < rows - 1) {
                    newC = 0;
                    newR += 1;
                } else {
                    newC = cols - 1;
                    newR = rows - 1;
                }
            }

            return order[newR]?.[newC] ?? null;
        }).filter(Boolean);

        if (this.#isMultiSelectOn) {
            newIDs = [...oldIDs, ...newIDs];
        } 

        this.#selectedButtonIDs = new Set(newIDs);
        this.#updateSelection();
        this.triggerSelectionUpdate();
    }

    /**
     * Forces the selection to a single button
     * @param {string} buttonID
     */
    forceSingleSelection(buttonID) {
        this.#selectedButtonIDs.clear();
        this.#selectedButtonIDs.add(buttonID);
        this.#updateSelection();
    }

    /**
     * Selects a desired button by its ID. 
     * If the button is already selected, it will be deselected.
     * If multi-select is enabled (by holding Shift), multiple buttons
     *  can be selected at once.
     * @param {string} buttonID
     */
    select(buttonID) {
        if (this.#selectedButtonIDs.has(buttonID)) {
            if (this.#isMultiSelectOn) {
                this.#selectedButtonIDs.delete(buttonID);
            } else {
                this.#selectedButtonIDs.clear();
                this.#selectedButtonIDs.add(buttonID);
            }
        } else {
            if (this.#isMultiSelectOn) {
                this.#selectedButtonIDs.add(buttonID);
            } else {
                this.#selectedButtonIDs.clear();
                this.#selectedButtonIDs.add(buttonID);
            }
        }

        for (let button of this.querySelectorAll("access-button")) {
            button.highlight = this.#selectedButtonIDs.has(button.buttonID);
            button.selected = this.#selectedButtonIDs.has(button.buttonID);
        }
        this.triggerSelectionUpdate();
    }

    /**
     * @param {string} id - The ID of the button to edit.
     * @param {(value: string) => any} onUpdate - A callback function that is called whenever the label is updated.
     * @return {Promise<string>} - A promise that resolves to the new label value when the user finishes editing.
     */
    async editLabel(id, onUpdate) {
        for (let button of this.querySelectorAll("access-button")) {
            if (button.buttonID === id) {
                this.forceSingleSelection(id);
                return button.editLabel(onUpdate);
            }
        }
    }

    get selection() {
        return [...this.#selectedButtonIDs];
    }

    set selection(value) {
        if (Array.isArray(value)) {
            this.#selectedButtonIDs = new Set(value);
            this.#updateSelection();
        } else {
            throw new Error("Selection must be an array of button IDs");
        }

        this.#updateSelection();
    }
}

export { OBBoardEditable, AACEditorGrid };