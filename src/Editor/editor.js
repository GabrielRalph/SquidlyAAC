import { AACBoard} from "../AACWebComponent/aac.js";
import { AACEditorGrid, OBBoardEditable } from "./aac-editable.js";
import { ColorPicker } from "../Utilities/color-picker.js";
import { FastFindImageList, ImageFinder } from "../IconSearch/image-finder.js";
import { OBBoard, OBButton, OBImage, OBLoadBoard } from "../OpenBoard/openboard.js";
import { ActionsPanel, NavigationPanel } from "./editor-actions.js";
import { Icon } from "../Utilities/icons.js";
import { BoardFinder } from "./editor-finder.js";
import { META_KEY, registerKeyBindings, setActiveKeyBindingSet } from "../Utilities/keybindings.js";
import { AACGridCanvas } from "../AACWebComponent/aac-canvas.js";
import { openFiles, openNewEditor, openViewer } from "../Utilities/shared.js";
import { SvgPlus } from "../SvgPlus/4.js";
import { ShadowElement } from "../SvgPlus/shadow-element.js";


/*****************************************************************************
 *                              DROP DOWN MENUS
 *****************************************************************************/

// #region DROP DOWN MENUS
class FontSizeList extends SvgPlus {
    constructor(onSelect) {
        super("div");
        this.class = "selection-list";
        Object.keys(this.value2idx).map((k, i) => {
            let kCap = k[0].toUpperCase() + k.slice(1);
            this.createChild("div", {
                class: "b-bottom pad",
                events: {click: () => this.select(k)},
            }).createChild("span", {
                content: kCap, 
                styles: {"font-size": this.value2size[k]}
            })
        })
        this.onSelect = onSelect;
    }

    get value2idx() {
        return {
            "giant": 0,
            "huge": 1,
            "large": 2,
            "medium": 3,
            "small": 4,
            "tiny": 5
        }
    }
    get value2size() {
        return {
            "giant": "3em",
            "huge": "2.5em",
            "large": "2em",
            "medium": "1.5em",
            "small": "1em",
            "tiny": "0.75em"
        }
    }

    set value(value) {
        if (value !== undefined) {
            value = (value || "medium").toLowerCase();
            [...this.children].forEach((child, idx) => {
                child.toggleAttribute("selected", idx === this.value2idx[value]);
            });
        }
    }

    select(value) {
        this.onSelect(value);
    }
}
// #endregion DROP DOWN MENUS



/*****************************************************************************
 *                                TOOLBAR TOOLS
 *****************************************************************************/

// #region TOOLBAR TOOLS
function toLabel(name, joiner = "\n") {
    name = typeof name === "string" ? name : "";
    return name.split(/(?=[A-Z])/).map(s => s[0].toUpperCase() + s.slice(1)).join(joiner);
}

class ToolInterface extends SvgPlus {
    #openBoardEditor = null;

    /** 
     * Constructs a new ToolInterface instance.
     * @param {OpenBoardEditor} editor 
     */
    constructor(openBoardEditor) {
        super("div");
        this.#openBoardEditor = openBoardEditor;
    }

    /**
     * @returns {OpenBoardEditor} The associated OpenBoardEditor instance.
     */
    get editor() {
        return this.#openBoardEditor;
    }

    /**
     * Called when the selection changes in the editor.
     * @param {OpenBoardEditor} editor The associated OpenBoardEditor instance.
     */
    onSelection(editor) { }

    updateSelection() {
        this.onSelection( this.editor);
    }
}

class BasicTool extends ToolInterface {
    constructor(openBoardEditor, tool) {
        super(openBoardEditor);
        this.class = "tool-icon";

        this.props = {
            title: toLabel(tool.name, " ") + (tool.binding ? ` [${tool.binding}]` : "")
        }

        this.icon = this.createChild(Icon, {}, tool.icon);
        if (tool.iconTransform) {
            this.icon.styles = {transform: tool.iconTransform};
        }

        let labelText = toLabel(tool.name);
        let lines = labelText.split("\n").length;
        let label = this.createChild("div", {
            class: "label", 
            content: labelText
        });
        if (tool.dropDown) {
            label.innerHTML += lines > 1 ? "" : "\n";
            label.createChild(Icon, {}, "down")
        }

        if (tool.onClick instanceof Function) {
            this.addEventListener("click", async e => {
                let func = tool.onClick.bind(this)
                func(openBoardEditor, e);
            });
        }

        if (tool.onSelection instanceof Function) {
            this.onSelection = tool.onSelection.bind(this);
        }

        if (tool.build instanceof Function) {
            tool.build(this, openBoardEditor);
        }
    }
}

class ImageList extends ToolInterface {
    constructor(e) {
        super(e);

        this.class = "image-list";
        this.imageList = this.createChild(FastFindImageList);
        this.imageList.onImageSelected = (image) => {
            this.editor.setButtonImages(image);
        };
        this.editor.addImageList(this.imageList);
    }

    /**
     * @param {OpenBoardEditor} editor
     */
    async onSelection(editor) {
        if (editor.selection.length == 1) {
            const label = editor.getSelectionProperty("label");
            this.imageList.search(label);
        }
    }
}

class NumberInput extends ToolInterface {
    constructor(e, tool) {
        super(e);
        this.class = "number-input";

        this.props = {
            title: toLabel(tool.name, " ") + (tool.binding ? ` [${tool.binding}]` : "")
        }

        const iw = this.createChild("div", {
            class: "input-wrapper"
        });

        this.input = iw.createChild("input", {
            type: "number",
            min: tool.min,
            max: tool.max,
            events: {
                input: (e) => {
                    this.value = this.input.value;
                },
                change: (e) => {
                    let value = parseFloat(e.target.value);
                    value = Number.isNaN(value) ? this.min : value;
                    this.value = value;
                    this.#runChange();
                }
            }
        });
        this.min = tool.min;
        this.max = tool.max;

        const s = iw.createChild("div", {
            class: "spinner"
        });

        let step = tool.step || 1
        let up = s.createChild("div", {
            events: {
                click: () => {
                    this.step(step);
                }
            }
        })
        up.createChild(Icon, {}, "up")
        this.upSpinner = up;

        let down = s.createChild("div", {
            events: {
                click: () => {
                    this.step(-step);
                }
            }
        })
        down.createChild(Icon, {}, "down")
        this.downSpinner = down;


        this.createChild("div", {
            class: "label",
            content: toLabel(tool.name)
        });

        if (tool.onSelection instanceof Function) {
            this.onSelection = tool.onSelection.bind(this);
        }

        if (tool.onChange instanceof Function) {
            this.onChange = tool.onChange.bind(this);
        }
    }

