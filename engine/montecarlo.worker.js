// montecarlo.worker.js - runs in Web Worker context
import { METRICS } from '../data/metrics.js';
import { METRIC_PRIORS } from '../data/priors.js';
import { runSimulation } from './simulator.js';
import { sampleEdges } from './transitions.js';

function sampleTriangular(min, mode, max) {
  const u = Math.random();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }
}

function sampleNormal(mean, sd) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sd;
}

function sampleBaselines() {
  const result = {};
  for (const m of METRICS) {
    const prior = METRIC_PRIORS[m.id];
    if (!prior) { result[m.id] = m.baseline; continue; }
    if (prior.type === 'triangular') {
      result[m.id] = sampleTriangular(prior.min, prior.mode, prior.max);
    } else {
      result[m.id] = Math.max(0, sampleNormal(prior.mean, prior.sd));
    }
  }
  return result;
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

self.onmessage = function(e) {
  const { scenario, bundle, horizonDays, runs } = e.data;
  let cancelled = false;

  self.onmessage = function(ev) {
    if (ev.data.type === 'cancel') cancelled = true;
  };

  const allRiskScores = Array.from({ length: horizonDays + 1 }, () => []);
  const allNet = Array.from({ length: horizonDays + 1 }, () => []);
  const allTailRisk = Array.from({ length: horizonDays + 1 }, () => []);
  const breachCounts = {};
  for (const m of METRICS) breachCounts[m.id] = { yellow: 0, red: 0 };

  for (let run = 0; run < runs; run++) {
    if (cancelled) break;

    const baselineOverrides = sampleBaselines();
    const edgeOverrides = sampleEdges();

    const states = runSimulation({ scenario, bundle, horizonDays, baselineOverrides, edgeOverrides });

    for (let t = 0; t <= horizonDays; t++) {
      const s = states[t];
      if (!s) continue;
      allRiskScores[t].push(s.derived.riskScore);
      allNet[t].push(s.derived.net);
      allTailRisk[t].push(s.derived.tailRiskProb);

      for (const m of METRICS) {
        const status = s.flags.guardrailBreaches[m.id];
        if (status === 'red') { breachCounts[m.id].red++; breachCounts[m.id].yellow++; }
        else if (status === 'yellow') breachCounts[m.id].yellow++;
      }
    }

    if (run % 20 === 0) {
      self.postMessage({ type: 'progress', run, total: runs });
    }
  }

  const completedRuns = cancelled ? 0 : runs;

  // Compute percentiles for each day
  const riskP10 = [], riskP50 = [], riskP90 = [];
  const netP10 = [], netP50 = [], netP90 = [];
  const tailP10 = [], tailP50 = [], tailP90 = [];

  for (let t = 0; t <= horizonDays; t++) {
    riskP10.push(percentile(allRiskScores[t], 10));
    riskP50.push(percentile(allRiskScores[t], 50));
    riskP90.push(percentile(allRiskScores[t], 90));
    netP10.push(percentile(allNet[t], 10));
    netP50.push(percentile(allNet[t], 50));
    netP90.push(percentile(allNet[t], 90));
    tailP10.push(percentile(allTailRisk[t], 10));
    tailP50.push(percentile(allTailRisk[t], 50));
    tailP90.push(percentile(allTailRisk[t], 90));
  }

  // Final breach probabilities (fraction of day*run combinations)
  const totalDayRuns = (horizonDays + 1) * (cancelled ? 0 : runs);
  const breachProbs = {};
  for (const m of METRICS) {
    breachProbs[m.id] = {
      yellow: totalDayRuns > 0 ? breachCounts[m.id].yellow / totalDayRuns : 0,
      red: totalDayRuns > 0 ? breachCounts[m.id].red / totalDayRuns : 0
    };
  }

  self.postMessage({
    type: 'done',
    cancelled,
    runs: completedRuns,
    risk: { p10: riskP10, p50: riskP50, p90: riskP90 },
    net: { p10: netP10, p50: netP50, p90: netP90 },
    tail: { p10: tailP10, p50: tailP50, p90: tailP90 },
    breachProbs
  });
};
