import * as FB from "../src/Firebase/firebase.js";


let userLoadedPromise = FB.initialise();

import { OpenBoardEditor } from "../src/Editor/editor.js";
import { BoardWatcher } from "../src/Firebase/boards.js";

let styleSheetsLoader = await OpenBoardEditor.loadStyleSheets()
OpenBoardEditor.defineHTMLElement(OpenBoardEditor);

class EditorSession {
    /** @type { BoardWatcher } */
    boardWatcher = null;
    canSave = true;
    canSaveDraft = false;
    isChange = false;

    constructor() {
        this.editor = document.querySelector("open-board-editor");
        this.headTitle = document.head.querySelector("title");

        const editor = this.editor;
        editor.getIsSaveable = () => { return this.canSave; }
        editor.getIsSaving = () => { return this.boardWatcher?.isSaving ?? false; }
        editor.onBeforeUpdate = () => { this.updateSaveStatus(); }
        editor.onUpdate = () => {
            if (this.boardWatcher && this.canSaveDraft && !editor.editingLabel) {
                this.boardWatcher.updateDraft(editor.board);
            }
        }

        editor.clearChanges = () => {
            if (this.boardWatcher) {
                editor.board = this.boardWatcher.board;
            }
        }

        editor.save = async () => {
            if (this.boardWatcher && this.canSave) {
                let promise = this.boardWatcher.save(editor.board);
                editor.forceToolUpdate();
                await promise;
                this.updateSaveStatus();
                editor.forceUpdate();
            }
        }
    }

    updateTitle() {
        if (this.boardWatcher && this.boardWatcher.metadata) {
            let path = this.boardWatcher?.metadata?.path;
            let name = path.split("\\").pop();
            this.headTitle.innerHTML = `${name} | Board Editor | Squidly`;
            
            path = (path ? path.replace(/\\/g, " ▸ ") : "")
            path = path ? "&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;&nbsp;<b>" + path : "";
            this.editor.titleSpan.innerHTML = path;
        }
    }

    updateSaveStatus() {
        if (this.boardWatcher) {
            const editorBoard = this.editor.board;
            const draftBoard = this.boardWatcher?.draft;
            const savedBoard = this.boardWatcher?.board;
            this.canSave = !editorBoard.same(savedBoard);
            this.canSaveDraft = !editorBoard.same(draftBoard);
            // console.log(`update status: canSave=${this.canSave}, canSaveDraft=${this.canSaveDraft}`)
            this.editor.titleNote.innerHTML = this.canSave ? 
                (this.canSaveDraft ? "*" : "&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;&nbsp;Draft Saved") : ""
            return !editorBoard.same(this.boardWatcher?.currentBoard) 
        }
        return false;
    }

    async watchBoard(boardID) {
        if (this.boardWatcher) {
            this.boardWatcher.stop();
            this.boardWatcher = null;
        }
        
        let started = false;
        this.boardWatcher = new BoardWatcher(boardID, (isChange) => {
            const { currentBoard, board, metadata, draft } = this.boardWatcher;
            if (!started) {
                started = true;
                this.editor.board = currentBoard;
            } else if (this.updateSaveStatus()) {
                this.editor.updateBoard(currentBoard);
            }
            this.updateTitle();
        });
        await this.boardWatcher.watch();
    }

    async saveAsAndWatch(boardID) {
        if (this.boardWatcher) {
            this.boardWatcher.stop();
            this.boardWatcher = null;
        }

        let boardWatcher = new BoardWatcher(boardID, (isChange) => {})
        boardWatcher.save(this.editor.board);
        await this.watchBoard(boardID);
    }
}

const session = new EditorSession();

async function onUserChange(user) {
    document.body.toggleAttribute("loaded", false);
    if (user) {
        const query = new URLSearchParams(window.location.search);
        const boardID = query.get("board");
        const uid = query.get("user") || user.uid;


        await Promise.all([ 
            boardID && session.watchBoard(boardID), 
            session.editor.assignFinderUser(uid),
            styleSheetsLoader
        ]);
    } else {
        // Display a message or redirect to login page
        console.log("User is not logged in. Please log in to access the editor.");
    }
    document.body.toggleAttribute("loaded", true);
}

FB.addAuthChangeListener(onUserChange);
