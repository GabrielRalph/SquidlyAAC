import * as FB from "./firebase.js";
import { OBBoard } from "../OpenBoard/openboard.js";
import { FirestoreFrame } from "./firestore-frame.js";
import { OBBoardManager } from "../OpenBoard/openboard-manager.js";
import { DataClass } from "../OpenBoard/dataclass.js";
import { Debugger } from "../shared.js";

const BOARD_CACHE = {};
const BOARD_LISTENERS = {}
const BOARD_META_CACHE = {};
const META = new FirestoreFrame("boards");
const DRAFTS = new FirestoreFrame("draft-boards");
const debug = new Debugger("OB-Boards", "background: black; color: limegreen; padding: 5px; border-radius: 5px;");
class ServerTimestamp {
    constructor(value) {
        this.value = value;
        if (!value || typeof value !== "object" || !("seconds" in value) || !("nanoseconds" in value)) {
            this.date = null;
            this.time = 0
        } else {
            this.time = value.seconds * 1000 + value.nanoseconds / 1000000;
            this.date = new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
        }
    }

    get valid() {
        return this.date !== null;
    }

    newer(other) {
        return this.time > other.time;
    }

    toString() {
        if (!this.date) return "-";
        return this.date.toISOString();
    }

    toJSON() {
        return this.value;
    }
}

class BoardMetadata extends DataClass {
    /** @type {string} */
    path = null;

    /** @type {string} */
    owner = null;

    /** @type {ServerTimestamp} */
    createdAt = new ServerTimestamp(null);
    static createdAt_parser(value) { return new ServerTimestamp(value); }

    /** @type {ServerTimestamp} */
    updatedAt = new ServerTimestamp(null);
    static updatedAt_parser(value) { return new ServerTimestamp(value); }

    /** @type {ServerTimestamp} */
    deletedAt = new ServerTimestamp(null);
    static deletedAt_parser(value) { return new ServerTimestamp(value); }

    /** @type {boolean} */
    isDirectory = false;

    /** @type {boolean} */
    public = false;

    /** @type {boolean} */
    favourite = false;

    /** @type {boolean} */
    effectivePublic = false;

    /** @type {boolean} */
    valid = false;

    newer(other) {
        if (other instanceof BoardMetadata) {
            return this.updatedAt.newer(other.updatedAt);
        } else if (other instanceof ServerTimestamp) {
            return this.updatedAt.newer(other);
        }
    }

    static make(data) {
        let boardMetadata = null;
        if (!data || typeof data !== "object") {
            boardMetadata = new BoardMetadata();
        } else {
            boardMetadata = super.make(data);
            boardMetadata.valid = true;
        }
        return boardMetadata;
    }
}

/**
 * @param {string} id
 * 
 * @returns {Promise<OBBoard>}
 */
async function _loadBoard(id) {
    let board = null;
    debug.log("download ", id);
    if (id.startsWith("http")) {
        const response = await fetch(id);
        const text = await response.text();
        board = OBBoard.make(JSON.parse(text));
    } else {
        const blob = await FB.getFile(`boards/${id}`);
        const text = await blob.text();
        board = OBBoard.make(JSON.parse(text));
    }
    return board;
}

async function getBoardMetadata(id) {
    let metadata = new BoardMetadata();
    if (!(id in BOARD_LISTENERS)) {
        try {
            debug.log("listening", id);
            BOARD_LISTENERS[id] = META.onValuePromise(id, async (data) => {
                BOARD_META_CACHE[id] = BoardMetadata.make(data);
                debug.log("metadata ", id, `updatedAt = ${BOARD_META_CACHE[id].updatedAt}`);
            });
        } catch (e) {
            console.warn(`Error listening to board ${id}:`, e);
        }
    }
    await BOARD_LISTENERS[id];
    return BOARD_META_CACHE[id] || metadata;
}

