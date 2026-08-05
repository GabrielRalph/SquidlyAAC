from dataclasses import dataclass, field, asdict
from pathlib import Path

def remove_none(d):
    if isinstance(d, dict):
        return {k: remove_none(v) for k, v in d.items() if v is not None}
    elif isinstance(d, list):
        return [remove_none(i) for i in d]
    return d


@dataclass
class OpenBoardObject:
    id: str

    def json(self) -> dict:
        return remove_none(asdict(self))


@dataclass
class LoadBoard(OpenBoardObject):
    name: str = None
    data_url: str = None
    url: str = None
    path: str = None


@dataclass
class Symbol:
    set: str
    name: str


@dataclass
class Image(OpenBoardObject):
    width: int
    height: int
    url: str = None
    symbol: Symbol = None
    content_type: str = "image/png"
    license: dict = None


@dataclass
class Button(OpenBoardObject):
    label: str = None
    image_id: str = None
    load_board: LoadBoard = None
    actions: str | list[str] = None
    background_color: str = None
    border_color: str = None
    text_color: str = None
    vocalization: str = None
    top: float = None
    left: float = None
    width: float = None
    height: float = None


@dataclass
class Grid:
    rows: int
    columns: int
    order: list[list[str]]


@dataclass
class Board(OpenBoardObject):
    id: str
    grid: Grid
    format: str = "open-board-0.1"
    name: str = None
    description_html: str = None
    url: str = None
    locale: str = "en"
    buttons: list[Button] = field(default_factory=list)
    images: list[Image] = field(default_factory=list)


@dataclass
class BoardSetPaths:
    boards: dict[str, str]


@dataclass
class BoardSet(OpenBoardObject):
    root: str
    paths: BoardSetPaths
    images: list[Image] = None
    format: str = "open-board-set-0.1"
    

def blank_board(page_id, grid_rows=4, grid_cols=7, *kwargs) -> Board:
    return Board(
        id=page_id,
        name=None,
        description_html=None,
        *kwargs,
        grid = Grid(
            rows=grid_rows,
            columns=grid_cols,
            order=[ [None for _ in range(grid_cols)] for _ in range(grid_rows) ]
        )
     )






