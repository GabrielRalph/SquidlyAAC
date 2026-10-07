
import * as FB from "./firebase.js";
import { OBImage } from "../OpenBoard/openboard.js";
import { Debugger } from "../Utilities/shared.js";
import { DataClass } from "../OpenBoard/dataclass.js";
const { getCountFromServer, collection, query, where, and, or, onSnapshot, getDocs, doc, updateDoc, limit} = FB.FStore;
const symbolCollection = () => collection("symbols");

/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~ Symbol Sets and Variant Categories ~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

const SYMBOL_SETS = [
    {
        name: "Mulberry",
        value: "MULBERRY"
    },
    {
        name: "ARASAAC",
        value: "ARASAAC"
    },
    {
        name: "Jellow",
        value: "JELLOW"
    },
    {
        name: "PiCom",
        value: "PICOM"
    },
    {
        name: "Tawasol",
        value: "TAWASOL"
    },
    {
        name: "AAC Image Library",
        value: "AACIL"
    },
    {
        name: "OpenMoji",
        value: "OPENMOJI"
    },
]
const SET_BY_VALUE = {
   ...Object.fromEntries( SYMBOL_SETS.map(({name, value}) => [value, name]) ),
   "PUBLIC": "Public",
   "PRIVATE": "My Symbols",
}


// /**
//  * @typedef {Object} VariantCategory
//  * @property {string} name
//  * @property {string} group
//  * @property {string} type
//  * @property {boolean} [isColors]
//  * @property {Array<{color?: string, name: string, value: (number|string)}>} [options]
//  * @property {Object<string, Object<string, (number|string)>>} [map]
//  */
// /** @type {Object<string, VariantCategory>} */
const VARIANT_KEY_OPTIONS = {
    "skin-arasaac": {
        name: "Skin Tone (ARASAAC)",
        group: "skin",
        type: "list",
        isColors: true,
        options: [
            {
                color: "#F5E5DE",
                name:  "white",
                value: "0",
            },
            {
                name: "assian",
                color: "#F4ECAD",
                value: "2",
            },
            {
                name: "aztec",
                color: "#E3AB72",
                value: "3",
            },
            {
                name:  "mulatto",
                color: "#CF9D7C",
                value: "4"
            },
            {
                name: "black",
                color: "#A65C17",
                value: "1",
            },
        ]
    },
    "hair-arasaac": {
        name: "Hair Color",
        group: "hair",
        type: "list",
        isColors: true,
        options: [
            {
                color: "#A65E26",
                name: "brown",
                value: "1",
            },
             {
                color: "#6A2703",
                name: "darkBrown",
                value: "2",
            },
            {
                color: "#EFEFEF",
                name: "gray",
                value: "3",
            },
            {   
                color: "#AAABAB",
                name: "darkGray",
                value: "4",
            },
            {
                name: "black",
                color: "#020100",
                value: "6",
            },
            {
                name: "red",
                color: "#ED4120",
                value: "5",
            },
            {
                color: "#FDD700",
                name: "blonde",
                value: "0",
            },
           
       
        ]
    },
    "skin-mulberry": {
        name: "Skin Tone (Mulberry)",
        group: "skin",
        type: "list",
        isColors: true,
        options: [
            {
                color: "#ffeec8",
                name:  "white",
                value: "0",
            },
            {
                name: "black",
                color: "#9c5c25",
                value: "1",
            }
        ]
    },
    "plural": {
        name: "Grammatical Number",
        type: "list",
        // name: "Plural",
        // type: "boolean",

        group: "plural",
        isColors: false,
        options: [
            {
                name: "Singular",
                value: "0",
            },
            {
                name: "Plural",
                value: "1",
            }
        ]
    
    },
    skin: {
        type: "list",
        name: "Skin Tone",
        isColors: true,
        map: {
            "0": {
                "skin-mulberry": "0",
                "skin-arasaac": "0",
                "skin-fitzpatrick": "0",
            },
            "1": {
                "skin-mulberry": "0",
                "skin-arasaac": "2",
                "skin-fitzpatrick": "1",
            },
            "2": {
                "skin-mulberry": "0",
                "skin-arasaac": "3",
                "skin-fitzpatrick": "2",
            },
            "3": {
                "skin-mulberry": "1",
                "skin-arasaac": "4",
                "skin-fitzpatrick": "3",
            },
            "4": {
                "skin-mulberry": "1",
                "skin-arasaac": "1",
                "skin-fitzpatrick": "4",
            },
        },
        options: [
            {
                color: "#fadcbc",
                name: "LIGHT",
                value: "0",
            },
            {
                color: "#e0bb95",
                name: "LIGHT-MEDIUM",
                value: "1",
            },
            {
                color: "#bf8f68",
                name: "MEDIUM",
                value: "2",
            },
            {
                color: "#9b643d",
                name: "DARK-MEDIUM",
                value: "3",
            },
            {
                color: "#594539",
                name: "DARK",
                value: "4",
            }
        ]
    }
}

