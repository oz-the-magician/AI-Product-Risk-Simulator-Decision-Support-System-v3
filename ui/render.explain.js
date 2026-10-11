import { L, t } from './i18n.js';
import { icon } from './icons.js';
// "What moved the risk" — a waterfall from the quiet product to the current bundle.
import { METRICS } from '../data/metrics.js';
import { esc, showTip, hideTip } from './viz.js';

const metricName = id => t(METRICS.find(m => m.id === id)?.name ?? id);
const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1);

function viaText(drivers) {
  const d = drivers.filter(x => Math.abs(x.delta) >= 0.1).slice(0, 2);
  if (!d.length) return '';
  return L('mainly via ', 'в основном через: ') + d.map(x => { const n = metricName(x.id); return L(n.toLowerCase(), n.charAt(0).toLowerCase() + n.slice(1)); }).join(', ');
}

function headline(ex, horizon) {
  const change = ex.total - ex.noDecisions;
  if (!ex.decisions.length) {
    const s = ex.shocks.delta;
    return L(`Without any decisions, average risk over ${horizon} days is <b>${ex.total.toFixed(1)}</b>. `,
             `Без решений средний риск за ${horizon} дн. равен <b>${ex.total.toFixed(1)}</b>. `) +
      (Math.abs(s) >= 0.5
        ? L(`The scenario's events move it ${s > 0 ? 'up' : 'down'} by ${Math.abs(s).toFixed(1)} from a quiet ${ex.quiet.toFixed(1)}.`,
            `События сценария ${s > 0 ? 'поднимают' : 'опускают'} его на ${Math.abs(s).toFixed(1)} от спокойных ${ex.quiet.toFixed(1)}.`)
        : L(`The scenario's events barely move it.`, `События сценария почти его не меняют.`)) +
      L(` Add decisions from the library to see what each one does.`, ` Добавьте решения из библиотеки, чтобы увидеть, что делает каждое.`);
  }
  const best = [...ex.decisions].sort((a, b) => a.delta - b.delta)[0];
  const worst = [...ex.decisions].sort((a, b) => b.delta - a.delta)[0];
  let s = L(`This bundle ${change <= 0 ? 'lowers' : 'raises'} average risk over ${horizon} days from `,
            `Этот набор ${change <= 0 ? 'снижает' : 'повышает'} средний риск за ${horizon} дн. с `) +
    `<b>${ex.noDecisions.toFixed(1)}</b> ${L('to', 'до')} <b>${ex.total.toFixed(1)}</b> (${signed(change)}).`;
  if (best.delta < -0.05) {
    const via = viaText(best.drivers);
    s += ` ${L('Biggest help', 'Больше всего помогает')}: <b>${esc(t(best.name))}</b> (${signed(best.delta)}${via ? ', ' + via : ''}).`;
  }
  if (worst.delta > 0.05) {
    const via = viaText(worst.drivers);
    s += ` ${L('Works against you', 'Работает против вас')}: <b>${esc(t(worst.name))}</b> (${signed(worst.delta)}${via ? ', ' + via : ''}).`;
  }
  return s;
}

export function renderExplain(container, ex, horizon) {
  const rows = [
    { kind: 'anchor', label: L('Quiet product', 'Спокойный продукт'), note: L('no scenario events, no decisions', 'без событий сценария и без решений'), value: ex.quiet },
    { kind: 'step', label: L('Scenario events', 'События сценария'), note: viaText(ex.shocks.drivers), value: ex.shocks.delta, drivers: ex.shocks.drivers },
    ...[...ex.decisions].sort((a, b) => a.delta - b.delta).map(d => ({
      kind: 'step', label: t(d.name), note: viaText(d.drivers), value: d.delta, drivers: d.drivers,
      sub: `${Math.round(d.intensity * 100)}% ${L('intensity', 'интенсивность')}`
    })),
    { kind: 'anchor total', label: L('This bundle', 'Этот набор'), note: L(`average over ${horizon} days`, `среднее за ${horizon} дн.`), value: ex.total }
  ];
  const maxStep = Math.max(1, ...rows.filter(r => r.kind === 'step').map(r => Math.abs(r.value)));

  container.innerHTML = `
    <section class="explain card-block" aria-labelledby="explain-title">
      <div class="block-head">
        <h3 id="explain-title">${L('What moved the risk', 'Что сдвинуло риск')}</h3>
        <span class="block-hint">${L("Each decision's share of the joint effect (Shapley values: the steps add up exactly).", 'Доля каждого решения в общем эффекте (значения Шепли: шаги складываются точно).')}</span>
      </div>
      <p class="explain-headline">${headline(ex, horizon)}</p>
      <div class="wf" role="table" aria-label="${L('Risk breakdown', 'Разбор риска')}">
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
      <p class="wf-legend"><span class="wf-key down"></span>${L('lowers risk', 'снижает риск')} <span class="wf-key up"></span>${L('raises risk', 'повышает риск')}</p>
    </section>`;

  container.querySelectorAll('.wf-row').forEach(rowEl => {
    const r = rows[+rowEl.dataset.i];
    if (!r.drivers?.length) return;
    rowEl.addEventListener('pointermove', ev => showTip(
      `<div class="tip-head">${esc(r.label)} · ${signed(r.value)}</div>` +
      r.drivers.map(d => `<div class="tip-row">${esc(metricName(d.id))}<b>${signed(d.delta)}</b></div>`).join('') +
      `<div class="tip-foot">${L('risk points carried by each metric', 'сколько пунктов риска прошло через каждую метрику')}</div>`, ev.clientX, ev.clientY));
    rowEl.addEventListener('pointerleave', hideTip);
  });
}
