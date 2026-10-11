// Ready-made decision bundles: a starting point for each scenario,
// and the reference points on the trade-off map.
export const PRESETS = [
  {
    id: 'safety_first',
    name: 'Safety first',
    blurb: 'Human review, red-teaming and incident response at full strength. Lowest risk, highest cost.',
    scenarios: ['balanced_launch', 'growth_push', 'crisis_mode'],
    bundle: [
      { decisionId: 'human_review_expansion', intensity: 1 },
      { decisionId: 'red_team_evals', intensity: 1 },
      { decisionId: 'incident_response', intensity: 1 },
      { decisionId: 'automated_testing', intensity: 0.8 }
    ]
  },
  {
    id: 'lean_guardrails',
    name: 'Lean guardrails',
    blurb: 'Cheap, fast levers: rate limiting, feature flags, canary rollout, automated tests.',
    scenarios: ['balanced_launch', 'growth_push'],
    bundle: [
      { decisionId: 'rate_limiting', intensity: 0.8 },
      { decisionId: 'feature_flags', intensity: 1 },
      { decisionId: 'canary_rollout', intensity: 0.7 },
      { decisionId: 'automated_testing', intensity: 0.6 }
    ]
  },
  {
    id: 'growth_with_guardrails',
    name: 'Growth with guardrails',
    blurb: 'A growth campaign, backed by the ML classifier and rate limits to absorb the extra abuse.',
    scenarios: ['balanced_launch', 'growth_push'],
    bundle: [
      { decisionId: 'growth_campaign', intensity: 0.8 },
      { decisionId: 'ml_classifier', intensity: 1 },
      { decisionId: 'rate_limiting', intensity: 0.6 },
      { decisionId: 'latency_optimization', intensity: 0.5 }
    ]
  },
  {
    id: 'crisis_containment',
    name: 'Crisis containment',
    blurb: 'Stop the bleeding: incident response, stricter policy, human review, public transparency.',
    scenarios: ['crisis_mode'],
    bundle: [
      { decisionId: 'incident_response', intensity: 1 },
      { decisionId: 'tighten_policy', intensity: 0.7 },
      { decisionId: 'human_review_expansion', intensity: 0.8 },
      { decisionId: 'safety_comms', intensity: 1 }
    ]
  },
  {
    id: 'trust_rebuild',
    name: 'Rebuild trust',
    blurb: 'Fix false positives and talk openly: ML classifier, user reporting, transparency report.',
    scenarios: ['crisis_mode', 'balanced_launch'],
    bundle: [
      { decisionId: 'ml_classifier', intensity: 1 },
      { decisionId: 'user_reporting', intensity: 1 },
      { decisionId: 'safety_comms', intensity: 1 }
    ]
  }
];

export function presetsFor(scenarioId) {
  return PRESETS.filter(p => p.scenarios.includes(scenarioId));
}

export function resolveBundle(preset, decisions) {
  return preset.bundle
    .map(b => ({ decision: decisions.find(d => d.id === b.decisionId), intensity: b.intensity }))
    .filter(b => b.decision);
}