    #runChange() {
        if (this.onChange instanceof Function) {
            this.onChange(this.editor, this.value);
        }
    }

    step(step) {
        let oldValue = this.value;
        oldValue = Number.isNaN(oldValue) ? this.min : oldValue;
        this.value = oldValue + step;
        this.#runChange();
    }

    get value() {
        return parseFloat(this.input.value);
    }

    set value(val) {
        val = parseFloat(val);
        if (!Number.isNaN(val)) {
            if (val < this.min) val = this.min;
            if (val > this.max) val = this.max;
            this.downSpinner.toggleAttribute("disabled", val == this.min);
            this.upSpinner.toggleAttribute("disabled", val == this.max);
            this.input.value = val;
        } else {
            this.downSpinner.toggleAttribute("disabled", true);
            this.upSpinner.toggleAttribute("disabled", false);
        }
    }
}

class Separator extends SvgPlus {
    constructor() { super("div"); this.class = "tool-separator"; } 
}

const Tools = {
    separator: Separator,
    types: {
        separator: Separator,
        imageList: ImageList,
        basicTool: BasicTool,
        number: NumberInput,
    },

    make(value, openBoardEditor) {
        if (typeof value === "string" && this.types[value]) {
            return new this.types[value](openBoardEditor);
        } else if (value && typeof value === "object") {
            if (value.type && this.types[value.type]) {
                return new this.types[value.type](openBoardEditor, value);
            } else {
                return new this.types.basicTool(openBoardEditor, value);
            }
        }
    }
}
// #endregion TOOLBAR TOOLS



/*****************************************************************************
 *                                KEY BINDINGS
 *****************************************************************************/

// #region KEY BINDINGS
/**
 * @type {Object.<string, (e: OpenBoardEditor) => void>}
 */
const KEY_BINDINGS = {
    /** 
     * @param {OpenBoardEditor} editor
     * */
    c(editor) {
        editor.selectCategory("content");
    },
    s(editor) {
        editor.selectCategory("styles");
    },
    l(editor) {
        editor.selectCategory("layout")
    },
    "Meta+c": (editor) => editor.copy(),
    "Meta+v": (editor) => editor.paste(),
    "Shift+Meta+v": (editor) => editor.paste(true),

    "Meta+b": (editor) => editor.toggleProperty("bold"),
    "Meta+i": (editor) => editor.toggleProperty("italic"),


    "Meta+ArrowLeft": (editor) => editor.insertLeft(),
    "Meta+ArrowRight": (editor) => editor.insertRight(),
    "Meta+ArrowUp": (editor) => editor.insertAbove(),
    "Meta+ArrowDown": (editor) => editor.insertBelow(),

    "Meta+z": (editor) => editor.undo(),
    "Shift+Meta+z": (editor) => editor.redo(),

    "Meta+m": (editor) => editor.toggleMerge(),
    "Shift+Meta+m": (editor) => editor.unMergeSelected(),
    "Meta+s": (editor) => editor.save(),

    "Meta+=": (editor) => editor.increaseFontSize(),
    "Meta+-": (editor) => editor.decreaseFontSize(),

    "Tab": (editor) => {
        editor.selectNextCell("right");
        const { selection } = editor;
        if (selection.length == 1) {
            editor.editLabel(selection[0]);
        }
    },
    "ArrowRight": (editor) => editor.selectNextCell("right"),
    "ArrowLeft": (editor) => editor.selectNextCell("left"),
    "ArrowUp": (editor) => editor.selectNextCell("up"),
    "ArrowDown": (editor) => editor.selectNextCell("down"),
    "Shift+ArrowRight": (editor) => editor.selectNextCell("right"),
    "Shift+ArrowLeft": (editor) => editor.selectNextCell("left"),
    "Shift+ArrowUp": (editor) => editor.selectNextCell("up"),
    "Shift+ArrowDown": (editor) => editor.selectNextCell("down"),
}
// #endregion KEY BINDINGS



/*****************************************************************************
 *                                TOOLS
 *****************************************************************************/

// #region TOOLS
function hideIfNoSelection({selection}) {
    this.toggleAttribute("disabled", selection.length === 0);
}
function onColorSelectionFunction(key) {
    /**
     * @param {OpenBoardEditor} editor
     */
    return function(editor) {
        const {selection} = editor;
        this.toggleAttribute("disabled", selection.length === 0); 
        this.icon.classList.remove("fill-unknown");
        this.icon.classList.remove("fill-transparent"); 

        let color = "#fffe";
        if (selection.length > 0) {
            let sColor = editor.getSelectionProperty(key);
            if (sColor === "transparent") {
                this.icon.classList.add("fill-transparent");
            }  else if (sColor === undefined) {
                color = "var(--c-darker)";
                this.icon.classList.add("fill-unknown");
            } else {
                color = sColor;
            }
        }
        this.icon.styles = {color};
    }
}
function onColorClickFunction(key) {
    /**
     * @param {OpenBoardEditor} editor
     */
    return async function(editor) {
       editor.pickColor(this, key);
    }
}

