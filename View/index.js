import * as FB from "../src/Firebase/firebase.js";
import { AACBoard, AACGridWrapper } from "../src/AACWebComponent/aac.js";
import { 
    addBoardToRecent,
    BoardSetWatcher, 
    BoardWatcher, 
    getBoardMetadata 
} from "../src/Firebase/boards.js";
import { ShadowElement } from "../src/SvgPlus/shadow-element.js";
import { timerLogger } from "../src/Utilities/shared.js";
import { changeVoice } from "../src/Firebase/text2speech.js";

(async () => {
    timerLogger.tic("initialise firebase");
    let user = await FB.initialise();
    timerLogger.toc("initialise firebase", `[user: ${user ? user.uid.slice(0, 5)+ "..." : "none"}]`);
})();

const urlParams = new URLSearchParams(window.location.search);
const voice = urlParams.get("voice") || "default";
changeVoice(voice);

const ERROR_SCREENS = {
    404: `
    <i-bw no-board></i-bw>
    <h1>
        Missing Board
    </h1>
    <p>
        The board you are <br>
        looking for does not exist. <br>
        This may occur if the board has been <br>
        deleted or the URL is incorrect. <br>
        Please check the link <br>
        and try again.
    </p>
    `,
    403: `
    <i-bw lock></i-bw>
    <h1>
        Locked Board
    </h1>
    <p>
        You do not have access to this board. <br>
        If someone has shared this board with you, <br> 
        please ensure they have made the board public <br>
        If this is your board, please make sure you <br>
        have signed in to view the board.
    </p>
    `,
    500:`
    <i-bw error></i-bw>
    <h1>Something went wrong.</h1>
    <p>
        An unexpected error occurred while <br>
        trying to load the board.<br>
        Please try again later.
    </p>
    `,
    204:`
    <i-bw empty></i-bw>
    <h1>        
        No Content  <br> 
        Available
    </h1>
    <p>
        The board exists but contains <br> 
        no content to display. This may <br> 
        occur if the board has not  <br> 
        been saved yet.
    </p>
    `,
    400: `
    <i-bw no-board></i-bw>
    <h1>
        Missing Board ID
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
                this.mode = event.data.mode;
                this.setBoard(event.data.id);
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
                    const { saved, draft } = this.#boardWatchers[boardID];
                    this.preview.board = isDraft ? draft : saved;
                }
            });
        } else {
            reUpdate = true;
        }

        await this.#boardWatchers[boardID].watch();

        const {metadata} = this.#boardWatchers[boardID];
        if (metadata && !metadata.error) {
            let name = metadata.path.name;
            document.head.querySelector("title").innerHTML = `${name} | Board Viewer | Squidly`;
        } else if (metadata && metadata.error) {
            this.root.toggleAttribute("error", true);
            this.errorWindow.innerHTML = ERROR_SCREENS[metadata.error.code];
            console.error(metadata.error);
        }

        if (reUpdate) {
            const { saved, draft } = this.#boardWatchers[boardID];
            this.preview.board = isDraft ? draft : saved;
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