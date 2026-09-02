import { OBAction, OBBoard, OBButton, OBImage } from "./openboard.js";

class ActionsSimple {
    
    openWordFinder = { on: false }
    holdPage = { on: false }

    space = { 
        on: false,
        lastWordOnly: false,
    }
    
    speak = {
        on: false,
        mode: null,
    }
    
    inflect = { 
        on: false,
        mode: "s",
    }

    clearText = { 
        on: false,
        mode: "all"
    }

    addText = {
        on: false,
        newWord: true,
        value: null,
        utterance: null,
    }

    navigation =  {
        mode: null,
        value: null,
    }

    moveCursor = {
        on: false,
        direction: null,
        amount: null,
    }

    changeVolume = {
        on: false,
        level: null,
    }

    ACTION_PARSERS = {
        "hold_page": (action) => { this.holdPage.on = true; },
        "hold": (action) => { this.holdPage.on = true; },

        "speak": (action) => { this.speak.on = true; },

        "speak_last_word": (action) => { 
            this.speak.on = true; 
            this.speak.mode = "last_word";
        },

        "space": (action) => { this.space.on = true; },
        "open_word_finder": (action) => { this.openWordFinder.on = true; },

        "inflect_s": (action) => { 
            this.inflect.on = true; 
            this.inflect.mode = "s";
        },
        "inflect_ing": (action) => { 
            this.inflect.on = true; 
            this.inflect.mode = "ing";
        },
        "inflect_ed": (action) => {
            this.inflect.on = true; 
            this.inflect.mode = "ed";
        },
        "inflect_er": (action) => {
            this.inflect.on = true; 
            this.inflect.mode = "er";
        },
        "inflect_est": (action) => {
            this.inflect.on = true; 
            this.inflect.mode = "est";
        },


        "insert_text": (action) => {
            this.addText.on = true;
            this.addText.value = action.value;
            this.addText.newWord = true;
        },
        "append_text": (action) => {
            this.addText.on = true;
            this.addText.value = action.value;
            this.addText.newWord = false;
        },

        "delete_word": (action) => {
            this.clearText.on = true;
            this.clearText.mode = "word";
        },
        "backspace": (action) => {
            this.clearText.on = true;
            this.clearText.mode = "backspace";
        },
        "clear": (action) => {
            this.clearText.on = true;
            this.clearText.mode = "all";
        },


        "cursor_up": (action) => {
            this.moveCursor.on = true;
            this.moveCursor.direction = "up";
            this.moveCursor.amount = 1;
        },
        "cursor_down": (action) => {
            this.moveCursor.on = true;
            this.moveCursor.direction = "down";
            this.moveCursor.amount = 1;
        },
        "cursor_left": (action) => {
            this.moveCursor.on = true;
            this.moveCursor.direction = "left";
            this.moveCursor.amount = 1;
        },
        "cursor_right": (action) => {
            this.moveCursor.on = true;
            this.moveCursor.direction = "right";
            this.moveCursor.amount = 1;
        },


        "volume_up": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = "up";
        },
        "volume_down": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = "down";
        },
        "volume_mute": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = "mute";
        },
        "volume_1": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = 0.1;
        },
        "volume_2": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = 0.2;
        },
        "volume_3": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = 0.3;
        },
        "volume_4": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = 0.4;
        },
        "volume_5": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = 0.5;
        },
        "volume_6": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = 0.6;
        },
        "volume_7": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = 0.7;
        },
        "volume_8": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = 0.8;
        },
        "volume_9": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = 0.9;
        },
        "volume_10": (action) => {
            this.changeVolume.on = true;
            this.changeVolume.level = 1.0;
        }
    }
    ACTION_APPLIERS = {

        addText: (actions, button) => {
            if (this.addText.on) {
                let mode = this.addText.newWord ? "insert_text" : "append_text";
                let value = this.addText.value;
                value = ActionsSimple.sameAsLabel(value, button) ? null : value;
                actions.push({mode, value});

                if (this.addText.utterance) {
                    button.setProperty("vocalization", this.addText.utterance);
                }
            }
        },

        changeVolume: (actions, button) => {
            if (this.changeVolume.on) {
                let level = this.changeVolume.level;
                actions.push({mode: "volume_" + level});
            }
        },

        inflect: (actions, button) => {
            this.inflect.on && actions.push({mode: "inflect_" + this.inflect.mode});
        },


        space: (actions, button) => this.space.on && actions.push({mode: "space"}),


        clearText: (actions, button) => {
            if (this.clearText.on) {
                if (this.clearText.mode === "word") {
                    actions.push({mode: "delete_word"});
                } else if (this.clearText.mode === "backspace") {
                    actions.push({mode: "backspace"});
                } else {
                    actions.push({mode: "clear"});
                }
            }
        },


        moveCursor: (actions, button) => {
            if (this.moveCursor.on) {
                let direction = this.moveCursor.direction;
                actions.push({mode: "cursor_" + direction});
            }
        },

        
        speak: (actions, button) => {
            this.speak.on && actions.push({mode: "speak" + (this.speak.mode ? "_" + this.speak.mode : "")})
        },
        
  
        openWordFinder: (actions, button) => this.openWordFinder.on && actions.push({mode: "open_word_finder"}),

        navigation: (actions, button) => {
            if (this.navigation.mode === "load_board") {
                if (!button.load_board) {
                    button.setProperty("load_board", this.navigation.value);
                }
            } else {
                button.load_board = null;
                if (this.navigation.mode) {
                    actions.push({mode: this.navigation.mode, value: null});
                }
            }
        },

        holdPage: (actions, button) => this.holdPage.on && actions.push({mode: "hold"}),
    }

    /** @param {OBButtonEditable} button */
    updateFrom(button) {
        let allActions = button.allActions
        for (let action of allActions) {
            let parser = this.ACTION_PARSERS[action.mode];
            if (parser) {
                parser(action);
            }
        }
        
        let navAction = button.navigationAction;
        if (navAction) {
            this.navigation.mode = navAction.mode;
            this.navigation.value = navAction.value;
        }

        let label = (button.label || "").trim();
        if (this.addText.on) {
            // If the addText value is the same as the 
            // button label, clear it to avoid duplication
            let addTextValue = (this.addText.value || "").trim();
            if (label === addTextValue) {
                this.addText.value = null;
            }
        }

        if (button.vocalization) {
            this.addText.utterance = button.vocalization;
        }
    }

    /** @param {OBButtonEditable} button */
    applyTo(button) {
        let actions = []
        for (let key in this.ACTION_APPLIERS) {
            let applier = this.ACTION_APPLIERS[key];
            applier(actions, button);
        }
        button.setProperty("actions", actions);
    }

    static get basicActions() {
        return ["holdPage", "speak", "openWordFinder", "clearText", "navigation", "moveCursor", "space", "pulralise", "changeVolume"];
    }

    static make(value, button) {
        let actions = new ActionsSimple();

        if (value && typeof value === "object") {
            for (let key of this.basicActions) {
                if (key in value) {
                    actions[key] = value[key];
                }
            }

            if ("addText" in value) {
                actions.addText = value.addText;
                if (button) {
                    if (ActionsSimple.sameAsLabel(actions.addText.value, button)) {
                        actions.addText.value = null;
                    }
                } 
            }
        }
        return actions;
    }

    static sameAsLabel(text, button) {
        if (!text || !button) return false;
        let label = (button.label || "").trim();
        let value = (text || "").trim();
        return label === value;
    }
}

