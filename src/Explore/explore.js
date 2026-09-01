import { AACGrid, AACGridWrapper } from "../AACWebComponent/aac.js";
import { AutoPosition, ContextMenu } from "../ContextMenu/context-menu.js";
import { 
    BoardMetadata, 
    getBoard, 
    getBoardMetadata, 
    getRecentBoards, 
    watchMyFavouriteBoards, 
    watchPublicBoards
} from "../Firebase/boards.js";
import { addAuthChangeListener, getUser, set } from "../Firebase/firebase.js";
import { getViewerURL, openEditor, openViewer } from "../Utilities/shared.js";
import { SvgPlus, Vector } from "../SvgPlus/4.js";
import { ShadowElement } from "../SvgPlus/shadow-element.js";
import { Icon } from "../Utilities/icons.js";
import { Radio } from "../Utilities/radio.js";
import "../Utilities/bg-img.js";

const FEATURED_BOARDS = [
    {
        boards: [
            "JLYix9KezJaosLusUhkl",
            "bO8yY3GEkU8o3g0rkcTv",
        ]
    },
    {   
        title: "Proloquo",
        boards: [
            "s9xO1YfGtLdwM1YOgG1S",
            "InZgWP9sywxFUwOJO0TQ"
        ]
    },
    {
        title: "PRC Saltillo",
        boards: [
            "tVO399IgcEuTW6FLTDZP",
            "rTezEUKTUzcOGAdleZkh",
            "zmnKiAkXdSTdjCtB6WmV",
            "HWRGaqWL8AjrRfAFW4ik"
        ]
    },
    {   
        title: "Quick Core",
        boards: [
            "JdfvRskx5EcpPpUudK5o",
            "A3PbgIuX4w4hahQWn7o0",
            "7Sss73pXR7Vj9ZImTrev",
            "U03vkiTufZO9gYzuTiZX",
            "O8jfO4mJK9IosDXzrDCf",
        ]
    },
     {
        title: "Vocal Flair",
        boards: [
            "mlvuf8KAWlEVxusyFIt1",
            "gZ5sGqKdTmBMLnPeaIMJ",
            "tmQ85C2zDckDIbcxV5XE",
            "H3SqbnGwX1bjHI2Xv0iB",
            "5sBqMpBRVEQp5aFYTuo4",
        ]
    }
]


const ALL_FEATURED_BOARDS = new Set(FEATURED_BOARDS.flatMap(set => set.boards));


class BoardCard extends SvgPlus {
    #timerPromise = null;
    #timerStarted = false;
    #timerStopped = false;
    #timerDuration = 1500;
    #elapsedTime = 0;
    
    constructor(explorer, boardID, showAuthor = true) {
        super("board-card");
        this.boardID = boardID;
        this.explorer = explorer;
        console.log(boardID, this)
        this.boardIcon = this.createChild("bg-img");
        let desc = this.createChild("div", {class: "description"});
        let d1 = desc.createChild("div");
        this.boardTitle = d1.createChild("h2", {content: "..."});
        
        this.boardAuthor = showAuthor ? d1.createChild("div", {class: "author", content: "..."}) : null; 
        desc.createChild("button", {
            events: {
                click: (e) => {
                    this.openMenu(e);
                    e.stopPropagation();
                }
            }
        }).createChild(Icon, {}, "more");

        this.#loadMetadata(boardID, showAuthor);
    }

    async #loadMetadata(boardID, showAuthor) {
        const metadata = await getBoardMetadata(boardID);
        
