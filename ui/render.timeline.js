import { L, t } from './i18n.js';
import { icon } from './icons.js';
import { METRICS } from '../data/metrics.js';
import { fmtMetric, fmtMoney } from './format.js';

const CHART_PADDING = { top: 30, right: 20, bottom: 40, left: 65 };

function clearCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

function getChartDims(canvas) {
  return {
    w: canvas.width - CHART_PADDING.left - CHART_PADDING.right,
    h: canvas.height - CHART_PADDING.top - CHART_PADDING.bottom,
    ox: CHART_PADDING.left,
    oy: CHART_PADDING.top
  };
}

function drawAxes(ctx, dims, minY, maxY, horizon, label, fmt) {
  const { w, h, ox, oy } = dims;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;

  // Grid
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = oy + h - (i / yTicks) * h;
    const val = minY + (i / yTicks) * (maxY - minY);
    ctx.beginPath();
    ctx.moveTo(ox, y);
    ctx.lineTo(ox + w, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px "Martian Mono", ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(fmt ? fmt(val) : val.toFixed(1), ox - 6, y + 4);
  }

  const xTicks = Math.min(6, horizon);
  for (let i = 0; i <= xTicks; i++) {
    const x = ox + (i / xTicks) * w;
    const day = Math.round((i / xTicks) * horizon);
    ctx.beginPath();
    ctx.moveTo(x, oy);
    ctx.lineTo(x, oy + h);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px "Martian Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(L('d', 'д') + day, x, oy + h + 18);
  }

  // Label
  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '600 12.5px "Sora", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, ox + w / 2, oy - 10);
  }
  ctx.restore();
}