/** Model Editor Extension
 */
class OBButtonEditable extends OBButton {

    clear() {
        this.assign(OBButtonEditable.make({
            id: "x",
            label: "",
            actions: ["&", ":return"],
            image_id: null,
            load_board: null,
            background_color: null,
            border_color: null,
            feature_color: null,
            text_color: null,
        }))
    }

    refreshID() {
        this.id = OBButton.newID();
    }

    increaseFontSize() {
        let sizes = OBButton.fontSizes;
        let currentSize = this.font_size || "medium";
        let index = sizes.indexOf(currentSize);
        if (index < sizes.length - 1) {
            this.font_size = sizes[index + 1];
        }
    }

    decreaseFontSize() {
        let sizes = OBButton.fontSizes;
        let currentSize = this.font_size || "medium";
        let index = sizes.indexOf(currentSize);
        if (index > 0) {
            this.font_size = sizes[index - 1];
        }
    }

    setProperty(prop, value) {
        let parserKey = prop + "_parser";
        if (parserKey in this.constructor) {
            value = this.constructor[parserKey](value);
        }
        this[prop] = value;
        if (prop === "label") {
            this.actionsSimple = this.actionsSimple; // Refresh addText value if it matches the label
        }
    }

    assign(obj) {
         for (const key in this) {
            if (!(this[key] instanceof Function) && key !== "id") {
                if (key in obj) {
                    this.setProperty(key, obj[key]);
                }
            }
        }
    }

    assignStyles(obj) {
        let props = OBButton.styleProperties;
        for (let prop of props) {
            if (prop in obj) {
                this.setProperty(prop, obj[prop]);
            }
        }
    }

