import { Debugger, PromiseChain } from "../Utilities/shared.js";
import * as FB from "./firebase.js";

/**
 * This is the text-to-speech module for managing and playing utterances 
 * with different voices. To use this module, load utterances for the desired
 * voices and then play them using the provided functions. 
 * 
 * To save on server calls, it is important to load as many utterances as 
 * possible in advance. On the other hand as creating new utterances on the 
 * server leads to costs it is important not to load utterances that are 
 * unlikely to be used. For example, if a page contains buttons that trigger
 * text to speech utterances to be played, then those utterances should be 
 * pre-loaded as the page loads.
 */


/**
 * @typedef {Object} UtteranceInfo
 * @property {string} url - The URL of the utterance audio file.
 * @property {Promise} promise - A promise that resolves when the utterance is loaded.
 * @property {boolean} loaded - Whether the utterance has been loaded.
 * @property {string} utterance - The text phrase of the utterance.
 * @property {string[]} errors - Errors encountered while loading the utterance.
 */

/**
 * Text2Speech debugger instance for logging and debugging purposes.
 */
const DEBUG = new (class TTSDebugger extends Debugger {
    constructor() {
        super("Text2Speech", "");
        [this.normal, this.normalList, this.load, this.loadList] = [
            "rgb(214, 109, 22)", 
            "rgb(183, 61, 17)",
            "rgb(64, 195, 21)",
            "rgb(14, 127, 31)",
        ].map(c => 
            `background-color:${c}; color: white; padding: 5px; border-radius: 5px; margin: 2px;`
        );
    }

    log(main, list = [], mode = "normal") {
        if (this.isLogOn) {
            this.style = this[mode];
            this.logStart(main);
            for (let item of list) {
                console.log(`%c${item}`, this[mode + "List"]);
            }
            this.logEnd();
        }
    }
})()

/**
 * Speech synthesis instance
 */
const synth = window.speechSynthesis;

/**
 * Promise chain to manage the speech
 * queue for text-to-speech playback.
 */
const speachQueue = new PromiseChain()

/**
 * Object to store utterances for different voices.
 * Mapping of voice names to their utterances and corresponding URLs.
 * @type {Object<string, Object<string, UtteranceInfo>>} 
 */
const UTTERANCES = {};

/**
 * State object to store the current voice name and speech speed.
 * @type {{name: string, speed: number}}
 */
const STATE = {
    name: "default",
    speed: 1,
}

/**
 * Object to store the available voices for text-to-speech.
 * The keys are voice names and the values are 
 * booleans indicating availability.
 * @type {Object<string, boolean>}
 */
const MY_VOICES = {
    default: true,

    margaret: true,
    jane: true,
    peter: true,
    charles: true,
    sarah: true,
    lachlan: true,
    jeffrey: true,
    theo: true,
    lucy: true,
    holly: true,

    ফাতেমা: true,
    ফুয়াদ: true,
    রানী: true,
    প্রদীপ: true,

    다빈: true,
    소영: true,
    민재: true,
    병준: true,

    louis: true,
    amélie: true,
    etienne: true,
    julia: true
}


/**
 * Parses and validates an utterance string. 
 * Trims whitespace and converts to lowercase. 
 * Throws an error if the input is not a valid string.
 * @param {string} str - The utterance string to parse and validate.
 */
function parseUtterance(str) {
    if (typeof str !== "string") {
        str = null;
    } else {
        str = str.trim().toLocaleLowerCase();
        if (str.length == 0) {
            str = null;
        }
    }
    return str;
}

/**
 * Generates default data structure for a list of phrases.
 * @param {string[]} phrases - Array of phrases to generate default data for.
 * @return {{errors: Array, utterances: Object}} Default data structure with errors and utterances.
 */
async function defaultData(phrases) {
    const data = {errors: [], utterances: {}}
    phrases.forEach(element => {
        data.utterances[element] = {
            url: "default",
            errors: []
        }
    });
    return {data};
}



/** 
 * @param {string} utterance - The utterance to retrieve the URL for.
 * @param {string} voiceName - The name of the voice to use for the utterance.
 * 
 * @return {Promise<string>} url of utterance mp3 file
*/
async function getUtteranceURL(utterance, voiceName) {
    const utt = parseUtterance(utterance);
    let url = null;

    if (!(voiceName in UTTERANCES)) {
        console.warn(`Text2Speech: Voice '${voiceName}' has no utterances loaded.`);
    } else if (!(utt in UTTERANCES[voiceName])) {
        console.warn(`Text2Speech: Utterance '${utt}' not found for voice '${voiceName}'`);
    }

    if (voiceName in UTTERANCES && utt in UTTERANCES[voiceName]) {
        let uData = UTTERANCES[voiceName][utt];
        if (!uData.loaded) await uData.promise;
        url = uData.url
    }

    return url;
}


/**
 * Plays audio from a given URL.
 * @param {string} url - The URL of the audio to play.
 * 
 * @return {Promise<void>} Resolves when the audio has finished playing.
 */
async function playAudioURL(url) {
    DEBUG.log(`Playing audio from URL: ${url}`, [], "load");
    
    const audio = new Audio(url);
    audio.playbackRate = STATE.speed;
    return new Promise((resolve) => {
        audio.onerror = resolve
        audio.onended = resolve
        audio.play();
    });
}


/**
 * Plays an utterance using the default speech synthesis.
 * @param {string} phrase - The phrase to play.
 * 
 * @return {Promise<void>} Resolves when the utterance has finished playing.
 */
