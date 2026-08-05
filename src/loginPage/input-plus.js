import { SvgPlus } from "../Utilities/utils.js";


class InputProxy extends SvgPlus {
    #required = false;
    getValue() {
        return this.input?.value ?? "";
    }

    setValue(value) {
        if (this.input) {
            this.input.value = value;
        }
        this._tempValue = value;
    }

    get value() {
        return this.getValue();
    }
    set value(val) {
        this.setValue(val);
    }

    validate() {
        return true;
    }
}

class CheckboxWrapper extends InputProxy {
    constructor() {
        super("label");
        this.class = "checkbox-wrapper";
        this.checkbox = this.createChild("input", {type: "checkbox"});
        this.slider = this.createChild("span", {class: "slider"});
    }

    set round(value) {
        this.toggleAttribute("round", value);
    }

     set locked(value) {
        this.toggleAttribute("locked", value);
    }


    get checked() {
        return this.checkbox.checked;
    }

    set checked(value) {
        this.checkbox.checked = !!value;
    }

    getValue() {
        return this.checked;
    }
    
    setValue(val) {
        this.checked = !!val;
    }
}

class ErrorFieldInput extends InputProxy {
    addErrorBox(root) {
        this.errorBox = root.createChild('div', {class: 'error-message'})
        this.errorBox.createChild('i', {class: 'fa-solid fa-circle-exclamation'})
        this.errorMessage = this.errorBox.createChild('span')
    }

    set error(error){
        this.toggleAttribute("invalid", typeof error == 'string');
        if (typeof error != 'string')
            error = ''
        if (this.errorMessage)        
            this.errorMessage.innerHTML = error
    }
}

class FileInputWrapper extends ErrorFieldInput {
    constructor(content) {
        super("div");
        this.class = "file-input-wrapper error-container";

        this.fileInput = this.createChild("input", {type: "file", styles: {"display": "none"}});
        
        this.fileButton = this.createChild("div", {
            class: "btn file-button", 
            events: {
                click: () => {
                    this.fileInput.click();
                }
            }
        });
        this.buttonIcon = this.fileButton.createChild("div", {styles: {display: "contents"}});
        this.buttonText = this.fileButton.createChild("span", {content: content || "Choose File"});

        this.fileName = this.createChild("span", {class: "file-name", events: {
            click: (e) => {
                this.value = null;
                this.#updateFileName();
                e.stopPropagation();
            }
        }})

        this.fileInput.onchange = () => {
            this.#updateFileName();
            this.dispatchEvent(new Event("change"));
        }

        this.addErrorBox(this);
    }

    set accept(value) {
        this.fileInput.setAttribute("accept", value);
    }

    set color(value) {
        this.fileButton.setAttribute("color", value);
    }

    set label(value) {
        this.buttonText.innerHTML = value;
    }
    get label() {
        return this.buttonText.innerHTML;
    }

    set icon(name) {
        this.buttonIcon.innerHTML = "";
        if (name.startsWith("fa")) {
            this.buttonIcon.createChild("i", {class: "icon " + name});
        } else {
            this.buttonIcon.createChild("span", {class: "icon material-symbols-outlined", content: name});
        }
    }

    #updateFileName() {
        const file = this.value;
        this.toggleAttribute("file", !!file);
        if (file) {
            this.fileName.createChild("i", {class: "fa-solid fa-file"});
            this.fileName.createChild("span", {content: file.name});
            this.fileName.createChild("i", {class: "fa-solid fa-xmark"});
        } else {
            this.fileName.innerHTML = "";
        }
    }

    getValue() {
        return this.fileInput.files[0] || null;
    }

    setValue(file) {
        this.error = null;
        if (file instanceof File) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            this.fileInput.files = dataTransfer.files;
        } else {
            this.fileInput.value = null;
        }
        this.#updateFileName();
    }

    validate() {
        if (this.required && !this.value) {
            let label = this["error-name"] || this.label || "File";
            this.error = label + " required.";
            return false;
        }
        return true;
    }
}

class TextInputWrapper extends ErrorFieldInput {
    constructor() {
        super("div");
        this.class = "text-input-wrapper error-container";
    }

    set name(value) {
        this._name = value;
    }

    get name() {
        return this._name;
    }

    set icon(name) {
        this._icon = name;
        if (this.iconContainer) {
            this.iconContainer.innerHTML = "";
            if (name.startsWith("fa")) {
                this.iconContainer.createChild("i", {class: "icon " + name});
            } else {
                this.iconContainer.createChild("span", {class: "icon material-symbols-outlined", content: name});
            }
        }
    }

    get icon() {
        return this._icon;
    }

    set autocomplete(value) {
        this.input.setAttribute("autocomplete", value);
    }

