import { settings } from '../config';
import { isoDate, M } from './format';

const OPEN_END = '9999-12-31';
export const OTHER_MATERIAL = 'M10';

export function dayBefore(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const periodLabel = (r) => r.from + ' → ' + (r.to || 'ongoing');

export function rateStatus(r, date = isoDate()) {
  if (r.from > date) return 'Upcoming';
  if (r.to && r.to < date) return 'Ended';
  return 'Active';
}

// Checks a new or edited rate period against the others for the same party and material.
// An open-ended earlier period is closed the day before the new one starts; any other overlap is rejected.
export function planRate(rates, rec) {
  const errors = {};
  if (!rec.matId) errors.matId = 'Choose a material.';
  if (!(+rec.rate > 0)) errors.rate = 'Enter a rate per ton greater than zero.';
  if (!rec.from) errors.from = 'Required.';
  if (rec.to && rec.from && rec.to < rec.from) errors.to = 'The end date is before the start date.';
  if (Object.keys(errors).length) return { errors };

  const closes = [];
  const end = rec.to || OPEN_END;
  for (const r of rates) {
    if (r.id === rec.id || r.custId !== rec.custId || r.matId !== rec.matId) continue;
    if (!(rec.from <= (r.to || OPEN_END) && end >= r.from)) continue;
    if (!r.to && r.from < rec.from) {
      closes.push({ id: r.id, to: dayBefore(rec.from), was: r });
      continue;
    }
    const hint = !rec.to && r.from > rec.from ? ' Give this period an end date before ' + r.from + '.' : '';
    return { errors: { from: 'Overlaps the ' + M(r.rate) + '/t period ' + periodLabel(r) + '.' + hint } };
  }
  return { errors: null, closes };
}

// Business rules bound to the current database snapshot.
export function createDomain(db) {
  const cust = (id) => db.customers.find((c) => c.id === id) || { name: '—' };
  const supplier = (id) => (db.suppliers || []).find((p) => p.id === id) || { name: '—' };
  const mat = (id) => db.materials.find((m) => m.id === id) || { name: '—' };
  const emp = (id) => db.employees.find((e) => e.id === id) || { name: '—', salary: 0 };
  const salesMaterials = () => db.materials.filter((m) => m.kind !== 'purchase');

  // Rate in force on a date: the party's own card first, then the standard card, else none.
  const rateFor = (custId, matId, date = isoDate()) => {
    const live = (r) => r.matId === matId && r.from <= date && (!r.to || date <= r.to);
    const newest = (list) => list.sort((a, b) => b.from.localeCompare(a.from))[0];
    const party = custId ? newest(db.rates.filter((r) => r.custId === custId && live(r))) : null;
    if (party) return { rate: party.rate, src: 'party rate', card: party };
    const std = newest(db.rates.filter((r) => !r.custId && live(r)));
    if (std) return { rate: std.rate, src: 'standard rate', card: std };
    return { rate: 0, src: 'no rate set', card: null };
  };
  const orderRate = (o) => (+o.manualRate > 0 ? { rate: +o.manualRate, src: 'manual rate' } : rateFor(o.custId, o.matId, o.date));
  const matLabel = (o) => (o.matId === OTHER_MATERIAL && o.matName ? o.matName + ' (other)' : mat(o.matId).name);

  const net = (o) => Math.max(0, (o.gross || 0) - (o.tare || 0)) / 1000;
  const amount = (o) => net(o) * orderRate(o).rate;
  const loading = () => Number(settings.loadingCharge ?? 1250);
  const gstPct = () => Number(settings.gstPercent ?? 5);
  const payable = (o) => {
    const a = amount(o) + loading();
    return a + (a * gstPct()) / 100;
  };
  // Billed = every credit ticket for the party (not void), at the rate in force on its date.
  const billed = (c) => db.orders
    .filter((o) => o.custId === c.id && o.method === 'Credit' && o.status !== 'Void')
    .reduce((s, o) => s + amount(o), 0);
  const outstanding = (c) => Math.max(0, billed(c) - (c.received || 0));
  const hours = (a) => {
    if (!a.in || a.in === '—') return 0;
    const p = (t) => {
      const x = t.split(':');
      return +x[0] + +x[1] / 60;
    };
    return Math.max(0, p(a.out) - p(a.in));
  };
  const advanceBalance = (empId, openOnly) =>
    db.advances
      .filter((a) => a.empId === empId && (!openOnly || a.status !== 'Cleared'))
      .reduce((s, a) => s + (a.amount - a.recovered), 0);
  const payLine = (p) => {
    const e = emp(p.empId);
    const base = (e.salary / 26) * p.days;
    const ot = p.ot * (e.salary / 26 / 8) * 1.5;
    const ded = Math.min(advanceBalance(p.empId, true), 4000);
    return { base, ot, ded, net: base + ot - ded };
  };

  return {
    db, cust, supplier, mat, emp, salesMaterials, rateFor, orderRate, matLabel,
    net, amount, loading, gstPct, payable, billed, outstanding, hours, advanceBalance, payLine,
  };
}

const TAGS = {
  'ag-t-bad': ['Void', 'Absent', 'On hold', 'Paused', 'Overdue', 'Debit', 'At limit'],
  'ag-t-warn': ['Pending', 'Open', 'Recovering', 'Half day', 'Partial', 'Leave', 'Watch', 'Due'],
  'ag-t-info': ['In Transit', 'Tare captured', 'Upcoming', 'Party rate'],
  'ag-t-ok': ['Completed', 'Paid', 'Present', 'Active', 'Cleared', 'Clear', 'Credit'],
};

export function tagOf(v) {
  for (const cls in TAGS) if (TAGS[cls].includes(v)) return cls;
  return 'ag-t-mute';
}
