import { ExplorePage } from "./src/Explore/explore.js";
import { AACFinder } from "./files.js";
import { addAuthChangeListener, getUser, initialise, signOut } from "./src/Firebase/firebase.js";
import { LoginPage } from "./src/loginPage/login-page.js";
import { openEditor } from "./src/Utilities/shared.js";
import { SvgPlus } from "./src/SvgPlus/4.js";
import { ShadowElement } from "./src/SvgPlus/shadow-element.js";
import { Icon } from "./src/Utilities/icons.js";
import { setActiveKeyBindingSet } from "./src/Utilities/keybindings.js";
import { Radio } from "./src/Utilities/radio.js";
import "./src/Utilities/bg-img.js";

initialise();

class SideBarIcon extends SvgPlus {
    constructor({icon, title, selected}) {
        super("div");
        this.createChild("button").createChild(Icon, {}, icon);
        this.createChild("span").innerText = title;
        this.toggleAttribute("selected", selected??false);
    }
}

const SIDE_BAR_RADIO = [
    {
        title: "Explore",
        icon: "search",
        onClick: (page) => {
            page.viewMode = "explore";
        }
    },
    {
        title: "My Files",
        icon: "new-folder",
        onClick: (page) => {
            page.openFileSystem();
        }
    },
    {
        title: "Create",
        icon: "new-grid",
        onClick: () => {
            openEditor()
        }
    },
]

const HIDE_STYLE = {
    opacity: 0,
    "pointer-events": "none",
}
const SHOW_STYLE = {
    opacity: 1,
    "pointer-events": "all",
}

class AACHomePage extends ShadowElement {
    constructor(el) {
        super(el, "page-root");
        const h = this.createChild("header");
        h.createChild("img", { 
            src: "./Assets/Icons/logo-banner.svg", class: "logo",
            events: {
                click: () => {
                    window.location.href = "https://squidly.com.au";
                }
            }
        });

        this.displayPicture = h.createChild("div").createChild("button", {
            events: {
                click: () => {
                    if (!getUser()) {
                        this.loginPageContainer.styles = SHOW_STYLE
                    } else {
                        signOut();
                    }
                }
            }
        }).createChild("bg-img", {class: "user-icon"});

        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get("tab");
        this.radio = this.createChild(
            Radio, 
            { class: "side-bar" }, 
            SIDE_BAR_RADIO.map((icon, i) => 
                [i, SideBarIcon, icon.onClick ? {events: {click: () => icon.onClick(this)}} : {}, icon]
            )
        );
        this.radio.select(mode === "explore" ? 0 : 1, false);

        const main = this.createChild("main");
        this.explore = main.createChild(ExplorePage, {events: {
            "open-file-system": (e) => {
                this.openFileSystem(e.detail.boardID);
            }
        }});

        // let finderContainer = main.createChild("div", {class: "finder-container"})
        this.finder = main.createChild(AACFinder, {}, "file-system");

        this.loginPageContainer = this.createChild("div", {
            class: "login-page-container",
            styles: {
                opacity: 0,
                "pointer-events": "none",
            }
        });

        const loginPage = this.loginPageContainer.createChild(LoginPage, {}, "login-page");
        this.loginPageContainer.createChild("button", {
            class: "close-button",
            events: {
                click: () => {
                    this.loginPageContainer.styles = {
                        opacity: 0,
                        "pointer-events": "none",
                    }
                }
            }
        }).createChild(Icon, {}, "e-delete");

        this._waitingForAuth = new Promise(resolve => {
            addAuthChangeListener(user => {
                this.finder.removeUser();
                if (user) {
                    this.displayPicture.src = user.photoURL;
                    const urlParams = new URLSearchParams(window.location.search);
                    const desiredUser = urlParams.get("user");      
                    this.finder.assignUser(desiredUser || user?.uid);
                    this.loginPageContainer.styles = HIDE_STYLE
                    this.finder.toggleAttribute("loaded", true);
                } else {
                    this.finder.toggleAttribute("loaded", false);
                    this.displayPicture.toggleAttribute("loaded", false);
                }
                resolve();
            })
        })
        
        if (mode === "finder") {
            this.openFileSystem();
        } else {
            this.viewMode = "explore";
        }

    }

    set viewMode(mode) {
        this.radio.select(mode === "explore" ? 0 : 1, false);
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set("tab", mode);
        window.history.replaceState({}, "", `${window.location.pathname}?${urlParams.toString()}`);
        this.explore.styles = mode === "explore" ? SHOW_STYLE : HIDE_STYLE;
        this.finder.styles = mode === "explore" ? HIDE_STYLE : SHOW_STYLE;
        setActiveKeyBindingSet(mode === "explore" ? "ob-explore" : "ob-finder");
    }


    async openFileSystem(boardID) {
        this.finder.toggleAttribute("loaded", false);
        await this._waitingForAuth
        if (!getUser()) {
            this.loginPageContainer.styles = SHOW_STYLE
            this.viewMode = "finder";
        } else {
            this.viewMode = "finder";
            this.finder.toggleAttribute("loaded", true);
            if (boardID) {
                this.finder.selectByBoardID(boardID);
            }
        }
    }


    static get usedStyleSheets() {
        return [
            import.meta.resolve("./style.css"),
            import.meta.resolve("./Assets/Icons/icons.css"),
            ...ExplorePage.usedStyleSheets
        ]
    }
}




SvgPlus.defineHTMLElement(AACHomePage, "aac-home-page");