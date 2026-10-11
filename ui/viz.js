// Small SVG chart kit with hover tooltips (used by Compare and Trade-offs).
// Series colours come from CSS custom properties (--series-a, --series-b) so they stay in one place.

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── Tooltip (one per page) ─────────────────────────────────────────
let tipEl = null;
export function showTip(html, clientX, clientY) {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'viz-tip';
    tipEl.setAttribute('role', 'status');
    document.body.appendChild(tipEl);
  }
  tipEl.innerHTML = html;
  tipEl.style.display = 'block';
  const r = tipEl.getBoundingClientRect();
  let x = clientX + 14, y = clientY + 14;
  if (x + r.width > window.innerWidth - 8) x = clientX - r.width - 14;
  if (y + r.height > window.innerHeight - 8) y = clientY - r.height - 14;
  tipEl.style.left = Math.max(8, x) + 'px';
  tipEl.style.top = Math.max(8, y) + 'px';
}
export function hideTip() { if (tipEl) tipEl.style.display = 'none'; }

// ── Scales & ticks ─────────────────────────────────────────────────
function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return { lo, hi, ticks };
}

function frame(container, { width = 560, height = 260, pad = { t: 34, r: 72, b: 40, l: 64 }, title }) {
  container.innerHTML = '';
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: 'viz-svg', role: 'img' }, container);
  if (title) {
    el('title', {}, svg).textContent = title;
    const t = el('text', { x: pad.l, y: 18, class: 'viz-title' }, svg);
    t.textContent = title;
  }
  return { svg, width, height, pad, w: width - pad.l - pad.r, h: height - pad.t - pad.b };
}

function yAxis(f, ticks, y, fmt) {
  for (const v of ticks) {
    el('line', { x1: f.pad.l, x2: f.pad.l + f.w, y1: y(v), y2: y(v), class: 'viz-grid' }, f.svg);
    const t = el('text', { x: f.pad.l - 8, y: y(v) + 4, class: 'viz-tick', 'text-anchor': 'end' }, f.svg);
    t.textContent = fmt(v);
  }
}

// ── Line chart: several series over days, crosshair tooltip ───────
/**
 * series: [{ key, label, values: number[], color: 'var(--series-a)' }]
 */
