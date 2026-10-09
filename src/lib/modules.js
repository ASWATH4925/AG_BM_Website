import { M, N, T } from './format';

export const NAV_GROUPS = ['Operations', 'Masters', 'Finance', 'People'];

export const MODS = {
  dashboard: { label: 'Dashboard', group: 'Operations', title: 'Operations overview', sub: 'Live position across the yard, the ledger and the payroll cycle.' },
  weighbridge: { label: 'Weighbridge', group: 'Operations', title: 'Weighbridge station', sub: 'Capture tare on entry, gross on exit. Net weight and price compute themselves.' },
  orders: { label: 'Orders', group: 'Operations', title: 'Orders & transactions', sub: 'Every weighed movement, priced from the customer’s rate card.' },
  voids: { label: 'Void Orders', group: 'Operations', title: 'Void orders', sub: 'Cancelled loads and the loading charges retained against them.' },
  customers: { label: 'Customers', group: 'Masters', title: 'Customers', sub: 'Accounts, credit limits and site contacts.' },
  materials: { label: 'Materials', group: 'Masters', title: 'Materials', sub: 'Products, list rates and stock on ground.' },
  rates: { label: 'Rate Cards', group: 'Masters', title: 'Customer material rates', sub: 'Contract rates that override the list rate at the weighbridge.' },
  payments: { label: 'Payments & Credit', group: 'Finance', title: 'Payments & credit', sub: 'Receipts, outstanding balances and ageing by account.' },
  expenses: { label: 'Expenses', group: 'Finance', title: 'Expenses', sub: 'Credit and debit entries against the yard.' },
  employees: { label: 'Employees', group: 'People', title: 'Employees', sub: 'Roster, roles and monthly salary.' },
  attendance: { label: 'Attendance', group: 'People', title: 'Attendance', sub: 'Shift marking and overtime hours feeding payroll.' },
  advances: { label: 'Advances', group: 'People', title: 'Employee advances', sub: 'Amounts paid ahead of salary and their recovery.' },
  payroll: { label: 'Payroll', group: 'People', title: 'Salary & payroll', sub: 'Attendance-based salary with advance deduction.' },
};

const opts = (a) => a.map((x) => ({ v: x, l: x }));