    get actionsSimple() {
        let actions = new ActionsSimple();
        actions.updateFrom(this);
        return actions;
    } 

    set actionsSimple(actions) {
        actions = ActionsSimple.make(actions, this);
        actions.applyTo(this);
    }

    toJSON() {
        const json = super.toJSON();
        return json;
    }
}

/**
 * @extends OBBoard<OBButtonEditable>
 */
class OBBoardEditable extends OBBoard {
    static buttons_parser(buttons) {
        return buttons.map(button => OBButtonEditable.make(button));
    }

    /**
     * @param {string[]} buttonIDs
     * @returns {OBButtonEditable[]}
     */
    getButtonsByID(buttonIDs) {
        let buttonsByID = Object.fromEntries(this.buttons.map(b => [b.id, b]));
        return buttonIDs.map(id => buttonsByID[id]).filter(b => b !== undefined);
    }


    /**
     * @param {string[]} selection array of button IDs to get the locations of
     * @returns {{rowRange: [number, number], colRange: [number, number]}}
     */
    getSelectionRange(selection) {
        const locations = this.getButtonLocations(selection);
        const rowMin = Math.min(...locations.map(l => l.rowRange[0]));
        const rowMax = Math.max(...locations.map(l => l.rowRange[1]));
        const colMin = Math.min(...locations.map(l => l.colRange[0]));
        const colMax = Math.max(...locations.map(l => l.colRange[1]));
        return {
            rowRange: [rowMin, rowMax],
            colRange: [colMin, colMax]
        }
    }

    /**
     * Un merges a button with the given ID, if it is merged with other buttons.
     * @param {string} buttonID
     * @returns {void}
     * @throws {Error} if the button is not found
     */
    unMerge(buttonID) {
        let locations = this.getButtonLocations();
        let loc = locations.find(l => l.buttonID === buttonID);
        if (loc.rowRange[0] !== loc.rowRange[1] || loc.colRange[0] !== loc.colRange[1]) {
            for (let r = loc.rowRange[0]; r <= loc.rowRange[1]; r++) {
                for (let c = loc.colRange[0]; c <= loc.colRange[1]; c++) {
                    if (r !== loc.rowRange[0] || c !== loc.colRange[0]) {
                        let newButton = OBButtonEditable.makeEmptyButton();
                        this.buttons.push(newButton);
                        this.grid.order[r][c] = newButton.id;
                    }
                }
            }
        }
    }

