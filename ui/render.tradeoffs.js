import { L, t } from './i18n.js';
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
    <div class="tip-row">${L('Average risk', 'Средний риск')}<b>${p.avgRisk.toFixed(1)}</b></div>
    <div class="tip-row">${L(`Total net, ${horizon} d`, `Итого чистыми, ${horizon} дн.`)}<b>${money(p.totalNet)}</b></div>
    <div class="tip-foot">${p.onFrontier ? L('Efficient: nothing is both safer and more profitable', 'Эффективный: нет варианта одновременно безопаснее и прибыльнее') : L('Dominated: another option is safer and earns more', 'Доминируемый: есть вариант безопаснее и прибыльнее')}${p.bundle?.length && p.kind !== 'A' && p.kind !== 'B' ? L(' · click to load it', ' · нажмите, чтобы загрузить') : ''}</div>`;

  container.innerHTML = `
    <div class="block-head">
      <h3>${L('Risk against money', 'Риск против денег')}</h3>
      <span class="block-hint">${L(`Each dot is a decision bundle simulated for ${horizon} days in this scenario. Left = safer, up = more money.`, `Каждая точка: набор решений, просчитанный на ${horizon} дн. в этом сценарии. Левее безопаснее, выше больше денег.`)}</span>
    </div>
    <div class="to-layout">
      <div class="chart-wrap to-chart" id="to-chart"></div>
      <aside class="to-side">
        <p class="to-legend">
          <span class="lg"><span class="lg-dot on-front"></span>${L('Efficient (on the line)', 'Эффективные (на линии)')}</span>
          <span class="lg"><span class="lg-dot dominated"></span>${L('Dominated', 'Доминируемые')}</span>
          <span class="lg"><span class="lg-dot slot-a"></span>${L('Bundle A', 'Набор A')}</span>
          <span class="lg"><span class="lg-dot slot-b"></span>${L('Bundle B', 'Набор B')}</span>
        </p>
        <p class="to-explain">${L("On the dashed line you can't lower risk without giving up money. Anything below it is beaten on both counts by a dot up-and-left of it.", 'На пунктире риск нельзя снизить, не потеряв денег. Всё, что ниже, проигрывает по обоим показателям какой-то точке левее и выше.')}</p>
        <div id="to-detail" class="to-detail"><p class="muted">${L('Hover a dot for numbers, click it to load it into A or B.', 'Наведите на точку, чтобы увидеть цифры, нажмите, чтобы загрузить её в A или B.')}</p></div>
      </aside>
    </div>
    <h3 class="cmp-sub">${L('Efficient options, safest first', 'Эффективные варианты, сначала самые безопасные')}</h3>
    <table class="cmp-table to-table">
      <thead><tr><th scope="col">${L('Option', 'Вариант')}</th><th scope="col">${L('Average risk', 'Средний риск')}</th><th scope="col">${L('Total net', 'Итого чистыми')}</th><th scope="col"></th></tr></thead>
      <tbody>${front.map(p => `
        <tr><th scope="row">${esc(p.label)}</th><td>${p.avgRisk.toFixed(1)}</td><td>${money(p.totalNet)}</td>
        <td>${p.bundle?.length && p.kind !== 'A' && p.kind !== 'B' ? `<button class="btn btn-ghost btn-sm" data-load="${points.indexOf(p)}" data-slot="A">${L('Load as A', 'Загрузить в A')}</button> <button class="btn btn-ghost btn-sm" data-load="${points.indexOf(p)}" data-slot="B">${L('Load as B', 'Загрузить в B')}</button>` : ''}</td></tr>`).join('')}
      </tbody>
    </table>`;

  const detail = container.querySelector('#to-detail');
  const select = p => {
    detail.innerHTML = `
      <div class="to-detail-head">${esc(p.label)}</div>
      <div class="to-detail-nums"><span>${L('Risk', 'Риск')} <b>${p.avgRisk.toFixed(1)}</b></span><span>${L('Net', 'Чистыми')} <b>${money(p.totalNet)}</b></span></div>
      ${p.bundle?.length ? `<ul class="cmp-list">${p.bundle.map(b => `<li>${esc(t(b.decision.name))} <span class="cmp-int">${Math.round(b.intensity * 100)}%</span></li>`).join('')}</ul>` : `<p class="muted">${L('No decisions.', 'Нет решений.')}</p>`}
      ${p.bundle?.length && p.kind !== 'A' && p.kind !== 'B' ? `<div class="to-detail-acts">
        <button class="btn btn-primary btn-sm" data-slot="A">${L('Load into A', 'Загрузить в A')}</button>
        <button class="btn btn-ghost btn-sm" data-slot="B">${L('Load into B', 'Загрузить в B')}</button></div>` : ''}`;
    detail.querySelectorAll('[data-slot]').forEach(b => b.addEventListener('click', () => onLoad(p, b.dataset.slot)));
  };

  scatterChart(container.querySelector('#to-chart'), {
    title: '',
    xLabel: L(`Average risk over ${horizon} days  (lower is better)`, `Средний риск за ${horizon} дн.  (чем ниже, тем лучше)`),
    yLabel: L(`Total net over ${horizon} days`, `Итого чистыми за ${horizon} дн.`),
    fmtX: v => v.toFixed(0), fmtY: v => money(v),
    frontier: front.map(p => ({ x: p.avgRisk, y: p.totalNet })),
    points: points.map(p => ({
      x: p.avgRisk, y: p.totalNet, label: p.displayLabel || p.label, cls: cls(p),
      r: p.kind === 'A' || p.kind === 'B' ? 7 : p.kind === 'single' ? 4 : 5.5,
      z: p.kind === 'A' || p.kind === 'B' ? 4 : p.kind === 'preset' && p.onFrontier ? 3 : p.onFrontier ? 2 : p.kind === 'single' ? 0 : 1,
      showLabel: !p.hideLabel && (p.kind !== 'single' || p.onFrontier),
      mustLabel: p.kind === 'A' || p.kind === 'B',
      tip: tip(p),
      aria: L(`${p.label}: average risk ${p.avgRisk.toFixed(1)}, total net ${money(p.totalNet)}${p.onFrontier ? ', efficient' : ''}`, `${p.label}: средний риск ${p.avgRisk.toFixed(1)}, итого чистыми ${money(p.totalNet)}${p.onFrontier ? ', эффективный' : ''}`),
      onClick: () => select(p)
    }))
  });

  container.querySelectorAll('[data-load]').forEach(b =>
    b.addEventListener('click', () => onLoad(points[+b.dataset.load], b.dataset.slot)));
}
