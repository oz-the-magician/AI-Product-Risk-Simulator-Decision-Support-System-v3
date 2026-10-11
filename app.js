import { SCENARIOS } from './data/scenarios.js';
import { DECISIONS } from './data/decisions.js';
import { METRICS } from './data/metrics.js';
import { runSimulation } from './engine/simulator.js';
import { initTabs } from './ui/tabs.js';
import { renderDashboard } from './ui/render.dashboard.js';
import { renderTimeline } from './ui/render.timeline.js';
import { renderSensitivity } from './ui/render.sensitivity.js';
import { renderModel } from './ui/render.model.js';
import { fmtMoney, fmtPct } from './ui/format.js';
import { PRESETS, presetsFor, resolveBundle } from './data/presets.js';
import { summarize, explainRisk, tradeoffPoints } from './engine/analysis.js';
import { renderExplain } from './ui/render.explain.js';
import { renderCompare } from './ui/render.compare.js';
import { renderTradeoffs } from './ui/render.tradeoffs.js';
import { esc } from './ui/viz.js';

// ── State ───────────────────────────────────────────────────────────
const appState = {
  scenarioId: 'balanced_launch',
  horizonDays: 60,
  mcRuns: 300,
  bundles: { A: [], B: [] },   // two decision bundles to compare: [{ decision, intensity }]
  activeSlot: 'A',             // the one the sidebar edits and the other tabs show
  get bundle() { return this.bundles[this.activeSlot]; },
  set bundle(v) { this.bundles[this.activeSlot] = v; },
  selectedMetrics: ['incident_rate', 'abuse_rate', 'retention', 'dau'],
  activeTab: 'dashboard',
  simulationStates: null,
  mcResults: null,
  mcWorker: null,
  mcRunning: false,
  introDismissed: false,
};

const toStored = b => b.map(x => ({ decisionId: x.decision.id, intensity: x.intensity }));
const fromStored = arr => (arr || []).map(b => {
  const decision = DECISIONS.find(d => d.id === b.decisionId);
  return decision ? { decision, intensity: b.intensity } : null;
}).filter(Boolean);

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('aiRiskSimState');
    if (!saved) return;
    const data = JSON.parse(saved);
    if (data.scenarioId) appState.scenarioId = data.scenarioId;
    if (data.horizonDays) appState.horizonDays = data.horizonDays;
    if (data.mcRuns) appState.mcRuns = data.mcRuns;
    if (data.selectedMetrics) appState.selectedMetrics = data.selectedMetrics;
    if (data.bundles) {
      appState.bundles.A = fromStored(data.bundles.A);
      appState.bundles.B = fromStored(data.bundles.B);
    } else if (data.bundle) {
      appState.bundles.A = fromStored(data.bundle);   // older saves had one bundle
    }
    if (data.activeSlot === 'B') appState.activeSlot = 'B';
    appState.introDismissed = !!data.introDismissed;
  } catch(e) {}
}

function saveToStorage() {
  try {
    localStorage.setItem('aiRiskSimState', JSON.stringify({
      scenarioId: appState.scenarioId,
      horizonDays: appState.horizonDays,
      mcRuns: appState.mcRuns,
      selectedMetrics: appState.selectedMetrics,
      bundles: { A: toStored(appState.bundles.A), B: toStored(appState.bundles.B) },
      activeSlot: appState.activeSlot,
      introDismissed: appState.introDismissed
    }));
  } catch(e) {}
}

// ── Simulation ──────────────────────────────────────────────────────
function getScenario() {
  return SCENARIOS.find(s => s.id === appState.scenarioId);
}

function runDeterministicSim() {
  const scenario = getScenario();
  appState.simulationStates = runSimulation({
    scenario,
    bundle: appState.bundle,
    horizonDays: appState.horizonDays,
  });
  updateSummaryChips();
  renderActiveTab();
  saveToStorage();
}