        if (metadata.valid) {

            this.metadata = metadata;
            this.boardIcon.src = metadata.thumbnail || import.meta.resolve("../../Assets/Icons/grid.svg");
            this.boardTitle.innerText = metadata.path.name;

            
            if (showAuthor) {
                this.#loadAuthorName(metadata); 
            } 

            this.events = {
                "mouseenter": this.startPreviewTimer.bind(this),
                "mouseleave": this.stopPreviewTimer.bind(this),
                "click": (e) => {
                    openViewer(boardID);
                    this.stopPreviewTimer();
                }
            }
        }
    }


    /**
     * @param {BoardMetadata} metadata
     */
    async #loadAuthorName(metadata) {
        const info = await metadata.getOwnerName()
        this.boardAuthor.innerHTML = "";
        if (info.displayPhoto) {
            this.boardAuthor.createChild("bg-img", {src: info.displayPhoto});
        }
        this.boardAuthor.createChild("span").textContent = info.name;
    }

    openMenu(e) {
        e.stopPropagation();

        const {boardID, explorer, metadata} = this;
        if (!metadata) return;

        const urlParams = new URLSearchParams(window.location.search);
        const desiredUser = urlParams.get("user");
        let user = desiredUser || getUser()?.uid;

        explorer.createContextMenu([
            ...(user === this.metadata.owner ? [
                {
                    label: "Open in Files",
                    icon: "<i-bw folder-bw></i-bw>",
                    action: this.openInFileSystem.bind(this)
                },
                {
                    label: "Open in Editor",
                    icon: "<i-bw edit></i-bw>",
                    action: () => openEditor(boardID)
                },
                "seperator"
            ] : []),
            {
                label: "Open in Viewer",
                icon: "<i-bw view></i-bw>",
                action: () => {
                    openViewer(boardID);
                }
            },
            {
                label: "Share",
                icon: "<i-bw share></i-bw>",
                action: () => {
                    navigator.share({
                        title: this.metadata.path.name,
                        url: getViewerURL(boardID)
                    }).catch(err => {
                        navigator.clipboard.writeText(getViewerURL(boardID))
                    });
                }
            }
        ])
    }

    openInFileSystem() {
        let event = new CustomEvent("open-file-system", {
            detail: {boardID: this.boardID},
            bubbles: true,
        });
        this.dispatchEvent(event);
    }

    onPreview() {
        this.explorer.showPreview();
    }

    onHalfway() {
        this.explorer.loadPreview(this.boardID);
    }

    startPreviewTimer() {
        if (this.explorer.isOpenAndSamePreview(this.boardID) || this.#timerStarted) {
            return;
        }

        let ratio = 0.3;

        this.#timerPromise = (async () => {
            this.#timerStarted = true;
            this.#timerStopped = false;
            this.toggleAttribute("preview-timer", true);

            while (this.#elapsedTime < this.#timerDuration && !this.#timerStopped) {
                let now = performance.now();
                await new Promise(requestAnimationFrame);
                let lastTime = this.#elapsedTime
                this.#elapsedTime += performance.now() - now;
            
                this.styles = {
                    "--progress": this.#elapsedTime / this.#timerDuration
                }

                if (lastTime < this.#timerDuration * ratio && this.#elapsedTime >= this.#timerDuration * ratio) {
                    this.onHalfway();
                }
            }

            if (!this.#timerStopped) {
                this.onPreview();
            } else {
                await this.explorer.loadPreviewPromise();
            }
            this.toggleAttribute("preview-timer", false);
            this.#timerStarted = false;
            this.#elapsedTime = 0;
        })();
    }

    async stopPreviewTimer() {
        console.log("stop timer");
        this.#timerStopped = true;
        await this.#timerPromise;
    }
}

class BoardSet extends SvgPlus {
    constructor(explorer, boardIDs, title, showAuthor = true) {
        super("div");
        this.class = "board-set root";
        if (typeof title === "string" && title !== undefined) {
            const h = this.createChild("div", {class: "board-set head"});
            h.createChild("h2", {content: title});
            this.toggleButton = h.createChild("div", {class: "btn-text more", content: "View All", events: {
                click: () => this.toggleExpanded()
            }});
            this.toggleExpanded(false);
        } else {
            this.toggleExpanded(true);
        }
        let grid = this.createChild("div", {class: "board-set grid"});
        boardIDs.forEach(boardID => {
            grid.createChild(BoardCard, {}, explorer, boardID, showAuthor);
        })
    }

    toggleExpanded(bool) {
        this.toggleAttribute("expanded", bool);
        const expanded = this.hasAttribute("expanded");
        if (this.toggleButton) {
            this.toggleButton.innerText = expanded ? "Show Less" : "Show More";
        }
    }
}

class FeaturedList extends SvgPlus {
    constructor(explorer) {
        super("div");
        this.class = "featured-board board-list"
        for (let {boards, title} of FEATURED_BOARDS) {
            this.createChild(BoardSet, {}, explorer, boards, title, false);
        }
    }
}

class MyFavouritesList extends SvgPlus {
    constructor(explorer) {
        super("div");
        this.class = "my-favourites board-list"
        addAuthChangeListener(user => {
            if (this.myFavouritesWatcher) {
                this.myFavouritesWatcher();
                this.myFavouritesWatcher = null;
            }
            if (user) {
                const urlParams = new URLSearchParams(window.location.search);
                const desiredUser = urlParams.get("user");
                this.myFavouritesWatcher = watchMyFavouriteBoards(desiredUser || user.uid, changes => {
                    console.log(changes);
                    this.innerHTML = "";    
                    const keys = Object.keys(changes);
                    if (keys.length === 0) {
                        this.createChild("div", {content: "You have no favourite boards."});
                    } else {
                        this.createChild(BoardSet, {}, explorer, keys);
                    }
                })
            } else {
                this.createChild("div", {content: "Please log in to see your favourites."});
            }
        })
    }
}

class PublicList extends SvgPlus {
    constructor(explorer) {
        super("div");
        this.class = "public-board board-list"
        watchPublicBoards((changes) => {
            this.innerHTML = "";
            const keys = Object.entries(changes)
                .filter(([boardID, metadata]) => 
                    !ALL_FEATURED_BOARDS.has(boardID)
                    && metadata.updatedAt != null
                )
                .map(([boardID]) => boardID);

            if (keys.length === 0) {
                this.createChild("div", {content: "No public boards."});
            } else {
                this.createChild(BoardSet, {}, explorer, keys);
            }
        })
    }
}

