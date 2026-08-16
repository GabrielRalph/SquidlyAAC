/**
 * @template {any} T
 */
class FileSystemInterface {
    #onUpdateCallbacks = new Set();

    addOnUpdateCallback(callback) {
        if (callback instanceof Function) {
            this.#onUpdateCallbacks.add(callback);
            return () => this.#onUpdateCallbacks.delete(callback);
        } else {
            return () => {};
        }
    }

    triggerUpdate() {
        for (const callback of this.#onUpdateCallbacks) {
            try {
                callback();
            } catch (error) {
                console.error("Error in onUpdate callback:", error);
            }
        }
    }

    /********************************************************************************
     * Constant file system methods
     ********************************************************************************/

    /**
     * Returns file stats for the given path. 
     * @param {Path|string} path - The path to get the file stats for.
     * @returns {T} The file stats for the given path.
     * @override
     */
    stat(path) { }


    /**
     * Returns whether a file exists at the given path.
     * @param {Path|string} path - The path to get the file stats for.
     * @returns {bool} The file stats for the given path.
     * @override
     */
    exists(path) { }


    /**
     * Checks if a file exists at the given path. 
     * @param {Path|string} path - The path to check for existence.
     * @returns {boolean} True if a file exists at the given path, false otherwise.
     * @override
     */
    isDirectory(path) { return false; }


    /**
     * Returns whether the item at the given path contains any children.
     * @param {Path|string} path - The path to check for children.
     * @returns {boolean} True if the item at the given path has children, false otherwise.
     * @override
     */
    hasChildren(path) { return false; }

    /**
     * Returns the contents of a directory at the given path. 
     * @param {Path|string} path - The path to the directory.
     * @param {boolean} recursive - Whether to include contents of subdirectories.
     * @param {boolean} includeSelf - Whether to include the directory itself in the results.
     * 
     * @returns {Array<T>} An array of file stats for the contents of the directory.
     * @override
     */
    readdir(path, recursive = false, includeSelf = false) { return []; }

    /**
     * Searches for files in the file system that match the given filter function. 
     * @param {function(T): boolean} filterFn - A function that takes a file stat and returns true if it matches the search criteria.
     * @returns {Array<T>} An array of file stats that match the search criteria.
     * @override
     */
    searchFiles(filterFn) { return []; }



    /********************************************************************************
     * Set and Update file system methods
     ********************************************************************************/


    /** 
     * Write a value to a file at the given path.
     * @param {Path|string} path - The path to the file to write to.
     * @param {any} value - The value to write to the file.
     * @returns {boolean} True if the file was written, false otherwise.
     * @override
     */
    set(path, value) { return false; }


    /** 
     * Writes multiple values to the files at the given paths.
     * @param {[Path|string, Object][]} pathValuePairs 
     * @returns {boolean} True if a file was written, false otherwise.
     * @override
     */
    setMultiple(pathValuePairs) { return false; }


     /** 
     * Updates the value of a file at the given path.
     * @param {Path|string} path - The path to the file to write to.
     * @param {Object} value - The value to write to the file.
     * @return {boolean}  True if the file was updated, false otherwise.
     * @override
     */
    update(path, value) {return false; }

    /** 
     * Updates multiple values to the files at the given paths.
     * @param {[Path|string, Object][]} pathValuePairs 
     * @return {boolean} True if some file was updated, false otherwise.
     * @override
     */
    updateMultiple(pathValuePairs) {return false; }


    /********************************************************************************
     * Extended file system manipulation methods
     ********************************************************************************/


    /**
     * Deletes a file or directory at the given path. Deletes recursively 
     * if the path is a directory.
     * @param {Path|string} path - The path to the file to delete.
     * @returns {boolean} True if a file was deleted, false otherwise.
     * @override
     */
    delete(path) { return false; }


    /**
     * Deletes multiple items at the given paths. Deletes recursively 
     * if a path is a directory.
     * @param {Array<Path|string>} paths - The path to the file to delete.
     * @returns {boolean} True if a file was deleted, false otherwise.
     * @override
     */
    deleteMultiple(paths) { return false; }



    /**
     * Move a file from one path to another.
     * @param {Path|string} fromPath - The path to the file to move.
     * @param {Path|string} toPath - The path to move the file to.
     * @returns {boolean} True if the file was moved, false otherwise.
     * @override
     */
    move(fromPath, toPath) { return false; }

    /**
     * Move multiple files from one path to another.
     * @param {Array<Path|string>} fromPaths - The path to the file to move.
     * @param {Path|string} toPath - The path to move the file to.
     * @returns {boolean} True if the files were moved, false otherwise.
     * @override
     */
    moveMultiple(fromPaths, toPath) { return false; }


    /**
     * Renames a file at the given path to a new name.
     * @param {Path|string} fromPath - The path to the file to rename.
     * @param {string} newName - The new name for the file.
     * @returns {boolean} True if the file was renamed, false otherwise.
     * @override
     */
    rename(fromPath, newName) { return false}

     /********************************************************************************
     * History management methods
     ********************************************************************************/

    undo() { }


    redo() { }


    commitHistory() { }
}

export { FileSystemInterface };