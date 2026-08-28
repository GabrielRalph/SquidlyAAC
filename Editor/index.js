import * as FB from "../src/Firebase/firebase.js";
import { OpenBoardEditor } from "../src/Editor/editor.js";
import { addBoardToRecent, BoardWatcher } from "../src/Firebase/boards.js";

/**
 * User states
 * 
 *  allowed: User && isUserEditor
 *      User:           true  |  false
 *      isUserEditor:   true  |  false
 * 
 *  IsBoard:        true  |  false
 */

let userLoadedPromise = FB.initialise();
let styleSheetsLoader = await OpenBoardEditor.loadStyleSheets()
OpenBoardEditor.defineHTMLElement(OpenBoardEditor);

class EditorSession {
    /** @type { BoardWatcher } */
    boardWatcher = null;
    isChange = false;

    constructor() {
        this.editor = document.querySelector("open-board-editor");
        this.headTitle = document.head.querySelector("title");

        const editor = this.editor;
        
        editor.getIsSaveable = () => { 
            return this.boardWatcher?.pendingChanges ?? false; 
        }
        editor.getIsSaving = () => { return this.boardWatcher?.isSaving ?? false; }

        editor.onUpdate = () => {
            if (this.boardWatcher && !this.boardWatcher.sameAsDraft(editor.board)) {
                this.boardWatcher.updateDraft(editor.board);
                this.editor.forceToolUpdate();

            }
        }

        editor.clearChanges = () => {
            if (this.boardWatcher) {
                editor.board = this.boardWatcher.saved;
            }
        }

        editor.save = async () => {
            if (this.boardWatcher && this.boardWatcher.pendingChanges) {
                let promise = this.boardWatcher.save(editor.board);
                editor.forceToolUpdate();
                await promise;
                this.updateSaveStatus();
                editor.forceUpdate();
            } else if (!this.boardWatcher) {
                const id = await editor.getNewBoard();
                console.log("New Board ID:", id);
                if (id) {
                    this.saveAsAndWatch(id);
                }
            }
        }
    }

    updateTitle() {
        if (this.boardWatcher && this.boardWatcher.metadata && this.boardWatcher.metadata.valid) {
            console.log(this.boardWatcher.metadata)
            let path = this.boardWatcher?.metadata?.path;
            this.headTitle.innerHTML = `${path.name} | Board Editor | Squidly`;
            
            path = (path ? path.parts.join(" ▸ ") : "")
            path = path ? "&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;&nbsp;<b>" + path : "";
            this.editor.titleSpan.innerHTML = path;
        }
    }

    updateSaveStatus() {
        if (this.boardWatcher) {
            const canSave = this.boardWatcher?.pendingChanges;
            this.editor.titleNote.innerHTML = canSave ? "&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;&nbsp;Draft Saved" : "";
            return true
        }
        return false;
    }

    async watchBoard(boardID) {
        addBoardToRecent(boardID);
        if (this.boardWatcher) {
            this.boardWatcher.stop();
            this.boardWatcher = null;
        }
        
        if (boardID) {
            let started = false;
            console.log("Watching board:", boardID);
            this.boardWatcher = new BoardWatcher(boardID, () => {
                const { currentBoard, saved, metadata } = this.boardWatcher;
                this.editor.metadata = metadata;
                if (!started) {
                    started = true;
                    this.editor.board = currentBoard;
                } else {
                    this.updateSaveStatus();
                    this.editor.updateBoard(currentBoard);
                }
                this.updateTitle();
            });
            await this.boardWatcher.watch();
        }
    }

    async saveAsAndWatch(boardID) {
        if (this.boardWatcher) {
            this.boardWatcher.stop();
            this.boardWatcher = null;
        }

        // Update the URL to include the new board ID
        const query = new URLSearchParams(window.location.search);
        query.set("board", boardID);
        window.history.replaceState({}, "", `${window.location.pathname}?${query.toString()}`);

        // Start saving the board 
        this.boardWatcher = new BoardWatcher(boardID, (isChange) => {})
        let prom = this.boardWatcher.save(this.editor.board);
        this.editor.forceToolUpdate();
        await prom;

        // Now start watching the board for changes
        this.watchBoard(boardID);
    }
}

const session = new EditorSession();

async function onUserChange(user) {
    document.body.toggleAttribute("loaded", false);
    if (user) {
        const query = new URLSearchParams(window.location.search);
        const boardID = query.get("board") ?? null;
        const uid = query.get("user") || (user?.uid ?? null); 

        
        await Promise.all([ 
            boardID && session.watchBoard(boardID), 
            uid && session.editor.assignFinderUser(uid),
            styleSheetsLoader
        ]);
    } else {
        // Display a message or redirect to login page
        console.log("User is not logged in. Please log in to access the editor.");
    }
    document.body.toggleAttribute("loaded", true);
}

FB.addAuthChangeListener(onUserChange);