function updateSummaryChips() {
  const states = appState.simulationStates;
  if (!states || states.length === 0) return;
  const last = states[states.length - 1];
  const mc = appState.mcResults;

  const riskVal = mc ? mc.risk.p50[mc.risk.p50.length - 1] : last.derived.riskScore;
  const tailVal = mc ? mc.tail.p50[mc.tail.p50.length - 1] : last.derived.tailRiskProb;
  const netVal  = mc ? mc.net.p50[mc.net.p50.length - 1]  : last.derived.net;

  const riskColor = riskVal > 60 ? 'chip-red' : riskVal > 30 ? 'chip-yellow' : 'chip-green';
  const tailColor = tailVal > 0.5 ? 'chip-red' : tailVal > 0.2 ? 'chip-yellow' : 'chip-green';
  const netColor  = netVal > 0 ? 'chip-green' : 'chip-red';

  document.getElementById('chip-risk').innerHTML = `<span class="chip-label">Risk · day ${appState.horizonDays}</span><span class="chip-value">${riskVal.toFixed(1)}</span>`;
  document.getElementById('chip-risk').className = `chip ${riskColor}`;
  document.getElementById('chip-tail').innerHTML = `<span class="chip-label">P(SEV) · day ${appState.horizonDays}</span><span class="chip-value">${fmtPct(tailVal)}</span>`;
  document.getElementById('chip-tail').className = `chip ${tailColor}`;
  document.getElementById('chip-net').innerHTML = `<span class="chip-label">Net/day</span><span class="chip-value">$${fmtMoney(netVal)}</span>`;
  document.getElementById('chip-net').className = `chip ${netColor}`;

  // Overall P(red)
  let maxRedProb = 0;
  if (mc?.breachProbs) {
    for (const bp of Object.values(mc.breachProbs)) {
      maxRedProb = Math.max(maxRedProb, bp.red);
    }
  }
  document.getElementById('chip-pred').innerHTML = `<span class="chip-label">P(red) max</span><span class="chip-value">${fmtPct(maxRedProb)}</span>`;
  document.getElementById('chip-pred').className = `chip ${maxRedProb > 0.3 ? 'chip-red' : maxRedProb > 0.1 ? 'chip-yellow' : 'chip-green'}`;
}

// ── Monte Carlo ─────────────────────────────────────────────────────
function startMonteCarlo() {
  if (appState.mcRunning) {
    cancelMonteCarlo();
    return;
  }

  const scenario = getScenario();
  appState.mcRunning = true;
  document.getElementById('mc-btn').textContent = 'Cancel';
  document.getElementById('mc-btn').classList.add('cancel');
  document.getElementById('mc-progress').style.display = 'block';
  document.getElementById('mc-progress-bar').style.width = '0%';
  document.getElementById('mc-status').textContent = 'Running...';

  const worker = new Worker(new URL('./engine/montecarlo.worker.js', import.meta.url), { type: 'module' });
  appState.mcWorker = worker;

  worker.postMessage({
    scenario,
    bundle: appState.bundle.map(b => ({ decision: b.decision, intensity: b.intensity })),
    horizonDays: appState.horizonDays,
    runs: appState.mcRuns,
  });

  worker.onmessage = (e) => {
    const { type, run, total, cancelled } = e.data;
    if (type === 'progress') {
      const pct = (run / total) * 100;
      document.getElementById('mc-progress-bar').style.width = pct.toFixed(1) + '%';
      document.getElementById('mc-status').textContent = `Run ${run}/${total}`;
    } else if (type === 'done') {
      appState.mcRunning = false;
      appState.mcWorker = null;
      document.getElementById('mc-btn').textContent = 'Run MC';
      document.getElementById('mc-btn').classList.remove('cancel');
      document.getElementById('mc-progress-bar').style.width = '100%';
      document.getElementById('mc-status').textContent = cancelled ? 'Cancelled' : `Done (${e.data.runs} runs)`;

      if (!cancelled) {
        appState.mcResults = {
          risk: e.data.risk,
          net: e.data.net,
          tail: e.data.tail,
          breachProbs: e.data.breachProbs,
          runs: e.data.runs,
        };
        updateSummaryChips();
        renderActiveTab();
      }
      worker.terminate();
    }
  };
}

function cancelMonteCarlo() {
  if (appState.mcWorker) {
    appState.mcWorker.postMessage({ type: 'cancel' });
  }
}

