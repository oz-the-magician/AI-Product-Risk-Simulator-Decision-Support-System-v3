import { icon } from './icons.js';
// A/B comparison of two decision bundles under the same scenario.
import { METRICS } from '../data/metrics.js';
import { fmtMetric, fmtMoney, fmtPct, statusEmoji } from './format.js';
import { lineChart, esc } from './viz.js';

const money = v => (v < 0 ? '−$' : '$') + fmtMoney(Math.abs(v));

// lower is better for risk-like rows, higher for money
const ROWS = [
  { key: 'avgRisk',  label: 'Average risk',            fmt: v => v.toFixed(1), better: 'low',  hint: 'mean risk score over the horizon' },
  { key: 'endRisk',  label: 'Risk on the last day',    fmt: v => v.toFixed(1), better: 'low',  hint: 'after decisions have landed and partly faded' },
  { key: 'avgSev',   label: 'Average P(SEV)',          fmt: fmtPct,            better: 'low',  hint: 'chance of a severe incident, per day' },
  { key: 'anyRedDays', label: 'Days with a red metric', fmt: v => String(v),   better: 'low' },
  { key: 'totalNet', label: 'Total net',               fmt: money,             better: 'high', hint: 'revenue minus all costs, summed over the horizon' },
  { key: 'decisionCostPerDay', label: 'Decision cost / day', fmt: money,       better: 'low' }
];

function deltaCell(row, a, b) {
  const d = b - a;
  const eps = row.key === 'avgSev' ? 0.0005 : row.key === 'anyRedDays' ? 0.5 : row.key.includes('Net') || row.key.includes('Cost') ? 1 : 0.05;
  if (Math.abs(d) < eps) return `<td class="cmp-delta same">same</td>`;
  const good = row.better === 'low' ? d < 0 : d > 0;
  const shown = row.key === 'avgSev' ? (d > 0 ? '+' : '−') + (Math.abs(d) * 100).toFixed(1) + ' pp'
    : row.fmt === money ? (d > 0 ? '+' : '−') + '$' + fmtMoney(Math.abs(d))
    : (d > 0 ? '+' : '−') + row.fmt(Math.abs(d));
  return `<td class="cmp-delta ${good ? 'good' : 'bad'}">${icon(good ? 'check' : 'x', 'ic-sm')} ${shown} <span class="sr">${good ? 'better' : 'worse'}</span></td>`;
}

function verdict(A, B, horizon, names) {
  const dRisk = B.avgRisk - A.avgRisk, dNet = B.totalNet - A.totalNet;
  const r = Math.abs(dRisk), n = Math.abs(dNet);
  if (r < 0.1 && n < 1000) return `${names.A} and ${names.B} lead to practically the same outcome.`;
  if (dRisk <= 0 && dNet >= 0) return `<b>${names.B} is better on both</b>: ${r.toFixed(1)} lower average risk and ${money(n)} more over ${horizon} days.`;
  if (dRisk >= 0 && dNet <= 0) return `<b>${names.A} is better on both</b>: ${r.toFixed(1)} lower average risk and ${money(n)} more over ${horizon} days.`;
  const safer = dRisk < 0 ? 'B' : 'A', other = safer === 'A' ? 'B' : 'A';
  const perPoint = r > 0.05 ? `, about <b>${money(n / r)} per risk point</b>` : '';
  return `<b>${names[safer]}</b> is safer by ${r.toFixed(1)} points of average risk, but earns ${money(n)} less than ${names[other].toLowerCase() === 'doing nothing' ? 'doing nothing' : names[other]} over ${horizon} days${perPoint}. Whether that's worth it is your call.`;
}

function bundleCard(slot, bundle, summary, active) {
  const items = bundle.length
    ? bundle.map(b => `<li>${esc(b.decision.name)} <span class="cmp-int">${Math.round(b.intensity * 100)}%</span></li>`).join('')
    : '<li class="muted">No decisions</li>';
  return `
    <div class="cmp-card slot-${slot.toLowerCase()} ${active ? 'active' : ''}">
      <div class="cmp-card-head">
        <span class="slot-tag slot-${slot.toLowerCase()}">${slot}</span>
        <span class="cmp-card-title">Bundle ${slot}</span>
        ${active ? '<span class="cmp-editing">editing in sidebar</span>'
                 : `<button class="btn btn-ghost btn-sm" data-act="edit" data-slot="${slot}">Edit ${slot}</button>`}
      </div>
      <ul class="cmp-list">${items}</ul>
      <div class="cmp-card-foot">${money(summary.decisionCostPerDay)} / day</div>
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
        <button class="btn btn-ghost btn-sm" data-act="copy" title="Replace B with a copy of A">${icon('copy')}Copy A to B</button>
        <button class="btn btn-ghost btn-sm" data-act="swap">${icon('arrowsLR')}Swap A and B</button>
      </div>
      ${bundleCard('B', B.bundle, B.summary, activeSlot === 'B')}
    </div>

    ${aEmpty && bEmpty ? `<p class="cmp-empty">Both bundles are empty. Load a preset or add decisions in the sidebar, then switch the sidebar to <b>B</b> and build an alternative.</p>` : ''}
    ${!aEmpty && bEmpty ? `<p class="cmp-empty">Bundle B is empty, so this compares A against doing nothing. <button class="btn btn-ghost btn-sm" data-act="copy">${icon('copy')}Copy A to B</button> and change one decision to see what it's worth.</p>` : ''}

    <p class="cmp-verdict">${verdict(A.summary, B.summary, horizon, { A: aEmpty ? 'Doing nothing' : 'A', B: bEmpty ? 'Doing nothing' : 'B' })}</p>

    <table class="cmp-table">
      <thead><tr><th scope="col">Over ${horizon} days</th><th scope="col"><span class="slot-tag slot-a">A</span></th><th scope="col"><span class="slot-tag slot-b">B</span></th><th scope="col">B vs A</th></tr></thead>
      <tbody>
        ${ROWS.map(r => `
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

    <h3 class="cmp-sub">Where they end up differently <span class="block-hint">day ${horizon}</span></h3>
    ${diffMetrics.length ? `
      <table class="cmp-table cmp-metrics">
        <thead><tr><th scope="col">Metric</th><th scope="col"><span class="slot-tag slot-a">A</span></th><th scope="col"><span class="slot-tag slot-b">B</span></th></tr></thead>
        <tbody>${diffMetrics.map(m => `
          <tr>
            <th scope="row">${m.name}</th>
            <td>${statusEmoji(A.summary.endStatus[m.id])} ${fmtMetric(A.summary.endMetrics[m.id], m.unit)}</td>
            <td>${statusEmoji(B.summary.endStatus[m.id])} ${fmtMetric(B.summary.endMetrics[m.id], m.unit)}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<p class="muted">Every metric ends within 1 % in both bundles.</p>'}
  `;

  const series = key => [
    { key: 'A', label: 'A', color: 'var(--series-a)', values: A.states.map(s => s.derived[key]) },
    { key: 'B', label: 'B', color: 'var(--series-b)', values: B.states.map(s => s.derived[key]) }
  ];
  lineChart(container.querySelector('#cmp-risk'), { title: 'Risk score', series: series('riskScore'), fmt: v => v.toFixed(1), yMin: 0 });
  lineChart(container.querySelector('#cmp-net'), { title: 'Net per day', series: series('net'), fmt: v => money(v), zeroLine: true });

  container.querySelectorAll('[data-act]').forEach(btn =>
    btn.addEventListener('click', () => onAction(btn.dataset.act, btn.dataset.slot)));
}