/**
 * @typedef {string} URL
 */

/**
 * @typedef {keyof typeof VARIANT_KEY_OPTIONS} VariantKey
 */


FB.initialise();
const T = new Debugger("Symbols(Text)", `color: orange;`)
const S = new Debugger("Symbols(Semantic)", `color: rgb(17, 154, 227);`)
T.forced = S.forced = true;



class SSymbol extends DataClass {
    /** @type {string} The unique identifier of the symbol. */
    id;


    /** @type {string} The owner of the symbol. */
    owner;

    /** @type {boolean} Whether the symbol can be used commercially. */
    commercial = false;
    
    /** @type {boolean} Whether the symbol is public. */
    public = false;

    /** @type {string} The symbol set to which the symbol belongs. */
    symbol_set;
    

    
    
    /** @type {string|null} The title of the symbol (if different from the search phrase). */
    title = null;
    
    /** @type {string} The search phrase associated with the symbol. */
    search_phrase;


    
    /** @type {?string|Object} The licence information for the symbol. */   
    licence = null;



    /** @type {string} The format of the symbol image. */
    format;
    
    /** @type {number} The width of the symbol image. */
    width;

    /** @type {number} The height of the symbol image. */
    height;


    
    /** @type {VariantKey[]} The list of variant keys associated with the symbol. */
    variant_keys;
    
    /** @type {Object<string, URL>} The mapping of variant keys to their corresponding URLs. */
    variants;
    
    /** @type {URL} The URL of the default variant symbol image. */
    url;



    /** @type {string} The source identifier of the default variant symbol image. */
    source_id = null;
    
    /** @type {Object<string, (string|number)>} [variant_source_ids]   The mapping of variant keys to their source identifiers. */
    variant_source_ids = {}


    
    
    /** @type {number} The vector search distance */
    distance = -1;
    

    /** @type {string|null} The key of the currently selected variant. */
    forcedSelectedVariantKey = null;


    get selectedVariantKey() {
        return this.forcedSelectedVariantKey || this.getVariantKey(getVariantKeyValues());
    }

    get name() {
        return this.title ?? this.search_phrase ?? null;
    }

    get selectedURL() {
        return this.getVariantURL(this.selectedVariantKey);
    }

    get symbolSetDisplayName() {
        return SET_BY_VALUE[this.symbol_set] || null;
    }

    get OBImage() {
        return this.getOBImage(this.selectedVariantKey);
    }

    get isOwner() {
        return this.owner === FB.getUID();
    }


    get symbolSetFilterValue() {
        return this.symbol_set ? this.symbol_set : (this.public ? "PUBLIC" : "PUBLIC");
    }


    isInSet(symbolSet) {
        if (symbolSet instanceof Set) {
            return symbolSet.has(this.symbol_set) 
                || (symbolSet.has("PUBLIC") && this.public && this.symbol_set === null) 
                || (symbolSet.has("PRIVATE") && this.isOwner && this.symbol_set === null);
        } else {
            return (this.symbol_set === symbolSet) 
                || (symbolSet === "PUBLIC" && this.public && this.symbol_set === null) 
                || (symbolSet === "PRIVATE" && this.isOwner && this.symbol_set === null);
        }
    }


    /**
     * @param {Object<string, string>} variantKeyValues - The mapping of variant keys to their values.
     * @returns {string} The normalized variant key string.
     */
    getVariantKey(variantKeyValues) {
        return this.variant_keys.map(
            key => variantKeyValues[key] ?? "0"
        ).join("_");
    }

