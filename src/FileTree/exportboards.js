import { OBBoard, OBBoardManager, OBLoadBoard } from "../OpenBoard/openboard.js";
import { Path, PS, FStats } from "./FileSystem/FileSystem.js";
import { FirebaseFrame } from "../Firebase/firebase-frame.js";
import * as FB from "../Firebase/firebase.js";

FB.initialise();

const F = new FirebaseFrame("openboard-sets");

/**
 * @param {OBBoardManager} bset
 */
async function getMissingBoards(bset) {
    let proms = []
    let missing = false;
    const {boards} = bset;
    for (let id in boards) {
        const board = boards[id];
        for (let button of board.buttons) {
            if (button.load_board) {
                const loadBoard = button.load_board;
                if (!(loadBoard.id in boards)) {
                    if (loadBoard.data_url) {
                        let p = async () => {
                            try {
                                let data = await OBBoard.load(loadBoard.data_url);
                                boards[loadBoard.id] = data;
                            } catch (e) {
                                console.warn("Failed to load board with id:", loadBoard.id, "from url:", loadBoard.data_url, "for button:", button, "in board:", board, "Error:", e);
                            }
                        }
                        proms.push(p());
                    } else {
                        console.warn("Missing board with id:", loadBoard.id, "for button:", button, "in board:", board);
                        missing = true;
                    }
                }
            }
        }
    }

    await Promise.all(proms);
    for (let id in boards) {
        const board = boards[id];
        for (let button of board.buttons) {
            if (button.load_board) {
                const loadBoard = button.load_board;
                if (!(loadBoard.id in boards)) {
                    console.warn("Missing board with id:", loadBoard.id, "for button:", button, "in board:", board);
                    missing = true;
                    button.load_board = null;
                }
            }
        }
    }
}


/**
 * @param {OBBoardManager} bset
 */
function reIDBoardSet(bset) {
    let old2new = {};
    let newBoards = {};
    for (let oldID in bset.boards) {
        let newID = F.push("squidly");
        old2new[oldID] = newID;
        newBoards[newID] = OBBoard.make({
            ...bset.boards[oldID],
            id: newID
        })
    }

    for (let newID in newBoards) {
        let board = newBoards[newID];
        for (let button of board.buttons) {
            if (button.load_board) {
                let newID = old2new[button.load_board.id];
                button.load_board = OBLoadBoard.make({
                    id: newID
                })
            }
        }
    }

    let newRootID = old2new[bset.rootBoardID];
    let newRoot = newBoards[newRootID];
    return [newRoot, newBoards];
}

function board2FS(fs = {}, boards, root, rootPath = "Unity\\Unity 36") {
    rootPath = new Path(rootPath);
    let id2path = {};

    /** @param {OBBoard} board */
    function traverse(board, currentPath) {
        if (!(board instanceof OBBoard)) {
            console.log(board, rootPath);
        }
        id2path[board.id] = currentPath;
        fs[currentPath.toString()] = {
            // isDirectory: true,
            boardID: board.id,
            dateCreated: Date.now(),
            lastUpdated: Date.now()
        }
        let childrenBoards = []
        for (let button of board.buttons) {
            if (button.load_board && !(button.load_board.id in id2path)) {
                let label = button.label || (Math.random()).toString(36).replace(".", "~")
                let newPath = currentPath.join(label.replace(/\\/g, "|"));
                const board = boards[button.load_board.id];
                if (!board) {
                    console.warn("Board not found for button:", button, " for ", rootPath + "");
                    continue;
                }
                childrenBoards.push([board, newPath]);
                traverse(board, newPath);
            }
        }
    }
   
    traverse(root, rootPath);
    return id2path;
}


const REPLACERS = [
    [/\//g, "~0~"],
    [/\./g, "~1~"],
    [/#/g,  "~2~"],
    [/\$/g, "~3~"],
    [/\[/g, "~4~"],
    [/\]/g, "~5~"],
]


function path2key(path) {
    if (/~\[0-5]+~/.test(path)) {
        throw new Error("File paths cannot contain the sequence ~[0-5]+~ as it is reserved for escaping special characters.");
    }
    for (let [regex, repl] of REPLACERS) {
        path = path.replace(regex, repl);
    }
    let key = path;
    return key;
}

function key2path(key) {
    let path = key;
    for (let [char, repl] of Object.entries(REPLACERS)) {
        path = path.split(repl).join(char);
    }
    return path;
}


const urls = [
    ["../BoardFiles/unity36.obz", "Unity\\Unity 36"],
    ["../BoardFiles/U28.obz", "Unity\\Unity 28"],

    ["../BoardFiles/VocalFlair24.obz", "VocalFlair\\VocalFlair 24"],
    ["../BoardFiles/VocalFlair40.obz", "VocalFlair\\VocalFlair 40"],
    ["../BoardFiles/VocalFlair60.obz", "VocalFlair\\VocalFlair 60"],
    ["../BoardFiles/VocalFlair84.obz", "VocalFlair\\VocalFlair 84"],
    ["../BoardFiles/VocalFlair112.obz", "VocalFlair\\VocalFlair 112"],

    ["../BoardFiles/QuickCore24.obz", "QuickCore\\QuickCore 24"],
    ["../BoardFiles/QuickCore40.obz", "QuickCore\\QuickCore 40"],
    ["../BoardFiles/QuickCore60.obz", "QuickCore\\QuickCore 60"],
    ["../BoardFiles/QuickCore84.obz", "QuickCore\\QuickCore 84"],
    ["../BoardFiles/QuickCore112.obz", "QuickCore\\QuickCore 112"],
]
const BoardSetsFS = {};
const AllBoards = {}
await Promise.all(urls.map(async ([url, rootPath]) => {
    console.log(`Loading board set: ${url}`);
    let bset = await OBBoardManager.load(url);
    await getMissingBoards(bset);
    let [root, boards] = reIDBoardSet(bset);
    board2FS(BoardSetsFS, boards, root, rootPath);
    for (let id in boards) {
        AllBoards[id] = boards[id];
    }
}));


let BoardSetsFS_safe = Object.fromEntries(Object.entries(BoardSetsFS).map(([path, data]) => {
    let safePath = path2key(path);
    return [safePath, data];
}));
F.set("users/squidly", BoardSetsFS_safe);
F.set("boards", null);
const entries = Object.entries(AllBoards);
const batchSize = 100;
for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    await Promise.all(batch.map(async ([id, board]) => {
        let safeID = path2key(id);
        await F.set(`boards/${safeID}`, board);
    }));
    console.log(`Uploaded batch ${i / batchSize + 1} of ${Math.ceil(entries.length / batchSize)}`);    
}   