function drawBand(ctx, dims, data10, data90, minY, maxY, color) {
  const { w, h, ox, oy } = dims;
  if (!data10 || !data90) return;
  ctx.save();
  ctx.beginPath();
  const n = data10.length;
  for (let i = 0; i < n; i++) {
    const x = ox + (i / (n - 1)) * w;
    const y = oy + h - ((data10[i] - minY) / (maxY - minY)) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  for (let i = n - 1; i >= 0; i--) {
    const x = ox + (i / (n - 1)) * w;
    const y = oy + h - ((data90[i] - minY) / (maxY - minY)) * h;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color.replace(')', ',0.15)').replace('rgb', 'rgba');
  ctx.fill();
  ctx.restore();
}

function drawLine(ctx, dims, data, minY, maxY, color, lineWidth = 2) {
  const { w, h, ox, oy } = dims;
  if (!data || data.length === 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const n = data.length;
  for (let i = 0; i < n; i++) {
    const x = ox + (i / (n - 1)) * w;
    const y = oy + h - ((data[i] - minY) / (maxY - minY)) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawShockMarkers(ctx, dims, shocks, horizon) {
  const { w, h, ox, oy } = dims;
  ctx.save();
  for (const shock of (shocks || [])) {
    const x = ox + (shock.day / horizon) * w;
    ctx.strokeStyle = 'rgba(242, 182, 64, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, oy);
    ctx.lineTo(x, oy + h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(242, 182, 64, 0.95)';
    ctx.font = '10px "Martian Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', x, oy + 8);
  }
  ctx.restore();
}

export function renderTimeline(container, states, mcResults, scenario, selectedMetrics) {
  if (!states || states.length === 0) {
    container.innerHTML = '<p class="empty">Run a simulation first.</p>';
    return;
  }

  const horizon = states.length - 1;

  // Build selector for metrics
  const metricOptions = METRICS.map(m =>
    `<button type="button" class="metric-pick" data-id="${m.id}" aria-pressed="${selectedMetrics.includes(m.id)}">${icon('check', 'ic-sm')}${t(m.name)}</button>`
  ).join('');

  container.innerHTML = `
    <div class="timeline-controls">
      <div class="metric-picker" role="group" aria-labelledby="metric-picker-label">
        <span id="metric-picker-label" class="metric-picker-label">${L('Key metrics', 'Ключевые метрики')}</span>
        ${metricOptions}
      </div>
    </div>
    <div class="charts-grid">
      <div class="chart-wrap"><canvas id="chart-risk" width="560" height="240"></canvas></div>
      <div class="chart-wrap"><canvas id="chart-net" width="560" height="240"></canvas></div>
      ${selectedMetrics.map(id => `<div class="chart-wrap"><canvas id="chart-m-${id}" width="560" height="200"></canvas></div>`).join('')}
    </div>
  `;

  container.querySelectorAll('.metric-pick').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    const selected = selectedMetrics.includes(id) ? selectedMetrics.filter(x => x !== id) : [...selectedMetrics, id];
    renderTimeline(container, states, mcResults, scenario, selected);
    container.querySelector(`.metric-pick[data-id="${id}"]`)?.focus();
  }));

  // Risk chart
  drawRiskChart(document.getElementById('chart-risk'), states, mcResults, horizon, scenario);
  drawNetChart(document.getElementById('chart-net'), states, mcResults, horizon, scenario);

  for (const id of selectedMetrics) {
    const c = document.getElementById(`chart-m-${id}`);
    if (c) drawMetricChart(c, states, id, horizon, scenario);
  }
}

function drawRiskChart(canvas, states, mcResults, horizon, scenario) {
  const ctx = clearCanvas(canvas);
  const det = states.map(s => s.derived.riskScore);
  const p10 = mcResults?.risk?.p10;
  const p50 = mcResults?.risk?.p50;
  const p90 = mcResults?.risk?.p90;

  const allVals = [...det, ...(p90 || []), ...(p10 || [])].filter(v => !isNaN(v));
  const minY = 0;
  const maxY = Math.min(100, Math.max(20, Math.max(...allVals) * 1.1));

  const dims = getChartDims(canvas);
  drawAxes(ctx, dims, minY, maxY, horizon, L('Risk score (0 to 100)', 'Оценка риска (от 0 до 100)'), v => v.toFixed(0));
  drawShockMarkers(ctx, dims, scenario?.shocks, horizon);

  if (p10 && p90) drawBand(ctx, dims, p10, p90, minY, maxY, 'rgb(240,89,91)');
  if (p50) drawLine(ctx, dims, p50, minY, maxY, 'rgba(255,160,160,0.8)', 1.5);
  drawLine(ctx, dims, det, minY, maxY, 'rgb(240,89,91)', 2.5);
}

function drawNetChart(canvas, states, mcResults, horizon, scenario) {
  const ctx = clearCanvas(canvas);
  const det = states.map(s => s.derived.net);
  const p10 = mcResults?.net?.p10;
  const p50 = mcResults?.net?.p50;
  const p90 = mcResults?.net?.p90;

  const allVals = [...det, ...(p90 || []), ...(p10 || [])].filter(v => !isNaN(v));
  const minY = Math.min(0, Math.min(...allVals) * 1.1);
  const maxY = Math.max(0, Math.max(...allVals) * 1.1);

  const dims = getChartDims(canvas);
  drawAxes(ctx, dims, minY, maxY, horizon, L('Net revenue ($/day)', 'Чистая выручка ($/день)'), v => '$' + (v/1000).toFixed(1) + 'k');
  drawShockMarkers(ctx, dims, scenario?.shocks, horizon);

  // Zero line
  const { w, h, ox, oy } = dims;
  if (minY < 0 && maxY > 0) {
    const zy = oy + h - ((0 - minY) / (maxY - minY)) * h;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(ox, zy);
    ctx.lineTo(ox + w, zy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (p10 && p90) drawBand(ctx, dims, p10, p90, minY, maxY, 'rgb(75,208,142)');
  if (p50) drawLine(ctx, dims, p50, minY, maxY, 'rgba(150,230,190,0.8)', 1.5);
  drawLine(ctx, dims, det, minY, maxY, 'rgb(75,208,142)', 2.5);
}

function drawMetricChart(canvas, states, metricId, horizon, scenario) {
  const m = METRICS.find(x => x.id === metricId);
  if (!m) return;
  const ctx = clearCanvas(canvas);
  const det = states.map(s => s.metrics[metricId]);

  const allVals = det.filter(v => !isNaN(v));
  const pad = Math.abs(m.baseline) * 0.3 || 1;
  const minY = Math.max(0, Math.min(...allVals) - pad);
  const maxY = Math.max(...allVals) + pad;

  const dims = getChartDims(canvas);
  drawAxes(ctx, dims, minY, maxY, horizon, t(m.name), v => fmtMetric(v, m.unit));
  drawShockMarkers(ctx, dims, scenario?.shocks?.filter(s => s.metricId === metricId), horizon);

  // Guardrail lines
  const { w, h, ox, oy } = dims;
  for (const [level, color] of [['yellow', '#F2B640'], ['red', '#F0595B']]) {
    const gVal = m.guardrails[level];
    if (gVal !== undefined && gVal >= minY && gVal <= maxY) {
      const gy = oy + h - ((gVal - minY) / (maxY - minY)) * h;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(ox, gy);
      ctx.lineTo(ox + w, gy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  const lineColor = m.better === 'low' ? 'rgb(169,199,255)' : 'rgb(127,227,194)';
  drawLine(ctx, dims, det, minY, maxY, lineColor, 2);
}
