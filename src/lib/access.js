// Who may do what, and a record of every change.
// The owner can do everything. Each staff member has a level for each task:
//   'allow'   – does it straight away
//   'approve' – the change waits in the owner's Approvals inbox
//   'deny'    – not allowed (pages for denied "view" tasks are hidden)
// Every change to the books is compared before/after and kept as an activity entry, so the owner
// can see who changed what, approve it later, or roll a staff member's work back.

export const TASKS = [
  { group: 'Weighbridge & register', items: [
    { k: 'weighbridge', l: 'Weighbridge entry (tare, weigh-out, void at the bridge)' },
    { k: 'import.upload', l: 'Register import — load the register file' },
    { k: 'import.process', l: 'Register import — check rows and post them to parties’ accounts' },
  ] },
  { group: 'Customers', items: [
    { k: 'parties.view', l: 'See customers and their accounts', view: true },
    { k: 'parties.edit', l: 'Change a customer’s account — details, loads, rates' },
    { k: 'payments.record', l: 'Record payments received from parties' },
    { k: 'parties.delete', l: 'Delete a customer account', ownerGate: true },
  ] },
  // The keys keep their old `suppliers.` names so staff rights saved before suppliers were removed still apply.
  { group: 'Soling loads', items: [
    { k: 'suppliers.view', l: 'See soling loads', view: true },
    { k: 'suppliers.edit', l: 'Add or change soling loads' },
  ] },
  { group: 'Electricity', items: [
    { k: 'eb.daily', l: 'Daily EB reading' },
    { k: 'eb.month', l: 'Month-end EB bill and Thar plant' },
  ] },
  { group: 'Workers', items: [
    { k: 'attendance.mark', l: 'Mark today’s attendance' },
    { k: 'attendance.editPast', l: 'Change attendance of past days' },
    { k: 'workers', l: 'Add or change workers and daily wages' },
    { k: 'advances', l: 'Salary account — give advances' },
  ] },
  { group: 'Money & other accounts', items: [
    { k: 'fuel', l: 'Fuel bunks and spares companies' },
    { k: 'daybook', l: 'Other expenses and income (Finances › Other)' },
    { k: 'rates', l: 'Materials and standard rates' },
    { k: 'reports', l: 'Generate reports', view: true },
  ] },
];
export const TASK_LIST = TASKS.flatMap((g) => g.items);
export const taskLabel = (k) => (TASK_LIST.find((t) => t.k === k) || { l: k }).l;
export const LEVELS = [
  { v: 'allow', l: 'Allowed' },
  { v: 'approve', l: 'Needs approval' },
  { v: 'deny', l: 'Not allowed' },
];

const all = (level) => Object.fromEntries(TASK_LIST.map((t) => [t.k, level]));
export const TEMPLATES = {
  operator: {
    l: 'Weighbridge operator',
    perms: {
      ...all('deny'),
      weighbridge: 'allow', 'import.upload': 'allow', 'import.process': 'approve', 'parties.view': 'allow', 'payments.record': 'allow',
      'eb.daily': 'allow', 'attendance.mark': 'allow', 'attendance.editPast': 'approve', advances: 'approve',
      'parties.delete': 'approve',
    },
  },
  accountant: {
    l: 'Accountant',
    perms: {
      ...all('allow'),
      'parties.delete': 'approve', 'attendance.editPast': 'approve', rates: 'approve',
    },
  },
  viewer: { l: 'View only', perms: { ...all('deny'), 'parties.view': 'allow', 'suppliers.view': 'allow', reports: 'allow', 'parties.delete': 'approve' } },
};

// Deleting a customer account can never be fully delegated; "view" tasks are simply on or off.
export const levelOf = (user, k) => {
  if (!user) return 'deny';
  if (user.role === 'owner') return 'allow';
  const t = TASK_LIST.find((x) => x.k === k);
  const v = (user.perms || {})[k] || 'deny';
  if (t && t.ownerGate && v === 'allow') return 'approve';
  if (t && t.view && v === 'approve') return 'allow';
  return v;
};
const RANK = { allow: 0, approve: 1, deny: 2 };
export const strictest = (user, keys) => keys.reduce((acc, k) => {
  const v = levelOf(user, k);
  return RANK[v] > RANK[acc] ? v : acc;
}, 'allow');

