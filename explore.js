import { getBoardMetadata, watchMyFavouriteBoards, watchPublicBoards } from "./src/Firebase/boards.js";
import { addAuthChangeListener } from "./src/Firebase/firebase.js";
import { openViewer } from "./src/shared.js";
import { Icon } from "./src/Utilities/icons.js";
import { Radio } from "./src/Utilities/simple.js";
import { ShadowElement, SvgPlus } from "./src/Utilities/utils.js";

const FEATURED_BOARDS = [
    {
        boards: [
            "x2h8SqITc3SLz4IO6Pt2",
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
        "rTezEUKTUzcOGAdleZkh",
        "zmnKiAkXdSTdjCtB6WmV",
        "b8yQVLZjdRHweuhrrzfs",
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

const RECENT_BOARDS = [
    "rTezEUKTUzcOGAdleZkh",
    "zmnKiAkXdSTdjCtB6WmV",
    "b8yQVLZjdRHweuhrrzfs",
    "JdfvRskx5EcpPpUudK5o",
]

const ALL_FEATURED_BOARDS = new Set(FEATURED_BOARDS.flatMap(set => set.boards));
class BoardCard extends SvgPlus {
    constructor(boardID, showAuthor = true) {
        super("board-card");
        let boardIcon = this.createChild("bg-img");
        let desc = this.createChild("div", {class: "description"});
        let d1 = desc.createChild("div");
        let boardTitle = d1.createChild("h2", {content: "..."});
        
        let boardAuthor = showAuthor ? d1.createChild("span", {content: "..."}) : null; 
        desc.createChild("button").createChild(Icon, {}, "more");
        getBoardMetadata(boardID).then(metadata => {
            boardIcon.src = metadata.thumbnail || import.meta.resolve("./Assets/Icons/grid.svg");
            boardTitle.innerText = metadata.path.name;
            if (showAuthor) boardAuthor.innerText = `by ${metadata.owner.slice(0, 10)}`;
        })

        this.addEventListener("dblclick", () => {
            openViewer(boardID);
        })
    }
}


class FeaturedList extends SvgPlus {
    constructor() {
        super("div");
        this.class = "featured-board board-list"
        for (let {boards, title} of FEATURED_BOARDS) {
            if (title) {
                this.createChild("div", {class: "feature-set", content: `<h2>${title}</h2>`});
            }
            let row3 = this.createChild("div", {class: "row-x", style: {"--row": 4}});
            boards.slice(0, 4).forEach(boardID => {
                row3.createChild(BoardCard, {}, boardID, false);
            })
        }
    }
}

class MyFavouritesList extends SvgPlus {
    constructor() {
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
                    this.innerHTML = "";    
                    const keys = Object.keys(changes);
                    if (keys.length === 0) {
                        this.createChild("div", {content: "You have no favourite boards."});
                    } else {
                        let lrow3 = this.createChild("div", {class: "board-card-grid"});
                        keys.forEach(
                            boardID => lrow3.createChild(BoardCard, {}, boardID, false)
                        );
                    }
                })
            } else {
                this.createChild("div", {content: "Please log in to see your favourites."});
            }
        })
    }
}

class PublicList extends SvgPlus {
    constructor() {
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
                const grid = this.createChild("div", {class: "board-card-grid"});
                keys.forEach(
                    boardID => grid.createChild(BoardCard, {}, boardID, true)
                );
            }
        })
    }
}

class ExplorePage extends SvgPlus {
    constructor() {
        super("explore-page");
        const main = this.createChild("div", {class: "main"})
            .createChild("div", {class: "scroll-wrap"})
            .createChild("div", {class: "scroll-element"});
        
        const side = this.createChild("aside")
            .createChild("div", {class: "scroll-wrap"})
            .createChild("div", {class: "scroll-element"})

        side.createChild("h2", {content: "Recent Boards"});   
        for (let boardID of RECENT_BOARDS) {
            side.createChild(BoardCard, {}, boardID);
        }

        
        const gh = main.createChild("div", {class: "gradient-header"})
        gh.createChild("h1").createChild("img", {
            src: "./Assets/aac-banner.svg", 
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
            featured: main.createChild(FeaturedList),
            favourites: main.createChild(MyFavouritesList),
            public: main.createChild(PublicList),
        }
        
        this.radio.select("featured", true);

    }   

    set shownMode(mode) {
        for (let key in this.lists) {
            if (key === mode) {
                this.lists[key].styles = {display: "flex"};
            } else {
                this.lists[key].styles = {display: "none"};
            }
        }
    }
}


export {ExplorePage};