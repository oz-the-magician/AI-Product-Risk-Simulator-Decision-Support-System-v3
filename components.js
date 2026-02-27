export function renderChip(label, value, colorClass = '') {
  return `<div class="chip ${colorClass}"><span class="chip-label">${label}</span><span class="chip-value">${value}</span></div>`;
}

export function renderProgressBar(value, max, colorClass = '') {
  const pct = Math.min(100, (value / max) * 100);
  return `<div class="progress-bar"><div class="progress-fill ${colorClass}" style="width:${pct}%"></div></div>`;
}

export function makeSearchableSelect(id, options, value, onChange) {
  const select = document.createElement('select');
  select.id = id;
  select.className = 'styled-select';
  for (const opt of options) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    if (opt.value === value) el.selected = true;
    select.appendChild(el);
  }
  select.addEventListener('change', e => onChange(e.target.value));
  return select;
}
