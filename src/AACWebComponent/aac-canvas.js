import { OBBoard } from "../OpenBoard/openboard.js";
import { SvgPlus, Vector, wrapText } from "../Utilities/utils.js";

const F45RAD = 1 / Math.tan(3 * Math.PI / 8);
const TEXT_FONT_FAMILY = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";

const SIZE_MULTIPLIERS = {
    giant: 4,
    huge: 2.5,
    large: 1.5,
    medium: 1,
    small: 0.85,
    tiny: 0.7,
};

/** @type {Map<string, Promise<HTMLImageElement | null>>} */
const IMAGE_CACHE = new Map();

function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (IMAGE_CACHE.has(src)) return IMAGE_CACHE.get(src);

    const prom = new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });

    IMAGE_CACHE.set(src, prom);
    return prom;
}

function getFolderPaths(size, border, borderRadius, origin = new Vector(0, 0)) {
    let inSize = size.sub(border);
    let g = borderRadius;
    let w = inSize.x;
    let y = F45RAD;
    g = Math.min(w / (3 + 2 * y), g);
    let d0 = w - g * (3 + 2 * y);
    let b = d0 * 0.45;

    let p1 = new Vector(border / 2, border / 2 + 2 * g).add(origin);
    let p2 = p1.addV(-g);
    let p3 = p2.add(g, -g);
    let p4 = p3.addH(b);

    let d1 = y * g / Math.sqrt(2);
    let p5 = p4.addH(y * g).add(d1);

    let p7 = p4.add(g * (1 + 2 * y), g);
    let p6 = p7.addH(-y * g).sub(d1);
    let p9 = p1.addH(w);
    let p8 = p9.sub(g);

    let h = inSize.y;
    let p10 = p9.addV(h - 3 * g);
    let p11 = p10.add(-g, g);

    let p13 = p1.addV(h - 3 * g);
    let p12 = p13.add(g, g);

    let gv = new Vector(g, g);
    return {
        tab: `M${p1}L${p2}A${gv},0,0,1,${p3}L${p4}A${gv},0,0,1,${p5}L${p6}A${gv},0,0,0,${p7}L${p8}A${gv},0,0,1,${p9}Z`,
        card: `M${p9}L${p10}A${gv},0,0,1,${p11}L${p12}A${gv},0,0,1,${p13}L${p1}Z`,
        outline: `M${p1}L${p2}A${gv},0,0,1,${p3}L${p4}A${gv},0,0,1,${p5}L${p6}A${gv},0,0,0,${p7}L${p8}A${gv},0,0,1,${p9}L${p10}A${gv},0,0,1,${p11}L${p12}A${gv},0,0,1,${p13}Z`,
    };
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, width, height, r);
        return;
    }

    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawButtonBackground(ctx, origin, size, button, props) {
    const colors = button.colorTheme || {};
    const mainColor = colors.main || "white";
    const tabColor = colors["tab-color"] || "#e6e6e6";
    const outline = colors.outline || "black";

    ctx.lineWidth = props.border;
    ctx.lineJoin = "round";
    ctx.strokeStyle = outline;

    if (button.load_board) {
        const paths = getFolderPaths(size, props.border, props.borderRadius, origin);
        const tab = new Path2D(paths.tab);
        const card = new Path2D(paths.card);
        const border = new Path2D(paths.outline);

        ctx.fillStyle = tabColor;
        ctx.fill(tab);
        ctx.fillStyle = mainColor;
        ctx.fill(card);
        ctx.stroke(border);
    } else {
        drawRoundedRect(
            ctx,
            origin.x + props.border / 2,
            origin.y + props.border / 2,
            size.x - props.border,
            size.y - props.border,
            props.borderRadius,
        );
        ctx.fillStyle = mainColor;
        ctx.fill();
        ctx.stroke();
    }
}

function drawButtonText(ctx, origin, size, button, hasImage, props) {
    if (!button.label) return props.border;

    let topY = button.load_board ? props.borderRadius * 2 : 0;
    topY += props.border;

    let fontSize = props.fontSize;
    if (button.font_size && SIZE_MULTIPLIERS[button.font_size]) {
        fontSize *= SIZE_MULTIPLIERS[button.font_size];
    }

    const colors = button.colorTheme || {};
    const maxWidth = size.x - 2 * props.border;

    ctx.font = `${fontSize}px ${TEXT_FONT_FAMILY}`;
    ctx.fillStyle = colors.text || "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const wrappedLines = button.label
        .split("\n")
        .flatMap((line) => wrapText(line, maxWidth, ctx));

    if (!hasImage) {
        topY += (size.y - topY - fontSize * 1.2 * wrappedLines.length) / 2;
    }

    for (const line of wrappedLines) {
        ctx.fillText(
            line,
            origin.x + size.x / 2,
            origin.y + props.border + topY + fontSize / 2,
            maxWidth,
        );
        topY += fontSize * 1.2;
    }

    return topY;
}

