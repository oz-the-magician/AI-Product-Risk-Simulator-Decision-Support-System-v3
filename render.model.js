import { METRICS } from '../data/metrics.js';
import { CAUSAL_EDGES } from '../engine/transitions.js';

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
      <p class="model-note">Applied per day: <code>to *= (1 + k * clamp((cur−base)/|base|, −1, 1) * 0.1)</code></p>
      <table class="model-table edges-table">
        <thead><tr><th>From</th><th></th><th>To</th><th>k</th></tr></thead>
        <tbody>${edgeRows}</tbody>
      </table>
    </div>

    <div class="model-section">
      <h3>Risk Score Formula</h3>
      <pre class="formula">ContinuousRisk = Σ (badDelta × severity)
GuardrailPenalty = Σ (20×sev for red, 5×sev for yellow)
RiskScore = min(100, (ContinuousRisk × 8 + GuardrailPenalty) × riskSensitivity)</pre>
    </div>

    <div class="model-section">
      <h3>Tail Risk (SEV Event Probability)</h3>
      <pre class="formula">tailInput = 1.5×Δincident_rate + 1.2×Δabuse_rate + 0.8×Δjailbreak_rate + 0.6×Δfalse_negative − 1.5
tailRiskProb = sigmoid(tailInput × riskSensitivity)</pre>
    </div>

    <div class="model-section">
      <h3>Economics</h3>
      <pre class="formula">Revenue(t) = DAU(t) × 1000 × ARPU(t)
IncidentCost(t) = incident_rate(t) × DAU(t)×1000 × $0.05 × costMultiplier
Cost(t) = moderation_cost + compute_cost + IncidentCost(t)
Net(t) = Revenue(t) − Cost(t)</pre>
    </div>

    <div class="model-section">
      <h3>Decision Effects</h3>
      <pre class="formula">effectiveEffect(day) = lever.effect × intensity × exp(−ln2 × (day−lagDays) / halfLifeDays)
metric *= (1 + effectiveEffect)   [applied after lagDays]</pre>
    </div>

    <div class="model-section">
      <h3>Monte Carlo</h3>
      <pre class="formula">Each run samples baselines from triangular/normal priors
and edge coefficients from normal priors.
Outputs: p10/p50/p90 bands on riskScore and net,
         P(yellow breach) and P(red breach) per metric.</pre>
    </div>
  `;
}
