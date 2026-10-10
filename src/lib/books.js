import { METHOD_LABEL, isPaidMethod } from './payments';

// Day book and period summaries, built from the records the other modules keep.
// Dates are 'YYYY-MM-DD'; a blank from / to is open-ended.

export const EXPENSE_HEADS = [
  'Diesel', 'Electricity (EB)', 'Vehicle repair', 'Machine spares', 'Loading labour', 'Salary', 'Salary advance',
  'Quarry royalty', 'Weighbridge AMC', 'Rent', 'Office & tea', 'Transport', 'Other',
];
export const INCOME_HEADS = ['Scrap sale', 'Insurance claim', 'Other income'];
export const BOOK_MODES = ['Cash', 'UPI', 'Account', 'Cheque'];

const inRange = (date, from, to) => (!from || date >= from) && (!to || date <= to);
// Cash goes to the cash box; UPI, bank and cheque go to the bank.
export const bucketOf = (mode) => (mode === 'Cash' ? 'cash' : 'bank');
export const modeName = (m) => METHOD_LABEL[m] || (m === 'Bank Transfer' ? 'Bank / Account' : m);
export const expenseHead = (x) => (x.head === 'Other' || x.head === 'Other income') && x.headOther ? x.headOther : x.head;

// Every movement of money into or out of the company, plus money a party sent straight to someone else.
function movements(d) {
  const D = d.db;
  const voidIds = new Set(D.orders.filter((o) => o.status === 'Void').map((o) => o.id));
  const ticketOf = (id) => D.orders.find((o) => o.id === id);
  const payer = (p) => (p.custId ? d.cust(p.custId).name : (p.walkIn || 'Walk-in') + ' (walk-in)');
  const flows = [];
  const direct = [];

  (D.payments || []).forEach((p) => {
    if (p.ticketId && voidIds.has(p.ticketId)) return;
    const t = p.ticketId ? ticketOf(p.ticketId) : null;
    const row = {
      date: p.date, time: p.time || '', who: payer(p), mode: p.method, amount: p.amount, ref: p.ref || '', remarks: p.remarks || '',
      what: t ? 'Load ' + t.ticket : 'Receipt on account', src: 'payments', rec: p,
    };
    if (!p.toType || p.toType === 'company') flows.push({ ...row, dir: 'in', kind: p.custId ? 'Credit party' : 'Walk-in' });
    else direct.push({ ...row, to: p.toType === 'supplier' ? d.supplier(p.supplierId).name + ' (soling)' : (p.toName || 'Someone else') });
  });

  // Older loads marked paid without payment records count as paid on the load's date.
  D.orders.forEach((o) => {
    if (o.status === 'Void' || d.paymentsFor(o.id).length || !isPaidMethod(o.method)) return;
    flows.push({ date: o.date, time: o.time || '', who: d.partyLabel(o), mode: o.method, amount: d.billTotal(o), ref: '', remarks: '', what: 'Load ' + o.ticket, dir: 'in', kind: o.custId ? 'Credit party' : 'Walk-in', src: 'orders', rec: o });
  });

  (D.supPayments || []).forEach((p) => {
    flows.push({ date: p.date, time: p.time || '', who: d.supplier(p.supplierId).name, mode: p.method, amount: p.amount, ref: p.ref || '', remarks: p.remarks || '', what: 'Paid to soling supplier', dir: 'out', kind: 'Soling supplier', src: 'supPayments', rec: p });
  });

  const worker = (id) => ((D.employees || []).find((e) => e.id === id) || { name: '—' }).name;
  (D.advances || []).forEach((a) => {
    flows.push({ date: a.date, time: a.time || '', who: worker(a.empId), mode: a.mode || 'Cash', amount: +a.amount || 0, ref: '', remarks: a.remarks || '', what: 'Advance to worker', dir: 'out', kind: 'Wages', src: 'advances', rec: a });
  });
  (D.payroll || []).forEach((p) => {
    if (!(+p.net > 0)) return;
    flows.push({ date: p.date, time: p.time || '', who: worker(p.empId), mode: p.mode || 'Cash', amount: +p.net, ref: '', remarks: p.remarks || '', what: 'Salary, week ending ' + p.weekEnd, dir: 'out', kind: 'Wages', src: 'payroll', rec: p });
  });

  (D.expenses || []).forEach((x) => {
    if (x.mode === 'Credit') return; // not paid yet
    const income = x.type === 'Credit';
    flows.push({
      date: x.date, time: x.time || '', who: x.party || '—', mode: x.mode === 'Bank Transfer' ? 'Account' : x.mode, amount: +x.amount || 0, ref: '', remarks: x.desc || '',
      what: expenseHead(x), dir: income ? 'in' : 'out', kind: income ? 'Other income' : 'Expense', src: 'expenses', rec: x,
    });
  });

  const order = (a, b) => (a.date + ' ' + a.time).localeCompare(b.date + ' ' + b.time);
  return { flows: flows.sort(order), direct: direct.sort(order) };
}