async function _getSquidlyBoard(id) {
    let board = null;
    await getBoardMetadata(id);
    if (!BOARD_META_CACHE[id] || !BOARD_META_CACHE[id].valid) {
        // The doesn't board exists
        console.warn(`Board ${id} does not exist`);
    } else if (!BOARD_META_CACHE[id].updatedAt.valid) {
        // Board has not been created yet
        console.warn(`Board ${id} has not been created yet`);
    } else {
        // If the board is not in the cache, or if the board has 
        // been updated since it was last cached, load it from the server
        if (!(id in BOARD_CACHE) 
            || BOARD_META_CACHE[id].newer(BOARD_CACHE[id].lastUpdated)) {
            debug.log("get board", id, "is new or updated, loading from server");
            BOARD_CACHE[id] = {
                board: _loadBoard(id), 
                lastUpdated: BOARD_META_CACHE[id].updatedAt
            };
        } else {
            debug.log("get board", id, "is up to date, using cached version");
        }
        board = await BOARD_CACHE[id].board;
    }
    return board;
}

/**
 * @param {string} id
 * 
 * @returns {Promise<OBBoard>}
 */
async function getBoard(id) {
    if (id.startsWith("http")) {
        return await _loadBoard(id);
    } else {
        return await _getSquidlyBoard(id);
    }
}

async function downloadBoardSet(rootID) {
    let manager = {
        boards: {},
        manifest: {
            root: rootID,
            paths: {}
        }
    }

    let rec = async (ids) => {
        ids = ids.filter(id => !(id in manager.boards))
        let boards = await Promise.all(ids.map(async id => {
            manager.boards[id] = true;
            const board = await getBoard(id, Date.now())
            console.log("downloaded board", id, board)
            manager.boards[id] = board
            let linkedBoards = board.linkedBoards.map(b => {
                let id = b.data_url || b.id;
                return id;
            })
            await rec(linkedBoards)
        }))
    }

    await rec([rootID])

    manager.manifest.paths.boards = Object.fromEntries(Object.entries(manager.boards).map(([id, board]) => [id, id]));

    return OBBoardManager.make(manager)
}


const DRAFT_VERSION_CACHE = {};
class BoardWatcher {
    board = null;
    version = 0;
    metadata = null;
    callback = null;

    #exists = false;
    #boardsUpdatedAt = new ServerTimestamp(null);
    #initalised = false;
    #gettingBoard = false;

    #id = null;
    #enders = [];
    #saving = false;
    constructor(id, callback) {
        if (id.startsWith("http")) {
            throw new Error("Drafts cannot be watched from URL");
        }
        this.#id = id;
        this.callback = callback;
    }

    log(...args) {
        console.log(`%cBW-[${this.id.slice(-5)}]`, "background: black; color: orange; padding: 5px; border-radius: 5px;", ...args);
    }

    stop() {
        this.#enders.forEach(end => end());
    }

