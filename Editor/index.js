import * as FB from "../src/Firebase/firebase.js";
import { OpenBoardEditor } from "../src/Editor/editor.js";
import { addBoardToRecent, BoardWatcher, getUserInfo } from "../src/Firebase/boards.js";
import { Path } from "../src/FileTree/FileSystem/Path.js";
import { SvgPlus } from "../src/SvgPlus/4.js";
import { LoginPage } from "../src/loginPage/login-page.js";
import { OBBoardEditable } from "../src/OpenBoard/openboard-editable.js";

FB.initialise();

function addBoardIDToURL(boardID) {
    const query = new URLSearchParams(window.location.search);
    if (boardID) {
        query.set("board", boardID);
    } else {
        query.delete("board");
    }
    window.history.replaceState({}, "", `${window.location.pathname}?${query.toString()}`);
}

/**
 * User states
 *      User        Board
 *      yes         yes     If the user is the owner of the board or can edit then they can make changes and save them.
 *                          Otherwise, they should get permission denied or read-only access.
 * 
 *      yes         no      Allow the user to create a new board.
 * 
 *      no          yes     This should bring up a login prompt or request access to the editor.
 * 
 *      no          no      This is fine we can let people use the editor but warn 
 *                          them that all changes will not be saved, maybe store it 
 *                          temporarily in local storage.
 */


const HIDE_STYLE = {
    opacity: 0,
    "pointer-events": "none",
}

const SHOW_STYLE = {
    opacity: 1,
    "pointer-events": "all",
}

class EditorSession extends SvgPlus {
    /** @type { OpenBoardEditor } */
    editor = null;

    /** @type { BoardWatcher } */
    boardWatcher = null;

    isChange = false;

    #isSaving = false;
    #isSaveable = true;
    #pendingSave = false;

    constructor(el) {
        super(el);

        this.editor = this.createChild(OpenBoardEditor, {}, "open-board-editor")
        this.loginPage = this.createChild(LoginPage, {
            styles: {
                ...HIDE_STYLE,
                transition: "0.3s ease-in opacity",
            },
            events: {
                close: () => {
                   this.resetToBlankBoard();
                }
            }
        }, "login-page");

        this.errorOverlay = this.createChild("div", {
            class: "error-overlay",
            styles: {
                ...HIDE_STYLE,
                transition: "0.3s ease-in opacity",
            },
        }, "error-overlay");
        this.errorOverlay.createChild("h1", {content: "Permission Denied"});
        this.errorOverlay.createChild("p", {content: "You do not have permision<br>to edit this board."});
        this.errorOverlay.createChild("button", {
            content: "New Board",
            events: {
                click: () => {
                    this.resetToBlankBoard();
                }
            }
        })

        this.headTitle = document.head.querySelector("title");

        const editor = this.editor;
        
        editor.getIsSaveable = () => this.isSaveable
        editor.getIsSaving = () => this.isSaving
        editor.onUpdate =  this.onBoardUpdated.bind(this);
        editor.clearChanges = this.revertToSavedVersion.bind(this);
        editor.save = this.save.bind(this);

        this.updateTitle();
        this.updateSaveStatus();
    }


    
    resetToBlankBoard() {
        addBoardIDToURL(null);
        this.watchBoard(null);
        this.editor.board = OBBoardEditable.makeEmptyBoard(4,5);
        this.updateSaveStatus();
        this.updateTitle();
        this.errorOverlay.styles = HIDE_STYLE;
    }


    showLoginPage() {
        this.loginPage.style.opacity = 1;
        this.loginPage.style["pointer-events"] = "all";
    }

    hideLoginPage() {
        this.loginPage.style.opacity = 0;
        this.loginPage.style["pointer-events"] = "none";
    }


    revertToSavedVersion() {
        if (this.boardWatcher) {
            this.editor.updateBoard(this.boardWatcher.saved);
        }
    }

    onBoardUpdated() {
        if (this.boardWatcher && !this.boardWatcher.sameAsDraft(this.editor.board)) {
            this.boardWatcher.updateDraft(this.editor.board);
            this.editor.forceToolUpdate();
        }
    }

    updateTitle() {
        let name = "Untitled"
        let fullPath = new Path(name);
        if (this.boardWatcher && this.boardWatcher.metadata && this.boardWatcher.metadata.valid) {
            fullPath = this.boardWatcher.metadata.path;
            name = fullPath.name;
        }
        this.headTitle.innerHTML = `${name} | Board Editor | Squidly`;
        this.editor.titleSpan.innerHTML =  `&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;&nbsp;<b>${fullPath}</b>`;
    }

