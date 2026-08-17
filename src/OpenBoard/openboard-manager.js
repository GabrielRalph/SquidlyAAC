import { unzip } from "../Utilities/zip/browser.js";
import { DataClass, loadFile } from "./dataclass.js";
import { OBBoard } from "./openboard.js";

class OBManifestPaths extends DataClass {
    /** 
     * A mapping of board IDs to their corresponding file paths in the manifest.
     * @type {Object.<string, string>} */
    boards;

    /**
     * A mapping of image IDs to their corresponding file paths in the manifest.
     * @type {Object.<string, string>}
     */
    images = null;

    /**
     * A mapping of sound IDs to their corresponding file paths in the manifest.
     * @type {Object.<string, string>}
     */
    sounds = null;
}

class OBManifest extends DataClass {
    /** 
     * The ID of the root board to load when the manifest is loaded,
     * which should correspond to a board ID 
     * or board path in the manifest paths.
     * @type {string} */
    root;

    /** 
     * The paths to the boards, images, and sounds used in the board set,
     * where each path is a string that can be relative to the manifest URL.
     * @type {OBManifestPaths} */
    paths;
    static paths_parser(value) { return OBManifestPaths.make(value); }

    // /** @type {OBImage[]} */
    // images = [];
    // static images_parser(value) { return value ? value.map(i => OBImage.make(i)) : []; }

    /** 
     * The open-board-set format version, which should be 
     * "open-board-set-0.1" for this version of the manifest.
     * @type {string} */
    format = "open-board-set-0.1";

}   

