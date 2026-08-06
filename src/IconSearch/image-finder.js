import { SvgPlus } from "../Utilities/utils.js";
import { OBImage } from "../OpenBoard/openboard.js";
import { addRecentImage, getRecentImages, textSearch, semanticSearch, getNumberOfOwnedImages, addMyIconCountWatcher, uniqueImages, uploadImage } from "./images.js";

const MAX_FILE_SIZE = 150 * 1024;
const STATUS_TEXT = {
    "0": "Starting",
    "1": "Converting to PNG",
    "2": "Creating search vector",
    "3": "Cheking similarity",
    "3.3": "Creating Icon Info",
    "3.6": "Saving Icon File",
    "4": "Complete"
}

class ImageBox extends SvgPlus {
    /**
     * @param {OBImage} image
     * @param {(image: OBImage, e: MouseEvent) => any} onSelect
     * @returns {ImageBox}
     */
    constructor(image, onSelect) {
        super("div");
        const url = image.resolvedURL.replace(/"/g, "%22");
        this.props = {
            class: "image-box",
            title: image.name,
            styles: { "background-image": `url("${url}")` },
            events: {
                click: (e) => {
                    onSelect(image, e);
                }
            },
        }
        if (image?.license?.owner) {
            this.createChild("div", {class: "owned", innerHTML: "✓"});
        }
    }
}

class Uploader extends SvgPlus {
    constructor(searchWidget){
        super("div");
        this.class = "upload-form panel";

        let main = this.createChild("div", {class: "main"});

        this.dropArea = main.createChild("div", {
            class: "drop-area", 
            innerHTML: "Drop an image here or click to select a file",
            events: {
                click: () => {
                    let i = new SvgPlus("input");
                    i.props = {
                        type: "file",
                        accept: "image/*",
                        events: {
                            change: (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    this.onFileChange(file);
                                }
                            }
                        }
                    }
                    i.click();
                },
                dragover: (e) => {
                    // Check if the dragged item is a file and the file type is an image
                    if (e.dataTransfer.items.length > 0 
                        && e.dataTransfer.items[0].kind === 'file' 
                        && e.dataTransfer.items[0].type.startsWith('image/')
                    ) {
                        e.preventDefault();
                        this.dropArea.classList.add("dragover");
                    }
                },
                dragleave: (e) => {
                    e.preventDefault();
                    this.dropArea.classList.remove("dragover");
                },
                drop: (e) => {
                    if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].type.startsWith('image/')) {
                        e.preventDefault();
                        this.dropArea.classList.remove("dragover");
                        const file = e.dataTransfer.files[0];
                        if (file) {
                            this.onFileChange(file);
                        }
                    }
                }
            }
        });
        let r = main.createChild("div", {class: "row"});
        this.name = r.createChild("input", {
            placeholder: "Icon Name", 
            class: "name-input",
            events: {
                input: (e) => {
                    this.toggleAttribute("invalid", this.name.value.trim() === "" || !this.file);
                }
            }
        });
        this.public = r.createChild("div", {
            class: "row checkbox", 
            innerHTML: "Public",
            events: {
                click: () => {
                    this.public.toggleAttribute("checked");
                }
            }
        })
        this.public.createChild("div", {class: "box"});
        main.createChild("div", {
            class: "btn upload-btn", 
            innerHTML: "Upload",
            events: {
                click: async () => {
                    this.uploadFile();
                }
            }
        })
        this.toggleAttribute("invalid", true);

        this.loader = this.createChild("div", {class: "loader-overlay"});
        this.loaderBar = this.loader.createChild("div", {class: "loader-bar"});
        this.loaderText = this.loader.createChild("div", {class: "loader-text", innerHTML: "Uploading..."});
    }

    async test(cb) {
        let kes = ["0", "1", "2", "3", "3.3", "3.6", "4"]
        await new Promise(resolve => setTimeout(resolve, 2000));
        for (let key of kes) {
            let p = 0.1 + 0.9 * parseFloat(key) / 4;
            cb(p,key);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    async uploadFile() {
        if (!this.uploading && this.valid) {
            this.uploading = true;
            this.toggleAttribute("uploading", true);
            let isPublic = this.public.hasAttribute("checked");
            let name = this.name.value.trim();
            let file = this.file;

            this.loaderText.innerHTML = "Uploading...";
            this.loaderBar.styles = { "--p": 0.05 }
            try {
                const results = await uploadImage(file, name, isPublic, (p, key) => {
                    this.loaderBar.styles = { "--p": p }
                    this.loaderText.innerHTML = `${(p * 100).toFixed(0)}% - ` + STATUS_TEXT[key];
                });
                if (results?.valid) {
                    let image = OBImage.make({
                        id: results.symbolID,
                        name,
                        width: 100,
                        height: 100,
                        license: {owner: true},
                        url: results.url,
                    })
                    this.#selectImage(image);
                } else {
                    console.error("Upload failed", results);
                }
            } catch (e) {
                console.error("Upload failed", e);
                this.loaderText.innerHTML = "Upload failed: " + e.message;
                this.loaderBar.styles = { "--p": 0 }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            this.uploading = false;
            this.toggleAttribute("uploading", false);
        }
    }

    reset() {
        this.dropArea.innerHTML = "Drop an image here or click to select a file";
        this.dropArea.styles = { "background-image": "none" }
        this.public.removeAttribute("checked");
        this.name.value = "";
        this.file = null;
        this.toggleAttribute("invalid", !this.valid);
    }

    onFileChange(file) {
        if (file.size > MAX_FILE_SIZE) {
            let size = file.size > 1e6 ? (file.size / 1e6).toFixed(2) + "MB" : (file.size / 1024).toFixed(2) + "KB";
            this.dropArea.innerHTML = `<span class = "warning">File is too large (${size}). <br/> Max size is ${Math.round(MAX_FILE_SIZE / 1024)}KB</span>`;
            this.dropArea.styles = { "background-image": "none" }
            this.toggleAttribute("invalid", true);

        } else {
            let fileName = file.name.replace(/\.[^/.]+$/, "");
            this.name.value = fileName;

            let url = URL.createObjectURL(file);
            this.dropArea.innerHTML = "";
            this.dropArea.styles = { "background-image": `url("${url}")` }

            this.file = file;
            this.toggleAttribute("invalid", !this.valid);
        }
    }

    #selectImage(image) {
        addRecentImage(image);
        if (this.onImageSelected instanceof Function) {
            this.onImageSelected(image);
        }
        this.dispatchEvent(new CustomEvent("image-selected", {detail: {image}}));
    }

    get valid() {
        return this.name.value.trim() !== "" && this.file && this.file.size <= MAX_FILE_SIZE;
    }
}

class ImageGrid extends SvgPlus {
    constructor() {
        super("div");
        this.class = "image-grid";
        this.createChild("div", {class: "loader"})
    }

    set images(images) {
        this.innerHTML = "";
        images.map(img => 
            this.createChild(ImageBox, {}, img, (i) => this.#selectImage(i))
        )
        this.createChild("div", {class: "loader"});
    }

    #selectImage(image) {
        addRecentImage(image);
        if (this.onImageSelected instanceof Function) {
            this.onImageSelected(image);
        }
        this.dispatchEvent(new CustomEvent("image-selected", {detail: {image}}));
    }
}

class Searcher extends SvgPlus {
    limit = 6 * 50;
    constructor() {
        super("div");
        this.mode = "search";
        this.class = "finder";

        let top = this.createChild("div", {class: "panel"})
        this.input = top.createChild("input", {
            placeholder: "Search for Images", 
            events: {
                change: (e) => this.search(this.input.value),
                keydown: (e) => {
                    if (e.key === "Enter") {
                        this.input.blur();
                    }
                }

            }
        });
        this.isPublic = true
        this.toggle = top.createChild("div", {
            class: "btn", 
            innerHTML: "My Icons",
            events: {
                click: () => {
                    this.isPublic = !this.isPublic;
                    this.toggle.innerHTML = this.isPublic ? "My Icons" : "All Icons";
                    this.search(this.query);
                }
            }
        })
        addMyIconCountWatcher((count) => {
            console.log("My Icon Count", count);
            this.toggleAttribute("has-my-icons", count > 0);
        })
        this.main = this.createChild(ImageGrid);
        this.main.onImageSelected = (image) => this.#selectImage(image);
    }

    async initialiseTop() {
        let myIcons = await getNumberOfOwnedImages();
        console.log("My Icons", myIcons);
    }

    async search(text) {
        text = (text || "").trim();
        this.input.value = text;
        if (text) {
            this.query = text;
            this.toggleAttribute("searching", true);
            const tprom = textSearch(text, this.isPublic);
            const sprom = semanticSearch(text, this.isPublic);
            let images = await tprom;
            console.log("Search results", images.length, "images found for query:", text);
            this.main.images = images;
            let semanticImages = await sprom;
            images = uniqueImages(images.concat(semanticImages));
            this.main.images = images;
            this.toggleAttribute("searching", false);
        }
    }

    #selectImage(image) {
        addRecentImage(image);
        if (this.onImageSelected instanceof Function) {
            this.onImageSelected(image);
        }
        this.dispatchEvent(new CustomEvent("image-selected", {detail: {image}}));
    }
}

