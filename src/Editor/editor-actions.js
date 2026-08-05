import { Icon } from "../Utilities/icons.js";
import { SvgPlus } from "../Utilities/utils.js";


class Checkbox extends SvgPlus {
	constructor() {
		super("div");
		this.class = "checkbox"
		this.box = this.createChild("div", {class: "box"});
		this.addEventListener("click", () => {
			this.checked = !this.checked;
		})
	}
	get value() {
		return this.checked;
	}
	set value(value) {
		this.checked = !!value;
	}
	get checked() {
		return this.hasAttribute("checked");
	}
	set checked(value) {
		this.toggleAttribute("checked", value);
		this.dispatchEvent(new CustomEvent("change", {detail: {checked: this.checked}}))
	}
}

const NAVIGATION_ACTIONS = {
	"return": {
		title: "Return",
		info: "Return to the previously held board",
	}, 
	"back": {
		title: "Back",
		info: "Return to the previous board"
	}, 
	"home": {
		title: "Home",
		info: "Return to the home board"
	}, 
	"load_board": {
		title: "Load Board",
		info: "Load a new board"
	}
};

class NavOptions extends SvgPlus {
	constructor() {
		super("div");
		this.class = "pad-even col";
		for (let key in NAVIGATION_ACTIONS) {
			let b = this.createChild("div", {
				class: "btn",
				content: NAVIGATION_ACTIONS[key].title,
				title: NAVIGATION_ACTIONS[key].info,
				events: {
					click: () => {
						this.selected = key == this.selected ? null : key;
						this.onChange()
					}
				}
			})
            b.key = key;
		}
	}
    set selected(key) {
        for (let b of this.children) {
            b.toggleAttribute("selected", b.key === key);
        }
        this._selected = key;
    }

	get selected() {
		return this._selected;
	}

	onChange() {}
}

class NavPreview extends SvgPlus {
    constructor(onDelete) {
        super("div");
        this.class = "navigation-preview"
        let row = this.createChild("div", {class: "row b-bottom"})
        this.label = row.createChild("div", {class: "label"}).createChild("div", {content: "Board to load"});
        row.createChild("div", {
            class: "pad-even btn-plain b-left-hover",
            events: { click: () => onDelete() }
        }).createChild(Icon, {}, "trash")
        this.viewer = this.createChild("iframe", {
			class: "viewer",
			src: "../View/?board=123&mode=preview",
		}) 
    }

    setBoard(id, path) {
        this.label.innerHTML = path;
        this.viewer.contentWindow.postMessage({
            type: "updateBoard",
            id: id,
            mode: "preview"
        }, "*");
    }
}

class NavigationPanel extends SvgPlus {
    /**
     * @param {OpenBoardEditor} editor
     */
	constructor(editor) {
		super("div");
		this.class = "navigation panel"
		this.createChild("div", {
			class: "header dark b-top b-bottom", 
			content: "Navigation", 
			styles: {"padding": "0.1em 0em 0.2em 0.5em"}})
		this.main = this.createChild("div", {class: "main"})
        this.modes = {
            options: this.main.createChild(NavOptions),
            preview: this.main.createChild(NavPreview, {}, () => {
                editor.setSelectionProperty("load_board", null);
            }),
            multi: this.main.createChild("div", {
                class: "wh-fill centered", 
                content: "Please choose a single button!"
            }),
            hidden: this.main.createChild("div", {
                class: "wh-fill centered", 
                content: "Please choose a button that is not hidden!"
            })
        }

        this.modes.preview.viewer.addEventListener("dblclick", async () => {
            console.log("DOUBLE CLICK")
            editor.getLinkedBoard();
        })

        this.modes.options.onChange = async () => {
            let selected = this.modes.options.selected;
            if (selected === "load_board") {
                editor.getLinkedBoard()
            } else {
                let actions = editor.getSelectionProperty("actionsSimple");
                actions.navigation.mode = selected;
                actions.navigation.value = null;
                editor.setSelectionProperty("actionsSimple", actions);
            }
        }
        this.updateSelection(editor);
	}


