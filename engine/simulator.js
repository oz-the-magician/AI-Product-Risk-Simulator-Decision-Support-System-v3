import { METRICS } from '../data/metrics.js';
import { createInitialState, cloneState } from './state.js';
import { applyTransitions, CAUSAL_EDGES } from './transitions.js';
import { computeRisk } from './risk.js';
import { computeEconomics } from './economics.js';

const BASELINES = {};
for (const m of METRICS) BASELINES[m.id] = m.baseline;

function applyShocks(metrics, shocks, day) {
  const result = { ...metrics };
  for (const shock of shocks) {
    if (shock.day === day && result[shock.metricId] !== undefined) {
      result[shock.metricId] = result[shock.metricId] * (1 + shock.shock);
    }
  }
  return result;
}

function applyDecisionEffects(metrics, bundle, day, edgeOverrides) {
  const result = { ...metrics };

  for (const { decision, intensity } of bundle) {
    for (const lever of decision.levers) {
      // Effect becomes active after lagDays
      if (day < lever.lagDays) continue;

      const activeDays = day - lever.lagDays;
      const decay = Math.exp(-Math.LN2 * activeDays / lever.halfLifeDays);
      const effectiveEffect = lever.effect * intensity * decay;

      if (result[lever.metricId] !== undefined) {
        result[lever.metricId] = result[lever.metricId] * (1 + effectiveEffect);
      }
    }
  }

  // Clamp non-negative
  for (const id of Object.keys(result)) {
    if (result[id] < 0) result[id] = 0;
  }

  return result;
}

export function runSimulation({ scenario, bundle, horizonDays, baselineOverrides = {}, edgeOverrides = null }) {
  const edges = edgeOverrides || CAUSAL_EDGES;
  const states = [];
  let state = createInitialState(baselineOverrides);

  // Apply initial shocks (day=0)
  state.metrics = applyShocks(state.metrics, scenario.shocks || [], 0);
  state.metrics = applyDecisionEffects(state.metrics, bundle, 0, edges);
  state.metrics = applyTransitions(state.metrics, edges);

  const { riskScore, tailRiskProb, breaches } = computeRisk(state.metrics, scenario);
  const { revenue, cost, net } = computeEconomics(state.metrics, scenario);
  state.derived = { riskScore, tailRiskProb, revenue, cost, net };
  state.flags.guardrailBreaches = breaches;
  states.push(cloneState(state));

  for (let day = 1; day <= horizonDays; day++) {
    let { metrics } = state;

    metrics = applyShocks(metrics, scenario.shocks || [], day);
    metrics = applyDecisionEffects(metrics, bundle, day, edges);
    metrics = applyTransitions(metrics, edges);

    const { riskScore, tailRiskProb, breaches } = computeRisk(metrics, scenario);
    const { revenue, cost, net } = computeEconomics(metrics, scenario);

    state = {
      day,
      metrics,
      derived: { riskScore, tailRiskProb, revenue, cost, net },
      flags: { guardrailBreaches: breaches }
    };
    states.push(state);
  }

  return states;
}
