import { SvgPlus } from "../SvgPlus/4.js";
/**
 * @typedef {Object} ContextMenuItem
 * @property {string} label - The text to display for the menu item.
 * @property {string} [icon] - Optional icon to display alongside the label.
 * @property {string} [binding] - Optional keyboard binding to display.
 * @property {Function} action - The function to execute when the item is clicked.
 */

let activeMenu = null;

window.addEventListener("click", e => {
    if (activeMenu) {
        activeMenu.destroy();
    }
}, true);

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

export class AutoPosition extends SvgPlus {
    build() {  }

    async buildAndPosition(pos, relativeTo = null) {
        this.styles = {
            left: "-10000px",
            top:  "-10000px",
        }
        this.build();
        await new Promise( requestAnimationFrame );
        this.autoPosition(pos, relativeTo);
    }

    autoPosition(pos, relativeTo = null) {
        let {innerWidth, innerHeight} = window
        
        let {x, y} = pos;


        if (relativeTo) {
            let rect = relativeTo.getBoundingClientRect();
            x += rect.left;
            y += rect.top;
            innerWidth = rect.width;
            innerHeight = rect.height;
        }

        let {width, height} = this.getBoundingClientRect();
        if (x + width > innerWidth) {
            x -= width;
            x = Math.max(x, 0);
        }
        if (y + height > innerHeight) {
            y = innerHeight - height;
            y = Math.max(y, 0);
        }
        
        this.styles = {
            left: x + "px",
            top:  y + "px",
        }
    }
}

export class ContextMenu extends AutoPosition {
    /** 
     * @param {ContextMenuItem[]} items
     * @param {{x: number, y: number}} pos
     */
    constructor(items, pos) {
        super("context-menu");
        activeMenu?.destroy();
        activeMenu = this;

        this.items = items;
        this.buildAndPosition(pos);
    }

    build() {
        const div = this.createChild("div");
        for (let item of this.items) {
            let el = div.createChild(ContextMenuItem, {}, item, this);
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