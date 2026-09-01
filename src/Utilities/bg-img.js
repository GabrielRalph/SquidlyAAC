const LOADED_CACHE = new Map();


class BackgroundImage extends HTMLElement {
    constructor(el) {
        super(el);
    }

    attributeChangedCallback(name, oldv, newv){
        this[name] = newv;
    }

    set src(value) {
        if (typeof value === "string" && value.length > 0) {
            if (LOADED_CACHE.has(value)) {
                this.toggleAttribute("loaded", true);
            } else {
                this.toggleAttribute("loaded", false);
                let load = () => {
                    this.toggleAttribute("loaded", true);
                    LOADED_CACHE.set(value, true);
                }
                let img = new Image();
                img.onload = load;
                img.onerror = load;
                img.src = value;
            }
    
            const url = value.replace(/"/g, "%22");
            this.style.backgroundImage = `url("${url}")`;
        } else {
            this.style.backgroundImage = "";
        }
    }

    static get observedAttributes() {
        return ["src"];
    }
}

customElements.define("bg-img", BackgroundImage);