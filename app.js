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

// ── State ───────────────────────────────────────────────────────────
const appState = {
  scenarioId: 'balanced_launch',
  horizonDays: 60,
  mcRuns: 300,
  bundle: [],          // [{ decision, intensity }]
  selectedMetrics: ['incident_rate', 'abuse_rate', 'retention', 'dau'],
  activeTab: 'dashboard',
  simulationStates: null,
  mcResults: null,
  mcWorker: null,
  mcRunning: false,
};

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('aiRiskSimState');
    if (!saved) return;
    const data = JSON.parse(saved);
    if (data.scenarioId) appState.scenarioId = data.scenarioId;
    if (data.horizonDays) appState.horizonDays = data.horizonDays;
    if (data.mcRuns) appState.mcRuns = data.mcRuns;
    if (data.selectedMetrics) appState.selectedMetrics = data.selectedMetrics;
    if (data.bundle) {
      appState.bundle = data.bundle.map(b => {
        const decision = DECISIONS.find(d => d.id === b.decisionId);
        return decision ? { decision, intensity: b.intensity } : null;
      }).filter(Boolean);
    }
  } catch(e) {}
}

function saveToStorage() {
  try {
    localStorage.setItem('aiRiskSimState', JSON.stringify({
      scenarioId: appState.scenarioId,
      horizonDays: appState.horizonDays,
      mcRuns: appState.mcRuns,
      selectedMetrics: appState.selectedMetrics,
      bundle: appState.bundle.map(b => ({ decisionId: b.decision.id, intensity: b.intensity }))
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

  document.getElementById('chip-risk').innerHTML = `<span class="chip-label">Risk Score</span><span class="chip-value">${riskVal.toFixed(1)}</span>`;
  document.getElementById('chip-risk').className = `chip ${riskColor}`;
  document.getElementById('chip-tail').innerHTML = `<span class="chip-label">P(SEV)</span><span class="chip-value">${fmtPct(tailVal)}</span>`;
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
    renderDashboard(document.getElementById('tab-dashboard'), states, mc);
  } else if (tab === 'timeline') {
    renderTimeline(document.getElementById('tab-timeline'), states, mc, scenario, appState.selectedMetrics);
  } else if (tab === 'sensitivity') {
    renderSensitivity(document.getElementById('tab-sensitivity'), scenario, appState.bundle, appState.horizonDays, mc);
  } else if (tab === 'model') {
    renderModel(document.getElementById('tab-model'));
  }
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
  renderDecisionLibrary();
  renderBundle();
  runDeterministicSim();
}

function renderBundle() {
  const bundleEl = document.getElementById('active-bundle');
  if (appState.bundle.length === 0) {
    bundleEl.innerHTML = '<p class="empty-bundle">No decisions active. Add from the library.</p>';
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
    bundle: appState.bundle.map(b => ({ decisionId: b.decision.id, intensity: b.intensity }))
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
      if (data.bundle) {
        appState.bundle = data.bundle.map(b => {
          const decision = DECISIONS.find(d => d.id === b.decisionId);
          return decision ? { decision, intensity: b.intensity } : null;
        }).filter(Boolean);
      }
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

  renderDecisionLibrary();
  renderBundle();
  runDeterministicSim();
}

document.addEventListener('DOMContentLoaded', init);
