# FileSystem Architecture Audit (Updated)

Date: 2026-08-16
Scope: Re-check after latest user fixes in FileSystem, OBFileSystem, OBFinder, FileSystemUI, and BoardFinder.

## Fixed Since Last Audit

1. Import mismatch resolved: OBFStats is now imported consistently.
   - src/Editor/editor-finder.js:1

2. newBoard ID shadowing fixed.
   - src/FileTree/OBFileSystem.js:198-229

3. getPathByID undeclared variable fixed.
   - src/FileTree/FileSystem/FirestoreFileSystem.js:47-50

4. OBFinder validator key fixed and path parsing added in newBoard/newFolder.
   - src/FileTree/OBFinder.js:295-344

5. Duplicate helper target fixed (now calls FirestoreFileSystem.duplicatePrefix).
   - src/FileTree/FileSystem/FirestoreFileSystem.js:71

6. delete(path) now returns actual deleted state.
   - src/FileTree/FileSystem/FirestoreFileSystem.js:443-451

7. PathNode prune logic corrected.
   - src/FileTree/FileSystem/PathNode.js:114-120

8. Board lookup switched to statByID.
   - src/Editor/editor-finder.js:136

## Remaining Active Bugs

1. Critical: isEffectivePublic can throw on non-existent path entries
   - src/FileTree/OBFileSystem.js:270-276
   - Problem: stat can be null, but code reads stat.public and stat.isBoard.
   - Repro path: creating a new board where the board path does not yet exist in the FS map.
   - Impact: runtime TypeError during board creation/public inheritance checks.

2. Critical: isDirectory still always returns true
   - src/FileTree/FileSystem/FirestoreFileSystem.js:283
   - Problem: no stat/type check.
   - Impact: drag/drop and move target validation are semantically wrong; files are treated as folders.

3. High: duplicatePrefix regex still fails to increment existing suffixes
   - src/FileTree/FileSystem/FirestoreFileSystem.js:619
   - src/FileTree/FileSystem/FirestoreFileSystem.js:623
   - Problem: regex requires trailing whitespace after ")" due to \s+$, so "Name (2)" does not match.
   - Impact: repeated collisions likely become "Name (2) (2)" instead of incrementing to "Name (3)".

4. High: rename action calls missing method promtRename
   - src/FileTree/OBFinder.js:167
   - src/FileTree/OBFinder.js:262
   - Problem: promtRename is invoked, but no implementation exists in the new FileSystemUI stack.
   - Impact: rename from context menu / Meta+R fails at runtime.

5. Medium: save-mode action currently does not create a board
   - src/Editor/editor-finder.js:82-84
   - Problem: create call is commented out.
   - Impact: Save mode UX appears enabled but does not perform create behavior.

## Nuanced Gotchas (Current)

1. isEffectivePublic recursion relies on ancestor entries existing in the FS map.
   - If ancestor folders are virtual/implicit and not materialized, null stats can surface unexpectedly.

2. Root setup contract in FileSystemUI is now implicit.
   - setRoot takes (fs, rootName) and rendering always starts from empty path; callers still passing legacy extra args are tolerated but can hide intent drift.

3. Watch API naming diverges from older patterns.
   - Base and concrete now both expose stopWatch (not stopWatching); if any legacy caller still uses stopWatching it will silently fail.

## Suggested Next Fix Order

1. Runtime blockers
   - Guard null in isEffectivePublic before reading stat fields.
   - Implement a real isDirectory(path) using stat(path).
   - Restore or replace promtRename call path.

2. Consistency bugs
   - Fix duplicatePrefix regex to match end-of-string numeric suffixes without requiring trailing spaces.
   - Re-enable save-mode create action or disable the button state for that mode.