    /**
     * @param {string} variantKey - The key of the variant to retrieve the URL for.
     * @returns {URL|null} The URL of the specified variant, or the default URL if not found.
     */
    getVariantURL(variantKey) {
        return this.variants[variantKey] || this.url || null;
    }

    /**
     * @param {string} variantKey - The key of the variant to retrieve the OBImage for.
     * @returns {OBImage} The OBImage instance for the specified variant.
     */
    getOBImage(variantKey) {
        return OBImage.make({
            url: this.getVariantURL(variantKey),
            width: this.width,
            height: this.height,
            license: this.license,
            content_type: "image/" + this.format,
            id: this.id,
            name: this.name
        })
    }

  


    static normaliseSearchPhrase(searchPhrase) {
        if (typeof searchPhrase !== "string") {
            return "";
        }

        return searchPhrase
            // Normalize Unicode compatibility characters.
            .normalize("NFKC")

            // Lowercase using Unicode-aware casing.
            .toLocaleLowerCase("en")

            // Remove combining marks / accents.
            // e.g. é -> e, ñ -> n
            .normalize("NFD")
            .replace(/\p{M}/gu, "")

            // Treat apostrophes as word separators.
            // Handles straight and common curly apostrophes.
            .replace(/['’‘ʼ`]/g, "")

            // Replace underscores with spaces.
            .replace(/_/g, " ")

            // Normalize various dash characters to a normal hyphen.
            .replace(/[\u2010-\u2015\u2212]/g, "-")

            // Replace other punctuation/symbols with spaces,
            // while preserving letters, numbers, hyphens and whitespace.
            .replace(/[^\p{L}\p{N}\s-]/gu, " ")

            // Collapse whitespace.
            .replace(/\s+/g, " ")

            // Remove whitespace around hyphens.
            .replace(/\s*-\s*/g, "-")

            // Remove leading/trailing whitespace and hyphens.
            .replace(/^[\s-]+|[\s-]+$/g, "");
    }

    /**
     * Creates a new SSymbol instance from the provided data.
     * @param {Partial<SSymbol>} data - The data to create the symbol from.
     * @param {string} id - The ID of the symbol.
     * @param {number} [distance=-1] - The distance associated with the symbol.
     * @returns {SSymbol|null} - The created SSymbol instance or null if data is invalid.
     */
    static make(symbolData, id, distance = -1) {
        let ssymbol = null;
        if (symbolData) {
            id = symbolData.id ?? id;
            distance = symbolData.distance ?? distance;
            ssymbol = super.make({
                ...symbolData,
                id,
                distance
            });
        }
        return ssymbol;
    }
}

/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Symbol Filters ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */


let FILTER_CHANGE_LISTENERS = new Set();
let FILTERS;
try {
    FILTERS = JSON.parse(localStorage.getItem("filters"));
    FILTERS.symbolSets = new Set(FILTERS.symbolSets || []);
} catch(e) {
    FILTERS = {
        symbolSets: new Set(Object.keys(SET_BY_VALUE)),
        variantKeyValues: {},
    };
}

function updateVariantKeyValues(variantKeyValues) {
    FILTERS.variantKeyValues = {...variantKeyValues};
    try {
        localStorage.setItem("filters", JSON.stringify({
            ...FILTERS,
            symbolSets: Array.from(FILTERS.symbolSets || [])
        }));
        FILTER_CHANGE_LISTENERS.forEach(listener => listener());
    } catch (e) {
        console.error("Failed to update filters:", e);
    }
}

function updateSymbolSets(symbolSets) {
    FILTERS.symbolSets = new Set(symbolSets || []);
    try {
        localStorage.setItem("filters", JSON.stringify({
            ...FILTERS,
            symbolSets: Array.from(FILTERS.symbolSets)
        }));

        FILTER_CHANGE_LISTENERS.forEach(listener => listener());
    } catch (e) {
        console.error("Failed to update filters:", e);
    }
}

function getVariantKeyValues() {
    return {...FILTERS.variantKeyValues || {}};
}

function getSymbolSets() {
    return new Set(FILTERS.symbolSets || [])
}

function onFilterChange(listener) {
    if (typeof listener === "function") {
        FILTER_CHANGE_LISTENERS.add(listener);
    }
    return () => {
        FILTER_CHANGE_LISTENERS.delete(listener);
    }
}
function removeFilterChangeListener(listener) {
    FILTER_CHANGE_LISTENERS.delete(listener);
}

/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Recent Symbols ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

const MAX_RECENT_SYMBOLS = 60;

let RECENT_SYMBOLS = [];
try {
    const storedResults = localStorage.getItem("recentSymbolResults");
    if (storedResults) {
        const parsedResults = JSON.parse(storedResults);
        if (Array.isArray(parsedResults)) {
            RECENT_SYMBOLS.push(...parsedResults.map(symbol => SSymbol.make(symbol)));
        }
        
    }
} catch (e) {}

function addRecentSymbol(symbol) {
    // Remove the symbol if it already exists in the recent results
    RECENT_SYMBOLS = RECENT_SYMBOLS.filter(i => i.id !== symbol.id);

    // Add the new symbol to the front of the list
    RECENT_SYMBOLS.unshift(symbol);

    // Limit the number of recent results
    if (RECENT_SYMBOLS.length > MAX_RECENT_SYMBOLS) {
        RECENT_SYMBOLS.pop();
    }

    // Store the updated recent results in localStorage
    try {
        localStorage.setItem("recentSymbolResults", JSON.stringify(RECENT_SYMBOLS));
    } catch (e) {
        console.error("Failed to save recent symbol results:", e);
    }
}

function getRecentSymbols() {
    return RECENT_SYMBOLS.map(symbol => SSymbol.make(symbol));
}


/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Icon Count ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

const MyIconCountWatchers = new Set();

async function getNumberOfOwnedSymbols() {
	const user = FB.getUser();
	const uid = user?.uid;
	if (!uid) return 0;

	const ownedQuery = query(symbolCollection(), where("owner", "==", uid));
  	const snapshot = await getCountFromServer(ownedQuery);
	const totalCount = snapshot.data().count;
	return totalCount;
}

FB.addAuthChangeListener(async (user) => {
	const uid = user?.uid;
	if (uid) {
		const count = await getNumberOfOwnedSymbols();
		for (const cb of MyIconCountWatchers) {
			cb(count);
		}
	}
})

function addMyIconCountWatcher(callback) {
	if (typeof callback === "function") {
		MyIconCountWatchers.add(callback);
	}
	return () => {
		MyIconCountWatchers.delete(callback);
	}
}




/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Upload ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */


async function toBufferString(file) {
    let arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            resolve(e.target.result)
        };
        reader.readAsArrayBuffer(file);
    })

    var binary = '';
    var bytes = new Uint8Array( arrayBuffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa(binary);
}

