// Engine sanity tests. Run with:  node --test tests/
// No dependencies — uses Node's built-in test runner.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { METRICS } from '../data/metrics.js';
import { DECISIONS } from '../data/decisions.js';
import { SCENARIOS } from '../data/scenarios.js';
import { runSimulation, leverActivation } from '../engine/simulator.js';
import { computeRisk } from '../engine/risk.js';
import { createMonteCarlo } from '../engine/montecarlo.js';
import { seededRng } from '../engine/rng.js';
import { isAbsolute } from '../engine/units.js';

const QUIET = { id: 'quiet', riskSensitivity: 1, costMultiplier: 1, shocks: [] };
const byId = id => DECISIONS.find(d => d.id === id);
const last = states => states[states.length - 1];
const baseline = Object.fromEntries(METRICS.map(m => [m.id, m.baseline]));

test('no decisions and no shocks: every metric stays at its baseline', () => {
  const states = runSimulation({ scenario: QUIET, bundle: [], horizonDays: 180 });
  for (const m of METRICS) {
    assert.ok(Math.abs(last(states).metrics[m.id] - m.baseline) < 1e-9, `${m.id} drifted`);
  }
});

test('risk calibration: baseline ≈ 25, yellow lines ≈ 50–65, all red = 100', () => {
  const at = k => Object.fromEntries(METRICS.map(m => [m.id, m.guardrails[k]]));
  const base = computeRisk(baseline).riskScore;
  const yellow = computeRisk(at('yellow')).riskScore;
  const red = computeRisk(at('red')).riskScore;
  assert.ok(base > 15 && base < 35, `baseline ${base}`);
  assert.ok(yellow > 45 && yellow < 70, `yellow ${yellow}`);
  assert.equal(red, 100);
  assert.ok(base < yellow && yellow < red);
});

test('a single hard-safety metric at red raises the score clearly', () => {
  const base = computeRisk(baseline).riskScore;
  const oneRed = computeRisk({ ...baseline, incident_rate: 0.6 }).riskScore;
  assert.ok(oneRed - base > 20, `+${oneRed - base}`);
  assert.ok(oneRed < 100, 'one red metric must not saturate the scale');
});

test('every decision moves its metrics in the documented direction, within bounds', () => {
  for (const d of DECISIONS) {
    const states = runSimulation({ scenario: QUIET, bundle: [{ decision: d, intensity: 1 }], horizonDays: 90 });
    for (const lever of d.levers) {
      const m = METRICS.find(x => x.id === lever.metricId);
      // peak deviation from baseline over the run
      let peak = 0;
      for (const s of states) {
        const dev = s.metrics[m.id] - m.baseline;
        if (Math.abs(dev) > Math.abs(peak)) peak = dev;
      }
      const nominal = isAbsolute(lever) ? lever.effect : lever.effect * m.baseline;
      // Other levers and causal links can push the same metric, so only check
      // levers that dominate their metric: same sign, and no runaway (≤ 2× nominal + 1 pt).
      const sameMetric = d.levers.filter(l => l.metricId === m.id).length;
      if (sameMetric === 1 && Math.abs(nominal) > 0) {
        assert.equal(Math.sign(peak), Math.sign(nominal), `${d.id} → ${m.id} moved the wrong way`);
      }
      assert.ok(Math.abs(peak) <= 2 * Math.abs(nominal) + 1, `${d.id} → ${m.id}: ${peak} vs nominal ${nominal}`);
    }
  }
});

test('decision effects fade: after many half-lives the metric is back near baseline', () => {
  const d = byId('tighten_policy');
  const states = runSimulation({ scenario: QUIET, bundle: [{ decision: d, intensity: 1 }], horizonDays: 365 });
  const fp = last(states).metrics.false_positive;
  assert.ok(Math.abs(fp / baseline.false_positive - 1) < 0.02, `false_positive ${fp}`);
});