const TOP_TOOLS = [
    {
        category: "file",
        binding: "f",
        tools: [
            {
                name: "export",
                icon: "print",
                async onClick(editor) {
                    const board = editor.board;
                    const name = editor.metadata?.path?.name || "board";
                    this.toggleAttribute("loading", true);
                    await AACGridCanvas.exportBoard(board, name);
                    this.toggleAttribute("loading", false);
                },
                build(element) {
                    element.createChild("loader", {class: "loader"})
                }
            },
            {
                name: "files",
                icon: "folder-bw",
                onClick() {
                    openFiles();
                }
            },
            {
                name: "new",
                icon: "new-grid",
                onClick() {
                    openNewEditor();
                }
            }
        ]
    },
    {
        category: "content",
        binding: "c",
        tools: [
            {
                name: "copy",
                icon: "e-copy",
                binding: META_KEY + "c",
                onSelection: hideIfNoSelection,

                /** @param {OpenBoardEditor} editor */
                onClick(editor) {
                    editor.copy();
                }
            },
            {
                name: "paste",
                icon: "e-paste",
                binding: META_KEY + "v",
                onSelection(editor) {
                    this.toggleAttribute("disabled", !editor.canPaste || editor.selection.length === 0);
                },

                /** @param {OpenBoardEditor} editor */
                onClick(editor) {
                    editor.paste();
                }
            },
            {
                name: "pasteStyles",
                icon: "e-paste-b",
                binding: "Shift+" + META_KEY + "v",
                onSelection(editor) {
                    this.toggleAttribute("disabled", !editor.canPaste || editor.selection.length === 0);
                },

                /** @param {OpenBoardEditor} editor */
                onClick(editor) {
                    editor.paste(true);
                }
            },
            {
                name: "delete",
                icon: "e-delete",
                onSelection: hideIfNoSelection,
                async onClick(editor) { editor.clearSelectedButtons() }
            },
            "separator",
            {
                name: "editLabel",
                icon: "e-edit-text",
                onSelection: hideIfNoSelection,

                /** @param {OpenBoardEditor} editor */
                async onClick(editor) {
                    await editor.editLabel(editor.selection[0]);
                }
            },
            "separator",
            "imageList",
            {
                name: "findImage",
                icon: "e-image",
                onSelection: hideIfNoSelection,
                onClick(editor) {
                    editor.showImageFinder();
                }
            },
            {
                name: "deleteImage",
                icon: "e-delete-box",
                onSelection: hideIfNoSelection,

                /** @param {OpenBoardEditor} editor */
                onClick(editor) {
                    editor.setButtonImages(null);
                }
            }
        ]
    },
    {
        category: "styles",
        binding: "s",
        tools: [
            {
                name: "fill",
                icon: "e-fill",
                dropDown: true,
                onSelection: onColorSelectionFunction("background_color"),
                onClick: onColorClickFunction("background_color")
            },
            {
                name: "border",
                icon: "e-border",
                dropDown: true,
                onSelection: onColorSelectionFunction("border_color"),
                onClick: onColorClickFunction("border_color")
            },
            {
                name: "color",
                icon: "e-letter-b",
                dropDown: true,
                onSelection: onColorSelectionFunction("text_color"),
                onClick: onColorClickFunction("text_color")
            },
            "separator",
            {
                name: "size",
                icon: "e-letter-size-b",
                dropDown: true,
                onSelection: hideIfNoSelection,
                onClick(editor) {   
                    editor.pickFontSize(this, "font_size");
                }
            },
            {
                name: "bold",
                binding: META_KEY + "b",
                icon: "e-bold",

                /** @param {OpenBoardEditor} editor */
                onSelection(editor) {
                    this.toggleAttribute("selected", false);
                    if (editor.selection.length > 0) {
                        const bold = editor.getSelectionProperty("bold") ?? false;
                        this.toggleAttribute("selected", bold);
                    }
                    this.toggleAttribute("disabled", editor.selection.length == 0);
                },

                /** @param {OpenBoardEditor} editor */
                onClick(editor) {
                    this.toggleAttribute("selected", editor.toggleProperty("bold"));
                }
            },
            {
                name: "italic",
                icon: "e-italic",
                binding: META_KEY + "i",

                /** @param {OpenBoardEditor} editor */
                onSelection(editor) {
                    this.toggleAttribute("selected", false);
                    if (editor.selection.length > 0) {
                        const italic = editor.getSelectionProperty("italic") ?? false;
                        this.toggleAttribute("selected", italic);
                    }
                    this.toggleAttribute("disabled", editor.selection.length == 0);
                },

                /** @param {OpenBoardEditor} editor */
                onClick(editor) {
                    this.toggleAttribute("selected", editor.toggleProperty("italic"));
                }
            },
            "separator",
            {
                name: "labelPosition",
                icon: "e-label-at-top",
                onSelection(editor) {
                    this.toggleAttribute("disabled", editor.selection.length == 0);
                    let labelAtBottom = !!editor.getSelectionProperty("label_at_bottom");
                    this.icon.value = "e-label-at-" + (labelAtBottom ? "bottom" : "top")
                },
                onClick(editor) {
                    let labelAtBottom = editor.toggleProperty("label_at_bottom")
                    this.icon.value = "e-label-at-" + (labelAtBottom ? "bottom" : "top")
                }

            }
        ]
    },
    {
        category: "layout",
        binding: "l",
        tools: [
            {
                name: "insertLeft",
                icon: "e-insert-below",
                binding: META_KEY + "←",
                onSelection(e) {
                    let disabled = e.selection.length == 0 || !e.canInsertColumn;
                    this.toggleAttribute("disabled", disabled);
                },
                iconTransform: "rotate(90deg)",
                

                /** @param {OpenBoardEditor} editor */
                onClick(editor) {editor.insertLeft()}
                
            },
            {
                name: "insertRight",
                icon: "e-insert-below",
                binding: META_KEY + "→",
                iconTransform: "rotate(-90deg)",
                onSelection(e) {
                    let disabled = e.selection.length == 0 || !e.canInsertColumn;
                    this.toggleAttribute("disabled", disabled);
                },

                /** @param {OpenBoardEditor} editor */
                onClick(editor) {editor.insertRight()}
            },
            {
                name: "insertAbove",
                icon: "e-insert-below",
                binding: META_KEY + "↑",
                iconTransform: "rotate(180deg)",
                onSelection(e) {
                    let disabled = e.selection.length == 0 || !e.canInsertRow
                    this.toggleAttribute("disabled", disabled);
                },

                /** @param {OpenBoardEditor} editor */
                onClick(editor) {editor.insertAbove()}
            },
            {
                name: "insertBelow",
                binding: META_KEY + "↓",
                icon: "e-insert-below",
                onSelection(e) {
                    let disabled = e.selection.length == 0 || !e.canInsertRow
                    this.toggleAttribute("disabled", disabled);
                },

                /** @param {OpenBoardEditor} editor */
                onClick(editor) {editor.insertBelow()}
            },

            "separator",

            {
                type: "number",
                name: "Rows",
                min: 1,
                max: OBBoardEditable.maxRows,
                onSelection(editor) {
                    this.value = editor.rows;
                },
                onChange(editor, value) {
                    editor.setRows(value);
                }
            },

            {
                type: "number",
                name: "Columns",
                min: 1,
                max: OBBoardEditable.maxColumns,
                onSelection(editor) {
                    this.value = editor.columns;
                },
                onChange(editor, value) {
                    editor.setColumns(value);
                }
            },

            "separator",

            {
                name: "deleteRow",
                icon: "e-delete-row",

                /** @param {OpenBoardEditor} editor */
                onSelection(editor) {
                    this.toggleAttribute("disabled", !editor.canDeleteRows); 
                },


                /** @param {OpenBoardEditor} editor */
                onClick(editor) {
                    editor.deleteRows();
                }
            },

            {
                name: "deleteColumn",
                icon: "e-delete-row",
                iconTransform: "rotate(90deg)",

                /** @param {OpenBoardEditor} editor */
                onSelection(editor) {
                    this.toggleAttribute("disabled", !editor.canDeleteColumns); 
                },
                
                /** @param {OpenBoardEditor} editor */
                onClick(editor) {
                    editor.deleteColumns();
                }
            },

            "separator",

            {
                name: "merge",
                icon: "e-merge",
                binding: META_KEY + "m",

                /** @param {OpenBoardEditor} editor */
                onSelection(editor) {
                    this.toggleAttribute("disabled", !editor.canMerge); 
                },
                
                /** @param {OpenBoardEditor} editor */
                onClick(editor) {
                    editor.toggleMerge()
                }
            }

        ]
    },
]