function pjoin(base, relative) {
    relative = relative.replace(/^.?\//, "");
    base = base.endsWith("/") ? base : base + "/";
    return base + relative;
}

function relativeTo(base, path) {
    if (path.startsWith(base)) {
        return path.slice(base.length);
    } else {
        let pathA = path.split("/").filter(s => s.length > 0);
        let baseA = base.split("/").filter(s => s.length > 0);
        let final = [];
        for (let i = 0; i < Math.min(pathA.length); i++) {
            if (pathA[i] !== baseA[i]) {
                final.push(pathA[i]);
            }
        }
        return final.join("/");
    }
}

function dirname(path) {
    let parts = path.split("/").filter(s => s.length > 0);
    parts.pop();
    return parts.join("/") + (parts.length > 0 ? "/" : "");
}


class OBBoardManager extends DataClass {
    /** 
     * A mapping of board IDs to their corresponding OBBoard instances,
     * @type {Object.<string, OBBoard>} */
    boards = {};
    static boards_parser(value) { 
        return value ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, OBBoard.make(v)])) : {}; 
    }

    /** 
     * The manifest object that provides metadata and paths for the board set,
     * @type {OBManifest} */
    manifest;
    static manifest_parser(value) { return OBManifest.make(value); }


    /**
     * Checks if a board with the specified ID exists in the manager.
     * @param {string} id - The ID of the board to check for.
     * @returns {boolean} True if the board exists, false otherwise.
     */
    hasBoard(id) {
        return id in this.boards;
    }

    /**
     * Gets a board by its ID from the manager's boards mapping.
     * @param {string} id - The ID of the board to retrieve.
     * @returns {OBBoard} The board with the specified ID.
      * @throws {Error} If the board with the specified ID is not found in the manager.
     */
    getBoard(id) {
        if (id in this.boards) {
            return this.boards[id];
        } else {
            throw new Error(`Board ID ${id} not found in boards`);
        }
    }

    /**
     * Gets the root board specified by the manifest's 
     * root property.
     * @returns {OBBoard} The root board .
     * @throws {Error} If the root board ID specified 
     *                 in the manifest is not found.
     */
    get rootBoard() {
        const rootID = this.rootBoardID;
        if (rootID in this.boards) {
            return this.boards[rootID];
        } else {
            throw new Error(`Root board ID ${rootID} not found in boards`);
        }
    }

    /**
     * Gets the root board ID specified by the manifest's root property.
     * @returns {string} The root board ID.
     * @throws {Error} If the root board ID cannot be resolved.
     */
    get rootBoardID() {
        let id = this.manifest.root;
        if (!(id in this.boards)) {
            let res = Object.entries(this.manifest.paths.boards).find(([k, v]) => v == id);
            if (res) {
                id = res[0];
            } else {
                throw new Error(`Root board ID ${id} not found in boards or manifest paths`);
            }
        }

        return id;
    }

    /**
     * Loads a board set from a directory URL, where the manifest.json 
     * file is located at the root of the directory and the board files
     * are located at the paths specified in the manifest.
     */
    static async loadFromDirectory(url, onprogress = () => {}) {
        if (!(onprogress instanceof Function)) {
            onprogress = () => {};
        }

        let manifest = await OBManifest.load(url+"/manifest.json", (p) => onprogress(p * 0.1));
        let nBoards = Object.keys(manifest.paths.boards).length;
        let boards = await Promise.all(
            Object.values(manifest.paths.boards).map(async path => 
                OBBoard.load(pjoin(url,path), (p) => onprogress(0.1 + p * 0.9 / nBoards))
            )
        );
        boards = Object.fromEntries(Object.entries(manifest.paths.boards).map(([k, v], i) => [k, boards[i]]));
        return this.make({ manifest, boards });
    }

    /**
     * Loads a board set from a OBZ (zip) file URL, where the manifest.json file
     * is located at the root of a folder for which board files are located 
     * at the paths.
     * @param {string} url - The URL of the OBZ file to load.
     * @param {function(number):void} onprogress - An optional callback function that receives progress updates as a number between 0 and 1.
     */
    static async loadOBZ(url, onprogress = () => {}) {
        if (!(onprogress instanceof Function)) {
            onprogress = () => {};
        }
        const arrayBuffer = await loadFile(url, "arraybuffer", (p) => onprogress(p * 0.95));
        const files = await new Promise((resolve, reject) => {
            unzip(new Uint8Array(arrayBuffer), (err, zipped) => {
                if (err) {
                    reject(err);
                }
                resolve(zipped);
            });
        });
        onprogress(0.99);
        const filePaths = Object.keys(files).filter(path => 
            path.endsWith("manifest.json")
            && !path.includes("../") 
            && !path.includes("..\\") 
            && !path.startsWith("__MACOSX")
            && !path.startsWith(".")
        )

        if (filePaths.length === 0) {
            throw new Error("No manifest.json found in zip file");
        } else if (filePaths.length > 1) {
            console.warn("Multiple manifest.json files found in zip file, using first one:", filePaths);
        }
        const manifestPath = filePaths[0];
        const manifest = OBManifest.make(JSON.parse(new TextDecoder().decode(files[manifestPath])));
        const manifestDir = dirname(manifestPath);
        const boards = Object.fromEntries(await Promise.all(
            Object.entries(manifest.paths.boards).map(([key, path]) => {
                const fullPath = (manifestDir && manifestDir.length > 0) ? pjoin(dirname(manifestPath), path) : path;
                if (fullPath in files) {
                    const board = OBBoard.make(JSON.parse(new TextDecoder().decode(files[fullPath])));
                    return [key, board];
                } else {
                    throw new Error(`Board file ${fullPath} not found in zip file`);
                }
            })
        ));

        return this.make({ manifest, boards });
    }

    /**
     * Loads a board set from a URL, which can either be a directory URL containing a manifest.json file or an OBZ (zip) file URL containing the manifest and board files. The method determines the type of URL based on its extension and calls the appropriate loading method.
     * @param {string} url - The URL to load the board set from, which can be either a directory URL or an OBZ file URL.
     * @param {function(number):void} onprogress - An optional callback function that receives progress updates as a number between 0 and 1, which can be used to track the loading progress of the board set.
     */
    static async load(url, onprogress) {
        if (url.endsWith(".obz") || url.endsWith(".zip")) {
            return await this.loadOBZ(url, onprogress);
        } else {
            return await this.loadFromDirectory(url, onprogress);
        }
    }
}


export { OBBoardManager, OBManifest, OBManifestPaths, pjoin, relativeTo, dirname };