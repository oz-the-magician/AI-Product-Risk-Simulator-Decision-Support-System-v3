export function fmtMetric(value, unit) {
  if (value === undefined || value === null || isNaN(value)) return '—';
  switch (unit) {
    case '%':   return value.toFixed(2) + '%';
    case 'ms':  return Math.round(value) + ' ms';
    case '$':   return '$' + value.toFixed(3);
    case 'k':   return value.toFixed(1) + 'k';
    case 'req/s': return Math.round(value) + ' req/s';
    case '$/day': return '$' + Math.round(value).toLocaleString();
    case '':    return Math.round(value).toString();
    default:    return (+value).toFixed(2) + (unit ? ' ' + unit : '');
  }
}

export function fmtMoney(val) {
  if (val === undefined || isNaN(val)) return '—';
  const abs = Math.abs(val);
  if (abs >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (val / 1e3).toFixed(1) + 'k';
  return val.toFixed(0);
}

export function fmtPct(val) {
  if (val === undefined || isNaN(val)) return '—';
  return (val * 100).toFixed(1) + '%';
}

const STATUS_LABEL = { green: 'OK', yellow: 'Watch', red: 'Breach' };

// A drawn status mark. With a label it reads as a badge; without, a small shape plus screen-reader text.
// Shape differs per state (dot, ring, diamond) so status never depends on colour alone.
export function statusEmoji(status, withLabel = false) {
  const s = STATUS_LABEL[status] ? status : 'green';
  return withLabel
    ? `<span class="st st-${s}"><i aria-hidden="true"></i>${STATUS_LABEL[s]}</span>`
    : `<span class="st-mark st-${s}" role="img" aria-label="${STATUS_LABEL[s]}"></span>`;
}

export function statusColor(status) {
  if (status === 'red') return 'var(--c-red)';
  if (status === 'yellow') return 'var(--c-yellow)';
  return 'var(--c-green)';
}