	/**
	 * @param {OpenBoardEditor} editor
	 */
	async updateSelection(editor) {	
		for (let key in this.modes) 
            this.modes[key].styles = { display: "none" }

		let selection = editor ? new Set(editor.selection) : new Set();
		if (selection.size > 1) {
			this.modes.multi.styles = { display: null }
		} else if (selection.size == 1) {
            let hidden = editor.getSelectionProperty("hidden");
            let loadBoard = editor.getSelectionProperty("load_board")
            if (hidden) {
                this.modes.hidden.styles = { display: null }
            } else if (loadBoard) {
				let path = await editor.getBoardPath(loadBoard.id)
                path = (path ? path.toString() : "").replace(/\\/g, " ▸ ")
                this.modes.preview.setBoard(loadBoard.id, path);
                this.modes.preview.styles = { display: null }
			} else {
                this.modes.options.selected = editor.getSelectionProperty("actionsSimple").navigation.mode;
				this.modes.options.styles = { display: null }
			}
		}
	}
}




class Action extends SvgPlus {
	constructor(title) {
		super("div");
		this.class = "action b-bottom"
		let r = this.createChild("div", {class: "row space-between"});
		r.createChild("div", {class: "label", content: title});
		this.on = r.createChild(Checkbox, {events: {
			change: () => {
				this.toggleAttribute("on", this.on.checked)
				this.onValueChange()
			}
		}});
		this.main = this.createChild("div", {class: "main"});
	}

	onValueChange() {}
}

class AddTextAction extends Action {
	constructor(actionsSimple, editor) {
		super("Write");
		let label = editor.getSelectionProperty("label") || "";

		let addText = actionsSimple.addText;
		addText = addText === label ? "" : addText;
		this.on.checked = addText.on;
		this.valueInput = this.main.createChild("input", {
			class: "main b-all",
			placeholder: label,	
			value: addText.value || "",
			events: {
				change: () => this.onValueChange()
			}
		});

		let r = this.main.createChild("div", {class: "row"})
		this.newWordCB = r.createChild(Checkbox, {
			events: { change: () => this.onValueChange() }
		})
		this.newWordCB.checked = addText.newWord;

		r.createChild("div", {content: "New word"});

		r = this.main.createChild("div", {class: "row"})
		let cb2 = r.createChild(Checkbox, {events: {
			click: () => {
				this.utteranceInput.styles = {display: cb2.checked ? null : "none"}
			}
		}})
		cb2.checked = addText.utterance;
		r.createChild("div", {content: "Different Vocalisation"});
		this.utteranceInput = this.main.createChild("input", {
			styles: {display: "none"},
			placeholder: addText.value || label,
			value: addText.utterance || "",
			events: {
				change: () => this.onValueChange()
			}
		});
	}

	get value() {
		let value = this.valueInput.value.trim();
		let utt = this.utteranceInput.value.trim();
		return {
			addText: {
				on: this.on.checked,
				value: value.length == 0 ? null : value,
				newWord: this.newWordCB.checked,
				utterance: utt.length == 0 ? null : utt
			}
		}
	}
}

class ClearTextAction extends Action {
	constructor(actionsSimple, editor) {
		super("Clear Text");
		let clearText = actionsSimple.clearText
		this.on.checked = clearText.on;
		this.select = this.main.createChild("select", {
			events: {
				change: () => this.onValueChange()
			}
		})
		let op = ["all", "word", "backspace"].map((v) => {
			let o = this.select.createChild("option", {content: v, value: v});
			o.selected = clearText.mode === v;
			return o;
		})
	}

	get value() {
		return {
			clearText: {
				on: this.on.checked,
				mode: this.select.value
			}
		}
	}
}