export function lineChart(container, { title, series, fmt = v => v.toFixed(0), yMin, yMax, zeroLine = false, markers = [] }) {
  const f = frame(container, { title });
  const n = Math.max(...series.map(s => s.values.length));
  const all = series.flatMap(s => s.values).filter(Number.isFinite);
  const { lo, hi, ticks } = niceTicks(yMin ?? Math.min(...all), yMax ?? Math.max(...all));
  const x = i => f.pad.l + (i / (n - 1)) * f.w;
  const y = v => f.pad.t + f.h - ((v - lo) / (hi - lo)) * f.h;

  yAxis(f, ticks, y, fmt);
  const xt = Math.min(6, n - 1);
  for (let i = 0; i <= xt; i++) {
    const d = Math.round(i / xt * (n - 1));
    const t = el('text', { x: x(d), y: f.pad.t + f.h + 18, class: 'viz-tick', 'text-anchor': 'middle' }, f.svg);
    t.textContent = 'd' + d;
  }
  if (zeroLine && lo < 0 && hi > 0) el('line', { x1: f.pad.l, x2: f.pad.l + f.w, y1: y(0), y2: y(0), class: 'viz-zero' }, f.svg);
  for (const m of markers) {
    el('line', { x1: x(m.day), x2: x(m.day), y1: f.pad.t, y2: f.pad.t + f.h, class: 'viz-marker' }, f.svg);
  }

  for (const s of series) {
    const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    el('path', { d, class: 'viz-line', style: `stroke:${s.color}` }, f.svg);
  }
  // direct end labels (≤ 4 series), nudged apart so they don't collide
  const ends = series.map(s => ({ s, y: y(s.values[s.values.length - 1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  for (const { s, y: ly } of ends) {
    el('circle', { cx: x(s.values.length - 1), cy: y(s.values[s.values.length - 1]), r: 3.5, style: `fill:${s.color}`, class: 'viz-end' }, f.svg);
    const t = el('text', { x: f.pad.l + f.w + 8, y: ly + 4, class: 'viz-direct' }, f.svg);
    t.textContent = s.label;
  }

  // crosshair + tooltip
  const cross = el('line', { y1: f.pad.t, y2: f.pad.t + f.h, class: 'viz-cross', visibility: 'hidden' }, f.svg);
  const dots = series.map(s => el('circle', { r: 4, class: 'viz-hover-dot', style: `fill:${s.color}`, visibility: 'hidden' }, f.svg));
  const hit = el('rect', { x: f.pad.l, y: f.pad.t, width: f.w, height: f.h, class: 'viz-hit' }, f.svg);
  const move = ev => {
    const pt = f.svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(f.svg.getScreenCTM().inverse());
    const i = Math.max(0, Math.min(n - 1, Math.round((p.x - f.pad.l) / f.w * (n - 1))));
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    series.forEach((s, k) => { dots[k].setAttribute('cx', x(i)); dots[k].setAttribute('cy', y(s.values[i])); dots[k].setAttribute('visibility', 'visible'); });
    showTip(`<div class="tip-head">Day ${i}</div>` + series.map(s =>
      `<div class="tip-row"><span class="tip-swatch" style="background:${s.color}"></span>${esc(s.label)}<b>${fmt(s.values[i])}</b></div>`).join(''),
      ev.clientX, ev.clientY);
  };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')); hideTip(); });
  return f.svg;
}

// ── Scatter: trade-off map with optional frontier line ─────────────
/**
 * points: [{ x, y, label, cls, r, showLabel, tip (html), onClick }]
 * frontier: points (subset) to connect with a dashed line, sorted by x
 */
export function scatterChart(container, { title, points, frontier = [], xLabel, yLabel, fmtX, fmtY, width = 760, height = 440 }) {
  const f = frame(container, { title, width, height, pad: { t: 34, r: 24, b: 54, l: 76 } });
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const spanX = (Math.max(...xs) - Math.min(...xs)) || 1, spanY = (Math.max(...ys) - Math.min(...ys)) || 1;
  const X = niceTicks(Math.min(...xs) - spanX * 0.06, Math.max(...xs) + spanX * 0.06, 6);
  const Y = niceTicks(Math.min(...ys) - spanY * 0.08, Math.max(...ys) + spanY * 0.08, 5);
  const x = v => f.pad.l + ((v - X.lo) / (X.hi - X.lo)) * f.w;
  const y = v => f.pad.t + f.h - ((v - Y.lo) / (Y.hi - Y.lo)) * f.h;

  yAxis(f, Y.ticks, y, fmtY);
  for (const v of X.ticks) {
    el('line', { x1: x(v), x2: x(v), y1: f.pad.t, y2: f.pad.t + f.h, class: 'viz-grid' }, f.svg);
    const t = el('text', { x: x(v), y: f.pad.t + f.h + 18, class: 'viz-tick', 'text-anchor': 'middle' }, f.svg);
    t.textContent = fmtX(v);
  }
  const xl = el('text', { x: f.pad.l + f.w / 2, y: height - 10, class: 'viz-axis-label', 'text-anchor': 'middle' }, f.svg);
  xl.textContent = xLabel;
  const yl = el('text', { x: 16, y: f.pad.t + f.h / 2, class: 'viz-axis-label', 'text-anchor': 'middle', transform: `rotate(-90 16 ${f.pad.t + f.h / 2})` }, f.svg);
  yl.textContent = yLabel;

  if (frontier.length > 1) {
    const fr = [...frontier].sort((a, b) => a.x - b.x);
    el('path', { d: fr.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(''), class: 'viz-frontier' }, f.svg);
  }

  // Labels: place the most important first (priority = z), try right / left / above / below,
  // and drop a label rather than overlap another one (its tooltip still has the name).
  const boxes = [];
  const overlaps = b => boxes.some(q => b.x < q.x + q.w && b.x + b.w > q.x && b.y < q.y + q.h && b.y + b.h > q.y);
  const inside = b => b.x >= f.pad.l - 2 && b.x + b.w <= f.pad.l + f.w + 2 && b.y >= f.pad.t - 2 && b.y + b.h <= f.pad.t + f.h + 2;
  const labelPos = new Map();
  for (const p of [...points].sort((a, b) => (b.z ?? 0) - (a.z ?? 0))) {
    const r = p.r ?? 5, cx = x(p.x), cy = y(p.y);
    boxes.push({ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r });            // dots block labels too
    if (!p.showLabel) continue;
    const w = p.label.length * 6.2 + 4, h = 13;
    const cands = [
      { x: cx + r + 5, y: cy - h / 2, anchor: 'start' },
      { x: cx - r - 5 - w, y: cy - h / 2, anchor: 'end' },
      { x: cx - w / 2, y: cy - r - 4 - h, anchor: 'middle' },
      { x: cx - w / 2, y: cy + r + 3, anchor: 'middle' }
    ];
    const ok = cands.find(c => { const b = { x: c.x, y: c.y, w, h }; return inside(b) && !overlaps(b); })
      ?? (p.mustLabel ? cands.find(c => inside({ x: c.x, y: c.y, w, h })) ?? cands[0] : null);
    if (!ok) continue;
    boxes.push({ x: ok.x, y: ok.y, w, h });
    labelPos.set(p, { tx: ok.anchor === 'start' ? ok.x : ok.anchor === 'end' ? ok.x + w : ok.x + w / 2, ty: ok.y + 10, anchor: ok.anchor });
  }

  // draw small/background points first so highlighted ones sit on top
  const order = [...points].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  const labelLayer = [];
  for (const p of order) {
    const g = el('g', { class: 'viz-pt ' + (p.cls || ''), tabindex: p.onClick ? 0 : -1, role: p.onClick ? 'button' : 'img', 'aria-label': p.aria || p.label }, f.svg);
    el('circle', { cx: x(p.x), cy: y(p.y), r: (p.r ?? 5) + 8, class: 'viz-pt-hit' }, g);
    el('circle', { cx: x(p.x), cy: y(p.y), r: p.r ?? 5, class: 'viz-pt-dot' }, g);
    const lp = labelPos.get(p);
    if (lp) labelLayer.push({ p, lp });
    const show = ev => {
      const r = ev.clientX ? ev : (() => { const b = g.getBoundingClientRect(); return { clientX: b.right, clientY: b.top }; })();
      showTip(p.tip, r.clientX, r.clientY);
    };
    g.addEventListener('pointermove', show);
    g.addEventListener('focus', show);
    g.addEventListener('pointerleave', hideTip);
    g.addEventListener('blur', hideTip);
    if (p.onClick) {
      g.addEventListener('click', () => p.onClick(p));
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); p.onClick(p); } });
    }
  }
  // labels last, so no dot is drawn over a label
  for (const { p, lp } of labelLayer) {
    const t = el('text', { x: lp.tx, y: lp.ty, class: 'viz-pt-label ' + (p.cls || ''), 'text-anchor': lp.anchor }, f.svg);
    t.textContent = p.label;
  }
  return f.svg;
}
