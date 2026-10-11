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
import { icon } from './ui/icons.js';
import { PRESETS, presetsFor, resolveBundle } from './data/presets.js';
import { summarize, explainRisk, tradeoffPoints } from './engine/analysis.js';
import { renderExplain } from './ui/render.explain.js';
import { renderCompare } from './ui/render.compare.js';
import { renderTradeoffs } from './ui/render.tradeoffs.js';
import { esc } from './ui/viz.js';
import { createTour } from './ui/tour.js';
import { L, t, getLang, setLang, applyStatic } from './ui/i18n.js';

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
  tourSeen: false,
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
    appState.tourSeen = !!(data.tourSeen || data.introDismissed);
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
      tourSeen: appState.tourSeen
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

  document.getElementById('chip-risk').innerHTML = `<span class="chip-label">${L('Risk · day', 'Риск · день')} ${appState.horizonDays}</span><span class="chip-value">${riskVal.toFixed(1)}</span>`;
  document.getElementById('chip-risk').className = `chip ${riskColor}`;
  const orb = document.getElementById('risk-orb');
  if (orb) {
    orb.dataset.band = riskVal > 60 ? 'high' : riskVal > 30 ? 'mid' : 'low';
    orb.style.setProperty('--risk', Math.max(0, Math.min(1, riskVal / 100)).toFixed(3));
    document.getElementById('orb-value').textContent = Math.round(riskVal);
  }
  document.getElementById('chip-tail').innerHTML = `<span class="chip-label">P(SEV) · ${L('day', 'день')} ${appState.horizonDays}</span><span class="chip-value">${fmtPct(tailVal)}</span>`;
  document.getElementById('chip-tail').className = `chip ${tailColor}`;
  document.getElementById('chip-net').innerHTML = `<span class="chip-label">${L('Net/day', 'Чистыми/день')}</span><span class="chip-value">${netVal < 0 ? '−$' : '$'}${fmtMoney(Math.abs(netVal))}</span>`;
  document.getElementById('chip-net').className = `chip ${netColor}`;

  // Overall P(red)
  let maxRedProb = 0;
  if (mc?.breachProbs) {
    for (const bp of Object.values(mc.breachProbs)) {
      maxRedProb = Math.max(maxRedProb, bp.red);
    }
  }
  document.getElementById('chip-pred').innerHTML = `<span class="chip-label">${L('P(red) max', 'Макс. P(красн.)')}</span><span class="chip-value">${fmtPct(maxRedProb)}</span>`;
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
  document.getElementById('mc-btn').textContent = L('Cancel', 'Отменить');
  document.getElementById('mc-btn').classList.add('cancel');
  document.getElementById('mc-progress').style.display = 'block';
  document.getElementById('mc-progress-bar').style.width = '0%';
  document.getElementById('mc-status').textContent = L('Running…', 'Считаю…');

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
      document.getElementById('mc-status').textContent = `${L('Run', 'Прогон')} ${run}/${total}`;
    } else if (type === 'done') {
      appState.mcRunning = false;
      appState.mcWorker = null;
      document.getElementById('mc-btn').textContent = L('Run MC', 'Запустить MC');
      document.getElementById('mc-btn').classList.remove('cancel');
      document.getElementById('mc-progress-bar').style.width = '100%';
      document.getElementById('mc-status').textContent = cancelled ? L('Cancelled', 'Отменено') : L(`Done (${e.data.runs} runs)`, `Готово (${e.data.runs} прогонов)`);

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
  if (target && !target.innerHTML) target.innerHTML = `<p class="empty">${L('Working out what moved the risk…', 'Считаю, что сдвинуло риск…')}</p>`;
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
  const key = scenario.id + '|' + appState.horizonDays + '|' + getLang();
  if (tradeoffCache.key !== key) {
    // presets + every single decision: only depends on scenario and horizon
    tradeoffCache = {
      key,
      points: tradeoffPoints({
        scenario, horizonDays: appState.horizonDays, decisions: DECISIONS,
        extra: PRESETS.map(p => ({ label: t(p.name), kind: 'preset', bundle: resolveBundle(p, DECISIONS) }))
      })
    };
  }
  const slotPoint = slot => {
    const { summary, bundle } = slotResult(slot);
    return { label: L('Bundle ', 'Набор ') + slot, kind: slot, bundle, avgRisk: summary.avgRisk, totalNet: summary.totalNet };
  };
  const pts = [...tradeoffCache.points.map(p => ({ ...p, label: p.kind === 'single' ? t(p.label) : p.kind === 'none' ? L('No decisions', 'Без решений') : p.label })), slotPoint('A')];
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

// ── Guided tour ──────────────────────────────────────────────────────
const goTab = tab => () => {
  const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (!btn.classList.contains('active')) btn.click();
  document.querySelector('.tabs-content')?.scrollTo({ top: 0 });
};
// Titles and bodies are getters, so the tour speaks whichever language is on when it opens.
const step = (o, en, ru) => Object.assign(o, {
  get title() { return L(en.title, ru.title); },
  get body() { return L(en.body, ru.body); }
});
const TOUR_STEPS = [
  step({ target: null }, {
    title: 'Keep an AI product safe without killing growth',
    body: `<p>This simulator lets you try safety decisions before you commit to them: what they do to risk, to users and to money over the next weeks.</p>
           <p class="tour-note">The model is illustrative: plausible, made-up numbers for a consumer AI product. About a minute; <kbd>→</kbd> next, <kbd>Esc</kbd> to leave.</p>`
  }, {
    title: 'Защитить AI-продукт и не убить рост',
    body: `<p>Здесь можно опробовать решения по безопасности до того, как вы на них решитесь: что они сделают с риском, пользователями и деньгами за ближайшие недели.</p>
           <p class="tour-note">Модель иллюстративная: правдоподобные, но выдуманные цифры для потребительского AI-продукта. Займёт около минуты; <kbd>→</kbd> дальше, <kbd>Esc</kbd> выйти.</p>`
  }),
  step({ target: () => document.getElementById('scenario-select').closest('.control-group') }, {
    title: '1 · Pick a scenario',
    body: `<p>A calm launch, an aggressive growth push or a safety crisis. Each one comes with its own events: traffic spikes, an abuse wave, a viral incident.</p>
           <p>Next to it, <b>Horizon</b> sets how many days are simulated.</p>`
  }, {
    title: '1 · Выберите сценарий',
    body: `<p>Спокойный запуск, агрессивный рост или кризис безопасности. У каждого свои события: всплески трафика, волна злоупотреблений, громкий инцидент.</p>
           <p>Рядом <b>Горизонт</b>: сколько дней моделировать.</p>`
  }),
  step({ target: () => document.getElementById('decision-library').closest('.sidebar-section'), placement: 'right' }, {
    title: '2 · Add decisions',
    body: `<p>Fifteen levers: stricter policy, human review, an ML classifier, rate limits, red-teaming, a growth campaign… Press <b>+</b> to add one to your bundle.</p>
           <p>Each lever kicks in after a delay and fades over time, like real interventions do.</p>`
  }, {
    title: '2 · Добавьте решения',
    body: `<p>Пятнадцать рычагов: строже правила, ручная модерация, ML-классификатор, лимиты, ред-тиминг, маркетинговая кампания… Нажмите <b>+</b>, чтобы добавить рычаг в набор.</p>
           <p>Каждый срабатывает с задержкой и со временем ослабевает, как настоящие меры.</p>`
  }),
  step({ target: () => document.getElementById('active-bundle').closest('.sidebar-section'), placement: 'right' }, {
    title: '3 · Tune the bundle',
    body: `<p>Here are the decisions you picked. The <b>intensity</b> slider sets how hard you push each one, and the badge shows what it costs per day.</p>
           <p>When the bundle is empty, you'll find ready-made <b>presets</b> for the current scenario here.</p>`
  }, {
    title: '3 · Настройте набор',
    body: `<p>Здесь выбранные решения. Ползунок <b>интенсивности</b> задаёт, насколько сильно жать на каждое, а бейдж показывает цену в день.</p>
           <p>Когда набор пуст, здесь появляются <b>готовые наборы</b> для текущего сценария.</p>`
  }),
  step({ target: '.bundle-title .slot-switch', placement: 'right' }, {
    title: '4 · Build an alternative',
    body: `<p>You have two bundles, <span class="slot-tag slot-a">A</span> and <span class="slot-tag slot-b">B</span>. This switch picks which one the sidebar edits.</p>
           <p>Typical move: build A, switch to B, make one different choice, then compare.</p>`
  }, {
    title: '4 · Соберите альтернативу',
    body: `<p>Наборов два, <span class="slot-tag slot-a">A</span> и <span class="slot-tag slot-b">B</span>. Этот переключатель выбирает, какой из них редактирует панель.</p>
           <p>Обычный ход: собрать A, переключиться на B, поменять одно решение и сравнить.</p>`
  }),
  step({ target: '.summary-chips' }, {
    title: '5 · Headline numbers',
    body: `<p>Risk score (0 to 100), the chance of a severe incident, money per day and the worst breach probability, for the bundle you're editing, on the last simulated day.</p>
           <p>Everything recalculates the moment you change something.</p>`
  }, {
    title: '5 · Главные цифры',
    body: `<p>Оценка риска (от 0 до 100), вероятность серьёзного инцидента, деньги в день и худшая вероятность нарушения порога. Для набора, который вы редактируете, на последний день симуляции.</p>
           <p>Всё пересчитывается сразу, как только вы что-то меняете.</p>`
  }),
  step({ target: '#dash-explain', before: goTab('dashboard') }, {
    title: '6 · What moved the risk',
    body: `<p>From a quiet product, through the scenario's events, to each of your decisions, and which metrics carried each effect.</p>
           <p>The steps add up exactly, so you can see which decision is pulling its weight.</p>`
  }, {
    title: '6 · Что сдвинуло риск',
    body: `<p>От спокойного продукта через события сценария к каждому вашему решению, и через какие метрики прошёл каждый эффект.</p>
           <p>Шаги складываются точно, так что видно, какое решение реально работает.</p>`
  }),
  step({ target: () => document.querySelector('#tab-compare .cmp-verdict') || document.getElementById('tab-compare'), before: goTab('compare') }, {
    title: '7 · Compare A and B',
    body: `<p>The two bundles side by side over the whole horizon. This line is the verdict in plain words, including <b>how much money each point of risk costs</b>.</p>
           <p>Below it: the numbers, both runs on one chart, and the metrics that end up differently.</p>`
  }, {
    title: '7 · Сравните A и B',
    body: `<p>Два набора рядом на всём горизонте. В этой строке вывод простыми словами, включая то, <b>сколько денег стоит каждый пункт риска</b>.</p>
           <p>Ниже: цифры, оба прогона на одном графике и метрики, которые закончились по-разному.</p>`
  }),
  step({ target: () => document.getElementById('to-chart') || document.getElementById('tab-tradeoffs'), before: goTab('tradeoffs'), placement: 'left', inside: 'bottom-right' }, {
    title: '8 · See every option at once',
    body: `<p>Each dot is a bundle: left is safer, up earns more. Options on the dashed line are efficient; anything below it is beaten on both counts.</p>
           <p>Click a dot to load it into A or B.</p>`
  }, {
    title: '8 · Все варианты сразу',
    body: `<p>Каждая точка означает набор: левее безопаснее, выше прибыльнее. Варианты на пунктире эффективны; всё, что ниже, проигрывает по обоим показателям.</p>
           <p>Нажмите на точку, чтобы загрузить её в A или B.</p>`
  }),
  step({ target: '#mc-btn' }, {
    title: '9 · Check how sure you can be',
    body: `<p><b>Run MC</b> simulates hundreds of plausible versions of the future (decisions working better or worse, metrics starting a bit off) and draws uncertainty bands on the Timeline.</p>
           <p>Bands reset whenever you change a bundle, so they always describe what you see.</p>`
  }, {
    title: '9 · Насколько можно быть уверенным',
    body: `<p><b>Запустить MC</b> прогоняет сотни правдоподобных вариантов будущего (решения работают лучше или хуже, метрики стартуют чуть иначе) и рисует полосы неопределённости на вкладке «Динамика».</p>
           <p>Полосы сбрасываются при любом изменении набора, так что всегда описывают то, что вы видите.</p>`
  }),
  step({ target: '#tour-btn', before: goTab('dashboard') }, {
    title: "That's it",
    body: `<p>Replay this tour any time from here. The <b>Model</b> tab lists every metric, link and formula behind the numbers.</p>
           <p>Good first try: load a preset into A, copy it to B, swap one decision, open <b>Compare</b>.</p>`
  }, {
    title: 'Вот и всё',
    body: `<p>Тур можно повторить отсюда в любой момент. На вкладке <b>Модель</b> собраны все метрики, связи и формулы, из которых получаются цифры.</p>
           <p>Для начала: загрузите готовый набор в A, скопируйте в B, замените одно решение и откройте <b>Сравнение</b>.</p>`
  })
];

const tour = createTour(TOUR_STEPS, {
  onClose: () => {
    appState.tourSeen = true;
    saveToStorage();
  }
});

// ── Decision Bundle UI ───────────────────────────────────────────────
function renderDecisionLibrary() {
  const libEl = document.getElementById('decision-library');
  const categories = [...new Set(DECISIONS.map(d => d.category))];
  let html = '';
  for (const cat of categories) {
    html += `<div class="dec-category-label">${t(cat)}</div>`;
    for (const d of DECISIONS.filter(x => x.category === cat)) {
      const inBundle = appState.bundle.some(b => b.decision.id === d.id);
      html += `
        <div class="dec-card ${inBundle ? 'in-bundle' : ''}" data-id="${d.id}">
          <span class="dec-name">${t(d.name)}</span>
          <button class="dec-add-btn" data-id="${d.id}" aria-label="${inBundle ? L(`Remove ${t(d.name)} from bundle`, `Убрать «${t(d.name)}» из набора`) : L(`Add ${t(d.name)} to bundle`, `Добавить «${t(d.name)}» в набор`)} ${appState.activeSlot}" aria-pressed="${inBundle}">${icon(inBundle ? 'check' : 'plus')}</button>
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
        <p class="empty-bundle">${L(`Bundle ${appState.activeSlot} is empty. Start from a ready-made bundle for <b>${esc(t(getScenario().name))}</b>, or add decisions from the library above.`, `Набор ${appState.activeSlot} пуст. Начните с готового набора для сценария <b>${esc(t(getScenario().name))}</b> или добавьте решения из библиотеки выше.`)}</p>
        ${presets.map(p => `
          <button class="preset-card" data-preset="${p.id}">
            <span class="preset-name">${esc(t(p.name))}</span>
            <span class="preset-blurb">${esc(t(p.blurb))}</span>
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
          <span class="bundle-name">${t(d.name)}</span>
          <button class="bundle-remove" data-id="${d.id}" aria-label="${L('Remove', 'Убрать')} ${t(d.name)}">${icon('x')}</button>
        </div>
        <div class="bundle-meta">
          <span class="badge-cost">$${Math.round(totalCost)}${L('/day', '/день')}</span>
          ${d.latencyImpactMs !== 0 ? `<span class="badge-latency">${d.latencyImpactMs > 0 ? '+' : ''}${d.latencyImpactMs}ms</span>` : ''}
          <span class="badge-type">${t(d.cost.type)}</span>
        </div>
        <div class="intensity-row">
          <span class="intensity-label">${L('Intensity', 'Интенсивность')}</span>
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
          '$' + Math.round(item.decision.cost.amountPerDay * item.intensity) + L('/day', '/день');
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
      alert(L('Invalid config file: ', 'Неверный файл настроек: ') + err.message);
    }
  };
  reader.readAsText(file);
}

// ── Init ─────────────────────────────────────────────────────────────
function init() {
  loadFromStorage();
  applyStatic();

  // Populate scenario select
  const scenarioSelect = document.getElementById('scenario-select');
  for (const s of SCENARIOS) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = t(s.name);
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

  // Canvas charts draw text once; redraw when the self-hosted faces finish loading.
  document.fonts?.ready.then(() => renderActiveTab());
  initTabs(tab => {
    appState.activeTab = tab;
    if (tab === 'model') renderModel(document.getElementById('tab-model'));
    else renderActiveTab();
  });

  document.querySelectorAll('.slot-btn').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.slot === appState.activeSlot));
    b.addEventListener('click', () => setActiveSlot(b.dataset.slot));
  });
  document.getElementById('tour-btn').addEventListener('click', () => tour.start());

  // Language switch: static labels swap in place, everything drawn from data re-renders.
  document.querySelectorAll('.lang-btn').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.lang === getLang()) return;
    setLang(b.dataset.lang);
    for (const opt of document.getElementById('scenario-select').options) {
      opt.textContent = t(SCENARIOS.find(x => x.id === opt.value)?.name ?? opt.textContent);
    }
    if (appState.mcRunning) document.getElementById('mc-btn').textContent = L('Cancel', 'Отменить');
    document.getElementById('mc-status').textContent = '—';
    renderDecisionLibrary();
    renderBundle();
    updateSummaryChips();
    const dash = document.getElementById('dash-explain');
    if (dash) dash.innerHTML = '';
    renderActiveTab();
  }));

  renderDecisionLibrary();
  renderBundle();
  runDeterministicSim();

  // first visit: start the tour once the page has settled
  if (!appState.tourSeen) setTimeout(() => tour.start(), 500);
}

document.addEventListener('DOMContentLoaded', init);