// Pages and the task that lets someone open them.
export const PAGE_TASK = {
  weighbridge: 'weighbridge', import: 'import.upload', orders: 'parties.view', purchases: 'suppliers.view', eb: 'eb.daily',
  customers: 'parties.view', party: 'parties.view',
  materials: 'rates', stdrates: 'rates', bunks: 'fuel', vendors: 'fuel', creditor: 'fuel', expenses: 'daybook',
  employees: 'workers', attendance: 'attendance.mark', advances: 'advances',
};
export const OWNER_PAGES = ['access', 'activity'];
// Sidebar pages made of tabs (a segmented control). Each opens for anyone who may open at least one of its tabs.
export const PAGE_GROUPS = {
  finances: ['bunks', 'vendors', 'expenses'],
  people: ['attendance', 'employees', 'advances'],
};
export const canOpen = (user, mod) => {
  if (!user) return false;
  if (user.role === 'owner') return true;
  if (OWNER_PAGES.includes(mod)) return false;
  if (PAGE_GROUPS[mod]) return PAGE_GROUPS[mod].some((t) => canOpen(user, t));
  const k = PAGE_TASK[mod];
  return !k || levelOf(user, k) !== 'deny';
};

// ---- comparing the books before and after an action ----
const SKIP = new Set(['audit', 'approvals', 'users', 'accessRequests']);
const idOf = (coll, r) => (coll === 'staging' ? r.key : r.id);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function diffDb(before, after) {
  const ops = [];
  Object.keys(after).forEach((coll) => {
    if (SKIP.has(coll) || before[coll] === after[coll]) return;
    const a = before[coll];
    const b = after[coll];
    if (!Array.isArray(b) || !Array.isArray(a)) {
      if (!same(a, b)) ops.push({ coll, op: 'set', before: a, after: b });
      return;
    }
    const old = new Map(a.map((r) => [idOf(coll, r), r]));
    const now = new Map(b.map((r) => [idOf(coll, r), r]));
    now.forEach((r, id) => {
      if (!old.has(id)) ops.push({ coll, op: 'add', id, after: r });
      else if (old.get(id) !== r && !same(old.get(id), r)) ops.push({ coll, op: 'upd', id, before: old.get(id), after: r });
    });
    old.forEach((r, id) => { if (!now.has(id)) ops.push({ coll, op: 'del', id, before: r }); });
  });
  return ops;
}

// Which tasks a set of changes needs. today = 'YYYY-MM-DD'.
export function tasksFor(ops, today) {
  const keys = new Set();
  const has = (coll, op) => ops.some((o) => o.coll === coll && (!op || o.op === op));
  const fromImport = has('staging', 'del') && (has('orders', 'add') || has('purchases', 'add'));
  const fromBridge = has('onsite');
  const newLoad = has('orders', 'add');
  ops.forEach((o) => {
    const r = o.after || o.before || {};
    switch (o.coll) {
      case 'customers': keys.add(o.op === 'del' ? 'parties.delete' : 'parties.edit'); break;
      case 'orders': keys.add(fromImport ? 'import.process' : fromBridge ? 'weighbridge' : 'parties.edit'); break;
      case 'payments':
        if (fromImport) keys.add('import.process');
        else if (fromBridge) keys.add('weighbridge');
        else if (newLoad) keys.add('parties.edit');
        else keys.add(o.op === 'add' ? 'payments.record' : 'parties.edit');
        break;
      case 'purchases': keys.add(fromImport ? 'import.process' : 'suppliers.edit'); break;
      case 'staging': keys.add(o.op === 'del' ? 'import.process' : 'import.upload'); break;
      case 'imports': keys.add('import.upload'); break;
      case 'onsite': keys.add('weighbridge'); break;
      case 'rates': keys.add(r.custId ? 'parties.edit' : 'rates'); break;
      case 'materials': keys.add('rates'); break;
      case 'attendance': keys.add(r.date && r.date < today ? 'attendance.editPast' : 'attendance.mark'); break;
      case 'employees': keys.add('workers'); break;
      case 'advances': keys.add('advances'); break;
      case 'payroll': keys.add('advances'); break; // past salary payments, now under the Salary account
      case 'creditors': case 'crBills': case 'crPayments': keys.add('fuel'); break;
      case 'expenses': case 'settings': keys.add('daybook'); break;
      case 'ebReadings': keys.add('eb.daily'); break;
      case 'ebBills': keys.add('eb.month'); break;
      default: break;
    }
  });
  return [...keys];
}

