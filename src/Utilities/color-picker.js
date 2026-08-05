import { SvgPlus, Vector } from "./utils.js";
import { Color } from "./color.js";

const MY_COLORS = [
  "transparent","#ffffff","#000000","#db2121","#e04117","#e5830e","#f2c60f",
    "#d4ef11","#68ea13","#15e874","#17e5e5","#0c80f4","#2111f2","#8b15e8",
    "#e315ea","#ed0f59","#ffb3b3","#ffb5a7","#ffd2a2","#fff0b6","#faffb4",
    "#dcffc5","#c4ffdc","#b9fffd","#c0e2ff","#d3d3ff","#e0beff","#ffb4ff",
    "#ffb9db","#992323","#994423","#a05c12","#9b831f","#868e23","#457f1f",
    "#318454","#3b7f7d","#386489","#343284","#591f59","#7b386c","#852e4b",
    "#444444","#888888", "#cccccc"
]
const MY_COLORS_SET = new Set(MY_COLORS);



/**
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *                      RECENT COLORS CACHE
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */
const MaxRecentColors = 18;
const MinRecentColors = 10;
let RecentColors = [];
try {
    RecentColors = JSON.parse(window.localStorage.getItem("recent-colors") || "[]");
} catch (e) {}

if (RecentColors.length < MinRecentColors) {
    RecentColors = new Array(MinRecentColors).fill(0).map((_,i) => Math.random().toString(16).substring(2, 8)).map(c => "#" + c);
}
RecentColors = RecentColors.slice(0, MaxRecentColors).filter(c => c !== "transparent" && !MY_COLORS_SET.has(c));
function addRecentColor(color) {
    if (!MY_COLORS_SET.has(color)) {
        RecentColors = RecentColors.filter(c => c !== color);
        RecentColors.unshift(color);
    }
    RecentColors = RecentColors.slice(0, MaxRecentColors);
    window.localStorage.setItem("recent-colors", JSON.stringify(RecentColors));
}

