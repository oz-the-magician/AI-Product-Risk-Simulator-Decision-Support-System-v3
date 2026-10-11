// Decision-support analytics on top of the simulator:
// summaries for A/B comparison, "what moved the risk", and the risk ↔ money trade-off map.
import { METRICS } from '../data/metrics.js';
import { runSimulation } from './simulator.js';
import { computeRisk } from './risk.js';
import { decisionCostPerDay } from './economics.js';

const mean = arr => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
const QUIET = sc => ({ ...sc, shocks: [] });

/**
 * One-line numbers for a run. Averages are over the whole horizon:
 * decisions fade, so the last day alone would hide most of their effect.
 */
export function summarize(states, bundle = []) {
  const risk = states.map(s => s.derived.riskScore);
  const last = states[states.length - 1];
  const redDays = {}, endStatus = {};
  for (const m of METRICS) {
    redDays[m.id] = states.filter(s => s.flags.guardrailBreaches[m.id] === 'red').length;
    endStatus[m.id] = last.flags.guardrailBreaches[m.id];
  }
  return {
    avgRisk: mean(risk),
    peakRisk: Math.max(...risk),
    endRisk: last.derived.riskScore,
    avgSev: mean(states.map(s => s.derived.tailRiskProb)),
    totalNet: states.reduce((s, x) => s + x.derived.net, 0),
    avgNet: mean(states.map(s => s.derived.net)),
    decisionCostPerDay: decisionCostPerDay(bundle),
    redDays,
    anyRedDays: states.filter(s => Object.values(s.flags.guardrailBreaches).includes('red')).length,
    endStatus,
    endMetrics: { ...last.metrics }
  };
}

export function simulateAndSummarize(scenario, bundle, horizonDays) {
  const states = runSimulation({ scenario, bundle, horizonDays });
  return { states, summary: summarize(states, bundle) };
}

/**
 * How much each metric contributes to the gap in average risk between two runs.
 * For every day, put metric i back to its value in `refStates` and see how much risk drops.
 * Values are leave-one-out, so they need not add up exactly; the remainder is reported.
 */
export function metricAttribution(states, refStates, scenario) {
  const out = {};
  for (const m of METRICS) out[m.id] = 0;
  for (let t = 0; t < states.length; t++) {
    const cur = states[t].metrics, ref = refStates[t].metrics;
    const base = states[t].derived.riskScore;
    for (const m of METRICS) {
      if (cur[m.id] === ref[m.id]) continue;
      const swapped = computeRisk({ ...cur, [m.id]: ref[m.id] }, scenario).riskScore;
      out[m.id] += (base - swapped) / states.length;
    }
  }
  return out;
}

function topMetrics(byMetric, n = 3, minAbs = 0.05) {
  return Object.entries(byMetric)
    .filter(([, v]) => Math.abs(v) >= minAbs)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, n)
    .map(([id, delta]) => ({ id, delta }));
}

/**
 * Fair split of a joint effect among decisions (Shapley values): each decision gets its
 * average marginal effect over every order in which the bundle could have been assembled.
 * The parts add up exactly to the total, so there is no unexplained "interaction" bucket.
 * Exact for up to EXACT_MAX decisions; above that, averaged over sampled orders.
 */
const EXACT_MAX = 7;
const SAMPLED_ORDERS = 48;

function shapley(n, value) {
  const cache = new Map();
  const v = mask => { if (!cache.has(mask)) cache.set(mask, value(mask)); return cache.get(mask); };
  const phi = new Array(n).fill(0);
  if (n <= EXACT_MAX) {
    const fact = [1]; for (let i = 1; i <= n; i++) fact[i] = fact[i - 1] * i;
    for (let i = 0; i < n; i++) {
      for (let mask = 0; mask < (1 << n); mask++) {
        if (mask & (1 << i)) continue;
        const k = popcount(mask);
        const w = fact[k] * fact[n - k - 1] / fact[n];
        phi[i] += w * (v(mask | (1 << i)) - v(mask));
      }
    }
  } else {
    let seed = 12345;                       // deterministic, so the chart doesn't flicker
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let r = 0; r < SAMPLED_ORDERS; r++) {
      const order = [...Array(n).keys()];
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      let mask = 0;
      for (const i of order) { const next = mask | (1 << i); phi[i] += (v(next) - v(mask)) / SAMPLED_ORDERS; mask = next; }
    }
    // rescale so the parts still add up to the total exactly
    const total = v((1 << n) - 1) - v(0), sum = phi.reduce((a, b) => a + b, 0);
    if (Math.abs(sum) > 1e-9) for (let i = 0; i < n; i++) phi[i] *= total / sum;
  }
  return phi;
}
function popcount(x) { let c = 0; while (x) { x &= x - 1; c++; } return c; }

/**
 * Explains average risk over the horizon as a chain:
 *   quiet product (no shocks, no decisions)
 *   → + scenario shocks
 *   → + each decision (its Shapley share of the bundle's joint effect)
 *   = this bundle.
 * Each step also names the metrics that moved it most ("mainly via").
 */
export function explainRisk({ scenario, bundle, horizonDays }) {
  const run = b => runSimulation({ scenario, bundle: b, horizonDays });
  const avg = st => mean(st.map(s => s.derived.riskScore));
  const quietStates = runSimulation({ scenario: QUIET(scenario), bundle: [], horizonDays });
  const noDecStates = run([]);
  const fullStates = run(bundle);
  const quiet = avg(quietStates), noDec = avg(noDecStates), full = avg(fullStates);

  const subset = mask => bundle.filter((_, i) => mask & (1 << i));
  const phi = shapley(bundle.length, mask => avg(run(subset(mask))));

  const decisions = bundle.map((item, i) => {
    // drivers: which metrics carry this decision's effect (bundle with vs. without it)
    const withoutStates = run(bundle.filter(b => b !== item));
    return {
      id: item.decision.id,
      name: item.decision.name,
      intensity: item.intensity,
      delta: phi[i],
      drivers: topMetrics(metricAttribution(fullStates, withoutStates, scenario))
    };
  });

  return {
    quiet, noDecisions: noDec, total: full,
    shocks: { delta: noDec - quiet, drivers: topMetrics(metricAttribution(noDecStates, quietStates, scenario)) },
    decisions,
    byMetric: topMetrics(metricAttribution(fullStates, noDecStates, scenario), 6)
  };
}

/**
 * Pareto frontier for "lower average risk is better, higher total net is better".
 * A point is dominated if another point is at least as good on both and better on one.
 */
export function paretoFrontier(points) {
  return points.filter(p => !points.some(q =>
    q !== p && q.avgRisk <= p.avgRisk && q.totalNet >= p.totalNet &&
    (q.avgRisk < p.avgRisk || q.totalNet > p.totalNet)));
}

/** Candidates for the trade-off map: no decisions, every single decision at full strength, and the given extra bundles. */
export function tradeoffPoints({ scenario, horizonDays, decisions, extra = [] }) {
  const pts = [];
  const add = (label, kind, bundle) => {
    const { summary } = simulateAndSummarize(scenario, bundle, horizonDays);
    pts.push({ label, kind, bundle, avgRisk: summary.avgRisk, totalNet: summary.totalNet, avgSev: summary.avgSev });
  };
  add('No decisions', 'none', []);
  for (const d of decisions) add(d.name, 'single', [{ decision: d, intensity: 1 }]);
  for (const e of extra) add(e.label, e.kind, e.bundle);
  const front = new Set(paretoFrontier(pts));
  for (const p of pts) p.onFrontier = front.has(p);
  return pts;
}
