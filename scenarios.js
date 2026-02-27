export const SCENARIOS = [
  {
    id: "balanced_launch",
    name: "Balanced Launch",
    description: "Standard product launch with moderate growth and safety monitoring",
    horizonDays: 60,
    riskSensitivity: 1.0,
    costMultiplier: 1.0,
    shocks: [
      { day: 0,  metricId: "dau",          shock: +0.10 },
      { day: 14, metricId: "traffic",       shock: +0.15 },
      { day: 30, metricId: "abuse_rate",    shock: +0.08 },
      { day: 45, metricId: "dau",           shock: +0.12 }
    ]
  },
  {
    id: "growth_push",
    name: "Growth Push",
    description: "Aggressive growth campaign prioritizing user acquisition. Higher traffic strains safety systems.",
    horizonDays: 90,
    riskSensitivity: 1.4,
    costMultiplier: 1.6,
    shocks: [
      { day: 0,  metricId: "dau",           shock: +0.30 },
      { day: 0,  metricId: "traffic",       shock: +0.35 },
      { day: 7,  metricId: "abuse_rate",    shock: +0.15 },
      { day: 7,  metricId: "jailbreak_rate",shock: +0.12 },
      { day: 21, metricId: "incident_rate", shock: +0.10 },
      { day: 35, metricId: "dau",           shock: +0.20 },
      { day: 60, metricId: "compute_cost",  shock: +0.25 }
    ]
  },
  {
    id: "crisis_mode",
    name: "Crisis Mode",
    description: "A high-profile incident triggers a safety crisis. Regulatory attention, user backlash, and surging abuse.",
    horizonDays: 60,
    riskSensitivity: 2.2,
    costMultiplier: 2.8,
    shocks: [
      { day: 0,  metricId: "incident_rate", shock: +0.40 },
      { day: 0,  metricId: "abuse_rate",    shock: +0.35 },
      { day: 0,  metricId: "jailbreak_rate",shock: +0.30 },
      { day: 3,  metricId: "nps",           shock: -18 },
      { day: 3,  metricId: "retention",     shock: -0.12 },
      { day: 7,  metricId: "dau",           shock: -0.15 },
      { day: 10, metricId: "traffic",       shock: +0.40 },
      { day: 14, metricId: "compute_cost",  shock: +0.30 },
      { day: 21, metricId: "user_appeal_rate", shock: +0.50 },
      { day: 30, metricId: "arpu",          shock: -0.08 }
    ]
  }
];
