// The active tab is marked by one glass pill that slides between tabs (state change, ~260 ms).
function placePill(btn) {
  const pill = document.querySelector('.tab-pill');
  if (!pill || !btn) return;
  pill.style.width = btn.offsetWidth + 'px';
  pill.style.transform = `translateX(${btn.offsetLeft}px)`;
}

export function initTabs(onTabChange) {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const bar = document.querySelector('.tabs-bar');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.tab === target);
        b.setAttribute('aria-current', b.dataset.tab === target ? 'page' : 'false');
      });
      placePill(btn);
      btn.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      tabPanes.forEach(p => p.classList.toggle('active', p.dataset.tab === target));
      onTabChange(target);
    });
  });

  // Activate first tab without the slide, then let the pill animate from there on.
  if (tabBtns.length > 0) {
    const pill = document.querySelector('.tab-pill');
    if (pill) pill.style.transition = 'none';
    tabBtns[0].click();
    requestAnimationFrame(() => { if (pill) pill.style.transition = ''; });
  }
  // Fonts and resizes change tab widths; keep the pill on its tab.
  const replace = () => placePill(document.querySelector('.tab-btn.active'));
  if (bar && 'ResizeObserver' in window) new ResizeObserver(replace).observe(bar);
  document.fonts?.ready.then(replace);
  // Fade only the edge that has more tabs beyond it.
  const fades = () => {
    if (!bar) return;
    bar.classList.toggle('fade-l', bar.scrollLeft > 2);
    bar.classList.toggle('fade-r', bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2);
  };
  bar?.addEventListener('scroll', fades, { passive: true });
  window.addEventListener('resize', fades);
  fades();
}

export function getActiveTab() {
  const active = document.querySelector('.tab-btn.active');
  return active ? active.dataset.tab : 'dashboard';
}
