import { settings } from '../config';

// Business rules bound to the current database snapshot.
export function createDomain(db) {
  const cust = (id) => db.customers.find((c) => c.id === id) || { name: '—' };
  const mat = (id) => db.materials.find((m) => m.id === id) || { name: '—', rate: 0 };
  const emp = (id) => db.employees.find((e) => e.id === id) || { name: '—', salary: 0 };

  const rateFor = (custId, matId) => {
    const r = db.rates
      .filter((x) => x.custId === custId && x.matId === matId)
      .sort((a, b) => b.from.localeCompare(a.from))[0];
    return r ? { rate: r.rate, src: 'contract rate' } : { rate: mat(matId).rate, src: 'list rate' };
  };
  const net = (o) => Math.max(0, (o.gross || 0) - (o.tare || 0)) / 1000;
  const amount = (o) => net(o) * rateFor(o.custId, o.matId).rate;
  const loading = () => Number(settings.loadingCharge ?? 1250);
  const gstPct = () => Number(settings.gstPercent ?? 5);
  const payable = (o) => {
    const a = amount(o) + loading();
    return a + (a * gstPct()) / 100;
  };
  const outstanding = (c) => Math.max(0, c.invoiced - c.received);
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

  return { db, cust, mat, emp, rateFor, net, amount, loading, gstPct, payable, outstanding, hours, advanceBalance, payLine };
}

const TAGS = {
  'ag-t-bad': ['Void', 'Absent', 'On hold', 'Paused', 'Overdue', 'Debit', 'At limit'],
  'ag-t-warn': ['Pending', 'Open', 'Recovering', 'Half day', 'Partial', 'Leave', 'Watch'],
  'ag-t-info': ['In Transit', 'Tare captured'],
  'ag-t-ok': ['Completed', 'Paid', 'Present', 'Active', 'Cleared', 'Clear', 'Credit'],
};

export function tagOf(v) {
  for (const cls in TAGS) if (TAGS[cls].includes(v)) return cls;
  return 'ag-t-mute';
}
