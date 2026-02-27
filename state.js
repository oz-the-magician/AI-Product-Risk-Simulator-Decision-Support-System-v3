import { METRICS } from '../data/metrics.js';

export function createInitialState(baselineOverrides = {}) {
  const metrics = {};
  for (const m of METRICS) {
    metrics[m.id] = baselineOverrides[m.id] ?? m.baseline;
  }
  return {
    day: 0,
    metrics,
    derived: { riskScore: 0, tailRiskProb: 0, revenue: 0, cost: 0, net: 0 },
    flags: { guardrailBreaches: {} }
  };
}

export function cloneState(state) {
  return {
    day: state.day,
    metrics: { ...state.metrics },
    derived: { ...state.derived },
    flags: { guardrailBreaches: { ...state.flags.guardrailBreaches } }
  };
}