// Columns, form fields, filters and footers for each list module.
export function moduleConfig(mod, d) {
  const D = d.db;
  const co = () => D.customers.map((c) => ({ v: c.id, l: c.name }));
  const mo = () => D.materials.map((x) => ({ v: x.id, l: x.name }));
  const eo = () => D.employees.map((e) => ({ v: e.id, l: e.name }));

  if (mod === 'customers') return {
    key: 'customers', add: 'New customer', statusKey: 'status', statuses: ['All', 'Active', 'On hold'],
    cols: [
      { k: 'code', label: 'Code' }, { k: 'name', label: 'Customer' }, { k: 'city', label: 'Site' }, { k: 'phone', label: 'Phone' },
      { k: 'limit', label: 'Credit limit', t: 'money' }, { k: '_out', label: 'Outstanding', t: 'money', get: (c) => d.outstanding(c) },
      { k: '_use', label: 'Limit used', t: 'text', get: (c) => Math.round((d.outstanding(c) / c.limit) * 100) + '%' }, { k: 'status', label: 'Status', t: 'tag' },
    ],
    fields: [
      { k: 'name', label: 'Customer name', req: 1, span: 'span 2' }, { k: 'city', label: 'Site / city', req: 1 }, { k: 'phone', label: 'Phone', req: 1 },
      { k: 'gst', label: 'GSTIN' }, { k: 'limit', label: 'Credit limit', type: 'number', req: 1, hint: '₹ — blocks new credit orders above this' },
      { k: 'status', label: 'Status', type: 'select', options: opts(['Active', 'On hold']) },
    ],
    foot: (rows) => 'Outstanding on filtered accounts: ' + M(rows.reduce((s, c) => s + d.outstanding(c), 0)),
  };

  if (mod === 'materials') return {
    key: 'materials', add: 'New material', statusKey: 'status', statuses: ['All', 'Active', 'Paused'],
    cols: [
      { k: 'code', label: 'Code' }, { k: 'name', label: 'Material' }, { k: 'unit', label: 'Unit' }, { k: 'rate', label: 'List rate / t', t: 'money' },
      { k: 'stock', label: 'Stock (t)', t: 'num' }, { k: '_val', label: 'Stock value', t: 'money', get: (x) => x.stock * x.rate }, { k: 'status', label: 'Status', t: 'tag' },
    ],
    fields: [
      { k: 'name', label: 'Material', req: 1, span: 'span 2' }, { k: 'unit', label: 'Unit', type: 'select', options: opts(['Tonne', 'Load', 'Cubic metre']) },
      { k: 'rate', label: 'List rate', type: 'number', req: 1 }, { k: 'stock', label: 'Stock on ground (t)', type: 'number' },
      { k: 'status', label: 'Status', type: 'select', options: opts(['Active', 'Paused']) },
    ],
    foot: (rows) => 'Stock value: ' + M(rows.reduce((s, x) => s + x.stock * x.rate, 0)),
  };

  if (mod === 'rates') return {
    key: 'rates', add: 'New contract rate', dateKey: 'from',
    cols: [
      { k: '_c', label: 'Customer', get: (r) => d.cust(r.custId).name }, { k: '_m', label: 'Material', get: (r) => d.mat(r.matId).name },
      { k: '_l', label: 'List rate', t: 'money', get: (r) => d.mat(r.matId).rate }, { k: 'rate', label: 'Contract rate', t: 'money' },
      { k: '_d', label: 'Variance', t: 'text', get: (r) => { const x = r.rate - d.mat(r.matId).rate; return (x > 0 ? '+' : '') + M(x); } },
      { k: 'from', label: 'Effective from' }, { k: 'by', label: 'Approved by' },
    ],
    fields: [
      { k: 'custId', label: 'Customer', type: 'select', options: co(), req: 1 }, { k: 'matId', label: 'Material', type: 'select', options: mo(), req: 1 },
      { k: 'rate', label: 'Contract rate / t', type: 'number', req: 1 }, { k: 'from', label: 'Effective from', type: 'date', req: 1 }, { k: 'by', label: 'Approved by' },
    ],
    foot: (rows) => rows.length + ' contract rate(s) override the list price',
  };

  if (mod === 'orders' || mod === 'voids') {
    const isVoid = mod === 'voids';
    return {
      key: 'orders', add: isVoid ? 'File a void' : 'Manual order entry', dateKey: 'date',
      statusKey: 'status', statuses: isVoid ? ['All', 'Void'] : ['All', 'In Transit', 'Completed', 'Void'],
      only: isVoid ? (o) => o.status === 'Void' : (o) => o.status !== 'Void',
      cols: isVoid
        ? [
            { k: 'ticket', label: 'Ticket' }, { k: 'date', label: 'Date' }, { k: '_c', label: 'Customer', get: (o) => d.cust(o.custId).name },
            { k: '_m', label: 'Material', get: (o) => d.mat(o.matId).name }, { k: 'vehicle', label: 'Vehicle' }, { k: 'reason', label: 'Reason' },
            { k: '_lc', label: 'Loading charge', t: 'money', get: () => d.loading() }, { k: 'by', label: 'Voided by' }, { k: 'status', label: 'Status', t: 'tag' },
          ]
        : [
            { k: 'ticket', label: 'Ticket' }, { k: 'date', label: 'Date' }, { k: '_c', label: 'Customer', get: (o) => d.cust(o.custId).name },
            { k: '_m', label: 'Material', get: (o) => d.mat(o.matId).name }, { k: 'vehicle', label: 'Vehicle' }, { k: 'dir', label: 'Dir' },
            { k: '_n', label: 'Net (t)', t: 'num2', get: (o) => d.net(o) }, { k: '_r', label: 'Rate', t: 'money', get: (o) => d.rateFor(o.custId, o.matId).rate },
            { k: '_a', label: 'Amount', t: 'money', get: (o) => d.amount(o) }, { k: 'method', label: 'Method' }, { k: 'status', label: 'Status', t: 'tag' },
          ],
      fields: [
        { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'custId', label: 'Customer', type: 'select', options: co(), req: 1 },
        { k: 'matId', label: 'Material', type: 'select', options: mo(), req: 1 }, { k: 'vehicle', label: 'Vehicle number', req: 1 },
        { k: 'dir', label: 'Direction', type: 'select', options: opts(['OUT', 'IN']) },
        { k: 'tare', label: 'Tare weight (kg)', type: 'number', req: 1 }, { k: 'gross', label: 'Gross weight (kg)', type: 'number', req: 1 },
        { k: 'method', label: 'Payment method', type: 'select', options: opts(['Cash', 'Credit', 'UPI', 'Bank Transfer']) },
        { k: 'status', label: 'Status', type: 'select', options: opts(['In Transit', 'Completed', 'Void']) },
        { k: 'reason', label: 'Void reason', span: 'span 2', hint: 'Required when the status is Void' },
      ],
      calc: (f) => {
        const o = { custId: f.custId, matId: f.matId, tare: +f.tare || 0, gross: +f.gross || 0 };
        const r = d.rateFor(o.custId, o.matId);
        return [
          { label: 'Net weight', value: T(d.net(o)) + ' t' },
          { label: 'Applied rate (' + r.src + ')', value: M(r.rate) + ' / t' },
          { label: 'Material value', value: M(d.amount(o)) },
          { label: 'Loading charge', value: M(d.loading()) },
          { label: 'GST @ ' + d.gstPct() + '%', value: M(((d.amount(o) + d.loading()) * d.gstPct()) / 100) },
          { label: 'Net payable', value: M(d.payable(o)) },
        ];
      },
      foot: (rows) => (isVoid
        ? 'Loading charges retained: ' + M(rows.length * d.loading())
        : 'Filtered tonnage ' + T(rows.reduce((s, o) => s + d.net(o), 0)) + ' t · value ' + M(rows.reduce((s, o) => s + d.amount(o), 0))),
    };
  }

  if (mod === 'payments') return {
    key: 'customers', add: 'Record receipt', statusKey: '_ag', statuses: ['All', 'Clear', 'Partial', 'Overdue'],
    cols: [
      { k: 'name', label: 'Customer' }, { k: 'invoiced', label: 'Invoiced', t: 'money' }, { k: 'received', label: 'Received', t: 'money' },
      { k: '_out', label: 'Outstanding', t: 'money', get: (c) => d.outstanding(c) }, { k: '_hd', label: 'Headroom', t: 'money', get: (c) => c.limit - d.outstanding(c) },
      { k: 'last', label: 'Last receipt' },
      { k: '_ag', label: 'Ageing', t: 'tag', get: (c) => (d.outstanding(c) === 0 ? 'Clear' : c.last < '2026-08-25' ? 'Overdue' : 'Partial') },
    ],
    rowAction: 'Receipt',
    fields: [
      { k: 'name', label: 'Customer name', req: 1 }, { k: 'limit', label: 'Credit limit', type: 'number', req: 1 },
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
      { label: 'On credit', value: M(sum(rows.filter((o) => o.method === 'Credit'), d.amount)), note: rows.filter((o) => o.method === 'Credit').length + ' of ' + rows.length + ' tickets' },
      { label: 'Open in transit', value: String(rows.filter((o) => o.status === 'In Transit').length), note: 'Awaiting delivery confirmation' },
    ],
    payments: () => [
      { label: 'Invoiced', value: M(sum(rows, (x) => x.invoiced)), note: 'Lifetime, filtered accounts' },
      { label: 'Received', value: M(sum(rows, (x) => x.received)), note: 'Cash, UPI and transfers' },
      { label: 'Outstanding', value: M(sum(rows, d.outstanding)), note: rows.filter((x) => d.outstanding(x) > 0).length + ' accounts' },
      { label: 'Overdue > 30 days', value: M(sum(rows.filter((x) => x.last < '2026-08-25'), d.outstanding)), note: 'No receipt since 25 Aug' },
    ],
    voids: () => [
      { label: 'Voided loads', value: String(rows.length), note: 'Filtered period' },
      { label: 'Charges retained', value: M(rows.length * d.loading()), note: M(d.loading()) + ' per void' },
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
      { label: 'Accounts', value: String(rows.length), note: rows.filter((x) => x.status === 'On hold').length + ' on hold' },
      { label: 'Credit sanctioned', value: M(sum(rows, (x) => x.limit)), note: 'Sum of limits' },
      { label: 'Credit used', value: M(sum(rows, d.outstanding)), note: 'Outstanding balances' },
    ],
    materials: () => [
      { label: 'Products', value: String(rows.length), note: rows.filter((x) => x.status === 'Paused').length + ' paused' },
      { label: 'Stock on ground', value: N(sum(rows, (x) => x.stock)) + ' t', note: 'Across all products' },
      { label: 'Stock value', value: M(sum(rows, (x) => x.stock * x.rate)), note: 'At list rate' },
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
    rates: () => [
      { label: 'Contract rates', value: String(rows.length), note: 'Active overrides' },
      { label: 'Customers covered', value: String(new Set(rows.map((x) => x.custId)).size), note: 'Of ' + D.customers.length + ' accounts' },
      { label: 'Average discount', value: rows.length ? M(sum(rows, (x) => d.mat(x.matId).rate - x.rate) / rows.length) + ' / t' : '₹0', note: 'Against list rate' },
    ],
  };
  return (K[mod] || (() => []))();
}