    /**
     * @param {string[]} buttonIDs
     * @returns {boolean} true if the buttons can be merged, false otherwise
     */
    canMerge(buttonIDs) {
        const id2loc = {};
        for (let r = 0; r < this.grid.rows; r++) {
            for (let c = 0; c < this.grid.columns; c++) {
                const id = this.grid.order[r][c];
                id2loc[id] = [r,c];
            }
        }

        const locs = buttonIDs.map(id => id2loc[id]);
        const rows = locs.map(l => l[0]);
        const cols = locs.map(l => l[1]);
        const rowRange = [Math.min(...rows), Math.max(...rows)];
        const colRange = [Math.min(...cols), Math.max(...cols)];
        
        buttonIDs = new Set(buttonIDs);
        for (let r = rowRange[0]; r <= rowRange[1]; r++) {
            for (let c = colRange[0]; c <= colRange[1]; c++) {
                const id = this.grid.order[r][c];
                if (!buttonIDs.has(id)) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * @param {string[]} buttonIDs
     * @param {string} masterButtonID
     * @throws {Error} if the buttons cannot be merged
     * @returns {void}
     */
    merge(buttonIDs, masterButtonID = buttonIDs[0]) {
        if (!this.canMerge(buttonIDs)) {
            throw new Error("Cannot merge buttons that are not in a rectangular area");
        }
        const id2loc = {};
        for (let r = 0; r < this.grid.rows; r++) {
            for (let c = 0; c < this.grid.columns; c++) {
                const id = this.grid.order[r][c];
                id2loc[id] = [r,c];
            }
        }
        buttonIDs = new Set(buttonIDs);
        this.grid.order = this.grid.order.map(row => row.map(id => buttonIDs.has(id) ? masterButtonID : id));
    }
    
    /**
     * @param {number} index index of the row to insert before or after
     * @param {boolean} before if true, insert before the index, else after
     */
    insertRow(index, before = true) {
        this.#insert(index, before, true);
    }

    /**
     * @param {number} index index of the column to insert before or after
     * @param {boolean} before if true, insert before the index, else after
     */
    insertColumn(index, before = true) {
        this.#insert(index, before, false);
    }

    /**
     * @param {Array<string>} selection array of button IDs to get the property from
     * @param {string} property the property to get from the buttons
     * @returns {any} the value of the property if all buttons have the same value, else null
     */
    getSelectionProperty(selection, property) {
        const buttons = this.getButtonsByID(selection);
        const values = new Set(buttons.map(b => {
            let value = b[property];
            if (value && typeof value === "object") {
                value = JSON.stringify(value);
            }
            return value;
        }));
        if (values.size === 1) {
            return buttons[0][property];
        } else {
            return undefined;
        }
    }

    removeUnusedButtons() {
        let usedIDs = new Set(this.grid.order.flat());
        this.buttons = this.buttons.filter(b => usedIDs.has(b.id));
    }

    /**
     * @param {string} buttonID
     * @param {OBImage} image
     * @returns {void}
     */
    setButtonImage(buttonID, image) {
        // Set the image_id of the button to the image's id
        this.getButtonByID(buttonID).image_id = image ? image.id : null;
        if (image && this.images.every(img => img.id !== image.id)) {
            this.images.push(image);
        }

       this.cleanUpImages();
    }

    cleanUpImages() {
        // Remove any images that are no longer used by any button
        // And remove links to images that are not in the list.
        const imagesByID = Object.fromEntries(this.images.map(img => [img.id, {img,  used: false}]));
        for (let button of this.buttons) {
            if (button.image_id) {
                if (imagesByID[button.image_id]) {
                    imagesByID[button.image_id].used = true;
                } else {
                    button.image_id = null;
                }
            }
        }
        this.images = Object.values(imagesByID).filter(({img, used}) => used).map(({img}) => img);
    }

    addImages(images) {
        for (let image of images) {
            if (!this.images.some(img => img.id === image.id)) {
                this.images.push(OBImage.make(image));
            }
        }
        this.cleanUpImages();
    }

    /**
     * @param {number} index
     */
    deleteRow(index) {
        if (this.grid.rows <= 1) {
            throw new Error("Cannot delete the last row");
        } else if (index < 0 || index >= this.grid.rows) {
            throw new Error("Column index out of bounds");
        }
        this.grid.order.splice(index, 1);
        this.grid.rows -= 1;

        this.removeUnusedButtons();
    }

    /**
     * @param {number} index
     */
    deleteColumn(index) {
        if (this.grid.columns <= 1) {
            throw new Error("Cannot delete the last column");
        } else if (index < 0 || index >= this.grid.columns) {
            throw new Error("Column index out of bounds");
        }
        for (let r = 0; r < this.grid.rows; r++) {
            this.grid.order[r].splice(index, 1);
        }
        this.grid.columns -= 1;
        this.removeUnusedButtons();
    }

    #insert(index, before = true, isRow = true) {
        let rangeKeyA = isRow ? "rowRange" : "colRange";
        let rangeKeyB = isRow ? "colRange" : "rowRange";
        let dirKey = isRow ? "columns" : "rows";

        let start = before ? index -1 : index;
        let end = before ? index : index + 1;
        const locations = this.getButtonLocations();
        const spanningLocations = locations.filter(l => l[rangeKeyA][0] <= start && l[rangeKeyA][1] >= end);
        const spanIDs = {};
        for (let {[rangeKeyB]: [cs, ce], buttonID} of spanningLocations) {
            for (let c = cs; c <= ce; c++) {
                spanIDs[c] = buttonID;
            }
        }
        
        let newRow = [];
        for (let i = 0; i < this.grid[dirKey]; i++) {
            if (spanIDs[i]) {
                newRow.push(spanIDs[i]);
            } else {
                let newButton = OBButtonEditable.makeEmptyButton();
                this.buttons.push(newButton);
                newRow.push(newButton.id);
            }
        }

        if (isRow) {
            this.grid.order.splice(before ? index : index + 1, 0, newRow);
            this.grid.rows += 1;
        } else {
            for (let r = 0; r < this.grid.rows; r++) {
                this.grid.order[r].splice(before ? index : index + 1, 0, newRow[r]);
            }
            this.grid.columns += 1;
        }
    }

    validate() {
        // Turn null spaces to empty buttons
        this.grid.order = this.grid.order.map((r, ri) => r.map((buttonID, ci) => {
            if (!buttonID) {
                let button = OBButtonEditable.makeEmptyButton()
                this.buttons.push(button)
                buttonID = button.id
            } 
            return buttonID
        }))
        this.removeUnusedButtons();
    }
}

export { OBBoardEditable, OBButtonEditable, ActionsSimple }