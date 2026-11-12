import { SvgPlus } from "../../SvgPlus/4.js";

const HAS_SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function";
const WORD_SEGMENTER = HAS_SEGMENTER ? new Intl.Segmenter(undefined, { granularity: "word" }) : null;
const GRAPHEME_SEGMENTER = HAS_SEGMENTER ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/**
 * Scripts that browsers may break between any two characters
 * (CSS `word-break: normal`), i.e. no spaces are needed to wrap.
 */
const BREAK_ANYWHERE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/**
 * Characters that may not start a line (Japanese kinsoku + closing punctuation).
 * These are kept on the same line as the character before them.
 */
const NO_BREAK_BEFORE = new Set([
    ..."ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ",
    ..."ー〜～ゝゞヽヾ々〻",
    ..."、。，．・：；？！‼⁇⁈⁉）〕］｝〉》」』】〙〗〟’”｠»",
    ...",.!?:;)]}%"
]);

/**
 * Characters that may not end a line (opening brackets).
 * These are kept on the same line as the character after them.
 */
const NO_BREAK_AFTER = new Set([..."（〔［｛〈《「『【〘〖〝‘“｟«([{"]);

/**
 * Splits a string into grapheme clusters (what a user sees as one character),
 * so that emoji and combining marks are never split apart.
 * @param {string} str
 * @returns {{segment: string, index: number}[]}
 */
function graphemes(str) {
    if (GRAPHEME_SEGMENTER) {
        return [...GRAPHEME_SEGMENTER.segment(str)];
    }
    const res = [];
    let index = 0;
    for (const segment of str) {
        res.push({ segment, index });
        index += segment.length;
    }
    return res;
}

/**
 * Splits text into segments using Intl.Segmenter (word granularity),
 * falling back to a whitespace split if it is unavailable.
 * @param {string} text
 * @returns {{segment: string, index: number}[]}
 */
function wordSegments(text) {
    if (WORD_SEGMENTER) {
        return [...WORD_SEGMENTER.segment(text)];
    }
    return [...text.matchAll(/\s+|\S+/g)].map(m => ({ segment: m[0], index: m.index }));
}

/**
 * Breaks a single line of text (no "\n") into units that cannot be split
 * by the browser's line breaking (unless a unit is wider than the whole line).
 * A line break is allowed between any two units.
 *
 * - Whitespace runs become their own "space" units (these hang at the end of a line).
 * - Text in scripts like Japanese/Chinese/Korean is broken per character, as the
 *   browser does, while respecting the kinsoku rules above.
 * - Other text (e.g. English) is only broken at whitespace.
 * - Scripts without spaces such as Thai are broken at the word boundaries
 *   found by Intl.Segmenter.
 *
 * @param {string} text
 * @returns {{start: number, end: number, space: boolean, anywhere: boolean}[]}
 */
function getBreakUnits(text) {
    const units = [];

    const add = (str, start, anywhere) => {
        const end = start + str.length;
        const prev = units[units.length - 1];
        const canMerge = prev && !prev.space;
        const mustJoin = canMerge && (
            NO_BREAK_BEFORE.has(str[0]) ||
            NO_BREAK_AFTER.has(text[prev.end - 1]) ||
            (!prev.anywhere && !anywhere)  // e.g. "hello" + "," or "don" + "'t"
        );
        if (mustJoin) {
            prev.end = end;
            prev.anywhere = anywhere;
        } else {
            units.push({ start, end, space: false, anywhere });
        }
    };

    for (const { segment, index } of wordSegments(text)) {
        if (/^\s+$/.test(segment)) {
            units.push({ start: index, end: index + segment.length, space: true, anywhere: false });
        } else if (BREAK_ANYWHERE.test(segment)) {
            for (const g of graphemes(segment)) {
                add(g.segment, index + g.index, BREAK_ANYWHERE.test(g.segment));
            }
        } else if (WORD_SEGMENTER && isDictionaryScript(segment)) {
            // Thai, Lao, Khmer, Myanmar: break at the word boundaries the segmenter gives.
            add(segment, index, true);
        } else {
            add(segment, index, false);
        }
    }

    return units;
}