class ImageFinder extends SvgPlus {
    constructor() {
        super("image-finder");
        const head = this.createChild("div", {class: "panel header", innerHTML: "Search for Images"});
        head.createChild("div", {class: "btn", innerHTML: "×", events: {
            click: () => this.hide()
        }});
        this.tabs = this.createChild("div", {class: "panel selection"});
        const events = {click: (e) => this.selectMode(e.target.mode)};
        this.tabs.createChild("div", {class: "tab", innerHTML: "Search", events}).mode = "search";
        this.tabs.createChild("div", {class: "tab", innerHTML: "Recent", events}).mode = "recent";
        this.tabs.createChild("div", {class: "tab", innerHTML: "Upload", events}).mode = "upload";
        this.main = this.createChild("div", {class: "main"});

        const searcher = this.main.createChild(Searcher);
        searcher.onImageSelected = (image) => this.#selectImage(image);
        this.searcher = searcher;

        this.recent = this.main.createChild("div", {class: "wrap"})
        this.recent.mode = "recent";
        this.recent = this.recent.createChild(ImageGrid);
        this.recent.onImageSelected = (image) => this.#selectImage(image);

        this.upload = this.main.createChild(Uploader);
        this.upload.mode = "upload";
        this.upload.onImageSelected = (image) => this.#selectImage(image);

        this.selectMode("search");
        this.styles = {
            opacity: 0,
            transition: "opacity 0.2s ease-in-out",
            "pointer-events": "none"
        }
    }