const TOP_TOOLS_STATIC = [
    {
        name: "save",
        icon: "e-save",
		onSelection(editor) {
			this.toggleAttribute("disabled", !editor.isSaveable);
            this.toggleAttribute("loading", editor.isSaving);
		},
		onClick(editor) {
			editor.save();
		},
        build(element) {
            element.createChild("loader", {class: "loader"})
        }
    },


    {
        name: "undo",
        icon: "e-undo",
        binding: META_KEY + "Z",
        onSelection(editor) {
            this.toggleAttribute("disabled", !editor.canUndo());
        },

        onClick(editor) {
            editor.undo();
        }
        
    },
    { 
        name: "redo",
        icon: "e-redo",
        binding: "Shift+" + META_KEY + "Z",

        onSelection(editor) {
            this.toggleAttribute("disabled", !editor.canRedo());
        },
        onClick(editor) {
            editor.redo();
        }
    },

	{
		name: "clearChanges",
		icon: "trash",
		onSelection(editor) {
			this.toggleAttribute("disabled", !editor.isSaveable);	
		},
		onClick(editor) {
			editor.clearChanges();
		}
	}
]
// #endregion TOOLS



/*****************************************************************************
 *                    TOOLBAR AND SIDE PANEL LAYOUTS
 *****************************************************************************/

// #region TOOLBAR AND SIDE PANEL LAYOUTS
class GridTools extends SvgPlus {
    #selectionUpdaters = []
    constructor(openBoardEditor) {
        super("div");
        this.class = "editor-tools top";
        let topPanel = this.createChild("div", {class: "panel dark b-bottom"});
        this.selectionOptions = topPanel.createChild("div", {class: "selection-options"});

        let mainPanel = this.createChild("div", {class: "panel light tools b-bottom"});
        let staticTools = mainPanel.createChild("div", {class: "contents"});

        let createToolList = (tools, container) => {
            for (let tool of tools) {
                const toolEl = Tools.make(tool, openBoardEditor);
                container.appendChild(toolEl);
                if (SvgPlus.is(toolEl, ToolInterface)) {
                    this.#selectionUpdaters.push(toolEl);
                }
            }
        };

        createToolList(TOP_TOOLS_STATIC, staticTools);
        staticTools.createChild(Tools.separator);

        let dynamicTools = mainPanel.createChild("div", {class: "contents"});
        for (let cat of TOP_TOOLS) {
            let catEl = this.selectionOptions.createChild("div", {
                class: "category no-select pad b-right", 
                content: toLabel(cat.category),
                title: toLabel(cat.category, " ") + (cat.binding ? ` [${cat.binding}]` : ""),
                events: {click: () => this.selectCategory(cat.category)}
            });
            catEl.category = cat.category;
            let catTools = dynamicTools.createChild("div", {class: "contents"});
            createToolList(cat.tools, catTools);  
            catTools.toggleAttribute("hidden", true);
            catTools.category = cat.category;
        }
        this.dynamicTools = dynamicTools;

        this.selectCategory("content");
    }

  
    selectCategory(category) {
        for (let catEl of this.selectionOptions.children) {
            catEl.toggleAttribute("selected", catEl.category === category);
        }
        for (let catTools of this.dynamicTools.children) {
            catTools.toggleAttribute("hidden", catTools.category !== category);
        }
        if (this.onCategorySelected instanceof Function) {  
            this.onCategorySelected(category);
        }
    }

    updateSelection(selection) {
        for (let toolIcon of this.#selectionUpdaters) {
            toolIcon.updateSelection(selection);
        }
    }

}

