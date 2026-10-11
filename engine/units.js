// How an effect is applied and what range a metric can take.

// An effect is either relative ("pct": +0.18 means +18 %) or absolute in metric units
// ("abs": NPS −4 means minus four points). Older configs have no `kind`, so a magnitude
// of 1 or more is treated as absolute — a relative effect of ±100 % or more makes no sense.
export function isAbsolute(effect) {
  if (effect.kind === 'abs') return true;
  if (effect.kind === 'pct') return false;
  const v = effect.effect ?? effect.shock ?? 0;
  return Math.abs(v) >= 1;
}

export function boundsFor(metric) {
  if (metric.id === 'nps') return [-100, 100];
  if (metric.unit === '%') return [0, 100];
  return [0, Infinity];
}

export function clampToBounds(metric, value) {
  const [lo, hi] = boundsFor(metric);
  return Math.min(hi, Math.max(lo, value));
}
