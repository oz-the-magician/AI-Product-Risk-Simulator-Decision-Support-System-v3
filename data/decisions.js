export const DECISIONS = [
  {
    id: "tighten_policy",
    name: "Tighten Policy Enforcement",
    description: "Increase strictness of content moderation rules, reducing abuse but raising false positives",
    category: "Policy",
    levers: [
      { metricId: "false_positive", effect: +0.18, lagDays: 1, halfLifeDays: 7 },
      { metricId: "abuse_rate",     effect: -0.22, lagDays: 3, halfLifeDays: 14 },
      { metricId: "jailbreak_rate", effect: -0.15, lagDays: 3, halfLifeDays: 14 },
      { metricId: "retention",      effect: -0.05, lagDays: 7, halfLifeDays: 21 },
      { metricId: "nps",            effect: -4,    lagDays: 10, halfLifeDays: 30 }
    ],
    cost: { type: "opex", amountPerDay: 800 },
    latencyImpactMs: 12
  },
  {
    id: "loosen_policy",
    name: "Relax Policy Enforcement",
    description: "Reduce over-blocking to improve user experience at cost of higher abuse risk",
    category: "Policy",
    levers: [
      { metricId: "false_positive", effect: -0.25, lagDays: 1, halfLifeDays: 7 },
      { metricId: "abuse_rate",     effect: +0.18, lagDays: 5, halfLifeDays: 21 },
      { metricId: "retention",      effect: +0.04, lagDays: 5, halfLifeDays: 21 },
      { metricId: "nps",            effect: +5,    lagDays: 7, halfLifeDays: 30 },
      { metricId: "user_appeal_rate", effect: -0.30, lagDays: 3, halfLifeDays: 14 }
    ],
    cost: { type: "opex", amountPerDay: 200 },
    latencyImpactMs: -8
  },
  {
    id: "ml_classifier",
    name: "Deploy ML Classifier",
    description: "Ship new ML-based content classifier to reduce both false positives and false negatives",
    category: "Tooling",
    levers: [
      { metricId: "false_positive",  effect: -0.30, lagDays: 7, halfLifeDays: 90 },
      { metricId: "false_negative",  effect: -0.25, lagDays: 7, halfLifeDays: 90 },
      { metricId: "abuse_rate",      effect: -0.10, lagDays: 10, halfLifeDays: 60 },
      { metricId: "p95_latency",     effect: +0.08, lagDays: 7, halfLifeDays: 60 },
      { metricId: "eval_pass_rate",  effect: +0.05, lagDays: 10, halfLifeDays: 90 }
    ],
    cost: { type: "capex", amountPerDay: 3500 },
    latencyImpactMs: 35
  },
  {
    id: "human_review_expansion",
    name: "Expand Human Review",
    description: "Increase human moderation team size to catch more edge cases",
    category: "Moderation",
    levers: [
      { metricId: "false_negative",  effect: -0.35, lagDays: 14, halfLifeDays: 45 },
      { metricId: "incident_rate",   effect: -0.20, lagDays: 10, halfLifeDays: 30 },
      { metricId: "abuse_rate",      effect: -0.15, lagDays: 14, halfLifeDays: 45 },
      { metricId: "moderation_lag",  effect: +0.15, lagDays: 14, halfLifeDays: 30 },
      { metricId: "policy_coverage", effect: +0.08, lagDays: 14, halfLifeDays: 60 }
    ],
    cost: { type: "opex", amountPerDay: 5200 },
    latencyImpactMs: 0
  },
  {
    id: "rate_limiting",
    name: "Enhanced Rate Limiting",
    description: "Implement per-user rate limits to curb abuse while managing compute costs",
    category: "Tooling",
    levers: [
      { metricId: "abuse_rate",      effect: -0.20, lagDays: 2, halfLifeDays: 14 },
      { metricId: "jailbreak_rate",  effect: -0.18, lagDays: 2, halfLifeDays: 14 },
      { metricId: "traffic",         effect: -0.08, lagDays: 2, halfLifeDays: 14 },
      { metricId: "compute_cost",    effect: -0.12, lagDays: 2, halfLifeDays: 14 },
      { metricId: "retention",       effect: -0.03, lagDays: 5, halfLifeDays: 21 }
    ],
    cost: { type: "opex", amountPerDay: 400 },
    latencyImpactMs: 5
  },
  {
    id: "red_team_evals",
    name: "Red Team Evaluation Sprint",
    description: "Intensive red-teaming to identify and patch jailbreak vectors",
    category: "Evals",
    levers: [
      { metricId: "jailbreak_rate",  effect: -0.35, lagDays: 5, halfLifeDays: 30 },
      { metricId: "incident_rate",   effect: -0.15, lagDays: 7, halfLifeDays: 30 },
      { metricId: "eval_pass_rate",  effect: +0.06, lagDays: 5, halfLifeDays: 60 },
      { metricId: "policy_coverage", effect: +0.10, lagDays: 7, halfLifeDays: 60 }
    ],
    cost: { type: "capex", amountPerDay: 2800 },
    latencyImpactMs: 0
  },
  {
    id: "canary_rollout",
    name: "Canary Rollout (10%)",
    description: "Gradual traffic rollout to de-risk new model deployments",
    category: "Rollout",
    levers: [
      { metricId: "incident_rate",   effect: -0.10, lagDays: 3, halfLifeDays: 21 },
      { metricId: "p95_latency",     effect: -0.05, lagDays: 3, halfLifeDays: 21 },
      { metricId: "traffic",         effect: -0.05, lagDays: 1, halfLifeDays: 14 }
    ],
    cost: { type: "opex", amountPerDay: 600 },
    latencyImpactMs: 0
  },
  {
    id: "shadow_mode",
    name: "Shadow Mode Testing",
    description: "Run new classifier in shadow mode to gather data before deployment",
    category: "Evals",
    levers: [
      { metricId: "eval_pass_rate",  effect: +0.04, lagDays: 7, halfLifeDays: 60 },
      { metricId: "policy_coverage", effect: +0.06, lagDays: 7, halfLifeDays: 60 },
      { metricId: "p95_latency",     effect: +0.04, lagDays: 7, halfLifeDays: 30 }
    ],
    cost: { type: "opex", amountPerDay: 900 },
    latencyImpactMs: 20
  },
  {
    id: "user_reporting",
    name: "User Reporting System",
    description: "In-product abuse reporting to leverage user community for safety signals",
    category: "Moderation",
    levers: [
      { metricId: "abuse_rate",      effect: -0.12, lagDays: 14, halfLifeDays: 45 },
      { metricId: "incident_rate",   effect: -0.10, lagDays: 14, halfLifeDays: 45 },
      { metricId: "nps",             effect: +3,    lagDays: 7, halfLifeDays: 60 },
      { metricId: "retention",       effect: +0.02, lagDays: 14, halfLifeDays: 60 }
    ],
    cost: { type: "capex", amountPerDay: 1200 },
    latencyImpactMs: 0
  },
  {
    id: "latency_optimization",
    name: "Latency Optimization Sprint",
    description: "Engineering effort to reduce pipeline latency through caching and model optimization",
    category: "Tooling",
    levers: [
      { metricId: "p95_latency",     effect: -0.25, lagDays: 7, halfLifeDays: 120 },
      { metricId: "moderation_lag",  effect: -0.20, lagDays: 7, halfLifeDays: 120 },
      { metricId: "retention",       effect: +0.03, lagDays: 14, halfLifeDays: 60 },
      { metricId: "dau",             effect: +0.02, lagDays: 14, halfLifeDays: 60 },
      { metricId: "compute_cost",    effect: -0.08, lagDays: 7, halfLifeDays: 120 }
    ],
    cost: { type: "capex", amountPerDay: 2000 },
    latencyImpactMs: -40
  },
  {
    id: "growth_campaign",
    name: "Growth Marketing Campaign",
    description: "Paid acquisition campaign to boost DAU and revenue",
    category: "Growth",
    levers: [
      { metricId: "dau",             effect: +0.20, lagDays: 5, halfLifeDays: 21 },
      { metricId: "traffic",         effect: +0.25, lagDays: 5, halfLifeDays: 21 },
      { metricId: "abuse_rate",      effect: +0.05, lagDays: 7, halfLifeDays: 21 },
      { metricId: "incident_rate",   effect: +0.04, lagDays: 7, halfLifeDays: 21 }
    ],
    cost: { type: "opex", amountPerDay: 4000 },
    latencyImpactMs: 0
  },
  {
    id: "safety_comms",
    name: "Safety Transparency Report",
    description: "Publish safety metrics publicly to build trust with users and regulators",
    category: "Policy",
    levers: [
      { metricId: "nps",             effect: +6,    lagDays: 5, halfLifeDays: 90 },
      { metricId: "retention",       effect: +0.03, lagDays: 7, halfLifeDays: 90 },
      { metricId: "user_appeal_rate",effect: -0.10, lagDays: 7, halfLifeDays: 45 }
    ],
    cost: { type: "opex", amountPerDay: 300 },
    latencyImpactMs: 0
  },
  {
    id: "automated_testing",
    name: "Automated Safety Testing",
    description: "CI/CD integration for automated safety regression testing",
    category: "Evals",
    levers: [
      { metricId: "eval_pass_rate",  effect: +0.08, lagDays: 7, halfLifeDays: 180 },
      { metricId: "incident_rate",   effect: -0.08, lagDays: 14, halfLifeDays: 90 },
      { metricId: "policy_coverage", effect: +0.12, lagDays: 10, halfLifeDays: 180 }
    ],
    cost: { type: "capex", amountPerDay: 1500 },
    latencyImpactMs: 0
  },
  {
    id: "incident_response",
    name: "Incident Response Protocol",
    description: "24/7 on-call rotation and automated incident response playbooks",
    category: "Moderation",
    levers: [
      { metricId: "incident_rate",   effect: -0.25, lagDays: 3, halfLifeDays: 30 },
      { metricId: "moderation_lag",  effect: -0.15, lagDays: 5, halfLifeDays: 30 },
      { metricId: "compute_cost",    effect: +0.05, lagDays: 3, halfLifeDays: 30 }
    ],
    cost: { type: "opex", amountPerDay: 2200 },
    latencyImpactMs: 0
  },
  {
    id: "feature_flags",
    name: "Feature Flag Governance",
    description: "Fine-grained feature flagging to enable rapid rollback without full redeploy",
    category: "Rollout",
    levers: [
      { metricId: "incident_rate",   effect: -0.08, lagDays: 2, halfLifeDays: 120 },
      { metricId: "p95_latency",     effect: +0.03, lagDays: 2, halfLifeDays: 60 },
      { metricId: "eval_pass_rate",  effect: +0.03, lagDays: 5, halfLifeDays: 120 }
    ],
    cost: { type: "capex", amountPerDay: 700 },
    latencyImpactMs: 3
  }
];
