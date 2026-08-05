import { FileSystem, FStats } from "./FileSystem.js";

import * as FB from "../../Firebase/firebase.js";
const { writeBatch, collection, query, where, onSnapshot, getDocs, doc, updateDoc, serverTimestamp } = FB.FStore;

/**
 * @typedef {Object} FileDescriptor
 * @property {boolean} isDirectory - Indicates if the descriptor represents a directory.
 * @property {?string} [fileID] - Indicates if the descriptor represents a file.
 * @property {number} [dateCreated] - The timestamp when the file or directory was created.
 * @property {number} [lastUpdated] - The timestamp when the file or directory was last updated.
 */

function duplicatePrefix(path) {
    let prefix = path.match(/\((d+)\)\s+$/)

    if (prefix) {
        let num = parseInt(prefix[1]);
        num++;
        return path.replace(/\((d+)\)\s+$/, `(${num})`);
    } else {
        return path + " (2)";
    }
}

const VALID_KEYS = {
    "isDirectory": true,
    "public": true,
    "favourite": true,
    "deletedAt": true,
    "effectivePublic": true,
    "path": true,
}

/**
 * @template {FStats} T
 * @extends {FileSystem<T>}
 * @classdesc A file system that interacts with Firebase Realtime Database.
 */
export class FStoreFileSystem extends FileSystem {
     /** @type {FirebaseFrame} */
    #user = null;
    #collection = null;
    #changedKeySet = {};
    #writeSet = {};
    #changedKeySetTimeout = false;
    #unsubscribe = null;
    #watchPromise = null;

    #commitHistoryDelay = 100;
    #commitHistoryTimeout = null;


    #key2docID = {};

    /**
     * @param {string} ref The Firebase reference path for the file system.
     * @param {new (path: string, contents: any, dirOverride: boolean) => T} fstatClass The class to use for file statistics.
     * @constructor
     */
    constructor(user, col, fstatClass = FStats) {
        super(fstatClass);
        this.#collection = collection(col);
        this.#user = user;
    }

    _createDirectory(path) {
        this._set(path, {
            isDirectory: true,
        });
    }


    _deleteFile(path, commitHistory = true) {
        let isChanged = super._deleteFile(path, commitHistory);
        if (isChanged) {
            this.#setPath(path, null);
        }
    }

    _superSet(path, value, commitHistory = true) {
        if (value === null) {
            return super._deleteFile(path, commitHistory);
        } else {
            return super._set(path, value, commitHistory);
        }
    }

    _set(path, value, commitHistory = true) {
        let isChanged = super._set(path, value, commitHistory);
        if (isChanged) {
            this.#setPath(path, value, commitHistory);
        }
    }

    _parseNewItem(path, contents) {
        return contents;
    }


    #setPath(path, value, commitHistory = true) {
        const key = path.toString();
        if (value === null) {
            const id = this.#key2docID[key];
            this.#changedKeySet[id] = {deletedAt: serverTimestamp()};
        } else {
            const update = Object.fromEntries(
                Object.entries(VALID_KEYS)
                .map(([k]) => [k, value[k]])
                .filter(([_, v]) => v !== undefined)
            );
            update.path = key;
            update.deletedAt = false;
            

            // If the value doesn't have an ID, generate a new document ID for it
            let id = value.id;
            if (!id || typeof id !== "string") {
                update.createdAt = serverTimestamp();
                update.owner = this.#user;
                
                id = doc(this.#collection).id;
                this._get(path).id = id; // Update the FStats instance with the new ID
                this.#writeSet[id] = this._parseNewItem(path, update);
            } else {
                this.#changedKeySet[id] = this._parseUpdateItem(path, update);
            }
        }

        this.#triggerBatchUpdate();
    }

    async #triggerBatchUpdate() {
        if (!this.#changedKeySetTimeout) {
            this.#changedKeySetTimeout = true;
            await new Promise(resolve => window.requestAnimationFrame(resolve));

            let changedKeySet = this.#changedKeySet;
            let writeSet = this.#writeSet;

            this.#writeSet = {};
            this.#changedKeySet = {};
            this.#changedKeySetTimeout = false;
            
            const batch = writeBatch();
            for (const id in changedKeySet) {
                const data = changedKeySet[id];
                console.log("Updating document:", id, JSON.stringify(data, null, 2));
                batch.update(doc(this.#collection, id), data);
            }
            for (const id in writeSet) {
                const data = writeSet[id];
                console.log("Writing document:", id, JSON.stringify(data, null, 2));
                batch.set(doc(this.#collection, id), data);
            }

            try {
                await batch.commit();
            } catch (error) {
                // Should probably back track changes here but for now just log the error
                console.warn("Error committing batch:", error);
            }
        }
    }

    #updateDoc(doc, removed = false, triggerUpdate = true) {
        let data = doc.data();
        if (!data || !data.path || typeof data.path !== "string") { return; }
        let {path} = data;
        const oldValue = this._get(path);

        // A file with the same path but a different ID has been added, 
        // which indicates a duplicate. We will rename the new 
        // file to avoid conflicts.
        if (oldValue && oldValue.id !== doc.id) {
            path = duplicatePrefix(path);
            console.warn(`OldValue ID (${oldValue.id}) does not match doc ID (${doc.id}) for path ${path}. This may indicate a data inconsistency.`);
        }
        
        this.#key2docID[path] = doc.id;
    
        if (removed) {
            data = null;
        } else {
            delete data.path;
            delete data.owner;
            data.id = doc.id;
        }

        let change = this._superSet(path, data);
        if (change && triggerUpdate) {
            this._onUpdate();
            if (!this.#commitHistoryTimeout) {
                this.#commitHistoryTimeout = setTimeout(() => {
                    this._commitHistory();
                    this.#commitHistoryTimeout = null;
                }, this.#commitHistoryDelay);
            }
        }
    }
    
    async watch() {
        const watchPromise = async () => {
            const q = query(this.#collection, where("owner", "==", this.#user), where("deletedAt", "==", false));
            try {
                const initialSnapshot = await getDocs(q);
                for (const doc of initialSnapshot.docs) {
                    this.#updateDoc(doc, false, false);
                }
                this._onUpdate();
                this._discardCurrentHistory();
                
                this.#unsubscribe = onSnapshot(q, (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        this.#updateDoc(change.doc, change.type === "removed");
                    });
                });
            } catch (error) {
                console.warn("Error watching Firestore collection:", error);
            }
        }
        if (this.#watchPromise) {
            await this.#watchPromise;
        } else {
            this.#watchPromise = watchPromise();
        }
    }
    
    stopWatch() {
        this.#unsubscribe && this.#unsubscribe();
        this.#watchPromise = null;
    }
}
