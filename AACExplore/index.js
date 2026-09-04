import { getBoardMetadata } from "../src/Firebase/boards.js";
import { initialise } from "../src/Firebase/firebase.js";
import { ShadowElement } from "../src/SvgPlus/shadow-element.js";
import { Vector } from "../src/SvgPlus/vector.js";
import { GridIcon, GridLayout } from "../src/Utilities/GridLayout/grid-icons.js";
import { roundedPolygon } from "./rpoly.js";
initialise();


const FEATURED_BOARDS = [
    {
        title: "Squidly",
        img: import.meta.resolve("../Assets/logo.svg"),
        boards: [
            "JLYix9KezJaosLusUhkl",
            "GPomuZcnGmpn7hNuX2S6",
            "bO8yY3GEkU8o3g0rkcTv",
            "InZgWP9sywxFUwOJO0TQ"
        ]
    },
    {
        title: "PRC Saltillo",
        img: import.meta.resolve("./prc.svg"),
        boards: [
            "tVO399IgcEuTW6FLTDZP",
            "rTezEUKTUzcOGAdleZkh",
            "zmnKiAkXdSTdjCtB6WmV",
            "HWRGaqWL8AjrRfAFW4ik"
        ]
    },
    {   
        title: "Quick Core",
        img: import.meta.resolve("./quick-core.svg"),
        boards: [
            "U03vkiTufZO9gYzuTiZX",
            "7Sss73pXR7Vj9ZImTrev",
            "A3PbgIuX4w4hahQWn7o0",
            "JdfvRskx5EcpPpUudK5o",
            "O8jfO4mJK9IosDXzrDCf",
        ]
    },
    {
        title: "Vocal Flair",
        img: "https://www.openaac.org/images/2024/vocal-flair-24.png",
        boards: [
            "gZ5sGqKdTmBMLnPeaIMJ",
            "tmQ85C2zDckDIbcxV5XE",
            "H3SqbnGwX1bjHI2Xv0iB",
            "5sBqMpBRVEQp5aFYTuo4",
            "mlvuf8KAWlEVxusyFIt1",
        ]
    },
    {
        title: "Everyday Life",

        boards: [
            "8oKZZp4cw9uDmiRfiijM",
            "4SsWDV7IqU0tiNg3Vtp0",
            "S98Y4J5gnR3hQSy80tEF",
            "JkXZ2Cm3OzXTw8u2yKSl",
            "kDClJEcGEkPaOZq831HD"
        ]
    },
    {
        title: "People, Play & Interests",
        boards: [
            "PkNtxxwUyntPbXalmdJB",
            "gfxpGyVxp54ZUAmwr2Lg",
            "U5uKJRS5H0mnp0hPzP6E",
            "LcXf0yWUT5n3syU2n4WO",
            "5MtHTgn0ukUt7u4Fs3yU"
        ]
    },
    {   
        title: "Proloquo",
        boards: [
            "s9xO1YfGtLdwM1YOgG1S",
            "InZgWP9sywxFUwOJO0TQ"
        ]
    },
    
    
     
]

class BoardGridIcon extends GridIcon {
    constructor(id) {
        super({
            displayValue: "...",          
            colorTheme: "white"
        })
        this.classList.add("board-grid-icon");
        this.load(id);
        this.toggleAttribute("label-at-bottom", true)
    }

    async load(id) {
        const metadata = await getBoardMetadata(id);
        console.log(metadata, id);
        this.displayValue = metadata.path.name;
        this.symbol = metadata.thumbnail || import.meta.resolve("../Assets/Icons/grid.svg");
    }
}

class FixedGridLayout extends GridLayout {
    onresize(){
        console.log("tabs resized");
        this.gridIconBorderRadius = 15;
        this.gridIconBorderWidth = Math.min(Math.max(2, Math.ceil(this.clientWidth / 225)), 4);
    }
}

const DROWS = 4;
const DCOLS = 5;
const FROWS = 2;

class Featured extends FixedGridLayout {

