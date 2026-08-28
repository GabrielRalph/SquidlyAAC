import * as FB from "../src/Firebase/firebase.js";
import { AACBoard, AACGridWrapper } from "../src/AACWebComponent/aac.js";
import { 
    BoardSetWatcher, 
    BoardWatcher, 
    getBoardMetadata 
} from "../src/Firebase/boards.js";
import { ShadowElement } from "../src/SvgPlus/shadow-element.js";
import { addBoardToRecent, timerLogger } from "../src/Utilities/shared.js";

(async () => {
    timerLogger.tic("initialise firebase");
    let user = await FB.initialise();
    timerLogger.toc("initialise firebase", `[user: ${user ? user.uid.slice(0, 5)+ "..." : "none"}]`);
})();

const ERROR_SCREENS = {
    404: `
    <i-bw no-board></i-bw>
    <h1>
        The board you are <br>
        looking for does not exist. 
    </h1>
    <p>
        This may occur if the board <br>
        has been deleted or the URL is incorrect.<br>
        Please check the link and try again.
    </p>
    `,
    403: `
    <i-bw lock></i-bw>
    <h1>
        You do not have access <br>
        to view this board.
    </h1>
    <p>
        If someone has shared this board with you, <br> 
        please ensure they have made the board public <br>
        If this is your board, please make sure you <br>
        have signed in to view the board.
    </p>
    `,
    500:`
    <i-bw i-error></i-bw>
    <h1>Something went wrong.</h1>
    <p>
        An unexpected error occurred while <br>
        trying to load the board.<br>
        Please try again later.
    </p>
    `,
    204:`
    <i-bw empty></i-bw>
    <h1>No content available.</h1>
    <p>
        The board exists but contains <br> 
        no content to display. This may <br> 
        occur if the board has not been saved yet.
    </p>
    `,
    400: `
    <i-bw no-board></i-bw>
    <h1>
        This link does not contain <br> 
        a valid board ID.
    </h1>
    <p>
        The request to link was malformed or  <br> 
        does not contain the board ID. <br> 
        Please check the URL <br> 
        and try again. <br> 
    </p>
    `
}

class AACViewer extends ShadowElement {
    #mode = "default";
    /** @type {Object.<string, BoardWatcher>} */
    #boardWatchers = {};



    #boardSetWatcher = null;

    #boardID = null;

    constructor(el) {
        super(el, "aac-viewer-root");

        this.accBoard = this.createChild(AACBoard, {}, "aac-board");
        this.preview = this.createChild(AACGridWrapper, {}, "aac-board-preview");
        this.errorWindow = this.createChild("div", {class: "error-window"});
        this.root.setAttribute("mode", this.#mode);
        this.initialise();
    }

    set mode(mode) {
        if (mode !== this.#mode) {
            console.log(`Switching mode from ${this.#mode} to ${mode}`);
            this.#mode = mode;

            this.root.setAttribute("mode", mode);

            let urlParams = new URLSearchParams(window.location.search);
            urlParams.set("mode", this.#mode)
            window.history.replaceState(null, "", `?${urlParams.toString()}`);

            this.setBoard(this.#boardID);
        }
    }

    get mode() {
        return this.#mode;
    }

    initialise() {
        let update = () => {
            let urlParams = new URLSearchParams(window.location.search);
            let rootID = urlParams.get("board")
            let mode = urlParams.get("mode") || "default";
            this.mode = mode;
            this.setBoard(rootID);
        }
        window.addEventListener("popstate", update);
        window.addEventListener("message", async (event) => {
            if (event.data.type === "updateBoard") {
                await this.setBoard(event.data.id);
            } else if (event.data.type === "setMode") {
                this.mode = event.data.mode;
            }
        })
        update();
    }

    async #setPreviewBoard(boardID, isDraft) {
        document.body.toggleAttribute("loaded", false);  
        let reUpdate = false;
        if (!(boardID in this.#boardWatchers)) {
            this.#boardWatchers[boardID] = new BoardWatcher(boardID, () => {
                if (boardID == this.#boardID) {
                    const { board, draft } = this.#boardWatchers[boardID];
                    this.preview.board = isDraft ? draft : board;
                }
            });
        } else {
            reUpdate = true;
        }
        await this.#boardWatchers[boardID].watch();

        const {metadata} = this.#boardWatchers[boardID];

        console.log("Metadata:", metadata);
        if (metadata && !metadata.error) {
            let name = metadata.path.name;
            document.head.querySelector("title").innerHTML = `${name} | Board Viewer | Squidly`;
        } else if (metadata && metadata.error) {
            this.root.toggleAttribute("error", true);
            this.errorWindow.innerHTML = ERROR_SCREENS[metadata.error.code];
            console.error(metadata.error);
        }

        if (reUpdate) {
            const { board, draft } = this.#boardWatchers[boardID];
            this.preview.board = isDraft ? draft : board;
        }

        await this.loadStyles();

        document.body.toggleAttribute("loaded", true);  
    }

    async #setAACBoard(rootID) {
        document.body.toggleAttribute("loaded", false);  

        const manager = new BoardSetWatcher(rootID);

        timerLogger.tic("load board and metadata");
        const [meta] = await Promise.all([
            getBoardMetadata(rootID),
            manager.load(),
        ]);
        timerLogger.toc("load board and metadata");


        if (meta.error) {
            this.root.toggleAttribute("error", true);
            this.errorWindow.innerHTML = ERROR_SCREENS[meta.error.code];
            console.error(meta.error);
        } else {
            let name = meta.path.name;
            document.head.querySelector("title").innerHTML = `${name} | Board Viewer | Squidly`;
            this.accBoard.manager = manager;
        }

        await this.loadStyles();


        document.body.toggleAttribute("loaded", true);  
    }

    setBoard(board) {

        this.root.toggleAttribute('error', false);
        this.#boardID = board;
        if (board) {
            addBoardToRecent(board);
            if (this.mode === "default") {
                this.#setAACBoard(board);
            } else if (this.mode === "preview") {
                this.#setPreviewBoard(board, false);
            } else if (this.mode === "preview-draft") {
                this.#setPreviewBoard(board, true);
            }
        } else {
            console.log("No board specified.");
            this.root.toggleAttribute('error', true);
            this.errorWindow.innerHTML = ERROR_SCREENS[400];
            document.body.toggleAttribute('loaded', true);
        }
    }

    static get usedStyleSheets() {
        return [
            import.meta.resolve("../Assets/AACIcons/icons.css"),
            import.meta.resolve("./index.css")
        ]
    }
}

AACViewer.defineHTMLElement(AACViewer)