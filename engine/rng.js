// Seedable random numbers and samplers.
// The browser passes Math.random; tests pass a seeded generator so runs are reproducible.

export function seededRng(seed = 1) {
  // mulberry32
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleNormal(rng, mean = 0, sd = 1) {
  // Box–Muller; 1 - u keeps log() away from 0
  const u1 = 1 - rng();
  const u2 = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Median stays at `median`, the tail is skewed to the right (typical for rates and costs).
export function sampleLognormal(rng, median, sigma) {
  return median * Math.exp(sampleNormal(rng, 0, sigma));
}

export function sampleTriangular(rng, min, mode, max) {
  const u = rng();
  const fc = (mode - min) / (max - min);
  return u < fc
    ? min + Math.sqrt(u * (max - min) * (mode - min))
    : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

export function samplePrior(rng, prior, fallback) {
  if (!prior) return fallback;
  switch (prior.type) {
    case 'lognormal':  return sampleLognormal(rng, prior.median ?? fallback, prior.sigma);
    case 'normal':     return sampleNormal(rng, prior.mean, prior.sd);
    case 'triangular': return sampleTriangular(rng, prior.min, prior.mode, prior.max);
    default:           return fallback;
  }
}
