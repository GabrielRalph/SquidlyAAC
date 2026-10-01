import { SvgPlus } from "../src/SvgPlus/4.js";
import { ShadowElement } from "../src/SvgPlus/shadow-element.js";
import { Icon } from "../src/Utilities/icons.js";

const NOTICE_TEXT = `
Squidly AAC is a browser-based augmentative and alternative communication resource 
provided by Squid Eye Pty Ltd. Squidly AAC is currently available free of charge and
is separate from Squidly’s subscription-based telepractice and video-calling service. 
Access to Squidly AAC does not require a subscription to the Squidly telepractice service.
<br>
<br>
Squidly AAC includes symbols, pictograms, vocabularies and AAC board structures created by 
third parties. Those materials remain owned by their respective rights holders and are made 
available subject to the licences, permissions and attribution requirements identified below. 
Squidly does not claim ownership of third-party materials. Nothing on this page expands, 
restricts or replaces an applicable third-party licence or permission, and if this summary 
conflicts with a rights holder’s original licence, terms or permission, the original source controls.
<br>
<br>
Use of Squidly AAC is also subject to Squidly’s Terms of Use and Privacy Policy, which govern general 
website use and how personal information is collected, used, disclosed, stored and protected. This 
page supplements those documents specifically in relation to third-party AAC content, licensing, 
permissions and attribution.
`
const OTHER = `
Squidly aims to preserve accurate provenance, licence and attribution information for all third-party AAC resources made available through Squidly AAC. If you are a rights holder, creator or contributor and believe that any content has been incorrectly attributed, licensed or made available, please contact us at <a href="mailto:support@squidly.com.au">support@squidly.com.au</a>. We will review the issue and, where appropriate, correct, restrict or remove the affected material.
<br>
<br>
For general questions about Squidly AAC, these notices, or the use of third-party content, please also contact <a href="mailto:support@squidly.com.au">support@squidly.com.au</a>.`
class CCIcons extends SvgPlus {
    constructor(type) {
        super("span")
        this.class = "cc-icons"
        let terms = type.replace("CC", "logo").split(/[\s-]+/);
        terms.forEach(term => {
            this.createChild(Icon, {}, "cc-"+term.toLowerCase())
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
        h.createChild("img", {src: import.meta.resolve("../Assets/aac-banner.svg"), class: "logo"})
        h.createChild("h1", {content: "Third-Party Symbols,<br> Vocabularies & Attributions"})
        h.createChild("p", {content: NOTICE_TEXT});
        h.createChild("div", {class: "note", content: "<a href=\"https://policies.squidly.com.au/terms-of-use/\">Terms of Use</a> · <a href=\"http://policies.squidly.com.au/privacy/\">Privacy Policy</a> · Last reviewed: 30 Sep 2026"});

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
                    Squidly AAC acknowledges the use of <a href="https://www.globalsymbols.com/">Global Symbols</a> in discoverying symbol sets.
                </span>
            </licence-item>`
        });

        this.licenceListB = this.createChild("licence-list");

        this.createChild("h1", {content: "Rights-holder notices and questions"});
        this.createChild("p", {content: OTHER});
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
            import.meta.resolve("./style.css"),
            import.meta.resolve("../Assets/CCIcons/icons.css")
        ]
    }
}

export {AttributionPage};