// ---- applying, checking and reversing recorded changes ----
const findIdx = (list, coll, id) => list.findIndex((r) => idOf(coll, r) === id);

// Records that no longer look the way a change expects (someone changed them since).
// reverse = true checks a roll-back instead of a fresh apply.
export function conflicts(db, ops, reverse) {
  return ops.filter((o) => {
    if (o.op === 'set') return false;
    const list = db[o.coll] || [];
    const cur = list[findIdx(list, o.coll, o.id)];
    if (!reverse) {
      if (o.op === 'add') return !!cur;
      return !cur || !same(cur, o.before);
    }
    if (o.op === 'add') return cur && !same(cur, o.after);
    if (o.op === 'del') return !!cur;
    return !cur || !same(cur, o.after);
  });
}

export function applyOps(db, ops) {
  const next = { ...db };
  ops.forEach((o) => {
    if (o.op === 'set') { next[o.coll] = o.after; return; }
    const list = (next[o.coll] || []).slice();
    const i = findIdx(list, o.coll, o.id);
    if (o.op === 'add') { if (i < 0) list.unshift(o.after); else list[i] = o.after; }
    if (o.op === 'upd') { if (i >= 0) list[i] = o.after; else list.unshift(o.after); }
    if (o.op === 'del' && i >= 0) list.splice(i, 1);
    next[o.coll] = list;
  });
  return next;
}

export function inverseOps(ops) {
  return ops.slice().reverse().map((o) => (
    o.op === 'add' ? { coll: o.coll, op: 'del', id: o.id, before: o.after }
      : o.op === 'del' ? { coll: o.coll, op: 'add', id: o.id, after: o.before }
        : o.op === 'upd' ? { coll: o.coll, op: 'upd', id: o.id, before: o.after, after: o.before }
          : { coll: o.coll, op: 'set', before: o.after, after: o.before }
  ));
}

// ---- plain-language description of a change ----
export const NOUN = {
  customers: 'customer', orders: 'load', payments: 'payment', purchases: 'soling load',
  staging: 'register row', imports: 'register file', onsite: 'vehicle on the bridge', rates: 'rate period',
  materials: 'material', attendance: 'attendance mark', employees: 'worker', advances: 'advance', payroll: 'salary payment', creditors: 'bunk / spares account',
  crBills: 'fuel / purchase bill', crPayments: 'payment to bunk / company', expenses: 'expense', settings: 'opening balances', ebReadings: 'EB reading',
  ebBills: 'EB month end',
};
const VERB = { add: 'Added', upd: 'Changed', del: 'Removed', set: 'Changed' };
const nameOf = (r) => r.name || r.ticket || r.serial || r.billNo || r.label || (+r.amount ? '₹' + (+r.amount).toLocaleString('en-IN') : '') || r.date || r.month || '';

export function describe(ops) {
  const meaningful = ops.filter((o) => o.coll !== 'voided'); // archive from older saves
  const groups = {};
  meaningful.forEach((o) => { const k = o.op + ':' + o.coll; (groups[k] = groups[k] || []).push(o); });
  const parts = Object.entries(groups).map(([k, list]) => {
    const [op, coll] = k.split(':');
    const noun = NOUN[coll] || coll;
    if (list.length > 1) return VERB[op] + ' ' + list.length + ' ' + noun + (noun.endsWith('s') ? '' : 's');
    const r = list[0].after || list[0].before || {};
    return VERB[op] + ' ' + noun + (nameOf(r) ? ' ' + nameOf(r) : '');
  });
  return parts.join(' · ') || 'No change';
}

// Field-by-field differences of one changed record, for the History view.
export function fieldChanges(o) {
  if (o.op !== 'upd' || !o.before || !o.after) return [];
  return Object.keys({ ...o.before, ...o.after })
    .filter((k) => !['by', 'pay'].includes(k) && !same(o.before[k], o.after[k]))
    .map((k) => ({ field: k, from: o.before[k], to: o.after[k] }));
}

// Does a change touch this customer's account?
export function touches(o, { custId }) {
  const r = o.after || o.before || {};
  if (custId) return (o.coll === 'customers' && o.id === custId) || r.custId === custId;
  return false;
}

// ---- passwords and PINs (stored only as salted hashes) ----
export async function hashSecret(secret, salt) {
  const data = new TextEncoder().encode(salt + ':' + secret);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const newSalt = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
