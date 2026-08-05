import { SvgPlus } from "../Utilities/utils.js";

let activeMenu = null;

window.addEventListener("click", e => {
    if (activeMenu) {
        activeMenu.destroy();
    }
});
window.addEventListener("keydown", e => {
    if (e.key === "Escape" && activeMenu) {
        activeMenu.destroy();
    }
});

class ContextMenuItem extends SvgPlus {
    constructor(item, root) {
        let isSperator = typeof item === "string";
        super("context-menu" + (isSperator ? "-seperator" : "-item"));
        if (!isSperator) {
            this.createChild("div", {class: "icon", innerHTML: item.icon || ""});

            this.createChild("span", {content: item.label});

            this.createChild("span", {class: "binding", content: item.binding || ""});
            
            this.addEventListener("click", e => {
                item.action();
                root.destroy();
            });
        }
    }
}

export class ContextMenu extends SvgPlus {
    constructor(items, pos) {
        super("context-menu");
        activeMenu?.destroy();
        activeMenu = this;
        this.style.left = pos.x + "px";
        this.style.top = pos.y + "px";
        const div = this.createChild("div");
        for (let item of items) {
            let el = div.createChild(ContextMenuItem, {}, item, this);
        }

        this.events = {

        }
    }


    destroy() {
        this.toggleAttribute("hide", true);
        setTimeout(() => {
            this.remove();
        }, 200);
    }


    static get usedStyleSheets() {
        return [import.meta.resolve("./styles.css")]
    }
}