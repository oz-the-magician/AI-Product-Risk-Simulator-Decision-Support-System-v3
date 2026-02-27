import { METRICS } from '../data/metrics.js';
import { fmtMetric, fmtPct, statusEmoji, statusColor } from './format.js';

export function renderDashboard(container, states, mcResults) {
  if (!states || states.length === 0) {
    container.innerHTML = '<p class="empty">Run a simulation first.</p>';
    return;
  }

  const lastState = states[states.length - 1];
  const categories = ['Hard', 'Balance', 'Growth'];

  let html = '';
  for (const cat of categories) {
    const catMetrics = METRICS.filter(m => m.category === cat);
    let catStatus = 'green';

    // Determine category-level worst status
    for (const m of catMetrics) {
      const status = lastState.flags.guardrailBreaches[m.id] || 'green';
      if (status === 'red') catStatus = 'red';
      else if (status === 'yellow' && catStatus !== 'red') catStatus = 'yellow';
    }

    html += `
      <div class="metric-category">
        <div class="cat-header">
          <span class="cat-status-dot" style="background:${statusColor(catStatus)}"></span>
          <span class="cat-name">${cat}</span>
          <span class="cat-badge" style="color:${statusColor(catStatus)}">${statusEmoji(catStatus)}</span>
        </div>
        <table class="metric-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Baseline</th>
              <th>Current</th>
              <th>Guardrail 🟡</th>
              <th>Status</th>
              ${mcResults ? '<th>P(breach yellow)</th><th>P(breach red)</th>' : ''}
            </tr>
          </thead>
          <tbody>
    `;

    for (const m of catMetrics) {
      const cur = lastState.metrics[m.id];
      const status = lastState.flags.guardrailBreaches[m.id] || 'green';
      const guardrailVal = m.guardrails.yellow;
      const bp = mcResults?.breachProbs?.[m.id];

      html += `
        <tr class="metric-row status-${status}">
          <td class="metric-name-cell">
            <span class="metric-name">${m.name}</span>
            <span class="metric-desc">${m.description}</span>
          </td>
          <td>${fmtMetric(m.baseline, m.unit)}</td>
          <td class="metric-current" style="color:${statusColor(status)}">${fmtMetric(cur, m.unit)}</td>
          <td>${fmtMetric(guardrailVal, m.unit)}</td>
          <td>${statusEmoji(status)}</td>
          ${mcResults ? `
            <td class="breach-prob">${bp ? fmtPct(bp.yellow) : '—'}</td>
            <td class="breach-prob ${bp && bp.red > 0.3 ? 'high-risk' : ''}">${bp ? fmtPct(bp.red) : '—'}</td>
          ` : ''}
        </tr>
      `;
    }

    html += `</tbody></table></div>`;
  }

  container.innerHTML = html;
}
