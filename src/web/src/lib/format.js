const nf = new Intl.NumberFormat('es-ES');
const pf = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 });
const df = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const dlf = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

export const year = (date) => (date ? String(date).slice(0, 4) : '—');
export const num = (n) => (n === null || n === undefined ? '—' : nf.format(n));
export const pct = (x) => (x === null || x === undefined ? '—' : pf.format(x));
export const rating = (x) => (x === null || x === undefined ? '—' : x.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
export const date = (iso) => (iso ? df.format(new Date(iso)) : '—');
export const longDate = (iso) => (iso ? dlf.format(new Date(iso)) : '—');
export const runtime = (min) => {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};
export const relative = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - Date.parse(iso)) / 1000;
  const rtf = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' });
  if (diff < 60) return 'ahora mismo';
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (diff < 86400 * 30) return rtf.format(-Math.round(diff / 86400), 'day');
  return date(iso);
};
