import * as FB from "../src/Firebase/firebase.js";
import { OpenBoardEditor } from "../src/Editor/editor.js";
import { addBoardToRecent, BoardWatcher } from "../src/Firebase/boards.js";
import { Path } from "../src/FileTree/FileSystem/Path.js";

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

let styleSheetsLoader = await OpenBoardEditor.loadStyleSheets()
OpenBoardEditor.defineHTMLElement(OpenBoardEditor);

const ERROR_SCREENS = {
     404: `
    <i-bw no-board></i-bw>
    <h1>
        Missing Board
    </h1>
    <p>
        The board you are <br>
        looking for does not exist. <br>
        This may occur if the board has been <br>
        deleted or the URL is incorrect. <br>
        Please check the link <br>
        and try again.
    </p>
    `,
    403: `
    <i-bw lock></i-bw>
    <h1>
        Locked Board
    </h1>
    <p>
        You do not have access to this board. <br>
        If someone has shared this board with you, <br> 
        please ensure they have made the board public <br>
        If this is your board, please make sure you <br>
        have signed in to view the board.
    </p>
    `,
}

class EditorSession {
    /** @type { OpenBoardEditor } */
    editor = null;

    /** @type { BoardWatcher } */
    boardWatcher = null;

    isChange = false;

    #isSaving = false;
    #isSaveable = true;

    constructor() {
        this.editor = document.querySelector("open-board-editor");
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
            }
        }

    }

    async watchBoard(boardID, started = false) {
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
            } else if (metadata.error?.code == 403) {
                alert("You do not have permission to access this board");
            } 
        }
    }


    async onUserChange(user) {
        document.body.toggleAttribute("loaded", false);
        if (user) {
            const query = new URLSearchParams(window.location.search);
            const boardID = query.get("board") ?? null;
            const uid = query.get("user") || (user?.uid ?? null); 
            
            await Promise.all([ 
                this.watchBoard(boardID), 
                uid && session.editor.assignFinderUser(uid),
                styleSheetsLoader
            ]);
        } else {
            // Display a message or redirect to login page
            console.log("User is not logged in. Please log in to access the editor.");
        }
        document.body.toggleAttribute("loaded", true);
    }


    get isSaveable() {
        return this.boardWatcher ? this.boardWatcher.pendingChanges : this.#isSaveable;
    }

    get isSaving() {
        return this.boardWatcher ? this.boardWatcher.isSaving : this.#isSaving;
    }

}

const session = new EditorSession();
FB.addAuthChangeListener(session.onUserChange.bind(session));
