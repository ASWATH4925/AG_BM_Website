import { OTHER_MATERIAL } from './domain';
import { M, N, T } from './format';

export const NAV_GROUPS = ['Operations', 'Masters', 'Finance', 'People'];

export const MODS = {
  dashboard: { label: 'Dashboard', group: 'Operations', title: 'Operations overview', sub: 'Live position across the yard, the ledger and the payroll cycle.' },
  weighbridge: { label: 'Weighbridge', group: 'Operations', title: 'Weighbridge station', sub: 'Capture tare on entry, gross on exit. Net weight and price compute themselves.' },
  import: { label: 'Register Import', group: 'Operations', title: 'Register import', sub: 'Load the weighbridge register, check each row and record how it was paid.' },
  orders: { label: 'Orders', group: 'Operations', title: 'Orders & transactions', sub: 'Every sale, priced at net tons × the rate per ton in force on its date, with how it was paid.' },
  voids: { label: 'Void Orders', group: 'Operations', title: 'Void orders', sub: 'Cancelled loads and why they were cancelled.' },
  customers: { label: 'Credit Parties', group: 'Masters', title: 'Credit parties', sub: 'Everyone who takes material on credit — owner, address, contact and their own ton rates.' },
  suppliers: { label: 'Soling Suppliers', group: 'Masters', title: 'Soling suppliers', sub: 'Boulder suppliers we buy from and owe money to. Kept apart from credit parties.' },
  materials: { label: 'Materials', group: 'Masters', title: 'Materials', sub: 'What we sell and buy, and the standard rate per ton for each period.' },
  // Detail screens, reached from the lists above (not shown in the sidebar).
  party: { label: 'Credit Parties', group: 'Masters', title: 'Credit party', sub: '', hidden: true, navAs: 'customers' },
  stdrates: { label: 'Materials', group: 'Masters', title: 'Standard rates', sub: 'Rate per ton applied when a party has no rate of its own for that date.', hidden: true, navAs: 'materials' },
  payments: { label: 'Payments & Credit', group: 'Finance', title: 'Payments & credit', sub: 'Receipts, outstanding balances and ageing by account.' },
  expenses: { label: 'Expenses', group: 'Finance', title: 'Expenses', sub: 'Credit and debit entries against the yard.' },
  employees: { label: 'Employees', group: 'People', title: 'Employees', sub: 'Roster, roles and monthly salary.' },
  attendance: { label: 'Attendance', group: 'People', title: 'Attendance', sub: 'Shift marking and overtime hours feeding payroll.' },
  advances: { label: 'Advances', group: 'People', title: 'Employee advances', sub: 'Amounts paid ahead of salary and their recovery.' },
  payroll: { label: 'Payroll', group: 'People', title: 'Salary & payroll', sub: 'Attendance-based salary with advance deduction.' },
};

const opts = (a) => a.map((x) => ({ v: x, l: x }));

function uniqueName(list, f, id, what) {
  const n = String(f.name || '').trim().toLowerCase();
  return n && (list || []).some((x) => x.id !== id && x.name.trim().toLowerCase() === n) ? { name: what + ' with this name already exists.' } : {};
}

// Blank, a 10-digit mobile, or the same with a 91 / +91 prefix.
function checkContact(f) {
  const digits = String(f.contact || '').replace(/\D/g, '');
  return !digits || digits.length === 10 || (digits.length === 12 && digits.startsWith('91')) ? {} : { contact: 'Enter a 10-digit mobile number.' };
}

