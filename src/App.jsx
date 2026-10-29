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
import { createDomain, firstWeight, OTHER_MATERIAL, periodLabel, planRate } from './lib/domain';
import { hhmm, isoDate, M, N, T } from './lib/format';
import { onEnterKey } from './lib/enterNav';
import {
  applyOps, canOpen, conflicts, PAGE_GROUPS, describe, diffDb, hashSecret, levelOf, newSalt, strictest, taskLabel, tasksFor, TEMPLATES,
} from './lib/access';
import Access from './views/Access';
import Activity, { Approvals } from './views/Activity';
import { MODS, moduleConfig } from './lib/modules';
import { loadSaved, save as saveToBrowser } from './lib/storage';
import Attendance from './views/Attendance';
import CreditorDetail from './views/CreditorDetail';
import Creditors from './views/Creditors';
import Dashboard from './views/Dashboard';
import Electricity from './views/Electricity';
import { createPeople } from './lib/people';
import ListModule from './views/ListModule';
import Segmented from './components/Segmented';
import Login from './views/Login';
import PartyDetail, { StandardRates } from './views/PartyDetail';
import Profile from './views/Profile';
import Weighbridge from './views/Weighbridge';

const NUMERIC_FIELDS = ['rate', 'manualRate', 'amount', 'wage', 'tare', 'gross', 'days', 'ot', 'recovered', 'received', 'gst', 'rent', 'extra', 'litres'];
const FILTERS_CLEAR = { q: '', status: 'All', from: '', to: '', sortK: null };
const RECEIPT_METHODS = ['Cash', 'UPI', 'Account', 'Cheque'].map((x) => ({ v: x, l: METHOD_LABEL[x] || x }));
// Modules drawn by their own view instead of the generic list (their config still drives add/edit forms).
const CUSTOM_LISTS = ['bunks', 'vendors'];
// Tab names on grouped pages (Finances, Employees), in the order PAGE_GROUPS lists them.
const TAB_LABEL = { bunks: 'Fuel Bunks', vendors: 'Spares', expenses: 'Other', attendance: 'Attendance', employees: 'Info', advances: 'Salary' };
const DETAIL_VIEWS = ['dashboard', 'weighbridge', 'party', 'stdrates', 'import', 'attendance', 'creditor', 'eb', 'access', 'activity', 'approvals'];
// The person signed in; records are stamped with this name.
const actor = { name: 'System' };

const isWide = () => window.innerWidth >= 900;
const nextCode = (list, prefix, width) => {
  const n = Math.max(0, ...list.map((x) => +String(x.code || '').replace(/\D/g, '') || 0)) + 1;
  return prefix + String(n).padStart(width, '0');
};

function initialState() {
  const saved = loadSaved();
  const db = saved ? upgradeDb(saved.db) : seedDb();
  return {
    mod: 'dashboard', dashTab: 'Overview', now: new Date(), partyId: null, partyTab: 'Rates', creditorId: null, creditorTab: '',
    ...FILTERS_CLEAR, sortDir: 1,
    modal: null, form: {}, errors: {}, toast: null, wide: isWide(), payEdit: null,
    scale: IDLE_SCALE_KG, target: IDLE_SCALE_KG,
    wb: { vehicle: '', custId: db.customers[0] ? db.customers[0].id : '', matId: 'M06', empty: true, outId: null, err: '' },
    seq: saved ? saved.seq : SEED_NEXT_TICKET,
    db,
  };
}

// Who is signed in on this browser, and when they last did something (for automatic sign-out).
const SESSION_KEY = 'agbm.session';
const readSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; } };
const writeSession = (v) => { try { if (v) localStorage.setItem(SESSION_KEY, JSON.stringify(v)); else localStorage.removeItem(SESSION_KEY); } catch { /* storage blocked */ } };