    async watch() {
        this.log("Starting watch");
        this.#enders = (await Promise.all([
            DRAFTS.onValuePromise(this.id, (data) => {
                this.draft = null;
                this.version = 0;
                this.log("Draft data changed", data);
                if (data) {
                    try {
                        this.draft = OBBoard.make(JSON.parse(data.board));
                    } catch (e) {
                        console.error("Error parsing draft board data", e);
                    }
                    this.version = data.version;
                }
                this.call();
            }),
            META.onValuePromise(this.id, async (data) => {
                await this.#updateMetadata(data);
            }),
        ])).slice(0, 2);

        if (!this.#exists) {
            throw new Error("Board does not exist");
        }
        this.#initalised = true;
        this.call(true);
    }

    async #forceMetadataUpdate() {
        let data = await META.get(this.id);
        await this.#updateMetadata(data);
    }

    async #updateMetadata(data) {
        let meta = BoardMetadata.make(data);
        this.log("Metadata updated", meta);
        if (meta.valid) {
            // Implement logic to handle if the board file has been 
            // updated since the last time it was loaded
            this.metadata = meta;
            let log = `Checking if board file needs to be reloaded:\n\tlastUpdated = ${this.#boardsUpdatedAt}\n\tnewUpdated \t= ${meta.updatedAt}`;
            if (!meta.updatedAt.valid) {
                this.log(log + "\n\tboard is new");
                this.#boardsUpdatedAt = new ServerTimestamp();
                this.board = this.defaultBoard();
            } else if (meta.newer(this.#boardsUpdatedAt)) {
                this.log(log + "\n\treloading board file");
                await this.#getBoardFile();
            } else {
                this.log(log + "\n\tboard file is up to date");   
            }
            this.#exists = true;
        } else {
            this.log("Meta data set to null, board does not exist");
            this.#exists = false;
        }   
        this.call();
    }

    async #getBoardFile() {
        if (this.#gettingBoard) {
            await this.#gettingBoard;
        } else {
            this.#gettingBoard = (async () => {
                this.#boardsUpdatedAt = this.metadata?.updatedAt;
                let board = await _loadBoard(this.id)
                this.log("Board file loaded", board);
                this.board = board || OBBoard.makeEmptyBoard(4, 5, this.id);
            })();
            await this.#gettingBoard;
            this.#gettingBoard = false;
        }
    }

    async save(data) {
        this.log("Saving board");
        if (this.#saving) return;
        this.#saving = true;
        await this.updateDraft(data);
        this.log("Calling update function");
        let response = await FB.callFunction('OBBoards-update', {
            boardID: this.id,
        }, "australia-southeast1");
        this.log("Save response", response);
        if (!response.error) {
            this.draft = null;
            await this.#forceMetadataUpdate();
            if (this.#gettingBoard) {
                await this.#gettingBoard;
            }
        }
        this.#saving = false;
        this.call();
    }

    async updateDraft(data) {
        this.version = (this.version || 0) + 1;
        let update = {
            board: JSON.stringify(OBBoard.make(data)),
            version: this.version,
        }
        this.log("Updating draft");
        await DRAFTS.set(this.id, update);
    }
  
    call() { 
        this.log("Call", !this.#saving && this.#initalised && this.callback instanceof Function)
        if (!this.#saving && this.#initalised && this.callback instanceof Function) {
            this.callback();
        }
    }

    get currentBoard() {
        if (this.draft) {
            return this.draft;
        } else if (this.board) {
            return this.board;
        } else {
            return this.defaultBoard()
        }
    }

    get isSaving() {
        return this.#saving;
    }

    get id() {
        return this.#id;
    }

    defaultBoard() {
        return OBBoard.makeEmptyBoard(4, 5, this.id);
    }
}

class BoardSetWatcher {
    #rootID = null;
    #boards = {}
    constructor(rootID) {
        this.#rootID = rootID;
    }

    get rootBoardID() {
        return this.#rootID;
    }
    get rootBoard() {
        return this.#boards[this.#rootID];
    }

    /**
     * @param {string} id - The board ID to load.
     * @param {boolean} waitForLinkedBoards - Whether to wait for all linked boards to be loaded before returning.
     * @returns {Promise<OBBoard>} - A promise that resolves to the loaded board.
     */
    async getBoard(id, waitForLinkedBoards = false) {
        const board = await this.#loadBoard(id);
        
        if (board) {
            // Load all linked boards in the background
            let childrenBoards = board.linkedBoards.map(b => b.data_url || b.id)
            let proms = childrenBoards.map(id => this.#loadBoard(id));
            if (waitForLinkedBoards) await Promise.all(proms);
        }

        return board;
    }

    /**
     * @param {string} id - The board ID to load.
     * @returns {Promise<OBBoard>} - A promise that resolves to the loaded board.
     */
    async #loadBoard (id) {
        if (!(id in this.#boards)) {
            this.#boards[id] = await getBoard(id);
        }
        return this.#boards[id];
    }
    
    async load() {
        await this.getBoard(this.#rootID, true);
    }
}

export { getBoardMetadata, getBoard, downloadBoardSet, BoardWatcher, BoardSetWatcher };