// Columns, form fields, filters and footers for each list module.
export function moduleConfig(mod, d) {
  const D = d.db;
  const co = () => D.customers.map((c) => ({ v: c.id, l: c.name }));
  const so = () => D.materials.filter((x) => x.kind !== 'purchase').map((x) => ({ v: x.id, l: x.name }));
  const eo = () => D.employees.map((e) => ({ v: e.id, l: e.name }));
  const linkedSupplier = (c) => (D.suppliers || []).find((p) => p.linkedCustId === c.id);

  if (mod === 'customers') return {
    key: 'customers', add: 'New credit party', statusKey: 'status', statuses: ['All', 'Active', 'On hold'],
    cols: [
      { k: 'code', label: 'Code' }, { k: 'name', label: 'Party' }, { k: 'owner', label: 'Owner' }, { k: 'contact', label: 'Contact' },
      { k: 'address', label: 'Address' }, { k: '_out', label: 'Outstanding', t: 'money', get: (c) => d.outstanding(c) },
      { k: '_rc', label: 'Own rates', t: 'num', get: (c) => D.rates.filter((r) => r.custId === c.id).length },
      { k: '_sp', label: 'Also supplies soling', get: (c) => (linkedSupplier(c) || {}).name || '' },
      { k: 'status', label: 'Status', t: 'tag' },
    ],
    rowAction: { label: 'Open', kind: 'party' },
    fields: [
      { k: 'name', label: 'Party name', req: 1, span: 'span 2' }, { k: 'owner', label: 'Owner name' },
      { k: 'contact', label: 'Contact number', placeholder: '98430 22417' }, { k: 'address', label: 'Address', span: 'span 2' },
      { k: 'gst', label: 'GSTIN' }, { k: 'status', label: 'Status', type: 'select', options: opts(['Active', 'On hold']) },
      { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
    ],
    validate: (f, id) => ({ ...uniqueName(D.customers, f, id, 'A credit party'), ...checkContact(f) }),
    foot: (rows) => 'Outstanding on filtered parties: ' + M(rows.reduce((s, c) => s + d.outstanding(c), 0)),
  };

  if (mod === 'suppliers') return {
    key: 'suppliers', add: 'New soling supplier', statusKey: 'status', statuses: ['All', 'Active', 'Inactive'],
    cols: [
      { k: 'code', label: 'Code' }, { k: 'name', label: 'Supplier' }, { k: 'owner', label: 'Owner' }, { k: 'contact', label: 'Contact' },
      { k: 'upi', label: 'UPI ID / number' }, { k: 'address', label: 'Address' },
      { k: '_lc', label: 'Also a credit party', get: (p) => (p.linkedCustId ? d.cust(p.linkedCustId).name : '') },
      { k: 'status', label: 'Status', t: 'tag' },
    ],
    fields: [
      { k: 'name', label: 'Supplier name', req: 1, span: 'span 2' }, { k: 'owner', label: 'Owner name' },
      { k: 'contact', label: 'Contact number', placeholder: '98430 22417' },
      { k: 'upi', label: 'UPI ID / number', hint: 'Where UPI payments to this supplier are sent' },
      { k: 'address', label: 'Address', span: 'span 2' },
      { k: 'linkedCustId', label: 'Same person as credit party', type: 'select', options: [{ v: '', l: 'Not linked' }].concat(co()), hint: 'Accounts stay separate; this only links them for reference' },
      { k: 'status', label: 'Status', type: 'select', options: opts(['Active', 'Inactive']) },
      { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
    ],
    validate: (f, id) => ({ ...uniqueName(D.suppliers, f, id, 'A soling supplier'), ...checkContact(f) }),
    foot: (rows) => rows.length + ' soling supplier(s) · purchases and what we owe them come with the soling module',
  };

  if (mod === 'materials') return {
    key: 'materials', add: 'New material', statusKey: 'status', statuses: ['All', 'Active', 'Paused'],
    cols: [
      { k: 'code', label: 'Code' }, { k: 'name', label: 'Material' }, { k: 'group', label: 'Group' },
      { k: '_k', label: 'We', get: (x) => (x.kind === 'purchase' ? 'Buy' : 'Sell') }, { k: 'unit', label: 'Priced per' },
      { k: '_r', label: 'Standard rate today / t', get: (x) => { const r = d.rateFor('', x.id).rate; return r ? M(r) : '—'; } },
      {
        k: '_rs', label: 'Rate since',
        get: (x) => {
          const r = d.rateFor('', x.id).card;
          if (r) return r.from;
          return x.id === OTHER_MATERIAL ? 'Entered per ticket' : x.kind === 'purchase' ? 'Set with soling purchases' : 'Not set';
        },
      },
      { k: 'status', label: 'Status', t: 'tag' },
    ],
    rowAction: { label: 'Rates', kind: 'stdrates' },
    fields: [
      { k: 'name', label: 'Material', req: 1, span: 'span 2' },
      { k: 'group', label: 'Group', type: 'select', options: opts(['Aggregate', 'Sand', 'Dust', 'Wedmix', 'Other', 'Purchase']) },
      { k: 'kind', label: 'We', type: 'select', options: [{ v: 'sale', l: 'Sell it' }, { v: 'purchase', l: 'Buy it' }] },
      { k: 'status', label: 'Status', type: 'select', options: opts(['Active', 'Paused']) },
    ],
    validate: (f, id) => uniqueName(D.materials, f, id, 'A material'),
    foot: (rows) => rows.filter((x) => x.kind !== 'purchase' && x.id !== OTHER_MATERIAL && !d.rateFor('', x.id).card).length + ' sold material(s) without a standard rate today',
  };

  if (mod === 'orders' || mod === 'voids') {
    const isVoid = mod === 'voids';
    return {
      key: 'orders', add: isVoid ? 'File a void' : 'Manual order entry', dateKey: 'date',
      statusKey: 'status', statuses: isVoid ? ['All', 'Void'] : ['All', 'In Transit', 'Completed', 'Void'],
      only: isVoid ? (o) => o.status === 'Void' : (o) => o.status !== 'Void',
      cols: isVoid
        ? [
            { k: 'ticket', label: 'Ticket' }, { k: 'date', label: 'Date' }, { k: '_c', label: 'Party', get: (o) => d.partyLabel(o) },
            { k: '_m', label: 'Material', get: (o) => d.matLabel(o) }, { k: 'vehicle', label: 'Vehicle' }, { k: 'reason', label: 'Reason' },
            { k: 'by', label: 'Voided by' }, { k: 'status', label: 'Status', t: 'tag' },
          ]
        : [
            { k: 'ticket', label: 'Ticket' }, { k: 'date', label: 'Date' }, { k: '_c', label: 'Party', get: (o) => d.partyLabel(o) },
            { k: '_m', label: 'Material', get: (o) => d.matLabel(o) }, { k: 'vehicle', label: 'Vehicle' },
            { k: '_n', label: 'Net (t)', t: 'num2', get: (o) => d.net(o) }, { k: '_r', label: 'Rate / t', t: 'money', get: (o) => d.orderRate(o).rate },
            { k: '_a', label: 'Amount', t: 'money', get: (o) => d.amount(o) },
            { k: '_p', label: 'Paid', t: 'money', get: (o) => (d.paymentsFor(o.id).length ? d.paidOn(o) : d.onCredit(o) ? 0 : d.amount(o)) },
            { k: '_oc', label: 'On credit', t: 'money', get: (o) => d.onCredit(o) },
            { k: 'method', label: 'Payment' }, { k: 'status', label: 'Status', t: 'tag' },
          ],
      rowAction: isVoid ? undefined : { label: 'Payment', kind: 'pay' },
      fields: [
        { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'custId', label: 'Credit party', type: 'select', options: co(), req: 1 },
        { k: 'matId', label: 'Material', type: 'select', options: so(), req: 1 },
        { k: 'matName', label: 'Material name', hint: 'Only for Other — type what was loaded' },
        { k: 'vehicle', label: 'Vehicle number', req: 1 },
        { k: 'tare', label: 'Tare weight (kg)', type: 'number', req: 1 }, { k: 'gross', label: 'Gross weight (kg)', type: 'number', req: 1 },
        { k: 'manualRate', label: 'Manual rate (₹ / ton)', type: 'number', hint: 'Leave blank to use the rate card for this date. Payment is recorded after saving.' },
        { k: 'status', label: 'Status', type: 'select', options: opts(['Completed', 'In Transit', 'Void']) },
        { k: 'reason', label: 'Void reason', span: 'span 2', hint: 'Required when the status is Void' },
        { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
      ],
      validate: (f) => {
        const e = {};
        if (f.status === 'Void' && !String(f.reason || '').trim()) e.reason = 'A void needs a reason.';
        if (+f.gross && +f.tare && +f.gross <= +f.tare) e.gross = 'Gross must exceed tare.';
        if (f.matId === OTHER_MATERIAL && !String(f.matName || '').trim()) e.matName = 'Type the material name for Other.';
        const manual = String(f.manualRate ?? '').trim();
        if (manual && !(+manual > 0)) e.manualRate = 'Enter a rate greater than zero, or leave it blank.';
        else if (!manual && f.matId && f.date && !d.rateFor(f.custId, f.matId, f.date).rate) e.manualRate = 'No rate card covers this date — enter a manual rate.';
        return e;
      },
      calc: (f) => {
        const o = { custId: f.custId, matId: f.matId, date: f.date, manualRate: f.manualRate, tare: +f.tare || 0, gross: +f.gross || 0 };
        const r = d.orderRate(o);
        return [
          { label: 'Net weight', value: T(d.net(o)) + ' t' },
          { label: 'Rate (' + r.src + ')', value: M(r.rate) + ' / t' },
          { label: 'Amount (net tons × rate)', value: M(d.amount(o)) },
        ];
      },
      foot: (rows) => (isVoid
        ? rows.length + ' voided load(s) · ' + T(rows.reduce((s, o) => s + d.net(o), 0)) + ' t'
        : 'Filtered tonnage ' + T(rows.reduce((s, o) => s + d.net(o), 0)) + ' t · value ' + M(rows.reduce((s, o) => s + d.amount(o), 0))),
    };
  }

  if (mod === 'payments') return {
    key: 'customers', add: 'Record receipt', statusKey: '_ag', statuses: ['All', 'Clear', 'Due'],
    cols: [
      { k: 'name', label: 'Credit party' }, { k: '_b', label: 'Billed', t: 'money', get: (c) => d.billed(c) }, { k: 'received', label: 'Received', t: 'money' },
      { k: '_out', label: 'Outstanding', t: 'money', get: (c) => d.outstanding(c) },
      { k: 'last', label: 'Last receipt' },
      { k: '_ag', label: 'Standing', t: 'tag', get: (c) => (d.outstanding(c) === 0 ? 'Clear' : 'Due') },
    ],
    rowAction: { label: 'Receipt', kind: 'receipt' },
    fields: [
      { k: 'name', label: 'Party name', req: 1, span: 'span 2' },
      { k: 'received', label: 'Total received', type: 'number' }, { k: 'last', label: 'Last receipt', type: 'date' },
    ],
    foot: (rows) => 'Total outstanding: ' + M(rows.reduce((s, c) => s + d.outstanding(c), 0)),
  };

  if (mod === 'expenses') return {
    key: 'expenses', add: 'New entry', dateKey: 'date', statusKey: 'type', statuses: ['All', 'Debit', 'Credit'],
    cols: [
      { k: 'date', label: 'Date' }, { k: 'head', label: 'Head' }, { k: 'desc', label: 'Description' }, { k: 'type', label: 'Cr / Dr', t: 'tag' },
      { k: 'amount', label: 'Amount', t: 'money' }, { k: 'mode', label: 'Mode' }, { k: 'party', label: 'Paid to / from' },
    ],
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'head', label: 'Expense head', req: 1 }, { k: 'desc', label: 'Description', span: 'span 2' },
      { k: 'type', label: 'Credit / Debit', type: 'select', options: opts(['Debit', 'Credit']) }, { k: 'amount', label: 'Amount', type: 'number', req: 1 },
      { k: 'mode', label: 'Mode', type: 'select', options: opts(['Cash', 'UPI', 'Bank Transfer', 'Credit']) }, { k: 'party', label: 'Paid to / received from' },
    ],
    foot: (rows) => {
      const dr = rows.filter((x) => x.type === 'Debit').reduce((s, x) => s + x.amount, 0);
      const cr = rows.filter((x) => x.type === 'Credit').reduce((s, x) => s + x.amount, 0);
      return 'Debit ' + M(dr) + ' · Credit ' + M(cr) + ' · Net ' + M(dr - cr);
    },
  };

  if (mod === 'employees') return {
    key: 'employees', add: 'New employee', statusKey: 'status', statuses: ['All', 'Active', 'On leave'],
    cols: [
      { k: 'code', label: 'Code' }, { k: 'name', label: 'Name' }, { k: 'role', label: 'Role' }, { k: 'phone', label: 'Phone' }, { k: 'joined', label: 'Joined' },
      { k: 'salary', label: 'Monthly salary', t: 'money' }, { k: '_ab', label: 'Advance balance', t: 'money', get: (e) => d.advanceBalance(e.id, false) },
      { k: 'status', label: 'Status', t: 'tag' },
    ],
    fields: [
      { k: 'name', label: 'Name', req: 1, span: 'span 2' }, { k: 'role', label: 'Role', req: 1 }, { k: 'phone', label: 'Phone', req: 1 },
      { k: 'joined', label: 'Joined on', type: 'date' }, { k: 'salary', label: 'Monthly salary', type: 'number', req: 1 },
      { k: 'status', label: 'Status', type: 'select', options: opts(['Active', 'On leave']) },
    ],
    foot: (rows) => 'Monthly wage bill: ' + M(rows.reduce((s, e) => s + e.salary, 0)),
  };

  if (mod === 'attendance') return {
    key: 'attendance', add: 'Mark attendance', dateKey: 'date', statusKey: 'status', statuses: ['All', 'Present', 'Absent', 'Half day', 'Leave'],
    cols: [
      { k: 'date', label: 'Date' }, { k: '_e', label: 'Employee', get: (a) => d.emp(a.empId).name }, { k: 'shift', label: 'Shift' }, { k: 'in', label: 'In' },
      { k: 'out', label: 'Out' }, { k: '_h', label: 'Hours', t: 'num2', get: (a) => d.hours(a) }, { k: 'ot', label: 'OT hrs', t: 'num' }, { k: 'status', label: 'Status', t: 'tag' },
    ],
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'empId', label: 'Employee', type: 'select', options: eo(), req: 1 },
      { k: 'shift', label: 'Shift', type: 'select', options: opts(['Day A', 'Day B', 'General', 'Night']) },
      { k: 'in', label: 'In time', placeholder: '07:50' }, { k: 'out', label: 'Out time', placeholder: '18:00' },
      { k: 'ot', label: 'Overtime hours', type: 'number' }, { k: 'status', label: 'Status', type: 'select', options: opts(['Present', 'Absent', 'Half day', 'Leave']) },
    ],
    foot: (rows) => 'Man-hours ' + T(rows.reduce((s, a) => s + d.hours(a), 0)) + ' · OT ' + N(rows.reduce((s, a) => s + (+a.ot || 0), 0)) + ' hrs',
  };

  if (mod === 'advances') return {
    key: 'advances', add: 'New advance', dateKey: 'date', statusKey: 'status', statuses: ['All', 'Open', 'Recovering', 'Cleared'],
    cols: [
      { k: 'date', label: 'Date' }, { k: '_e', label: 'Employee', get: (a) => d.emp(a.empId).name }, { k: 'amount', label: 'Advance', t: 'money' },
      { k: 'reason', label: 'Reason' }, { k: 'recovered', label: 'Recovered', t: 'money' }, { k: '_b', label: 'Balance', t: 'money', get: (a) => a.amount - a.recovered },
      { k: 'status', label: 'Status', t: 'tag' },
    ],
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'empId', label: 'Employee', type: 'select', options: eo(), req: 1 },
      { k: 'amount', label: 'Advance amount', type: 'number', req: 1 }, { k: 'reason', label: 'Reason', span: 'span 2' },
      { k: 'recovered', label: 'Recovered so far', type: 'number' }, { k: 'status', label: 'Status', type: 'select', options: opts(['Open', 'Recovering', 'Cleared']) },
    ],
    foot: (rows) => 'Outstanding advances: ' + M(rows.reduce((s, a) => s + (a.amount - a.recovered), 0)),
  };

  if (mod === 'payroll') return {
    key: 'payroll', add: 'Run payroll line', statusKey: 'status', statuses: ['All', 'Paid', 'Pending'],
    cols: [
      { k: '_e', label: 'Employee', get: (p) => d.emp(p.empId).name }, { k: 'month', label: 'Cycle' }, { k: 'days', label: 'Days present', t: 'num' },
      { k: 'ot', label: 'OT hrs', t: 'num' }, { k: '_b', label: 'Earned base', t: 'money', get: (p) => d.payLine(p).base },
      { k: '_o', label: 'OT pay', t: 'money', get: (p) => d.payLine(p).ot }, { k: '_d', label: 'Advance deducted', t: 'money', get: (p) => d.payLine(p).ded },
      { k: '_n', label: 'Net payable', t: 'money', get: (p) => d.payLine(p).net }, { k: 'status', label: 'Status', t: 'tag' },
    ],
    fields: [
      { k: 'empId', label: 'Employee', type: 'select', options: eo(), req: 1 }, { k: 'month', label: 'Cycle (YYYY-MM)', req: 1, placeholder: '2026-09' },
      { k: 'days', label: 'Days present', type: 'number', req: 1, hint: 'Out of a 26-day cycle' }, { k: 'ot', label: 'Overtime hours', type: 'number' },
      { k: 'status', label: 'Status', type: 'select', options: opts(['Pending', 'Paid']) },
    ],
    calc: (f) => {
      const p = d.payLine({ empId: f.empId, days: +f.days || 0, ot: +f.ot || 0 });
      return [
        { label: 'Earned base', value: M(p.base) },
        { label: 'Overtime at 1.5×', value: M(p.ot) },
        { label: 'Advance deduction', value: '− ' + M(p.ded) },
        { label: 'Net payable', value: M(p.net) },
      ];
    },
    foot: (rows) => 'Payroll due: ' + M(rows.filter((p) => p.status !== 'Paid').reduce((s, p) => s + d.payLine(p).net, 0)),
  };

  return null;
}

