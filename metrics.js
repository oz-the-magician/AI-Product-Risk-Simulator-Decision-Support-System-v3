export const METRICS = [
  // Hard Safety
  {
    id: "incident_rate",
    name: "Safety Incident Rate",
    unit: "%",
    better: "low",
    baseline: 0.30,
    guardrails: { green: 0.20, yellow: 0.40, red: 0.60 },
    severity: 5,
    category: "Hard",
    description: "Percentage of interactions resulting in safety incidents"
  },
  {
    id: "abuse_rate",
    name: "Abuse Rate",
    unit: "%",
    better: "low",
    baseline: 1.20,
    guardrails: { green: 0.80, yellow: 1.50, red: 2.50 },
    severity: 5,
    category: "Hard",
    description: "Percentage of users engaging in policy-violating behavior"
  },
  {
    id: "jailbreak_rate",
    name: "Jailbreak Attempt Rate",
    unit: "%",
    better: "low",
    baseline: 0.50,
    guardrails: { green: 0.30, yellow: 0.80, red: 1.50 },
    severity: 5,
    category: "Hard",
    description: "Rate of attempts to circumvent safety guardrails"
  },
  {
    id: "false_positive",
    name: "False Positive Rate",
    unit: "%",
    better: "low",
    baseline: 2.50,
    guardrails: { green: 1.50, yellow: 3.50, red: 6.00 },
    severity: 3,
    category: "Hard",
    description: "Rate of legitimate content incorrectly flagged as harmful"
  },
  {
    id: "p95_latency",
    name: "P95 Latency",
    unit: "ms",
    better: "low",
    baseline: 420,
    guardrails: { green: 350, yellow: 600, red: 1000 },
    severity: 3,
    category: "Hard",
    description: "95th percentile response latency"
  },
  {
    id: "policy_coverage",
    name: "Policy Coverage",
    unit: "%",
    better: "high",
    baseline: 78,
    guardrails: { green: 90, yellow: 70, red: 50 },
    severity: 4,
    category: "Hard",
    description: "Percentage of edge cases covered by current policy rules"
  },
  // Balance
  {
    id: "false_negative",
    name: "False Negative Rate",
    unit: "%",
    better: "low",
    baseline: 0.80,
    guardrails: { green: 0.50, yellow: 1.20, red: 2.00 },
    severity: 4,
    category: "Balance",
    description: "Rate of harmful content incorrectly passing safety filters"
  },
  {
    id: "moderation_lag",
    name: "Moderation Lag",
    unit: "ms",
    better: "low",
    baseline: 85,
    guardrails: { green: 60, yellow: 120, red: 200 },
    severity: 3,
    category: "Balance",
    description: "Average time added by content moderation pipeline"
  },
  {
    id: "user_appeal_rate",
    name: "User Appeal Rate",
    unit: "%",
    better: "low",
    baseline: 3.20,
    guardrails: { green: 2.00, yellow: 5.00, red: 8.00 },
    severity: 3,
    category: "Balance",
    description: "Percentage of users who appeal moderation decisions"
  },
  {
    id: "eval_pass_rate",
    name: "Safety Eval Pass Rate",
    unit: "%",
    better: "high",
    baseline: 91,
    guardrails: { green: 95, yellow: 85, red: 75 },
    severity: 4,
    category: "Balance",
    description: "Percentage of automated safety evaluations passing"
  },
  // Growth
  {
    id: "retention",
    name: "7-Day Retention",
    unit: "%",
    better: "high",
    baseline: 42,
    guardrails: { green: 50, yellow: 35, red: 25 },
    severity: 3,
    category: "Growth",
    description: "Percentage of users returning within 7 days"
  },
  {
    id: "dau",
    name: "Daily Active Users",
    unit: "k",
    better: "high",
    baseline: 280,
    guardrails: { green: 350, yellow: 220, red: 160 },
    severity: 3,
    category: "Growth",
    description: "Daily active users in thousands"
  },
  {
    id: "arpu",
    name: "ARPU",
    unit: "$",
    better: "high",
    baseline: 0.18,
    guardrails: { green: 0.22, yellow: 0.14, red: 0.09 },
    severity: 3,
    category: "Growth",
    description: "Average revenue per user per day"
  },
  {
    id: "nps",
    name: "Net Promoter Score",
    unit: "",
    better: "high",
    baseline: 34,
    guardrails: { green: 45, yellow: 25, red: 10 },
    severity: 2,
    category: "Growth",
    description: "Net Promoter Score (-100 to 100)"
  },
  {
    id: "traffic",
    name: "API Traffic",
    unit: "req/s",
    better: "high",
    baseline: 1200,
    guardrails: { green: 1500, yellow: 900, red: 600 },
    severity: 2,
    category: "Growth",
    description: "API requests per second"
  },
  {
    id: "compute_cost",
    name: "Compute Cost",
    unit: "$/day",
    better: "low",
    baseline: 18000,
    guardrails: { green: 15000, yellow: 24000, red: 35000 },
    severity: 2,
    category: "Growth",
    description: "Daily compute infrastructure cost"
  }
];