    set type(type) {
        this.build(type);
        if (type in typeInformation) {
            let info = typeInformation[type];
            if (info.validator) {
                this.validater = info.validator;
            }
        }
        this.setAttribute("type", type);
        this._type = type;
    }

    get type() {
        return this._type;
    }

    set label(value) {
        this._label = value;

        if (this.labelElement){
            this.labelElement.innerHTML = value;
        }
    }

    get label() {
        return this._label;
    }

    set min(value) {
        if (this.input) this.input.min = value;
    }

    set max(value) {
        if (this.input) this.input.max = value;
    }

     set step(value) {
        if (this.input) this.input.step = value;
    }

    build(type, element = type === "textarea" ? "textarea" : "input") {
        this.innerHTML = "";
        
        this.input = this.createChild(element, {
            class: "input-element",
            type: typeInformation[type]?.inputType || "text",
            value: this.value || "",
            events: {
                focus: () => {
                    this.classList.add("focus");
                    this.classList.add("not-empty");
                },
                blur: () => {
                    if(this.value == "") {
                        this.classList.remove("not-empty"); 
                    };
                    this.classList.remove("focus");
                },
                change: (e) => {
                    this.dispatchEvent(new Event(e));
                }
            }
        });
        if (this.name) this.name = this.name

        if (this._tempValue) {
            this.setValue(this._tempValue);
        }

        this.iconContainer = this.createChild("div", {styles: {display: "contents"}});
        if (this.icon) this.icon = this.icon; // trigger icon setter to create icon element

        this.labelElement = this.createChild("label", {class: "input-label"});
        if (this.label) this.label = this.label; // trigger label setter to set label text

        this.addErrorBox(this);
    }

    setValue(value) {
         if (value == "") {
            this.error = null
            this.classList.remove("not-empty"); 
        } else {
            this.classList.add("not-empty"); 
        }
        
        if (this.type === "datetime-local") {
            if (typeof value === "number") value = new Date(value);
            if (value instanceof Date) value = value.toISOString().slice(0,16);
        }
        if (this.input) {
         this.input.value = value;
        }
        this._tempValue = value;
    }

    validate(){
        let label = this["error-name"] || this.label;
        let message = label + " required";
        let valid = this.required ? (this.value != '' && this.value != null) : true;

        if (valid && this.validater instanceof Function) {
            try {
                valid = this.validater(this.value);
            } catch (e) {
                valid = false;
                message = e;
            }
        }

        if (!valid) {
            this.error = message
        } else {
            this.error = null;
        }
        return valid
    }
}

class SelectWrapper extends TextInputWrapper {
    constructor() {
        super("select");
        this.classList.add("select-wrapper");
        
    }

    set type(value) {

    }

    set initialContent(content) {
        if (this.input) {
            this.input.innerHTML = content;

            this.value = this.input.value; // set initial value to first option
        } 
    }

    build(){
        super.build("select", "select");
    }

    addOption(value, content, otherAttributes = {}) {
        let option = this.input.createChild("option", {value, innerHTML: content, ...otherAttributes});
        return option;
    }
}

class OtpInput extends InputProxy {
    constructor(el = "otp-input") {
        super(el);
        this.inputs = [];
        this.type = "number";
    }

    set type(value) {
        this.setAttribute("type", value);
    }

    set length(length) {
        length = parseInt(length);
        if (isNaN(length)) length = 6;
        let dir = 1;
        for (let i = this.inputs.length; i < length; i++) {
            let next = () => {
                let nextI = i + dir;
                if (nextI < 0) nextI = 0;
                if (nextI >= this.inputs.length) nextI = this.inputs.length - 1;
                this.inputs[nextI].focus();
                this.inputs[nextI].select();
            }
            let input = this.createChild("input", {
                name: "otp-" + (i+1),
                maxlength: 1,
                autocomplete: "off",
                events: {
                    paste: (e) => {
                        e.preventDefault();
                        let paste = (e.clipboardData || window.clipboardData).getData('text');
                        this.value = paste;
                        input.blur();
                    },
                    keydown: (e) => {
                        if (!e.ctrlKey && !e.metaKey && !e.altKey) {                       
                            if (this.getAttribute("type") == "number" && e.key.length == 1 && !e.key.match(/[0-9]/)) {
                                e.preventDefault();
                            } else {
                                dir = (e.key == "Backspace" || e.key == "Delete" || e.key == "ArrowLeft") ? -1 : 1;
                                let isArrow = (e.key == "ArrowLeft" || e.key == "ArrowRight");
                                if ((input.value == "" && dir == -1) || isArrow) {
                                    next();
                                    e.preventDefault();
                                }
                            }
                        }
                    },
                    keyup: (e) => {
                        if (this.getAttribute("type") == "number" && e.key.length == 1 && !e.key.match(/[0-9]/)) {
                            e.preventDefault();
                        } else {
                           
                        }
                    },
                    input: (e) => {
                        next();
                    },
                    click: (e) => {
                        input.select();
                    }
                }
            })
            this.inputs.push(input);
        }
    }

