import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header';
import Modal, { Toast } from './components/Modal';
import Sidebar from './components/Sidebar';
import { IDLE_SCALE_KG, settings, TODAY } from './config';
import PaymentEditor from './components/PaymentEditor';
import { SEED_NEXT_TICKET, seedDb, upgradeDb } from './data/seed';
import { checkPay, defaultPay, emptyLine, fromRecords, isPaidMethod, METHOD_LABEL, paidToLabel, round2, toRecords } from './lib/payments';
import { matchMaterial, normalName, parseRegister } from './lib/register';
import RegisterImport, { rowBill, saleStatus, solingStatus } from './views/RegisterImport';
import { createDomain, OTHER_MATERIAL, periodLabel, planRate } from './lib/domain';
import { hhmm, isoDate, M, N, T } from './lib/format';
import { MODS, moduleConfig } from './lib/modules';
import { loadSaved, save as saveToBrowser } from './lib/storage';
import CreditParties from './views/CreditParties';
import Dashboard from './views/Dashboard';
import ListModule from './views/ListModule';
import Login from './views/Login';
import PartyDetail, { StandardRates } from './views/PartyDetail';
import Profile from './views/Profile';
import VoidedEntries from './views/VoidedEntries';
import Weighbridge from './views/Weighbridge';

const NUMERIC_FIELDS = ['rate', 'manualRate', 'amount', 'salary', 'tare', 'gross', 'days', 'ot', 'recovered', 'received', 'gst', 'rent'];
const FILTERS_CLEAR = { q: '', status: 'All', from: '', to: '', sortK: null };
const RECEIPT_METHODS = ['Cash', 'UPI', 'Account', 'Cheque'].map((x) => ({ v: x, l: METHOD_LABEL[x] || x }));
// Modules drawn by their own view instead of the generic list (their config still drives add/edit forms).
const CUSTOM_LISTS = ['customers', 'voids'];
const DETAIL_VIEWS = ['dashboard', 'weighbridge', 'party', 'stdrates', 'import'];
const SIGNED_IN_AS = 'A. Gopalakrishnan';

const isWide = () => window.innerWidth >= 900;
const nextCode = (list, prefix, width) => {
  const n = Math.max(0, ...list.map((x) => +String(x.code || '').replace(/\D/g, '') || 0)) + 1;
  return prefix + String(n).padStart(width, '0');
};

function initialState() {
  const saved = loadSaved();
  const db = saved ? upgradeDb(saved.db) : seedDb();
  return {
    mod: 'dashboard', dashTab: 'Overview', now: new Date(), partyId: null, partyTab: 'Rates',
    ...FILTERS_CLEAR, sortDir: 1,
    modal: null, form: {}, errors: {}, toast: null, wide: isWide(), payEdit: null,
    scale: IDLE_SCALE_KG, target: IDLE_SCALE_KG,
    wb: { vehicle: '', custId: db.customers[0] ? db.customers[0].id : '', matId: 'M06', outId: null, err: '' },
    seq: saved ? saved.seq : SEED_NEXT_TICKET,
    db,
  };
}

// Routes live under "#/…"; other hashes (e.g. the sign-in page's #help) are in-page anchors and keep the current view.
const routeOf = (hash) => (hash === '#/profile' ? 'profile' : hash === '#/login' ? 'login' : 'app');

