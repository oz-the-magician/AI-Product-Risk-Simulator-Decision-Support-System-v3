// Guided tour: one step at a time, the rest of the screen dimmed, the target cut out and outlined.
// Steps: { target: selector | () => Element, title, body (html), before?: () => void, placement?: 'auto'|'top'|'bottom'|'left'|'right' }
// Keyboard: → / Enter next, ← back, Esc closes. Focus stays inside the tooltip while the tour is open.

const PAD = 6;          // gap between the target and the spotlight edge
const GAP = 14;         // gap between the spotlight and the tooltip

export function createTour(steps, { onClose } = {}) {
  let i = 0, root, spot, tip, lastFocus, raf = 0, current = null;

  const resolve = s => typeof s.target === 'function' ? s.target() : document.querySelector(s.target);

  function build() {
    root = document.createElement('div');
    root.className = 'tour';
    root.innerHTML = `
      <div class="tour-shield" aria-hidden="true"></div>
      <div class="tour-spot" aria-hidden="true"></div>
      <div class="tour-tip" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
        <div class="tour-arrow" aria-hidden="true"></div>
        <div class="tour-progress" aria-hidden="true"></div>
        <h3 class="tour-title" id="tour-title"></h3>
        <div class="tour-body" id="tour-body"></div>
        <div class="tour-actions">
          <span class="tour-left"><button type="button" class="tour-skip">Skip tour</button><span class="tour-count"></span></span>
          <span class="tour-nav">
            <button type="button" class="btn btn-ghost btn-sm tour-back">Back</button>
            <button type="button" class="btn btn-primary btn-sm tour-next">Next</button>
          </span>
        </div>
      </div>`;
    document.body.appendChild(root);
    spot = root.querySelector('.tour-spot');
    tip = root.querySelector('.tour-tip');
    root.querySelector('.tour-progress').innerHTML = steps.map(() => '<i></i>').join('');
    root.querySelector('.tour-next').addEventListener('click', next);
    root.querySelector('.tour-back').addEventListener('click', back);
    root.querySelector('.tour-skip').addEventListener('click', close);
    // clicks on the dimmed area don't reach the app (and don't close the tour by accident)
    root.querySelector('.tour-shield').addEventListener('click', () => tip.querySelector('.tour-next').focus());
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
  }

  function onKey(e) {
    if (!root) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight' && !isField(e.target)) { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' && !isField(e.target)) { e.preventDefault(); back(); }
    else if (e.key === 'Tab') {
      // keep focus inside the tooltip
      const f = [...tip.querySelectorAll('button:not([disabled])')];
      const idx = f.indexOf(document.activeElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && idx === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }
  const isField = el => /^(INPUT|SELECT|TEXTAREA)$/.test(el?.tagName);

  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); }

  function show(n) {
    i = Math.max(0, Math.min(steps.length - 1, n));
    const s = steps[i];
    s.before?.();
    // let the app re-render (tab switches) before measuring
    requestAnimationFrame(() => requestAnimationFrame(() => {
      current = resolve(s);
      // scroll only when the target is actually cut off, so the page doesn't jump
      const r0 = current?.getBoundingClientRect();
      if (r0 && (r0.top < 0 || r0.bottom > window.innerHeight)) current.scrollIntoView({ block: 'nearest' });
      root.querySelector('.tour-count').textContent = `${i + 1} / ${steps.length}`;
      root.querySelector('.tour-title').textContent = s.title;
      root.querySelector('.tour-body').innerHTML = s.body;
      root.querySelectorAll('.tour-progress i').forEach((d, k) => d.classList.toggle('on', k <= i));
      const backBtn = root.querySelector('.tour-back'), nextBtn = root.querySelector('.tour-next');
      backBtn.disabled = i === 0;
      nextBtn.textContent = i === steps.length - 1 ? 'Done' : 'Next';
      place();
      nextBtn.focus({ preventScroll: true });
    }));
  }

  function place() {
    if (!root) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = current?.getBoundingClientRect();
    const visible = r && r.width > 0 && r.height > 0;

    // the spotlight rect, computed (not measured from .tour-spot, which may still be animating)
    let sr = { left: vw / 2, top: vh / 2, right: vw / 2, bottom: vh / 2, width: 0, height: 0 };
    if (visible) {
      const x = Math.max(4, r.left - PAD), y = Math.max(4, r.top - PAD);
      const w = Math.min(vw - 4, r.right + PAD) - x, h = Math.min(vh - 4, r.bottom + PAD) - y;
      sr = { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h };
      Object.assign(spot.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', opacity: 1 });
      spot.classList.remove('none');
    } else {
      // no target: dim everything, centre the tooltip
      Object.assign(spot.style, { left: vw / 2 + 'px', top: vh / 2 + 'px', width: '0px', height: '0px' });
      spot.classList.add('none');
    }

    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const fits = {
      bottom: sr.bottom + GAP + th <= vh - 8,
      top: sr.top - GAP - th >= 8,
      right: sr.right + GAP + tw <= vw - 8,
      left: sr.left - GAP - tw >= 8
    };
    let side = steps[i].placement && steps[i].placement !== 'auto' && fits[steps[i].placement] ? steps[i].placement
      : ['bottom', 'right', 'top', 'left'].find(k => fits[k]);
    let left, top;
    if (!visible) {
      side = 'center';
      left = (vw - tw) / 2; top = (vh - th) / 2;
    } else if (!side) {
      // big target, no room beside it: sit inside it, in the corner of the side with the most free space
      // (a step can name the corner that hides the least: inside: 'top-left' | 'bottom-right' …)
      const room = { bottom: vh - sr.bottom, top: sr.top, right: vw - sr.right, left: sr.left };
      const best = Object.entries(room).sort((a, b) => b[1] - a[1])[0][0];
      const [vert, horiz] = (steps[i].inside || `${best === 'top' ? 'top' : 'bottom'}-${best === 'left' ? 'left' : 'right'}`).split('-');
      side = 'inside';
      left = horiz === 'left' ? Math.max(8, sr.left + 12) : Math.min(vw - tw - 8, sr.right - tw - 12);
      top = vert === 'top' ? Math.max(8, sr.top + 12) : Math.min(vh - th - 8, sr.bottom - th - 12);
    } else if (side === 'bottom' || side === 'top') {
      left = Math.min(Math.max(8, sr.left + sr.width / 2 - tw / 2), vw - tw - 8);
      top = side === 'bottom' ? sr.bottom + GAP : sr.top - GAP - th;
    } else {
      top = Math.min(Math.max(8, sr.top + sr.height / 2 - th / 2), vh - th - 8);
      left = side === 'right' ? sr.right + GAP : sr.left - GAP - tw;
    }
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.dataset.side = side;

    // arrow points at the middle of the target
    const arrow = tip.querySelector('.tour-arrow');
    if (side === 'bottom' || side === 'top') {
      arrow.style.left = Math.min(Math.max(16, sr.left + sr.width / 2 - left), tw - 16) + 'px';
      arrow.style.top = '';
    } else if (side === 'left' || side === 'right') {
      arrow.style.top = Math.min(Math.max(16, sr.top + sr.height / 2 - top), th - 16) + 'px';
      arrow.style.left = '';
    }
  }

  function next() { if (i >= steps.length - 1) close(); else show(i + 1); }
  function back() { if (i > 0) show(i - 1); }

  function close() {
    if (!root) return;
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('scroll', schedule, true);
    root.remove(); root = null;
    lastFocus?.focus?.({ preventScroll: true });
    onClose?.(i);
  }

  return {
    start(from = 0) {
      if (root) return;
      lastFocus = document.activeElement;
      build();
      show(from);
    },
    close,
    get open() { return !!root; }
  };
}
