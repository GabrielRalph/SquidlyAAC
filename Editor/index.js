import * as FB from "../src/Firebase/firebase.js";


let userLoadedPromise = FB.initialise();

import { OpenBoardEditor } from "../src/Editor/editor.js";
import { BoardWatcher } from "../src/Firebase/boards.js";

let styleSheetsLoader = await OpenBoardEditor.loadStyleSheets()
OpenBoardEditor.defineHTMLElement(OpenBoardEditor);
const editor = document.querySelector("open-board-editor");
const headTitle = document.head.querySelector("title");

/** @type {BoardWatcher } */
let boardWatcher = null;


let updateTimeout = null;
let timeOfLastSave = null;
async function editBoard(boardID) {
    if (boardWatcher) {
        boardWatcher.stop();
        boardWatcher = null;
    }

    let canSave = false;
    let canSaveDraft = false;
    let isChange = false;

    function updateSaveStatus() {
        const editorBoard = editor.board;
        const draftBoard = boardWatcher?.draft;
        const savedBoard = boardWatcher?.board;

        let newCanSave = !editorBoard.same(savedBoard);
        let change = newCanSave !== canSave;
        canSave = newCanSave;
        canSaveDraft = !editorBoard.same(draftBoard);
        console.log(`update status: canSave=${canSave}, canSaveDraft=${canSaveDraft}`)

        if (!updateTimeout) {
            updateTimeout = true;
            window.requestAnimationFrame(() => {
                editor.titleNote.innerHTML = canSave ? (canSaveDraft ? "*" : "&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;&nbsp;Draft Saved") : ""
                updateTimeout = null;
            });
        }
        return !editorBoard.same(boardWatcher?.currentBoard) 
    }

    function updateTitle() {
        let path = boardWatcher?.metadata.path;
        let name = path.split("\\").pop();
        headTitle.innerHTML = `${name} | Board Editor | Squidly`;
        
        path = (path ? path.replace(/\\/g, " ▸ ") : "")
		path = path ? "&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;&nbsp;<b>" + path : "";
		editor.titleSpan.innerHTML = path;
    }

    editor.getIsSaveable = () => {
        return canSave;
    }

    editor.getIsSaving = () => {
        return boardWatcher?.isSaving;
    }

    editor.onBeforeUpdate = () => {
        updateSaveStatus();
    }

    editor.onUpdate = () => {
        if (canSaveDraft && !editor.editingLabel) {
            boardWatcher.updateDraft(editor.board);
            timeOfLastSave = Date.now();
        }
    }

    editor.save = async () => {
        
        if (boardWatcher && canSave) {
            let promise = boardWatcher.save(editor.board);
            editor.forceToolUpdate();
            await promise;
            updateSaveStatus();
            editor.forceUpdate();
        }
    }

    let started = false;
    boardWatcher = new BoardWatcher(boardID, (isChange) => {
        const { currentBoard, board, metadata, draft } = boardWatcher;
        if (!started) {
            started = true;
            editor.board = currentBoard;
        } else if (updateSaveStatus()) {
            editor.updateBoard(currentBoard);
        }
        updateTitle();
    });
    await boardWatcher.watch();

    editor.clearChanges = () => {
        editor.updateBoard(boardWatcher.board);
    }
}

async function onUserChange(user) {
    document.body.toggleAttribute("loaded", false);
    if (user) {
        console.log("User is logged in:", user.uid);
        const query = new URLSearchParams(window.location.search);
        const boardID = query.get("board");
        const uid = query.get("user") || user.uid;

        if (boardID) {
            // console.log("Editing board:", boardID);
            await Promise.all([ 
                editBoard(boardID), 
                editor.assignFinderUser(uid),
                styleSheetsLoader
            ]);
            // console.log("Loaded board", boardID);
        }
    } else {
        // Display a message or redirect to login page
        console.log("User is not logged in. Please log in to access the editor.");
    }
    document.body.toggleAttribute("loaded", true);
    console.log("Loaded");
}

FB.addAuthChangeListener(onUserChange);