class SidePanel extends SvgPlus {
    constructor(root) {
        super("div");
        this.class = "panel side b-right";
        this.main = this.createChild("div", {class: "main b-right"});
        this.slider = this.createChild("div", {class: "slider"});
		this.actions = this.main.createChild(ActionsPanel, {class: "actions"}, root)
		this.linkedBoard = this.main.createChild(NavigationPanel, {}, root)
		this.editor = root;
		
    }
	updateSelection() {
		this.editor.getSelectionProperty("actionsSimple");
		this.actions?.updateSelection(this.editor)
		this.linkedBoard?.updateSelection(this.editor)
	}
}
// #endregion TOOLBAR AND SIDE PANEL LAYOUTS



/*****************************************************************************
 *                          OPEN BOARD EDITOR
 *****************************************************************************/

// #region OPEN BOARD EDITOR

class OpenBoardEditor extends ShadowElement {

    static CLIPBOARD_PREFIX = "SQUIDLY_AAC_JSON:";

    /** @type {OBBoardEditable} */
    #board = null;

    #dropDown = null;

    /** @type {?Promise} */
    #dropDownPromise = null;

    #dropDownTool = null;
    
    #editingLabel = false;

    #history = [];
    #historyIndex = 0;
    #clipboardFallbackJSON = null;
    #imageLists = [];
    #imageUpdateTimeout = null;
    constructor(el = "open-board-editor") {
        super(el, new SvgPlus("editor-root"));

        let head = this.createChild("div", {
            class: "panel darker pad b-bottom centered", 
            styles: {position: "relative"}
        });

        head.createChild(Icon, {
            class: "logo"
        }, "logo-banner")

        this.titleNameSpan = head.createChild("span", {
            class: "title-name",
            content: "Squidly Board Editor"
        })
        this.titleSpan = head.createChild("span", {
            class: "title",
            content: ""
        })
        this.titleNote = head.createChild("span", {
            class: "title-note",
            content: ""
        })

        this.userSpan = head.createChild("span", {
            class: "user",
            styles: {position: "absolute", top: "0.4em", right: "1em"}
        })


        
        let tools = this.createChild(GridTools, {}, this)
        tools.onCategorySelected = (category) => {
            if (this.#dropDown) {
                this.#dropDown.select(undefined);
            }
        }
    

        let main = this.createChild("div", {class: "editor-main"});
        let sidep = main.createChild(SidePanel, {events: {
            click: (e) => {
                if (this.#dropDown) {
                    this.#dropDown.select(undefined);
                }
            }
        }}, this);
        
    
        this.grid = main.createChild(AACEditorGrid, {});
        this.grid.onSelection = (ids) => {
            tools.updateSelection(ids);
            sidep.updateSelection(ids);
            if (this.#dropDown) {
                this.#dropDown.select(undefined);
            }
        }  
        this.grid.onDoubleClick = (id) => {
            this.editLabel(id);
        }

        this.gridResizeObserver = new ResizeObserver((e) => {
            let {width, height} = e[0].contentRect
            this.grid.styles = {
                "--width": width + "px",
                "--height": height + "px"
            }
        });
        this.gridResizeObserver.observe(this.grid);

        this.imageFinder = this.createChild(ImageFinder)
        this.imageFinder.onImageSelected = (image) => {
            this.setButtonImages(image);
            this.imageFinder.hide();
        }   

        this.finder = this.createChild(BoardFinder, {styles: {
            opacity: 0,
            "transition": "opacity 0.3s ease-in-out",
            "pointer-events": "none"
        }})

        this.#board = OBBoardEditable.makeEmptyBoard(4,5)
        tools.updateSelection(this.selection);
        registerKeyBindings("ob-editor", KEY_BINDINGS, (e) => [this]);
        setActiveKeyBindingSet("ob-editor");
        this.sidePanel = sidep;
        this.tools = tools;
        this.#updateBoard(true);

    }



    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~ UDPATE METHOD ~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    
    #updateBoard(commitToHistory = true) {
        console.log("Updating board");
        if (this.onBeforeUpdate instanceof Function) {
            this.onBeforeUpdate();
        }
        let t0 = performance.now();
        this.grid.board = this.#board;
        let t1 = performance.now();
        console.log(`Board updated in ${t1 - t0} ms`);

        if (commitToHistory) {
            const lastState = this.#history[this.#historyIndex];
            const state = JSON.stringify(this.#board);
            if (lastState !== state) {
                this.#history = this.#history.slice(0, this.#historyIndex + 1);
                this.#history.push(state);
                this.#historyIndex = this.#history.length - 1;
            }
        }

        this.tools.updateSelection(this.selection);
        this.sidePanel.updateSelection();
        if (this.onUpdate instanceof Function) {
            this.onUpdate();
        }

        
    }

    forceUpdate() {
        this.grid.board = this.#board;
        this.tools.updateSelection(this.selection);
        this.sidePanel.updateSelection();
    }

    forceToolUpdate() {
        this.tools.updateSelection(this.selection);
    }


    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~ HELPER METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    /**
     * @param {string} key 
     * @return {any|undefined}
     */
    getSelectionProperty(key, selection = this.selection) {
        return this.#board.getSelectionProperty(selection, key);
    }

    /**
     * @returns {{rowRange: [number, number], colRange: [number, number]}}
     */
    getSelectionRange() {
        return this.#board.getSelectionRange(this.selection);
    }


    toggleProperty(prop, lastState) {
        const {selection} = this;
        const board = this.#board;
        let state = false;
        if (selection.length > 0) {
            const buttons = board.getButtonsByID(selection)
            const lastState = buttons.every(b => b[prop] === true);
            buttons.forEach(b => {
                b[prop] = !lastState;
            });
            state = !lastState;
            this.#updateBoard();
        }
        return state;
    }


    setSelectionProperty(prop, value) {
        const {selection} = this;
        if (selection.length > 0) {
            let t0 = performance.now();

            const buttons = this.#board.getButtonsByID(selection);
            buttons.forEach(b => { b.setProperty(prop, value) });

            let t1 = performance.now();
            console.log(`Selection property updated in ${t1 - t0} ms`);
            this.#updateBoard();
        }
    }


