import { addRecentSymbol, SSymbol, uploadSymbol } from "../Firebase/symbols.js";
import { SvgPlus } from "../SvgPlus/4.js";
import { CheckBox } from "./components.js";


const confirmMessage = "I confirm that I have the right to share this symbol and grant Squidly AAC permission to make it available to other users. I understand that I must not upload material that infringes someone else's rights.";

class Uploader extends SvgPlus {
    constructor(){
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

        // let r = main.createChild("div", {class: "row"});
        this.name = main.createChild("div", {class: "input-container"})
        .createChild("input", {
            placeholder: "Icon Name", 
            class: "name-input",
            events: {
                input: (e) => {
                    this.toggleAttribute("invalid", !this.valid);
                }
            }
        });

        let r = main.createChild("div", {class: "row"});
        this.public = r.createChild(CheckBox, {
            events: {
                change: (e) => {
                    this.toggleAttribute("public", this.public.value);
                    this.toggleAttribute("invalid", !this.valid);
                }
            }
        })
        r.createChild("div", {innerHTML: "Public"});

        r = main.createChild("div", {class: "row confirm-row"});
        this.confirm = r.createChild(CheckBox, {
             events: {
                change: (e) => this.toggleAttribute("invalid", !this.valid)
            }
        })
        r.createChild("div", {innerHTML: confirmMessage, styles: {"font-size": "0.9em", "max-width": "53em"}});

        main.createChild("button", {
            class: "upload-btn", 
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
        this.loaderButton = this.loader.createChild("button", {
            class: "loader-button", 
            innerHTML: "Close",
            events: {
                click: () => {
                    this.toggleAttribute("uploading", false);
                }
            }
        });
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
            this.loader.toggleAttribute("close", false);
            this.toggleAttribute("uploading", true);
            let isPublic = this.public.value;
            let name = this.name.value.trim();
            let file = this.file;

            this.loaderText.innerHTML = "Uploading...";
            this.loaderBar.styles = { "--p": 0.05 }
            try {
                const results = await uploadSymbol(file, name, isPublic, ({progress, message}) => {
                    this.loaderBar.styles = { "--p": progress * 0.95 + 0.05 }
                    this.loaderText.innerHTML = `${(progress * 95 + 5).toFixed(0)}% - ` + message;
                });
                if (results.errors.length == 0) {
                    this.#selectImage(results.symbol);
                    this.toggleAttribute("uploading", false);
                } else {
                    console.error("Upload failed", results);
                    this.loaderText.innerHTML = results.errors.join("<br/>").replace(".", ".<br/>");
                    this.loaderBar.styles = { "--p": 0 }
                    this.loader.toggleAttribute("close", true);
                }
            } catch (e) {
                console.error("Upload failed", e);
                this.loaderText.innerHTML = "Upload failed: " + e.message;
                this.loaderBar.styles = { "--p": 0 }
                this.loader.toggleAttribute("close", true);
            }

            this.uploading = false;
        }
    }

    reset() {
        this.dropArea.innerHTML = "Drop an image here or click to select a file";
        this.dropArea.styles = { "background-image": "none" }
        this.public.value = false;
        this.confirm.value = false;
        this.name.value = "";
        this.file = null;
        this.toggleAttribute("invalid", !this.valid);
    }

    onFileChange(file) {
        // if (file.size > MAX_FILE_SIZE) {
        //     let size = file.size > 1e6 ? (file.size / 1e6).toFixed(2) + "MB" : (file.size / 1024).toFixed(2) + "KB";
        //     this.dropArea.innerHTML = `<span class = "warning">File is too large (${size}). <br/> Max size is ${Math.round(MAX_FILE_SIZE / 1024)}KB</span>`;
        //     this.dropArea.styles = { "background-image": "none" }
        //     this.toggleAttribute("invalid", true);

        // } else {

            let fileName = file.name.replace(/\.[^/.]+$/, "");
            this.name.value = fileName;

            let url = URL.createObjectURL(file);
            this.dropArea.innerHTML = "";
            this.dropArea.styles = { "background-image": `url("${url}")` }

            this.file = file;
            this.toggleAttribute("invalid", !this.valid);

        // }
    }

    #selectImage(image) {
        addRecentSymbol(image);
        if (this.onImageSelected instanceof Function) {
            this.onImageSelected(image);
        }
        this.dispatchEvent(new CustomEvent("image-selected", {detail: {image}}));
        this.reset()
    }

    get valid() {
        return SSymbol.normaliseSearchPhrase(this.name.value.trim()).length > 0 && this.file && (!this.public.value || this.confirm.value) 
    }
}


export {
    Uploader
}