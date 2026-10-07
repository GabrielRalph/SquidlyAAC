import { 
    addRecentSymbol, 
    getRecentSymbols, 
    hasCachedSemanticSearchResults, 
    semanticSearch, 
    SYMBOL_SETS, 
    textSearch, 
    VARIANT_KEY_OPTIONS,
    SSymbol,
    updateVariantKeyValues,
    updateSymbolSets,
    getVariantKeyValues,
    getSymbolSets,
    onFilterChange, 
} from "../Firebase/symbols.js";

import { SvgPlus } from "../SvgPlus/4.js";
import { ShadowElement } from "../SvgPlus/shadow-element.js";
import { Icon } from "../Utilities/icons.js";
import { RoundedTabs } from "../Utilities/RoundedTabs/rounded-tabs.js";
import { CheckBox, SymbolDisplay, OptionSlider, SelectionToggle } from "./components.js";
import { Uploader } from "./symbol-upload.js";


class VariantOptions extends SvgPlus {
    constructor(key, vInfo) {
        super("div");
        this.class = "group";
        this.info = vInfo;
        this.key = key;

        const isColors = vInfo.isColors;
        switch (vInfo.type) { 
            case "list":
                this.createChild("div", {class: "header", content: vInfo.name});
                this.input = this.createChild("div", {class: "border-box"})
                    .createChild(OptionSlider, {
                        class: isColors ? "colors" : null,
                        events: {
                            change: (e) => this.dispatchEvent(new CustomEvent("change", {bubbles: true}))
                        }
                    }, vInfo.options.map(o => ({
                        name: isColors ? " " : o.name, 
                        value: o.value,
                        styles: o.color ? {
                            "--bg": o.color
                        } : {},
                    })
                ));
                break;
            case "boolean":
                this.class = "group row";
                this.input = this.createChild(CheckBox, {
                    events: {
                        change: (e) => this.dispatchEvent(new CustomEvent("change", {bubbles: true}))
                    }
                });
                this.createChild("div", {class: "header", content: vInfo.name});
                break;
            default:
                // handle default case
                break;
        }
    }

    get value() {
        return this.info.type === "boolean" ? (this.input.value ? "1" : "0") : this.input.value;
    }

    set value(val) {
        this.input.value = this.info.type === "boolean" ? (val === "1") : val;
    }

    getValues(values = {}) {
        const {value, key, info} = this;
        values[key] = value;
        if (info.map && value in info.map) {
            for (const subKey in info.map[value]) {
                values[subKey] = info.map[value][subKey];
            }
        }
        return values;
    }

    setValues(values = {}) {
        const { key } = this;
        if (key in values) {
            this.value = values[key];
        }
    }
}

class VariantOptionList extends SvgPlus {
    constructor(variantOptions) {
        super("div");
        this.class = "variant-options-list"
        this.styles = {display: "contents"}

        for (const key in variantOptions) {
            this.createChild(VariantOptions, {}, key, variantOptions[key]);
        }
    }

    get value() {
        let result = {};
        for (const child of this.children) {
            if (child.getValues) {
                child.getValues(result);    
            }
        }
        return result;
    }

    set value(values) {
        for (const child of this.children) {
            if (child.setValues) {
                child.setValues(values);
            }
        }
    }
}

class SearchWindow extends SvgPlus {
    /** @type {SSymbol[]} The current search results. */
    #currentResults = []
    /** @type {string} The current search input value. */
    #currentSearchValue = "";