    updateSelectionActionsSimple(update) {
        for (let buttonID of this.selection) {
            const button = this.#board.getButtonByID(buttonID);
            if (button && !button.hidden) {
                let newActions = button.actionsSimple;
                for (let key in update) {
                    for (let subKey in update[key]) {
                        if (update[key][subKey] !== undefined) {
                            newActions[key][subKey] = update[key][subKey];
                        }
                    }
                }
                button.actionsSimple = newActions;
            }
        }
        this.#updateBoard();
    }


    clearSelectedButtons() {
        let ids = this.selection;
        let buttons = this.#board.getButtonsByID(ids);
        buttons.forEach(b => b.clear())
        this.#updateBoard()
    }

    getButtonProperty(buttonID, prop) {
        let button = this.#board.getButtonByID(buttonID);
        if (button) {
            return button[prop];
        }
        return undefined;
    }


    async getBoardPath(boardID) {
        let fstat = await this.finder.getBoardInfo(boardID);
        return fstat?.path
    }


    save() {
        if (this.onSave instanceof Function) {
            this.onSave(this.#board);
        }
    }

    selectNextCell(direction) {
        this.grid.selectNextCell(direction);
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~ NAVIGATION ~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    selectCategory(category) {
        this.tools.selectCategory(category);
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~ IMAGE METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~ */


    addImageList(imageList) {
        this.#imageLists.push(imageList);
    }


    updateImageLists(value) {
        this.lastFastSearchQuery = value;
        for (let imageList of this.#imageLists) {
            imageList.search(value);
        }
    }


    #triggerImageSearchUpdate(value) {
        if (this.#imageUpdateTimeout) {
            clearTimeout(this.#imageUpdateTimeout);
        }
        this.#imageUpdateTimeout = setTimeout(() => {
            this.updateImageLists(value);
            this.#imageUpdateTimeout = null;
        }, 500);
    }


    /**
     * Sets the image for all selected buttons to the specified image URL.
     * @param {string} image - The URL of the image to set for the selected buttons.
     */
    setButtonImages(image) {
        if (this.selection.length > 0) {
            for (let buttonID of this.selection) {
                this.#board.setButtonImage(buttonID, image);
            }
            this.#updateBoard();
        }
    }


    showImageFinder() {
        let query = "";
        let imageList = this.#imageLists[0];
        if (imageList) {
            query = imageList.lastQuery || "";
        }
        this.imageFinder.search(query)
        this.imageFinder.show();
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Finder Methods ~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    getLinkedBoard() {
        setActiveKeyBindingSet("ob-finder");
        this.finder.mode = "load";
        this.finder.styles = {opacity: 1, "pointer-events": "all"};
        this.finder.onSelect = (board) => {
            this.finder.styles = {opacity: 0, "pointer-events": "none"};
            setActiveKeyBindingSet("ob-editor");
            if (board instanceof OBLoadBoard) {
                this.updateSelectionActionsSimple({
                    navigation: {
                        mode: "load_board",
                        value: board
                    }
                })
            } else {
                this.updateSelectionActionsSimple({
                    navigation: {
                        mode: "return",
                        value: null
                    }
                })
            }
        }
    }

    async getNewBoard() {
        setActiveKeyBindingSet("ob-finder");
        this.finder.styles = {opacity: 1, "pointer-events": "all"};
        this.finder.mode = "save";

        const boardID = await new Promise((resolve) => {
            this.finder.onSelect = (boardID) => {
                this.finder.styles = {opacity: 0, "pointer-events": "none"};
                setActiveKeyBindingSet("ob-editor");
                resolve(boardID);
            }
        });

        return boardID;
    }

    async assignFinderUser(user) {
        await this.finder.assignUser(user)
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~ DROP DOWN HELPERS ~~~~~~~~~~~~~~~~~~~~~~~~~~ */


    #updateDropDown() {
        if (this.#dropDown) {
            if (this.selection.length === 0) {
                this.#dropDown.destroy();
            } else {
                const newColor = this.#board.getSelectionProperty(this.selection, this.#dropDown.key);
                this.#dropDown.value = newColor || null;
            }
        }
    }

    /**
     * @param {Element} tool - The tool element that was clicked.
     * @param {string} key - The property key associated with the color picker.
     * @param {new (onSelect: () => any) => SvgPlus} dropDownClass - The CSS class to apply to the dropdown.
     * @return {Promise<string>} - A promise that resolves to the selected color value.
     */
    async #createDropDownPromise(tool, key, dropDownClass) {
        const value = await new Promise((r) => {
            this.#dropDownTool = tool;      

            // Create the dropdown and position it relative to the clicked tool
            let [pos, size] = this.tools.bbox;
            let toolY = size.add(pos).y - 1;
            let toolX = tool.bbox[0].x;
            const dropDown = this.createChild(dropDownClass, {
                styles: {
                    position: "absolute", 
                    top: `${toolY}px`, 
                    left: `${toolX}px`,
                    opacity: 0,
                },
            }, r);
            dropDown.classList.add("drop-down");
            this.#dropDown = dropDown;

            // Get the initial value from the selected buttons and set it to the dropdown
            const initialValue = this.#board.getSelectionProperty(this.selection, key);
            dropDown.value = initialValue;
            dropDown.key = key;


            // After rendering the drop down, check if it goes off-screen and 
            // adjust its position if necessary
            window.requestAnimationFrame(() => {
                if (this.#dropDown) {
                    let [pos, size] = dropDown.bbox;
                    let corner = size.add(pos);
                    if (pos.x < 0) pos.x = 0;
                    if (corner.x > window.innerWidth) pos.x = window.innerWidth - size.x;
                    if (pos.y < 0) pos.y = 0;
                    if (corner.y > window.innerHeight) pos.y = window.innerHeight - size.y;
                    dropDown.styles = {left: `${pos.x}px`, top: `${pos.y}px`};
                }
                dropDown.styles = {opacity: 1};
            });
        });

        // If a value was selected, apply it to all selected buttons
        if (value !== undefined) {
            this.setSelectionProperty(key, value);
        }

        if (this.#dropDown.destroy instanceof Function) {
            this.#dropDown.destroy();
        } else {
            this.#dropDown.remove();
        }

        this.#dropDown = null;
        this.#dropDownTool = null;

        return value;
    }

    async #createDropDown(tool, key, dropDownClass) {
        let lastTool = null;

        // If a color picker is already open, close it and wait
        // for it to finish closing before opening a new one.
        if (this.#dropDownPromise) {
            lastTool = this.#dropDownTool;
            if (this.#dropDown) {
                this.#dropDown.select(undefined);
            }
            await this.#dropDownPromise;
        }

        // If the last tool is different from the current tool, open a new color picker.
        if (lastTool !== tool) {
            this.#dropDownPromise = this.#createDropDownPromise(tool, key, dropDownClass);
            await this.#dropDownPromise;
        } 
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~ COLOR PICKER METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    /**
     * @param {Element} tool - The tool element that was clicked.
     * @param {string} key - The property key associated with the color picker.
     * @return {Promise<string>} - A promise that resolves to the selected color value.
     */
    async pickColor(tool, key) {
        await this.#createDropDown(tool, key, ColorPicker);
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~ FONT SIZE DROP DOWN ~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    async pickFontSize(tool, key) {
        await this.#createDropDown(tool, key, FontSizeList);
    }

    increaseFontSize() {
        const buttons = this.#board.getButtonsByID(this.selection);
        for (let button of buttons) {
            button.increaseFontSize();
        }
        this.#updateBoard();
    }

    decreaseFontSize() {
        const buttons = this.#board.getButtonsByID(this.selection);
        for (let button of buttons) {
            button.decreaseFontSize();
        }
        this.#updateBoard();
    }   

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~ COPY/PASTE METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    /**
     * @returns {boolean} - Returns true if there are copied buttons 
     * available for pasting, false otherwise.
     */
    get canPaste() {
        return true;
    }

    /**
     * Copies the currently selected buttons in the board and stores their 
     * data for later pasting.
     */
    async copy() {
        const coppiedButtons = this.#board.getButtonsByID(this.orderedSelection);
        const imageIds = coppiedButtons.map(b => b.image_id).filter(id => id !== undefined && id !== null);
        const requiredImages = [...new Set(imageIds)].map(id => this.#board.getImageByID(id));
        const copyData = {
            buttons: coppiedButtons.map(b => b.toJSON()),
            images: requiredImages.map(img => img.toJSON())
        }
        this.#clipboardFallbackJSON = copyData;
        let copyJSON = JSON.stringify(copyData);
        const taggedText = OpenBoardEditor.CLIPBOARD_PREFIX + copyJSON;
        if (navigator.clipboard) {
            try {
                const blob = new Blob([copyJSON], { type: "application/json" });
                const textBlob = new Blob([taggedText], { type: "text/plain" });
    
                // Keep rich clipboard data for browsers that support custom types,
                // and plain text for Safari compatibility.
                const item = new ClipboardItem({
                    "web application/json": blob,
                    "text/plain": textBlob,
                });
    
                await navigator.clipboard.write([item]);
            } catch (e) {
                console.warn("clipboard.write failed, falling back to writeText", e);
                try {
                    await navigator.clipboard.writeText(taggedText);
                    console.log("Copied to clipboard using writeText fallback");
                } catch (e2) {
                    console.warn("clipboard.writeText failed; in-memory fallback clipboard is still available.", e2);
                }
            }
        } else {
            console.warn("Clipboard API not available. Using in-memory fallback clipboard.");
        }
    }

    /**
     * Pastes the copied buttons onto the currently selected buttons in the board.
     */
    async paste(onlyStyles = false) {
        try {
            const payload = await this.#readClipboardPayload();
            if (payload) {
                const {buttons, images = []} = payload;
                const n = buttons.length;
                let selectedButtons = this.#board.getButtonsByID(this.orderedSelection)
                if (n > 0 && selectedButtons.length > 0) {
                    for (let i = 0; i < selectedButtons.length; i++) {
                        const ci = i % n;
                        const copyValue = buttons[ci]
                        if (onlyStyles) {
                            selectedButtons[i].assignStyles(copyValue)
                        } else {
                            selectedButtons[i].assign(copyValue);
                        }
                    }
                    this.#board.addImages(images);
                    this.#updateBoard();
                }
            } else {
                console.warn("No copied buttons found in clipboard.");
            }
        } catch (e) {
            console.error("Error pasting buttons:", e);
        }
    }

    #extractClipboardPayloadFromText(text) {
        if (typeof text !== "string" || text.length === 0) return null;
        let raw = text;
        if (raw.startsWith(OpenBoardEditor.CLIPBOARD_PREFIX)) {
            raw = raw.slice(OpenBoardEditor.CLIPBOARD_PREFIX.length);
        }
        try {
            const data = JSON.parse(raw);
            if (data && Array.isArray(data.buttons)) {
                return data;
            }
        } catch {}
        return null;
    }

    async #getPayloadFromNavigatorClipboard() {
        try {
            const items = await navigator.clipboard.read();
            const typesInPriorityOrder = ["web application/json", "text/plain"];
            for (const item of items) {
                for (const type of typesInPriorityOrder) {
                    if (!item.types.includes(type)) continue;

                    const blob = await item.getType(type);
                    const text = await blob.text();
                    const payload = this.#extractClipboardPayloadFromText(text);
                    if (payload) {
                        return payload;
                    }
                }
            }
        } catch (e) {
            console.warn("clipboard.read failed", e);
        }
        return null;
    }

    async #readClipboardPayload() {
        let result = {buttons: [], images: []};
        if (!navigator.clipboard) {
            result = this.#clipboardFallbackJSON;
        }

        if (typeof navigator.clipboard.read === "function") {
            let payload = await this.#getPayloadFromNavigatorClipboard();
            if (payload) result = payload;
        } else if (typeof navigator.clipboard.readText === "function") {
            try {
                const text = await navigator.clipboard.readText();
                const payload = this.#extractClipboardPayloadFromText(text);
                if (payload) result = payload;
            } catch (e) {
                console.warn("clipboard.readText failed", e);
            }
        } 

        result.buttons = (result.buttons || []).map(b => OBButton.make(b));
        result.images = (result.images || []).map(i => OBImage.make(i));
        return result;
    }



    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~ LAYOUT METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    insertAbove() {
        let minRow = this.#board.getSelectionRange(this.selection).rowRange[0];
        this.#board.insertRow(minRow, true);
        this.#updateBoard()
    }
    insertBelow() {
    let maxRow = this.#board.getSelectionRange(this.selection).rowRange[1];
        this.#board.insertRow(maxRow, false);
        this.#updateBoard()
    }
    insertLeft() {
        let minCol = this.#board.getSelectionRange(this.selection).colRange[0];
        this.#board.insertColumn(minCol, true);
        this.#updateBoard();
    }
    insertRight() {
        let maxCol = this.#board.getSelectionRange(this.selection).colRange[1]
        this.#board.insertColumn(maxCol, false);
        this.#updateBoard();
    }


