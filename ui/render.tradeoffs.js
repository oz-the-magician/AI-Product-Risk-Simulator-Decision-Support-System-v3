// Trade-off map: average risk vs total net for presets, single decisions and bundles A/B.
import { fmtMoney } from './format.js';
import { scatterChart, esc } from './viz.js';

const money = v => (v < 0 ? '−$' : '$') + fmtMoney(Math.abs(v));

export function renderTradeoffs(container, { points, horizon, onLoad }) {
  const front = points.filter(p => p.onFrontier).sort((a, b) => a.avgRisk - b.avgRisk);
  const cls = p => [
    p.kind === 'A' ? 'slot-a' : p.kind === 'B' ? 'slot-b' : '',
    p.onFrontier ? 'on-front' : 'dominated',
    p.kind === 'single' ? 'single' : '',
    p.kind === 'none' ? 'none' : ''
  ].join(' ');
  const tip = p => `
    <div class="tip-head">${esc(p.label)}</div>
    <div class="tip-row">Average risk<b>${p.avgRisk.toFixed(1)}</b></div>
    <div class="tip-row">Total net, ${horizon} d<b>${money(p.totalNet)}</b></div>
    <div class="tip-foot">${p.onFrontier ? 'Efficient: nothing is both safer and more profitable' : 'Dominated: another option is safer and earns more'}${p.bundle?.length && p.kind !== 'A' && p.kind !== 'B' ? ' · click to load it' : ''}</div>`;

  container.innerHTML = `
    <div class="block-head">
      <h3>Risk against money</h3>
      <span class="block-hint">Each dot is a decision bundle simulated for ${horizon} days in this scenario. Left = safer, up = more money.</span>
    </div>
    <div class="to-layout">
      <div class="chart-wrap to-chart" id="to-chart"></div>
      <aside class="to-side">
        <p class="to-legend">
          <span class="lg"><span class="lg-dot on-front"></span>Efficient (on the line)</span>
          <span class="lg"><span class="lg-dot dominated"></span>Dominated</span>
          <span class="lg"><span class="lg-dot slot-a"></span>Bundle A</span>
          <span class="lg"><span class="lg-dot slot-b"></span>Bundle B</span>
        </p>
        <p class="to-explain">On the dashed line you can't lower risk without giving up money. Anything below it is beaten on both counts by a dot up-and-left of it.</p>
        <div id="to-detail" class="to-detail"><p class="muted">Hover a dot for numbers, click it to load it into A or B.</p></div>
      </aside>
    </div>
    <h3 class="cmp-sub">Efficient options, safest first</h3>
    <table class="cmp-table to-table">
      <thead><tr><th scope="col">Option</th><th scope="col">Average risk</th><th scope="col">Total net</th><th scope="col"></th></tr></thead>
      <tbody>${front.map(p => `
        <tr><th scope="row">${esc(p.label)}</th><td>${p.avgRisk.toFixed(1)}</td><td>${money(p.totalNet)}</td>
        <td>${p.bundle?.length && p.kind !== 'A' && p.kind !== 'B' ? `<button class="btn btn-ghost btn-sm" data-load="${points.indexOf(p)}" data-slot="A">Load as A</button> <button class="btn btn-ghost btn-sm" data-load="${points.indexOf(p)}" data-slot="B">Load as B</button>` : ''}</td></tr>`).join('')}
      </tbody>
    </table>`;

  const detail = container.querySelector('#to-detail');
  const select = p => {
    detail.innerHTML = `
      <div class="to-detail-head">${esc(p.label)}</div>
      <div class="to-detail-nums"><span>Risk <b>${p.avgRisk.toFixed(1)}</b></span><span>Net <b>${money(p.totalNet)}</b></span></div>
      ${p.bundle?.length ? `<ul class="cmp-list">${p.bundle.map(b => `<li>${esc(b.decision.name)} <span class="cmp-int">${Math.round(b.intensity * 100)}%</span></li>`).join('')}</ul>` : '<p class="muted">No decisions.</p>'}
      ${p.bundle?.length && p.kind !== 'A' && p.kind !== 'B' ? `<div class="to-detail-acts">
        <button class="btn btn-primary btn-sm" data-slot="A">Load into A</button>
        <button class="btn btn-ghost btn-sm" data-slot="B">Load into B</button></div>` : ''}`;
    detail.querySelectorAll('[data-slot]').forEach(b => b.addEventListener('click', () => onLoad(p, b.dataset.slot)));
  };

  scatterChart(container.querySelector('#to-chart'), {
    title: '',
    xLabel: `Average risk over ${horizon} days  (lower is better)`,
    yLabel: `Total net over ${horizon} days`,
    fmtX: v => v.toFixed(0), fmtY: v => money(v),
    frontier: front.map(p => ({ x: p.avgRisk, y: p.totalNet })),
    points: points.map(p => ({
      x: p.avgRisk, y: p.totalNet, label: p.displayLabel || p.label, cls: cls(p),
      r: p.kind === 'A' || p.kind === 'B' ? 7 : p.kind === 'single' ? 4 : 5.5,
      z: p.kind === 'A' || p.kind === 'B' ? 4 : p.kind === 'preset' && p.onFrontier ? 3 : p.onFrontier ? 2 : p.kind === 'single' ? 0 : 1,
      showLabel: !p.hideLabel && (p.kind !== 'single' || p.onFrontier),
      mustLabel: p.kind === 'A' || p.kind === 'B',
      tip: tip(p),
      aria: `${p.label}: average risk ${p.avgRisk.toFixed(1)}, total net ${money(p.totalNet)}${p.onFrontier ? ', efficient' : ''}`,
      onClick: () => select(p)
    }))
  });

  container.querySelectorAll('[data-load]').forEach(b =>
    b.addEventListener('click', () => onLoad(points[+b.dataset.load], b.dataset.slot)));
}
