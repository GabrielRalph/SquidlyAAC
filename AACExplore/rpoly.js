import { Vector } from "../src/SvgPlus/vector.js";

/**
 * Given the points of a polygon and a maximum corner radius, 
 * returns an svg d path string representing the rounded polygon.
 * @param {Array<{x: number, y: number}>} points - The vertices of the polygon.
 * @param {number} maxRadius - The maximum radius for the rounded corners.
 * @returns {string} An SVG path data string representing the rounded polygon.
 */
function roundedPolygon(points, maxRadius) {
    const n = points.length;
    if (n < 3) return '';

    const corners = [];
    for (let i = 0; i < n; i++) {
        const prev = points[(i - 1 + n) % n];
        const curr = points[i];
        const next = points[(i + 1) % n];

        const dx1 = prev.x - curr.x, dy1 = prev.y - curr.y;
        const len1 = Math.hypot(dx1, dy1);
        const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
        const len2 = Math.hypot(dx2, dy2);

        const r = Math.min(maxRadius, len1 / 2, len2 / 2);
        // cross product sign determines which way the arc curves
        const sweep = (dx1 * dy2 - dy1 * dx2) < 0 ? 1 : 0;

        corners.push({
            before: { x: curr.x + (dx1 / len1) * r, y: curr.y + (dy1 / len1) * r },
            after:  { x: curr.x + (dx2 / len2) * r, y: curr.y + (dy2 / len2) * r },
            sweep, r,
        });
    }

    const d = [`M ${corners[0].before.x} ${corners[0].before.y}`];
    for (let i = 0; i < n; i++) {
        const { after, sweep, r } = corners[i];
        const nb = corners[(i + 1) % n].before;
        d.push(`A ${r} ${r} 0 0 ${sweep} ${after.x} ${after.y}`);
        d.push(`L ${nb.x} ${nb.y}`);
    }
    d.push('Z');
    return d.join(' ');
}

export { roundedPolygon };