test('NPS levers are points, not percentages (NPS never collapses to 0)', () => {
  const d = byId('tighten_policy');
  const states = runSimulation({ scenario: QUIET, bundle: [{ decision: d, intensity: 1 }], horizonDays: 60 });
  const minNps = Math.min(...states.map(s => s.metrics.nps));
  assert.ok(minNps > baseline.nps - 10, `NPS fell to ${minNps}`);
});

test('lever activation: zero before lag, full on landing, half after one half-life', () => {
  const lever = { effect: 1, lagDays: 5, halfLifeDays: 10 };
  assert.equal(leverActivation(lever, 4), 0);
  assert.equal(leverActivation(lever, 5), 1);
  assert.ok(Math.abs(leverActivation(lever, 15) - 0.5) < 1e-12);
});

test('decisions cost money: net falls by the decision cost', () => {
  const d = byId('human_review_expansion');
  const none = runSimulation({ scenario: QUIET, bundle: [], horizonDays: 0 })[0].derived.net;
  const withIt = runSimulation({ scenario: QUIET, bundle: [{ decision: d, intensity: 0.5 }], horizonDays: 0 })[0].derived.net;
  assert.ok(Math.abs((none - withIt) - d.cost.amountPerDay * 0.5) < 1e-6);
});

test('every scenario: scores stay in range and decisions can still change the outcome', () => {
  for (const sc of SCENARIOS) {
    const base = runSimulation({ scenario: sc, bundle: [], horizonDays: sc.horizonDays });
    for (const s of base) {
      assert.ok(s.derived.riskScore >= 0 && s.derived.riskScore <= 100);
      assert.ok(s.derived.tailRiskProb >= 0 && s.derived.tailRiskProb <= 1);
    }
    assert.ok(last(base).derived.riskScore < 100, `${sc.id} saturates without any decision`);
    const helped = runSimulation({
      scenario: sc, horizonDays: sc.horizonDays,
      bundle: [{ decision: byId('human_review_expansion'), intensity: 1 }, { decision: byId('incident_response'), intensity: 1 }]
    });
    assert.ok(last(helped).derived.riskScore < last(base).derived.riskScore, `${sc.id}: safety decisions don't lower risk`);
  }
});

test('Monte Carlo median matches the deterministic run, and the band contains it', () => {
  const bundle = [{ decision: byId('human_review_expansion'), intensity: 0.7 }, { decision: byId('growth_campaign'), intensity: 0.5 }];
  for (const sc of SCENARIOS) {
    const T = sc.horizonDays;
    const det = last(runSimulation({ scenario: sc, bundle, horizonDays: T })).derived;
    const mc = createMonteCarlo({ scenario: sc, bundle, horizonDays: T, runs: 300, rng: seededRng(42) });
    mc.step(300);
    const r = mc.result();
    assert.ok(Math.abs(r.risk.p50[T] - det.riskScore) < 2, `${sc.id} risk p50 ${r.risk.p50[T]} vs ${det.riskScore}`);
    assert.ok(r.risk.p10[T] <= det.riskScore + 1e-9 && det.riskScore <= r.risk.p90[T] + 1e-9, `${sc.id} risk outside band`);
    assert.ok(Math.abs(r.tail.p50[T] - det.tailRiskProb) < 0.03, `${sc.id} tail p50`);
    assert.ok(Math.abs(r.net.p50[T] / det.net - 1) < 0.1, `${sc.id} net p50 ${r.net.p50[T]} vs ${det.net}`);
  }
});

test('Monte Carlo is reproducible with a seed and can run in chunks', () => {
  const sc = SCENARIOS[0], bundle = [{ decision: byId('ml_classifier'), intensity: 1 }];
  const a = createMonteCarlo({ scenario: sc, bundle, horizonDays: 30, runs: 60, rng: seededRng(9) });
  a.step(60);
  const b = createMonteCarlo({ scenario: sc, bundle, horizonDays: 30, runs: 60, rng: seededRng(9) });
  while (b.step(7) < 60);
  assert.deepEqual(a.result().risk.p50, b.result().risk.p50);
});
