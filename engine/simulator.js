import { METRICS } from '../data/metrics.js';
import { createInitialState } from './state.js';
import { CAUSAL_EDGES, causalShifts } from './transitions.js';
import { computeRisk } from './risk.js';
import { computeEconomics } from './economics.js';
import { isAbsolute, clampToBounds } from './units.js';

// How fast a metric moves toward its target level each day (0..1).
// 0.35 ≈ two thirds of the gap closes in three days.
export const ADJUST_SPEED = 0.35;

// Lowest a combined relative effect can push a metric (−90 %).
const MIN_REL = -0.9;

// Strength of a lever on a given day: zero before the lag, full on the day it lands,
// then fading with the half-life (users adapt, attackers find workarounds).
export function leverActivation(lever, day) {
  if (day < lever.lagDays) return 0;
  const active = day - lever.lagDays;
  return Math.exp(-Math.LN2 * active / lever.halfLifeDays);
}

// Effect of the decision bundle on each metric's target, split into relative and absolute parts.
export function decisionShifts(bundle, day, effectScales = null) {
  const rel = {}, abs = {};
  for (const { decision, intensity } of bundle) {
    const scale = effectScales?.[decision.id] ?? 1;
    for (const lever of decision.levers) {
      const e = lever.effect * intensity * scale * leverActivation(lever, day);
      if (!e) continue;
      const bucket = isAbsolute(lever) ? abs : rel;
      bucket[lever.metricId] = (bucket[lever.metricId] ?? 0) + e;
    }
  }
  return { rel, abs };
}

// Scenario shocks are lasting changes in the environment (a traffic spike, a viral
// incident): they move the metric right away and stay in its target afterwards.
function shocksUpTo(scenario, day, shockScale = 1) {
  const rel = {}, abs = {}, today = [];
  for (const shock of scenario?.shocks ?? []) {
    if (shock.day > day) continue;
    const s = shock.shock * shockScale;
    if (isAbsolute(shock)) abs[shock.metricId] = (abs[shock.metricId] ?? 0) + s;
    else rel[shock.metricId] = (1 + (rel[shock.metricId] ?? 0)) * (1 + s) - 1;
    if (shock.day === day) today.push({ metricId: shock.metricId, value: s, absolute: isAbsolute(shock) });
  }
  return { rel, abs, today };
}

function targetLevels(reference, current, scenario, bundle, day, edges, effectScales, shockScale) {
  const shocks = shocksUpTo(scenario, day, shockScale);
  const decisions = decisionShifts(bundle, day, effectScales);
  const causal = causalShifts(current, reference, edges);
  const target = {};
  for (const m of METRICS) {
    const ref = reference[m.id];
    const envRef = ref * (1 + (shocks.rel[m.id] ?? 0)) + (shocks.abs[m.id] ?? 0);
    const rel = Math.max(MIN_REL, (decisions.rel[m.id] ?? 0) + (causal[m.id] ?? 0));
    target[m.id] = clampToBounds(m, envRef * (1 + rel) + (decisions.abs[m.id] ?? 0));
  }
  return { target, todayShocks: shocks.today };
}

// Re-expresses a run's metrics as if it had started exactly at the nominal baseline:
// same relative (or, for points metrics like NPS, absolute) change since day 0.
export function relativeToStart(metrics, start) {
  const out = {};
  for (const m of METRICS) {
    const s = start[m.id];
    out[m.id] = (m.id === 'nps' || !s)
      ? m.baseline + (metrics[m.id] - s)
      : m.baseline * (metrics[m.id] / s);
  }
  return out;
}

function snapshot(day, metrics, scenario, bundle, start, scoreFromStart) {
  const scored = scoreFromStart ? relativeToStart(metrics, start) : metrics;
  const { riskScore, tailRiskProb, breaches } = computeRisk(scored, scenario);
  const { revenue, cost, net, decisionCost } = computeEconomics(metrics, scenario, bundle);
  return {
    day,
    metrics: { ...metrics },
    derived: { riskScore, tailRiskProb, revenue, cost, net, decisionCost },
    flags: { guardrailBreaches: breaches }
  };
}

/**
 * Runs one simulation and returns a state per day (0..horizonDays).
 * baselineOverrides — starting values (Monte Carlo samples them);
 * edgeOverrides — causal edges with sampled strengths;
 * effectScales — { decisionId: multiplier } for uncertain decision effects;
 * shockScale — multiplier for scenario shock sizes;
 * scoreFromStart — score risk on the change since day 0 rather than on the raw values.
 *   Monte Carlo uses it so the band shows how uncertain the *consequences* are,
 *   instead of re-measuring how uncertain today's numbers are (that doesn't depend on any decision).
 */
export function runSimulation({
  scenario, bundle = [], horizonDays,
  baselineOverrides = {}, edgeOverrides = null, effectScales = null, shockScale = 1,
  scoreFromStart = false
}) {
  const edges = edgeOverrides || CAUSAL_EDGES;
  const start = createInitialState(baselineOverrides).metrics;
  const reference = { ...start };   // the system's own equilibrium without any change
  let x = { ...start };
  const states = [];

  for (let day = 0; day <= horizonDays; day++) {
    const { target, todayShocks } = targetLevels(reference, x, scenario, bundle, day, edges, effectScales, shockScale);
    const next = {};
    for (const m of METRICS) {
      let v = x[m.id];
      // shocks land at once
      for (const s of todayShocks) if (s.metricId === m.id) v = s.absolute ? v + s.value : v * (1 + s.value);
      // everything else moves gradually toward the target
      if (day > 0) v += ADJUST_SPEED * (target[m.id] - v);
      next[m.id] = clampToBounds(m, v);
    }
    x = next;
    states.push(snapshot(day, x, scenario, bundle, start, scoreFromStart));
  }
  return states;
}
