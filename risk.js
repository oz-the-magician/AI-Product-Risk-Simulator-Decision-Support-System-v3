import { METRICS } from '../data/metrics.js';

const BASELINES = {};
const GUARDRAILS = {};
const SEVERITIES = {};
for (const m of METRICS) {
  BASELINES[m.id] = m.baseline;
  GUARDRAILS[m.id] = { ...m.guardrails, better: m.better };
  SEVERITIES[m.id] = m.severity;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

export function computeRisk(metrics, scenario) {
  const sensitivity = scenario?.riskSensitivity ?? 1.0;

  // Continuous risk: sum of weighted bad deltas
  let continuousRisk = 0;
  for (const m of METRICS) {
    const cur = metrics[m.id];
    const base = BASELINES[m.id];
    if (base === 0) continue;
    const delta = (cur - base) / Math.abs(base);
    const badDelta = m.better === "low" ? Math.max(0, delta) : Math.max(0, -delta);
    continuousRisk += badDelta * m.severity;
  }

  // Guardrail penalties
  let guardrailPenalty = 0;
  const breaches = {};
  for (const m of METRICS) {
    const cur = metrics[m.id];
    const g = m.guardrails;
    let status = "green";
    if (m.better === "low") {
      if (cur >= g.red) { status = "red"; guardrailPenalty += 20 * m.severity; }
      else if (cur >= g.yellow) { status = "yellow"; guardrailPenalty += 5 * m.severity; }
    } else {
      if (cur <= (g.red ?? 0)) { status = "red"; guardrailPenalty += 20 * m.severity; }
      else if (cur <= g.yellow) { status = "yellow"; guardrailPenalty += 5 * m.severity; }
    }
    breaches[m.id] = status;
  }

  // Tail risk via sigmoid on key safety metrics
  const inc_norm = (metrics.incident_rate - BASELINES.incident_rate) / Math.abs(BASELINES.incident_rate);
  const abuse_norm = (metrics.abuse_rate - BASELINES.abuse_rate) / Math.abs(BASELINES.abuse_rate);
  const jail_norm = (metrics.jailbreak_rate - BASELINES.jailbreak_rate) / Math.abs(BASELINES.jailbreak_rate);
  const fn_norm = (metrics.false_negative - BASELINES.false_negative) / Math.abs(BASELINES.false_negative);

  const tailInput = 1.5 * inc_norm + 1.2 * abuse_norm + 0.8 * jail_norm + 0.6 * fn_norm - 1.5;
  const tailRiskProb = sigmoid(tailInput * sensitivity);

  // Combine into 0-100 score
  const raw = (continuousRisk * 8 + guardrailPenalty) * sensitivity;
  const riskScore = Math.min(100, Math.max(0, raw));

  return { riskScore, tailRiskProb, breaches };
}

export function getGuardrailStatus(metricId, value) {
  const m = METRICS.find(x => x.id === metricId);
  if (!m) return "green";
  const g = m.guardrails;
  if (m.better === "low") {
    if (value >= g.red) return "red";
    if (value >= g.yellow) return "yellow";
    return "green";
  } else {
    if (value <= (g.red ?? -Infinity)) return "red";
    if (value <= g.yellow) return "yellow";
    return "green";
  }
}