/** Uploads a grid symbols provided as a file.
 * @async 
 * @param {File} file
 * @param {name} string
 * @param {pub} pub is public
 * @param {(percentage: number, status: number) => void}
 * 
 * @return {Promise<UploadResults>}
 */
async function uploadSymbol(file, name, pub, cb) {
    if (!(file instanceof File)) {
        throw new Error("Invalid file provided.");
    }
    if (SSymbol.normaliseSearchPhrase(name).length == 0) {
        throw new Error("Invalid name provided.");
    }

    let dataBuffer = await toBufferString(file);
    console.log("Data buffer:", dataBuffer.length);

    const pushRef = FB.push(FB.ref(`file-status/${FB.getUID()}`))
    const uploadID = pushRef.key;

    // watch file status
    let end = FB.onValue(FB.ref(`file-status/${FB.getUID()}/${uploadID}`), (snap) => {
        let data = snap.val();
        console.log("File status update:", data);
        if (data) {
            cb(data);
        }
    })

    // Ensure auth is ready before calling the Cloud Function
    console.log(FB.getUser())
    if (!FB.getUser()) {
        throw new Error("User must be authenticated to upload symbols.");
    } 

    let {data} = await FB.callFunction(
		"symbols-upload", 
		{dataBuffer,public:pub,name,uploadID, isTest: true}, 
		"australia-southeast1"
	);

    end();
    if (!data) {
        data = {errors: ["No data returned from upload function."]};
    }

    if (data.errors && data.errors.length == 0) {
        data.symbol = SSymbol.make(data.result.symbol, data.result.id);
    } 
    return data;
}

