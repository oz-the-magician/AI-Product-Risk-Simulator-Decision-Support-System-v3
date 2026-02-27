import { METRICS } from '../data/metrics.js';
import { DECISIONS } from '../data/decisions.js';
import { runSimulation } from '../engine/simulator.js';

export function renderSensitivity(container, scenario, bundle, horizonDays, mcResults) {
  container.innerHTML = `
    <div class="sensitivity-controls">
      <div class="sens-mode-tabs">
        <button class="sens-tab active" data-mode="ota">One-at-a-Time</button>
        <button class="sens-tab" data-mode="tornado">Tornado Chart</button>
      </div>
      <div id="sens-ota" class="sens-panel active">
        <div class="ota-controls">
          <label>Decision:
            <select id="ota-decision-select" class="styled-select">
              ${DECISIONS.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="charts-grid">
          <div class="chart-wrap"><canvas id="sens-risk-chart" width="560" height="240"></canvas></div>
          <div class="chart-wrap"><canvas id="sens-net-chart" width="560" height="240"></canvas></div>
        </div>
      </div>
      <div id="sens-tornado" class="sens-panel" style="display:none">
        ${mcResults ? renderTornado(mcResults) : '<p class="empty">Run Monte Carlo first to see tornado chart.</p>'}
      </div>
    </div>
  `;

  const tabs = container.querySelectorAll('.sens-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const mode = tab.dataset.mode;
      container.querySelector('#sens-ota').style.display = mode === 'ota' ? '' : 'none';
      container.querySelector('#sens-tornado').style.display = mode === 'tornado' ? '' : 'none';
    });
  });

  const decisionSelect = container.querySelector('#ota-decision-select');
  function updateOTA() {
    drawOTACurves(container, decisionSelect.value, scenario, bundle, horizonDays);
  }
  decisionSelect.addEventListener('change', updateOTA);
  updateOTA();
}

function drawOTACurves(container, decisionId, scenario, bundle, horizonDays) {
  const decision = DECISIONS.find(d => d.id === decisionId);
  if (!decision) return;

  const steps = 10;
  const riskVals = [], netVals = [];

  for (let i = 0; i <= steps; i++) {
    const intensity = i / steps;
    // Create bundle with this decision at this intensity
    const testBundle = bundle.filter(b => b.decision.id !== decisionId);
    testBundle.push({ decision, intensity });

    const states = runSimulation({ scenario, bundle: testBundle, horizonDays });
    const lastState = states[states.length - 1];
    riskVals.push(lastState.derived.riskScore);
    netVals.push(lastState.derived.net);
  }

  const PADDING = { top: 30, right: 20, bottom: 45, left: 65 };

  function drawCurve(canvasId, values, label, color) {
    const canvas = container.querySelector(`#${canvasId}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width - PADDING.left - PADDING.right;
    const h = canvas.height - PADDING.top - PADDING.bottom;
    const ox = PADDING.left, oy = PADDING.top;

    const minY = Math.min(...values) * 0.95;
    const maxY = Math.max(...values) * 1.05;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = oy + h - (i / 5) * h;
      const val = minY + (i / 5) * (maxY - minY);
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + w, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(0), ox - 6, y + 4);
    }
    for (let i = 0; i <= steps; i++) {
      const x = ox + (i / steps) * w;
      ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + h); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText((i/10).toFixed(1), x, oy + h + 16);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Intensity →', ox + w / 2, oy + h + 34);
    ctx.fillText(label, ox + w / 2, oy - 10);

    // Curve
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = ox + (i / steps) * w;
      const y = oy + h - ((v - minY) / (maxY - minY)) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dot at current intensity
    const curBundle = bundle.find(b => b.decision.id === decisionId);
    if (curBundle) {
      const ix = curBundle.intensity;
      const ci = Math.round(ix * steps);
      const x = ox + ix * w;
      const y = oy + h - ((values[ci] - minY) / (maxY - minY)) * h;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCurve('sens-risk-chart', riskVals, 'Risk Score vs Intensity', 'rgb(255,80,80)');
  drawCurve('sens-net-chart', netVals, 'Net Revenue vs Intensity ($)', 'rgb(80,220,130)');
}

function renderTornado(mcResults) {
  // Sort metrics by breach probability for tornado
  const metrics = METRICS.map ? null : null;
  const bp = mcResults.breachProbs;
  if (!bp) return '<p class="empty">No Monte Carlo data available.</p>';

  import('../data/metrics.js').then(({ METRICS }) => {
    // handled via inline rendering
  });

  const entries = Object.entries(bp)
    .map(([id, probs]) => ({ id, redProb: probs.red, yellowProb: probs.yellow }))
    .sort((a, b) => b.redProb - a.redProb)
    .slice(0, 12);

  return `
    <div class="tornado-chart">
      <h3 class="chart-title">Breach Probability by Metric (Monte Carlo)</h3>
      ${entries.map(e => `
        <div class="tornado-row">
          <span class="tornado-label">${e.id}</span>
          <div class="tornado-bar-wrap">
            <div class="tornado-bar yellow" style="width:${(e.yellowProb * 100).toFixed(1)}%"></div>
            <div class="tornado-bar red" style="width:${(e.redProb * 100).toFixed(1)}%"></div>
          </div>
          <span class="tornado-val">${(e.redProb * 100).toFixed(1)}%</span>
        </div>
      `).join('')}
      <div class="tornado-legend">
        <span class="leg-item"><span class="leg-dot" style="background:#ffd700"></span> Yellow breach</span>
        <span class="leg-item"><span class="leg-dot" style="background:#ff4444"></span> Red breach</span>
      </div>
    </div>
  `;
}