/**
 * Scripts that do not use spaces and are broken by the browser using a dictionary.
 * @param {string} str
 */
function isDictionaryScript(str) {
    return /[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u.test(str);
}

/**
 * Wraps a single line of text (no "\n") the same way a textarea does,
 * returning the start and end index of every wrapped line.
 *
 * Whitespace at a wrap point stays at the end of the line (it "hangs" past the
 * edge, as in the browser), so the lines are contiguous: each line's end is the
 * next line's start, and no characters are dropped.
 *
 * @param {string} text the text to wrap (must not contain "\n")
 * @param {number} maxWidth the maximum width of a line
 * @param {CanvasRenderingContext2D} ctx the canvas context used to measure text width
 * @returns {{start: number, end: number}[]}
 */
function wrapTextRanges(text, maxWidth, ctx) {
    const measure = (start, end) => ctx.measureText(text.slice(start, end).trimEnd()).width;

    if (measure(0, text.length) <= maxWidth) {
        return [{ start: 0, end: text.length }];
    }

    const lines = [];
    let lineStart = 0;

    for (const unit of getBreakUnits(text)) {
        // Spaces never cause a wrap, they hang at the end of the line.
        if (unit.space || measure(lineStart, unit.end) <= maxWidth) continue;

        // Wrap before this unit.
        if (unit.start > lineStart) {
            lines.push({ start: lineStart, end: unit.start });
            lineStart = unit.start;
            if (measure(lineStart, unit.end) <= maxWidth) continue;
        }

        // The unit alone is wider than a line (e.g. a very long word),
        // so split it between characters.
        for (const g of graphemes(text.slice(unit.start, unit.end))) {
            const gStart = unit.start + g.index;
            const gEnd = gStart + g.segment.length;
            if (gStart > lineStart && measure(lineStart, gEnd) > maxWidth) {
                lines.push({ start: lineStart, end: gStart });
                lineStart = gStart;
            }
        }
    }

    lines.push({ start: lineStart, end: text.length });
    return lines;
}

/**
 * Wraps text into multiple lines, following the same
 * wrapping algorithm as a textarea (see wrapTextRanges).
 *
 * @param {string} text the text to wrap (must not contain "\n")
 * @param {number} maxWidth the maximum width of a line
 * @param {CanvasRenderingContext2D} ctx the canvas context used to measure text width
 * @returns {string[]} an array of lines that fit within the max width
 */
function wrapText(text, maxWidth, ctx) {
    return wrapTextRanges(text, maxWidth, ctx).map(({ start, end }) => text.slice(start, end).trimEnd());
}


class AccessTextarea extends SvgPlus {
    #tempCaret = 0;
    scrollToCaretOnUpdate = true;
    constructor() {
        super("access-textarea");
        this.canvas = new SvgPlus("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.textArea = this.createChild("textarea", {
            events: {
                "keyup": (e) => {
                    const caretPosition = this.textArea.selectionStart;
                    this.updateCaretPosition(this.textArea.value.substring(0, caretPosition));
                },
                "keydown": (e) => {                    
                    const caretPosition = this.textArea.selectionStart;
                    this.updateCaretPosition(this.textArea.value.substring(0, caretPosition));
                },
                "mousedown": (e) => {
                    const caretPosition = this.textArea.selectionStart;
                    this.updateCaretPosition(this.textArea.value.substring(0, caretPosition));
                },
                "mouseup": (e) => {                    
                    const caretPosition = this.textArea.selectionStart;
                    this.updateCaretPosition(this.textArea.value.substring(0, caretPosition));
                },
                "input": (e) => {
                    const caretPosition = this.textArea.selectionStart;
                    this.updateCaretPosition(this.textArea.value.substring(0, caretPosition));
                    this.dispatchEvent(new InputEvent("input"));
                },
                "focus": (e) => {
                    this._focused = true;
                },
                "blur": (e) => {
                    this.#tempCaret = this.textArea.selectionStart;
                    this._focused = false;
                },
                "scroll": (e) => {
                    this.updateCaretPosition(true);
                }
            }
        });
        
        this.disableActiveEffect = true;
        this.disableHoverEffect = true;
        this.resizeObserver = new ResizeObserver(() => {
            this.updateCaretPosition(true);
        });
        this.resizeObserver.observe(this.textArea);
    }

    /**
     * Scrolls the text area to the caret position, ensuring that the caret is visible.
     */
    scrollToCaret() {
        let cY = this._lastCaretY;
        let scrollTop = this.textArea.scrollTop;
        let scrollBottom = scrollTop + this.textArea.clientHeight;
        if (cY < scrollTop) {
            this.textArea.scrollTop = cY - this._lastFontSize * 0.8;
        } else if (cY > scrollBottom) {
            this.textArea.scrollTop = cY - this.textArea.clientHeight + this._lastFontSize * 0.8;
        }
        this.styles = {
          "--caret-y": (cY - this.textArea.scrollTop) + "px",
        };
    }

    /**
     * Clears the text area and resets the caret position to 0.
     * @param {boolean} preventEvent if true, prevents an "input" event.
     */
    clear(preventEvent = false) {
        this.textArea.value = "";
        this.caret = 0;
        if (!preventEvent) this.dispatchEvent(new InputEvent("input"));
    }

    /**
     * Inserts a newline character at the caret position.
     */
    enter() {
        this.insert("\n");
    }

    /**
     * Removes one character before the caret position, 
     * or if there is a selection, removes the selected text.
     * @param {boolean} preventEvent if true, prevents an "input" event.
     */
    backspace(preventEvent = false) {
        const start = this.caret;
        const end = this._focused ? this.textArea.selectionEnd : start;
        if (start === 0 && end === 0) return;
        const value = this.textArea.value;
        if (start === end) {
            this.textArea.value = value.substring(0, start - 1) + value.substring(end);
            this.caret = start - 1;
        } else {
            this.textArea.value = value.substring(0, start) + value.substring(end);
            this.caret = start;
        }

        if (!preventEvent) this.dispatchEvent(new InputEvent("input"));
    }

    /**
     * Deletes the word immediately before the caret position.
     */
    deleteWord(preventEvent = false) {
        let {valueUpToCaret, value} = this;

        let wordStartIndex = valueUpToCaret.trimEnd().lastIndexOf(" ") + 1;

        let wordEndIndex = value.slice(wordStartIndex).indexOf(" ") + 1 + wordStartIndex;
        if (wordEndIndex <= wordStartIndex) wordEndIndex = value.length;

        this.textArea.value = value.slice(0, wordStartIndex) + value.slice(wordEndIndex);
        this.caret = wordStartIndex;

        if (!preventEvent) this.dispatchEvent(new InputEvent("input"));
    }

    /**
     * Inserts text at the caret position, replacing any selected text.
     * @param {string} text the text to insert
     * @param {boolean} preventEvent if true, prevents an "input" event.
     */
    insert(text, preventEvent = false) {
        const {valueUpToCaret, valueAfterCaret} = this;
        this.textArea.value = valueUpToCaret + text + valueAfterCaret;
        this.caret = valueUpToCaret.length + text.length;

        if (!preventEvent) this.dispatchEvent(new InputEvent("input"));
    }

    /**
     * Inserts a suggested word at the caret position, replacing the current word fragment.
     * For example, if the text area contains "I am go" and the caret is at the end, 
     * calling insertSuggestedWord("going") will replace "go" with "going", resulting in "I am going ".
     * @param {string} word the suggested word to insert
     * @param {boolean} preventEvent if true, prevents an "input" event.
     */
    insertSuggestedWord(word, preventEvent = false) {
        const {valueUpToCaret, valueAfterCaret} = this;

        // Check if the character before the caret is a space
        const isLastCharSpaceBeforeCaret = valueUpToCaret[valueUpToCaret.length - 1] == " ";
        
        // find last space from end of valueUpToCaret
        const lastSpaceIndex = valueUpToCaret.lastIndexOf(" ");

        // If the word starts with an apostrophe, like 're, then we want to join it
        // to the previous word without a space, e.g. "you're" instead of "you 're".
        // As such we will index either after or at the index of the last space 
        // depending on whether the suggested word starts with an apostrophe.
        const startOfCurrentWord = lastSpaceIndex + (word[0] === "'" ? 0 : 1);

        // The new value up to the caret will be the text up to the index calculated above,
        // plus the suggested word.
        const newValueUpToCaret = valueUpToCaret.substring(0, startOfCurrentWord) + word;

        // Case 1: If the user is adding a suggestion after a space but directly before 
        //         some more text without a space, e.g. adding "you" to "are |going"
        //         where | is the caret, then we want to add the a space and then the 
        //         value after.
        // Case 2: "you" -> "are | going", we want to avoid addin an extra space.
        // Case 3: The user is adding a suggestion in the middle of a word,
        //         e.g. "gone" -> "are go|ing", we want to remove the fragment of the word after
        //         the caret and replace it with the suggested word.
        // 

        const nextSpace = valueAfterCaret.indexOf(" ");
        // const valueAfterPreSpace = nextSpace === -1 ? "" : valueAfterCaret.substring(0, nextSpace);
        const valueAfterPostSpace = nextSpace === -1 ? valueAfterCaret : valueAfterCaret.substring(nextSpace);
        const newValueAfter = isLastCharSpaceBeforeCaret ?
                (valueAfterCaret[0] == " " ? "" : " ") + valueAfterCaret // Case 1,2
                : (valueAfterPostSpace[0] == " " ? "" : " ") + valueAfterPostSpace; // Case 3
        



        this.textArea.value = newValueUpToCaret + newValueAfter;
        this.caret = newValueUpToCaret.length + 1;

        if (preventEvent) this.dispatchEvent(new InputEvent("input"));
    }

    /**
     * Moves the caret by a given number of characters. Positive values move the caret to the right,
     * while negative values move it to the left.
     * @param {number} dir the number of characters to move the caret
     */
    moveCaret(dir) {
        this.caret = Math.max(0, Math.min(this.textArea.value.length, this.caret + dir));
    }

    /**
     * Moves the caret vertically by a given number of lines. Positive values move the caret down,
     * while negative values move it up. The caret's horizontal position is preserved as much as possible.
     * @param {number} dir the number of lines to move the caret
     */
    moveCaretVertically(dir) {
        let xPos = this._lastSubString.length;
        let yPos = this._lastLineCount - 1;
        let newYPos = Math.max(0, Math.min(this._wrapedLines.length - 1, yPos + dir));
        let newLine = this._wrapedLines[newYPos];
        // On a soft wrapped line the end index is also the start of the next line,
        // so the furthest the caret can go while staying on this line is end - 1.
        let maxX = newLine.end - newLine.start - (newLine.soft ? 1 : 0);
        let newXPos = Math.max(0, Math.min(maxX, xPos));
        this.caret = newLine.start + newXPos;
    }

    /**
     * Gets or sets the caret position in the text area. 
     * @return {number} caret position
     */
    get caret() {
        if (this._focused) {
            return this.textArea.selectionStart;
        } else {
            return this.#tempCaret;
        }
    }

    /**
     * Sets the caret position in the text area. 
     * @param {number} value the new caret position
     */
    set caret(value) {
        this.#tempCaret = value;
        if (this._focused) {
            this.textArea.setSelectionRange(value, value);
        }
        this.updateCaretPosition();
    }


    /**
     * Gets or sets the value of the text area. 
     * Setting the value will also reset the caret position to 0.
     * @param {string} val the new value of the text area
     */
    set value(val) {
        this.textArea.value = val;
        this.caret = val.length;
    }

    /**
     * Gets the value of the text area.
     * @return {string} the value of the text area
     */
    get value() {
        return this.textArea.value;
    }

    /**
     * Gets the text up to the caret position. 
     * @returns {string} the text up to the caret position
     */
    get valueUpToCaret() {
        return this.value.substring(0, this.caret) || "";
    }

    /**
     * Gets the text following caret position. 
     * @returns {string} the text up to the caret position
     */
    get valueAfterCaret() {
        const end = this._focused ? this.textArea.selectionEnd : this.caret;
        return this.value.substring(end) || "";
    }


    /**
     * Updates the position of the caret in the text area. 
     * This should be called whenever the text or caret position changes.
     * @param {boolean} force if true, forces the caret position to update even 
     *                        if the text and caret position have not changed. 
     *                        This can be useful when the text area is 
     *                        scrolled or resized.
     */
    async updateCaretPosition(force = false) {
        const text = this.textArea.value;
        let compStyles = null;
        if (text !== this._lastText || force) {
            compStyles = getComputedStyle(this.textArea);
            const font = compStyles.font;
            this.ctx.font = font;
            const maxWidth = this.textArea.clientWidth;

            // Wrap each paragraph, converting the ranges to indices in the full text.
            // Lines are stored as {start, end, soft} where soft is true if the line
            // was wrapped (i.e. not ended by a "\n" or the end of the text).
            const wrappedLines = [];
            let offset = 0;
            for (const paragraph of text.split("\n")) {
                const ranges = wrapTextRanges(paragraph, maxWidth, this.ctx);
                ranges.forEach(({start, end}, i) => wrappedLines.push({
                    start: offset + start,
                    end: offset + end,
                    soft: i < ranges.length - 1,
                }));
                offset += paragraph.length + 1;
            }
            this._wrapedLines = wrappedLines;
            this._lastText = text;
        }

        let caret = this.caret;

        if (caret !== this._lastCaret) {
            this.dispatchEvent(new CustomEvent("caretchange", {bubbles: true}));
        }
        this._lastCaret = caret;

        // The caret is on the last line that starts at or before it. When the caret
        // sits exactly on a soft wrap, this puts it at the start of the next line,
        // matching the browser.
        let lineIndex = 0;
        while (lineIndex + 1 < this._wrapedLines.length && this._wrapedLines[lineIndex + 1].start <= caret) {
            lineIndex++;
        }
        const caretLine = this._wrapedLines[lineIndex];
        const lineCount = lineIndex + 1;
        const subString = text.slice(caretLine.start, Math.min(caret, caretLine.end));


        if (subString !== this._lastSubString || force) {
            let x = 0;
            if (subString !== "") {
                const res = this.ctx.measureText(subString);
                // Trailing spaces hang past the edge of the line, keep the caret inside.
                x = Math.min(res.width, this.textArea.clientWidth);
            }
            this.styles = {
                "--caret-x": x + "px",
            };
            this._lastCaretX = x;
        }
        this._lastSubString = subString;


        if (lineCount !== this._lastLineCount || force) {
            if (!compStyles) {
                compStyles = getComputedStyle(this.textArea);
            }
            this._lastFontSize = parseFloat(compStyles.fontSize);
            let y = (lineCount - 0.4) * this._lastFontSize * 1.5;
            this.styles = {
                "--caret-y": (y - this.textArea.scrollTop) + "px",
            };
            this._lastCaretY = y;
        }
        this._lastLineCount = lineCount;

        if (this.scrollToCaretOnUpdate) {
            this.scrollToCaret();
        }
    }


    static get usedStyleSheets() {
        return [
            import.meta.resolve("./textarea.css")
        ]
    }
}


export { AccessTextarea, wrapText, wrapTextRanges };