// /** Deletes a grid symbols based its name or ID.
//  * @async
//  * @param {string} value 
//  * @param {("id"|"name")} type
//  * 
//  * @return {Promise<DeleteResults>}
//  */
// async function deleteImage(value, type) {
//     if (type == "id" || type == "name") {
//         let res = await FB.callFunction("gridSymbols-delete", {value, type}, "australia-southeast1");
//         return res.data;
//     } else {
//         throw "invalid delete type."
//     }
// }

/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Search ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

const SEARCH_MAX = 350;

const SymbolCache = { }

/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Semantic ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

const SemanticSearchCache = {
}


/** 
 * @param {string} text - The text to search for semantically.
 * @returns {Promise<SSymbol[]>} - A promise that resolves to an array of Symbols
 */
async function _semanticSearch(text) {
    let symbols = []
	try {
		let res = await FB.callFunction("symbols-search", {
			query_text: text, 
			symbol_sets: Object.keys(SET_BY_VALUE),
            use_variants: false
		}, "australia-southeast1");

        symbols = res?.data?.data ?? [];
	} catch (e) {
		console.error("Semantic image search failed", e);
	}
    return symbols;
}

/**
 * @param {string} text - The text to search for in the semantic search cache.
 * @returns {Promise<SSymbol[]|null>} - A promise that resolves to an array of 
 *                                      Symbols if cached, or null if not found.
 */
async function getResultsFromSemanticSearchCache(text) {
    let results = null;
    if (SemanticSearchCache[text]) {
        let idSet = await SemanticSearchCache[text];
        results = idSet.map(([id, distance]) => SSymbol.make(SymbolCache[id], id, distance)).filter(Boolean);
    }
    return results;
}

/**
 * @param {string} text - The text to search for, must be at least 2 characters long.
 * @param {boolean} includePublic - Whether to include public icons in the search.
 * @returns {Promise<SSymbol[]>} - A promise that resolves to an array of SOBImageIcon objects that match the search criteria.
 */
async function semanticSearch(text) {
    let symbols = []
    if (typeof text === "string" && text.length > 1) {
        S.log("Search Start", text);
        text = text.trim().toLowerCase().replace(/\s+/g, " ");
        symbols = await getResultsFromSemanticSearchCache(text);
        let usedCache = symbols != null;
        if (symbols == null){
            let prom = (async () => {
                let results = await _semanticSearch(text);
                for (let symbol of results) {
                    SymbolCache[symbol.id] = symbol;
                }
                return results.map(i => [i.id, i.min_distance]);
            })();
            SemanticSearchCache[text] = prom;
            symbols = await getResultsFromSemanticSearchCache(text);
        } 
        S.log("Search", text, `text: ${text}\ntext length: ${text.length}\nresults: ${symbols?.length ?? 0}\nused cache: ${usedCache}`, symbols);
    }
	return symbols;
}

function hasCachedSemanticSearchResults(text) {
    return text in SemanticSearchCache;
}

/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Text ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

function access(includePublic) {
    return includePublic ? 
        or(where("public", "==", true), where("owner", "==", FB.getUser()?.uid)) 
        : 
        where("owner", "==", FB.getUser()?.uid);
}

function textMatch(text, isEqual) {
    return isEqual ? 
        where("search_phrase", "==", text)
        :
        and(
            where("search_phrase", ">=", text), 
            where("search_phrase", "<=", text + "\uf8ff")
        );
}

const NORMAL_TEXT_LENGTH = 6;
const MAX_TEXT_LENGTH = 20;

const TextSearchCache = {
    public: {
        equal: {},
        startsWith: {}
    },
    user: {
        equal: {},
        startsWith: {}
    }
}

async function getResultsFromTextSearchCache(text, includePublic, isEqual) {
    let results = null;

    let promise = null;
    let direct = false;
    let mode = TextSearchCache[includePublic ? "public" : "user"] 
    for (let i = text.length; i > 0; i--) {
        let prefix = text.slice(0, i);
        if (prefix in mode.startsWith) {
            promise = mode.startsWith[prefix];
            direct = prefix === text;
            break;
        }
    }

    if (promise == null && isEqual && text in mode.equal) {
        promise = mode.equal[text];
        direct = true;
    }


    if (promise instanceof Promise) {
        let idSet = await promise;

        if (direct || idSet.size < SEARCH_MAX) {
            results = [...idSet].map(
                id => SSymbol.make(SymbolCache[id], id)
            ).filter((sym) => 
                sym && isEqual ? sym.search_phrase === text : sym.search_phrase.startsWith(text)
            )
        }
    } 

    return results;
}

