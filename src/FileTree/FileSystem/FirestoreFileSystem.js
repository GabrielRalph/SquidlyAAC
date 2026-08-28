import { FStore, get } from "../../Firebase/firebase.js";
import { FirestoreFrame } from "../../Firebase/firestore-frame.js";
import { copy, Debugger, differences, isEqual, updateObject } from "../../Utilities/shared.js";
import { FileSystemInterface } from "./FileSystemInterface.js";
import { Path } from "./Path.js";
import { PathNode } from "./PathNode.js";


const DEBUG = new Debugger(
    "FSFS",
    "color: #c53e0d; border: 2px solid #c53e0d; border-radius: 5px;"
);

/**
 * This is a basic interface for file stats that 
 * includes a path property. It can be extended 
 * to include additional properties as needed.
 * @typedef {Object} FStatsBasic
 * @property {Path|string} path - The path of the file or directory.
 */


/**
 * @template {FileTemplate} T
 * @extends {FileSystemInterface<T>}
 * @class 
 */
class FirestoreFileSystem extends FileSystemInterface {
    _dataByID = {}
    _lastSyncedDataByID = {}
    _correctedPaths = {}
    _dataAsFS = new PathNode();
    _history = [];
    _historyIndex = 0;

    /** @type {FirestoreFrame} */
    fstore = null;

    constructor(col) {
        super();
        this.fstore = new FirestoreFrame(col);
    }

    /********************************************************************************
     * Helper methods 
     ********************************************************************************/

    getPathByID(id) {
        const path = this._correctedPaths[id] ?? null;
        return path ? new Path(path) : null;
    }

    getNewID() {
        return this.fstore.newDocID();
    }

    isDeletedValue(value) {
        return !value || !(value.deletedAt === undefined || value.deletedAt === false || value.deletedAt === null);
    }

    assignDeletedValue(object) {
        if (object) {
            object.deletedAt = FirestoreFrame.TimestampSymbol;
        }
        return object;
    }

    getUniquePath(value, id) {
        let newPath = Path.parse(value.path);
        let valueAtPath = this._dataAsFS.get(newPath);
        for (let i = 0; valueAtPath && valueAtPath !== id && i < 20; i++) {
            newPath = Path.parse(
                FirestoreFileSystem.duplicatePrefix(newPath.toString())
            );
            valueAtPath = this._dataAsFS.get(newPath);
        }
        if (valueAtPath && valueAtPath !== id) {
            throw new Error(`Could not find a unique path for the new value at ${value.path}`);
        }
        return newPath;
    }

    run(method, ...args) {
        if (typeof this[method] === "function") {
            return this[method](...args);
        } 
    }


    fullUpdate() {
        this._buildFileSystem();
        this._syncToDatabase();
        this.commitHistory();
        this.triggerUpdate();
    }
  
    /********************************************************************************
     * Private file set, update and file system build methods
     ********************************************************************************/

    _setFileByID(id, value, hardDelete = false) {
        let set = true;
        if (value) {
            this._dataByID[id] = copy(value);
        } else {
            if (id in this._dataByID) {
                this.assignDeletedValue(this._dataByID[id]);
            } else {
                set = false;
            }
        }
        return set;
    }

    _updateFileByID(id, value, hardDelete = false) {
        DEBUG.logStart("Updating file by ID", `\nid: ${id}, \nvalue: ${JSON.stringify(value)}, \nhardDelete: ${hardDelete}`);
        let updated = true;
        if (value && typeof value === "object") {
            if (id in this._dataByID) {
                this._dataByID[id] = updateObject(
                    this._dataByID[id], value
                );
            } else {
                this._dataByID[id] = value;
            }
        } else if (id in this._dataByID) {
            this.assignDeletedValue(this._dataByID[id]);
        } else {
            updated = false;
        }
        DEBUG.logEnd();
        return updated;
    }

    _setFileByPath(path, value) {
        let set = false;
        let oldID = this._dataAsFS.get(path);
        if (oldID) {
            set = this._setFileByID(oldID, value);
        } else {
            let newID = this.getNewID();
            set = this._setFileByID(newID, value);
        }
        return set;
    }

    _updateFileByPath(path, value) {
        let updated = false;
        let oldID = this._dataAsFS.get(path);
        if (oldID) {
            updated = this._updateFileByID(oldID, value);
        } else {
            let newID = this.getNewID();
            updated = this._setFileByID(newID, value);
        }
        return updated;
    }