    setRows(rows) {
        this.#board.setRows(rows);
        this.#updateBoard();
    }


    setColumns(columns) {
        this.#board.setColumns(columns);
        this.#updateBoard();
    }


    deleteRows() {
        const {rowRange: [s,e]} = this.#board.getSelectionRange(this.selection);
        for (let r = e; r >= s; r--) {
            this.#board.deleteRow(r);
        }
        this.#updateBoard()
    }

    deleteColumns() {
        const {colRange: [s,e]} = this.#board.getSelectionRange(this.selection);
        for (let c = e; c >= s; c--) {
            this.#board.deleteColumn(c);
        }
        this.#updateBoard()
    }

    
    toggleMerge() {
        let ids = this.orderedSelection;
        if (ids.length > 1) {
            let idsSet = new Set(ids);
            if (idsSet.size === 1) {
                this.unMergeSelected()
            } else {
                this.mergeSelected()
            }
        }
    }

    mergeSelected() {
        if (this.canMerge) {
            this.#board.merge(this.orderedSelection);
        }
        this.#updateBoard();
    }

    unMergeSelected() {
        for (let id of this.selection) {
            this.#board.unMerge(id);
        }
        this.#updateBoard();
    }


    get canInsertRow() {
        return this.#board.canInsertRow();
    }

