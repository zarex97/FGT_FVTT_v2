/**
 * @file The summoning circle: the system's one signature ornament.
 * @see DESIGN.md
 *
 * Drawn, not traced: concentric rings, a ticked rim, a seven-point star and a
 * triangle, from a few loops. It turns behind every portrait, rings a ready
 * Noble Phantasm and erupts on a Noble Phantasm's cut-in. Pure DOM: it writes
 * only the `<svg>` it is handed.
 */

const NS = "http://www.w3.org/2000/svg";

/**
 * @param {string} name
 * @param {Record<string, string|number>} attrs
 * @returns {SVGElement}
 */
function el(name, attrs) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * Points of a regular polygon on the circle of radius `r` about (100, 100).
 *
 * @param {number} n
 * @param {number} r
 * @returns {string[]}
 */
function ring(n, r) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI / n) - Math.PI / 2;
    return `${(100 + r * Math.cos(a)).toFixed(2)},${(100 + r * Math.sin(a)).toFixed(2)}`;
  });
}

/**
 * Draw a summoning circle into an empty 200x200 `<svg>`.
 *
 * @param {SVGSVGElement} svg
 * @param {object} [options]
 * @param {string} [options.color] any CSS colour; defaults to the gold token
 * @returns {SVGSVGElement}
 */
export function drawSummoningCircle(svg, { color = "var(--fgt-gold)" } = {}) {
  svg.setAttribute("viewBox", "0 0 200 200");
  svg.setAttribute("aria-hidden", "true");
  const g = el("g", { fill: "none", stroke: color, "stroke-width": 0.7 });
  [96, 90, 70, 44].forEach((r, i) => g.append(el("circle", { cx: 100, cy: 100, r, "stroke-width": i === 1 ? 0.4 : 0.7 })));
  for (let i = 0; i < 72; i++) {
    const a = i * 5 * Math.PI / 180;
    const r1 = i % 6 ? 92 : 87;
    g.append(el("line", {
      x1: (100 + r1 * Math.cos(a)).toFixed(2), y1: (100 + r1 * Math.sin(a)).toFixed(2),
      x2: (100 + 96 * Math.cos(a)).toFixed(2), y2: (100 + 96 * Math.sin(a)).toFixed(2),
    }));
  }
  const seven = ring(7, 70);
  g.append(el("polygon", { points: seven.map((_, i) => seven[(i * 3) % 7]).join(" ") }));
  g.append(el("polygon", { points: ring(3, 70).join(" "), "stroke-width": 0.5 }));
  for (let i = 0; i < 12; i++) {
    const a = i * 30 * Math.PI / 180;
    g.append(el("circle", { cx: (100 + 80 * Math.cos(a)).toFixed(2), cy: (100 + 80 * Math.sin(a)).toFixed(2), r: 3.2 }));
  }
  svg.replaceChildren(g);
  return svg;
}

/**
 * Draw every `svg[data-fgt-circle]` under `root` that is still empty. The
 * attribute's value, when set, is the stroke colour.
 *
 * @param {ParentNode} root
 */
export function paintCircles(root) {
  for (const svg of root.querySelectorAll("svg[data-fgt-circle]")) {
    if (svg.childElementCount) continue;
    drawSummoningCircle(svg, svg.dataset.fgtCircle ? { color: svg.dataset.fgtCircle } : {});
  }
}
