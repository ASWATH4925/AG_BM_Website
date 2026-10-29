import { isoDate, M } from './format';
import { isPaidMethod } from './payments';

const OPEN_END = '9999-12-31';
export const OTHER_MATERIAL = 'M10';

// An on-site vehicle came in either empty (first weight is tare) or loaded (first weight is gross).
// Rows saved before this distinction have no `entry` and count as empty.
export const cameInLoaded = (v) => v.entry === 'loaded';
export const firstWeight = (v) => (cameInLoaded(v) ? v.gross : v.tare);

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
  const mat = (id) => db.materials.find((m) => m.id === id) || { name: '—' };
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
  // Material value = net tons × rate per ton. The bill adds the GST and rent amounts staff entered for that load.
  const amount = (o) => net(o) * orderRate(o).rate;
  const extras = (o) => (+o.gst || 0) + (+o.rent || 0);
  const billTotal = (o) => amount(o) + extras(o);
  const partyLabel = (o) => (o.custId ? cust(o.custId).name : (o.walkIn || 'Walk-in') + ' (walk-in)');

  // Payments are either against a load (ticketId) or a receipt on the party's account (no ticketId).
  const payments = db.payments || [];
  const paymentsFor = (ticketId) => payments.filter((p) => p.ticketId === ticketId);
  const receiptsOf = (custId) => payments.filter((p) => !p.ticketId && p.custId === custId);
  const legacyPaid = (o) => !paymentsFor(o.id).length && isPaidMethod(o.method);
  const paidOn = (o) => (legacyPaid(o) ? billTotal(o) : paymentsFor(o.id).reduce((s, p) => s + p.amount, 0));
  const onCredit = (o) => {
    if (o.status === 'Void' || !o.custId || legacyPaid(o)) return 0;
    return Math.max(0, billTotal(o) - paidOn(o) - (+o.roundOff || 0));
  };
  const loadsOf = (custId) => db.orders.filter((o) => o.custId === custId && o.status !== 'Void');
  // Billed on credit = what each load left on credit; received = receipts on the account.
  const billed = (c) => loadsOf(c.id).reduce((s, o) => s + onCredit(o), 0);
  const received = (c) => receiptsOf(c.id).reduce((s, p) => s + p.amount, 0);
  const outstanding = (c) => Math.max(0, billed(c) - received(c));
  const lastReceipt = (c) => receiptsOf(c.id).map((p) => p.date).sort().pop() || '—';

  // Account ledger for a statement: every load (debit) and every payment, round-off and receipt (credit), in time order.
  // from / to are 'YYYY-MM-DD HH:MM' strings; entries before `from` roll into the opening balance.
  const stamp = (x) => x.date + ' ' + (x.time || '00:00');
  const ledger = (custId, from = '', to = '') => {
    const rows = [];
    loadsOf(custId).forEach((o) => {
      rows.push({ ts: stamp(o), kind: 'load', o, ref: o.ticket, debit: billTotal(o), credit: 0 });
      if (legacyPaid(o)) rows.push({ ts: stamp(o), kind: 'pay', o, ref: o.ticket, method: o.method, debit: 0, credit: billTotal(o) });
      paymentsFor(o.id).forEach((p) => rows.push({ ts: stamp(p), kind: 'pay', o, p, ref: o.ticket, method: p.method, debit: 0, credit: p.amount }));
      if (+o.roundOff) rows.push({ ts: stamp(o), kind: 'round', o, ref: o.ticket, debit: 0, credit: +o.roundOff });
    });
    receiptsOf(custId).forEach((p) => rows.push({ ts: stamp(p), kind: 'receipt', p, ref: p.ref || 'Receipt', method: p.method, debit: 0, credit: p.amount }));
    rows.sort((a, b) => a.ts.localeCompare(b.ts) || (a.kind === 'load' ? -1 : 1));
    let opening = 0;
    const inRange = [];
    rows.forEach((r) => {
      if (from && r.ts < from) opening += r.debit - r.credit;
      else if (!to || r.ts <= to) inRange.push(r);
    });
    let bal = opening;
    inRange.forEach((r) => { bal += r.debit - r.credit; r.balance = bal; });
    const sum = (k) => inRange.reduce((s, r) => s + r[k], 0);
    return { opening, rows: inRange, debit: sum('debit'), credit: sum('credit'), closing: bal };
  };
  // ---- soling loads ----
  // A soling load's value = net tons × the rate per ton recorded on the load + any extra charges.
  const solRate = (u) => (+u.manualRate > 0 ? { rate: +u.manualRate, src: 'load rate' } : { rate: 0, src: 'no rate set' });
  const solAmount = (u) => net(u) * solRate(u).rate;
  const solValue = (u) => solAmount(u) + (+u.extra || 0);
  // Payments on a voided load no longer count towards anyone's account.
  const voidTickets = new Set(db.orders.filter((o) => o.status === 'Void').map((o) => o.id));


  // ---- fuel bunks and spares companies (we take on credit, pay later) ----
  // A bill's value: the amount typed, else litres × price per litre (fuel); plus any GST.
  const creditors = db.creditors || [];
  const creditor = (id) => creditors.find((c) => c.id === id) || { id, name: '—', kind: '' };
  const creditorName = (id) => { const c = creditor(id); return c.name + (c.kind === 'bunk' ? ' (fuel bunk)' : c.kind === 'vendor' ? ' (spares)' : ''); };
  const crBillValue = (b) => (+b.amount > 0 ? +b.amount : (+b.litres || 0) * (+b.rate || 0)) + (+b.gst || 0);
  const crBillsOf = (id) => (db.crBills || []).filter((b) => b.creditorId === id);
  const creditorPaysOf = (id) => (db.crPayments || [])
    .filter((p) => p.creditorId === id)
    .map((p) => ({ p, source: 'company', by: 'Company' }))
    .concat(payments
      .filter((p) => p.toType === 'creditor' && p.creditorId === id && !voidTickets.has(p.ticketId))
      .map((p) => ({ p, source: 'party', by: p.custId ? cust(p.custId).name : (p.walkIn || 'Walk-in') + ' (walk-in)' })));
  const crBilled = (c) => crBillsOf(c.id).reduce((s, b) => s + crBillValue(b), 0);
  const crPaid = (c) => creditorPaysOf(c.id).reduce((s, x) => s + x.p.amount, 0);
  const crOwed = (c) => crBilled(c) - crPaid(c);
  const crLedger = (id, from = '', to = '') => {
    const rows = crBillsOf(id).map((b) => ({ ts: stamp(b), kind: 'bill', b, debit: crBillValue(b), credit: 0 }))
      .concat(creditorPaysOf(id).map((x) => ({ ts: stamp(x.p), kind: 'pay', p: x.p, source: x.source, by: x.by, method: x.p.method, debit: 0, credit: x.p.amount })));
    rows.sort((a, b) => a.ts.localeCompare(b.ts) || (a.kind === 'bill' ? -1 : 1));
    let opening = 0;
    const inRange = [];
    rows.forEach((r) => {
      if (from && r.ts < from) opening += r.debit - r.credit;
      else if (!to || r.ts <= to) inRange.push(r);
    });
    let bal = opening;
    inRange.forEach((r) => { bal += r.debit - r.credit; r.balance = bal; });
    const sum = (k) => inRange.reduce((s, r) => s + r[k], 0);
    return { opening, rows: inRange, debit: sum('debit'), credit: sum('credit'), closing: bal };
  };
  return {
    db, cust, mat, salesMaterials,
    creditor, creditorName, crBillValue, crBillsOf, creditorPaysOf, crBilled, crPaid, crOwed, crLedger, rateFor, orderRate, matLabel,
    net, amount, extras, billTotal, partyLabel, paymentsFor, receiptsOf, paidOn, onCredit, loadsOf, billed, received, outstanding, lastReceipt, ledger,
    solRate, solAmount, solValue,
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