// ── Rendering ───────────────────────────────────────────────────────
function renderActiveTab() {
  const tab = appState.activeTab;
  const states = appState.simulationStates;
  const mc = appState.mcResults;
  const scenario = getScenario();

  if (tab === 'dashboard') {
    const pane = document.getElementById('tab-dashboard');
    if (!pane.querySelector('#dash-metrics')) {
      pane.innerHTML = '<div id="dash-explain"></div><div id="dash-metrics"></div>';
    }
    renderDashboard(pane.querySelector('#dash-metrics'), states, mc);
    scheduleExplain();
  } else if (tab === 'compare') {
    renderCompareTab();
  } else if (tab === 'tradeoffs') {
    renderTradeoffsTab();
  } else if (tab === 'timeline') {
    renderTimeline(document.getElementById('tab-timeline'), states, mc, scenario, appState.selectedMetrics);
  } else if (tab === 'sensitivity') {
    renderSensitivity(document.getElementById('tab-sensitivity'), scenario, appState.bundle, appState.horizonDays, mc);
  } else if (tab === 'model') {
    renderModel(document.getElementById('tab-model'));
  }
}

// ── Explain / Compare / Trade-offs ──────────────────────────────────
let explainTimer = null;
function scheduleExplain() {
  // Shapley attribution runs up to a few hundred simulations: debounce while sliders move
  clearTimeout(explainTimer);
  const target = document.getElementById('dash-explain');
  if (target && !target.innerHTML) target.innerHTML = '<p class="empty">Working out what moved the risk…</p>';
  explainTimer = setTimeout(() => {
    const el = document.getElementById('dash-explain');
    if (!el || appState.activeTab !== 'dashboard') return;
    const ex = explainRisk({ scenario: getScenario(), bundle: appState.bundle, horizonDays: appState.horizonDays });
    renderExplain(el, ex, appState.horizonDays);
  }, 180);
}

function slotResult(slot) {
  const bundle = appState.bundles[slot];
  const states = runSimulation({ scenario: getScenario(), bundle, horizonDays: appState.horizonDays });
  return { bundle, states, summary: summarize(states, bundle) };
}

function renderCompareTab() {
  renderCompare(document.getElementById('tab-compare'), {
    A: slotResult('A'), B: slotResult('B'),
    activeSlot: appState.activeSlot,
    horizon: appState.horizonDays,
    onAction: (act, slot) => {
      if (act === 'copy') appState.bundles.B = appState.bundles.A.map(b => ({ ...b }));
      if (act === 'swap') [appState.bundles.A, appState.bundles.B] = [appState.bundles.B, appState.bundles.A];
      if (act === 'edit') { setActiveSlot(slot); return; }
      bundleChanged();
    }
  });
}

let tradeoffCache = { key: '', points: null };
function renderTradeoffsTab() {
  const scenario = getScenario();
  const key = scenario.id + '|' + appState.horizonDays;
  if (tradeoffCache.key !== key) {
    // presets + every single decision: only depends on scenario and horizon
    tradeoffCache = {
      key,
      points: tradeoffPoints({
        scenario, horizonDays: appState.horizonDays, decisions: DECISIONS,
        extra: PRESETS.map(p => ({ label: p.name, kind: 'preset', bundle: resolveBundle(p, DECISIONS) }))
      })
    };
  }
  const slotPoint = slot => {
    const { summary, bundle } = slotResult(slot);
    return { label: 'Bundle ' + slot, kind: slot, bundle, avgRisk: summary.avgRisk, totalNet: summary.totalNet };
  };
  const pts = [...tradeoffCache.points.map(p => ({ ...p })), slotPoint('A')];
  if (appState.bundles.B.length) pts.push(slotPoint('B'));
  // A or B identical to a preset (e.g. just loaded): one dot, one combined label
  for (const slotPt of pts.filter(p => p.kind === 'A' || p.kind === 'B')) {
    const twins = pts.filter(q => q !== slotPt && Math.abs(q.avgRisk - slotPt.avgRisk) < 1e-6 && Math.abs(q.totalNet - slotPt.totalNet) < 0.5);
    for (const t of twins) t.hideLabel = true;
    const named = twins.find(t => t.kind === 'preset' || t.kind === 'single');
    if (named) slotPt.displayLabel = `${slotPt.label} · ${named.label}`;
  }
  // frontier is recomputed with A/B included, so a good custom bundle shows up as efficient
  for (const p of pts) p.onFrontier = !pts.some(q => q !== p && q.avgRisk <= p.avgRisk && q.totalNet >= p.totalNet && (q.avgRisk < p.avgRisk || q.totalNet > p.totalNet));
  renderTradeoffs(document.getElementById('tab-tradeoffs'), {
    points: pts, horizon: appState.horizonDays,
    onLoad: (p, slot) => {
      appState.bundles[slot] = p.bundle.map(b => ({ ...b }));
      if (appState.activeSlot !== slot) setActiveSlot(slot); else bundleChanged();
    }
  });
}