    constructor() {
        super("search-window");

        let sbArea = this.createChild("div", {class: "search-bar-area"});
        let sbiContainer = sbArea.createChild("div", {class: "input-container"})
        sbiContainer.createChild(Icon, {}, "search");
        sbiContainer.createChild("div", {class: "circle-loader"});
        this.searchInput = sbiContainer.createChild("input", {
            type: "text", 
            placeholder: "Search...",
            events: {
                input: (e) => {
                    this.search(this.searchInput.value, true);
                }
            }
        });


        this.resultsArea = this.createChild("div", {class: "results-area"})
        this.resultsGrid = this.resultsArea.createChild("div", {class: "results-grid"});

        // ~~~~~ FILTERS PANEL ~~~~~
        let filtersArea = this.createChild("div", {class: "filters-area"});
        this.filtersArea = filtersArea;
        filtersArea.createChild("div", {class: "title", content: "Filters"})


        // Symbol Sets filter
        this.symbolSetFiltes = filtersArea.createChild(SelectionToggle, {
            class: "symbol-set-filter",
            events: {
                change: (e) => {
                    updateSymbolSets(this.symbolSetFiltes.value);
                    this.#renderImageGrid()
                }
            }
        }, "Symbol Sets",[
            {
                name: "Public Symbols",
                value: "PUBLIC"
            },
            {
                name: "My Symbols",
                value: "PRIVATE"
            },
            "seperator",
            ...SYMBOL_SETS
        ]);
        this.symbolSetFiltes.toggleAll(true, false);
        this.symbolSetFiltes.value = getSymbolSets();


        // Variant filters
        this.variantFilters = filtersArea.createChild(VariantOptionList, {events: {
                change: (e) => {
                    updateVariantKeyValues(this.variantFilters.value);
                    this.#renderImageGrid();
                }
        }}, {
            skin: VARIANT_KEY_OPTIONS.skin,
            "hair-arasaac": VARIANT_KEY_OPTIONS["hair-arasaac"],
            plural: VARIANT_KEY_OPTIONS.plural
        });
        this.variantFilters.value = getVariantKeyValues();

        this.#renderImageGrid();
    }


    #renderImageGrid() {
        const symbolSets = getSymbolSets();
        this.resultsGrid.innerHTML = "";
        for (const result of this.#currentResults) {
            if (result.isInSet(symbolSets)) {
                this.resultsGrid.createChild(
                    SymbolDisplay, {}, result, this.#selectImage.bind(this)
                );
            }
        }

        this.resultsGrid
            .createChild("div", {class: "loader-box"})
            .createChild("div", {class: "circle-loader"})
    }


    #selectImage(image) {
        addRecentSymbol(image);
        if (this.onImageSelected instanceof Function) {
            this.onImageSelected(image);
        }
        this.dispatchEvent(new CustomEvent("image-selected", {detail: {image}}));
    }


    async queueSemanticSearch(text) {
        let semanticResults = [];
        // If the semantic search results are cached, use them immediately
        if (hasCachedSemanticSearchResults(text)) {
            semanticResults = await semanticSearch(text);

        // Otherwise, wait a short period of time to prevent mid-typing 
        // searches from triggering unnecessary semantic searches
        } else {
            await new Promise((r) => setTimeout(r, 300));
            console.log(`Waited before performing semantic search for: ${text} == ${this.#currentSearchValue}`);
            if (this.#currentSearchValue === text) {
                semanticResults = await semanticSearch(text);
            }
        }

        // Append the semantic search results if they are still relevant
        if (this.#currentSearchValue === text && semanticResults.length > 0) {
            this.#appendResults(semanticResults);
        }
    }


    #appendResults(results) {
        // append the current results with the new results
        let comb = [...this.#currentResults, ...results];

        // Remove duplicate results based on their ID
        let idSet = new Set()
        comb = comb.filter(item => {
            if (idSet.has(item.id)) return false;
            idSet.add(item.id);
            return true;
        });

        // Update the current results with the combined list
        this.#currentResults = comb;

         // Render the updated image grid
        this.#renderImageGrid();
    }


    async search(text) {
        if (text !== this.#currentSearchValue) {
            this.searchInput.value = text;
            this.toggleAttribute("loading", true);
            this.#currentSearchValue = text;
            this.#currentResults = [];

            // Start both semantic and text searches concurrently
            let p1 = this.queueSemanticSearch(text);
            let p2 = textSearch(text);

            // When for both semantic and text searches complete
            // we can safely stop showing the loading indicator
            Promise.all([p1, p2]).then(() => {
                if (this.#currentSearchValue == text) {
                    this.toggleAttribute("loading", false)
                }
            });

            // Wait for the text search to complete and append its results
            const results = await p2;
            if (this.#currentSearchValue === text) {
                this.#appendResults(results);
            }
        }

    }
}


class RecentSymbols extends SvgPlus {
    constructor() {
        super("recent-symbols");
        this.grid = this.createChild("div", {class: "results-grid"});
        this.onConnected();
    }