    /**
     * Gets a file by its ID.
     * @param {string} id - The ID of the file to get.
     * @returns {T|null} The file with the given ID, or null if not found.
     */
    _getFileByID(id) {
        return id && id in this._dataByID ? copy(this._dataByID[id]) || null : null;
    }

    /**
     * Gets a file by its path.
     * @param {Path|string} path - The path of the file to get.
     * @returns {T|null} The file with the given path, or null if not found.
     */
    _getFileByPath(path) {
        let id = this._dataAsFS.get(path);
        return this._getFileByID(id);
    }

    /********************************************************************************
     * Database synchronization methods
     ********************************************************************************/

    syncFromDatabase(changes) {
        let changed = false;
        changes = changes.filter(change => !(change[3]?.doc?.metadata?.hasPendingWrites??false));
        for (let [id, doc, type, change] of changes) {
            if (type === "removed") {
                doc = null;
            }
            let oldDoc = this._dataByID[id];
            oldDoc = this.isDeletedValue(oldDoc) ? null : oldDoc;

            changed ||= !isEqual(oldDoc, doc);
            this._dataByID[id] = doc;
            this._lastSyncedDataByID[id] = copy(doc);
        }
        if (changed) {
            DEBUG.log("Synced from database with", Object.keys(changes).length + " changes.", changes);
            this.run("onAfterSync", changes);
            this._buildFileSystem();
            this.commitHistory();
            this.triggerUpdate();
        }
    }

    _syncToDatabase() {
        let changes = {}
        // For each file id in from current data and last synced data.
        const allIDs = new Set([...Object.keys(this._dataByID), ...Object.keys(this._lastSyncedDataByID)]);
        for (let id of allIDs) {
            
            const oldValue = this._lastSyncedDataByID[id];
            const newValue = this._dataByID[id];

            const isOldDeleted = this.isDeletedValue(oldValue);
            const isNewDeleted = this.isDeletedValue(newValue);

            let change = null;
            // The file has been created or restored from deletion
            if (isOldDeleted && !isNewDeleted) {
                change = newValue;

            // The file has been deleted
            } else if (!isOldDeleted && isNewDeleted) {
                change = this.assignDeletedValue({})

            // The file has been updated
            } else if (!isOldDeleted && !isNewDeleted) {
                change = differences(oldValue, newValue);
            }

            // Otherwise file has been deleted but was 
            // already deleted, so no change is needed.

            // If a change has occured, then add it to the changes object 
            // and update the last synced data.
            if (change !== null) {
                changes[id] = copy(change);
                this._lastSyncedDataByID[id] = isNewDeleted ? null : copy(newValue);
            }
        }

        if (Object.keys(changes).length > 0) {
            DEBUG.log("Syncing to database with", Object.keys(changes).length + " changes.", JSON.stringify(changes, null, 2));
            this.fstore.batchSet(changes, { merge: true });
        }
    }

    _buildFileSystem() {
        this._dataAsFS = new PathNode();
        this._correctedPaths = {};
        for (let id in this._dataByID) {
            const value = this._dataByID[id];
            let validPath = !this.isDeletedValue(value) && value.path 
                            && typeof value.path === "string" 
                            && value.path.length > 0;
            if (validPath) {
                const path = this.getUniquePath(value, id);
                this._correctedPaths[id] = path;
                this._dataAsFS.set(path, id);
            }
        }
        DEBUG.log("Built file system with", Object.keys(this._dataByID).length, "files and directories.");
        this.run("onAfterBuildFileSystem", this._dataAsFS);
    }

    /********************************************************************************
     * Constant file system methods
     ********************************************************************************/
    
    /**
     * Returns file stats for the given path. 
     * @param {string} id - The path to get the file stats for.
     * @returns {T} The file stats for the given path.
     * @override
     */
    statByID(id) {
        let value = this._getFileByID(id);
        value = value ? copy(value) : null;
        value = this.isDeletedValue(value) ? null : value;
        if (value) {
            value.path = this._correctedPaths[id];
        }
        return value;
    }

    /**
     * Returns file stats for the given path. 
     * @param {Path|string} id - The path to get the file stats for.
     * @returns {T} The file stats for the given path.
     * @override
     */
    stat(path) {
        if (path.length === 0) {
            return {
                path: new Path(),
            }
        } else {
            let id = this._dataAsFS.get(path);
            return this.statByID(id);
        }
    }

    /**
     * Returns file stats for the given path. 
     * @param {Path|string} id - The path to get the file stats for.
     * @returns {boolean} The file stats for the given path.
     * @override
     */
    isDirectory(path) { return true; }


