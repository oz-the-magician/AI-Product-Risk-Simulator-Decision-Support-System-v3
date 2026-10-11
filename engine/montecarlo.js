import { METRICS } from '../data/metrics.js';
import { METRIC_PRIORS, EFFECT_UNCERTAINTY, SHOCK_UNCERTAINTY } from '../data/priors.js';
import { runSimulation } from './simulator.js';
import { sampleEdges } from './transitions.js';
import { samplePrior, sampleLognormal } from './rng.js';
import { clampToBounds } from './units.js';

// What a single Monte Carlo run is uncertain about:
//  • where each metric actually stands today (priors centred on the baseline) —
//    this widens the money band; risk is scored on the change since day 0,
//  • how strongly metrics influence each other (edge priors),
//  • how well each decision works (± EFFECT_UNCERTAINTY, never flips sign),
//  • how big the scenario shocks turn out (± SHOCK_UNCERTAINTY).
export function sampleRunInputs(rng, bundle) {
  const baselineOverrides = {};
  for (const m of METRICS) baselineOverrides[m.id] = clampToBounds(m, samplePrior(rng, METRIC_PRIORS[m.id], m.baseline));
  const effectScales = {};
  for (const { decision } of bundle) effectScales[decision.id] = sampleLognormal(rng, 1, EFFECT_UNCERTAINTY);
  return {
    baselineOverrides,
    edgeOverrides: sampleEdges(rng),
    effectScales,
    shockScale: sampleLognormal(rng, 1, SHOCK_UNCERTAINTY)
  };
}

export function percentile(arr, p) {
  if (!arr.length) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Incremental Monte Carlo so the worker can yield between chunks
 * (that is what makes Cancel actually work).
 */
export function createMonteCarlo({ scenario, bundle, horizonDays, runs, rng }) {
  const days = horizonDays + 1;
  const risk = Array.from({ length: days }, () => []);
  const net = Array.from({ length: days }, () => []);
  const tail = Array.from({ length: days }, () => []);
  const breach = {};
  for (const m of METRICS) breach[m.id] = { yellow: 0, red: 0 };
  let done = 0;

  function step(n) {
    const until = Math.min(runs, done + n);
    for (; done < until; done++) {
      const inputs = sampleRunInputs(rng, bundle);
      const states = runSimulation({ scenario, bundle, horizonDays, ...inputs, scoreFromStart: true });
      for (let t = 0; t < days; t++) {
        const s = states[t];
        risk[t].push(s.derived.riskScore);
        net[t].push(s.derived.net);
        tail[t].push(s.derived.tailRiskProb);
        for (const m of METRICS) {
          const st = s.flags.guardrailBreaches[m.id];
          if (st === 'red') { breach[m.id].red++; breach[m.id].yellow++; }
          else if (st === 'yellow') breach[m.id].yellow++;
        }
      }
    }
    return done;
  }

  function result() {
    const band = series => ({
      p10: series.map(v => percentile(v, 10)),
      p50: series.map(v => percentile(v, 50)),
      p90: series.map(v => percentile(v, 90))
    });
    const total = days * done;
    const breachProbs = {};
    for (const m of METRICS) breachProbs[m.id] = {
      yellow: total ? breach[m.id].yellow / total : 0,
      red: total ? breach[m.id].red / total : 0
    };
    return { runs: done, risk: band(risk), net: band(net), tail: band(tail), breachProbs };
  }

  return { step, result, get done() { return done; }, runs };
}
