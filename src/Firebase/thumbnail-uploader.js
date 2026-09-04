import { uploadFileToCloud } from "./firebase.js";

class ThumbnailUploader {
    maxSize = 200;
    maxFileSize = 30 * 1e3; // 30KB
    metadata = {}
    onProgress(data) {
        // console.log("Upload progress:", data);
    }

    async getFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        return new Promise((resolve, reject) => {
            input.onchange = () => {
                if (input.files && input.files.length > 0) {
                    this.imageFile = input.files[0];
                    this.imageURL = URL.createObjectURL(this.imageFile);
                } 
                resolve();
            };
            input.click();
        });
    }

    async resizeImage() {
        if (this.imageFile.size > this.maxFileSize) {
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const width = img.naturalWidth;
                    const height = img.naturalHeight;
                    const scale = this.maxSize / Math.max(width, height);

                    // console.log("Original image size:", width, height, "Scale factor:", scale);

                    if (scale < 1) {
                        const nWidth = Math.floor(width * scale);
                        const nHeight = Math.floor(height * scale);

                        const canvas = document.createElement("canvas");
                        const ctx = canvas.getContext("2d");
                        canvas.width = nWidth;
                        canvas.height = nHeight;
                        ctx.drawImage(img, 0, 0, nWidth, nHeight);

                        // 1. Detect if original image needs transparency, or default to webp/jpeg
                        const exportType = this.imageFile.type === "image/png" ? "image/webp" : this.imageFile.type;
                        const exportQuality = 0.9; // 80% quality drastically reduces file size

                        // 2. Use native toBlob to directly output binary data (skips bloated Base64 strings)
                        canvas.toBlob((blob) => {
                            if (!blob) {
                                reject(new Error("Canvas blob generation failed"));
                                return;
                            }

                            // 3. Directly create the File object from the Blob
                            const extension = exportType.split("/")[1];
                            this.imageFile = new File([blob], `thumbnail.${extension}`, { type: exportType });
                            this.imageURL = URL.createObjectURL(this.imageFile);
                            this.metadata = { contentType: exportType };

                            // console.log("New compressed file size:", this.imageFile.size, "bytes");
                            resolve();
                        }, exportType, exportQuality);
                    } else {
                        resolve();
                    }
                };
                img.onerror = (err) => {
                    console.error("Image load error:", err);
                    reject(err);
                };
                img.src = this.imageURL;
            });
        }

        if (this.imageFile.size > this.maxFileSize) {
            let sizeRatio = this.imageFile.size / this.maxFileSize;
            this.maxSize = Math.floor(this.maxSize / Math.sqrt(sizeRatio));
            // console.log(`File size still exceeds limit. Reducing maxSize to ${this.maxSize} and retrying resize.`);
            await this.resizeImage();
        }
    }

    dataURLtoFile(dataurl, filename) {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
            u8arr[i] = bstr.charCodeAt(i);
        }
        this.metadata = { contentType: mime };
        return new File([u8arr], filename, { type: mime });
    }


    clone() {
        const clone = new ThumbnailUploader();
        clone.maxSize = this.maxSize;
        clone.maxFileSize = this.maxFileSize;
        clone.metadata = { ...this.metadata };
        clone.onProgress = this.onProgress;
        clone.imageFile = this.imageFile;
        clone.imageURL = this.imageURL;
        return clone;
    }

    /**
     * @param {string} path - The path in the cloud storage where the file will be uploaded.
     * @returns {Promise<boolean>} - Returns true if the upload was successful, false otherwise.
     */
    async upload(path) {
        let success = false;
        if (this.imageURL) {
            try {
                // console.log(`Uploading thumbnail\n\tpath: ${path}\n\tfile size: ${this.imageFile.size} bytes\n\tmetadata:`, this.metadata);
                this.imageURL = await uploadFileToCloud(this.imageFile, path, this.metadata, this.onProgress);
                success = true;
            } catch (e) {
                console.error("Upload failed:", e);
                this.imageURL = null;
            }
        }

        return success;
    }
}

export { ThumbnailUploader};