import { L, t } from './i18n.js';
import { icon } from './icons.js';
// A/B comparison of two decision bundles under the same scenario.
import { METRICS } from '../data/metrics.js';
import { fmtMetric, fmtMoney, fmtPct, statusEmoji } from './format.js';
import { lineChart, esc } from './viz.js';

const money = v => (v < 0 ? '−$' : '$') + fmtMoney(Math.abs(v));

// lower is better for risk-like rows, higher for money
const ROWS = () => [
  { key: 'avgRisk',  label: L('Average risk', 'Средний риск'), fmt: v => v.toFixed(1), better: 'low', hint: L('mean risk score over the horizon', 'средняя оценка риска за горизонт') },
  { key: 'endRisk',  label: L('Risk on the last day', 'Риск в последний день'), fmt: v => v.toFixed(1), better: 'low', hint: L('after decisions have landed and partly faded', 'когда решения сработали и частично ослабли') },
  { key: 'avgSev',   label: L('Average P(SEV)', 'Средняя P(SEV)'), fmt: fmtPct, better: 'low', hint: L('chance of a severe incident, per day', 'вероятность серьёзного инцидента за день') },
  { key: 'anyRedDays', label: L('Days with a red metric', 'Дней с красной метрикой'), fmt: v => String(v), better: 'low' },
  { key: 'totalNet', label: L('Total net', 'Итого чистыми'), fmt: money, better: 'high', hint: L('revenue minus all costs, summed over the horizon', 'выручка минус все расходы за весь горизонт') },
  { key: 'decisionCostPerDay', label: L('Decision cost / day', 'Цена решений в день'), fmt: money, better: 'low' }
];

function deltaCell(row, a, b) {
  const d = b - a;
  const eps = row.key === 'avgSev' ? 0.0005 : row.key === 'anyRedDays' ? 0.5 : row.key.includes('Net') || row.key.includes('Cost') ? 1 : 0.05;
  if (Math.abs(d) < eps) return `<td class="cmp-delta same">${L('same', 'так же')}</td>`;
  const good = row.better === 'low' ? d < 0 : d > 0;
  const shown = row.key === 'avgSev' ? (d > 0 ? '+' : '−') + (Math.abs(d) * 100).toFixed(1) + ' pp'
    : row.fmt === money ? (d > 0 ? '+' : '−') + '$' + fmtMoney(Math.abs(d))
    : (d > 0 ? '+' : '−') + row.fmt(Math.abs(d));
  return `<td class="cmp-delta ${good ? 'good' : 'bad'}">${icon(good ? 'check' : 'x', 'ic-sm')} ${shown} <span class="sr">${good ? L('better', 'лучше') : L('worse', 'хуже')}</span></td>`;
}

function verdict(A, B, horizon, names) {
  const dRisk = B.avgRisk - A.avgRisk, dNet = B.totalNet - A.totalNet;
  const r = Math.abs(dRisk), n = Math.abs(dNet);
  if (r < 0.1 && n < 1000) return L(`${names.A} and ${names.B} lead to practically the same outcome.`, `${names.A} и ${names.B} дают практически одинаковый результат.`);
  const both = w => L(`<b>${names[w]} is better on both</b>: ${r.toFixed(1)} lower average risk and ${money(n)} more over ${horizon} days.`,
                      `<b>${names[w]} лучше по обоим показателям</b>: средний риск ниже на ${r.toFixed(1)} и на ${money(n)} больше за ${horizon} дн.`);
  if (dRisk <= 0 && dNet >= 0) return both('B');
  if (dRisk >= 0 && dNet <= 0) return both('A');
  const safer = dRisk < 0 ? 'B' : 'A', other = safer === 'A' ? 'B' : 'A';
  const perPoint = r > 0.05 ? L(`, about <b>${money(n / r)} per risk point</b>`, `, примерно <b>${money(n / r)} за пункт риска</b>`) : '';
  const otherName = names[other] === names.nothing ? names.nothingLower : names[other];
  return L(`<b>${names[safer]}</b> is safer by ${r.toFixed(1)} points of average risk, but earns ${money(n)} less than ${otherName} over ${horizon} days${perPoint}. Whether that's worth it is your call.`,
           `<b>${names[safer]}</b> безопаснее на ${r.toFixed(1)} пункта среднего риска, но приносит на ${money(n)} меньше, чем ${otherName}, за ${horizon} дн.${perPoint}. Стоит ли оно того, решать вам.`);
}

function bundleCard(slot, bundle, summary, active) {
  const items = bundle.length
    ? bundle.map(b => `<li>${esc(t(b.decision.name))} <span class="cmp-int">${Math.round(b.intensity * 100)}%</span></li>`).join('')
    : `<li class="muted">${L('No decisions', 'Нет решений')}</li>`;
  return `
    <div class="cmp-card slot-${slot.toLowerCase()} ${active ? 'active' : ''}">
      <div class="cmp-card-head">
        <span class="slot-tag slot-${slot.toLowerCase()}">${slot}</span>
        <span class="cmp-card-title">${L('Bundle', 'Набор')} ${slot}</span>
        ${active ? `<span class="cmp-editing">${L('editing in sidebar', 'редактируется в панели')}</span>`
                 : `<button class="btn btn-ghost btn-sm" data-act="edit" data-slot="${slot}">${L('Edit', 'Изменить')} ${slot}</button>`}
      </div>
      <ul class="cmp-list">${items}</ul>
      <div class="cmp-card-foot">${money(summary.decisionCostPerDay)} ${L('/ day', '/ день')}</div>
    </div>`;
}

