/**
 * @typedef {Object} KeyBindingSet
 * @property {Object.<string, function>} bindings - An object mapping key combinations to callback functions.
 * @property {function(KeyboardEvent): any[]} getParams - A function that takes a KeyboardEvent and returns an array of parameters to pass to the callback functions.
*/

/** @type {string} */
const META_KEY = navigator.platform.includes("Mac") ? "⌘" : "Ctrl";

/** @type {Object<string, KeyBindingSet} */
const KEY_BINDING_SETS = { }

/** @type {string} */
let ACTIVE_KEY_BINDING_SET = null;

/**
 * @param {KeyboardEvent} e
 */
function getKeyCombo(e) {
    let key = e.key;
    key = key.length === 1 ? key.toLowerCase() : key;

    if (e.metaKey || e.ctrlKey) {
        key = "Meta+" + key;
    }
    if (e.altKey) {
        key = "Alt+" + key;
    } 
    if (e.shiftKey) {
        key = "Shift+" + key;
    }
    return key;
}

/**
 * @returns {Element} the currently active element, traversing through shadow roots if necessary
 */
function getActiveElement() {
    let active = document.activeElement;

    for (let shadowRoot = active.shadowRoot; shadowRoot; shadowRoot = active.shadowRoot) {
        active = shadowRoot.activeElement;
    }

    return active;
}

const editableTypes = {
    "text": true,
    "textarea": true,
    "search": true,
    "url": true,
    "tel": true,
    "email": true,
    "password": true,
    "number": true,
    "date": true,
    "month": true,
    "week": true,
    "time": true,
    "datetime-local": true,
    "color": true
}

/**
 * @param {Element} element
 * @returns {boolean} true if the element is a text input, false otherwise
 */
function isTextInput(element) {
    let istext = false;
    if (element && typeof element === "object" && typeof element.tagName === "string") {
        const tagName = element.tagName.toLowerCase();
        istext = (tagName === "input" && element.type in editableTypes) || tagName === "textarea" || element.isContentEditable;
    }
    return istext;
}

/**
 * @param {string} name the name of the key binding set
 * @param {Object} keyBindings an object mapping key combinations to callback functions
 * @param {?(event: KeyboardEvent) => any[]} getParams a function that takes a KeyboardEvent
 *                                                    and returns an array of parameters to 
 *                                                    pass to the callback functions.
 */
function registerKeyBindings(name, keyBindings, getParams) {
    if (typeof name !== "string" || name.length === 0) {
        throw new Error("Key binding set name must be a non-empty string");
    }
    if (!keyBindings || typeof keyBindings !== "object") {
        throw new Error("Key bindings must be an object mapping key combinations to callback functions");
    }
    if (Object.values(keyBindings).some(fn => typeof fn !== "function")) {
        throw new Error("Key bindings must be an object mapping key combinations to callback functions");
    }

    if (name in KEY_BINDING_SETS) {
        console.warn(`Key binding set "${name}" is already registered. Overwriting.`);
    }

    KEY_BINDING_SETS[name] = {
        bindings: keyBindings,
        getParams: getParams instanceof Function ? getParams : (event) => [event]
    };
}

function setActiveKeyBindingSet(name) {
    if (typeof name !== "string" || name.length === 0) {
        name = null;
    } else if (!(name in KEY_BINDING_SETS)) {
        console.warn(`Key binding set "${name}" is not registered yet.`);
    }
    ACTIVE_KEY_BINDING_SET = name;
}

window.addEventListener("keydown", e => {
    const activeElement = getActiveElement();
    if (!isTextInput(activeElement)) {
        if (ACTIVE_KEY_BINDING_SET && ACTIVE_KEY_BINDING_SET in KEY_BINDING_SETS) {
            const {bindings, getParams} = KEY_BINDING_SETS[ACTIVE_KEY_BINDING_SET];
            const keyCombo = getKeyCombo(e);
            if (keyCombo in bindings) {
                bindings[keyCombo](...getParams(e));
                // console.log(`Key binding "${keyCombo}" triggered in set "${ACTIVE_KEY_BINDING_SET}"`, bindings[keyCombo]);
                e.preventDefault();
            } else {
                // console.log("BINDINGS: No key binding for", keyCombo, "in set", ACTIVE_KEY_BINDING_SET);
            }
        } else {
            // console.log("BINDINGS: No active key binding set.");
        }
    } else {
        // console.log("BINDINGS: Active element input.");
    }
});

export { registerKeyBindings, setActiveKeyBindingSet, getActiveElement, isTextInput, META_KEY };