// Any change to a bundle: old Monte Carlo bands no longer describe it.
function bundleChanged() {
  appState.mcResults = null;
  document.getElementById('mc-status').textContent = '—';
  document.getElementById('mc-progress').style.display = 'none';
  renderDecisionLibrary();
  renderBundle();
  runDeterministicSim();
}

function setActiveSlot(slot) {
  appState.activeSlot = slot;
  document.querySelectorAll('.slot-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.slot === slot)));
  bundleChanged();
}

function loadPreset(id) {
  const p = PRESETS.find(x => x.id === id);
  if (!p) return;
  appState.bundle = resolveBundle(p, DECISIONS);
  bundleChanged();
}

function renderIntro() {
  const el = document.getElementById('intro');
  if (appState.introDismissed) { el.hidden = true; return; }
  el.hidden = false;
}

// ── Decision Bundle UI ───────────────────────────────────────────────
function renderDecisionLibrary() {
  const libEl = document.getElementById('decision-library');
  const categories = [...new Set(DECISIONS.map(d => d.category))];
  let html = '';
  for (const cat of categories) {
    html += `<div class="dec-category-label">${cat}</div>`;
    for (const d of DECISIONS.filter(x => x.category === cat)) {
      const inBundle = appState.bundle.some(b => b.decision.id === d.id);
      html += `
        <div class="dec-card ${inBundle ? 'in-bundle' : ''}" data-id="${d.id}">
          <span class="dec-name">${d.name}</span>
          <button class="dec-add-btn" data-id="${d.id}">${inBundle ? '✓' : '+'}</button>
        </div>
      `;
    }
  }
  libEl.innerHTML = html;

  libEl.querySelectorAll('.dec-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      toggleDecision(id);
    });
  });
}

function toggleDecision(id) {
  const decision = DECISIONS.find(d => d.id === id);
  if (!decision) return;
  const idx = appState.bundle.findIndex(b => b.decision.id === id);
  if (idx >= 0) {
    appState.bundle.splice(idx, 1);
  } else {
    appState.bundle.push({ decision, intensity: 0.5 });
  }
  bundleChanged();
}

function renderBundle() {
  const bundleEl = document.getElementById('active-bundle');
  if (appState.bundle.length === 0) {
    const presets = presetsFor(appState.scenarioId);
    bundleEl.innerHTML = `
      <div class="bundle-empty">
        <p class="empty-bundle">Bundle ${appState.activeSlot} is empty. Start from a ready-made bundle for <b>${esc(getScenario().name)}</b>, or add decisions with <b>+</b> above.</p>
        ${presets.map(p => `
          <button class="preset-card" data-preset="${p.id}">
            <span class="preset-name">${esc(p.name)}</span>
            <span class="preset-blurb">${esc(p.blurb)}</span>
          </button>`).join('')}
      </div>`;
    bundleEl.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => loadPreset(b.dataset.preset)));
    return;
  }

  let html = '';
  for (const item of appState.bundle) {
    const d = item.decision;
    const totalCost = d.cost.amountPerDay * item.intensity;
    html += `
      <div class="bundle-item" data-id="${d.id}">
        <div class="bundle-header">
          <span class="bundle-name">${d.name}</span>
          <button class="bundle-remove" data-id="${d.id}">×</button>
        </div>
        <div class="bundle-meta">
          <span class="badge-cost">$${Math.round(totalCost)}/day</span>
          ${d.latencyImpactMs !== 0 ? `<span class="badge-latency">${d.latencyImpactMs > 0 ? '+' : ''}${d.latencyImpactMs}ms</span>` : ''}
          <span class="badge-type">${d.cost.type}</span>
        </div>
        <div class="intensity-row">
          <span class="intensity-label">Intensity</span>
          <input type="range" min="0" max="1" step="0.05" value="${item.intensity}"
            class="intensity-slider" data-id="${d.id}">
          <span class="intensity-val">${(item.intensity * 100).toFixed(0)}%</span>
        </div>
      </div>
    `;
  }
  bundleEl.innerHTML = html;

  bundleEl.querySelectorAll('.bundle-remove').forEach(btn => {
    btn.addEventListener('click', () => toggleDecision(btn.dataset.id));
  });

  bundleEl.querySelectorAll('.intensity-slider').forEach(slider => {
    slider.addEventListener('input', e => {
      const id = e.target.dataset.id;
      const item = appState.bundle.find(b => b.decision.id === id);
      if (item) {
        item.intensity = parseFloat(e.target.value);
        e.target.nextElementSibling.textContent = (item.intensity * 100).toFixed(0) + '%';
        e.target.closest('.bundle-item').querySelector('.badge-cost').textContent =
          '$' + Math.round(item.decision.cost.amountPerDay * item.intensity) + '/day';
        appState.mcResults = null;
        runDeterministicSim();
      }
    });
  });
}

