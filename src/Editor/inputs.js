import { SvgPlus } from "../../AACWebComponent/utils.js";

class InputProxy extends SvgPlus {

    get value() {
        return this.getValue();
    }

    set value(value) {
        this.setValue(value);
    }

    set placeholder(value) {
        this.setPlaceholder(value);
    }


    setPlaceholder(value) {
        if (this.input) {
            this.input.placeholder = value;
        }
    }

    getValue() {
        return this.input.value;
    }

    setValue(value) {
        this.input.value = value;
    }
}


function toRGB(hex, defaultValue = "#ffffff") {
    hex = (hex||defaultValue).replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgb(${r}, ${g}, ${b})`;
}

function toHex(rgb, defaultValue = "rgb(255, 255, 255)") {
    const result = (rgb||defaultValue).match(/\d+/g);
    if (result.length >= 3) {
        const r = parseInt(result[0]).toString(16).padStart(2, "0");
        const g = parseInt(result[1]).toString(16).padStart(2, "0");
        const b = parseInt(result[2]).toString(16).padStart(2, "0");
        return `#${r}${g}${b}`;
    }
    return "#000000";
}

class NumberWithOptions extends InputProxy {
    #options = []
    #optionIndex = 0

    constructor(options, defaultValue) {

        super("div");
        const max = Math.max(...options);
        const min = Math.min(...options);
        this.class = "number-with-options";
        let s = this.createChild("div", {class: "spinner"});
        s.createChild("button", {events: {click: () => this.nextOption(1)}});
        s.createChild("button", {events: {click: () => this.nextOption(-1)}})
        this.input = this.createChild("input", {
            type: "number", min, max, 
            value: options[0], 
            events: {
                change: this.#snapToOptions.bind(this)
            }
        });

        this.selector = this.createChild("select", {
            style: {width: 0, opacity: 0},
            events: {change: () => { this.value = this.selector.value; }}
        });
        options.forEach((option, i) => {
            this.selector.createChild("option", {value: option, content: option, selected: option === defaultValue});
        })
        this.createChild("button", {class: "options", events: {click: () => {
            this.selector.showPicker()
        }}})

        this.#options = [...options]

        if (defaultValue) {
            this.value = defaultValue;
        }
    }

    nextOption(dir) {
        let nextIndex = this.#optionIndex + dir;
        if (nextIndex < 0) nextIndex = 0;
        if (nextIndex >= this.#options.length) nextIndex = this.#options.length-1;
        this.input.value = this.#options[nextIndex];
        this.#optionIndex = nextIndex;
        this.dispatchEvent(new Event("change", {bubbles: true}));
    }

    #snapToOptions() {
        let value = this.value;
        let bestOption = this.#options[0];
        let bestOptionIndex = 0;
        this.#options.forEach((op, i) => {
            if (Math.abs(value - op) < Math.abs(value- bestOption)) {
                bestOption = op;
                bestOptionIndex = i;
            }
        })
        this.#optionIndex = bestOptionIndex;
        this.input.value = bestOption;
        this.selector.value = bestOption;
    }

    setValue(value) {
        super.setValue(value);
        this.#snapToOptions();
    }
    
}

class NullableColorInput extends InputProxy {
    constructor(defaultValue) {
        super("div");
        this.class = "nullable-color-input";
        this.box = this.createChild("div", {class: "color-box"})
        this.inputEl = this.box.createChild("input", {type: "color", events: {
            change: () => {
            },
            input: () => {
                this.isNull = false;
                console.log("COLOR CHANGE", this.inputEl.value);
                this.#updateBGColor();

            }
        }});
        
        this.createChild("div", {class: "nullifier", content: "X", events: {
            click: () => {
                this.isNull = true;
                this.dispatchEvent(new Event("change", {bubbles: true}));
            }
        }})
        this.defaultValue = toHex(defaultValue);
    }

    #updateBGColor(value = this.inputEl.value) {
        this.box.style.backgroundColor = value;
    }

    set isNull(value) {
        this._isNull = value;
        this.toggleAttribute("null", value);
    }
    get isNull() {
        return this._isNull;
    }

    getValue() {
        return this.isNull ? null : toRGB(this.inputEl.value, this.defaultValue);
    }
    setValue(value) {
        if (value) {
            this.isNull = false;
            this.inputEl.value = toHex(value, this.defaultValue);
        } else {
            this.isNull = true;
            this.inputEl.value = this.defaultValue;
        }
        this.#updateBGColor();
    }
}

class TextInput extends SvgPlus {
    constructor() {
        super("input");
        this.props = {
            type: "text",
        }
    }
}

class LabeledInput extends InputProxy {
    constructor(label, cDef, ...props) {
        super("div");
        this.class = `labeled-input ${cDef.name}`;
        this.label = this.createChild("label", {content: label});
        this.input = this.createChild(cDef, {}, ...props);
    }
}

class ToggleInput extends InputProxy {
    #value = false;
    constructor(label, defaultValue) {
        super("div");
        this.class = "toggle-input";
        this.events = {
            click: () => {
                this.value = !this.value;
                this.dispatchEvent(new Event("input", {bubbles: true}));
                this.dispatchEvent(new Event("change", {bubbles: true}));
            }
        }
    }

    getValue() {
        return this.#value;
    }

    setValue(value) {
        this.#value = value;
        this.toggleAttribute("on", value);
    }
}

class InputGroup extends InputProxy {
    getValue() {
        let value = {};
        for (let key in this.inputs) {
            let subValue = this.inputs[key].value;
            if (this.parsers[key]) {
                subValue = this.parsers[key](subValue);
            }
            value[key] = subValue;
        }
        return value;
    }

    setValue(value) {
        if (typeof value === "object" && value !== null) {
            for (let key in this.inputs) {
                if (value[key] !== undefined) {
                    this.inputs[key].value = value[key];
                }
            }
        }
    }
}

export {
    LabeledInput,
    NullableColorInput,
    NumberWithOptions,
    TextInput,
    ToggleInput,
    InputProxy,
    InputGroup
}