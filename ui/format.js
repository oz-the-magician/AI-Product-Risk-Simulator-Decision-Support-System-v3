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

export function statusEmoji(status) {
  if (status === 'red') return '🔴';
  if (status === 'yellow') return '🟡';
  return '🟢';
}

export function statusColor(status) {
  if (status === 'red') return 'var(--c-red)';
  if (status === 'yellow') return 'var(--c-yellow)';
  return 'var(--c-green)';
}
