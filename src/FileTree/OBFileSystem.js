import { FStore } from "../Firebase/firebase.js";
import { FirestoreFrame } from "../Firebase/firestore-frame.js";
import { copy, Debugger } from "../shared.js";
import { FirestoreFileSystem } from "./FileSystem/FirestoreFileSystem.js";
import { Path } from "./FileSystem/Path.js";
const {where, serverTimestamp} = FStore;

const DEBUG = new Debugger(
    "FileSystem",
    "background: #125cde; color: white; padding: 5px; border-radius: 5px;"
);


/**
 * @typedef {Object} IServerTimestamp
 * @property {number} seconds - The seconds part of the timestamp.
 * @property {number} nanoseconds - The nanoseconds part of the timestamp.
 */

/**
 * @typedef {Object} OBFileData
 * @property {boolean}  isDirectory - Indicates if the descriptor represents a directory.
 * @property {boolean}  public - Indicates if the descriptor is public.
 * @property {boolean}  favourite - Indicates if the descriptor is marked as favourite.
 * @property {boolean}  effectivePublic - Indicates if the descriptor is effectively public.
 * 
 * @property {IServerTimestamp|false}   deletedAt - The timestamp when the file or directory was deleted.
 * @property {IServerTimestamp|nule}    updatedAt - The timestamp when the file or directory was last updated.
 * @property {IServerTimestamp}         createdAt - The timestamp when the file or directory was created.
 * 
 * @property {string}  path - The path of the file or directory.
 * @property {string}  owner - The owner of the file or directory.
 * 
 * @property {boolean} [hasThumbnail] - Indicates if the descriptor has a thumbnail.
 */
class OBFStats{

    /**
     * @param {OBFileData} data - The data object containing file information.
     * @param {OBFileSystem} fs - The file system instance.
     */
    constructor(id, data, fs) {
        this.data = data;
        this.hasChildren = fs.hasChildren(data.path);
        this.path = new Path(data.path);
        this.id = id;
        this.mode = this.data.isDirectory ? 
            OBFStats.MODES.Folder : 
            (   
                this.hasChildren ? 
                    OBFStats.MODES.GridSet : OBFStats.MODES.Grid
            );
    }

    get boardID() {
        return this.id
    }

    /**
     * Returns true if the file is a directory, false otherwise.
     * @returns {boolean} True if the file is a directory, false otherwise.
     */
    get isDirectory() {
        return this.data && this.data.isDirectory;
    }

    /**
     * Returns true if the file is marked as favourite, false otherwise.
     * @returns {boolean} True if the file is favourite, false otherwise.
     */
    get favourite() {
        return this.data && this.data.favourite;
    }

    /**
     * Returns true if the file is effectively public,
     * meaning it is either public itself or has a public ancestor.
     * @returns {boolean} True if the file is effectively public, false otherwise.
     */
    get isPublic() {
        return this.data && (this.data.public || this.data.effectivePublic);
    }

    /**
     * Returns true if the file has directly been made public, 
     * false otherwise.
     * @returns {boolean} True if the file is public, false otherwise.
     */
    get public() {
        return this.data && this.data.public;
    }


    get contents() {
        return copy(this.data);
    }

    /**
     * Checks if the file is an AAC board.
     * @returns {boolean} returns true if the file is an AAC board, false otherwise.
     */
    get isBoard() {
        return this.data && !this.data.isDirectory;
    }

    static get MODES() {
        return {
            Grid: 0,
            GridSet: 1,
            Folder: 2,
        }
    }

    static symbolicDirectory(path, root) {
        return new OBFStats(null, {
            isDirectory: true,
            symbolic: true,
            path: Path.parse(path).toString(),
        }, root);
    }
}



/**
 * @classdesc A file system that interacts with Firebase Realtime Database and is tailored for AAC (Augmentative and Alternative Communication) boards.
 * @extends {FirestoreFileSystem<OBFStats>}
 * @class
 */
