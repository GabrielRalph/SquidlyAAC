import { ActionsSimple } from "../OpenBoard/openboard-editable.js";
import { Icon } from "../Utilities/icons.js";
import { SvgPlus } from "../Utilities/utils.js";


class Checkbox extends SvgPlus {
	#value = false;
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
		this.checked = value;
	}

	get checked() {
		return this.#value;
	}
	set checked(value) {
		this.#value = value === undefined ? undefined : !!value;;
		if (value === undefined) {
			this.removeAttribute("checked");
			this.toggleAttribute("undefined", true);
		} else {
			this.toggleAttribute("undefined", false);
			this.toggleAttribute("checked", !!value);
		}
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
		this.options = []
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
			this.options.push(b)
		}
		this.note = this.createChild("div", {class: "note"})
	}
    set selected(key) {
        for (let b of this.options) {
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
     * @param {import("./editor.js").OpenBoardEditor} editor
     */
	constructor(editor) {
		super("div");
		this.class = "navigation panel"
		this.createChild("div", {
			class: "header no-select dark b-top b-bottom", 
			content: "Navigation", 
			styles: {"padding": "0.1em 0em 0.2em 0.5em"}})
		this.main = this.createChild("div", {class: "main"})
        this.modes = {
            options: this.main.createChild(NavOptions),
            preview: this.main.createChild(NavPreview, {}, () => {
                editor.setSelectionProperty("load_board", null);
            }),
            multi: this.main.createChild("div", {
                class: "wh-fill no-select centered", 
                content: "Please choose at least one button!"
            }),
            hidden: this.main.createChild("div", {
                class: "wh-fill no-select centered", 
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
				console.log("UPDATE NAVIGATION", selected)
				editor.updateSelectionActionsSimple({navigation: {
					mode: selected,
					value: null
				}});
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

		let selection = editor ? [...new Set(editor.selection)] : [];
		selection = selection.filter(id => !editor.getButtonProperty(id, "hidden"));
		if (selection.length > 0) {
			let loadBoard = editor.getSelectionProperty("load_board", selection);
          	if (loadBoard) {
				let path = await editor.getBoardPath(loadBoard.id)
                path = (path ? path.toString() : "").replace(/\\/g, " ▸ ")
                this.modes.preview.setBoard(loadBoard.id, path);
                this.modes.preview.styles = { display: null }
			} else {
				let navigations = selection.map(id => editor.getButtonProperty(id, "actionsSimple").navigation);
				let set = new Set(navigations.map(n => n.mode));

				let mode = null;
				if (set.size > 1) {
					this.modes.options.note.innerHTML = "Note: The selection contains different navigation options."
				} else {
					this.modes.options.note.innerHTML = "";
					mode = navigations[0].mode;
				}
                this.modes.options.selected = mode;
				this.modes.options.styles = { display: null }
			}
		} else {
			this.modes.multi.styles = { display: null }
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

		r.createChild("div", {class: "no-select", content: "New word"});

		r = this.main.createChild("div", {class: "row"})
		let cb2 = r.createChild(Checkbox, {events: {
			click: () => {
				this.utteranceInput.styles = {display: cb2.checked ? null : "none"}
			}
		}})
		cb2.checked = addText.utterance;
		r.createChild("div", {class: "no-select", content: "Different Vocalisation"});
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
			on: this.on.checked,
			value: value.length == 0 ? null : value,
			newWord: this.newWordCB.checked,
			utterance: utt.length == 0 ? null : utt
		}
	}
	get key() {
		return "addText";
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

		if (clearText.mode === undefined) {
			this.select.selectedIndex = -1;
		}
	}

	get value() {
		return {
			on: this.on.checked,
			mode: this.select.value
		}
	}
	get key() {
		return "clearText";
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
			on: this.on.value
		}
	}

	get key() {
		return this._key;
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
		console.log("MOVE CURSOR ACTION", actionsSimple.moveCursor)
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
        this.selected = action.direction === undefined ? undefined : direction;
		this._selected = direction;
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
			on: this.on.checked,
			direction: this.selected,
			amount: 1
        }
    }

	get key() {
		return "moveCursor";
	}
}


class ActionsPanel extends SvgPlus {
    /**
     * @param {import("./editor.js").OpenBoardEditor} editor
     */
	constructor(editor) {
		super("div");
		this.class = "actions"
		this.createChild("div", {class: "header no-select p-top p-bottom", content: "Actions"});
		this.main = this.createChild("div", {class: "main b-all"}).createChild("div");
		this.buttons = this.createChild("div", {class: "row", styles: {"padding": "0.25em"}});
		// this.buttons.createChild("div", {class: "btn-plain b-right-hover b-left-hover pad-even"}).createChild(Icon, {}, "e-add")
	}

	/**
     * @param {import("./editor.js").OpenBoardEditor} editor
     */
	updateSelection(editor) {
		this.main.innerHTML = ""
		let selection = [...new Set(editor.selection)].filter(id => !editor.getButtonProperty(id, "hidden"));
		if ( selection.length === 0) {
			this.main.createChild("div", {class: "no-select centered wh-fill", content: "Please select at least one visible button to edit actions"})
		} else {
			let sActions = selection.map(id => editor.getButtonProperty(id, "actionsSimple"));
			let action = new ActionsSimple();
			for (let key in action) {
				for (let subKey in action[key]) {
					let values = sActions.map(a => a[key][subKey]);
					let set = new Set(values.map(v => JSON.stringify(v)));
					if (set.size === 1) {
						action[key][subKey] = values[0];
					} else {
						action[key][subKey] = undefined
					}
				}
			}
			
			let actions = [
				this.main.createChild(ClearTextAction, {},  action, editor),
				this.main.createChild(AddTextAction, {},  action, editor),
				this.main.createChild(SimpleAction, {},  action, editor, "Speak Sentence", "speak"),
				this.main.createChild(SimpleAction, {},  action, editor, "Hold Page", "holdPage"),
				this.main.createChild(SimpleAction, {},  action, editor, "Space", "space"),
				this.main.createChild(SimpleAction, {},  action, editor, "Open Word Finder", "openWordFinder"),
				this.main.createChild(MoveCursorAction, {},  action, editor),
			];
			actions.map(a => {
				a.onValueChange = () => this.onValueChange();
			})
			this.actions = actions;
			this.editor = editor;
		}
	}

	onValueChange() {
        let update =  {}
		for (let actionInput of this.actions) {
			let value = actionInput.value;
			if (value.on !== undefined) {
				update[actionInput.key] = value;
			}
		}
		console.log("UPDATE ACTIONS SIMPLE", update)
		this.editor.updateSelectionActionsSimple(update);
	}
}


export { ActionsPanel, NavigationPanel };