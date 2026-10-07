import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { roundedPolygon } from "../shared.js";

class Tab extends SvgPlus {
    constructor(tab) {
        super("div");
        this.class = "tab";
        this.innerHTML = tab.title;
    }
}

class RoundedTabs extends SvgPlus {
    #selected = 0;
    constructor(items) {
        super("rounded-tabs")

        this.svg =this.createChild("svg", {class: "tab-display"});
        const tabs = this.createChild("div", {class: "tabs-container"});
        const content = this.createChild("div", {class: "main-content"});

        let contentElements = {};
        this.key2index = {}
        this.tabs = Object.entries(items).map(([key, item], i) => {
            contentElements[i] = item.content;
            this.key2index[key] = i;
            return tabs.createChild(Tab, {events: {
                click: () => {
                    this.select(i)
                }
            }}, item)
        })
        this.contentElements = contentElements;
        this.contentEl = content;
        this.tabsEl = content;

        const resizeObserver = new ResizeObserver(this.onresize.bind(this));
        resizeObserver.observe(this);

        this.select(0);
    }

    select(index) {
        if (index in this.key2index) {
            index = this.key2index[index];
        }
        index = Math.max(0, Math.min(index, this.tabs.length - 1));
        this.#selected = index;
        this.contentEl.innerHTML = "";
        const nextElement = this.contentElements[this.#selected];
        nextElement.onConnected?.();
        this.contentEl.appendChild(nextElement);
        this.render();
    }

    render() {
        let selected = this.#selected;

        let [P, S] = this.bbox;
        let [TP, TS] = this.tabs[selected].bbox;
        let radius = TS.y / 2;

        let TL = TP.sub(P);
        let BL = TL.add(0, TS.y);
        let TR = TL.add(TS.x, 0);
        let BR = BL.add(TS.x, 0);

        let O = new Vector(0);
        let V = (...args) => new Vector(...args);

        let points = [
            O.add(0, S.y),  // bottom left corner of box
            V(0, BL.y),     // top left corner of box
            BL,             // bottom left corner of tab
            TL,             // top left corner of tab
            TR,             // top right corner of tab
            BR,             // bottom right corner of tab
            V(S.x, BR.y),   // top right corner of box
            S               // bottom right corner
        ];
        let remove = new Array(points.length).fill(false)
        for (let i = 1; i < points.length; i++) {
            if (points[i].sub(points[i-1]).isZero) {
                remove[i] = true;
                remove[i-1] = true;
            }
        }
        points = points.filter((_, i) => !remove[i]);
       
        this.svg.props = {
            "viewBox": `0 0 ${S.x} ${S.y}`
        }

        this.svg.innerHTML = `
            <path d="${roundedPolygon(points, radius)}" />
        `;

    }


    onresize() {
        this.render();
    }


    static get usedStyleSheets() {
        return [
            import.meta.resolve("./rounded-tabs.css")
        ]
    }
}

export { RoundedTabs };