class OBFileSystem extends FirestoreFileSystem {
    #user = null;
    #watchPromise = null;
    #unsubscribe = null;

    constructor(user) {
        super("boards");
        this.#user = user;
    }

    /**
     * Returns file stats for the given path. 
     * @param {Path|string} id - The path to get the file stats for.
     * @returns {OBFStats} The file stats for the given path.
     * @override
     */
    stat(path) {
        if (path.length === 0) {
            return OBFStats.symbolicDirectory("", this);
        } else {
            let id = this._dataAsFS.get(path);
            return this.statByID(id);
        }
    }

    /**
     * Returns file stats for the given path. 
     * @param {Path|string} id - The path to get the file stats for.
     * @returns {OBFStats} The file stats for the given path.
     * @override
     */
    statByID(id) {
        let data = super.statByID(id)
        return data ? new OBFStats(id, data, this) : null;
    }

     /**
     * Returns file stats for the given path. 
     * @param {Path|string} id - The path to get the file stats for.
     * @returns {Array<T>} The file stats for the given path.
     * @override
     */
    readdir(path, recursive = false, includeSelf = false) { 
        path = Path.parse(path);
        let result = recursive ? 
            this._dataAsFS.getDecendantPaths(path) :
            this._dataAsFS.getChildrenPaths(path);
        if (includeSelf) {  result.unshift(path); } 
        result = result.map(p => this.stat(p));
        result = result.filter(Boolean);
        return result;
    }


    _newFile(path, data, name = "folder") {
        let newID = null;
        DEBUG.logStart("File Creation", `Creating new ${name} at path: ${path.toString()}`);
       
        // Ensure that no file exists at the given path
        path = Path.parse(path);
        if (!this.stat(path)) {

            // Create a new file with the provided data
            newID = this.getNewID();

            // Set the file data at the new ID
            if (this._setFileByID(newID, data)) {

                DEBUG.log("File Creation", `Created ${name}.`, `path: ${path.toString()}\nid: ${newID}`);
                this._buildFileSystem();
                this._syncToDatabase();
                this.triggerUpdate();
                // We won't commit to history here becuase once the the server timestamp
                // is created that will propagate to the local data and trigger a full 
                // update, which will be recorded in history.
            } else {
                DEBUG.log("File Creation", `Failed to create ${name}`, `path: ${path.toString()}\nid: ${newID}`);
                newID = null;
            }
        }

        DEBUG.logEnd();
        return newID;
    }

    /**
     * Creates a new folder at the specified path with default properties.
     * @param {Path|string} path - The path where the new folder will be created.
     * @returns {string|null} The ID of the newly created folder, or null if creation failed.
     */
    newFolder(path) {
        return this._newFile(path, {
            isDirectory: true,
            updatedAt: null,
            deletedAt: false,

            public: false,
            favourite: false,
            effectivePublic: false,

            createdAt: FirestoreFrame.TimestampSymbol,

            path: path.toString(),
            owner: this.#user,
        }, "folder");
    }

    /**
     * Creates a new board at the specified path with default properties.
     * @param {Path|string} path - The path where the new board will be created.
     * @returns {string|null} The ID of the newly created board, or null if creation failed.
     */
    newBoard(path) {
        return this._newFile(path, {
            isDirectory: false,
            updatedAt: null,
            deletedAt: false,

            public: false,
            favourite: this.isRootBoard(path),
            effectivePublic: this.isEffectivePublic(path), 

            createdAt: FirestoreFrame.TimestampSymbol,

            path: path.toString(),
            owner: this.#user,
        }, "board");
    }