     /**
     * Returns whether the item at the given path contains any children.
     * @param {Path|string} path - The path to check for children.
     * @returns {boolean} True if the item at the given path has children, false otherwise.
     * @override
     */
    hasChildren(path) { return this._dataAsFS.getDecendantPaths(path).length > 0; }

    /**
     * Returns file stats for the given path. 
     * @param {Path|string} id - The path to get the file stats for.
     * @returns {boolean} The file stats for the given path.
     * @override
     */
    exists(path) {
        const value = this._getFileByPath(path);
        return value !== null && !this.isDeletedValue(value);
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
            this._dataAsFS.getDecendantValues(path)
            :  this._dataAsFS.getChildrenValues(path);

        if (includeSelf) {
            let ownID = this._dataAsFS.get(path);
            if (ownID) {
                result.unshift(ownID);
            }
        }

        result = result
            .map(this.statByID.bind(this))
            .filter(Boolean)

        console.log("readdir", path.toString())
        return result;
    }

  
    /**
     * Searches for files in the file system that match the given filter function. 
     * @param {function(T): boolean} filterFn - A function that takes a file stat and returns true if it matches the search criteria.
     * @returns {Array<T>} An array of file stats that match the search criteria.
     * @override
     */
    searchFiles(filterFn) { 
        return Object.entries(this._dataByID).filter(([id, v]) => 
            v !== null && !this.isDeletedValue(v) && filterFn(v)
        ).map(([id, v]) => this.statByID(id)); 
    }


    /********************************************************************************
     * Main Set/Update methods
     ********************************************************************************/

    /** 
     * Write a value to a file at the given path.
     * @param {Path|string} path - The path to the file to write to.
     * @param {any} value - The value to write to the file.
     * @returns {boolean} True if the file was written, false otherwise.
     * @override
     */
    set(path, value) { 
        let set = this._setFileByPath(path, value);
        if (set) {
            this.run("onAfterSet", path, value);
            this.fullUpdate();
        }
        return set;
    }

    /** 
     * Writes multiple values to the files at the given paths.
     * @param {[Path|string, Object][]} pathValuePairs 
     * @returns {boolean} True if some file was written, false otherwise.
     * @override
     */
    setMultiple(pathValuePairs) {
        let set = pathValuePairs
            .map(([path, value]) => this._setFileByPath(path, value))
            .some(Boolean)

        if (set) {
            this.run("onAfterSetMultiple", pathValuePairs);
            this.fullUpdate();
        }
        return set;
    }



    /** 
     * Updates the value of a file at the given path.
     * @param {Path|string} path - The path to the file to write to.
     * @param {Object} value - The value to write to the file.
     * @return {boolean}  True if the file was updated, false otherwise.
     * @override
     */
    update(path, value) {
        let updated = this._updateFileByPath(path, value);

        if (updated) {
            this.run("onAfterUpdate", path, value);
            this.fullUpdate();
        }

        return updated
    }

    /** 
     * Updates multiple values to the files at the given paths.
     * @param {[Path|string, Object][]} pathValuePairs 
     * @return {boolean} True if some file was updated, false otherwise.
     * @override
     */
    updateMultiple(pathValuePairs) {
        let updated = pathValuePairs
            .map(([path, value]) => this._updateFileByPath(path, value))
            .some(Boolean)

        if (updated) {
            this.run("onAfterUpdateMultiple", pathValuePairs);
            this.fullUpdate();
        }

        return updated;
    }


    /********************************************************************************
     * Extended file system manipulation methods
     ********************************************************************************/
    
    _delete(path) {
        let decendantPaths = this._dataAsFS.getDecendantPaths(path, true);
        return decendantPaths
                .map((p) => this._setFileByPath(p, null))
                .some(Boolean);
    }

    /**
     * Deletes a file at the given path.
     * @param {Path|string} path - The path to the file to delete.
     * @returns {boolean} True if the file was deleted, false otherwise.
     * @override
     */
    delete(path) { 
        let deleted = this._delete(path);
        if (deleted) {
            this.run("onAfterDelete", path);
            this.fullUpdate();
        }
        return deleted;
    }


     /**
     * Deletes multiple items at the given paths. Deletes recursively 
     * if a path is a directory.
     * @param {Array<Path|string>} paths - The path to the file to delete.
     * @returns {boolean} True if a file was deleted, false otherwise.
     * @override
     */
    deleteMultiple(paths) {
        let deleted = paths
            .map((path) => this._delete(path))
            .some(Boolean);
       
        if (deleted) {
            this.run("onAfterDeleteMultiple", paths);
            this.fullUpdate();
        }

        return deleted;
    }


