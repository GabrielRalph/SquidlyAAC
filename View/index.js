import { AACBoard, AACGrid, AACGridWrapper } from "../src/AACWebComponent/aac.js";
import { BoardSetWatcher, BoardWatcher, downloadBoardSet, getBoard, getBoardMetadata } from "../src/Firebase/boards.js";
import * as FB from "../src/Firebase/firebase.js";

FB.initialise();

let styleLoadPromise = AACBoard.loadStyleSheets();
async function setupBoard(rootID) {
    AACBoard.defineHTMLElement(AACBoard, "aac-board");

    /** @type {AACBoard} */
    const aacBoard = document.querySelector("aac-board");

    let isSquidly = true;
    if (!window.SquidlyAPI) {
        window.SquidlyAPI = {
            firebaseOnValue: () => {},
            firebaseSet: () => {},
            speak: () => {},
            loadUtterances: () => {},
            setGridSize: () => {},
        }
        isSquidly = false;
    } else {
        aacBoard.keepCornerFree = true;
    }
    
    aacBoard.root.toggleAttribute("squidly", isSquidly);
    let manager;

    aacBoard.addEventListener("change", async e => {
        // UPDATE STATE 
        window.SquidlyAPI.firebaseSet("value1", JSON.stringify(aacBoard.state));

        if (e.changes.indexOf("history") !== -1) {
            let board = await manager.getBoard(aacBoard.currentBoardID);
            const utterances = board.buttons.map(button => {
                return button.textInserted ? button.utterance : null;
            }).filter(utterance => utterance !== null)
            // Load utternaces
            window.SquidlyAPI.loadUtterances(utterances);

            window.SquidlyAPI.setGridSize(board.grid.rows+1, board.grid.columns);
        }
    });

    aacBoard.addEventListener("insert", e => {
        let utterance = e.button.utterance;
        window.SquidlyAPI.speak(utterance);
    });


    manager = new BoardSetWatcher(rootID);
    await Promise.all([
        manager.load(),
        (async () => {
            let meta = await getBoardMetadata(rootID)
            let name = meta.path.split("\\").pop();
            document.head.querySelector("title").innerHTML = `${name} | Board Viewer | Squidly`;
        })()
    ]);
    aacBoard.manager = manager;
    window.SquidlyAPI.firebaseOnValue("value1", value => {
        if (value) {
            aacBoard.state = JSON.parse(value);
        }
    });
}

async function setupPreview(rootID, isDraft) {
    document.body.toggleAttribute("preview", true);
    AACGridWrapper.defineHTMLElement(AACGridWrapper, "aac-board-preview");
    const aacBoard = document.querySelector("aac-board-preview");

    let LAST_BOARD_ID = null;
    let lastWatcher = null;
    async function setBoard(d) {
        if (d === LAST_BOARD_ID) return;
        LAST_BOARD_ID = d;
        document.body.toggleAttribute("loaded", false);  
        if (isDraft) {
            console.log("WATCHING BOARD", d)
            if (lastWatcher) {
                lastWatcher.stop();
                lastWatcher = null;
            }
            lastWatcher = new BoardWatcher(d, () => {
                const { board, draft } = lastWatcher;
                aacBoard.board = draft || board;
            });
            await lastWatcher.watch();
        } else {
            let board = await getBoard(d, Date.now());
            aacBoard.board = board;
        }


        document.body.toggleAttribute("loaded", true);  
    }

    if (rootID) {
        await setBoard(rootID);
    }
    window.addEventListener("message", async (event) => {
        console.log("MESSAGE RECEIVED", event.data)
        if (event.data.type === "updateBoard") {
            await setBoard(event.data.id);
        }
    })
}

export async function setup() {

    let urlParams = new URLSearchParams(window.location.search);
    let rootID = urlParams.get("board")
    let mode = urlParams.get("mode") || "default";

    if (mode === "default") {
        await setupBoard(rootID);
    } else if (mode === "preview") {
        await setupPreview(rootID, false);
    } else if (mode === "preview-draft") {
        await setupPreview(rootID, true);
    }
    await styleLoadPromise;
    document.body.toggleAttribute("loaded", true);    
}

