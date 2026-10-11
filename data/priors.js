// Uncertainty distributions for Monte Carlo
// type: "triangular" | "normal"
export const METRIC_PRIORS = {
  incident_rate:    { type: "triangular", min: 0.10, mode: 0.30, max: 0.60 },
  abuse_rate:       { type: "triangular", min: 0.50, mode: 1.20, max: 2.80 },
  jailbreak_rate:   { type: "triangular", min: 0.20, mode: 0.50, max: 1.60 },
  false_positive:   { type: "normal",     mean: 2.50, sd: 0.60 },
  false_negative:   { type: "normal",     mean: 0.80, sd: 0.20 },
  p95_latency:      { type: "normal",     mean: 420,  sd: 60 },
  policy_coverage:  { type: "normal",     mean: 78,   sd: 5 },
  moderation_lag:   { type: "normal",     mean: 85,   sd: 15 },
  user_appeal_rate: { type: "triangular", min: 1.50, mode: 3.20, max: 7.00 },
  eval_pass_rate:   { type: "normal",     mean: 91,   sd: 3 },
  retention:        { type: "normal",     mean: 42,   sd: 5 },
  dau:              { type: "normal",     mean: 280,  sd: 30 },
  arpu:             { type: "normal",     mean: 0.18, sd: 0.03 },
  nps:              { type: "normal",     mean: 34,   sd: 8 },
  traffic:          { type: "normal",     mean: 1200, sd: 120 },
  compute_cost:     { type: "normal",     mean: 18000, sd: 2000 }
};

// Uncertainty on causal edge coefficients
export const EDGE_PRIORS = {
  "false_positive->retention": { type: "normal", mean: -0.12, sd: 0.04 },
  "false_positive->nps":       { type: "normal", mean: -0.10, sd: 0.03 },
  "abuse_rate->incident_rate": { type: "normal", mean: +0.25, sd: 0.06 },
  "abuse_rate->nps":           { type: "normal", mean: -0.08, sd: 0.03 },
  "jailbreak_rate->incident_rate": { type: "normal", mean: +0.20, sd: 0.05 },
  "incident_rate->retention":  { type: "normal", mean: -0.15, sd: 0.04 },
  "incident_rate->dau":        { type: "normal", mean: -0.10, sd: 0.03 },
  "incident_rate->nps":        { type: "normal", mean: -0.12, sd: 0.04 },
  "retention->dau":            { type: "normal", mean: +0.10, sd: 0.03 },
  "dau->traffic":              { type: "normal", mean: +0.12, sd: 0.03 },
  "dau->arpu":                 { type: "normal", mean: +0.05, sd: 0.02 },
  "p95_latency->retention":    { type: "normal", mean: -0.08, sd: 0.02 },
  "p95_latency->nps":          { type: "normal", mean: -0.06, sd: 0.02 },
  "nps->retention":            { type: "normal", mean: +0.08, sd: 0.02 },
  "eval_pass_rate->policy_coverage": { type: "normal", mean: +0.10, sd: 0.03 },
  "policy_coverage->false_negative": { type: "normal", mean: -0.12, sd: 0.03 },
  "traffic->compute_cost":     { type: "normal", mean: +0.15, sd: 0.04 },
  "moderation_lag->retention": { type: "normal", mean: -0.05, sd: 0.02 }
};