function useHashRoute() {
  const [route, setRoute] = useState(() => routeOf(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      const h = window.location.hash;
      if (h && !h.startsWith('#/')) return;
      setRoute(routeOf(h));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const route = useHashRoute();
  const [s, setS] = useState(initialState);
  const set = useCallback((patch) => setS((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) })), []);
  const d = useMemo(() => createDomain(s.db), [s.db]);
  const toastTimer = useRef(null);

  // Live scale: eases toward the target weight with a little noise, like a load cell settling.
  useEffect(() => {
    if (route !== 'app' || !settings.liveScale) return undefined;
    const tick = setInterval(() => {
      setS((st) => {
        const noise = (Math.random() - 0.5) * 26;
        const next = st.scale + (st.target + noise - st.scale) * 0.32;
        return { ...st, scale: Math.max(0, Math.round(next)) };
      });
    }, 110);
    return () => clearInterval(tick);
  }, [route]);

  useEffect(() => {
    const clock = setInterval(() => set({ now: new Date() }), 1000);
    const onResize = () => set((st) => (isWide() === st.wide ? {} : { wide: isWide() }));
    window.addEventListener('resize', onResize);
    return () => { clearInterval(clock); window.removeEventListener('resize', onResize); clearTimeout(toastTimer.current); };
  }, [set]);

  // Keep every change in this browser (until a shared database is added).
  useEffect(() => {
    const t = setTimeout(() => saveToBrowser(s.db, s.seq), 250);
    return () => clearTimeout(t);
  }, [s.db, s.seq]);

  const toast = (msg) => {
    clearTimeout(toastTimer.current);
    set({ toast: msg });
    toastTimer.current = setTimeout(() => set({ toast: null }), 2800);
  };

  const go = (mod) => set({ mod, ...FILTERS_CLEAR, modal: null });
  const setWb = (patch) => set((st) => ({ wb: { ...st.wb, ...patch } }));
  const closeModal = () => set({ modal: null, errors: {} });

  // ---- weighbridge ----
  const captureTare = () => {
    const wb = s.wb;
    const vehicle = wb.vehicle.trim();
    if (!vehicle) return setWb({ err: 'Enter the vehicle number before capturing tare.' });
    if (s.db.onsite.some((v) => v.vehicle.toLowerCase() === vehicle.toLowerCase())) return setWb({ err: 'That vehicle is already on site awaiting weigh-out.' });
    if (!wb.custId) return setWb({ err: 'Choose the credit party first.' });
    const ticket = 'WB-' + s.seq;
    const row = {
      id: 'S' + Date.now(), ticket, vehicle: vehicle.toUpperCase(), custId: wb.custId, matId: wb.matId, tare: s.scale,
      load: 15000 + Math.round(Math.random() * 5000), inAt: hhmm(),
    };
    set((st) => ({ seq: st.seq + 1, db: { ...st.db, onsite: st.db.onsite.concat([row]) }, wb: { ...st.wb, vehicle: '', err: '' } }));
    toast(ticket + ' opened — tare ' + N(row.tare) + ' kg captured for ' + row.vehicle + '.');
    return undefined;
  };

  const weighOut = (id) => {
    const v = s.db.onsite.find((x) => x.id === id);
    set((st) => ({ wb: { ...st.wb, outId: id }, target: v.tare + v.load }));
  };
  const cancelOut = () => set((st) => ({ wb: { ...st.wb, outId: null }, target: IDLE_SCALE_KG }));

  const ticketFromOnsite = (v, patch) => ({
    id: 'O' + Date.now(), ticket: v.ticket, date: isoDate(), time: hhmm(), custId: v.custId, matId: v.matId, matName: '', vehicle: v.vehicle, dir: 'OUT',
    tare: v.tare, manualRate: '', method: 'Credit', roundOff: 0, payRemarks: '', remarks: '', by: 'Murugan R', ...patch,
  });

  // Weigh-out takes the live reading as gross, then asks how the load was paid before the ticket is saved.
  const confirmOut = () => {
    const v = s.db.onsite.find((x) => x.id === s.wb.outId);
    if (!v) return;
    const o = ticketFromOnsite(v, { gross: s.scale, status: 'Completed', reason: '' });
    openPay({
      source: 'weighbridge', ticket: o, onsiteId: v.id, bill: d.billTotal(o), walkIn: false,
      title: v.ticket + ' — ' + d.cust(v.custId).name, initial: defaultPay(d.billTotal(o), { walkIn: false, cashSerial: false }),
    });
  };

  const askVoid = () => {
    const v = s.db.onsite.find((x) => x.id === s.wb.outId);
    if (!v) return;
    set({
      modal: {
        kind: 'void', id: v.id, title: 'Void ' + v.ticket + '?', kicker: 'Confirm', confirmLabel: 'Void the load',
        message: 'The load will be filed under Void Orders against ' + d.cust(v.custId).name + ' and nothing is billed. This cannot be undone from the station.',
      },
    });
  };

  const doVoid = () => {
    const v = s.db.onsite.find((x) => x.id === s.modal.id);
    if (!v) return;
    const o = ticketFromOnsite(v, { gross: v.tare, status: 'Void', reason: 'Voided at weigh-out' });
    set((st) => ({
      db: { ...st.db, orders: [o].concat(st.db.orders), onsite: st.db.onsite.filter((x) => x.id !== v.id) },
      wb: { ...st.wb, outId: null }, modal: null, target: IDLE_SCALE_KG,
    }));
    toast(v.ticket + ' voided.');
  };

  // ---- payments ----
  // payEdit = { source: 'weighbridge' | 'ticket' | 'staging', title, sub, bill, walkIn, initial, ...source details }
  const openPay = (p) => set({
    payEdit: { sub: 'Net ' + T(d.net(p.ticket || { gross: 0, tare: 0 })) + ' t · bill ' + M(p.bill), ...p },
  });

  const methodOf = (pay) => (pay.mode === 'Account' ? 'Account' : pay.mode);

  const openTicketPay = (o) => {
    const recs = d.paymentsFor(o.id);
    const legacyPaid = !recs.length && isPaidMethod(o.method);
    const bill = d.billTotal(o);
    const method = o.method === 'Bank Transfer' ? 'Account' : o.method;
    openPay({
      source: 'ticket', ticket: o, bill, walkIn: !o.custId,
      title: o.ticket + ' — ' + d.partyLabel(o),
      initial: legacyPaid ? { mode: method, lines: [emptyLine(method, round2(bill))], roundOff: '', remarks: o.payRemarks || '' } : fromRecords(o, recs),
    });
  };

  const savePay = (pay, result) => {
    const pe = s.payEdit;
    if (pe.source === 'staging') {
      set((st) => ({ db: { ...st.db, staging: st.db.staging.map((r) => (r.key === pe.key ? { ...r, pay } : r)) }, payEdit: null }));
      return;
    }
    const ticket = { ...pe.ticket, method: methodOf(pay), roundOff: result.roundOff, payRemarks: String(pay.remarks || '').trim() };
    const recs = toRecords(pay, ticket, SIGNED_IN_AS);
    set((st) => {
      const others = st.db.payments.filter((p) => p.ticketId !== ticket.id);
      const exists = st.db.orders.some((o) => o.id === ticket.id);
      return {
        db: {
          ...st.db,
          orders: exists ? st.db.orders.map((o) => (o.id === ticket.id ? ticket : o)) : [ticket].concat(st.db.orders),
          payments: others.concat(recs),
          onsite: pe.onsiteId ? st.db.onsite.filter((x) => x.id !== pe.onsiteId) : st.db.onsite,
        },
        payEdit: null,
        ...(pe.source === 'weighbridge' ? { wb: { ...st.wb, outId: null }, target: IDLE_SCALE_KG } : {}),
      };
    });
    const note = result.credit > 0 ? M(result.credit) + ' on credit' : 'fully paid';
    toast(ticket.ticket + ' saved — ' + M(pe.bill) + ', ' + (result.paid ? M(result.paid) + ' paid, ' : '') + note + '.');
  };

  // ---- register import ----
  const matchParty = (name) => {
    const n = normalName(name);
    return n ? s.db.customers.find((c) => normalName(c.name) === n) : null;
  };
  const matchSupplier = (name) => {
    const n = normalName(name);
    return n ? s.db.suppliers.find((p) => normalName(p.name) === n) : null;
  };
  const alreadyIn = (row) => s.db.orders.some((o) => (o.serial || o.ticket) === row.serial && o.date === row.date)
    || s.db.purchases.some((p) => p.serial === row.serial && p.date === row.date);

  const stageRow = (row, batchId) => {
    const m = matchMaterial(row.material);
    const key = row.date + '|' + row.serial;
    const cashSerial = /^CA/i.test(row.serial);
    if (m.kind === 'soling') {
      const p = matchSupplier(row.name);
      return { ...row, key, batchId, kind: 'soling', matId: m.matId, supplierId: p ? p.id : '', dup: alreadyIn(row) };
    }
    const party = matchParty(row.name);
    const staged = {
      ...row, key, batchId, kind: 'sale', matId: m.matId, matName: m.matName,
      custId: party ? party.id : '', walkIn: !party && cashSerial ? row.name : '', dup: alreadyIn(row),
    };
    const { bill } = rowBill(d, staged);
    staged.pay = defaultPay(bill, { walkIn: !staged.custId && !!staged.walkIn, cashSerial });
    return staged;
  };

  const importFile = async (file) => {
    try {
      const parsed = await parseRegister(await file.arrayBuffer());
      const batch = { id: 'B' + Date.now(), file: file.name, at: isoDate() + 'T' + hhmm(), from: parsed.from, to: parsed.to, rows: parsed.rows.length };
      const existing = new Set(s.db.staging.map((r) => r.key));
      const rows = parsed.rows.map((r) => stageRow(r, batch.id));
      // Rows already in the books or already waiting here are left out and only counted.
      const fresh = rows.filter((r) => !r.dup && !existing.has(r.key));
      set((st) => ({ db: { ...st.db, staging: st.db.staging.concat(fresh), imports: [batch].concat(st.db.imports) } }));
      const sales = fresh.filter((r) => r.kind === 'sale').length;
      const skipped = rows.length - fresh.length;
      toast(file.name + ': ' + rows.length + ' rows — ' + (fresh.length
        ? sales + ' sales and ' + (fresh.length - sales) + ' soling loads to check' + (skipped ? ', ' + skipped + ' already imported or pending' : '')
        : 'all of them were already imported or are pending') + '.');
    } catch (err) {
      toast('Could not read ' + file.name + ': ' + err.message);
    }
  };

  const patchStaged = (key, patch) => set((st) => ({ db: { ...st.db, staging: st.db.staging.map((r) => (r.key === key ? { ...r, ...patch } : r)) } }));

  const choosePartyForRow = (key, v) => {
    const row = s.db.staging.find((r) => r.key === key);
    const cashSerial = /^CA/i.test(row.serial);
    if (v === '__new') {
      const exists = matchParty(row.name);
      const cust = exists || { id: 'N' + Date.now(), code: nextCode(s.db.customers, 'CP-', 3), name: row.name.trim(), owner: '', address: '', contact: '', gst: '', status: 'Active', remarks: 'Added from register import', received: 0, last: '—' };
      const next = { ...row, custId: cust.id, walkIn: '' };
      set((st) => ({
        db: {
          ...st.db,
          customers: exists ? st.db.customers : [cust].concat(st.db.customers),
          staging: st.db.staging.map((r) => (r.key === key ? { ...next, pay: defaultPay(rowBill(d, next).bill, { walkIn: false, cashSerial }) } : r)),
        },
      }));
      toast(cust.name + (exists ? ' is already a credit party — linked.' : ' added as a credit party. Add owner, contact and address on Credit Parties.'));
      return;
    }
    const next = v === '__walkin' ? { ...row, custId: '', walkIn: row.name } : { ...row, custId: v, walkIn: '' };
    patchStaged(key, { custId: next.custId, walkIn: next.walkIn, pay: defaultPay(rowBill(d, next).bill, { walkIn: !next.custId, cashSerial }) });
  };

  const chooseSupplierForRow = (key, v) => {
    const row = s.db.staging.find((r) => r.key === key);
    if (v === '__new') {
      const exists = matchSupplier(row.name);
      const sup = exists || { id: 'N' + Date.now(), code: nextCode(s.db.suppliers, 'SP-', 2), name: row.name.trim(), owner: '', address: '', contact: '', upi: '', linkedCustId: '', status: 'Active', remarks: 'Added from register import' };
      set((st) => ({
        db: { ...st.db, suppliers: exists ? st.db.suppliers : [sup].concat(st.db.suppliers), staging: st.db.staging.map((r) => (r.key === key ? { ...r, supplierId: sup.id } : r)) },
      }));
      toast(sup.name + (exists ? ' is already a soling supplier — linked.' : ' added as a soling supplier.'));
      return;
    }
    patchStaged(key, { supplierId: v });
  };

  const editStagedPay = (key) => {
    const row = s.db.staging.find((r) => r.key === key);
    const { bill } = rowBill(d, row);
    openPay({
      source: 'staging', key, bill, walkIn: !row.custId,
      ticket: { gross: row.net, tare: 0 },
      title: row.serial + ' — ' + (row.custId ? d.cust(row.custId).name : row.walkIn + ' (walk-in)'),
      initial: row.pay || defaultPay(bill, { walkIn: !row.custId, cashSerial: /^CA/i.test(row.serial) }),
    });
  };

  const postSales = () => {
    const ready = s.db.staging.filter((r) => r.kind === 'sale' && saleStatus(d, r).ready);
    if (!ready.length) return;
    const orders = [];
    const payments = [];
    let credit = 0;
    let paid = 0;
    ready.forEach((r, i) => {
      const b = rowBill(d, r);
      const tons = r.net / 1000;
      // The register amount is what was billed: when it differs from the rate card, keep it as a manual rate per ton.
      const manualRate = r.amount > 0 && (b.mismatch || !b.card.rate) ? round2(r.amount / tons) : '';
      const result = checkPay(r.pay, b.bill, { walkIn: !r.custId });
      const o = {
        id: 'O' + Date.now() + '-' + i, ticket: r.serial, serial: r.serial, date: r.date, time: r.time, custId: r.custId, walkIn: r.custId ? '' : r.walkIn,
        matId: r.matId, matName: r.matName, vehicle: r.vehicle, dir: 'OUT', tare: r.gross - r.net, gross: r.gross, manualRate,
        method: methodOf(r.pay), roundOff: result.roundOff, payRemarks: String(r.pay.remarks || '').trim(), regAmount: r.amount, batchId: r.batchId,
        status: 'Completed', reason: '', remarks: '', by: SIGNED_IN_AS,
      };
      orders.push(o);
      payments.push(...toRecords(r.pay, o, SIGNED_IN_AS).map((p, j) => ({ ...p, id: p.id + '-' + i + '-' + j })));
      credit += result.credit;
      paid += result.paid;
    });
    const keys = new Set(ready.map((r) => r.key));
    set((st) => ({
      db: { ...st.db, orders: orders.concat(st.db.orders), payments: st.db.payments.concat(payments), staging: st.db.staging.filter((r) => !keys.has(r.key)) },
    }));
    toast(ready.length + ' sale(s) posted — ' + M(paid) + ' collected, ' + M(credit) + ' on credit.');
  };

  const postSoling = () => {
    const ready = s.db.staging.filter((r) => r.kind === 'soling' && solingStatus(r).ready);
    if (!ready.length) return;
    const recs = ready.map((r, i) => ({
      id: 'U' + Date.now() + '-' + i, serial: r.serial, date: r.date, time: r.time, supplierId: r.supplierId, regName: r.name,
      vehicle: r.vehicle, tare: r.tare, gross: r.gross, net: r.net, amount: r.amount, batchId: r.batchId, remarks: '',
    }));
    const keys = new Set(ready.map((r) => r.key));
    set((st) => ({ db: { ...st.db, purchases: recs.concat(st.db.purchases), staging: st.db.staging.filter((r) => !keys.has(r.key)) } }));
    toast(ready.length + ' soling load(s) saved for the soling ledger.');
  };

  const removeStaged = (key) => {
    const row = s.db.staging.find((r) => r.key === key);
    askDelete({ ...row, id: row.key }, 'staging');
  };
  const clearStaged = () => set({
    modal: { kind: 'clearStaging', title: 'Void all pending rows?', kicker: 'Register import', confirmLabel: 'Void all', message: 'Rows not yet posted go to Voided entries, where they can be restored.' },
  });

  // ---- list modules ----
  const cfgOf = (mod) => (mod && !DETAIL_VIEWS.includes(mod) ? moduleConfig(mod, d) : null);
  const cfg = cfgOf(s.mod);
  const party = s.mod === 'party' ? s.db.customers.find((c) => c.id === s.partyId) : null;

  const openParty = (id) => set({ mod: 'party', partyId: id, partyTab: 'Loads taken', modal: null });

  // Receipt on a party's account: how it was paid and who received the money (company, a soling supplier, or someone else).
  const openReceipt = (c) => set({
    modal: { kind: 'receipt', id: c.id, title: 'Record payment — ' + c.name, kicker: 'Payment received', confirmLabel: 'Save payment' },
    form: { amount: '', method: 'Cash', to: 'company', toName: '', date: isoDate(), time: hhmm(), ref: '', remarks: '' }, errors: {},
  });

  // ---- voided entries: nothing is deleted outright ----
  const KIND_NAME = {
    orders: 'Load', payments: 'Payment', customers: 'Credit party', suppliers: 'Soling supplier', materials: 'Material', rates: 'Rate period',
    staging: 'Import row', expenses: 'Expense', employees: 'Employee', attendance: 'Attendance entry', advances: 'Advance', payroll: 'Payroll line',
  };
  const voidEntryFor = (key, row) => {
    const D = s.db;
    if (key === 'orders') {
      return { kind: 'Load', label: row.ticket + ' · ' + d.partyLabel(row) + ' · ' + d.matLabel(row) + ' · ' + T(d.net(row)) + ' t', amount: d.billTotal(row), records: { orders: [row], payments: d.paymentsFor(row.id) } };
    }
    if (key === 'customers') {
      const ids = new Set(D.orders.filter((o) => o.custId === row.id).map((o) => o.id));
      return {
        kind: 'Credit party', label: row.name + ' (' + row.code + ') with ' + ids.size + ' load(s)', amount: d.outstanding(row),
        records: { customers: [row], orders: D.orders.filter((o) => ids.has(o.id)), payments: D.payments.filter((p) => ids.has(p.ticketId) || (!p.ticketId && p.custId === row.id)), rates: D.rates.filter((r) => r.custId === row.id) },
      };
    }
    if (key === 'materials') return { kind: 'Material', label: row.name, records: { materials: [row], rates: D.rates.filter((r) => r.matId === row.id) } };
    if (key === 'payments') return { kind: row.ticketId ? 'Payment' : 'Receipt', label: d.cust(row.custId).name + ' · ' + METHOD_LABEL[row.method] + ' · ' + row.date, amount: row.amount, records: { payments: [row] } };
    if (key === 'rates') return { kind: 'Rate period', label: rateTarget(row.custId) + ' · ' + d.mat(row.matId).name + ' · ' + M(row.rate) + '/t · ' + periodLabel(row), records: { rates: [row] } };
    if (key === 'staging') return { kind: 'Import row', label: row.serial + ' · ' + row.name + ' · ' + row.material + ' · ' + row.date, amount: row.amount, records: { staging: [row] } };
    return { kind: KIND_NAME[key] || 'Record', label: row.name || row.ticket || row.head || row.code || row.id, amount: row.amount || null, records: { [key]: [row] } };
  };

  const askDelete = (row, key = cfg && cfg.key) => {
    const entry = voidEntryFor(key, row);
    set({
      modal: { kind: 'delete', key, row, title: 'Delete ' + entry.kind.toLowerCase() + '?', kicker: entry.label, confirmLabel: 'Move to voided entries' },
      form: { reason: '' },
      errors: {},
    });
  };

  const doDelete = () => {
    const { key, row } = s.modal;
    const entry = { id: 'X' + Date.now(), at: isoDate() + 'T' + hhmm(), by: SIGNED_IN_AS, reason: String(s.form.reason || '').trim(), ...voidEntryFor(key, row) };
    const drop = (list, items, idKey) => list.filter((x) => !items.some((y) => y[idKey] === x[idKey]));
    set((st) => {
      const db = { ...st.db, voided: [entry].concat(st.db.voided || []) };
      Object.entries(entry.records).forEach(([k, items]) => { db[k] = drop(st.db[k] || [], items, k === 'staging' ? 'key' : 'id'); });
      if (key === 'customers') db.suppliers = st.db.suppliers.map((p) => (p.linkedCustId === row.id ? { ...p, linkedCustId: '' } : p));
      return { db, modal: null, ...(key === 'customers' && st.mod === 'party' ? { mod: 'customers' } : {}) };
    });
    toast(entry.kind + ' moved to Voided entries.');
  };

  const restoreEntry = (entry) => {
    set((st) => {
      const db = { ...st.db, voided: (st.db.voided || []).filter((e) => e.id !== entry.id) };
      Object.entries(entry.records).forEach(([k, items]) => {
        const idKey = k === 'staging' ? 'key' : 'id';
        const have = new Set((st.db[k] || []).map((x) => x[idKey]));
        db[k] = items.filter((x) => !have.has(x[idKey])).concat(st.db[k] || []);
      });
      return { db };
    });
    toast(entry.kind + ' restored.');
  };

  // ---- PDF reports ----
  const openReport = (custId, type, range = {}) => set({
    modal: { kind: 'report', custId, title: custId ? 'Generate report — ' + d.cust(custId).name : 'All credit parties report', kicker: 'PDF report', confirmLabel: 'Download PDF' },
    form: { type: type || 'statement', copy: 'party', fromDate: range.fromDate || '', fromTime: range.fromTime || '', toDate: range.toDate || '', toTime: range.toTime || '' },
    errors: {},
  });

  const makeReport = async () => {
    const f = s.form;
    const from = f.fromDate ? f.fromDate + ' ' + (f.fromTime || '00:00') : '';
    const to = f.toDate ? f.toDate + ' ' + (f.toTime || '23:59') : '';
    if (from && to && to < from) { set({ errors: { toDate: 'The end is before the start.' } }); return; }
    const { partyReport, allPartiesReport } = await import('./lib/report');
    if (s.modal.custId) await partyReport({ d, party: d.cust(s.modal.custId), type: f.type, from, to, copy: f.copy });
    else await allPartiesReport({ d, from, to });
    set({ modal: null });
    toast('Report downloaded.');
  };

  const openAdd = () => {
    if (!cfg) return;
    if (s.mod === 'payments') { openReceipt(s.db.customers[0]); return; }
    const f = {};
    cfg.fields.forEach((x) => {
      f[x.k] = x.type === 'select' ? (x.options[0] ? x.options[0].v : '') : x.type === 'date' ? isoDate() : '';
    });
    set({ modal: { kind: 'form', cfgMod: s.mod, title: cfg.add, kicker: 'Create', confirmLabel: 'Save' }, form: f, errors: {} });
  };

  const openEdit = (row, mod = s.mod) => {
    const c = cfgOf(mod);
    const f = {};
    c.fields.forEach((x) => { f[x.k] = row[x.k] == null ? '' : row[x.k]; });
    set({ modal: { kind: 'form', cfgMod: mod, id: row.id, title: 'Edit ' + (row.name || row.ticket || 'record'), kicker: 'Update', confirmLabel: 'Save changes' }, form: f, errors: {} });
  };

  // ---- rate periods (₹ per ton) ----
  const rateTarget = (custId) => (custId ? d.cust(custId).name : 'standard rate');

  const openRate = (custId, matId) => {
    const first = d.salesMaterials().find((m) => m.id !== OTHER_MATERIAL);
    set({
      modal: { kind: 'rate', custId, title: 'New rate period — ' + rateTarget(custId), kicker: 'Rate per ton', confirmLabel: 'Save rate' },
      form: { matId: matId || (first ? first.id : ''), rate: '', from: isoDate(), to: '', remarks: '' },
      errors: {},
    });
  };

  const saveRate = () => {
    const m = s.modal;
    const f = s.form;
    const rec = { custId: m.custId, matId: f.matId, rate: +f.rate, from: f.from, to: f.to || '', remarks: String(f.remarks || '').trim() };
    const plan = planRate(s.db.rates, rec);
    if (plan.errors) { set({ errors: plan.errors }); return; }
    const card = { id: 'R' + Date.now(), ...rec, by: SIGNED_IN_AS };
    set((st) => ({
      db: {
        ...st.db,
        rates: st.db.rates.map((r) => {
          const c = plan.closes.find((x) => x.id === r.id);
          return c ? { ...r, to: c.to } : r;
        }).concat([card]),
      },
      modal: null,
    }));
    const closed = plan.closes.map((c) => ' The earlier ' + M(c.was.rate) + '/t period now ends ' + c.to + '.').join('');
    toast(d.mat(rec.matId).name + ' at ' + M(rec.rate) + '/t from ' + rec.from + ' saved ' + (m.custId ? 'for ' + rateTarget(m.custId) : 'as the standard rate') + '.' + closed);
  };

  const askEndRate = (card) => set({
    modal: {
      kind: 'endRate', id: card.id, title: 'End ' + d.mat(card.matId).name + ' at ' + M(card.rate) + '/t?', kicker: rateTarget(card.custId), confirmLabel: 'End rate',
    },
    form: { to: isoDate() < card.from ? card.from : isoDate() },
    errors: {},
  });

  const endRate = () => {
    const card = s.db.rates.find((r) => r.id === s.modal.id);
    const to = s.form.to;
    if (!to) { set({ errors: { to: 'Required.' } }); return; }
    if (to < card.from) { set({ errors: { to: 'The rate starts on ' + card.from + '; pick that day or later.' } }); return; }
    set((st) => ({ db: { ...st.db, rates: st.db.rates.map((r) => (r.id === card.id ? { ...r, to } : r)) }, modal: null }));
    toast(d.mat(card.matId).name + ' at ' + M(card.rate) + '/t now ends ' + to + '.');
  };

  const onRowAction = (kind, row) => {
    if (kind === 'party') openParty(row.id);
    else if (kind === 'stdrates') set({ mod: 'stdrates', modal: null });
    else if (kind === 'receipt') openReceipt(row);
    else if (kind === 'reinstate') reinstate(row);
    else if (kind === 'pay') openTicketPay(row);
  };

  const postReceipt = () => {
    const m = s.modal;
    const f = s.form;
    const amt = round2(f.amount);
    const c = d.cust(m.id);
    const errs = {};
    if (!(amt > 0)) errs.amount = 'Enter an amount greater than zero.';
    else if (amt > round2(d.outstanding(c)) + 0.005) errs.amount = 'More than the outstanding ' + M(d.outstanding(c)) + '.';
    if (!f.to) errs.to = 'Choose who received the money.';
    if (f.to === 'other' && !String(f.toName || '').trim()) errs.toName = 'Type who received it.';
    if (!f.date) errs.date = 'Required.';
    if (Object.keys(errs).length) { set({ errors: errs }); return; }
    const toSupplier = f.to.startsWith('S:');
    const rec = {
      id: 'YR' + Date.now(), date: f.date, time: f.time || hhmm(), ticketId: '', custId: c.id, walkIn: '',
      method: f.method, amount: amt, toType: toSupplier ? 'supplier' : f.to, supplierId: toSupplier ? f.to.slice(2) : '',
      toName: f.to === 'other' ? String(f.toName).trim() : '', ref: String(f.ref || '').trim(), remarks: String(f.remarks || '').trim(), by: SIGNED_IN_AS,
    };
    set((st) => ({ db: { ...st.db, payments: st.db.payments.concat([rec]) }, modal: null }));
    toast(M(amt) + ' received from ' + c.name + ' by ' + METHOD_LABEL[f.method] + ' → ' + paidToLabel(rec, (id) => d.supplier(id).name) + '.');
  };

  const save = () => {
    const f = s.form;
    const m = s.modal;
    const c = cfgOf(m.cfgMod);
    const errs = {};
    c.fields.forEach((x) => { if (x.req && String(f[x.k] ?? '').trim() === '') errs[x.k] = 'Required.'; });
    Object.entries(c.validate ? c.validate(f, m.id) : {}).forEach(([k, v]) => { if (v && !errs[k]) errs[k] = v; });
    if (Object.keys(errs).length) { set({ errors: errs }); return; }
    const rec = { ...f };
    Object.keys(rec).forEach((k) => { if (typeof rec[k] === 'string') rec[k] = rec[k].trim(); });
    NUMERIC_FIELDS.forEach((k) => { if (rec[k] !== undefined && rec[k] !== '') rec[k] = +rec[k]; });
    // A new manual order is saved on credit, then the payment dialog opens so staff record how it was paid.
    const newOrder = c.key === 'orders' && !m.id
      ? { id: 'N' + Date.now(), ticket: 'WB-' + s.seq, dir: 'OUT', time: hhmm(), by: SIGNED_IN_AS, method: 'Credit', roundOff: 0, payRemarks: '', walkIn: '', ...rec }
      : null;
    const editedOrder = c.key === 'orders' && m.id ? { ...s.db.orders.find((o) => o.id === m.id), ...rec } : null;
    set((st) => {
      const list = st.db[c.key] || [];
      if (m.id) return { db: { ...st.db, [c.key]: list.map((r) => (r.id === m.id ? { ...r, ...rec } : r)) }, modal: null };
      if (newOrder) return { db: { ...st.db, orders: [newOrder].concat(list) }, modal: null, seq: st.seq + 1 };
      const extra = c.key === 'customers' ? { code: nextCode(list, 'CP-', 3), received: 0, last: '—' }
        : c.key === 'suppliers' ? { code: nextCode(list, 'SP-', 2) }
          : c.key === 'materials' ? { code: 'MT-' + String(list.length + 1).padStart(2, '0'), unit: 'Ton' }
            : c.key === 'employees' ? { code: 'EM-' + String(list.length + 1).padStart(2, '0') } : {};
      return { db: { ...st.db, [c.key]: [{ id: 'N' + Date.now(), ...extra, ...rec }].concat(list) }, modal: null };
    });
    if (newOrder && newOrder.status !== 'Void') {
      const bill = d.billTotal(newOrder);
      openPay({ source: 'ticket', ticket: newOrder, bill, walkIn: false, title: newOrder.ticket + ' — ' + d.cust(newOrder.custId).name, initial: defaultPay(bill, { walkIn: false, cashSerial: false }) });
      return;
    }
    // Editing a load goes straight on to its payment, since GST, rent or the rate may have changed the bill.
    if (editedOrder && editedOrder.status !== 'Void') {
      openTicketPay(editedOrder);
      return;
    }
    toast(m.id ? (rec.name || rec.ticket || 'Record') + ' updated.' : (rec.name || (newOrder && newOrder.ticket) || 'Record') + ' created.');
  };

  const reinstate = (o) => {
    set((st) => ({ db: { ...st.db, orders: st.db.orders.map((x) => (x.id === o.id ? { ...x, status: 'Completed', reason: '' } : x)) } }));
    toast(o.ticket + ' reinstated as Completed.');
  };

  // ---- modal wiring ----
  let modalProps = null;
  if (s.modal) {
    const m = s.modal;
    const formCfg = m.kind === 'form' ? cfgOf(m.cfgMod) : null;
    const rateMats = d.salesMaterials().filter((x) => x.id !== OTHER_MATERIAL).map((x) => ({ v: x.id, l: x.name }));
    const rateHint = () => {
      if (!s.form.matId || !s.form.from) return null;
      const now = d.rateFor(m.custId, s.form.matId, s.form.from);
      return now.rate ? 'On ' + s.form.from + ' the rate is ' + M(now.rate) + '/t (' + now.src + ')' : 'No rate is set for ' + s.form.from + ' yet';
    };
    const toOptions = [{ v: 'company', l: 'Company account' }]
      .concat(s.db.suppliers.filter((p) => p.status !== 'Inactive').map((p) => ({ v: 'S:' + p.id, l: p.name + ' (soling supplier)' })))
      .concat([{ v: 'other', l: 'Someone else…' }]);
    const range = (from) => [
      { k: from ? 'fromDate' : 'toDate', label: from ? 'From date' : 'To date', type: 'date', hint: from ? 'Blank = from the first entry' : 'Blank = up to now' },
      { k: from ? 'fromTime' : 'toTime', label: from ? 'From time' : 'To time', type: 'time' },
    ];
    const fields = formCfg ? formCfg.fields
      : m.kind === 'receipt' ? [
        { k: 'amount', label: 'Amount received (₹)', type: 'number', hint: 'Outstanding ' + M(d.outstanding(d.cust(m.id))) },
        { k: 'method', label: 'Method', type: 'select', options: RECEIPT_METHODS },
        { k: 'to', label: 'Paid to', type: 'select', options: toOptions, hint: 'Who received the money — shown only on company copies' },
        ...(s.form.to === 'other' ? [{ k: 'toName', label: 'Received by', placeholder: 'Name of the person' }] : []),
        { k: 'date', label: 'Date', type: 'date' },
        { k: 'time', label: 'Time', type: 'time' },
        { k: 'ref', label: 'Reference / UTR / cheque no.' },
        { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
      ]
        : m.kind === 'delete' ? [{ k: 'reason', label: 'Reason', span: 'span 2', hint: 'Optional — it moves to Voided entries and can be restored from there' }]
          : m.kind === 'report' ? [
            ...(m.custId ? [{ k: 'type', label: 'Report', type: 'select', options: [{ v: 'statement', l: 'Account statement (loads + payments)' }, { v: 'loads', l: 'Loads taken' }, { v: 'payments', l: 'Payment history' }] }] : []),
            ...(m.custId ? [{ k: 'copy', label: 'Copy for', type: 'select', options: [{ v: 'party', l: 'The party (hides who received payments)' }, { v: 'company', l: 'Company (shows who received payments)' }] }] : []),
            ...range(true), ...range(false),
          ]
        : m.kind === 'rate' ? [
          { k: 'matId', label: 'Material', type: 'select', options: rateMats },
          { k: 'rate', label: 'Rate (₹ per ton)', type: 'number', placeholder: '800', hint: rateHint() },
          { k: 'from', label: 'Effective from', type: 'date' },
          { k: 'to', label: 'Until (optional)', type: 'date', hint: 'Leave blank if this rate carries on' },
          { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional — e.g. agreed on phone, revised for monsoon' },
        ]
          : m.kind === 'endRate' ? [{ k: 'to', label: 'Last day at this rate', type: 'date', hint: 'Tickets after this day use the next period or the standard rate' }]
            : [];
    modalProps = {
      modal: m,
      fields,
      form: s.form,
      errors: s.errors,
      setField: (k, v) => set((st) => ({ form: { ...st.form, [k]: v }, errors: { ...st.errors, [k]: null } })),
      calcLines: formCfg && formCfg.calc ? formCfg.calc(s.form) : null,
      onConfirm: {
        delete: doDelete, void: doVoid, receipt: postReceipt, rate: saveRate, endRate, report: makeReport,
        clearStaging: () => {
          const rows = s.db.staging;
          const entry = { id: 'X' + Date.now(), at: isoDate() + 'T' + hhmm(), by: SIGNED_IN_AS, reason: 'Cleared all pending import rows', kind: 'Import rows', label: rows.length + ' pending row(s)', amount: null, records: { staging: rows } };
          set((st) => ({ db: { ...st.db, staging: [], voided: [entry].concat(st.db.voided || []) }, modal: null }));
          toast('Pending rows moved to Voided entries.');
        },
      }[m.kind] || save,
      onClose: closeModal,
    };
  }

  if (route === 'profile') return <Profile onSignOut={() => { window.location.hash = '#/login'; }} />;
  if (route === 'login') return <Login onEnter={() => go('dashboard')} />;

  const meta = party
    ? { ...MODS.party, title: party.name, sub: [party.owner && 'Owner ' + party.owner, party.contact, party.address].filter(Boolean).join(' · ') || 'Credit party — add owner, contact and address with Edit details.' }
    : MODS[s.mod] || MODS.dashboard;
  const atStation = ['weighbridge', 'dashboard', 'import', 'voids'].includes(s.mod);
  const onRates = s.mod === 'party' || s.mod === 'stdrates';
  const filters = { q: s.q, status: s.status, from: s.from, to: s.to, sortK: s.sortK, sortDir: s.sortDir };
  const tonsToday = s.db.orders.filter((o) => o.status !== 'Void' && o.date === TODAY).reduce((a, o) => a + d.net(o), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: 14, letterSpacing: '-0.011em' }}>
      <div style={s.wide ? { display: 'flex', alignItems: 'stretch', minHeight: '100vh' } : { display: 'block' }}>
        <Sidebar wide={s.wide} mod={(MODS[s.mod] && MODS[s.mod].navAs) || s.mod} onsiteCount={s.db.onsite.length} go={go} />

        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', containerType: 'inline-size', containerName: 'shell' }}>
          <Header
            meta={meta}
            scaleKg={N(s.scale)}
            onsite={String(s.db.onsite.length)}
            tons={T(tonsToday) + ' t'}
            now={s.now}
            onWeighbridge={() => go('weighbridge')}
            quickLabel={atStation ? 'Order book' : onRates ? 'Add rate period' : s.mod === 'customers' ? 'New credit party' : 'New entry'}
            onQuick={atStation ? () => go('orders') : onRates ? () => openRate(party ? party.id : '', '') : openAdd}
          />
          <main
            className="ag-main"
            style={{ padding: 'var(--space-6) var(--space-8) 72px', flex: '1 1 auto', minWidth: 0, containerType: 'inline-size', background: 'linear-gradient(180deg, #F8F4F4A9, #B0B0B0)' }}
          >
            {s.mod === 'dashboard' && <Dashboard d={d} tab={s.dashTab} setTab={(t) => set({ dashTab: t })} go={go} />}
            {party && (
              <PartyDetail
                d={d}
                party={party}
                tab={s.partyTab}
                setTab={(t) => set({ partyTab: t })}
                onBack={() => go('customers')}
                onEdit={() => openEdit(party, 'customers')}
                onAddRate={(matId) => openRate(party.id, matId)}
                onEndRate={askEndRate}
                onDeleteRate={(card) => askDelete(card, 'rates')}
                onOpenSuppliers={() => go('suppliers')}
                onEditLoad={(o) => openEdit(o, 'orders')}
                onPayLoad={openTicketPay}
                onDeleteLoad={(o) => askDelete(o, 'orders')}
                onReceipt={() => openReceipt(party)}
                onDeleteReceipt={(p) => askDelete(p, 'payments')}
                onReport={(type, range) => openReport(party.id, type, range)}
              />
            )}
            {s.mod === 'party' && !party && (
              <div className="ag-glass" style={{ padding: 'var(--space-6)' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>This credit party no longer exists</div>
                <button type="button" className="btn btn-secondary" style={{ marginTop: 'var(--space-3)' }} onClick={() => go('customers')}>All credit parties</button>
              </div>
            )}
            {s.mod === 'import' && (
              <RegisterImport
                d={d}
                onFile={importFile}
                onParty={choosePartyForRow}
                onSupplier={chooseSupplierForRow}
                onEditPay={editStagedPay}
                onRemove={removeStaged}
                onPostSales={postSales}
                onPostSoling={postSoling}
                onClear={clearStaged}
              />
            )}
            {s.mod === 'stdrates' && (
              <StandardRates d={d} onBack={() => go('materials')} onAddRate={(matId) => openRate('', matId)} onEndRate={askEndRate} onDeleteRate={(card) => askDelete(card, 'rates')} />
            )}
            {s.mod === 'weighbridge' && (
              <Weighbridge
                d={d}
                scale={s.scale}
                wb={s.wb}
                setWb={setWb}
                onCapture={captureTare}
                onWeighOut={weighOut}
                onConfirm={confirmOut}
                onVoid={askVoid}
                onCancel={cancelOut}
              />
            )}
            {s.mod === 'customers' && (
              <CreditParties d={d} onOpen={openParty} onAdd={openAdd} onReport={() => openReport('', 'statement')} />
            )}
            {s.mod === 'voids' && <VoidedEntries d={d} onRestore={restoreEntry} onReinstate={reinstate} />}
            {cfg && !CUSTOM_LISTS.includes(s.mod) && (
              <ListModule
                key={s.mod}
                mod={s.mod}
                d={d}
                f={filters}
                setF={set}
                onAdd={openAdd}
                onEdit={(row) => openEdit(row)}
                onDelete={askDelete}
                onRowAction={onRowAction}
              />
            )}
          </main>
        </div>
      </div>

      {modalProps && <Modal {...modalProps} />}
      {s.payEdit && (
        <PaymentEditor
          key={s.payEdit.title}
          title={s.payEdit.title}
          sub={s.payEdit.sub}
          bill={s.payEdit.bill}
          walkIn={s.payEdit.walkIn}
          initial={s.payEdit.initial}
          suppliers={s.db.suppliers.filter((p) => p.status !== 'Inactive')}
          onSave={savePay}
          onClose={() => set({ payEdit: null })}
        />
      )}
      <Toast message={s.toast} />
    </div>
  );
}