// Opening balances come from the starting cash / bank figures and everything since their date.
export function dayBook(d, from, to) {
  const st = d.db.settings || {};
  const start = st.startDate || '';
  const { flows, direct } = movements(d);
  const opening = { cash: +st.cashStart || 0, bank: +st.bankStart || 0 };
  const rows = [];
  flows.forEach((f) => {
    if (start && f.date < start) return;
    const signed = f.dir === 'in' ? f.amount : -f.amount;
    if (from && f.date < from) opening[bucketOf(f.mode)] += signed;
    else if (!to || f.date <= to) rows.push(f);
  });
  const totals = { cash: { in: 0, out: 0 }, bank: { in: 0, out: 0 } };
  rows.forEach((f) => { totals[bucketOf(f.mode)][f.dir] += f.amount; });
  const closing = { cash: opening.cash + totals.cash.in - totals.cash.out, bank: opening.bank + totals.bank.in - totals.bank.out };
  return { opening, rows, totals, closing, direct: direct.filter((x) => inRange(x.date, from, to)) };
}

export function salesSummary(d, from, to) {
  const loads = d.db.orders.filter((o) => o.status !== 'Void' && inRange(o.date, from, to));
  const byMat = {};
  const byParty = {};
  loads.forEach((o) => {
    const mk = o.matId === 'M10' && o.matName ? 'M10:' + o.matName : o.matId;
    const m = byMat[mk] || (byMat[mk] = { label: d.matLabel(o), loads: 0, tons: 0, value: 0 });
    m.loads += 1; m.tons += d.net(o); m.value += d.billTotal(o);
    const pk = o.custId || 'walk-in';
    const p = byParty[pk] || (byParty[pk] = { name: o.custId ? d.cust(o.custId).name : 'Walk-in customers', credit: !!o.custId, loads: 0, tons: 0, value: 0, paid: 0, onCredit: 0 });
    p.loads += 1; p.tons += d.net(o); p.value += d.billTotal(o); p.paid += d.paidOn(o); p.onCredit += d.onCredit(o);
  });
  const sum = (k) => loads.reduce((s, o) => s + k(o), 0);
  return {
    loads,
    byMat: Object.values(byMat).sort((a, b) => b.tons - a.tons),
    byParty: Object.values(byParty).sort((a, b) => b.value - a.value),
    tons: sum(d.net), value: sum(d.billTotal), onCredit: sum(d.onCredit),
  };
}

export function solingSummary(d, from, to) {
  const loads = (d.db.purchases || []).filter((u) => inRange(u.date, from, to));
  const bySup = {};
  loads.forEach((u) => {
    const g = bySup[u.supplierId] || (bySup[u.supplierId] = { name: d.supplier(u.supplierId).name, loads: 0, tons: 0, value: 0, paid: 0 });
    g.loads += 1; g.tons += d.net(u); g.value += d.solValue(u);
  });
  (d.db.suppliers || []).forEach((p) => {
    const paid = d.supplierPaysOf(p.id).filter((x) => inRange(x.p.date, from, to)).reduce((s, x) => s + x.p.amount, 0);
    if (!paid) return;
    (bySup[p.id] || (bySup[p.id] = { name: p.name, loads: 0, tons: 0, value: 0, paid: 0 })).paid += paid;
  });
  const list = Object.values(bySup).sort((a, b) => b.value - a.value);
  return { loads, bySup: list, tons: loads.reduce((s, u) => s + d.net(u), 0), value: loads.reduce((s, u) => s + d.solValue(u), 0), paid: list.reduce((s, g) => s + g.paid, 0) };
}

export function expenseSummary(d, from, to) {
  const list = (d.db.expenses || []).filter((x) => inRange(x.date, from, to)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const spent = list.filter((x) => x.type !== 'Credit');
  const income = list.filter((x) => x.type === 'Credit');
  const byHead = {};
  spent.forEach((x) => { const h = expenseHead(x); byHead[h] = (byHead[h] || 0) + (+x.amount || 0); });
  const total = (l) => l.reduce((s, x) => s + (+x.amount || 0), 0);
  return { list, spent, income, byHead: Object.entries(byHead).sort((a, b) => b[1] - a[1]), spentTotal: total(spent), incomeTotal: total(income) };
}

// Wages earned in salaries paid for weeks ending in the period (advances are recovered, so they are not a cost).
export function wagesSummary(d, from, to) {
  const list = (d.db.payroll || []).filter((p) => inRange(p.weekEnd, from, to));
  return { list, earned: list.reduce((s, p) => s + (+p.earned || 0), 0), paid: list.reduce((s, p) => s + (+p.net || 0), 0) };
}

// Rough profit for a period: sales billed − soling bought − wages − expenses + other income.
export function profitSummary(d, from, to) {
  const s = salesSummary(d, from, to);
  const so = solingSummary(d, from, to);
  const e = expenseSummary(d, from, to);
  const w = wagesSummary(d, from, to);
  return { sales: s.value, soling: so.value, wages: w.earned, expenses: e.spentTotal, income: e.incomeTotal, net: s.value - so.value - w.earned - e.spentTotal + e.incomeTotal };
}