    get canInsertColumn() {
        return this.#board.canInsertColumn();
    }

    get canDeleteRows() {
        let res = false;
        const {selection} = this;
        if (selection.length > 0) {
            const {rowRange: [s,e]} = this.#board.getSelectionRange(this.selection);
            res = e-s + 1 < this.#board.grid.rows;
        }
        return res;
    }
    

    get canDeleteColumns() {
        let res = false;
        const {selection} = this;
        if (selection.length > 0) {
            const {colRange: [s,e]} = this.#board.getSelectionRange(this.selection);
            res = e-s + 1 < this.#board.grid.columns;
        }
        return res;
    }

    get canMerge() {
        let ids = this.orderedSelection;
        if (ids.length > 1) {
            return !this.getButtonProperty(ids[0], "hidden") && this.#board.canMerge(ids);
        } else {
            return false;
        }
    }


    

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~ UNDO/REDO METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~ */


    canRedo() {
        return  this.#history.length > 0 && this.#historyIndex < this.#history.length - 1;
    }

    redo() {
        if (this.canRedo()) {    
            this.#historyIndex++;
            const state = JSON.parse(this.#history[this.#historyIndex]);
            this.#board = OBBoardEditable.make(state);

            this.#updateBoard(false);
        }   
    }

    canUndo() {
        return this.#historyIndex > 0 && this.#history.length > 1;
    }

    undo() {
        if (this.canUndo()) {
            this.#historyIndex -= 1;
            const state = JSON.parse(this.#history[this.#historyIndex]);
            this.#board = OBBoardEditable.make(state);
            this.#updateBoard(false);
        }
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~ EDIT LABEL METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    async editLabel(id) {
        this.#editingLabel = true;
        this.selectCategory("content");
        let newValue = await this.grid.editLabel(id, (value) => {
            this.#triggerImageSearchUpdate(value);
        });
        this.#editingLabel = false;
        if (newValue !== undefined) {
            this.setSelectionProperty("label", newValue);
            this.#updateBoard();
        }
    }

    updateBoard(board) {
        this.#board = OBBoardEditable.make(board);
        this.#updateBoard();
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~ UNIMPLEMENTED METHODS ~~~~~~~~~~~~~~~~~~~~~~~~ */

    clearChanges() { }

    save() { }

    getIsSaveable() { return true; }

    getIsSaving() { return false; }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~ GETTERS AND SETTERS ~~~~~~~~~~~~~~~~~~~~~~~~ */

    get rows() {
        return this.#board.grid.rows;
    }

    get columns() {
        return this.#board.grid.columns;
    }

    get editingLabel() {
        return this.#editingLabel;
    }


    get isSaving() {
        if (this.getIsSaving instanceof Function) {
            return this.getIsSaving();
        }
        return false;
    }

    get isSaveable() {
        if (this.getIsSaveable instanceof Function) {
            return this.getIsSaveable();
        }
        return true;
    }

    get boardRows() {
        return this.#board.grid.rows;
    }

    get boardColumns() {
        return this.#board.grid.columns;
    }

    set board(board) {
        this.#board = OBBoardEditable.make(board);
        this.#history = [];
        this.#historyIndex = 0;
        this.#updateBoard();
    }

    get board() {
        return OBBoard.make(this.#board.toJSON());
    }

    /**
     * @returns {string[]}
     */
    get selection() {
        return this?.grid?.selection || [];
    }

    get orderedSelection() {
        let ordered = []
        let selection = new Set(this.selection);
        if (selection.size > 0) {
            let order = this.#board.grid.order.flat();
            ordered = order.filter(id => selection.has(id));
        }
        return ordered;
    }


    static get usedStyleSheets() {
        return [
            ...AACBoard.usedStyleSheets,
            import.meta.resolve("./styles.css"),
            import.meta.resolve("../IconSearch/image-search.css"),
            import.meta.resolve("../../Assets/Icons/icons.css")
        ];
    }
}

// #endregion OPEN BOARD EDITOR

export { OpenBoardEditor }