// Summary tiles shown above each list module, computed from the filtered rows.
export function listKpis(mod, rows, d) {
  const D = d.db;
  const sum = (list, fn) => list.reduce((a, x) => a + fn(x), 0);
  const debit = () => sum(rows.filter((x) => x.type === 'Debit'), (x) => x.amount);
  const credit = () => sum(rows.filter((x) => x.type === 'Credit'), (x) => x.amount);
  const K = {
    orders: () => [
      { label: 'Filtered tonnage', value: T(sum(rows, d.net)) + ' t', note: rows.length + ' tickets' },
      { label: 'Material value', value: M(sum(rows, d.amount)), note: 'Before charges and GST' },
      { label: 'On credit', value: M(sum(rows, d.onCredit)), note: rows.filter((o) => d.onCredit(o) > 0).length + ' of ' + rows.length + ' tickets' },
      { label: 'Open in transit', value: String(rows.filter((o) => o.status === 'In Transit').length), note: 'Awaiting delivery confirmation' },
    ],
    payments: () => [
      { label: 'Billed', value: M(sum(rows, d.billed)), note: 'Credit tickets, filtered parties' },
      { label: 'Received', value: M(sum(rows, (x) => x.received)), note: 'Cash, UPI and transfers' },
      { label: 'Outstanding', value: M(sum(rows, d.outstanding)), note: rows.filter((x) => d.outstanding(x) > 0).length + ' parties' },
    ],
    voids: () => [
      { label: 'Voided loads', value: String(rows.length), note: 'Filtered period' },
      { label: 'Tonnage reversed', value: T(sum(rows, (o) => (o.load || 0) / 1000)) + ' t', note: 'Returned to stock' },
    ],
    expenses: () => [
      { label: 'Debit', value: M(debit()), note: 'Money out' },
      { label: 'Credit', value: M(credit()), note: 'Money in' },
      { label: 'Net burn', value: M(debit() - credit()), note: 'Filtered range' },
    ],
    payroll: () => [
      { label: 'Gross payable', value: M(sum(rows, (p) => d.payLine(p).base + d.payLine(p).ot)), note: 'Base plus overtime' },
      { label: 'Advance recovery', value: M(sum(rows, (p) => d.payLine(p).ded)), note: 'Deducted this cycle' },
      { label: 'Net payable', value: M(sum(rows, (p) => d.payLine(p).net)), note: rows.length + ' payroll lines' },
      { label: 'Still pending', value: M(sum(rows.filter((p) => p.status !== 'Paid'), (p) => d.payLine(p).net)), note: rows.filter((p) => p.status !== 'Paid').length + ' unpaid' },
    ],
    customers: () => [
      { label: 'Credit parties', value: String(rows.length), note: rows.filter((x) => x.status === 'On hold').length + ' on hold' },
      { label: 'Outstanding', value: M(sum(rows, d.outstanding)), note: rows.filter((x) => d.outstanding(x) > 0).length + ' parties owe us' },
      { label: 'With their own rates', value: String(rows.filter((x) => D.rates.some((r) => r.custId === x.id)).length), note: 'Others pay the standard rate' },
      { label: 'Details missing', value: String(rows.filter((x) => !x.owner || !x.contact || !x.address).length), note: 'No owner, contact or address yet' },
    ],
    suppliers: () => [
      { label: 'Soling suppliers', value: String(rows.length), note: rows.filter((x) => x.status !== 'Active').length + ' inactive' },
      { label: 'With UPI details', value: String(rows.filter((x) => x.upi).length), note: 'Needed for UPI payments' },
      { label: 'Also credit parties', value: String(rows.filter((x) => x.linkedCustId).length), note: 'Separate accounts, linked' },
    ],
    materials: () => [
      { label: 'Materials', value: String(rows.length), note: rows.filter((x) => x.status === 'Paused').length + ' paused' },
      { label: 'We sell', value: String(rows.filter((x) => x.kind !== 'purchase').length), note: 'Priced per ton' },
      { label: 'We buy', value: String(rows.filter((x) => x.kind === 'purchase').length), note: 'Soling (boulder)' },
    ],
    employees: () => [
      { label: 'Headcount', value: String(rows.length), note: rows.filter((x) => x.status !== 'Active').length + ' on leave' },
      { label: 'Monthly wage bill', value: M(sum(rows, (x) => x.salary)), note: 'At full attendance' },
      { label: 'Advances outstanding', value: M(sum(D.advances, (x) => x.amount - x.recovered)), note: 'Recoverable from salary' },
    ],
    attendance: () => [
      { label: 'Present', value: String(rows.filter((x) => x.status === 'Present').length), note: 'Filtered rows' },
      { label: 'Absent / leave', value: String(rows.filter((x) => x.status === 'Absent' || x.status === 'Leave').length), note: 'Deducted from payroll' },
      { label: 'Overtime', value: N(sum(rows, (x) => +x.ot || 0)) + ' hrs', note: 'Paid at 1.5×' },
    ],
    advances: () => [
      { label: 'Advanced', value: M(sum(rows, (x) => x.amount)), note: rows.length + ' entries' },
      { label: 'Recovered', value: M(sum(rows, (x) => x.recovered)), note: 'Against salary' },
      { label: 'Balance', value: M(sum(rows, (x) => x.amount - x.recovered)), note: 'Still to recover' },
    ],
  };
  return (K[mod] || (() => []))();
}
