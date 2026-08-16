# FileSystem Architecture Audit (Updated Re-check)

Date: 2026-08-16
Scope: Re-check after additional fixes in OBFinder, OBFileSystem, FirestoreFileSystem, FileSystemUI, and BoardFinder.

## Fixed Since Previous Revision

1. OBFinder rename calls no longer reference missing `promtRename`.
   - src/FileTree/OBFinder.js:167
   - src/FileTree/OBFinder.js:262

2. `isEffectivePublic` now has null-safe stat access and proper root stop.
   - src/FileTree/OBFileSystem.js:270-278

3. `toggleFavourite` array handling and null-guard now look correct.
   - src/FileTree/OBFileSystem.js:305-324

4. `duplicatePrefix` regex now handles end-of-string suffixes (`\s*$`).
   - src/FileTree/FileSystem/FirestoreFileSystem.js:618-626

5. New board path normalization from BoardFinder -> OBFinder is now safe.
   - src/Editor/editor-finder.js:43
   - src/FileTree/OBFinder.js:295-319

## Remaining Active Bugs

1. Critical: rename path has no prompt/new-name source
   - src/FileTree/OBFinder.js:167
   - src/FileTree/OBFinder.js:262
   - src/FileTree/FileSystem/FileSystemUI.js:362-377
   - Problem: both context-menu and hotkey call `rename(path)` with no `newName`, but `FileSystemUI.rename` requires `newName`.
   - Impact: rename can pass `undefined` through to backend rename logic, producing invalid target names/paths.

2. Critical: `isDirectory` still always returns true
   - src/FileTree/FileSystem/FirestoreFileSystem.js:283
   - Problem: no actual stat/type check.
   - Impact: drag/drop and move validation remain semantically wrong (files treated as directories).

3. High: `#makePublic` can throw on missing path/stat
   - src/FileTree/OBFileSystem.js:348-355
   - Problem: reads `stat.isBoard` without null guard.
   - Impact: toggling public/favourite on stale selections can raise runtime errors.

4. Medium: Save mode still appears enabled but performs no create action
   - src/Editor/editor-finder.js:82-84
   - Problem: create call remains commented out.
   - Impact: UX inconsistency; user clicks “Save” and no board is created.

## Nuanced Gotchas (Current)

1. Root contract drift in FileSystemUI
   - `setRoot` now takes `(fs, rootName)` and rendering is anchored to `""` root internally.
   - Call sites still passing legacy extra args work incidentally, but hide intent and make future refactors risky.

2. Default double-click fallback is currently a no-op in base icon class
   - `FSFileIcon.onDoubleClick` in FileSystemUI is empty.
   - OBFinder provides a board-specific double-click handler, but non-board fallback behavior is now effectively disabled unless added explicitly.

## Suggested Next Fix Order

1. Restore safe rename UX path
   - Add a prompt-based rename entrypoint (or require `newName` at call sites before invoking `rename`).

2. Fix filesystem type semantics
   - Implement `isDirectory(path)` using actual stats.

3. Harden edge-path guards
   - Null-guard `#makePublic` before dereferencing `stat.isBoard`.

4. Resolve save-mode UX
   - Re-enable board creation action or disable save button until implemented.