/**
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *                      SWATCH GRIDS
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

class Swatch extends SvgPlus {
    constructor(color, root) {
        super("div");
        this.class = "swatch";
        this.styles = {
            "background-color": color,
            "width": "0.8em",
            "height": "0.8em",
        };
        if (color === "transparent") {
            this.classList.add("fill-transparent");
        } 
        this.color = color;
        this.events = {click: () => root.selectColor(color)};
    }
}

class SwatchGrid extends SvgPlus {
    constructor(colors, root) {
        super("div");
        this.class = "swatch-grid";
        this.styles = {
            display: "grid",
            "grid-template-columns": "repeat(9, 1fr)",
        };
        colors.forEach(c => this.createChild(Swatch, {}, c, root));
    }

    set color(c) {
        c = c instanceof Color ? c.toHex() : c;
        for (const swatch of this.children) {
            swatch.toggleAttribute("selected", swatch.color === c);
        }
    }
}

/**
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *                      COLOR SAMPLER
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

function colorSampleCursor(color, isCursor = true) {
    color = color instanceof Color ? color.toHex() : color;
    color = color.replace("#", "%23");
    const aspect = .7513;
    let str = `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" height="30" viewBox="0 0 75.13 100"><path d="M7.441,60.009C2.567,53.469,0,45.715,0,37.565,0,16.852,16.852,0,37.565,0s37.565,16.852,37.565,37.565c0,8.149-2.566,15.902-7.422,22.42l-1.593,2.14h-.02c-4.42,5.866-28.53,37.874-28.53,37.874L7.441,60.009Z" fill="%23fff"/><path d="M11.685,56.812l25.881,34.357s25.881-34.357,25.882-34.356c4.002-5.372,6.37-12.033,6.37-19.247,0-17.812-14.44-32.252-32.252-32.252S5.313,19.753,5.313,37.565c0,7.214,2.368,13.875,6.371,19.246Z"/><path d="M37.565,62.378c-13.682,0-24.813-11.131-24.813-24.813s11.131-24.813,24.813-24.813,24.813,11.131,24.813,24.813-11.131,24.813-24.813,24.813Z" fill="${color}"/></svg>')`
    if (isCursor) {
        str += "11.5 30, auto"
    } 
    return str;
}

class HueSlider extends SvgPlus {
    constructor(height = 30) {
        super("div");
        this.class = "hue-slider";
        this.styles = {
            position: "relative",
            display: "flex",
        }

        this.createChild("canvas", {
            width: 360, 
            height: height,
        });

        const ctx = this.querySelector("canvas").getContext("2d");
        for (let x = 0; x < 360; x++) {
            const color = new Color(`hsl(${x}, 100%, 50%)`);
            ctx.fillStyle = color.toHex();
            ctx.fillRect(x, 0, 1, height);
        }

        this.input = this.createChild("input", {
            type: "range", min: 0, max: 360, value: 0,
            styles: {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                margin: 0,
            }
        })
    }

    get value() {
        return parseInt(this.input.value);
    }
}

class ColorSampler extends SvgPlus {
    #marker = null;
    #color = new Color("#ffffff");
    #hoverColor = new Color("#ffffff");
    #renderFlag = false;
    #hueToRender = 0;

    #width = 140;
    #height = 100;

    constructor(root) {
        super("div");
        this.class = "color-sampler";
   

        const relWrap = this.createChild("div", {
            class: "color-sampler-wrap",
            styles: {
                position: "relative",
                display: "flex",
            }
        });

        this.SLPicker = relWrap.createChild("canvas", {
            width: this.#width, 
            height: this.#height,
            events: {
                mousemove: (e) => {
                    const p = new Vector(e.clientX, e.clientY);
                    const [pos, size] = this.SLPicker.bbox;
                    const np = p.sub(pos).div(size).mul(this.#width, this.#height);
                    const color = this.getColorAt(np);
                    const cursor = colorSampleCursor(color.toHex(), true);
                    this.SLPicker.styles = { cursor: cursor }
                    this.#hoverColor = color;
                },

                click: (e) => {
                    const p = new Vector(e.clientX, e.clientY);
                    const [pos, size] = this.SLPicker.bbox;
                    const np = p.sub(pos);
                    const rel = np.div(size).mul(this.#width, this.#height);
                    const color = this.getColorAt(rel);
                    this.#addMarker(np, rel, color);
                    this.#color = color;
                    this.valueInput.value = color.toHex();
                    this.dispatchEvent(new CustomEvent("change", {detail: {color: color}}));
                }
            }
        });

        this.ctx = this.SLPicker.getContext("2d", {willReadFrequently: true});
        this.hueSlider = this.createChild(HueSlider, {
            events: {
                input: (e) => {
                    const hue = this.hueSlider.value;
                    this.#render(hue);
                }
            }
        }, 40);
        this.relWrap = relWrap;

        const row = this.createChild("div", {class: "inputs"})
        this.valueInput = row.createChild("input", {
            type: "text",
            events: {
                change: (e) => {
                    const color = new Color(e.target.value);
                    if (color.valid) {
                        if (color.a !== 1) {
                            color.a = 1;
                        }
                        this.color = color;
                    }
                }
            }
        })

        if (window.EyeDropper) {
            row.createChild("div", {
                class: "btn",
                events: {
                    click: async () => {
                        try {
                            const eyeDropper = new EyeDropper();
                            const result = await eyeDropper.open();
                            this.color = new Color(result.sRGBHex);
                        } catch (e) {
                            console.error("EyeDropper failed:", e);
                        }
                    }
                }
            }).createChild("i-bw", {"e-eyedrop": true})
        }
        this.#render(0);
    }

    getColorAt(point) {
        const pixel = this.ctx.getImageData(point.x, point.y, 1, 1).data;
        return new Color(pixel[0], pixel[1], pixel[2], pixel[3] / 255);
    }

    #addMarker(absPoint, relPoint, color) {
        if (this.#marker) {
            this.#marker.remove();
        } 

        this.#marker = this.relWrap.createChild("div", {
            class: "color-sampler-marker",
            styles: {
                "background-image": colorSampleCursor(color.toHex(), false),
                position: "absolute",
                width: "30px",
                height: "30px",
                top: absPoint.y + "px", 
                left: absPoint.x + "px",
                transform: "translate(-50%, -100%)",
                "background-size": "contain",
                "background-position": "center",
                "background-repeat": "no-repeat",
                "pointer-events": "none",
                "z-index": 1000,
            }
        });
        this.#marker.relPoint = relPoint;
    }

    #removeMarker() {
        if (this.#marker) {
            this.#marker.remove();
            this.#marker = null;
        }
    }

    #renderHue() {
        // Render the saturation-lightness picker based on the current hue
        const hueColor = new Color(`hsl(${this.#hueToRender}, 100%, 50%)`);
        const white = new Color("#ffffff");
        const black = new Color("#000000");
        const {ctx} = this;
        for (let x = 0; x < this.#width; x++) {
            let tx = 1 - x / (this.#width - 1);
            for (let y = 0; y < this.#height; y++) {
                let ty = 1 - y / (this.#height-1);
                const r = (hueColor.r + (white.r - hueColor.r) * tx) * ty;
                const g = (hueColor.g + (white.g - hueColor.g) * tx) * ty;
                const b = (hueColor.b + (white.b - hueColor.b) * tx) * ty;
                ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }

        // Update the marker color if it exists
        if (this.#marker) {
            const {relPoint} = this.#marker;
            this.#color = this.getColorAt(relPoint);
            this.valueInput.value = this.#color.toHex();
            this.#marker.styles = {
                "background-image": colorSampleCursor(this.#color, false),
            }

            this.dispatchEvent(new CustomEvent("change", {detail: {color: this.#color}}));
        }
    }

    /**
     * Renders the saturation-lightness picker
     * based on the given hue value. 
     * The rendering is done in an animation frame to optimize 
     * performance and avoid unnecessary re-renders.
     * @param {number} hue 
     */
    #render(hue, triggerChange = true) {
        this.#hueToRender = Math.round(Math.max(0, Math.min(360, hue)))
        if (!this.#renderFlag) {
            this.#renderFlag = true;
            window.requestAnimationFrame(() => {
                this.#renderFlag = false;
                this.#renderHue();
            });
        }
    }

    reverseColour(c) {
        c = c instanceof Color ? c : new Color(c);
        let t1 = 0;
        let t2 = 1;
        let hue = 0;
        if (c.valid) {
            if (c.r === c.g && c.g === c.b) {
                t1 = c.r / 255;
                t2 = 1;
                hue = 0;
            } else {
                hue = c.h;
                const ch = new Color(`hsl(${Math.round(hue)}, 100%, 50%)`);
                const phi = (s) => {
                    return (c[s[1]] * ch[s[0]] - c[s[0]] * ch[s[1]]) / (c[s[0]] * (255 - ch[s[1]]) - c[s[1]] * (255 - ch[s[0]]));
                }
                t2 = [phi("rg"), phi("gb"), phi("br")].find(t => t >= 0 && t <= 1);
                t1 = c.r / (ch.r  + t2 * (255 - ch.r));
            }
        }
        return [hue, t1, t2];
    }

    get color() {
        if (this.#marker) {
            return this.#color;
        } else {
            return this.#hoverColor;
        }
    }

    set color(c) {
        c = c instanceof Color ? c : new Color(c);
        if (c.valid) {
            this.#removeMarker();

            const [hue, t1, t2] = this.reverseColour(c);
            this.#render(hue);
            // console.log("Setting color:", c.toHex(), "Hue:", hue, "t1:", t1, "t2:", t2);

            const [pos, size] = this.SLPicker.bbox;

            const relPoint = new Vector((1-t2) * (this.#width-1), (1-t1) * (this.#height-1));
            this.#addMarker(size.mul(1-t2, 1-t1), relPoint, c);

            this.#color = c;
            this.valueInput.value = c.toHex();
        } else {
            this.valueInput.value = "";
        }
    }
}

/**
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *                      COLOR PICKER ROOT 
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */
class ColorPicker extends SvgPlus {
    #customMode = false;

    constructor(onSelect) {
        super("color-picker");

        const mainMethods = this.createChild("div", {class: "main"});
        const smain = mainMethods.createChild("div", {class: "swatches"});
        if (RecentColors.length > 0) {
            smain.createChild("div", {class: "label", innerHTML: "Recent Colors"});
            this.recentSwatches = smain.createChild(SwatchGrid, {}, RecentColors, this);
            smain.createChild("div", {class: "h-separator"});
        }
        smain.createChild("div", {class: "label", innerHTML: "Swatch Colors"});
        this.mainSwatches = smain.createChild(SwatchGrid, {}, MY_COLORS, this);
        
        const bRow = this.createChild("div", {class: "buttons-row"});
        this.openPicker = bRow.createChild("div", {
            class: "btn", innerHTML: "Custom",
            events: {
                click: () => {
                    if (this.customMode) {
                        const color = this.sampler.color;
                        if (color.valid) {
                            this.selectColor(this.sampler.color.toHex());
                        } else {
                            this.selectColor(undefined);
                        }
                    } else {
                        this.customMode = true;
                    }
                }
            }
        });
        this.defaultButton = bRow.createChild("div", {
            class: "btn", 
            innerHTML: "Default",
            events: {
                click: () => {
                    this.selectColor(this.customMode ? undefined : null);
                }
            }
        });
        bRow.createChild("div")

        this.sampler = mainMethods.createChild(ColorSampler, {}, this);
       
        this.onSelect = onSelect;
    }

    set customMode(value) {
        this.#customMode = value;
        this.toggleAttribute("sampler", value)
        this.openPicker.innerHTML = "Ok"
        this.defaultButton.innerHTML = "Cancel"
    }
    get customMode() {
        return this.#customMode
    }

    set color(c) {
        c = (c instanceof Color ? c : new Color(c)).toHex();
        this.sampler.color = c;
        if (this.recentSwatches) {
            this.recentSwatches.color = c;
        }
        this.mainSwatches.color = c;
    }

    set value(c) {
        this.color = c;
    }


    destroy() {
        this.selectColor(undefined);
        this.styles = {
            opacity: 0,
            transition: "opacity 0.2s ease-in-out",
        };
        setTimeout(() => {
            this.remove();
        }, 200);

    }

    select(value) {
        this.selectColor(value);
    }

    selectColor(color) {
        if (color !== undefined && color !== null) {
            addRecentColor(color);
        }
        if (this.onSelect instanceof Function) {
            this.onSelect(color);
        }
        this.dispatchEvent(new CustomEvent("color-select", {detail: {color}}));
    }
}
export {ColorPicker}