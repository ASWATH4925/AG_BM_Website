export const N = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
export const M = (n) => '₹' + N(Math.round(n || 0));
export const T = (n) => Number(n || 0).toFixed(2);
export const pad2 = (n) => String(n).padStart(2, '0');
export const hhmm = (d = new Date()) => pad2(d.getHours()) + ':' + pad2(d.getMinutes());
// Local calendar date (YYYY-MM-DD); toISOString() would give the UTC date, a day behind before 05:30 IST.
export const isoDate = (d = new Date()) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

export function brandMark(name) {
  const w = name.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '';
  if (w[0].length >= 2 && w[0].length <= 3 && w[0] === w[0].toUpperCase()) return w[0];
  return w.map((x) => x[0]).join('').slice(0, 2).toUpperCase();
}

// Yard quantity unit: 1 unit = 4 tons.
export const TONS_PER_UNIT = 4;
export const U = (tons) => (Number(tons || 0) / TONS_PER_UNIT).toFixed(2);