async function playUtteranceDefault(phrase) {
    const utterThis = new SpeechSynthesisUtterance(phrase);
    return new Promise((resolve, reject) => {
        utterThis.onerror = resolve;
        utterThis.onend = resolve;
        synth.speak(utterThis);
    })
}

/**
 * Plays an utterance using the appropriate voice and URL.
 * If the utterance has a default URL, it will use the default speech synthesis.
 * @param {string} utterance - The utterance to play.
 * @param {string} voiceName - The name of the voice to use for the utterance.
 * 
 * @return {Promise<void>} Resolves when the utterance has finished playing.
 */
async function playUtterance(utterance, voiceName) {
    let url = await getUtteranceURL(utterance, voiceName);
    if (url !== null) {
        if (url === "default") {
            await playUtteranceDefault(utterance);
        } else {
            await playAudioURL(url);
        }
    }
}


/**
 * Loads the specified utterances for a given voice.
 * @param {string[]} phrases - The list of phrases to load.
 * @param {string} voiceName - The name of the voice to load the phrases for.
 * 
 * @return {Promise<void>} Resolves when all specified phrases have been loaded.
 */
async function loadUtterancesHelper(phrases, voiceName = STATE.name) {
     // Reference to the utterances library for the current voice.
    const uttLib = UTTERANCES[voiceName]

    // Load phrases
    DEBUG.log(`Loading ${phrases.length} utterances for voice = '${voiceName}'`, phrases);

    const prom = voiceName == "default" ? defaultData(phrases) : FB.callFunction(
        "utterances-get", 
        {phrases, voiceName},
        "australia-southeast1"
    );
    
    // Store promise 
    for (const phrase of phrases) {
        uttLib[phrase] = {
            promise: prom,
            loaded: false,
            utterance: phrase,
            url: null,
            errors: []
        }
    }

    // Wait for the promise to resolve and extract the data.
    const {data} = (await prom);

    // Update the utterances library with the resolved data.
    for (const key of phrases) {
        const uData = data.utterances[key];
        uttLib[key].loaded = true;
        uttLib[key].url =    uData?.url ?? null;
        uttLib[key].errors = uData?.errors ?? data.errors;
    }

    // Log the result of the loading process.
    if (data.errors.length == 0) {
        DEBUG.log(`Loaded ${phrases.length} utterances for voice = '${voiceName}' ✅`, phrases, "load");
    } else {
        DEBUG.log(`Errors loading ${phrases.length} utterances for voice = '${voiceName}' ❌`);
        console.error("Text2Speech: Errors loading utterances:", data.errors);
    }
}


/**
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ~~~~~~~~~~~~~~~~~~ PUBLIC FACING FUNCTIONS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */



/**
 * Loads the given list of utterances for a specific voice.
 * Similar to `loadUtterancesHelper`, but provides a higher-level interface
 * for loading utterances by waiting for all necessary promises to resolve.
 * 
 * @param {string[]} utterances - The list of utterances to load for the specified voice.
 * @param {string} voiceName - The name of the voice to load the utterances for.
 * 
 * @return {Promise<void>} Resolves when all specified utterances have been loaded.
 */
async function loadUtterances(utterances, voiceName = STATE.name){
    // Ensure the voice is valid
    if (voiceName in MY_VOICES) { 


        // Ensure the utterances object exists for the given voice.
        if (!(voiceName in UTTERANCES)) UTTERANCES[voiceName] = {};
    
        // Reference to the utterances library for the current voice.
        const uttLib = UTTERANCES[voiceName]
    
        // Parse and filter the utterances to only include those not already loaded.
        const allPhrases = utterances.map(parseUtterance).filter(p => p !== null);
        const phrasesToLoad = allPhrases.filter(p => !(p in uttLib));
        
        // If new phrases need to be loaded.
        if (phrasesToLoad.length > 0) {
            loadUtterancesHelper(phrasesToLoad, voiceName);
        }

        await Promise.all(phrasesToLoad.map(p => uttLib[p].promise))
    }
}


/** 
 * Changes the current default voice to the specified
 * voice name. Loads any utterances that where loaded
 * for the previous voice.
 * 
 * @param {string} voiceName 
 * */
async function changeVoice(voiceName) {
    if (voiceName in MY_VOICES) {
        DEBUG.log(`Changing voice to '${voiceName}'`, [], "load");
        const old = STATE.name in UTTERANCES ? UTTERANCES[STATE.name] : {};
        const oldPhrases = Object.keys(old);
    
        const newp = voiceName in UTTERANCES ? UTTERANCES[voiceName] : {};
        const newPhrases = new Set(Object.keys(newp));
    
        const notLoaded = oldPhrases.filter(p => !newPhrases.has(p));
    
        STATE.name = voiceName;
        
        await loadUtterances(notLoaded, voiceName);
    } else {
        console.warn(`Voice '${voiceName}' is not available, see list below:\n${Object.keys(MY_VOICES).join("\n")}`);
    }
}


/**
 * @param {string} utterance - The utterance to speak.
 * @param {boolean} [override=false] - Whether to override the current speech queue.
 * @param {string} [voiceName=STATE.name] - The name of the voice to use.
 */
async function speak(utterance, override = false, voiceName = STATE.name) {

    await speachQueue.addPromise(
        () => playUtterance(utterance, voiceName), 
        override
    )
}

export {
    loadUtterances,
    changeVoice,
    speak
}