    /**
     * After building the file system, this method is called 
     * to update the effectivePublic property of each file 
     * and directory based on its own public status and 
     * the public status of its ancestors.
     */
    onAfterBuildFileSystem() {
        let recurse = (path, effectivePublic) => {
            let id = this._dataAsFS.get(path);
            if (id && id in this._dataByID) {
                let value = this._dataByID[id];
                effectivePublic ||= value.public;
                value.effectivePublic = !this.isDeletedValue(value) 
                                        && effectivePublic 
                                        && !value.isDirectory;
            }
            for (let childPath of this._dataAsFS.getChildrenPaths(path)) {
                recurse(childPath, effectivePublic);
            }
        }
        recurse("", false);
    }
    
    /**
     * Checks if the given path is a board.
     * @param {Path|string} path - The path to check.
     * @returns {boolean} True if the path is a board, false otherwise.
     */
    isBoard(path) {
        let stat = this.stat(path);
        return stat && stat.isBoard;
    }

    /**
     * Checks if the given path is effectively public, 
     * meaning it is either public itself 
     * or has a public ancestor.
     * @param {Path|string} path - The path to check.
     * @returns {boolean} True if the path is a directory, false otherwise.
     */
    isEffectivePublic(path) {
        let effectivePublic = false;
        path = Path.parse(path);
        if (path.length > 0) {
            const stat = this.stat(path);
            effectivePublic = (stat && stat.public && stat.isBoard) 
                              || this.isEffectivePublic(path.parent);
        }
        return effectivePublic;
    }

    /**
     * Checks if the given path is a root board,
     * meaning it is a board that does not have
     * any board ancestors.
     * @param {Path|string} path - The path to check.
     * @returns {boolean} True if the path is a root board, false otherwise.
     */
    isRootBoard(path) {
        path = Path.parse(path).parent;
        if (path.length === 0) {
            return true;
        } else {
            return !this.isBoard(path) && this.isRootBoard(path.parent);
        }
    }

  
    
    /**
     * Marks a file or directory at the given path as favourite or not.
     * @param {Array<Path|string>|Path|string} paths - The path to the file or directory.
     * @param {boolean} bool - Whether to mark as favourite (true) or not (false).
     * @returns {void}
     * @override
     */
    toggleFavourite(paths, bool) {
        if (!Array.isArray(paths)) paths = [paths];
        
        let change = paths
            .map(path => this.#toggleBoardProp(path, bool, "favourite"))
            .some(Boolean);
        
        if (change) this.fullUpdate();

        return change;
    }

    /**
     * Marks a file or directory at the given path as public or not.
     * @param {Array<Path|string>|Path|string} path - The path to the file or directory.
     * @param {boolean} [bool=true] - Whether to mark as public (true) or not (false).
     * @returns {void}
     * @override
     */
    togglePublic(paths, bool) {
        if (!Array.isArray(paths)) paths = [paths];

        let change = paths
            .map(p => this.#toggleBoardProp(p, bool, "public"))
            .some(Boolean);

        if (change) this.fullUpdate();

        return change;
    }

    #toggleBoardProp(path, bool, prop) {
        let updated = false;
        let fstat = this.stat(path);
        if (fstat && fstat.isBoard) {
            let value = bool ?? !fstat[prop];
            updated = this._updateFileByPath(path, {[prop]: value});
        }
        return updated;
    }


 

    async watch() {
        let success = true;
        const query = this.fstore.query(where("owner", "==", this.#user), where("deletedAt", "==", false));    
        try {
            if (this.#watchPromise) {
                DEBUG.logStart("Watching", "Waiting on old watch promise.");
                await this.#watchPromise;
            } else {
                DEBUG.logStart("Watching", "Setting up Firestore listener for collection:");
                this.#watchPromise = this.fstore.onValuePromise(query, this.syncFromDatabase.bind(this))
                this.#unsubscribe = await this.#watchPromise;
            }
        } catch (error) {
            console.error("Error setting up Firestore listener:", error);
            success = false;
        }
        DEBUG.logEnd();
        return success;
    }
    
    stopWatch() {
        this.#unsubscribe && this.#unsubscribe();
        this.#watchPromise = null;
    }
}


export { OBFileSystem, OBFStats };