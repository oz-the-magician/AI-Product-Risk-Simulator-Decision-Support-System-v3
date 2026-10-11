// Tests for the decision-support layer: summaries, risk explanation, trade-off map, presets.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DECISIONS } from '../data/decisions.js';
import { SCENARIOS } from '../data/scenarios.js';
import { PRESETS, presetsFor, resolveBundle } from '../data/presets.js';
import { runSimulation } from '../engine/simulator.js';
import { summarize, explainRisk, paretoFrontier, tradeoffPoints } from '../engine/analysis.js';

const byId = id => DECISIONS.find(d => d.id === id);
const sum = arr => arr.reduce((s, v) => s + v, 0);

test('every preset uses existing decisions and valid intensities; every scenario has presets', () => {
  for (const p of PRESETS) {
    for (const b of p.bundle) {
      assert.ok(byId(b.decisionId), `${p.id}: unknown decision ${b.decisionId}`);
      assert.ok(b.intensity > 0 && b.intensity <= 1, `${p.id}: intensity ${b.intensity}`);
    }
    assert.equal(resolveBundle(p, DECISIONS).length, p.bundle.length);
  }
  for (const sc of SCENARIOS) assert.ok(presetsFor(sc.id).length >= 2, `${sc.id} has too few presets`);
});

test('summary: averages match the states, decision cost matches the bundle', () => {
  const sc = SCENARIOS[0];
  const bundle = [{ decision: byId('human_review_expansion'), intensity: 0.5 }];
  const states = runSimulation({ scenario: sc, bundle, horizonDays: 30 });
  const s = summarize(states, bundle);
  assert.ok(Math.abs(s.avgRisk - sum(states.map(x => x.derived.riskScore)) / states.length) < 1e-9);
  assert.ok(Math.abs(s.totalNet - sum(states.map(x => x.derived.net))) < 1e-6);
  assert.equal(s.decisionCostPerDay, byId('human_review_expansion').cost.amountPerDay * 0.5);
  assert.equal(s.endRisk, states[30].derived.riskScore);
});

test('risk explanation adds up exactly: quiet + events + each decision = bundle', () => {
  for (const sc of SCENARIOS) {
    for (const p of presetsFor(sc.id)) {
      const ex = explainRisk({ scenario: sc, bundle: resolveBundle(p, DECISIONS), horizonDays: sc.horizonDays });
      const rebuilt = ex.quiet + ex.shocks.delta + sum(ex.decisions.map(d => d.delta));
      assert.ok(Math.abs(rebuilt - ex.total) < 1e-6, `${sc.id}/${p.id}: ${rebuilt} vs ${ex.total}`);
    }
  }
});

test('risk explanation: a lone decision gets its whole effect; safety levers lower risk', () => {
  const sc = SCENARIOS[1];
  const bundle = [{ decision: byId('human_review_expansion'), intensity: 1 }];
  const ex = explainRisk({ scenario: sc, bundle, horizonDays: sc.horizonDays });
  assert.ok(Math.abs(ex.decisions[0].delta - (ex.total - ex.noDecisions)) < 1e-9);
  assert.ok(ex.decisions[0].delta < 0);
  assert.ok(ex.decisions[0].drivers.length > 0, 'names the metrics that carry the effect');
});

test('risk explanation also adds up for large bundles (sampled orders)', () => {
  const sc = SCENARIOS[0];
  const bundle = DECISIONS.slice(0, 10).map(d => ({ decision: d, intensity: 0.6 }));
  const ex = explainRisk({ scenario: sc, bundle, horizonDays: 30 });
  const rebuilt = ex.quiet + ex.shocks.delta + sum(ex.decisions.map(d => d.delta));
  assert.ok(Math.abs(rebuilt - ex.total) < 1e-6);
});

test('Pareto frontier keeps exactly the non-dominated points', () => {
  const pts = [
    { id: 'a', avgRisk: 10, totalNet: 100 },   // efficient: safest
    { id: 'b', avgRisk: 20, totalNet: 300 },   // efficient: richest
    { id: 'c', avgRisk: 15, totalNet: 200 },   // efficient: in between
    { id: 'd', avgRisk: 18, totalNet: 150 },   // dominated by c
    { id: 'e', avgRisk: 10, totalNet: 90 }     // dominated by a (same risk, less money)
  ];
  assert.deepEqual(paretoFrontier(pts).map(p => p.id).sort(), ['a', 'b', 'c']);
});

test('trade-off map: includes the no-decision baseline and has a frontier', () => {
  const sc = SCENARIOS[0];
  const pts = tradeoffPoints({ scenario: sc, horizonDays: 30, decisions: DECISIONS });
  assert.equal(pts.length, DECISIONS.length + 1);
  assert.ok(pts.some(p => p.kind === 'none'));
  assert.ok(pts.some(p => p.onFrontier));
  for (const p of pts.filter(p => !p.onFrontier)) {
    assert.ok(pts.some(q => q.onFrontier && q.avgRisk <= p.avgRisk && q.totalNet >= p.totalNet), `${p.label} not dominated by a frontier point`);
  }
});
