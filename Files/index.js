import { OBFileSystem, OBFStat } from "../src/FileTree/OBFileSystem.js";
import { OBFinder } from "../src/FileTree/OBFinder.js";
import { OBLoadBoard } from "../src/OpenBoard/openboard.js";
import { ShadowElement } from "../src/Utilities/utils.js";
import { initialise, addAuthChangeListener, signOut } from "../src/Firebase/firebase.js";
import { LoginPage } from "../src/loginPage/login-page.js";
import { openEditor } from "../src/shared.js";
import { setActiveKeyBindingSet } from "../src/Utilities/keybindings.js";

LoginPage.define();
setActiveKeyBindingSet("ob-finder");

export class AACFinder extends ShadowElement {
	/** @type {OBFileSystem} */
    #fs = null;
    #loading = null;
    #lastSelected = null;
	constructor(el) {
		super(el, "board-finder");
		this.fsUI = this.createChild(OBFinder)
		this.fsUI.onDoubleClick = (_, __, stat) => {
			openEditor(stat.boardID);
		}
	}

	onconnect() {
		console.log("AACFinder connected")
	}

    async assignUser(uid) {
		this.uid = uid;
		this.#fs = new OBFileSystem(uid)
		this.#loading = this.#fs.watch();
        await this.#loading;
        this.#loading = null;
		this.fsUI.setRoot(this.#fs, "", "")
	}

	async removeUser() {
		if (this.#loading) {
			await this.#loading;
			this.#loading = null;
		}
		if (this.#fs) {
			this.#fs.stopWatch();
			this.#fs = null;
		}
		this.fsUI.setRoot(null, "", "")
	}
	
	static get usedStyleSheets() {
		return [
			...OBFinder.usedStyleSheets,
		]
	}
}

const styleLoadPromise = await Promise.all([
	AACFinder.loadStyleSheets(),
	LoginPage.loadStyleSheets(),
])

AACFinder.defineHTMLElement(AACFinder, "aac-finder");
const finder = document.querySelector("aac-finder");
const userSpan = document.getElementById("user");
const urlParams = new URLSearchParams(window.location.search);
const desiredUser = urlParams.get("user");
addAuthChangeListener(async (user) => { 
	document.body.toggleAttribute("loaded", false);
	document.body.toggleAttribute("user", user != null);
	if (user) {
		console.log("user:", user)
		let uid = desiredUser || user.uid;
		userSpan.textContent = uid == user.uid ? 
			"Hey " + user.displayName + " - " + user.email :
			"Hey " + user.displayName + " - " + user.email + " (viewing " + desiredUser + ")";
		if (uid != finder.uid) {
			await finder.assignUser(uid);
		}
	} else {
		finder.removeUser();
	}
	await styleLoadPromise;
	document.body.toggleAttribute("loaded", true);
});
initialise();
window.signOut = signOut