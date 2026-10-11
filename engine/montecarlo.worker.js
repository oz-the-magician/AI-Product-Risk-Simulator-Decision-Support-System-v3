// Web Worker: runs Monte Carlo in chunks and yields between them,
// so a Cancel message from the page is received mid-run.
import { createMonteCarlo } from './montecarlo.js';

const CHUNK = 20;
let cancelled = false;

self.onmessage = (e) => {
  if (e.data?.type === 'cancel') { cancelled = true; return; }

  const { scenario, bundle, horizonDays, runs } = e.data;
  cancelled = false;
  const mc = createMonteCarlo({ scenario, bundle, horizonDays, runs, rng: Math.random });

  const tick = () => {
    if (cancelled) {
      self.postMessage({ type: 'done', cancelled: true, runs: mc.done });
      return;
    }
    const done = mc.step(CHUNK);
    self.postMessage({ type: 'progress', run: done, total: runs });
    if (done < runs) setTimeout(tick, 0);
    else self.postMessage({ type: 'done', cancelled: false, ...mc.result() });
  };
  tick();
};