class SimpleAction extends Action {
	constructor(actionsSimple, editor, title, key = title) {
		super(title);
		this.on.checked = actionsSimple[key].on;
		this._key = key;
	}

	get value() {
		return {
			[this._key]: {
				on: this.on.checked
			}	
		}
	}
}

const CURSOR_DIRECTIONS = {
    up: {icon: "▲", title: "Move Cursor Up"},
    left: {icon: "◀", title: "Move Cursor Left", default: true},
    down: {icon: "▼", title: "Move Cursor Down"},
    right: {icon: "▶", title: "Move Cursor Right"}
}
class MoveCursorAction extends Action {
    /**
     * @param {ActionsSimple} actionsSimple
     */
    constructor(actionsSimple, editor) {
        super("Move Cursor");
        let action = actionsSimple.moveCursor;
        let direction = action.direction || "left";
        this.on.checked = action.on;
        let keyGrid = this.main.createChild("div", {class: "key-grid"})
        for (let key in CURSOR_DIRECTIONS) {
            let b = keyGrid.createChild("div", {
                class: "btn pad-even",
                title: CURSOR_DIRECTIONS[key].title,
                content: CURSOR_DIRECTIONS[key].icon,
                events: {
                    click: () => {
                        this.selected = key == this.selected ? null : key;
                        this.onValueChange()
                    }
                }
            })
            b.key = key;
        }
        this.selected = direction;
    }

    set selected(key) {
        for (let b of this.main.children[0].children) {
            b.toggleAttribute("selected", b.key === key);
        }
        this._selected = key;
    }

    get selected() {
        return this._selected;
    }

    get value() {
        return {
            moveCursor: {
                on: this.on.checked,
                direction: this.selected,
                amount: 1
            }
        }
    }
}


class ActionsPanel extends SvgPlus {
    /**
     * @param {OpenBoardEditor} editor
     */
	constructor(editor) {
		super("div");
		this.class = "actions"
		this.createChild("div", {class: "header p-top p-bottom", content: "Actions"});
		this.main = this.createChild("div", {class: "main b-all"}).createChild("div");
		this.buttons = this.createChild("div", {class: "row", styles: {"padding": "0.25em"}});
		// this.buttons.createChild("div", {class: "btn-plain b-right-hover b-left-hover pad-even"}).createChild(Icon, {}, "e-add")
	}

	updateSelection(editor) {
		this.main.innerHTML = ""
		let selection = new Set(editor.selection);
		if (selection.size > 1 || selection.size === 0) {
			this.main.createChild("div", {class: "centered wh-fill", content: "Please select a single</br>button to edit actions"})
		} else if (selection.size == 1) {
            if (editor.getSelectionProperty("hidden")) {
                this.main.createChild("div", {class: "centered wh-fill", content: "Please select a button that is not hidden to edit actions"})
            } else {
                let simple = editor.getSelectionProperty("actionsSimple");
                let actions = [
                    this.main.createChild(ClearTextAction, {},  simple, editor),
                    this.main.createChild(AddTextAction, {},  simple, editor),
                    this.main.createChild(SimpleAction, {},  simple, editor, "Speak Sentence", "speak"),
                    this.main.createChild(SimpleAction, {},  simple, editor, "Hold Page", "holdPage"),
                    this.main.createChild(SimpleAction, {},  simple, editor, "Open Word Finder", "openWordFinder"),
                    this.main.createChild(MoveCursorAction, {},  simple, editor),
                ];
                actions.map(a => {
                    a.onValueChange = () => this.onValueChange();
                })
                this.actions = actions;
                this.editor = editor;
            }
		}
	}

	onValueChange() {
        let oldValue = this.editor.getSelectionProperty("actionsSimple");
		let value = this.actions.map(a => a.value).reduce((acc, val) => {
			for (let key in val) {
				acc[key] = val[key];
			}
			return acc;
		}, oldValue)
		this.editor.setSelectionProperty("actionsSimple", value);
	}
}


export { ActionsPanel, NavigationPanel };