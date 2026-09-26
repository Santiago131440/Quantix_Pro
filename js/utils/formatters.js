const config = { locale: 'es-419', currency: 'USD' };
const cache = new Map();

export function configureFormatters({ locale, currency } = {}) {
  if (locale) config.locale = locale;
  if (currency) config.currency = currency;
  cache.clear();
}

function formatter(key, factory) {
  if (!cache.has(key)) cache.set(key, factory());
  return cache.get(key);
}

export function formatCurrency(value, { compact = false } = {}) {
  const key = `cur-${compact}`;
  return formatter(key, () => new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  })).format(Number(value) || 0);
}

export function formatNumber(value, decimals = 0) {
  return formatter(`num-${decimals}`, () => new Intl.NumberFormat(config.locale, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  })).format(Number(value) || 0);
}

export function formatPercent(value, decimals = 1) {
  return formatter(`pct-${decimals}`, () => new Intl.NumberFormat(config.locale, {
    style: 'percent', maximumFractionDigits: decimals, minimumFractionDigits: 0,
  })).format(Number(value) || 0);
}

export function formatQuantity(value, unit = '') {
  const decimals = Number.isInteger(Number(value)) ? 0 : 2;
  return `${formatNumber(value, decimals)}${unit ? ` ${unit}` : ''}`;
}

export function formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return '—';
  return formatter(`date-${JSON.stringify(options)}`, () => new Intl.DateTimeFormat(config.locale, options)).format(new Date(value));
}

export function formatDateTime(value) {
  return formatDate(value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatShortDate(value) {
  return formatDate(value, { day: 'numeric', month: 'short' });
}

export function formatRelative(value, reference = Date.now()) {
  if (!value) return '—';
  const seconds = Math.round((new Date(value).getTime() - reference) / 1000);
  const rtf = formatter('rel', () => new Intl.RelativeTimeFormat(config.locale, { numeric: 'auto' }));
  const units = [['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60]];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'justo ahora';
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

export function signed(value, formatterFn = formatNumber) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : number < 0 ? '−' : ''}${formatterFn(Math.abs(number))}`;
}
