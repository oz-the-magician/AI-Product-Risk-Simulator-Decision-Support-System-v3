import { METRICS } from '../data/metrics.js';
import { CAUSAL_EDGES } from '../engine/transitions.js';
import { ADJUST_SPEED } from '../engine/simulator.js';
import { RISK_CAL, TAIL_CAL, TAIL_WEIGHTS } from '../engine/risk.js';
import { EFFECT_UNCERTAINTY, SHOCK_UNCERTAINTY } from '../data/priors.js';

export function renderModel(container) {
  const categories = ['Hard', 'Balance', 'Growth'];

  const metricRows = METRICS.map(m => `
    <tr>
      <td><code>${m.id}</code></td>
      <td>${m.name}</td>
      <td class="badge badge-${m.category.toLowerCase()}">${m.category}</td>
      <td>${m.better === 'low' ? '↓ Lower' : '↑ Higher'}</td>
      <td>${m.baseline} ${m.unit}</td>
      <td>🟡 ${m.guardrails.yellow} | 🔴 ${m.guardrails.red ?? '—'}</td>
      <td>${m.severity}/5</td>
    </tr>
  `).join('');

  const edgeRows = CAUSAL_EDGES.map(e => `
    <tr>
      <td><code>${e.from}</code></td>
      <td>→</td>
      <td><code>${e.to}</code></td>
      <td class="${e.k > 0 ? 'pos-k' : 'neg-k'}">${e.k > 0 ? '+' : ''}${e.k}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="model-section">
      <h3>Metrics (${METRICS.length})</h3>
      <table class="model-table">
        <thead><tr>
          <th>ID</th><th>Name</th><th>Category</th><th>Better</th><th>Baseline</th><th>Guardrails</th><th>Severity</th>
        </tr></thead>
        <tbody>${metricRows}</tbody>
      </table>
    </div>

    <div class="model-section">
      <h3>Causal Graph Edges (${CAUSAL_EDGES.length})</h3>
      <p class="model-note">Level relationship, not a daily multiplier: if <code>from</code> sits 10 % above its reference, the target level of <code>to</code> moves by <code>k × 10 %</code>. Deviations are clamped to ±100 %, so the system settles at an equilibrium.</p>
      <table class="model-table edges-table">
        <thead><tr><th>From</th><th></th><th>To</th><th>k</th></tr></thead>
        <tbody>${edgeRows}</tbody>
      </table>
    </div>

    <div class="model-section">
      <h3>Daily dynamics</h3>
      <pre class="formula">target(m, t) = ref(m) × (1 + shocks) × (1 + Σ relative decision effects + Σ k × deviation(parent))
               + Σ absolute decision effects          (e.g. NPS points)
x(m, t) = x(m, t−1) + ${ADJUST_SPEED} × (target(m, t) − x(m, t−1))
Scenario shocks land at once and stay in the target from that day on.
No decisions and no shocks ⇒ every metric stays exactly at its baseline.</pre>
    </div>

    <div class="model-section">
      <h3>Decision Effects</h3>
      <pre class="formula">effect(day) = lever.effect × intensity × exp(−ln2 × (day − lagDays) / halfLifeDays)   [0 before lagDays]
relative levers (kind "pct", e.g. +0.18 = +18 %) shift the target proportionally;
absolute levers (kind "abs", e.g. NPS −4) shift it by points.
Each decision costs amountPerDay × intensity, subtracted from Net every day.</pre>
    </div>

    <div class="model-section">
      <h3>Risk Score Formula</h3>
      <pre class="formula">stress(m) = 0 at the green threshold … 1 at the red threshold (capped at 1.5)
StressIndex = ( Σ severity × stress³ / Σ severity )^(1/3)       — the worst metrics dominate
RedPenalty  = Σ over red metrics of ${RISK_CAL.redPenalty} × severity/5 × riskSensitivity
RiskScore   = clamp(100 × (StressIndex − ${RISK_CAL.floor}) / ${RISK_CAL.span} + RedPenalty, 0, 100)
Calibration: baseline ≈ 25 · every metric on its yellow line ≈ 58 · everything at red = 100</pre>
    </div>

    <div class="model-section">
      <h3>Tail Risk (SEV Event Probability)</h3>
      <pre class="formula">HardStress   = weighted mean stress of ${Object.entries(TAIL_WEIGHTS).map(([k, w]) => `${w}×${k}`).join(' + ')}
tailRiskProb = sigmoid(${TAIL_CAL.slope} × (HardStress − ${TAIL_CAL.midpoint}) + ln(riskSensitivity))
riskSensitivity multiplies the odds of a SEV event (2 = twice the odds).</pre>
    </div>

    <div class="model-section">
      <h3>Economics</h3>
      <pre class="formula">Revenue(t)      = DAU(t) × 1000 × ARPU(t)
IncidentCost(t) = incident_rate(t)/100 × DAU(t)×1000 × $5 × costMultiplier
Cost(t)         = moderation + compute × costMultiplier + IncidentCost(t) + decision costs
Net(t)          = Revenue(t) − Cost(t)</pre>
    </div>

    <div class="model-section">
      <h3>Monte Carlo</h3>
      <pre class="formula">Each run samples:
  • today's metric values — priors centred on the baselines (lognormal for rates)
  • causal edge strengths — normal priors, direction never flips
  • how well each decision works — ×lognormal(σ = ${EFFECT_UNCERTAINTY})
  • size of scenario shocks — ×lognormal(σ = ${SHOCK_UNCERTAINTY})
Risk is scored on the change since day 0 of the run, so the band shows how uncertain the
consequences of the decisions are; money uses the actual sampled values.
The p50 line therefore matches the deterministic simulation.
Outputs: p10/p50/p90 bands on risk, SEV probability and net; P(yellow), P(red) per metric.</pre>
    </div>
  `;
}