    validate() {
        let valid = this.value.length == this.inputs.length;
        return valid;
    }

    getValue() {
        return this.inputs.map(input => input.value).join("");
    }

    setValue(value) {
        this.inputs.forEach((input, i) => {
            input.value = value[i] || "";
        });
    }

    static get observedAttributes() {
        return ["value", "length", "placeholder"];
    }
}

class OtpInputWrapper extends ErrorFieldInput {
    constructor() {
        super("div");
        this.class = "otp-input-wrapper error-container";
        this.otpInput = this.createChild(OtpInput);
        this.addErrorBox(this);
    }

    set alphaNumeric(value) {
        this.otpInput.type = "";
    }

    set length(length) {
        this.otpInput.length = length;
    }

    get length() {
        return this.otpInput.inputs.length;
    }

    validate() {
        let res = false;
        if (this.otpInput.validate()) {
            this.error = null;
            res = true;
        } else {
            this.error = "Please enter the complete code";
        }
        return res;
    }

    getValue() {
        return this.otpInput.getValue();
    }

    setValue(value) {
        this.error = null;
        this.otpInput.setValue(value);
    }
}

const typeInformation = {
    "text": {
        element: TextInputWrapper,
        inputType: "text",
    },
    "number": {
        element: TextInputWrapper,
        inputType: "number"
    },
    "password": {
        element: TextInputWrapper,
        inputType: "password",
        validator: (password) => {
            if (password.length < 6) {
                throw "Password to short"
            } else {
                return true
            }
        }
    },
    "datetime-local": {
        element: TextInputWrapper,
        inputType: "datetime-local"
    },
    "email": {
        element: TextInputWrapper,
        inputType: "email",
        validator: (email) => {
            let expression = /^[^@]+@\w+(\.\w+)+\w$/
            if (expression.test(email) == true) {
                return true
            } else {
                throw "Invalid email"
            }
        }
    },
    "url": {
        element: TextInputWrapper,
        inputType: "url"
    },
    "tel": {
        element: TextInputWrapper,
        inputType: "tel"
    },
    "search": {
        element: TextInputWrapper,
        inputType: "search"
    },
    "textarea": {
        element: TextInputWrapper
    },
    "select": {
        element: SelectWrapper,
    },
    "checkbox": {
        element: CheckboxWrapper,
        noValidation: true
    },
    "file": {
        element: FileInputWrapper,
    },
    "otp": {
        element: OtpInputWrapper,
    }
}

class InputPlus extends InputProxy {
    constructor(el = "input-plus") {
        super(el);
        this.build();
    }

    get name() {
        return this._name;
    }

    set name(value) {   
        this._name = value;
        if (this.input) {
            this.input.name = value;
        }
    }

    build() {
        let innerHTML = this.innerHTML.trim();
        this.innerHTML = "";
        
        this.name = this.getAttribute("name") || "";

        let type = this.getAttribute("type") || "text";
        let TypeInfo = typeInformation[type] || typeInformation["text"];
        let Element = TypeInfo.element;
        this.type = type;
        this.input = this.createChild(Element, {});

        this.validater = this.validater

        // get all set attributes and set them to the input element
        Array.from(this.attributes).forEach(attr => {
            if (attr.name === "style") return;
            let value = attr.value;
            this.input[attr.name] = value === "" ? true : value; // if attribute is empty string, set it to true (for boolean attributes)
        })

        this.input.initialContent = innerHTML;

        return this;
    }
   
    set validater(validater) {
        if (validater instanceof Function) {
            if (this.input) {
                this.input.validater = validater;
            } 
            this._validater = validater;
        }
    }

    get validater() {
        return this._validater;
    }

    validate() {
        return this.input.validate();
    }

    clearError() {
        if (this.input) {
            this.input.error = null;
        }
    }

    static get observedAttributes() {
        return [
            "name",
            "type",
        ];
    }

    static get styleSheet() {
        return import.meta.resolve("./input-plus.css");
    }
}

class InputGroup extends InputProxy {
    constructor(el = "input-group") {
        super(el, "div");
    }

    getValue() {
        let value = {}
        if (this.inputs) {
            for (let key in this.inputs) {
                value[key] = this.inputs[key].value;
            }
        }
        return value;
    }

    setValue(value) {
        if (this.inputs) {
            if (!value || typeof value !== "object") value = {};
            for (let key in this.inputs) {
                if (key in value) {
                    this.inputs[key].value = value[key];
                } else {
                    this.inputs[key].value = null;
                }
            }
        }
    }
}

export { InputPlus, InputGroup} 