async function querySymbols(text, isEqual = false, includePublic = true) {
    T.log("Search Start", text);
    let results = await getResultsFromTextSearchCache(text, includePublic, isEqual);
    let usedCache = results != null;
    if (results == null) {
        const uid = FB.getUser()?.uid;
        if (uid) {
            const textQuery = query(
                symbolCollection(), 
                and(
                    textMatch(text, isEqual),
                    access(includePublic)
                ), 
                limit(SEARCH_MAX)
            ) 
            
            let promise = (async () => {
                let docs = await getDocs(textQuery);
                console.log("Fetched documents for text query", text, docs.docs.length, docs.docs.map(d => d.get("search_phrase")));
                return new Set(docs.docs.map(doc => {
                    let image = doc.data();
                    SymbolCache[doc.id] = image;
                    return doc.id;
                }))
            })();

            TextSearchCache[includePublic ? "public" : "user"][isEqual ? "equal" : "startsWith"][text] = promise;

            results = await getResultsFromTextSearchCache(text, includePublic, isEqual);
        }
    }

    T.log(`Search`, text, `text: ${text},\nincludePublic: ${includePublic},\nisEqual: ${isEqual}\ntext length: ${text.length}\nused cache: ${usedCache}\nresults: ${results?.length ?? 0}`, results);

    return results || [];
}


function exactMatch(name, length) {
    return name.length == length || name[length].match(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g)
}


/**
 * @param {string} text - The text to search for.
 * @param {boolean} includePublic - Whether to include public icons in the search.
 * @returns {Promise<SOBImageIcon[]>} - A promise that resolves to an array of SOBImageIcon objects that match the search criteria.
 */
async function textSearch(text, includePublic = true) {
	let symbols = [];
    text = SSymbol.normaliseSearchPhrase(text);
    if (text.length > 0) {
        if (text.length == 1) {
            // If the text is a single character, we search for icons that start with that character
            // and are either followed by a non-letter character or are a PRC letter (UC- or LC-).
            symbols = await querySymbols(text, true, includePublic);
            
        } else if (text.length < 4) {
            // If the text is less than 4 characters, we search for icons that start with that text
            // and are followed by a non-letter e.g. "IN-1" 
            symbols = await querySymbols(text, false, includePublic);
            console.log("Symbols after initial query:", symbols);
            symbols = symbols.filter(i => exactMatch(i.name, text.length));

        } else if (text.length <= MAX_TEXT_LENGTH) {
            // For text of length between 4 and 6 we perform a standard search for icons that start with the text.
            symbols = await querySymbols(text, false, includePublic);
        // } else {
        //     // For text longer than 6 characters, we will search all substrings of the text that are at least 
        //     // 6 characters long, and return the first set of results that has any matches.
        //     text = text.substring(0, MAX_TEXT_LENGTH);
        //     let subStrings = new Array(text.length - NORMAL_TEXT_LENGTH + 1).fill(0)
        //         .map((_, i) => 
        //             text.substring(0, i + NORMAL_TEXT_LENGTH).replace(/_$/g, "")
        //     )
        //     subStrings = [...new Set(subStrings)];
        //     let subStringMatches = await Promise.all(subStrings.map(s => querySymbols(s, false, includePublic)));
        //     subStringMatches.reverse();
        //     for (const matchSet of subStringMatches) {
        //         if (matchSet.length > 0) {
        //             symbols = matchSet;
        //             break;
        //         }
        //     }
        }
    }

	return symbols;
}


export {
    SSymbol,
    SYMBOL_SETS,
    VARIANT_KEY_OPTIONS,

    uploadSymbol,

    textSearch, 
    semanticSearch,
    hasCachedSemanticSearchResults,

    addMyIconCountWatcher, 
    getNumberOfOwnedSymbols,
    addRecentSymbol, getRecentSymbols, 


    updateVariantKeyValues,
    updateSymbolSets,
    getVariantKeyValues,
    getSymbolSets,
    onFilterChange,
    removeFilterChangeListener
};