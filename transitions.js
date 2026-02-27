import { METRICS } from '../data/metrics.js';
import { EDGE_PRIORS } from '../data/priors.js';

export const CAUSAL_EDGES = [
  { from: "false_positive",  to: "retention",       k: -0.12 },
  { from: "false_positive",  to: "nps",             k: -0.10 },
  { from: "abuse_rate",      to: "incident_rate",   k: +0.25 },
  { from: "abuse_rate",      to: "nps",             k: -0.08 },
  { from: "jailbreak_rate",  to: "incident_rate",   k: +0.20 },
  { from: "incident_rate",   to: "retention",       k: -0.15 },
  { from: "incident_rate",   to: "dau",             k: -0.10 },
  { from: "incident_rate",   to: "nps",             k: -0.12 },
  { from: "retention",       to: "dau",             k: +0.10 },
  { from: "dau",             to: "traffic",         k: +0.12 },
  { from: "dau",             to: "arpu",            k: +0.05 },
  { from: "p95_latency",     to: "retention",       k: -0.08 },
  { from: "p95_latency",     to: "nps",             k: -0.06 },
  { from: "nps",             to: "retention",       k: +0.08 },
  { from: "eval_pass_rate",  to: "policy_coverage", k: +0.10 },
  { from: "policy_coverage", to: "false_negative",  k: -0.12 },
  { from: "traffic",         to: "compute_cost",    k: +0.15 },
  { from: "moderation_lag",  to: "retention",       k: -0.05 }
];

const BASELINES = {};
for (const m of METRICS) BASELINES[m.id] = m.baseline;

export function applyTransitions(metrics, edgeOverrides = null) {
  const edges = edgeOverrides || CAUSAL_EDGES;
  const next = { ...metrics };

  for (const edge of edges) {
    const cur = metrics[edge.from];
    const base = BASELINES[edge.from];
    if (base === undefined || base === 0) continue;

    let delta = (cur - base) / Math.abs(base);
    delta = Math.max(-1, Math.min(1, delta)); // clamp

    const to = next[edge.to];
    if (to !== undefined) {
      next[edge.to] = to * (1 + edge.k * delta * 0.1); // dampened per-day
    }
  }

  // Clamp to non-negative
  for (const id of Object.keys(next)) {
    if (next[id] < 0) next[id] = 0;
  }

  return next;
}

export function sampleEdges() {
  const result = [];
  for (const edge of CAUSAL_EDGES) {
    const key = `${edge.from}->${edge.to}`;
    const prior = EDGE_PRIORS[key];
    let k = edge.k;
    if (prior) {
      if (prior.type === 'normal') {
        k = sampleNormal(prior.mean, prior.sd);
      }
    }
    result.push({ ...edge, k });
  }
  return result;
}

function sampleNormal(mean, sd) {
  // Box-Muller
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sd;
}
