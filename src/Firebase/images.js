
import * as FB from "./firebase.js";
import { OBImage } from "../OpenBoard/openboard.js";

class SOBImageIcon extends OBImage {
    public = false;
} 

FB.initialise();

const { getCountFromServer, writeBatch, collection, query, where, and, or, onSnapshot, getDocs, doc, updateDoc, limit} = FB.FStore;
const IconCollection = () => collection("icons");


function uniqueImages(images) {
    const unique = {};
    for (const image of images) {
        unique[image.id] = image;
    }
    return Object.values(unique);
}


function formatImage(image, id) {
    let result = null;
    if (image) {
        result = SOBImageIcon.make({
            ...image,
            width: 100,
            height: 100,
            id,
            license: {
                owner: image.owned
            }
        });
    }
    return result;
}



/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Recent Images ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const MAX_RECENT_IMAGES = 60;

let RECENT_IMAGES = [];
try {
    const storedResults = localStorage.getItem("recentImageResults");
    if (storedResults) {
        const parsedResults = JSON.parse(storedResults);
        if (Array.isArray(parsedResults)) {
            RECENT_IMAGES.push(...parsedResults.map(i => SOBImageIcon.make(i)));
        }
    }
} catch (e) {}

function addRecentImage(image) {
    // Remove the image if it already exists in the recent results
    RECENT_IMAGES = RECENT_IMAGES.filter(i => i.id !== image.id);

    // Add the new image to the front of the list
    RECENT_IMAGES.unshift(image);

    // Limit the number of recent results
    if (RECENT_IMAGES.length > MAX_RECENT_IMAGES) {
        RECENT_IMAGES.pop();
    }

    // Store the updated recent results in localStorage
    try {
        localStorage.setItem("recentImageResults", JSON.stringify(RECENT_IMAGES));
    } catch (e) {
        console.error("Failed to save recent image results:", e);
    }
}

function getRecentImages() {
    return RECENT_IMAGES.map(i => SOBImageIcon.make(i));
}


/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Icon Count ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

const MyIconCountWatchers = new Set();

async function getNumberOfOwnedImages() {
	const user = FB.getUser();
	const uid = user?.uid;
	if (!uid) return 0;

	const ownedQuery = query(IconCollection(), where("uid", "==", uid));
  	const snapshot = await getCountFromServer(ownedQuery);
	const totalCount = snapshot.data().count;
	return totalCount;
}