    constructor() {
        super(DROWS,DCOLS)
        this.class = "featured"
        const rows = [
            FEATURED_BOARDS.slice(0, DCOLS),
            FEATURED_BOARDS.slice(DCOLS, DCOLS * 2)
        ];
        /** @type {GridIcon[][]} */
        this.buttons = this.addGridIcons(rows.map((row, r) => 
            row.map((i, c) => ({
                displayValue: i.title, 
                colorTheme: "topic", 
                type: "folder",
                symbol: i.img,
                events: {
                    "access-click": (e) => {
                        this.selectCategory(r, c);
                    }
                }
            })),
        ));

        this.boardList = this.add(new FixedGridLayout(DROWS - FROWS, DCOLS), [FROWS, DROWS-1], [0, DCOLS-1]);
    }

    selectCategory(ri, ci) {
        console.log(`Selected category: row ${ri}, column ${ci}`);
        this.buttons.forEach((row, r) => {
            row.forEach((button, c) => {
                console.log(button,r === ri && c === ci)
                button.toggleAttribute("hover", r === ri && c === ci);
            });
        });

        let index = ri * DCOLS + ci;
        if (index !== this.lastIndex) {
            this.lastIndex = index;
            const boards = FEATURED_BOARDS[index].boards;
            console.log(boards)
            this.boardList.innerHTML = "";
            this.boardList.addItemInstances(BoardGridIcon, [boards], 0, 0)
        }
        
    }


}

const GAP = 4;
const colors = [
    "",
    "#675041",
    "#5b6741",
    "#416367",
    "#534167",
]
class AACExplore extends ShadowElement {

    constructor(el) {
        super(el, "aac-explore-root");
        const root =this.createChild("main");
        this.svg = root.createChild("svg");

        let resizeObserver = new ResizeObserver(this.onresize.bind(this)); 
        resizeObserver.observe(root);

        const tabs = root.createChild(FixedGridLayout, {
            styles: {"padding-bottom": `${GAP/2}px`}
        }, 1, 5);
        tabs.addGridIcons([
            [
                {
                    displayValue: "Exit",
                    colorTheme: "action"
                },
                {
                    displayValue: "Featured",
                    colorTheme: "featured"
                },
                {
                    displayValue: "Public",
                    colorTheme: "public"
                },
                {
                    displayValue: "Favourites",
                    colorTheme: "favourites"
                },
                {
                    displayValue: "Search",
                    colorTheme: "noun"
                }
            ].map((v, i) => {
                v.events = {
                    "access-click": (e) => {
                        this.selectedTab = i;
                        console.log(`Selected tab: ${i.displayValue}`);
                        this.onresize(
                            [{contentRect: root.getBoundingClientRect()}]
                        );
                    }
                }
                return v
            })
        ])
        const main = root.createChild(Featured);
        this.selectedTab = 4;
        tabs[0]

    }


    onresize(e) {
        
        let rect = e[0].contentRect;
        console.log(rect);
        const {width, height} = rect;
        if (width ==0 || height == 0) return;   

        let si = this.selectedTab;
        let topY = GAP/2;
        let ySplit = height * 6 / 46;
        let tabW = width/DCOLS - GAP * (1 + 1 / DCOLS);
        let x1 = si == 0 ? 0 : GAP * 0.5 + (tabW + GAP) * si;
        let x2 = si == DCOLS - 1 ? width : GAP * 0.5 + (tabW + GAP) * (si + 1);

        this.svg.props = {
            "viewBox": `0 0 ${width} ${height}`
        }

        let points = [
            [0, ySplit],
            [x1, ySplit],
            [x1, topY],
            [x2, topY],
            [x2, ySplit],
            [width, ySplit],
            [width, height],
            [0, height],
        ].map(p => new Vector(p));

        // If two consecutive points are the same, remove them both
        for (let i = 0; i < points.length - 1; i++) {
            if (points[i].sub(points[i + 1]).isZero) {
                points.splice(i, 2);
                i -= 2; // Step back to check the new consecutive points
            }
        }

        this.svg.innerHTML = `
        <path d="${roundedPolygon( points, 19)}" fill="${colors[si]}"/>

        `;
    }

    static get usedStyleSheets() {
        return [
            import.meta.resolve("./index.css"),
            ...GridIcon.usedStyleSheets
        ]
    }
}

const aacExplore = new AACExplore("aac-explore");
document.body.appendChild(aacExplore);
setTimeout(() => {
    document.body.toggleAttribute("loaded", true)
}, 2000);
