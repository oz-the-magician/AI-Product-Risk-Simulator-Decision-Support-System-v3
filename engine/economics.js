export function computeEconomics(metrics, scenario) {
  const costMult = scenario?.costMultiplier ?? 1.0;

  // Revenue
  const revenue = (metrics.dau * 1000) * metrics.arpu; // dau in thousands

  // Costs
  const modCost = metrics.false_negative * 100 * costMult + 800;
  const computeCost = metrics.compute_cost * costMult;
  const incidentCost = metrics.incident_rate * (metrics.dau * 1000) * 0.05 * costMult;

  const cost = modCost + computeCost + incidentCost;
  const net = revenue - cost;

  return { revenue, cost, net };
}