FB.addAuthChangeListener(async (user) => {
	const uid = user?.uid;
	if (uid) {
		const count = await getNumberOfOwnedImages();
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
async function uploadImage(file, name, pub, cb) {
    let type = file.type;
    let dataBuffer = await toBufferString(file);

    let uploadID = (new Date()).getTime() + "id";

    // watch file status
    let end = FB.onValue(FB.ref(`file-status/${FB.getUID()}`), (snap) => {
        let data = snap.val();
        if (data) {
            let matches = Object.values(data).filter(val => val.id == uploadID);
            if (matches.length > 0) {
                let res = matches[0];
                cb(res.status / 4, res.status)
                if (res.status == 4) {
                    end();
                }
            }
        }
    })

    let res = await FB.callFunction(
		"gridSymbols-upload", 
		{dataBuffer,public:pub,name,type,uploadID}, 
		"australia-southeast1"
	);

    return res.data;
}

/** Deletes a grid symbols based its name or ID.
 * @async
 * @param {string} value 
 * @param {("id"|"name")} type
 * 
 * @return {Promise<DeleteResults>}
 */
async function deleteImage(value, type) {
    if (type == "id" || type == "name") {
        let res = await FB.callFunction("gridSymbols-delete", {value, type}, "australia-southeast1");
        return res.data;
    } else {
        throw "invalid delete type."
    }
}

/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Search ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

const SEARCH_MAX = 300;

const ImageCache = { }

/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Semantic ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

const SemanticSearchCache = {
    public: {},
    user: {}
}


async function _semanticSearch(text, includePublic = true) {
    let images = []
	try {
		let res = await FB.callFunction("gridSymbols-search", {
			text, 
			type: "vector",
			mode: includePublic ? "all" : "user",
			size: 150
		}, "australia-southeast1");
		images = (res.data || []).map(image => {
            return formatImage(image, image.id);
        })
	} catch (e) {
		console.error("Semantic image search failed", e);
	}
    return images;
}

async function getResultsFromSemanticSearchCache(text, includePublic = true) {
    let results = null;
    if (SemanticSearchCache[includePublic ? "public" : "user"][text]) {
        let idSet = await SemanticSearchCache[includePublic ? "public" : "user"][text];
        results = [...idSet].map(i => SOBImageIcon.make(ImageCache[i])).filter(Boolean);
    }
    return results;
}

/**
 * @param {string} text - The text to search for.
 * @param {boolean} includePublic - Whether to include public icons in the search.
 * @returns {Promise<SOBImageIcon[]>} - A promise that resolves to an array of SOBImageIcon objects that match the search criteria.
 */
async function semanticSearch(text, includePublic = true) {
    text = text.trim().toLowerCase().replace(/\s+/g, " ");
    let images = await getResultsFromSemanticSearchCache(text, includePublic);
    if (images == null){
        let prom = (async () => {
            let results = await _semanticSearch(text, includePublic);
            for (let image of results) {
                ImageCache[image.id] = image;
            }
            return new Set(results.map(i => i.id));
        })();
        SemanticSearchCache[includePublic ? "public" : "user"][text] = prom;

        images = await getResultsFromSemanticSearchCache(text, includePublic);
    }
	return images;
}

/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Text ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */


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
    if (TextSearchCache[includePublic ? "public" : "user"][isEqual ? "equal" : "startsWith"][text]) {
        let idSet = await TextSearchCache[includePublic ? "public" : "user"][isEqual ? "equal" : "startsWith"][text];
        results = [...idSet].map(i => SOBImageIcon.make(ImageCache[i])).filter(Boolean);
    }
    return results;
}

async function queryImages(text, isEqual = false, includePublic = true) {
    let results = await getResultsFromTextSearchCache(text, includePublic, isEqual);
    if (results == null) {
        const uid = FB.getUser()?.uid;
        if (uid) {
            const access = includePublic ? 
                or(
                    where("public", "==", true),
                    where("uid", "==", uid)
                ) : where("uid", "==", uid);
            
            const textQuery = isEqual ?
                query(IconCollection(), and(where("name", "==", text), access), limit(SEARCH_MAX)) :
                query(IconCollection(), and(where("name", ">=", text), where("name", "<=", text + "\uf8ff"), access), limit(SEARCH_MAX));
            let prom = (async () => {
                let docs = await getDocs(textQuery);
                let images = docs.docs.map(doc => {
                    let image = doc.data();
                    image.owned = uid && image.uid === uid;
                    image = formatImage(image, doc.id);
                    ImageCache[doc.id] = image;
                    return image;
                })
                return new Set(images.map(i => i.id));
            })();
            TextSearchCache[includePublic ? "public" : "user"][isEqual ? "equal" : "startsWith"][text] = prom;

            results = await getResultsFromTextSearchCache(text, includePublic, isEqual);
        }
    }
    return results || [];
}


function isPRCLetter(text, name) {
	return text.length == 1 && name == text + "UC-" || name == text + "LC-";
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
	let images = [];
    text = text.trim().toUpperCase().replace(/\s+/g, "_");
    
    if (text.length == 1) {
        // If the text is a single character, we search for icons that start with that character
        // and are either followed by a non-letter character or are a PRC letter (UC- or LC-).
        images = await Promise.all([
            queryImages(text, false, includePublic),
            queryImages(text + "LC-", true, includePublic),
            queryImages(text + "UC-", true, includePublic)
        ])
        images = uniqueImages(images.flat()).filter(i => exactMatch(i.name, 1) || isPRCLetter(text, i.name));
		
    } else if (text.length < 4) {
        // If the text is less than 4 characters, we search for icons that start with that text
        // and are followed by a non-letter e.g. "IN-1" 
        images = await queryImages(text, false, includePublic);
		images = images.filter(i => exactMatch(i.name, text.length));
    } else if (text.length <= NORMAL_TEXT_LENGTH) {
        // For text of length between 4 and 6 we perform a standard search for icons that start with the text.
        images = await queryImages(text, false, includePublic);
    } else {
        // For text longer than 6 characters, we will search all substrings of the text that are at least 
        // 6 characters long, and return the first set of results that has any matches.
        text = text.substring(0, MAX_TEXT_LENGTH);
        let subStrings = new Array(text.length - NORMAL_TEXT_LENGTH + 1).fill(0)
            .map((_, i) => 
                text.substring(0, i + NORMAL_TEXT_LENGTH).replace(/_$/g, "")
        )
        subStrings = [...new Set(subStrings)];
        let subStringMatches = await Promise.all(subStrings.map(s => queryImages(s, false, includePublic)));
        subStringMatches.reverse();
        for (const matchSet of subStringMatches) {
            if (matchSet.length > 0) {
                images = matchSet;
                break;
            }
        }
    }

	return images;
}


export {SOBImageIcon, textSearch, semanticSearch, uploadImage, deleteImage, addMyIconCountWatcher, getNumberOfOwnedImages, addRecentImage, getRecentImages, uniqueImages};