// Routes live under "#/…"; other hashes are in-page anchors and keep the current view.
const routeOf = (hash) => (hash === '#/profile' ? 'profile' : 'app');

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
  const sRef = useRef(s);
  sRef.current = s;
  const meRef = useRef(null);
  const bypass = useRef(false);
  const lastBlock = useRef(0);
  const [session, setSession] = useState(readSession);
  const [lockReason, setLockReason] = useState('');

  // Every change to the books goes through here: it is checked against the signed-in person's rights,
  // recorded in the activity log, sent to the owner for approval, or refused.
  // Returns true when the change was applied.
  const set = useCallback((patch) => {
    const prev = sRef.current;
    const part = typeof patch === 'function' ? patch(prev) : patch;
    if (!part) return true;
    let out = part;
    let applied = true;
    if (part.db && part.db !== prev.db && !bypass.current) {
      const ops = diffDb(prev.db, part.db);
      if (ops.length) {
        const me = meRef.current;
        const keys = tasksFor(ops, TODAY);
        const level = strictest(me, keys);
        const label = describe(ops);
        const at = new Date().toISOString();
        if (level === 'deny') {
          lastBlock.current = Date.now();
          out = { toast: 'Not allowed: ' + keys.filter((k) => levelOf(me, k) === 'deny').map(taskLabel).join(', ') + '. Ask the owner for this right.' };
          applied = false;
        } else if (level === 'approve') {
          lastBlock.current = Date.now();
          const req = { id: 'AP' + Date.now(), at, userId: me.id, userName: me.name, keys, label, ops, status: 'pending' };
          out = { ...part, db: { ...prev.db, approvals: (prev.db.approvals || []).concat([req]) }, toast: 'Sent to the owner for approval — ' + label + '.' };
          applied = false;
        } else {
          const entry = { id: 'AU' + Date.now() + Math.random().toString(36).slice(2, 6), at, userId: me ? me.id : '', userName: me ? me.name : 'System', keys, label, ops };
          out = { ...part, db: { ...part.db, audit: (part.db.audit || []).concat([entry]) } };
        }
      }
    }
    sRef.current = { ...prev, ...out };
    setS((st) => ({ ...st, ...out }));
    return applied;
  }, []);
  // Owner / system changes that are not checked (sign-in, approvals, undo).
  const setRaw = (patch) => { bypass.current = true; try { set(patch); } finally { bypass.current = false; } };
  const d = useMemo(() => createDomain(s.db), [s.db]);
  const P = useMemo(() => createPeople(s.db), [s.db]);
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

  // Enter moves to the next field on every form, so staff can type without the mouse.
  useEffect(() => {
    document.addEventListener('keydown', onEnterKey);
    return () => document.removeEventListener('keydown', onEnterKey);
  }, []);

  // Keep every change in this browser (until a shared database is added).
  useEffect(() => {
    const t = setTimeout(() => saveToBrowser(s.db, s.seq), 250);
    return () => clearTimeout(t);
  }, [s.db, s.seq]);

  const toast = (msg) => {
    if (Date.now() - lastBlock.current < 600) return;
    set({ toast: msg });
  };
  useEffect(() => {
    if (!s.toast) return undefined;
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setS((st) => ({ ...st, toast: null })), Date.now() - lastBlock.current < 4000 ? 4500 : 2800);
    return () => clearTimeout(toastTimer.current);
  }, [s.toast]);

  const users = s.db.users || [];
  const me = session ? users.find((u) => u.id === session.userId && u.active !== false) || null : null;
  meRef.current = me;
  actor.name = me ? me.name : 'System';
  const idleMinutes = me ? (+((s.db.settings || {})[me.role === 'owner' ? 'idleOwner' : 'idleStaff']) || (me.role === 'owner' ? 60 : 15)) : 15;

  const signOut = (reason) => { writeSession(null); setSession(null); setLockReason(reason || ''); set({ mod: 'dashboard', modal: null, payEdit: null }); };
  useEffect(() => {
    if (!me) return undefined;
    const touch = () => { const now = Date.now(); const cur = readSession(); if (cur && now - (cur.lastActive || 0) > 15000) writeSession({ ...cur, lastActive: now }); };
    const evs = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const tick = setInterval(() => {
      const cur = readSession();
      if (cur && Date.now() - (cur.lastActive || 0) > idleMinutes * 60000) signOut('Signed out after ' + idleMinutes + ' minutes without use.');
    }, 20000);
    return () => { evs.forEach((e) => window.removeEventListener(e, touch)); clearInterval(tick); };
  }, [me && me.id, idleMinutes]);

  const verify = async (u, secret) => !!u && (await hashSecret(secret, u.salt)) === u.secretHash;
  const startSession = (u) => {
    const v = { userId: u.id, lastActive: Date.now() };
    writeSession(v); setSession(v); setLockReason('');
    const at = new Date().toISOString();
    setRaw((st) => ({ db: { ...st.db, users: (st.db.users || []).map((x) => (x.id === u.id ? { ...x, lastSignIn: at } : x)) } }));
  };
  const createOwner = async (name, password) => {
    const salt = newSalt();
    const owner = { id: 'U' + Date.now(), name, phone: '', role: 'owner', salt, secretHash: await hashSecret(password, salt), active: true, perms: {} };
    setRaw((st) => ({ db: { ...st.db, users: [owner] } }));
    startSession(owner);
  };
  const signIn = async (id, secret) => {
    const u = users.find((x) => x.id === id);
    if (!(await verify(u, secret))) return false;
    startSession(u);
    return true;
  };
  const saveUser = async (u, pin) => {
    const id = u.id || 'U' + Date.now();
    let rec = { ...u, id };
    if (pin) { const salt = newSalt(); rec = { ...rec, salt, secretHash: await hashSecret(pin, salt) }; }
    setRaw((st) => {
      const list = st.db.users || [];
      return { db: { ...st.db, users: list.some((x) => x.id === id) ? list.map((x) => (x.id === id ? { ...x, ...rec } : x)) : list.concat([rec]) } };
    });
    toast((u.id ? 'Saved ' : 'Added ') + rec.name + '.');
    return id;
  };
  // A new person asks for a sign-in from the sign-in screen. The PIN is stored only as a salted hash.
  const requestAccess = async ({ name, phone, template, pin }) => {
    const salt = newSalt();
    const req = {
      id: 'AR' + Date.now(), ref: 'REQ-' + String(Date.now()).slice(-5), name, phone, template, salt, secretHash: await hashSecret(pin, salt),
      at: new Date().toISOString(), status: 'pending',
    };
    setRaw((st) => ({ db: { ...st.db, accessRequests: (st.db.accessRequests || []).concat([req]) } }));
    return req;
  };
  // Owner approves (adds the person as staff with the rights template they asked for) or declines a request.
  const decideAccessRequest = (id, yes) => {
    const req = (s.db.accessRequests || []).find((r) => r.id === id);
    if (!req || req.status !== 'pending') return;
    const at = new Date().toISOString();
    const taken = users.some((u) => u.name.trim().toLowerCase() === req.name.trim().toLowerCase());
    if (yes && taken) { toast('Someone already signs in as ' + req.name + '. Decline this request or rename that person first.'); return; }
    setRaw((st) => {
      const accessRequests = (st.db.accessRequests || []).map((r) => (r.id === id ? { ...r, status: yes ? 'approved' : 'declined', decidedBy: me.name, decidedAt: at } : r));
      if (!yes) return { db: { ...st.db, accessRequests } };
      const user = {
        id: 'U' + Date.now(), name: req.name, phone: req.phone, role: 'staff', template: req.template, active: true,
        perms: { ...(TEMPLATES[req.template] || TEMPLATES.viewer).perms }, salt: req.salt, secretHash: req.secretHash,
      };
      return { db: { ...st.db, accessRequests, users: (st.db.users || []).concat([user]) } };
    });
    toast(yes ? 'Approved ' + req.name + '. They can sign in now.' : 'Declined the request from ' + req.name + '.');
  };
  const saveAccessSettings = (patch) => setRaw((st) => ({ db: { ...st.db, settings: { ...(st.db.settings || {}), ...patch } } }));

  // Owner decides a held change: approving applies it now, recorded as done by the staff member.
  const decideApproval = (id, yes) => {
    const req = (s.db.approvals || []).find((a) => a.id === id);
    if (!req || req.status !== 'pending') return;
    const at = new Date().toISOString();
    setRaw((st) => {
      const approvals = (st.db.approvals || []).map((a) => (a.id === id ? { ...a, status: yes ? 'approved' : 'rejected', decidedBy: me.name, decidedAt: at } : a));
      if (!yes) return { db: { ...st.db, approvals } };
      const db = applyOps(st.db, req.ops);
      const entry = { id: 'AU' + Date.now(), at, userId: req.userId, userName: req.userName, approvedBy: me.name, keys: req.keys, label: req.label, ops: req.ops };
      return { db: { ...db, approvals, audit: (st.db.audit || []).concat([entry]) } };
    });
    toast((yes ? 'Approved: ' : 'Rejected: ') + req.label + '.');
  };

  // Owner undoes chosen changes (newest first). Records changed by someone since are skipped.
  const rollback = (ids) => {
    const chosen = (s.db.audit || []).filter((a) => ids.includes(a.id) && !a.rolledBack).sort((a, b) => b.at.localeCompare(a.at));
    if (!chosen.length) return;
    const at = new Date().toISOString();
    let db = s.db;
    let skipped = 0;
    chosen.forEach((a) => {
      a.ops.slice().reverse().forEach((o) => {
        if (o.coll === 'voided') return; // archive from older saves; no longer kept
        if (conflicts(db, [o], true).length) { skipped += 1; return; }
        if (o.op === 'add') db = applyOps(db, [{ coll: o.coll, op: 'del', id: o.id }]);
        else if (o.op === 'del') db = applyOps(db, [{ coll: o.coll, op: 'add', id: o.id, after: o.before }]);
        else if (o.op === 'upd') db = applyOps(db, [{ coll: o.coll, op: 'upd', id: o.id, after: o.before }]);
        else db = applyOps(db, [{ coll: o.coll, op: 'set', after: o.before }]);
      });
    });
    const who = [...new Set(chosen.map((a) => a.userName))].join(', ');
    const ops = diffDb(s.db, db);
    const entry = { id: 'AU' + Date.now(), at, userId: me.id, userName: me.name, keys: [], label: 'Undid ' + chosen.length + ' change(s) by ' + who, ops, rollback: true };
    const audit = (db.audit || []).map((a) => (ids.includes(a.id) ? { ...a, rolledBack: { at, by: me.name } } : a)).concat([entry]);
    setRaw({ db: { ...db, audit } });
    toast('Undid ' + chosen.length + ' change(s) by ' + who + (skipped ? ' — ' + skipped + ' record(s) skipped because they were changed since.' : '.'));
  };

  const go = (target) => {
    // A page made of tabs (Finances, Employees) opens its first tab this person may use.
    const mod = PAGE_GROUPS[target] ? PAGE_GROUPS[target].find((t) => canOpen(meRef.current, t)) || target : target;
    if (!canOpen(meRef.current, mod)) { toast('You do not have access to that page.'); return; }
    set({ mod, ...FILTERS_CLEAR, modal: null });
  };
  const setWb = (patch) => set((st) => ({ wb: { ...st.wb, ...patch } }));
  const closeModal = () => set({ modal: null, errors: {} });

  // ---- weighbridge ----
  const captureTare = () => {
    const wb = s.wb;
    const vehicle = wb.vehicle.trim();
    const empty = wb.empty !== false;
    const kind = empty ? 'tare' : 'gross';
    if (!vehicle) return setWb({ err: 'Enter the vehicle number before capturing ' + kind + '.' });
    if (s.db.onsite.some((v) => v.vehicle.toLowerCase() === vehicle.toLowerCase())) return setWb({ err: 'That vehicle is already on site awaiting weigh-out.' });
    if (!wb.custId) return setWb({ err: 'Choose the customer first.' });
    const ticket = 'WB-' + s.seq;
    const base = { id: 'S' + Date.now(), ticket, vehicle: vehicle.toUpperCase(), custId: wb.custId, matId: wb.matId, inAt: hhmm() };
    // `load` is the simulated change in weight the live scale moves to at weigh-out: up for a loading, down for an unloading.
    const row = empty
      ? { ...base, entry: 'empty', tare: s.scale, load: 15000 + Math.round(Math.random() * 5000) }
      : { ...base, entry: 'loaded', gross: s.scale, load: -Math.max(0, s.scale - (4000 + Math.round(Math.random() * 1000))) };
    set((st) => ({ seq: st.seq + 1, db: { ...st.db, onsite: st.db.onsite.concat([row]) }, wb: { ...st.wb, vehicle: '', err: '' } }));
    toast(ticket + ' opened — ' + kind + ' ' + N(s.scale) + ' kg captured for ' + row.vehicle + '.');
    return undefined;
  };

  const weighOut = (id) => {
    const v = s.db.onsite.find((x) => x.id === id);
    set((st) => ({ wb: { ...st.wb, outId: id }, target: firstWeight(v) + v.load }));
  };
  // Hand-corrected empty (tare) and loaded (gross) weights for a vehicle still on site; null clears a side.
  const updateOnsiteWeights = (id, weights) => {
    const v = s.db.onsite.find((x) => x.id === id);
    if (!v) return;
    set((st) => ({ db: { ...st.db, onsite: st.db.onsite.map((x) => (x.id === id ? { ...x, ...weights } : x)) } }));
    toast(v.ticket + ' weights updated for ' + v.vehicle + '.');
  };
  const cancelOut = () => set((st) => ({ wb: { ...st.wb, outId: null }, target: IDLE_SCALE_KG }));

  const ticketFromOnsite = (v, patch) => ({
    id: 'O' + Date.now(), ticket: v.ticket, date: isoDate(), time: hhmm(), custId: v.custId, matId: v.matId, matName: '', vehicle: v.vehicle, dir: 'OUT',
    manualRate: '', method: 'Credit', roundOff: 0, payRemarks: '', remarks: '', by: 'Murugan R', ...patch,
  });

  // Weigh-out takes the live reading as gross, then asks how the load was paid before the ticket is saved.
  const confirmOut = () => {
    const v = s.db.onsite.find((x) => x.id === s.wb.outId);
    if (!v) return;
    if (v.tare == null || v.gross == null) { toast('Capture both the empty and the loaded weight before completing ' + v.ticket + '.'); return; }
    const o = ticketFromOnsite(v, { tare: v.tare, gross: v.gross, status: 'Completed', reason: '' });
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
    // Same weight on both sides, so a voided load nets to zero.
    const o = ticketFromOnsite(v, { tare: firstWeight(v), gross: firstWeight(v), status: 'Void', reason: 'Voided at weigh-out' });
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
    const recs = toRecords(pay, ticket, actor.name);
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
  const alreadyIn = (row) => s.db.orders.some((o) => (o.serial || o.ticket) === row.serial && o.date === row.date)
    || s.db.purchases.some((p) => p.serial === row.serial && p.date === row.date);

  const stageRow = (row, batchId) => {
    const m = matchMaterial(row.material);
    const key = row.date + '|' + row.serial;
    const cashSerial = /^CA/i.test(row.serial);
    if (m.kind === 'soling') return { ...row, key, batchId, kind: 'soling', matId: m.matId, dup: alreadyIn(row) };
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
      toast(cust.name + (exists ? ' is already a customer — linked.' : ' added as a customer. Add owner, contact and address on Customers.'));
      return;
    }
    const next = v === '__walkin' ? { ...row, custId: '', walkIn: row.name } : { ...row, custId: v, walkIn: '' };
    patchStaged(key, { custId: next.custId, walkIn: next.walkIn, pay: defaultPay(rowBill(d, next).bill, { walkIn: !next.custId, cashSerial }) });
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
      const manualRate = +r.manualRate > 0 ? +r.manualRate : r.amount > 0 && (b.mismatch || !b.card.rate) ? round2(r.amount / tons) : '';
      const result = checkPay(r.pay, b.bill, { walkIn: !r.custId });
      const o = {
        id: 'O' + Date.now() + '-' + i, ticket: r.serial, serial: r.serial, date: r.date, time: r.time, custId: r.custId, walkIn: r.custId ? '' : r.walkIn,
        matId: r.matId, matName: r.matName, vehicle: r.vehicle, dir: 'OUT', tare: r.gross - r.net, gross: r.gross, manualRate,
        method: methodOf(r.pay), roundOff: result.roundOff, payRemarks: String(r.pay.remarks || '').trim(), regAmount: r.amount, batchId: r.batchId,
        status: 'Completed', reason: '', remarks: r.remarks || '', by: actor.name,
      };
      orders.push(o);
      payments.push(...toRecords(r.pay, o, actor.name).map((p, j) => ({ ...p, id: p.id + '-' + i + '-' + j })));
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
      id: 'U' + Date.now() + '-' + i, serial: r.serial, date: r.date, time: r.time, supplierName: String(r.name || '').trim(), regName: r.name,
      // Soling trucks come in loaded: the register's Gross column is the empty truck, its Net column the loaded weight.
      vehicle: r.vehicle, tare: r.gross, gross: r.net, manualRate: r.manualRate || '', extra: r.extra || '', batchId: r.batchId, remarks: r.remarks || '', by: actor.name,
    }));
    const keys = new Set(ready.map((r) => r.key));
    set((st) => ({ db: { ...st.db, purchases: recs.concat(st.db.purchases), staging: st.db.staging.filter((r) => !keys.has(r.key)) } }));
    toast(ready.length + ' soling load(s) saved.');
  };

  const removeStaged = (key) => {
    const row = s.db.staging.find((r) => r.key === key);
    askDelete({ ...row, id: row.key }, 'staging');
  };
  const clearStaged = () => set({
    modal: { kind: 'clearStaging', title: 'Remove all pending rows?', kicker: 'Register import', confirmLabel: 'Remove all', message: 'Rows not yet posted are deleted for good and cannot be restored.' },
  });

  // ---- list modules ----
  const cfgOf = (mod) => (mod && !DETAIL_VIEWS.includes(mod) ? moduleConfig(mod, d) : null);
  const cfg = cfgOf(s.mod);
  const party = s.mod === 'party' ? s.db.customers.find((c) => c.id === s.partyId) : null;

  const openParty = (id) => set({ mod: 'party', partyId: id, partyTab: 'Loads taken', modal: null });
  // ---- fuel bunks and spares companies ----
  const cr = s.mod === 'creditor' ? (s.db.creditors || []).find((c) => c.id === s.creditorId) : null;
  const openCreditor = (id) => set({ mod: 'creditor', creditorId: id, creditorTab: '', modal: null });
  const openCrBill = (c) => {
    const bunk = c.kind === 'bunk';
    const cfgB = cfgOf(bunk ? 'fuelBills' : 'spareBills');
    const f = {};
    cfgB.fields.forEach((x) => { f[x.k] = x.type === 'date' ? isoDate() : x.type === 'time' ? hhmm() : ''; });
    f.creditorId = c.id;
    if (bunk) {
      f.forType = 'own';
      // Start from the price on the bunk's latest fill; staff change it when the price changes.
      const last = d.crBillsOf(c.id).filter((b) => +b.rate > 0).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0];
      f.rate = last ? last.rate : '';
    }
    set({ modal: { kind: 'form', cfgMod: bunk ? 'fuelBills' : 'spareBills', title: (bunk ? 'Fuel taken — ' : 'Purchase bill — ') + c.name, kicker: bunk ? 'Fuel on credit' : 'Bought on credit', confirmLabel: 'Save' }, form: f, errors: {} });
  };
  const openCrPay = (c) => set({
    modal: { kind: 'crPay', id: c.id, title: 'Pay ' + c.name, kicker: c.kind === 'bunk' ? 'Payment to fuel bunk' : 'Payment to spares company', confirmLabel: 'Save payment' },
    form: { amount: '', method: 'Cash', date: isoDate(), time: hhmm(), ref: '', remarks: '' }, errors: {},
  });
  const postCrPay = () => {
    const f = s.form;
    const c = d.creditor(s.modal.id);
    const amt = round2(f.amount);
    const errs = {};
    if (!(amt > 0)) errs.amount = 'Enter an amount greater than zero.';
    if (!f.date) errs.date = 'Required.';
    if (Object.keys(errs).length) { set({ errors: errs }); return; }
    const rec = { id: 'KP' + Date.now(), creditorId: c.id, date: f.date, time: f.time || hhmm(), method: f.method, amount: amt, ref: String(f.ref || '').trim(), remarks: String(f.remarks || '').trim(), by: actor.name };
    set((st) => ({ db: { ...st.db, crPayments: (st.db.crPayments || []).concat([rec]) }, modal: null }));
    const left = d.crOwed(c) - amt;
    toast(M(amt) + ' paid to ' + c.name + '. ' + (left < -0.5 ? M(-left) + ' paid ahead.' : 'Still owed ' + M(Math.max(0, left)) + '.'));
  };


  // Manual load entered from a credit party's account; saving opens the payment dialog.
  const openNewLoad = (custId) => {
    const c = cfgOf('orders');
    const f = {};
    c.fields.forEach((x) => { f[x.k] = x.type === 'select' ? (x.options[0] ? x.options[0].v : '') : x.type === 'date' ? isoDate() : x.type === 'time' ? hhmm() : ''; });
    f.custId = custId;
    f.status = 'Completed';
    set({ modal: { kind: 'form', cfgMod: 'orders', title: 'New load — ' + d.cust(custId).name, kicker: 'Manual entry', confirmLabel: 'Save · record payment' }, form: f, errors: {} });
  };

  // ---- editing imported rows before they are posted ----
  // Sales keep the register's tare/gross; soling rows keep the register's Gross (empty truck) and Net (loaded truck).
  const stagedTons = (r) => (r.kind === 'sale' ? r.net : r.net - r.gross) / 1000;
  const openStagedEdit = (key) => {
    const r = s.db.staging.find((x) => x.key === key);
    const sale = r.kind === 'sale';
    const t = stagedTons(r);
    const rate = +r.manualRate > 0 ? +r.manualRate : sale && r.amount > 0 && t > 0 ? round2(r.amount / t) : '';
    set({
      modal: { kind: 'stagedEdit', key, sale, rate0: rate, title: 'Edit ' + r.serial, kicker: sale ? 'Imported sale' : 'Imported soling load', confirmLabel: 'Save changes' },
      form: {
        date: r.date, time: r.time || '', serial: r.serial, vehicle: r.vehicle, matId: r.matId || '', matName: r.matName || '',
        empty: sale ? r.gross - r.net : r.gross, loaded: sale ? r.gross : r.net, rate, extra: r.extra || '', remarks: r.remarks || '',
      },
      errors: {},
    });
  };
  const stagedDraft = () => {
    const f = s.form;
    const r = s.db.staging.find((x) => x.key === s.modal.key);
    const empty = +f.empty || 0;
    const loaded = +f.loaded || 0;
    const base = { ...r, date: f.date, time: f.time, serial: String(f.serial || '').trim(), vehicle: String(f.vehicle || '').trim().toUpperCase(), remarks: String(f.remarks || '').trim() };
    if (!s.modal.sale) return { ...base, gross: empty, net: loaded, manualRate: +f.rate > 0 ? +f.rate : '', extra: +f.extra > 0 ? +f.extra : '' };
    const next = { ...base, matId: f.matId, matName: f.matId === OTHER_MATERIAL ? String(f.matName || '').trim() : '', gross: loaded, net: loaded - empty };
    // A corrected weight, material, date or rate is billed as net tons × rate, not the register's printed amount.
    const changed = next.net !== r.net || next.matId !== r.matId || next.date !== r.date || String(f.rate ?? '') !== String(s.modal.rate0 ?? '');
    if (!changed) return next;
    const card = d.rateFor(next.custId, next.matId, next.date).rate;
    const rate = +f.rate > 0 ? +f.rate : 0;
    return { ...next, amount: 0, manualRate: rate && Math.abs(rate - card) > 0.004 ? rate : '' };
  };
  const saveStagedEdit = () => {
    const f = s.form;
    const sale = s.modal.sale;
    const errs = {};
    if (!f.date) errs.date = 'Required.';
    if (!String(f.vehicle || '').trim()) errs.vehicle = 'Required.';
    if (!(+f.loaded > 0)) errs.loaded = 'Enter the loaded truck weight.';
    else if (+f.loaded <= (+f.empty || 0)) errs.loaded = 'The loaded weight must be more than the empty truck.';
    if (String(f.rate ?? '').trim() && !(+f.rate > 0)) errs.rate = 'Enter a rate greater than zero, or leave it blank.';
    if (sale && f.matId === OTHER_MATERIAL && !String(f.matName || '').trim()) errs.matName = 'Type the material name for Other.';
    const next = Object.keys(errs).length ? null : stagedDraft();
    if (next && sale && !(rowBill(d, next).bill > 0)) errs.rate = 'No rate card covers this date — enter a rate per ton.';
    if (Object.keys(errs).length) { set({ errors: errs }); return; }
    const old = s.db.staging.find((x) => x.key === s.modal.key);
    const billChanged = sale && Math.abs(rowBill(d, next).bill - rowBill(d, old).bill) > 0.005;
    if (billChanged) next.pay = defaultPay(rowBill(d, next).bill, { walkIn: !next.custId, cashSerial: /^CA/i.test(next.serial) });
    set((st) => ({ db: { ...st.db, staging: st.db.staging.map((r) => (r.key === next.key ? next : r)) }, modal: null }));
    toast(next.serial + ' updated' + (billChanged ? ' — the bill is now ' + M(rowBill(d, next).bill) + '; check its payment.' : '.'));
  };

  // ---- workers: attendance, advances, Saturday salary ----
  const saveAttendance = (date, rows) => {
    set((st) => {
      const others = (st.db.attendance || []).filter((a) => a.date !== date);
      const old = (st.db.attendance || []).filter((a) => a.date === date);
      const marked = rows.filter((r) => r.status).map((r, i) => {
        const was = old.find((a) => a.empId === r.emp.id);
        return {
          id: was ? was.id : 'A' + Date.now() + '-' + i, date, empId: r.emp.id, status: r.status,
          wage: was ? was.wage : +r.emp.wage || 0, remarks: String(r.remarks || '').trim(), by: actor.name,
        };
      });
      return { db: { ...st.db, attendance: others.concat(marked) } };
    });
    const n = (k) => rows.filter((r) => r.status === k).length;
    toast('Attendance for ' + date + ' saved — ' + n('Present') + ' present, ' + n('Half day') + ' half day, ' + n('Absent') + ' absent.');
  };

  const openAdvance = (empId, date) => {
    const c = cfgOf('advances');
    const f = {};
    c.fields.forEach((x) => { f[x.k] = x.type === 'select' ? (x.options[0] ? x.options[0].v : '') : x.type === 'date' ? isoDate() : x.type === 'time' ? hhmm() : ''; });
    if (empId) f.empId = empId;
    if (date) f.date = date;
    f.mode = 'Cash';
    set({ modal: { kind: 'form', cfgMod: 'advances', title: 'Give advance' + (empId ? ' — ' + P.emp(empId).name : ''), kicker: 'Worker advance', confirmLabel: 'Save advance' }, form: f, errors: {} });
  };

  // ---- electricity: one reading per day, one month-end entry per month ----
  const saveEbReading = (rec) => {
    set((st) => {
      const list = st.db.ebReadings || [];
      const was = list.find((r) => r.date === rec.date);
      const next = was ? list.map((r) => (r.date === rec.date ? { ...r, ...rec, by: actor.name } : r)) : list.concat([{ id: 'EB' + Date.now(), ...rec, by: actor.name }]);
      return { db: { ...st.db, ebReadings: next } };
    });
    toast('EB reading for ' + rec.date + ' saved — ' + rec.units + ' kWh' + (rec.pf ? ', PF ' + rec.pf : '') + '.');
  };
  const saveEbBill = (rec) => {
    set((st) => {
      const list = st.db.ebBills || [];
      const was = list.find((b) => b.month === rec.month);
      const next = was ? list.map((b) => (b.month === rec.month ? { ...b, ...rec, by: actor.name } : b)) : list.concat([{ id: 'EBB' + Date.now(), ...rec, by: actor.name }]);
      return { db: { ...st.db, ebBills: next } };
    });
    toast('Month-end electricity for ' + rec.month + ' saved.');
  };

  // Reports opened from a page, with that page's dates filled in.
  const monthRange = (ym) => {
    const [y, mo] = ym.split('-').map(Number);
    const last = new Date(y, mo, 0).getDate();
    return { fromDate: ym + '-01', toDate: ym + '-' + String(last).padStart(2, '0') };
  };
  const openPageReport = (list, range) => openReport('', '', range, { list });

  // ---- day book ----
  const openOpening = () => {
    const st = s.db.settings || {};
    set({
      modal: { kind: 'opening', title: 'Opening balances', kicker: 'Day book', confirmLabel: 'Save balances', message: 'Count the cash in hand and check the bank balance at the start of the day you begin. The day book adds every entry from that day on.' },
      form: { startDate: st.startDate || isoDate(), cashStart: st.cashStart || '', bankStart: st.bankStart || '' }, errors: {},
    });
  };
  const saveOpening = () => {
    const f = s.form;
    const errs = {};
    if (!f.startDate) errs.startDate = 'Required.';
    ['cashStart', 'bankStart'].forEach((k) => { if (String(f[k] ?? '').trim() && !Number.isFinite(+f[k])) errs[k] = 'Enter an amount.'; });
    if (Object.keys(errs).length) { set({ errors: errs }); return; }
    set((st) => ({ db: { ...st.db, settings: { ...(st.db.settings || {}), startDate: f.startDate, cashStart: +f.cashStart || 0, bankStart: +f.bankStart || 0 } }, modal: null }));
    toast('Opening balances saved from ' + f.startDate + '.');
  };

  // Receipt on a party's account: how it was paid and who received the money (company, a bunk / spares company, or someone else).
  const openReceipt = (c) => set({
    modal: { kind: 'receipt', id: c.id, title: 'Record payment — ' + c.name, kicker: 'Payment received', confirmLabel: 'Save payment' },
    form: { amount: '', method: 'Cash', to: 'company', toName: '', date: isoDate(), time: hhmm(), ref: '', remarks: '' }, errors: {},
  });

  // ---- deleting: a record goes together with the records that depend on it ----
  const KIND_NAME = {
    orders: 'Load', payments: 'Payment', customers: 'Customer', materials: 'Material', rates: 'Rate period',
    staging: 'Import row', purchases: 'Soling load', expenses: 'Expense', employees: 'Employee', attendance: 'Attendance entry', advances: 'Advance', payroll: 'Payroll line',
  };
  const deletionFor = (key, row) => {
    const D = s.db;
    if (key === 'orders') {
      return { kind: 'Load', label: row.ticket + ' · ' + d.partyLabel(row) + ' · ' + d.matLabel(row) + ' · ' + T(d.net(row)) + ' t', amount: d.billTotal(row), records: { orders: [row], payments: d.paymentsFor(row.id) } };
    }
    if (key === 'customers') {
      const ids = new Set(D.orders.filter((o) => o.custId === row.id).map((o) => o.id));
      return {
        kind: 'Customer', label: row.name + ' (' + row.code + ') with ' + ids.size + ' load(s)', amount: d.outstanding(row),
        records: { customers: [row], orders: D.orders.filter((o) => ids.has(o.id)), payments: D.payments.filter((p) => ids.has(p.ticketId) || (!p.ticketId && p.custId === row.id)), rates: D.rates.filter((r) => r.custId === row.id) },
      };
    }
    if (key === 'materials') return { kind: 'Material', label: row.name, records: { materials: [row], rates: D.rates.filter((r) => r.matId === row.id) } };
    if (key === 'payments') return { kind: row.ticketId ? 'Payment' : 'Receipt', label: d.cust(row.custId).name + ' · ' + METHOD_LABEL[row.method] + ' · ' + row.date, amount: row.amount, records: { payments: [row] } };
    if (key === 'rates') return { kind: 'Rate period', label: rateTarget(row.custId) + ' · ' + d.mat(row.matId).name + ' · ' + M(row.rate) + '/t · ' + periodLabel(row), records: { rates: [row] } };
    if (key === 'purchases') return { kind: 'Soling load', label: (row.serial || 'Load') + ' · ' + (row.supplierName || 'Supplier not named') + ' · ' + row.vehicle + ' · ' + T(d.net(row)) + ' t', amount: d.solValue(row), records: { purchases: [row] } };
    if (key === 'ebReadings') return { kind: 'EB reading', label: row.date + ' · ' + row.units + ' kWh' + (row.pf ? ' · PF ' + row.pf : ''), amount: null, records: { ebReadings: [row] } };
    if (key === 'ebBills') return { kind: 'Electricity bill', label: row.month + ' · govt ' + M(row.govt) + ' · private ' + M(row.private) + (row.tharAmount ? ' · Thar ' + M(row.tharAmount) : ''), amount: (+row.govt || 0) + (+row.private || 0), records: { ebBills: [row] } };
    if (key === 'creditors') {
      return {
        kind: row.kind === 'bunk' ? 'Fuel bunk' : 'Spares company', label: row.name + ' with ' + (D.crBills || []).filter((b) => b.creditorId === row.id).length + ' bill(s)', amount: d.crOwed(row),
        records: { creditors: [row], crBills: (D.crBills || []).filter((b) => b.creditorId === row.id), crPayments: (D.crPayments || []).filter((p) => p.creditorId === row.id) },
      };
    }
    if (key === 'crBills') return { kind: d.creditor(row.creditorId).kind === 'bunk' ? 'Fuel entry' : 'Purchase bill', label: d.creditor(row.creditorId).name + ' · ' + (row.billNo || row.items || row.vehicle || '') + ' · ' + row.date, amount: d.crBillValue(row), records: { crBills: [row] } };
    if (key === 'crPayments') return { kind: 'Payment to ' + (d.creditor(row.creditorId).kind === 'bunk' ? 'bunk' : 'spares company'), label: d.creditor(row.creditorId).name + ' · ' + METHOD_LABEL[row.method] + ' · ' + row.date, amount: row.amount, records: { crPayments: [row] } };
    if (key === 'advances') return { kind: 'Advance', label: P.emp(row.empId).name + ' · ' + row.date + (row.remarks ? ' · ' + row.remarks : ''), amount: +row.amount || 0, records: { advances: [row] } };
    if (key === 'payroll') return { kind: 'Salary payment', label: P.emp(row.empId).name + ' · week ending ' + row.weekEnd, amount: +row.net || 0, records: { payroll: [row] } };
    if (key === 'expenses') return { kind: row.type === 'Credit' ? 'Other income' : 'Expense', label: (row.head === 'Other' && row.headOther ? row.headOther : row.head) + ' · ' + (row.party || '') + ' · ' + row.date, amount: +row.amount || 0, records: { expenses: [row] } };
    if (key === 'staging') return { kind: 'Import row', label: row.serial + ' · ' + row.name + ' · ' + row.material + ' · ' + row.date, amount: row.amount, records: { staging: [row] } };
    return { kind: KIND_NAME[key] || 'Record', label: row.name || row.ticket || row.head || row.code || row.id, amount: row.amount || null, records: { [key]: [row] } };
  };

  const askDelete = (row, key = cfg && cfg.key) => {
    const entry = deletionFor(key, row);
    set({
      modal: { kind: 'delete', key, row, title: 'Delete ' + entry.kind.toLowerCase() + '?', kicker: entry.label, confirmLabel: 'Delete permanently', message: 'This is deleted for good, with anything recorded against it, and cannot be restored.' },
      form: {},
      errors: {},
    });
  };

  const doDelete = () => {
    const { key, row } = s.modal;
    const entry = deletionFor(key, row);
    const drop = (list, items, idKey) => list.filter((x) => !items.some((y) => y[idKey] === x[idKey]));
    set((st) => {
      const db = { ...st.db };
      Object.entries(entry.records).forEach(([k, items]) => { db[k] = drop(st.db[k] || [], items, k === 'staging' ? 'key' : 'id'); });
      return { db, modal: null, ...(key === 'customers' && st.mod === 'party' ? { mod: 'customers' } : key === 'creditors' && st.mod === 'creditor' ? { mod: row.kind === 'bunk' ? 'bunks' : 'vendors' } : {}) };
    });
    toast(entry.kind + ' deleted.');
  };

  // ---- PDF reports ----
  // who: { creditorId } for one bunk / spares account; otherwise a customer (custId) or all customers.
  const openReport = (custId, type, range = {}, who = {}) => set({
    modal: {
      kind: 'report', custId, creditorId: who.creditorId || '', listReport: who.list || '', kicker: 'Report', confirmLabel: 'Download',
      title: who.creditorId ? 'Generate report — ' + d.creditor(who.creditorId).name : who.list ? ({ fuel: 'Fuel bunks report', spares: 'Spares & purchases report', eb: 'Electricity (EB) report', attendance: 'Attendance & wages report', daily: 'Day report' }[who.list] || 'Report') : custId ? 'Generate report — ' + d.cust(custId).name : 'All customers report',
    },
    form: { type: type || 'statement', copy: 'party', format: 'pdf', fromDate: range.fromDate || '', fromTime: range.fromTime || '', toDate: range.toDate || '', toTime: range.toTime || '' },
    errors: {},
  });

  const makeReport = async () => {
    const f = s.form;
    const from = f.fromDate ? f.fromDate + ' ' + (f.fromTime || '00:00') : '';
    const to = f.toDate ? f.toDate + ' ' + (f.toTime || '23:59') : '';
    if (from && to && to < from) { set({ errors: { toDate: 'The end is before the start.' } }); return; }
    const m = s.modal;
    const R = await import('./lib/report');
    if (m.creditorId || m.listReport) {
      const X = await import('./lib/exports');
      if (m.listReport === 'daily' && !f.fromDate) { set({ errors: { fromDate: 'Choose the day.' } }); return; }
      const rep = m.creditorId ? X.buildCreditorReport(d, d.creditor(m.creditorId), f.type, from, to) : X.buildReport(m.listReport, d, from.slice(0, 10), (m.listReport === 'daily' ? from : to).slice(0, 10));
      if (f.format === 'xlsx') await X.reportExcel(rep); else await X.reportPdf(rep);
      set({ modal: null });
      toast('Report downloaded.');
      return;
    }
    if (m.custId) await R.partyReport({ d, party: d.cust(m.custId), type: f.type, from, to, copy: f.copy });
    else await R.allPartiesReport({ d, from, to });
    set({ modal: null });
    toast('Report downloaded.');
  };

  const openAdd = () => {
    if (!cfg) return;
    const f = {};
    cfg.fields.forEach((x) => {
      f[x.k] = x.type === 'select' ? (x.options[0] ? x.options[0].v : '') : x.type === 'date' ? isoDate() : x.type === 'time' ? hhmm() : '';
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
    const card = { id: 'R' + Date.now(), ...rec, by: actor.name };
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

  const askEndRate = (card, coll = 'rates') => set({
    modal: {
      kind: 'endRate', id: card.id, coll, confirmLabel: 'End rate',
      title: 'End ' + d.mat(card.matId).name + ' at ' + M(card.rate) + '/t?',
      kicker: rateTarget(card.custId),
    },
    form: { to: isoDate() < card.from ? card.from : isoDate() },
    errors: {},
  });

  const endRate = () => {
    const coll = s.modal.coll || 'rates';
    const card = s.db[coll].find((r) => r.id === s.modal.id);
    const to = s.form.to;
    if (!to) { set({ errors: { to: 'Required.' } }); return; }
    if (to < card.from) { set({ errors: { to: 'The rate starts on ' + card.from + '; pick that day or later.' } }); return; }
    set((st) => ({ db: { ...st.db, [coll]: st.db[coll].map((r) => (r.id === card.id ? { ...r, to } : r)) }, modal: null }));
    toast(d.mat(card.matId).name + ' at ' + M(card.rate) + '/t now ends ' + to + '.');
  };

  const onRowAction = (kind, row) => {
    if (kind === 'party') openParty(row.id);
    else if (kind === 'stdrates') set({ mod: 'stdrates', modal: null });
    else if (kind === 'receipt') openReceipt(row);
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
    const toCreditor = f.to.startsWith('C:');
    const rec = {
      id: 'YR' + Date.now(), date: f.date, time: f.time || hhmm(), ticketId: '', custId: c.id, walkIn: '',
      method: f.method, amount: amt, toType: toCreditor ? 'creditor' : f.to,
      creditorId: toCreditor ? f.to.slice(2) : '',
      toName: f.to === 'other' ? String(f.toName).trim() : '', ref: String(f.ref || '').trim(), remarks: String(f.remarks || '').trim(), by: actor.name,
    };
    set((st) => ({ db: { ...st.db, payments: st.db.payments.concat([rec]) }, modal: null }));
    toast(M(amt) + ' received from ' + c.name + ' by ' + METHOD_LABEL[f.method] + ' → ' + paidToLabel(rec, d.creditorName) + '.');
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
      ? { id: 'N' + Date.now(), ticket: 'WB-' + s.seq, dir: 'OUT', by: actor.name, method: 'Credit', roundOff: 0, payRemarks: '', walkIn: '', ...rec, time: rec.time || hhmm() }
      : null;
    const editedOrder = c.key === 'orders' && m.id ? { ...s.db.orders.find((o) => o.id === m.id), ...rec } : null;
    const okSave = set((st) => {
      const list = st.db[c.key] || [];
      if (m.id) return { db: { ...st.db, [c.key]: list.map((r) => (r.id === m.id ? { ...r, ...rec } : r)) }, modal: null };
      if (newOrder) return { db: { ...st.db, orders: [newOrder].concat(list) }, modal: null, seq: st.seq + 1 };
      const extra = c.key === 'customers' ? { code: nextCode(list, 'CP-', 3), received: 0, last: '—' }
          : c.key === 'creditors' ? { code: nextCode(list.filter((x) => x.kind === c.defaults.kind), c.defaults.kind === 'bunk' ? 'FB-' : 'SC-', 2), ...c.defaults }
          : c.key === 'crBills' ? { by: actor.name }
          : c.key === 'purchases' ? { batchId: '', by: actor.name }
          : c.key === 'materials' ? { code: 'MT-' + String(list.length + 1).padStart(2, '0'), unit: 'Ton' }
            : c.key === 'employees' ? { code: 'EM-' + String(list.length + 1).padStart(2, '0') } : {};
      return { db: { ...st.db, [c.key]: [{ id: 'N' + Date.now(), ...extra, ...rec }].concat(list) }, modal: null };
    });
    if (!okSave) return;
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
    if (c.key === 'crBills') { toast((m.cfgMod === 'fuelBills' ? 'Fuel entry ' : 'Purchase bill ') + (m.id ? 'updated' : 'saved') + ' for ' + d.creditor(rec.creditorId).name + '.'); return; }
    if (c.key === 'purchases') { toast('Soling load ' + (m.id ? 'updated' : 'saved') + (rec.supplierName ? ' for ' + rec.supplierName : '') + '.'); return; }
    toast(m.id ? (rec.name || rec.ticket || 'Record') + ' updated.' : (rec.name || (newOrder && newOrder.ticket) || 'Record') + ' created.');
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
      .concat((s.db.creditors || []).filter((c) => c.status !== 'Inactive').map((c) => ({ v: 'C:' + c.id, l: c.name + (c.kind === 'bunk' ? ' (fuel bunk)' : ' (spares)') })))
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
        : m.kind === 'stagedEdit' ? [
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'time', label: 'Time', type: 'time' },
          { k: 'serial', label: 'Serial' },
          { k: 'vehicle', label: 'Vehicle number' },
          ...(m.sale ? [
            { k: 'matId', label: 'Material', type: 'select', options: d.salesMaterials().map((x) => ({ v: x.id, l: x.name })) },
            ...(s.form.matId === OTHER_MATERIAL ? [{ k: 'matName', label: 'Material name' }] : []),
          ] : []),
          { k: 'empty', label: m.sale ? 'Empty truck / tare (kg)' : 'Empty truck (kg) — register Gross', type: 'number' },
          { k: 'loaded', label: m.sale ? 'Loaded truck / gross (kg)' : 'Loaded truck (kg) — register Net', type: 'number' },
          { k: 'rate', label: 'Rate (₹ per ton)', type: 'number', hint: m.sale ? 'Blank = the party rate card for this date' : 'Rate per ton for this load — needed before it can be saved' },
          ...(m.sale ? [] : [{ k: 'extra', label: 'Extra charges (₹)', type: 'number', hint: 'Rent, unloading — added to the load value' }]),
          { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
        ]
        : m.kind === 'opening' ? [
          { k: 'startDate', label: 'Balances as at the start of', type: 'date', span: 'span 2' },
          { k: 'cashStart', label: 'Cash in hand (₹)', type: 'number' },
          { k: 'bankStart', label: 'Bank & UPI balance (₹)', type: 'number' },
        ]
        : m.kind === 'crPay' ? [
          { k: 'amount', label: 'Amount paid (₹)', type: 'number', hint: (() => { const o = d.crOwed(d.creditor(m.id)); return o < -0.5 ? 'Already paid ahead ' + M(-o) : 'We owe ' + M(Math.max(0, o)); })() },
          { k: 'method', label: 'Method', type: 'select', options: RECEIPT_METHODS },
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'time', label: 'Time', type: 'time' },
          { k: 'ref', label: 'Reference / UTR / cheque no.', span: 'span 2' },
          { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
        ]
          : m.kind === 'report' ? [
            ...(m.creditorId ? [{ k: 'type', label: 'Report', type: 'select', options: [{ v: 'statement', l: 'Account statement (bills + payments)' }, { v: 'bills', l: d.creditor(m.creditorId).kind === 'bunk' ? 'Fuel taken' : 'Purchase bills' }, { v: 'payments', l: 'Payments made' }] }] : []),
            ...(m.custId ? [{ k: 'type', label: 'Report', type: 'select', options: [{ v: 'statement', l: 'Account statement (loads + payments)' }, { v: 'loads', l: 'Loads taken' }, { v: 'payments', l: 'Payment history' }] }] : []),
            ...(m.custId ? [{ k: 'copy', label: 'Copy for', type: 'select', options: [{ v: 'party', l: 'The party (hides who received payments)' }, { v: 'company', l: 'Company (shows who received payments)' }] }] : []),
            ...(m.listReport === 'daily'
              ? [{ k: 'fromDate', label: 'Day', type: 'date' }]
              : [...range(true), ...range(false)]),
            ...(m.listReport || m.creditorId ? [{ k: 'format', label: 'Download as', type: 'select', options: [{ v: 'pdf', l: 'PDF — to print or send' }, { v: 'xlsx', l: 'Excel — to work with the numbers' }] }] : []),
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
      calcLines: formCfg && formCfg.calc ? formCfg.calc(s.form)
        : m.kind === 'stagedEdit' ? (() => {
          const net = Math.max(0, (+s.form.loaded || 0) - (+s.form.empty || 0)) / 1000;
          if (m.sale) {
            const x = stagedDraft();
            const b = rowBill(d, x);
            return [
              { label: 'Net weight', value: T(net) + ' t' },
              { label: 'Rate', value: b.bill && net ? M(b.bill / net) + ' / t' : 'Not set' },
              { label: x.amount > 0 ? 'Bill (register amount)' : 'Bill (net tons × rate)', value: M(b.bill) },
            ];
          }
          const u = { date: s.form.date, manualRate: s.form.rate, tare: +s.form.empty || 0, gross: +s.form.loaded || 0, extra: s.form.extra };
          return [
            { label: 'Net boulders', value: T(net) + ' t' },
            { label: 'Rate (' + d.solRate(u).src + ')', value: M(d.solRate(u).rate) + ' / t' },
            { label: 'Load value', value: M(d.solValue(u)) },
          ];
        })() : null,
      onConfirm: {
        delete: doDelete, void: doVoid, receipt: postReceipt, rollback: () => { const ids = s.modal.ids; set({ modal: null }); rollback(ids); }, crPay: postCrPay, opening: saveOpening, stagedEdit: saveStagedEdit, rate: saveRate, endRate, report: makeReport,
        clearStaging: () => {
          set((st) => ({ db: { ...st.db, staging: [] }, modal: null }));
          toast('Pending rows removed.');
        },
      }[m.kind] || save,
      onClose: closeModal,
    };
  }

  if (!me) {
    const done = s.db.orders.filter((o) => o.status !== 'Void' && o.date === TODAY);
    const last = done.slice().sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')))[0];
    return (
      <Login
        users={users}
        requests={s.db.accessRequests || []}
        onSignIn={signIn}
        onCreateOwner={createOwner}
        onRequestAccess={requestAccess}
        reason={lockReason}
        lastTicket={last ? { ticket: last.ticket, time: last.time, vehicle: last.vehicle, material: d.matLabel(last), gross: last.gross || 0, tare: last.tare || 0 } : null}
        stats={[
          { value: T(done.reduce((a, o) => a + d.net(o), 0)) + ' t', label: 'Weighed today' },
          { value: N(done.length), label: 'Tickets today' },
          { value: N(s.db.onsite.length), label: 'On site now' },
        ]}
      />
    );
  }
  if (route === 'profile') return <Profile onSignOut={() => { window.location.hash = ''; signOut(); }} />;

  const meta = party
    ? { ...MODS.party, title: party.name, sub: [party.owner && 'Owner ' + party.owner, party.contact, party.address].filter(Boolean).join(' · ') || 'Customer — add owner, contact and address with Edit details.' }
    : cr ? { ...MODS.creditor, title: cr.name, sub: [cr.kind === 'bunk' ? 'Fuel bunk' : 'Spares company', cr.owner, cr.contact, cr.upi && 'UPI ' + cr.upi].filter(Boolean).join(' · ') }
        : MODS[s.mod] || MODS.dashboard;
  const atStation = ['weighbridge', 'dashboard', 'import'].includes(s.mod);
  const tabGroup = Object.keys(PAGE_GROUPS).find((g) => PAGE_GROUPS[g].includes(s.mod));
  const onRates = s.mod === 'party' || s.mod === 'stdrates';
  const filters = { q: s.q, status: s.status, from: s.from, to: s.to, sortK: s.sortK, sortDir: s.sortDir };
  const tonsToday = s.db.orders.filter((o) => o.status !== 'Void' && o.date === TODAY).reduce((a, o) => a + d.net(o), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: 14, letterSpacing: '-0.011em' }}>
      <div style={s.wide ? { display: 'flex', alignItems: 'stretch', minHeight: '100vh' } : { display: 'block' }}>
        <Sidebar wide={s.wide} mod={cr ? (cr.kind === 'bunk' ? 'bunks' : 'vendors') : (MODS[s.mod] && MODS[s.mod].navAs) || s.mod} onsiteCount={s.db.onsite.length} go={go} canOpen={(k) => canOpen(me, k)} me={me} pendingApprovals={(s.db.approvals || []).filter((a) => a.status === 'pending' && (me.role === 'owner' || a.userId === me.id)).length} onSignOut={() => signOut()} />

        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', containerType: 'inline-size', containerName: 'shell' }}>
          <Header
            meta={meta}
            scaleKg={N(s.scale)}
            onsite={String(s.db.onsite.length)}
            tons={T(tonsToday) + ' t'}
            now={s.now}
            onWeighbridge={() => go('weighbridge')}
            quickLabel={atStation ? 'Order book' : onRates ? 'Add rate period' : cr ? (cr.kind === 'bunk' ? 'Add fuel taken' : 'Add purchase bill') : s.mod === 'bunks' ? 'New fuel bunk' : s.mod === 'vendors' ? 'New spares company' : s.mod === 'daybook' ? 'Add expense' : s.mod === 'attendance' ? 'Give advance' : s.mod === 'customers' ? 'New customer' : s.mod === 'suppliers' ? 'New soling supplier' : 'New entry'}
            onQuick={atStation ? () => go('orders') : onRates ? () => openRate(party ? party.id : '', '') : cr ? () => openCrBill(cr) : s.mod === 'attendance' ? () => openAdvance('', '') : openAdd}
          />
          <main
            className="ag-main"
            style={{ padding: 'var(--space-6) var(--space-8) 72px', flex: '1 1 auto', minWidth: 0, containerType: 'inline-size', background: 'linear-gradient(180deg, #F8F4F4A9, #B0B0B0)' }}
          >
            {!canOpen(me, s.mod) && (
              <div className="ag-glass" style={{ padding: 'var(--space-6)' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>You do not have access to this page</div>
                <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>Ask the owner to give you this right under Staff &amp; access.</div>
              </div>
            )}
            {s.mod === 'access' && me.role === 'owner' && <Access db={s.db} me={me} onSaveUser={saveUser} onAccessRequest={decideAccessRequest} onSettings={saveAccessSettings} />}
            {s.mod === 'activity' && me.role === 'owner' && <Activity db={s.db} onRollback={(ids) => set({ modal: { kind: 'rollback', ids, title: 'Undo ' + ids.length + ' change(s)?', kicker: 'Activity', confirmLabel: 'Undo', message: 'The selected changes will be reversed, newest first. Anything changed by someone since is skipped. Items removed by the undo are deleted for good.' } })} />}
            {s.mod === 'approvals' && <Approvals db={s.db} me={me} onDecide={decideApproval} />}
            {s.mod === 'dashboard' && <Dashboard d={d} tab={s.dashTab} setTab={(t) => set({ dashTab: t })} go={go} onOpenParty={openParty} onReport={(day) => openPageReport('daily', { fromDate: day, toDate: day })} />}
            {party && (
              <PartyDetail
                showHistory={me.role === 'owner'}
                onDeleteAccount={() => askDelete(party, 'customers')}
                d={d}
                party={party}
                tab={s.partyTab}
                setTab={(t) => set({ partyTab: t })}
                onBack={() => go('customers')}
                onEdit={() => openEdit(party, 'customers')}
                onAddRate={(matId) => openRate(party.id, matId)}
                onEndRate={askEndRate}
                onDeleteRate={(card) => askDelete(card, 'rates')}
                onEditLoad={(o) => openEdit(o, 'orders')}
                onPayLoad={openTicketPay}
                onDeleteLoad={(o) => askDelete(o, 'orders')}
                onReceipt={() => openReceipt(party)}
                onAddLoad={() => openNewLoad(party.id)}
                onDeleteReceipt={(p) => askDelete(p, 'payments')}
                onReport={(type, range) => openReport(party.id, type, range)}
              />
            )}
            {s.mod === 'party' && !party && (
              <div className="ag-glass" style={{ padding: 'var(--space-6)' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>This customer no longer exists</div>
                <button type="button" className="btn btn-secondary" style={{ marginTop: 'var(--space-3)' }} onClick={() => go('customers')}>All customers</button>
              </div>
            )}
            {s.mod === 'import' && (
              <RegisterImport
                d={d}
                onFile={importFile}
                onParty={choosePartyForRow}
                onEditPay={editStagedPay}
                onRemove={removeStaged}
                onEdit={openStagedEdit}
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
                onUpdateWeights={updateOnsiteWeights}
                onConfirm={confirmOut}
                onVoid={askVoid}
                onCancel={cancelOut}
              />
            )}
            {tabGroup && (
              // Pages grouped under one sidebar item share a segmented control; each tab keeps its own content below it.
              <div className="ag-fade" style={{ marginBottom: 'var(--space-6)' }}>
                <Segmented
                  label={MODS[tabGroup].label}
                  value={s.mod}
                  onChange={go}
                  options={PAGE_GROUPS[tabGroup].filter((k) => canOpen(me, k)).map((k) => ({ v: k, l: TAB_LABEL[k] }))}
                />
              </div>
            )}
            {s.mod === 'attendance' && <Attendance d={d} P={P} onSave={saveAttendance} onAdvance={openAdvance} onReport={(date) => openPageReport('attendance', monthRange(date.slice(0, 7)))} />}
            {s.mod === 'eb' && (
              <Electricity
                d={d}
                onSaveReading={saveEbReading}
                onDeleteReading={(r) => askDelete(r, 'ebReadings')}
                onSaveBill={saveEbBill}
                onDeleteBill={(b) => askDelete(b, 'ebBills')}
                onReport={(month) => openPageReport('eb', monthRange(month))}
              />
            )}
            {(s.mod === 'bunks' || s.mod === 'vendors') && (
              <Creditors
                key={s.mod}
                d={d}
                kind={s.mod === 'bunks' ? 'bunk' : 'vendor'}
                onOpen={openCreditor}
                onAdd={openAdd}
                onReport={() => openReport('', 'statement', {}, { list: s.mod === 'bunks' ? 'fuel' : 'spares' })}
              />
            )}
            {cr && (
              <CreditorDetail
                key={cr.id}
                d={d}
                cr={cr}
                tab={s.creditorTab}
                setTab={(t) => set({ creditorTab: t })}
                onBack={() => go(cr.kind === 'bunk' ? 'bunks' : 'vendors')}
                onEdit={() => openEdit(cr, cr.kind === 'bunk' ? 'bunks' : 'vendors')}
                onAddBill={() => openCrBill(cr)}
                onEditBill={(b) => openEdit(b, cr.kind === 'bunk' ? 'fuelBills' : 'spareBills')}
                onDeleteBill={(b) => askDelete(b, 'crBills')}
                onPay={() => openCrPay(cr)}
                onDeletePay={(p) => askDelete(p, 'crPayments')}
                onOpenParty={openParty}
                onReport={(type, range) => openReport('', type, range, { creditorId: cr.id })}
              />
            )}
            {s.mod === 'creditor' && !cr && (
              <div className="ag-glass" style={{ padding: 'var(--space-6)' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>This account no longer exists</div>
                <button type="button" className="btn btn-secondary" style={{ marginTop: 'var(--space-3)' }} onClick={() => go('bunks')}>Fuel bunks</button>
              </div>
            )}
            {(s.mod === 'orders' || s.mod === 'purchases') && (
              // Orders and Soling share one page; each tab keeps its own list, filters and add button.
              <div className="ag-fade" style={{ marginBottom: 'var(--space-6)' }}>
                <Segmented label="Orders and soling" value={s.mod} onChange={go} options={[{ v: 'orders', l: 'Orders' }, { v: 'purchases', l: 'Soling' }].filter((o) => canOpen(me, o.v))} />
              </div>
            )}
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
                {...(s.mod === 'customers' ? { onReport: () => openReport('', 'statement'), reportLabel: 'All-customers report' } : {})}
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
          creditors={(s.db.creditors || []).filter((c) => c.status !== 'Inactive')}
          onSave={savePay}
          onClose={() => set({ payEdit: null })}
        />
      )}
      <Toast message={s.toast} />
    </div>
  );
}
