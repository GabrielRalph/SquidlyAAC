import { Path } from "./Path.js";

/**
 * This class represents a file system as an object tree structure. 
 * Each node in the tree can have children and can store a value.
 * The class provides methods to set, get, and delete values at 
 * specific paths, as well as to retrieve all paths 
 * or children paths from a given path.
 * 
 * @template {Object} T
 */
class PathNode {
    /** @type {Object<string, PathNode} */
    #children = {};

    /** @type {?PathNode} */
    #parent = null;

    /** @type {Path} */
    #path = "";

    /** @type {T} */
    value = null;

    constructor(parent = null, path = "") {
        this.#path = new Path(path);
        this.#parent = parent;
    }


    #getNodeHelper(path, buildOut = false, index = 0) {
        if (path.length === 0) {
            return this;
        }

        const part = path.parts[index];
        if (buildOut && !(part in this.#children)) {
            this.#children[part] = new PathNode(this, this.#path.join(part));
        }
        return part in this.#children ? 
                 (index === path.length - 1 ? 
                    this.#children[part] :  
                    this.#children[part].#getNodeHelper(path, buildOut, index + 1)) 
                : null;
    }

    #getNode(path, buildOut = false) {
        return this.#getNodeHelper(Path.parse(path), buildOut);
    }

    /**
     * Returns the child paths of this node.
     * @returns {Path[]} An array of child paths.
     */
    get childPaths() {
        return Object.values(this.#children).map(child => child.path);
    }

    /**
     * Returns the child paths of this node.
     * @returns {T[]} An array of child paths.
     */
    get childValues() {
        return Object.values(this.#children).map(child => child.value).filter(Boolean);
    }

    /**
     * Returns the decendant paths of this node.
     * @returns {Path[]} An array of child paths.
     */
    get decendantPaths() {
        return Object.values(this.#children).flatMap(child => [child.path, ...child.decendantPaths]);
    }

    /**
     * Returns the decendant values of this node.
     * @returns {T[]} An array of child paths.
     */
    get decendantValues() {
        return Object.values(this.#children).flatMap(child => [child.value, ...child.decendantValues]).filter(Boolean);
    }

    /**
     * Returns the path of this node.
     * @returns {Path} The path of this node.
     */
    get path() {
        return this.#path.clone();
    }

    /**
     * Returns if this node has a value.
     * @returns {boolean} True if this node has a value, false otherwise.
     */
    get hasValue() {
        return this.value !== null;
    }
  
    /**
     * Returns a string representation of this node and its children.
     * @param {string} prefix - A string to prefix each line with.
     * @returns {string} A string representation of this node and its children.
     */
    toString(prefix = "") {
        let str = prefix + this.#path.name + "\n" + Object.values(this.#children).map(child => child.toString(prefix + "  ")).join("\n");
        return str;
    }

    /**
     * Prunes the tree by removing any child nodes that 
     * do not have a value and do not have any children.
     * @returns {void}
     */
    prune() {
        for (const [part, child] of Object.entries(this.#children)) {
            child.prune();
            if (!child.hasValue && Object.keys(child.#children).length === 0) {
                delete this.#children[part];
            } 
        }
    }
  
    /**
     * Sets the value at the given path.
     * @param {Path|string} path - The path to set the value at.
     * @param {?T} value - The value to set.
     * @returns {void}
     */
    set(path, value) {
        const node = this.#getNode(path, true);
        node.value = value;
    }

    /**
     * Gets the value at the given path.
     * @param {Path|string} path - The path to get the value from.
     * @returns {?T} The value at the given path, or null if not found.
     */
    get(path) {
        const node = this.#getNode(path, false);
        return node?.value ?? null;
    }
    
    /**
     * Gets the children paths of a node at the given path.
     * @param {Path|string} path - The path to delete the value from.
     * @returns {Path[]}
     */
    getChildrenPaths(path) {
        const node = this.#getNode(Path.parse(path), false);
        if (!node) return [];
        return node.childPaths;
    }

     /**
     * Gets the children values of a node at the given path.
     * @param {Path|string} path - The path to delete the value from.
     * @returns {T[]}
     */
    getChildrenValues(path) {
        const node = this.#getNode(Path.parse(path), false);
        if (!node) return [];
        return node.childValues;
    }

    /**
     * Gets the decendants paths of a node at the given path.
     * @param {Path|string} path - The path to delete the value from.
     * @returns {Path[]}
     */
    getDecendantPaths(path, includeSelf = false) {
        const node = this.#getNode(Path.parse(path), false);
        let decendantPaths = [];
        if (node) {
            decendantPaths = node.decendantPaths;
            if (includeSelf) decendantPaths.unshift(node.path);
        }
        return decendantPaths;
    }

    /**
     * Gets the decendants values of a node at the given path.
     * @param {Path|string} path - The path to delete the value from.
     * @returns {T[]}
     */
    getDecendantValues(path, includeSelf = false) {
        const node = this.#getNode(Path.parse(path), false);
        let decendantValues = [];
        if (node) {
            decendantValues = node.decendantValues;
            if (includeSelf) decendantValues.unshift(node.value);
        }
        return decendantValues;
    }
}


export { PathNode };