    updateSaveStatus() {
        let note = "<span title = 'The board has not been saved yet'>Unsaved*</span>";
        if (this.boardWatcher) {
            note =  this.boardWatcher.pendingChanges ? "Draft Saved" : "";
        } 
        this.editor.titleNote.innerHTML = note ? `&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;&nbsp;${note}` : "";
    }

    async saveAsAndWatch(boardID) {
        if (this.boardWatcher) {
            this.boardWatcher.stop();
            this.boardWatcher = null;
        }

        // Update the URL to include the new board ID
        addBoardIDToURL(boardID);

        // Start saving the board 
        this.#isSaving = true;
        this.editor.forceToolUpdate();

        const res = await BoardWatcher.forceSave(this.editor.board, boardID);
        console.log(res);

        this.#isSaving = false;
        this.editor.forceToolUpdate();
        
        // Now start watching the board for changes
        this.watchBoard(boardID, true);
    }

    async save() {
        if (this.boardWatcher) {
            if (this.isSaveable) {
                let promise = this.boardWatcher.save();
                this.editor.forceToolUpdate(); 
                // Force the tools to reflect the current saving state

                await promise;

                // Update the save status after the save operation
                this.updateSaveStatus();

                // Force the tools to reflect the updated saving state after the save operation
                this.editor.forceToolUpdate(); 
            }
        } else {
            const user = FB.getUser();
            if (user) {
                // Prompt user to select a new board ID
                const id = await this.editor.getNewBoard();
                if (id) {
                    this.saveAsAndWatch(id);
                }
            } else {
                this.#pendingSave = true;
                this.showLoginPage();
            }
        }

    }

    async watchBoard(boardID, started = false) {
        const pendingSave = this.#pendingSave
        this.#pendingSave = false;

        if (this.boardWatcher) {
            this.boardWatcher.stop();
            this.boardWatcher = null;
        }
        
        if (boardID) {
            addBoardToRecent(boardID);
            this.boardWatcher = new BoardWatcher(boardID, () => {
                const { currentBoard, metadata } = this.boardWatcher;
                this.editor.metadata = metadata;
                if (!started) {
                    started = true;
                    this.editor.board = currentBoard;
                } else {
                    console.log("updating current Board")
                    this.editor.updateBoard(currentBoard);
                }


                this.updateSaveStatus();
                this.updateTitle();
            });
            await this.boardWatcher.watch();

            const metadata = this.boardWatcher.metadata;
            if (metadata.error?.code == 404) {
                this.watchBoard(null);
                addBoardIDToURL(null);
                this.updateSaveStatus();
                this.updateTitle();
                console.log("Board not found, redirecting to no board state");
            } else if (metadata.error?.code == 403 || this.boardWatcher.editable === false) {
                this.errorOverlay.styles = SHOW_STYLE;
            }
        } else if (pendingSave) {
            this.save();
        }
    }

    async updateUserInfo(desired) {
        const user = FB.getUser();
        if (user) {
            const info = await getUserInfo(FB.getUser()?.uid ?? null);
            this.editor.userSpan.textContent = (info?.name ?? "Unknown User") + (desired ? ` (${desired})` : "");
            this.editor.userSpan.styles = { cursor: null };
            this.editor.userSpan.onclick = null;
        } else {
            this.editor.userSpan.textContent = "Sign In";
            this.editor.userSpan.styles = { cursor: "pointer" };
            this.editor.userSpan.onclick = () => this.showLoginPage();
        }
    }

    async onUserChange(user) {
        document.body.toggleAttribute("loaded", false);
        const query = new URLSearchParams(window.location.search);
        const boardID = query.get("board") ?? null;
        const desired = query.get("user")

        this.updateUserInfo(desired);

        if (user) {
            const uid = desired || (user?.uid ?? null); 
            await Promise.all([ 
                this.watchBoard(boardID), 
                uid && session.editor.assignFinderUser(uid),
            ]);
            this.hideLoginPage();
        } else if (boardID) {
            this.showLoginPage();
        } 

        // Ensure styles are applied before showing the editor
        await Promise.all([
            this.editor.waitStyles(),
            this.loginPage.waitStyles()
        ]);

        document.body.toggleAttribute("loaded", true);
    }

    get isSaveable() {
        return this.boardWatcher ? this.boardWatcher.pendingChanges : this.#isSaveable;
    }

    get isSaving() {
        return this.boardWatcher ? this.boardWatcher.isSaving : this.#isSaving;
    }

}

const session = new EditorSession("editor-session");
document.body.appendChild(session);
FB.addAuthChangeListener(session.onUserChange.bind(session));
