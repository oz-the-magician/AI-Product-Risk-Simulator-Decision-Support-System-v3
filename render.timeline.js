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
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
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
    ctx.font = '11px "JetBrains Mono", monospace';
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
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('d' + day, x, oy + h + 18);
  }

  // Label
  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px "JetBrains Mono", monospace';
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
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, oy);
    ctx.lineTo(x, oy + h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
    ctx.font = '9px monospace';
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
    `<option value="${m.id}" ${selectedMetrics.includes(m.id) ? 'selected' : ''}>${m.name}</option>`
  ).join('');

  container.innerHTML = `
    <div class="timeline-controls">
      <label>Key Metrics:
        <select id="metric-select" multiple size="5" style="min-width:220px">${metricOptions}</select>
      </label>
    </div>
    <div class="charts-grid">
      <div class="chart-wrap"><canvas id="chart-risk" width="560" height="240"></canvas></div>
      <div class="chart-wrap"><canvas id="chart-net" width="560" height="240"></canvas></div>
      ${selectedMetrics.map(id => `<div class="chart-wrap"><canvas id="chart-m-${id}" width="560" height="200"></canvas></div>`).join('')}
    </div>
  `;

  document.getElementById('metric-select').addEventListener('change', e => {
    const selected = Array.from(e.target.selectedOptions).map(o => o.value);
    renderTimeline(container, states, mcResults, scenario, selected);
  });

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
  drawAxes(ctx, dims, minY, maxY, horizon, 'Risk Score (0–100)', v => v.toFixed(0));
  drawShockMarkers(ctx, dims, scenario?.shocks, horizon);

  if (p10 && p90) drawBand(ctx, dims, p10, p90, minY, maxY, 'rgb(255,95,95)');
  if (p50) drawLine(ctx, dims, p50, minY, maxY, 'rgba(255,150,150,0.8)', 1.5);
  drawLine(ctx, dims, det, minY, maxY, 'rgb(255,80,80)', 2.5);
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
  drawAxes(ctx, dims, minY, maxY, horizon, 'Net Revenue ($/day)', v => '$' + (v/1000).toFixed(1) + 'k');
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

  if (p10 && p90) drawBand(ctx, dims, p10, p90, minY, maxY, 'rgb(80,200,120)');
  if (p50) drawLine(ctx, dims, p50, minY, maxY, 'rgba(130,220,160,0.8)', 1.5);
  drawLine(ctx, dims, det, minY, maxY, 'rgb(80,220,130)', 2.5);
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
  drawAxes(ctx, dims, minY, maxY, horizon, m.name, v => fmtMetric(v, m.unit));
  drawShockMarkers(ctx, dims, scenario?.shocks?.filter(s => s.metricId === metricId), horizon);

  // Guardrail lines
  const { w, h, ox, oy } = dims;
  for (const [level, color] of [['yellow', '#ffd700'], ['red', '#ff4444']]) {
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

  const lineColor = m.better === 'low' ? 'rgb(80,180,255)' : 'rgb(130,220,100)';
  drawLine(ctx, dims, det, minY, maxY, lineColor, 2);
}
