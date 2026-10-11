// Daily money flow. Decisions now cost money: before, their $/day was shown
// in the bundle but never subtracted, so every decision looked free.
export function decisionCostPerDay(bundle = []) {
  return bundle.reduce((sum, { decision, intensity }) =>
    sum + (decision.cost?.amountPerDay ?? 0) * intensity, 0);
}

export function computeEconomics(metrics, scenario, bundle = []) {
  const costMult = scenario?.costMultiplier ?? 1.0;
  const users = metrics.dau * 1000;                    // dau is in thousands

  const revenue = users * metrics.arpu;
  const moderationCost = 800 + metrics.false_negative * 100 * costMult;
  const computeCost = metrics.compute_cost * costMult;
  const incidentCost = (metrics.incident_rate / 100) * users * 5 * costMult;  // $5 per incident
  const decisionCost = decisionCostPerDay(bundle);

  const cost = moderationCost + computeCost + incidentCost + decisionCost;
  return { revenue, cost, net: revenue - cost, decisionCost };
}
