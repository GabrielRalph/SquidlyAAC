import { SvgPlus } from "../src/SvgPlus/4.js";
import { ShadowElement } from "../src/SvgPlus/shadow-element.js";

class CCIcons extends SvgPlus {
    constructor(type) {
        super("span")
        this.class = "cc-icons"
        let terms = type.replace("CC", "logo").split(/[\s-]+/);
        terms.forEach(term => {
            this.createChild("span", {class: "cc-icon"})
                .createChild("svg", {viewBox: "0 0 30 30"})
                .createChild("use", {href: import.meta.resolve(`./cc.svg#cc-${term.toLowerCase()}`)});
        });
    }
}

class LicenceItem extends SvgPlus {
    constructor(l) {
        super("licence-item");
        console.log(l)
        let r = this.createChild("div", {class: "row"});
        let rr = r.createChild("div", {class: "row"});
        rr.createChild("img", {class: "logo", src: l.logo});
        if (l.title) rr.createChild("h3", {content: l.title});
        r.createChild("div").createChild(CCIcons, {}, l.type);
        this.createChild("h4", {content: "ATTRIBUTION"});
        this.createChild("span", {content: l.attribution.replace(/\$\{(\w+)\}/g, (a,b) => l[b] || '')});
    }   
}

class AttributionPage extends ShadowElement {
    constructor(el) {
        super(el, "main");
        
        const h = this.createChild("header");
        h.createChild("bg-img", {src: import.meta.resolve("../Assets/aac-banner.svg") })
        h.createChild("h1", {content: "Third-Party Symbols,<br> Vocabularies & Attributions"})
        h.createChild("p", {content: "Squidly AAC includes symbols, pictograms, vocabularies and AAC board structures created by third parties. Those materials remain subject to the licences, permissions and attribution requirements identified below. Squidly does not claim ownership of third-party materials unless expressly stated."});
        h.createChild("div", {class: "note", content: "Last reviewed: 30 Sep 2026"});

        this.licenceListA = this.createChild("licence-list");

        this.createChild("h1", {content: "Other Attributions and Acknowledgements"});
        this.createChild("licence-list", {content: `
            <licence-item>
                <div class="row">
                    <div class = "row">
                        <img class="logo" src="https://cms.gs-test.co.uk/assets/99fc4d08-39b7-4307-9a2d-5db97954183c">
                        <h3>Global Symbols </h3>
                    </div>
                </div>
                <h4> ACKNOWLEDGEMENT</h4>
                <span>
                    Squidly AAC acknowledges the use of Global Symbols in discoverying symbol sets.
                </span>
            </licence-item>`
        });

        this.licenceListB = this.createChild("licence-list");
        this.loadData()
    }

    async loadData() {
        let data = await (await fetch(import.meta.resolve("./licences.json"))).json();
        console.log(data);
        Object.values(data["symbol-licences"])
            .map(l => this.licenceListA.createChild(LicenceItem, {}, l))

        Object.values(data["board-licences"])
            .map(l => this.licenceListB.createChild(LicenceItem, {}, l))
    }
  
    static get usedStyleSheets() {
        return [
            import.meta.resolve("./style.css")
        ]
    }
}

export {AttributionPage};