// ── Export / Import ──────────────────────────────────────────────────
function exportConfig() {
  const config = {
    scenarioId: appState.scenarioId,
    horizonDays: appState.horizonDays,
    mcRuns: appState.mcRuns,
    selectedMetrics: appState.selectedMetrics,
    bundles: { A: toStored(appState.bundles.A), B: toStored(appState.bundles.B) }
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ai-risk-config.json'; a.click();
  URL.revokeObjectURL(url);
}

function importConfig(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.scenarioId) appState.scenarioId = data.scenarioId;
      if (data.horizonDays) appState.horizonDays = data.horizonDays;
      if (data.mcRuns) appState.mcRuns = data.mcRuns;
      if (data.selectedMetrics) appState.selectedMetrics = data.selectedMetrics;
      if (data.bundles) {
        appState.bundles.A = fromStored(data.bundles.A);
        appState.bundles.B = fromStored(data.bundles.B);
      } else if (data.bundle) {
        appState.bundles.A = fromStored(data.bundle);
        appState.bundles.B = [];
      }
      appState.mcResults = null;
      document.getElementById('scenario-select').value = appState.scenarioId;
      document.getElementById('horizon-select').value = appState.horizonDays;
      document.getElementById('mc-runs-input').value = appState.mcRuns;
      renderDecisionLibrary();
      renderBundle();
      runDeterministicSim();
    } catch(err) {
      alert('Invalid config file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ── Init ─────────────────────────────────────────────────────────────
function init() {
  loadFromStorage();

  // Populate scenario select
  const scenarioSelect = document.getElementById('scenario-select');
  for (const s of SCENARIOS) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    if (s.id === appState.scenarioId) opt.selected = true;
    scenarioSelect.appendChild(opt);
  }

  scenarioSelect.addEventListener('change', e => {
    appState.scenarioId = e.target.value;
    appState.mcResults = null;
    renderBundle();
    runDeterministicSim();
  });

  document.getElementById('horizon-select').value = appState.horizonDays;
  document.getElementById('horizon-select').addEventListener('change', e => {
    appState.horizonDays = parseInt(e.target.value);
    appState.mcResults = null;
    runDeterministicSim();
  });

  document.getElementById('mc-runs-input').value = appState.mcRuns;
  document.getElementById('mc-runs-input').addEventListener('change', e => {
    appState.mcRuns = Math.max(100, Math.min(2000, parseInt(e.target.value) || 300));
  });

  document.getElementById('mc-btn').addEventListener('click', startMonteCarlo);
  document.getElementById('export-btn').addEventListener('click', exportConfig);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', e => {
    if (e.target.files[0]) importConfig(e.target.files[0]);
  });

  initTabs(tab => {
    appState.activeTab = tab;
    if (tab === 'model') renderModel(document.getElementById('tab-model'));
    else renderActiveTab();
  });

  document.querySelectorAll('.slot-btn').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.slot === appState.activeSlot));
    b.addEventListener('click', () => setActiveSlot(b.dataset.slot));
  });
  document.getElementById('intro-close').addEventListener('click', () => {
    appState.introDismissed = true; saveToStorage(); renderIntro();
  });
  document.querySelectorAll('[data-intro-preset]').forEach(b => b.addEventListener('click', () => {
    const p = presetsFor(appState.scenarioId)[0];
    if (p) loadPreset(p.id);
  }));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => {
    document.querySelector(`.tab-btn[data-tab="${b.dataset.goto}"]`).click();
  }));

  renderIntro();
  renderDecisionLibrary();
  renderBundle();
  runDeterministicSim();
}

document.addEventListener('DOMContentLoaded', init);