    search(text) {
        this.selectMode("search");
        this.searcher.search(text);
    }

    #selectImage(image) {
        addRecentImage(image);
        if (this.onImageSelected instanceof Function) {
            this.onImageSelected(image);
        }
        this.dispatchEvent(new CustomEvent("image-selected", {detail: {image}}));
    }

    selectMode(mode) {
        if (mode === "recent") { 
            this.recent.images = getRecentImages();
        }

        [...this.tabs.children].forEach(tab => 
            tab.toggleAttribute("selected", tab.mode === mode)
        );
        [...this.main.children].forEach(child => 
            child.toggleAttribute("hidden", child.mode !== mode)
        );
    }

    hide() {
        this.styles = {
            opacity: 0,
            transition: "opacity 0.2s ease-in-out",
            "pointer-events": "none"
        };
    }

    show() {
        this.styles = {
            opacity: 1,
            transition: "opacity 0.2s ease-in-out",
            "pointer-events": "auto"
        };
    }
}

class FastFindImageList extends SvgPlus {
    #lastQuery = "";
    #numberOfImages = 16;
    constructor() {
        super("div");
        this.styles = {display: "contents"};
    }

    set images(images) {
        this.innerHTML = "";
        images.slice(0, this.#numberOfImages).map(img =>
            this.createChild(ImageBox, {}, img, (i) => this.#selectImage(i))
        )
        this.createChild("div", {class: "loader"});
    }

    async search(query) {
        query = (query || "").trim();

        if (query && query !== this.#lastQuery) {
            this.toggleAttribute("searching", true);
            this.images = [];
            this.#lastQuery = query;
            let images = await textSearch(query);

            // Only update the list if the query hasn't
            // changed since the search started
            if (this.#lastQuery === query) {
                this.images = images;

                // If there are less than 8 results, 
                // perform a semantic search
                if (images.length < this.#numberOfImages) {
                    let imagesScemantic = await semanticSearch(query);

                    // Only update the list if the query hasn't changed
                    if (this.#lastQuery === query) {
                        this.images = uniqueImages(images.concat(imagesScemantic));
                    }
                }
            }
            this.toggleAttribute("searching", false);
        }
    }

    get lastQuery() {
        return this.#lastQuery;
    }

    #selectImage(image) {
        addRecentImage(image);
        if (this.onImageSelected instanceof Function) {
            this.onImageSelected(image);
        }
        this.dispatchEvent(new CustomEvent("image-selected", {detail: {image}}));
    }   
}

export { ImageFinder, FastFindImageList };