# Basic File System

The file system is framework of storing files 

The file tree is actually stored in a flat mannar as an object where the keys are paths and values are the file contents e.g.
```
{
    folderA/folderB/fileA: { ... }
    folderA/fileB: { ... }
}
```

# AAC Implementation

The file system contains only folders and boards. Boards can also act as folders containing other boards and folders within, in this case we will call these board sets. A board file is a json file that may contain references to other boards. 

Within the file system board files do not store board file content instead they store a board ID wich is a reference to the boards actual file content. This is done such that a board can be moved, renamed but a its board id can remain constant. 

There is a board file system for each user of the platform.

Boards can be favourited, and boards can be made public.

If a board set is made public then all of the boards contained within in it can be accesed publically.

A user should be able to query for all public boards/board sets. The query should not return boards contained within a public board.