    _move(fromPath, toPath) {
        fromPath = Path.parse(fromPath);
        toPath = Path.parse(toPath);
        DEBUG.logStart("Moving files", `/${fromPath.toString()} to /${toPath.toString()}`);
        let moved = false;
        if (this.isDirectory(toPath)) {
            const newPath = toPath.join(fromPath.name);
    
            // Ensure the new path is unique by deleting 
            // any existing file at the new path
            this._delete(newPath);
    
            const fromPathParent = fromPath.parent;
            let ids = this._dataAsFS.getDecendantValues(fromPath, true);


            for (let id of ids) {
                const oldPath = this.getPathByID(id);
                if (oldPath) {
                    const newFilePath = toPath.join(oldPath.relative(fromPathParent));
                    DEBUG.log("Moving files", `${oldPath} -> ${newFilePath}`);
                    moved = this._updateFileByID(id, {
                        path: newFilePath+""
                    }) || moved;
                }
            }
        }

       
        DEBUG.logEnd();
        return moved;
    }

    /**
     * Move a file from one path to another.
     * @param {Path|string} fromPath - The path to the file to move.
     * @param {Path|string} toPath - The path to move the file to.
     * @returns {boolean} True if the file was moved, false otherwise.
     * @override
     */
    move(fromPath, toPath) { 
        let moved = this._move(fromPath, toPath);
        if (moved) {
            this.run("onAfterMove", fromPath, toPath);
            this.fullUpdate();
        }   
        return moved;

    }


     /**
     * Move multiple files from one path to another.
     * @param {Array<Path|string>} fromPaths - The path to the file to move.
     * @param {Path|string} toPath - The path to move the file to.
     * @returns {boolean} True if the files were moved, false otherwise.
     * @override
     */
    moveMultiple(fromPaths, toPath) {
        let moved = fromPaths
            .map(fromPath => this._move(fromPath, toPath))
            .some(Boolean);
        
        if (moved) {
            this.run("onAfterMoveMultiple", fromPaths, toPath);
            this.fullUpdate();
        } 

        return moved;
    }


    /**
     * Renames a file at the given path to a new name.
     * @param {Path|string} fromPath - The path to the file to rename.
     * @param {string} newName - The new name for the file.
     * @returns {boolean} True if the file was renamed, false otherwise.
     */
    rename(fromPath, newName) {
        let renamed = false;
        let id = this._dataAsFS.get(fromPath);
        let value = this._getFileByID(id);
        if (value && value.path && id) {
            const oldPath = Path.parse(value.path);
            const newPath = oldPath.parent.join(newName);

            this._delete(newPath);

            value.path = newPath.toString();
            this._updateFileByID(id, value);

            let children = this._dataAsFS.getChildrenPaths(fromPath);
            children.forEach(childPath => {
                this._move(childPath, newPath);
            });

            this.run("onAfterRename", fromPath, newPath);
            this.fullUpdate();
            renamed = true;
        }
        return renamed;
    }

    /********************************************************************************
     * History methods
     ********************************************************************************/

    commitHistory() {
        DEBUG.log("Committing history at index", this._historyIndex, "with", this._history.length, "entries.");
        this._history = this._history.slice(0, this._historyIndex + 1);
        this._history.push({
            data: copy(this._dataByID),
        });
        this._historyIndex = this._history.length - 1;
        this.run("onAfterCommitHistory");
    }

    undo() {
        if (this._historyIndex > 0) {
            this._historyIndex--;
            const previousState = this._history[this._historyIndex].data;
            this._dataByID = copy(previousState);
            this._dataAsFS = new PathNode();

            this._buildFileSystem();
            this._syncToDatabase();
            this.triggerUpdate();
        }
    }

    redo() {
        if (this._historyIndex < this._history.length - 1) {
            this._historyIndex++;
            const nextState = this._history[this._historyIndex].data;
            this._dataByID = copy(nextState);
            this._dataAsFS = new PathNode();
            
            this._buildFileSystem();
            this._syncToDatabase();
            this.triggerUpdate();
        }
    }

     /********************************************************************************
     * Watch methods
     ********************************************************************************/

    async watch() {}

    stopWatch() {}


     /********************************************************************************
     * Static Methods
     ********************************************************************************/


    static duplicatePrefix(path) {
        let prefix = path.match(/\((\d+)\)\s*$/)
        if (prefix) {
            let num = parseInt(prefix[1]);
            num++;
            return path.replace(/\((\d+)\)\s*$/, `(${num})`);
        } else {
            return path + " (2)";
        }
    }
}

export { FirestoreFileSystem };