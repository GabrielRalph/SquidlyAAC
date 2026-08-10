import { ChangeExecuter, FStats } from "./FileSystem/FileSystem.js";
import { FStoreFileSystem } from "./FileSystem/FStoreFileSystem.js";
import { Path } from "./FileSystem/path.js";
export class OBFStat extends FStats {
    #isDirectory = false;
    constructor(path, contents = null, fs) {
        super(path, contents, fs);
        this.#isDirectory = fs.readdir(path).length > 0;
    }

    get boardID() {
        return this.metadata && this.metadata.id;
    }

    get isDirectory() {
        return this.#isDirectory || super.isDirectory;
    }

    get isFavourite() {
        return this.contents && this.contents.favourite;
    }

    get isPublic() {
        return this.metadata && (this.metadata.public || this.metadata.effectivePublic);
    }

    get public() {
        return this.metadata && this.metadata.public;
    }

    asPublic(value) {
        const contents = this.contents || {};
        contents.public = value;
        return contents;
    }

    asFavourite(value) {
        const contents = this.contents || {};
        contents.favourite = value;
        return contents;
    }

    asEffectivePublic(value) {
        const contents = this.contents || {};
        contents.effectivePublic = value;
        return contents;
    }

    getEffectivePublic(fs) {
        let result = false;
        if (this.contents && this.contents.public) {
            result = true;
        } else if (this.path.length > 1) {
            let parentPath = this.path.parent;
            let stat = fs.stat(parentPath);
            if (stat) {
                result = stat.getEffectivePublic(fs);
            }
        }
    
        return result;
    }

    /**
     * @returns {boolean} returns true if the file is an AAC board, false otherwise.
     */
    get isBoard() {
        return this.metadata && !this.metadata.isDirectory;
    }
}


/**
 * @classdesc A file system that interacts with Firebase Realtime Database and is tailored for AAC (Augmentative and Alternative Communication) boards.
 * @extends {FStoreFileSystem<OBFStat>}
 * @class
 */
export class OBFileSystem extends FStoreFileSystem {
    constructor(user) {
        super(user, "boards", OBFStat);
    }


    _parseNewItem(path, contents) {
        contents.favourite = contents.favourite || false;
        contents.public = contents.public || false;
        contents.effectivePublic = !contents.isDirectory && this.stat(path).getEffectivePublic(this);
        contents.updatedAt = null;
        contents.deletedAt = false;
        console.log("Parsed new item at path:", path, "with contents:", JSON.stringify(contents, null, 2));
        return contents;
    }

    _parseUpdateItem(path, update) {
        delete update.isDirectory
        return update;
    }
        
    /**
     * @param {string|Path} path the path to check for existence
     * @returns {ChangeExecuter} returns a ChangeExecuter object that can be used to execute the change.
     */
    getCreateBoardExecuter(path) {
        let result = new ChangeExecuter();
        let fstat = this.stat(path);
        if (fstat !== null) {
            result.conflict = true;
        } else {
            path = path instanceof Path ? path : new Path(path);

            // Check if any parent directory is a board
            let subPath = path.parent;
            let isRootBoard = true;
            for (let i = 0; i < path.length-1; i++) {
                let subStat = this.stat(subPath);
                if (subStat && subStat.isBoard) {
                    isRootBoard = false;
                    break
                } else {
                    subPath = subPath.parent;
                }
            }

            result.execute = async () => {
                let values = { 
                    isDirectory: false,
                    favourite: isRootBoard,
                }
                console.log("Creating board at path:", path, "with values:", values);
                this._set(path, values);
                this._commitHistory();
                this._onUpdate();
            }
        }
        return result;
    }

    getMoveExecuter(oldPath, newPath) {
        let result = super.getMoveExecuter(oldPath, newPath);
        if (result.changed) {
            let oldExecuter = result.execute;
            result.execute = async() => {
                oldExecuter();
                this.#downPropagateEffectivePublic(newPath);
                this._mergeWithLastHistory();
            }
        }
        return result;
    }


    favourite(path, bool = true) {
        path = path instanceof Path ? path : new Path(path);
        let fstat = this.stat(path);
        if (fstat.isBoard) {
            this._set(path, fstat.asFavourite(bool));

            if (fstat.public && !bool) {
                this.#makePublic(path, false);
            } 

            this._commitHistory();
            this._onUpdate();
        }
    }

    #downPropagateEffectivePublic(path) {
        path = path instanceof Path ? path : new Path(path);
        

        let stat = this.stat(path);
        let initBool = stat.getEffectivePublic(this);
        if (stat.isBoard) {
            this._set(path, stat.asEffectivePublic(initBool));
        }

        let recurse = (path, bool) => {
            let files = this.readdir(path);
            for (let file of files) {
                let newBool = bool;
                if (file.isBoard) {
                    newBool = !!(bool || file.public);
                    this._set(file.path, file.asEffectivePublic(newBool));
                }
                recurse(file.path, newBool);
            }
        }
        recurse(path, initBool);
    }

    makePublic(path, bool = true) {
        if (this.#makePublic(path, bool)) {
            this._commitHistory();
            this._onUpdate();
        }
    }

    #makePublic(path, bool = true) {
        let t1 = performance.now();
        path = path instanceof Path ? path : new Path(path);
        let tx = performance.now();
        let fstat = this.stat(path);
        let dx = performance.now() - tx;
        if (fstat.isBoard) {
            const newContents = fstat.asPublic(bool);
            if (!fstat.isFavourite && bool) {
                newContents.favourite = true;
            }
            // set board public status
            this._set(path, newContents);
            
            // update effective public status for this board and its children
            this.#downPropagateEffectivePublic(path); 
        }
        return fstat.isBoard;
    }

    isDirectory(){return true;}
}
