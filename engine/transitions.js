import { EDGE_PRIORS } from '../data/priors.js';
import { sampleNormal } from './rng.js';

// Causal graph. `k` is an elasticity: if `from` sits 10 % above its reference,
// the target level of `to` shifts by k × 10 %.
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

// Relative shift of each metric's target level caused by its parents.
// This is a level relationship, not a daily multiplier, so the system settles
// at an equilibrium instead of drifting for the whole horizon.
export function causalShifts(current, reference, edges = CAUSAL_EDGES) {
  const shifts = {};
  for (const edge of edges) {
    const ref = reference[edge.from];
    if (!ref) continue;
    let dev = (current[edge.from] - ref) / Math.abs(ref);
    dev = Math.max(-1, Math.min(1, dev));
    shifts[edge.to] = (shifts[edge.to] ?? 0) + edge.k * dev;
  }
  return shifts;
}

export function sampleEdges(rng) {
  return CAUSAL_EDGES.map(edge => {
    const prior = EDGE_PRIORS[`${edge.from}->${edge.to}`];
    if (!prior || prior.type !== 'normal') return { ...edge };
    let k = sampleNormal(rng, prior.mean, prior.sd);
    // keep the direction of the relationship; only its strength is uncertain
    if (Math.sign(k) !== Math.sign(prior.mean)) k = 0;
    return { ...edge, k };
  });
}
