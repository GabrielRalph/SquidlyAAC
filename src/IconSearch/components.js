import "../Utilities/bg-img.js"
import { SvgPlus } from "../SvgPlus/4.js";
import { SSymbol } from "../Firebase/symbols.js";

class CheckBox extends SvgPlus {
    constructor() {
        super("div");
        this.classList.add("checkbox");
        this.box = this.createChild("div", {class: "box"});
        this.events = {
            click: () => {
                this.checked = !this.checked;
                this.dispatchEvent(new CustomEvent("change", {detail: this.checked}));
            }
        }
    }

    get checked() {
        return this.hasAttribute("checked");
    }

    set checked(value) {
        this.toggleAttribute("checked", value);
    }

    get value() {
        return this.checked;
    }

    set value(val) {
        this.checked = val;
    }
}

class OptionSlider extends SvgPlus {
    #value = null;
    constructor(options = []) {
        super("option-slider");
        let resizeObserver = new ResizeObserver(() => this.#render());
        resizeObserver.observe(this);
        this.options = options;

        setTimeout(() => {
            this.styles = {
                "--transition": "transform 0.3s ease, width 0.3s ease"
            }
        }, 50)
    }

    #render() {
        let [p,s] = this.bbox;
        for (let option of this.children) {
            option.classList.toggle("selected", option.value === this.#value);
            if (option.value === this.#value) {
                let [op, os] = option.bbox;
                let or = op.sub(p);
                this.styles = {
                    "--x": `${or.x}px`,
                    "--y": `${or.y}px`,
                    "--width": `${os.x}px`,
                    "--height": `${os.y}px`
                }
            }
        }
    }

    select(value, triggerEvent = true) {
        value = value + "";
        this.#value = value;
        this.#render();
        if (triggerEvent) {
            this.dispatchEvent(new CustomEvent("change", {detail: value}));
        }
    }

    set options(list) {
        for (let item of list) {
            let itemValue = item.value + "";
            let option =this.createChild("option", {
                content: item.name,
                styles: item.styles ?? {},
                events: {
                    click: () => {
                        this.select(itemValue);
                    }
                }
            });
            option.value = itemValue;
        }
        this.select(list[0].value, false);
    }

    set value(value){
        this.select(value, false);
    }
    get value() {
        return this.#value;
    }


}

class SymbolDisplay extends SvgPlus {
    /**
     * @param {SSymbol} image
     * @param {(image: SSymbol, e: MouseEvent) => any} onSelect
     * @returns {SymbolDisplay}
     */
    constructor(image, onSelect) {
        super("div");
        this.props = {
            class: "image-box",
            title: image.name,
            "min-distance": image.distance,
            "image-id": image.id,
            events: {
                click: (e) => {
                    onSelect(image, e);
                }
            },
        }

        if (image.symbolSetDisplayName) {
            this.setAttribute("symbol-set", image.symbolSetDisplayName);
        }

        this.toggleAttribute("public", image.public);
        this.toggleAttribute("owner", image.isOwner);
        this.createChild("bg-img", {
            src: image.selectedURL,
        })
    }

}



class SelectionItem extends SvgPlus {
    constructor(content) {
        super("selection-item");
        this.checkBox = this.createChild(CheckBox, {events: {
            change: (e) => {
                this.dispatchEvent(new Event("change"));
            }
        }});
        this.createChild("div", {class: "content", content: content.name});
        this._value = content.value;
        this.onclick = (e) => {
            if (!this.checkBox.contains(e.target)) {
                this.checkBox.checked = !this.checkBox.checked;
            }
        };
        
    }

    get checked() {
        return this.checkBox.checked;
    }
    get value() {
        return  this._value;
    }
}

class SelectionToggle extends SvgPlus {
    constructor(headerTitle, items) {
        super("selection-toggle");
        let head = this.createChild("div", {class: "header"});
        this.allCheckbox = head.createChild(CheckBox, {
            events: {
                change: () => this.toggleAll()
            }
        });

        head.createChild("div", {
            class: "title", 
            content: headerTitle,
            events: {
                click: () => {
                    this.toggleAll(!this.allCheckbox.checked);
                }
            }
        });
        
        this.main = this.createChild("div", {class: "main"});
        this.optionElements = []
        items.forEach(item => {
            if (item === "seperator") {
                this.main.createChild("div", {class: "seperator"});
            } else {
                this.optionElements.push(
                    this.main.createChild(SelectionItem, {events: {
                        change: (e) => {
                            if (this.checkStates.every(b => b)) {
                                this.allCheckbox.checked = true;
                            } else if (this.checkStates.every(b => !b)) {
                                this.allCheckbox.checked = false;
                            }
                            this.dispatchEvent(new Event("change"));
                        }
                    }}, item)
                );
            }
        });
    }

    toggleAll(value, triggerEvent = true) {
        if (typeof value !== "undefined") this.allCheckbox.checked = value;

        let checked = this.allCheckbox.checked;
        this.optionElements.forEach(c => c.checkBox.checked = checked);

        triggerEvent && this.dispatchEvent(new Event("change"))
    }

    get checkStates() {
        return this.optionElements.map(c => c.checked);
    }

    get value() {
        return new Set(
            this.optionElements
                .filter(c => c.checked)
                .map(c => c.value)
        );
    }

    set value(values) {
        this.optionElements
            .forEach(c => {
                c.checkBox.checked = values.has(c.value);
            });
    }
}


export { 
    SelectionToggle,
    CheckBox, 
    OptionSlider, 
    SymbolDisplay 
};