export function renderCompare(container, { A, B, activeSlot, horizon, onAction }) {
  const bEmpty = !B.bundle.length, aEmpty = !A.bundle.length;
  const diffMetrics = METRICS.filter(m => {
    const a = A.summary.endMetrics[m.id], b = B.summary.endMetrics[m.id];
    return A.summary.endStatus[m.id] !== B.summary.endStatus[m.id] || Math.abs(b - a) / (Math.abs(m.baseline) || 1) > 0.01;
  });

  container.innerHTML = `
    <div class="cmp-top">
      ${bundleCard('A', A.bundle, A.summary, activeSlot === 'A')}
      <div class="cmp-actions">
        <button class="btn btn-ghost btn-sm" data-act="copy" title="${L('Replace B with a copy of A', 'Заменить B копией A')}">${icon('copy')}${L('Copy A to B', 'Копировать A в B')}</button>
        <button class="btn btn-ghost btn-sm" data-act="swap">${icon('arrowsLR')}${L('Swap A and B', 'Поменять A и B')}</button>
      </div>
      ${bundleCard('B', B.bundle, B.summary, activeSlot === 'B')}
    </div>

    ${aEmpty && bEmpty ? `<p class="cmp-empty">${L('Both bundles are empty. Load a preset or add decisions in the sidebar, then switch the sidebar to <b>B</b> and build an alternative.', 'Оба набора пусты. Загрузите готовый набор или добавьте решения в панели, затем переключите панель на <b>B</b> и соберите альтернативу.')}</p>` : ''}
    ${!aEmpty && bEmpty ? `<p class="cmp-empty">${L('Bundle B is empty, so this compares A against doing nothing.', 'Набор B пуст, поэтому A сравнивается с бездействием.')} <button class="btn btn-ghost btn-sm" data-act="copy">${icon('copy')}${L('Copy A to B', 'Копировать A в B')}</button> ${L("and change one decision to see what it's worth.", 'и поменяйте одно решение, чтобы понять, чего оно стоит.')}</p>` : ''}

    <p class="cmp-verdict">${verdict(A.summary, B.summary, horizon, { A: aEmpty ? L('Doing nothing', 'Бездействие') : 'A', B: bEmpty ? L('Doing nothing', 'Бездействие') : 'B', nothing: L('Doing nothing', 'Бездействие'), nothingLower: L('doing nothing', 'бездействие') })}</p>

    <table class="cmp-table">
      <thead><tr><th scope="col">${L(`Over ${horizon} days`, `За ${horizon} дн.`)}</th><th scope="col"><span class="slot-tag slot-a">A</span></th><th scope="col"><span class="slot-tag slot-b">B</span></th><th scope="col">${L('B vs A', 'B против A')}</th></tr></thead>
      <tbody>
        ${ROWS().map(r => `
          <tr>
            <th scope="row">${r.label}${r.hint ? `<span class="cmp-hint">${r.hint}</span>` : ''}</th>
            <td>${r.fmt(A.summary[r.key])}</td>
            <td>${r.fmt(B.summary[r.key])}</td>
            ${deltaCell(r, A.summary[r.key], B.summary[r.key])}
          </tr>`).join('')}
      </tbody>
    </table>

    <div class="charts-grid cmp-charts">
      <div class="chart-wrap" id="cmp-risk"></div>
      <div class="chart-wrap" id="cmp-net"></div>
    </div>

    <h3 class="cmp-sub">${L('Where they end up differently', 'Чем они закончатся по-разному')} <span class="block-hint">${L('day', 'день')} ${horizon}</span></h3>
    ${diffMetrics.length ? `
      <table class="cmp-table cmp-metrics">
        <thead><tr><th scope="col">${L('Metric', 'Метрика')}</th><th scope="col"><span class="slot-tag slot-a">A</span></th><th scope="col"><span class="slot-tag slot-b">B</span></th></tr></thead>
        <tbody>${diffMetrics.map(m => `
          <tr>
            <th scope="row">${t(m.name)}</th>
            <td>${statusEmoji(A.summary.endStatus[m.id])} ${fmtMetric(A.summary.endMetrics[m.id], m.unit)}</td>
            <td>${statusEmoji(B.summary.endStatus[m.id])} ${fmtMetric(B.summary.endMetrics[m.id], m.unit)}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : `<p class="muted">${L('Every metric ends within 1 % in both bundles.', 'В обоих наборах все метрики заканчиваются в пределах 1 %.')}</p>`}
  `;

  const series = key => [
    { key: 'A', label: 'A', color: 'var(--series-a)', values: A.states.map(s => s.derived[key]) },
    { key: 'B', label: 'B', color: 'var(--series-b)', values: B.states.map(s => s.derived[key]) }
  ];
  lineChart(container.querySelector('#cmp-risk'), { title: L('Risk score', 'Оценка риска'), series: series('riskScore'), fmt: v => v.toFixed(1), yMin: 0 });
  lineChart(container.querySelector('#cmp-net'), { title: L('Net per day', 'Чистыми в день'), series: series('net'), fmt: v => money(v), zeroLine: true });

  container.querySelectorAll('[data-act]').forEach(btn =>
    btn.addEventListener('click', () => onAction(btn.dataset.act, btn.dataset.slot)));
}
