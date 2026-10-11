import { icon } from './icons.js';
// "What moved the risk" — a waterfall from the quiet product to the current bundle.
import { METRICS } from '../data/metrics.js';
import { esc, showTip, hideTip } from './viz.js';

const metricName = id => METRICS.find(m => m.id === id)?.name ?? id;
const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1);

function viaText(drivers) {
  const d = drivers.filter(x => Math.abs(x.delta) >= 0.1).slice(0, 2);
  if (!d.length) return '';
  return 'mainly via ' + d.map(x => metricName(x.id).toLowerCase()).join(', ');
}

function headline(ex, horizon) {
  const change = ex.total - ex.noDecisions;
  if (!ex.decisions.length) {
    const s = ex.shocks.delta;
    return `Without any decisions, average risk over ${horizon} days is <b>${ex.total.toFixed(1)}</b>. ` +
      (Math.abs(s) >= 0.5
        ? `The scenario's events move it ${s > 0 ? 'up' : 'down'} by ${Math.abs(s).toFixed(1)} from a quiet ${ex.quiet.toFixed(1)}.`
        : `The scenario's events barely move it.`) +
      ` Add decisions from the library to see what each one does.`;
  }
  const best = [...ex.decisions].sort((a, b) => a.delta - b.delta)[0];
  const worst = [...ex.decisions].sort((a, b) => b.delta - a.delta)[0];
  let s = `This bundle ${change <= 0 ? 'lowers' : 'raises'} average risk over ${horizon} days from ` +
    `<b>${ex.noDecisions.toFixed(1)}</b> to <b>${ex.total.toFixed(1)}</b> (${signed(change)}).`;
  if (best.delta < -0.05) {
    const via = viaText(best.drivers);
    s += ` Biggest help: <b>${esc(best.name)}</b> (${signed(best.delta)}${via ? ', ' + via : ''}).`;
  }
  if (worst.delta > 0.05) {
    const via = viaText(worst.drivers);
    s += ` Works against you: <b>${esc(worst.name)}</b> (${signed(worst.delta)}${via ? ', ' + via : ''}).`;
  }
  return s;
}

export function renderExplain(container, ex, horizon) {
  const rows = [
    { kind: 'anchor', label: 'Quiet product', note: 'no scenario events, no decisions', value: ex.quiet },
    { kind: 'step', label: 'Scenario events', note: viaText(ex.shocks.drivers), value: ex.shocks.delta, drivers: ex.shocks.drivers },
    ...[...ex.decisions].sort((a, b) => a.delta - b.delta).map(d => ({
      kind: 'step', label: d.name, note: viaText(d.drivers), value: d.delta, drivers: d.drivers,
      sub: `${Math.round(d.intensity * 100)}% intensity`
    })),
    { kind: 'anchor total', label: 'This bundle', note: `average over ${horizon} days`, value: ex.total }
  ];
  const maxStep = Math.max(1, ...rows.filter(r => r.kind === 'step').map(r => Math.abs(r.value)));

  container.innerHTML = `
    <section class="explain card-block" aria-labelledby="explain-title">
      <div class="block-head">
        <h3 id="explain-title">What moved the risk</h3>
        <span class="block-hint">Each decision's share of the joint effect (Shapley values: the steps add up exactly).</span>
      </div>
      <p class="explain-headline">${headline(ex, horizon)}</p>
      <div class="wf" role="table" aria-label="Risk breakdown">
        ${rows.map((r, i) => {
          const isStep = r.kind === 'step';
          const pct = isStep ? Math.abs(r.value) / maxStep * 50 : 0;
          const dir = r.value > 0 ? 'up' : 'down';
          return `
          <div class="wf-row ${r.kind}" role="row" data-i="${i}">
            <div class="wf-label" role="cell">
              <span class="wf-name">${esc(r.label)}</span>
              ${r.sub ? `<span class="wf-sub">${esc(r.sub)}</span>` : ''}
            </div>
            <div class="wf-bar" role="cell" aria-hidden="true">
              ${isStep ? `<span class="wf-axis"></span><span class="wf-fill ${dir}" style="${dir === 'up' ? 'left:50%' : `left:${50 - pct}%`};width:${Math.max(pct, 0.6)}%"></span>` : ''}
            </div>
            <div class="wf-value ${isStep ? dir : ''}" role="cell">
              ${isStep ? `<span class="wf-arrow" aria-hidden="true">${r.value > 0.05 ? icon('caretUp', 'ic-sm') : r.value < -0.05 ? icon('caretDown', 'ic-sm') : ''}</span>${signed(r.value)}` : r.value.toFixed(1)}
            </div>
            <div class="wf-note" role="cell">${esc(r.note || '')}</div>
          </div>`;
        }).join('')}
      </div>
      <p class="wf-legend"><span class="wf-key down"></span>lowers risk <span class="wf-key up"></span>raises risk</p>
    </section>`;

  container.querySelectorAll('.wf-row').forEach(rowEl => {
    const r = rows[+rowEl.dataset.i];
    if (!r.drivers?.length) return;
    rowEl.addEventListener('pointermove', ev => showTip(
      `<div class="tip-head">${esc(r.label)} · ${signed(r.value)}</div>` +
      r.drivers.map(d => `<div class="tip-row">${esc(metricName(d.id))}<b>${signed(d.delta)}</b></div>`).join('') +
      `<div class="tip-foot">risk points carried by each metric</div>`, ev.clientX, ev.clientY));
    rowEl.addEventListener('pointerleave', hideTip);
  });
}