async function drawBoardButton(ctx, origin, size, button, image, props) {
    drawButtonBackground(ctx, origin, size, button, props);

    const hasImage = !!image;
    const topY = drawButtonText(ctx, origin, size, button, hasImage, props);

    if (!image || !image.resolvedURL) return;

    const loadedImage = await loadImage(image.resolvedURL);
    if (!loadedImage) return;

    const x = origin.x + props.border;
    const y = origin.y + props.border + topY;
    const width = size.x - 2 * props.border;
    const height = size.y - 2 * props.border - topY;
    if (width <= 0 || height <= 0) return;

    const iw = loadedImage.naturalWidth || loadedImage.width;
    const ih = loadedImage.naturalHeight || loadedImage.height;
    if (iw <= 0 || ih <= 0) return;

    const scale = Math.min(width / iw, height / ih);
    const drawWidth = iw * scale;
    const drawHeight = ih * scale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + (height - drawHeight) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(loadedImage, drawX, drawY, drawWidth, drawHeight);
}

export class AACGridCanvas extends SvgPlus {
    #board = null;
    #drawToken = 0;
    constructor() {
        super("canvas");
        this.size = new Vector(297, 210);
        this.padding = 5;
        this.gap = 0.7;
        this.border = 0.7;
        this.fontSize = 3;
        this.footer = 15;
        this.side = 10;
        this.dpr = 12;
        this.style.width = "100%";
        this.style.height = "100%";
        this.style.display = "block";
    }

    async renderBoard(board, name = "Untitled Board") {
        const token = ++this.#drawToken;
        const ctx = this.getContext("2d");
        if (!ctx) return;

        const width = this.size.x * this.dpr;
        const height = this.size.y * this.dpr;

        this.width = width;
        this.height = height;

        const sx = width / this.size.x;
        const sy = height / this.size.y;
        ctx.setTransform(sx, 0, 0, sy, 0, 0);
        ctx.clearRect(0, 0, this.size.x, this.size.y);

        const locations = board.getButtonLocations();
        const rows = board.grid.rows;
        const columns = board.grid.columns;
        const gap = this.gap;

        const borderRadius = this.size.y / 20 / rows;

        const innerSize = this.size.sub(this.padding * 2 + this.side, this.padding * 2 + this.footer);
        const unitSize = innerSize.sub((columns - 1) * gap, (rows - 1) * gap).div(columns, rows);
        const props = {
            border: this.border,
            borderRadius: borderRadius,
            fontSize: this.fontSize,
        };

        const proms = []
        for (const { rowRange: [rStart, rEnd], colRange: [cStart, cEnd], buttonID } of locations) {
            if (token !== this.#drawToken) return;

            const button = board.getButtonByID(buttonID);
            if (!button) continue;

            const image = board.getImageByID(button.image_id);
            const nR = rEnd - rStart + 1;
            const nC = cEnd - cStart + 1;
            const buttonSize = unitSize.mul(nC, nR).add((nC - 1) * gap, (nR - 1) * gap);
            const origin = new Vector(
                this.padding + cStart * (unitSize.x + gap),
                this.padding + rStart * (unitSize.y + gap),
            );

            proms.push(drawBoardButton(ctx, origin, buttonSize, button, image, props));
        }
        await Promise.all(proms);

        // Add logo image at the bottom right corner
        {
            const logoImage = await loadImage(import.meta.resolve("../../Assets/Icons/logo-banner.svg"));
            if (logoImage) {
                const logoHeight = this.footer * 0.9;
                const logoWidth = (logoImage.naturalWidth / logoImage.naturalHeight) * logoHeight;
                const logoX = this.padding;
                const logoY = this.size.y - this.padding - logoHeight;
                ctx.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);
            }
        }

        let textX = 0;
        {
            const logoImage = await loadImage(import.meta.resolve("../../Assets/aac-banner.svg"));
            if (logoImage) {
                const logoHeight = this.footer * 0.9;
                const logoWidth = (logoImage.naturalWidth / logoImage.naturalHeight) * logoHeight;
                const logoX = this.padding + this.size.x * 0.4;
                const logoY = this.size.y - this.padding - logoHeight;
                textX = logoX + logoWidth + 1;
                ctx.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);
            }
        }


        {
            name = name || "Untitled Board";
            ctx.font = `bold ${this.footer * 0.35}px ${TEXT_FONT_FAMILY}`;
            ctx.fillStyle = "black";
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            const textY = this.size.y - this.padding - 0.4 * this.footer;
            ctx.fillText(name, textX, textY);
        }
        {
            // Draw squidly website in center bottom
            const websiteText = "Download: aac.squidly.com.au";
            ctx.font = `${this.footer * 0.3}px ${TEXT_FONT_FAMILY}`;
            ctx.fillStyle = "black";
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            const textY = this.size.y - this.padding;
            ctx.fillText(websiteText, textX, textY);
        }

        {
            // Draw copyright notice along the side of the board
            const copyrightText = "© 2026 Squid Eye Pty Ltd All Rights Reserved";
            ctx.save();
            ctx.translate(this.size.x - this.padding - this.side * 0.1, this.size.y - this.padding);
            ctx.rotate(-Math.PI / 2);
            ctx.font = `${this.footer * 0.2}px ${TEXT_FONT_FAMILY}`;
            ctx.fillStyle = "black";
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.fillText(copyrightText, this.size.y * 0.5, 0);
            ctx.restore();
        }
    }


    static async exportBoard(board, name = "Untitled Board", options = {}) {
        const canvas = new AACGridCanvas();
        for (const key in options) {
            canvas[key] = options[key];
        }
        await canvas.renderBoard(board, name);
        const url = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = name + ".png";
        a.click();
    }
}

