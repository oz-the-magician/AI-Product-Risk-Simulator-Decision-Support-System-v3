import { METRICS } from '../data/metrics.js';

// Stress of one metric against its guardrails:
// 0 at the green threshold or better, 1 at the red threshold, capped at 1.5.
export function metricStress(m, value) {
  const g = m.guardrails;
  const s = m.better === 'low'
    ? (value - g.green) / (g.red - g.green)
    : (g.green - value) / (g.green - g.red);
  return Math.max(0, Math.min(1.5, s));
}

export function guardrailStatus(m, value) {
  const g = m.guardrails;
  if (m.better === 'low') {
    if (value >= g.red) return 'red';
    if (value >= g.yellow) return 'yellow';
    return 'green';
  }
  if (value <= g.red) return 'red';
  if (value <= g.yellow) return 'yellow';
  return 'green';
}

// Weights for the probability of a severe (SEV) incident.
export const TAIL_WEIGHTS = { incident_rate: 1.5, abuse_rate: 1.2, jailbreak_rate: 0.8, false_negative: 0.6 };

// Calibration (documented in the Model tab):
// the baseline product lands around 25 / 100, every metric on its yellow line ≈ 55,
// a hard-safety metric at red adds a further 10, everything at red = 100.
// Scenario riskSensitivity (how harshly users and regulators react) scales the red
// penalties and multiplies the odds of a SEV event; it does not inflate every metric.
export const RISK_CAL = { power: 3, floor: 0.05, span: 0.8, redPenalty: 10 };
export const TAIL_CAL = { slope: 6, midpoint: 0.55 };

const sigmoid = x => 1 / (1 + Math.exp(-x));

export function computeRisk(metrics, scenario) {
  const sensitivity = scenario?.riskSensitivity ?? 1.0;
  const breaches = {};
  let sumW = 0, sumWsP = 0, redPenalty = 0;
  let tailW = 0, tailWs = 0;

  for (const m of METRICS) {
    const v = metrics[m.id];
    const s = metricStress(m, v);
    const status = guardrailStatus(m, v);
    breaches[m.id] = status;

    sumW += m.severity;
    sumWsP += m.severity * Math.pow(s, RISK_CAL.power);
    if (status === 'red') redPenalty += RISK_CAL.redPenalty * (m.severity / 5) * sensitivity;

    const tw = TAIL_WEIGHTS[m.id];
    if (tw) { tailW += tw; tailWs += tw * s; }
  }

  // Power mean: the worst metrics dominate, a single good metric can't hide a bad one.
  const stressIndex = Math.pow(sumWsP / sumW, 1 / RISK_CAL.power);
  const raw = 100 * (stressIndex - RISK_CAL.floor) / RISK_CAL.span + redPenalty;
  const riskScore = Math.min(100, Math.max(0, raw));

  const hardStress = tailWs / tailW;
  // ln(sensitivity) multiplies the odds: sensitivity 2 doubles the odds of a SEV event.
  const tailRiskProb = sigmoid(TAIL_CAL.slope * (hardStress - TAIL_CAL.midpoint) + Math.log(sensitivity));

  return { riskScore, tailRiskProb, breaches, stressIndex };
}

export function getGuardrailStatus(metricId, value) {
  const m = METRICS.find(x => x.id === metricId);
  return m ? guardrailStatus(m, value) : 'green';
}