class PreviewDisplay extends AutoPosition {
    constructor(boardID) {
        super("preview-display");
        this.grid = this.createChild(AACGridWrapper, {}, "div");

        window.addEventListener("click", (e) => {
            this.shown = false;
        })

        this.addEventListener("mouseleave", (e) => {
            this.shown = false;
        })
    }


    async load(boardID, timeTilSet = 300) {
        this.boardID = boardID;
        this.loadingPromise = (async () => {
            let now = performance.now();
            const board = await getBoard(boardID)
            let rem = timeTilSet - (performance.now() - now);
            if (rem > 0) {
                await new Promise(r => setTimeout(r, rem));
            }
            this.grid.board = board;
            await new Promise(r => setTimeout(r, 300));
        })();
    }

    get shown() {
        return this.hasAttribute("show");
    }

    set shown(bool) {
        this.toggleAttribute("show", bool);
    }

}

class RecentBoards extends SvgPlus {
    constructor(explorer) {
        super("aside");
        this.class = ""
        const scorllArea = this.createChild("div", {class: "scroll-wrap", events: {
                scroll: (e) => { explorer.removeAllPopups(); }
        }}).createChild("div", {class: "scroll-element"});
        scorllArea.createChild("h2", {content: "Recent Boards"});   
        this.scrollArea = scorllArea;
        this.#load(explorer);
    }

    async #load(explorer) {
        let metadata = await Promise.all(
            getRecentBoards().map(async boardID => {
                return [boardID, await getBoardMetadata(boardID)];
            })
        )

        let filtered = metadata.filter((
            [boardID, metadata]) => metadata && !metadata.error && metadata.valid
        )

        filtered.map(([boardID, metadata]) => 
            this.scrollArea.createChild(BoardCard, {}, explorer, boardID, true)
        );
    
    }
}

class ExplorePage extends SvgPlus {
    constructor() {
        super("explore-page");

        this.preview = this.createChild(PreviewDisplay);

        const main = this.createChild("div", {class: "main"})
            .createChild("div", {class: "scroll-wrap", events: {
                scroll: (e) => { this.removeAllPopups(); }
            }}).createChild("div", {class: "scroll-element"});
        
        const side = this.createChild(RecentBoards, {}, this)

        const gh = main.createChild("div", {class: "gradient-header"})
        gh.createChild("h1").createChild("img", {
            src: import.meta.resolve("../../Assets/aac-banner.svg"), 
            class: "logo",
            styles: {height: "1.4em"},
        });

        gh.createChild("div", {
            class: "grid",
            content: `<bg-img explore src = "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Ficon-sets%2FSCSH%2FEXPLORE.png?alt=media&token=9305f467-02b9-4bba-880c-4524964c0ba8"></bg-img>
            <bg-img create src = "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Ficon-sets%2FPCS%2FARTSAND!.png?alt=media&token=d5419163-8cef-4b3d-ae76-2bc0375bf76d"></bg-img>
            <bg-img share src = "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Ficon-sets%2FSYBX%2FSHARE%5E.png?alt=media&token=f450d482-c6c3-43c9-9593-0628d7684092"></bg-img>
            <h2>Explore</h2>
            <h2>Create</h2>
            <h2>Share</h2>`
        })


        this.radio = gh.createChild(Radio, {events: {
            change: () => {
                this.shownMode = this.radio.selected;
            }
        }}, [
            ["featured", "div", {content: "Featured"}],
            ["favourites", "div", {content: "My Favourites"}],
            ["public", "div", {content: "Public"}]
        ])
        
        this.lists = {
            featured: main.createChild(FeaturedList, {}, this),
            favourites: main.createChild(MyFavouritesList, {}, this),
            public: main.createChild(PublicList, {}, this),
        }
        this.events = {
            "mousemove": (e) => {
                this.lastMouseMove = new Vector(e.clientX, e.clientY);
            }
        }

        this.radio.select("featured", true);
    } 



    createContextMenu(items) {
        if (this.contextMenu) {
            this.contextMenu.destroy();
        }
        this.contextMenu = this.createChild(ContextMenu, {}, items, this.lastMouseMove);
    }


    loadPreview(boardID) {
        this.preview.load(boardID);
        this.preview.shown = false;
    }

    hidePreview() {
        this.preview.shown = false;
    }

    showPreview() {
        this.preview.autoPosition(this.lastMouseMove);
        this.preview.shown = true;
    }

    loadPreviewPromise() {
        return this.preview.loadingPromise || Promise.resolve();
    }


    isOpenAndSamePreview(boardID) {
        return this.preview.shown && this.preview.boardID === boardID;
    }


    removeAllPopups() {
        if (this.contextMenu) {
            this.contextMenu.destroy();
            this.contextMenu = null;
        }
        this.hidePreview();
    }
    

    set shownMode(mode) {
        for (let key in this.lists) {
            if (key === mode) {
                this.lists[key].styles = {display: "flex"};
            } else {
                this.lists[key].styles = {display: "none"};
            }
        }
        this.removeAllPopups()
    }

    static get usedStyleSheets() {
        return ContextMenu.usedStyleSheets;
    }
}

export {ExplorePage};