    onConnected() {
        const symbols = getRecentSymbols();
        this.grid.innerHTML = "";
        for (let symbol of symbols) {
            this.grid.createChild(SymbolDisplay, {}, symbol, (s) => this.#selectSymbol(s));
        }
    }

    #selectSymbol(symbol) {
        addRecentSymbol(symbol);
        if (this.onImageSelected instanceof Function) {
            this.onImageSelected(symbol);
        }
        this.dispatchEvent(new CustomEvent("image-selected", {detail: {image: symbol}}));
    }
}




class FastFindSymbolList extends SvgPlus {
    #lastQuery = "";
    #results = []
    #numberOfSymbols = 16;

    constructor() {
        super("div");
        this.class = "fast-find-symbol-list";
        onFilterChange(() => this.#renderResults());
    }

    #renderResults() {
        this.innerHTML = "";
        const symSet = getSymbolSets()
        this.#results
            .filter(sym => sym.isInSet(symSet))
            .slice(0, this.#numberOfSymbols).forEach(symbol => {
                this.createChild(SymbolDisplay, {}, symbol, (s) => this.#selectSymbol(s));
            });
        this.createChild("div", {class: "loader"});
    }

    async search(query) {
        query = (query || "").trim();
        if (query && query !== this.#lastQuery) {
            this.toggleAttribute("searching", true);
            this.#renderResults([]);
            this.#lastQuery = query;

            let symbols = await textSearch(query);
            if (this.#lastQuery === query) {
                this.#results = symbols;
                this.#renderResults(symbols);

                if (symbols.length < this.#numberOfSymbols) {
                    let semanticSymbols = await semanticSearch(query);
                    if (this.#lastQuery === query) {
                        const idSet = new Set(symbols.map(s => s.id));
                        const combined = [...symbols, ...semanticSymbols.filter(s => !idSet.has(s.id))];
                        this.#results = combined;
                        this.#renderResults();
                    }
                }
            }
            this.toggleAttribute("searching", false);
        }
    }

    get lastQuery() {
        return this.#lastQuery;
    }

    #selectSymbol(symbol) {
        addRecentSymbol(symbol);
        const image = symbol.OBImage;
        if (this.onImageSelected instanceof Function) {
            this.onImageSelected(image);
        }
        this.dispatchEvent(new CustomEvent("image-selected", {detail: {image}}));
    }
}


class SymbolFinder extends ShadowElement {
    #searchWindow;
    #recentSymbols;
    #uploader;
    #tabs;
    #onImageSelectedCb = null;

    constructor(el) {
        super("symbol-finder", "symbol-finder-root");

        this.#searchWindow = new SearchWindow();
        this.#recentSymbols = new RecentSymbols();
        this.#uploader = new Uploader();

        this.createChild("div", {
            class: "close-button", 
            content: "×",
            events: {
                click: () => this.hide()
            }
        });

        this.#tabs = this.createChild(RoundedTabs, {}, {
            "search": {
                title: "Search",
                content: this.#searchWindow
            },
            "recents": {
                title: "Recents",
                content: this.#recentSymbols
            },
            "uploads": {
                title: "Uploads",
                content: this.#uploader
            }
        });

        this.styles = {
            opacity: 0,
            transition: "opacity 0.2s ease-in-out",
            "pointer-events": "none"
        };
    }

    #forwardSymbol(symbol) {
        if (this.#onImageSelectedCb instanceof Function) {
            this.#onImageSelectedCb(symbol.OBImage);
        }
    }

    set onImageSelected(fn) {
        this.#onImageSelectedCb = fn;
        const forward = fn ? (symbol) => this.#forwardSymbol(symbol) : null;
        this.#searchWindow.onImageSelected = forward;
        this.#recentSymbols.onImageSelected = forward;
        this.#uploader.onImageSelected = forward;
    }

    search(text) {
        this.#tabs.select("search");
        this.#searchWindow.search(text);
    }

    show() {
        this.styles = {
            opacity: 1,
            transition: "opacity 0.2s ease-in-out",
            "pointer-events": "auto"
        };
    }

    hide() {
        this.styles = {
            opacity: 0,
            transition: "opacity 0.2s ease-in-out",
            "pointer-events": "none"
        };
    }

    static get usedStyleSheets() {
        return [
            ...RoundedTabs.usedStyleSheets,
            import.meta.resolve("./symbol.css"),
            import.meta.resolve("../../Assets/Icons/icons.css"),
            import.meta.resolve("../Utilities/bg-img.css"),
        ]
    }
}

export { SymbolFinder, FastFindSymbolList };