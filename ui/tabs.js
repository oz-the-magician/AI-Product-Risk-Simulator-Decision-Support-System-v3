export function initTabs(onTabChange) {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === target));
      tabPanes.forEach(p => p.classList.toggle('active', p.dataset.tab === target));
      onTabChange(target);
    });
  });

  // Activate first tab
  if (tabBtns.length > 0) {
    tabBtns[0].click();
  }
}

export function getActiveTab() {
  const active = document.querySelector('.tab-btn.active');
  return active ? active.dataset.tab : 'dashboard';
}
