import { BOOK_MODES, EXPENSE_HEADS, expenseHead, INCOME_HEADS, modeName } from './books';
import { OTHER_MATERIAL } from './domain';
import { createPeople } from './people';
import { M, T } from './format';

export const NAV_GROUPS = ['Operations', 'Masters', 'Finance', 'People', 'Owner'];

export const MODS = {
  dashboard: { label: 'Dashboard', group: 'Operations', title: 'Operations overview', sub: 'Live position across the yard, the ledger and the payroll cycle.' },
  weighbridge: { label: 'Weighbridge', group: 'Operations', title: 'Weighbridge station', sub: 'Capture tare on entry, gross on exit. Net weight and price compute themselves.' },
  import: { label: 'Register Import', group: 'Operations', title: 'Register import', sub: 'Load the weighbridge register, check each row and record how it was paid.' },
  orders: { label: 'Orders & Soling', group: 'Operations', title: 'Orders & transactions', sub: 'Every sale, priced at net tons × the rate per ton in force on its date, with how it was paid.' },
  // Shown as the Soling tab of the Orders & Soling page.
  purchases: { label: 'Soling Loads', group: 'Operations', title: 'Soling loads', sub: 'Boulders bought for crushing — net tons × the rate per ton on the load, plus any extra charges.', hidden: true, navAs: 'orders' },
  eb: { label: 'Electricity (EB)', group: 'Operations', title: 'Electricity (EB)', sub: 'Units and power factor every day; at month end the government and private bill, and the Thar plant share (not our cost).' },
  customers: { label: 'Customers', group: 'Masters', title: 'Customers', sub: 'Everyone who takes material on credit — owner, address, contact and their own ton rates.' },
  materials: { label: 'Materials', group: 'Masters', title: 'Materials', sub: 'What we sell and buy, and the standard rate per ton for each period.' },
  // Detail screens, reached from the lists above (not shown in the sidebar).
  party: { label: 'Customers', group: 'Masters', title: 'Customer', sub: '', hidden: true, navAs: 'customers' },
  stdrates: { label: 'Materials', group: 'Masters', title: 'Standard rates', sub: 'Rate per ton applied when a party has no rate of its own for that date.', hidden: true, navAs: 'materials' },
  // Fuel bunks, spares and other expenses share the Finances page as tabs; only Finances is in the sidebar.
  finances: { label: 'Finances', group: 'Finance', title: 'Finances', sub: '' },
  bunks: { label: 'Fuel Bunks', group: 'Finance', title: 'Fuel bunks', sub: 'Diesel taken on credit — for our vehicles, the tanker and others — and what we owe each bunk.', hidden: true, navAs: 'finances' },
  vendors: { label: 'Spares & Purchases', group: 'Finance', title: 'Spares & purchases', sub: 'Spares and items bought on credit — bills, payments and what we owe each company.', hidden: true, navAs: 'finances' },
  creditor: { label: 'Fuel Bunks', group: 'Finance', title: 'Account', sub: '', hidden: true, navAs: 'finances' },
  expenses: { label: 'Expenses', group: 'Finance', title: 'Expenses', sub: 'Credit and debit entries against the yard.', hidden: true, navAs: 'finances' },
  // Attendance, worker details and the salary account share the Employees page as tabs.
  people: { label: 'Employees', group: 'People', title: 'Employees', sub: '' },
  employees: { label: 'Employees', group: 'People', title: 'Workers', sub: 'Everyone on daily wages — name, work, phone and daily pay.', hidden: true, navAs: 'people' },
  attendance: { label: 'Attendance', group: 'People', title: 'Attendance', sub: 'Mark every worker for the day — present, half day or absent — with remarks. Past days can be edited.', hidden: true, navAs: 'people' },
  advances: { label: 'Salary Account', group: 'People', title: 'Salary account', sub: 'Money given to workers ahead of Saturday — taken back from their salary.', hidden: true, navAs: 'people' },
  approvals: { label: 'Approvals', group: 'Owner', title: 'Approvals', sub: 'Changes staff made that need the owner’s approval before they count.' },
  activity: { label: 'Activity & Undo', group: 'Owner', title: 'Activity & undo', sub: 'Every change, who made it and when — and undo a staff member’s work over a period.' },
  access: { label: 'Staff & Access', group: 'Owner', title: 'Staff & access', sub: 'Staff sign-ins and what each person may do and automatic sign-out.' },
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

  if (mod === 'customers') return {
    key: 'customers', add: 'New customer', statusKey: 'status', statuses: ['All', 'Active', 'On hold'],
    cols: [
      // Contact, address, own rates and status stay on the customer's own page (Open); the list keeps it short.
      { k: 'code', label: 'Code' }, { k: 'name', label: 'Customer' }, { k: 'owner', label: 'Owner' },
      { k: '_out', label: 'Outstanding', t: 'money', get: (c) => d.outstanding(c) },
    ],
    rowAction: { label: 'Open', kind: 'party' }, rowOpens: true,
    fields: [
      { k: 'name', label: 'Customer name', req: 1, span: 'span 2' }, { k: 'owner', label: 'Owner name' },
      { k: 'contact', label: 'Contact number', placeholder: '98430 22417' }, { k: 'address', label: 'Address', span: 'span 2' },
      { k: 'gst', label: 'GSTIN' }, { k: 'status', label: 'Status', type: 'select', options: opts(['Active', 'On hold']) },
      { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
    ],
    validate: (f, id) => ({ ...uniqueName(D.customers, f, id, 'A customer'), ...checkContact(f) }),
    foot: (rows) => 'Outstanding on filtered customers: ' + M(rows.reduce((s, c) => s + d.outstanding(c), 0)),
  };

  if (mod === 'purchases') {
    const names = [...new Set((D.purchases || []).map((u) => u.supplierName).filter(Boolean))].sort();
    return {
      key: 'purchases', add: 'New soling load', dateKey: 'date',
      statusKey: 'supplierName', statuses: ['All'].concat(names),
      cols: [
        { k: 'serial', label: 'Serial' }, { k: 'date', label: 'Date' }, { k: 'time', label: 'Time' },
        { k: 'supplierName', label: 'Supplier' }, { k: 'vehicle', label: 'Vehicle' },
        { k: '_n', label: 'Net (t)', t: 'num2', get: (u) => d.net(u) }, { k: '_r', label: 'Rate / t', t: 'money', get: (u) => d.solRate(u).rate },
        { k: '_x', label: 'Extra', t: 'money', get: (u) => +u.extra || 0 }, { k: '_v', label: 'Value', t: 'money', get: (u) => d.solValue(u) },
        { k: 'remarks', label: 'Remarks' },
      ],
      fields: [
        { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'time', label: 'Time', type: 'time' },
        { k: 'supplierName', label: 'Supplier name', req: 1, hint: 'Who the boulders came from' },
        { k: 'serial', label: 'Register serial / ticket', placeholder: 'CR00001' },
        { k: 'vehicle', label: 'Vehicle number', req: 1 },
        { k: 'tare', label: 'Empty truck (kg)', type: 'number', req: 1, hint: 'Register "Gross" column' },
        { k: 'gross', label: 'Loaded truck (kg)', type: 'number', req: 1, hint: 'Register "Net" column' },
        { k: 'manualRate', label: 'Rate (₹ / ton)', type: 'number', req: 1 },
        { k: 'extra', label: 'Extra charges (₹)', type: 'number', hint: 'Rent, unloading — added to the load value' },
        { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
      ],
      validate: (f) => {
        const e = {};
        if (+f.gross && +f.tare && +f.gross <= +f.tare) e.gross = 'The loaded weight must exceed the empty truck.';
        if (!(+f.manualRate > 0)) e.manualRate = 'Enter the rate per ton.';
        if (String(f.extra ?? '').trim() && !(+f.extra >= 0)) e.extra = 'Enter an amount, or leave it blank.';
        return e;
      },
      calc: (f) => {
        const u = { manualRate: f.manualRate, tare: +f.tare || 0, gross: +f.gross || 0, extra: f.extra };
        return [
          { label: 'Net boulders', value: T(d.net(u)) + ' t' },
          { label: 'Rate', value: M(d.solRate(u).rate) + ' / t' },
          { label: 'Material value (net tons × rate)', value: M(d.solAmount(u)) },
          { label: 'Extra charges', value: M(+f.extra || 0) },
          { label: 'Load value', value: M(d.solValue(u)) },
        ];
      },
      foot: (rows) => rows.length + ' load(s) · ' + T(rows.reduce((s, u) => s + d.net(u), 0)) + ' t · value ' + M(rows.reduce((s, u) => s + d.solValue(u), 0)),
    };
  }

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

  if (mod === 'orders') {
    return {
      key: 'orders', add: 'Manual order entry', dateKey: 'date',
      statusKey: 'status', statuses: ['All', 'In Transit', 'Completed', 'Void'],
      cols: [
        { k: 'ticket', label: 'Ticket' }, { k: 'date', label: 'Date' }, { k: '_c', label: 'Party', get: (o) => d.partyLabel(o) },
        { k: '_m', label: 'Material', get: (o) => d.matLabel(o) }, { k: 'vehicle', label: 'Vehicle' },
        { k: '_n', label: 'Net (t)', t: 'num2', get: (o) => d.net(o) }, { k: '_r', label: 'Rate / t', t: 'money', get: (o) => d.orderRate(o).rate },
        { k: '_a', label: 'Bill', t: 'money', get: (o) => d.billTotal(o) },
        { k: '_p', label: 'Paid', t: 'money', get: (o) => d.paidOn(o) },
        { k: '_oc', label: 'On credit', t: 'money', get: (o) => d.onCredit(o) },
        { k: 'method', label: 'Payment' }, { k: 'status', label: 'Status', t: 'tag' },
      ],
      rowAction: { label: 'Payment', kind: 'pay' },
      fields: [
        { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'time', label: 'Time', type: 'time' },
        { k: 'custId', label: 'Customer', type: 'select', options: co(), req: 1, span: 'span 2' },
        { k: 'matId', label: 'Material', type: 'select', options: so(), req: 1 },
        { k: 'matName', label: 'Material name', hint: 'Only for Other — type what was loaded' },
        { k: 'vehicle', label: 'Vehicle number', req: 1 },
        { k: 'tare', label: 'Tare weight (kg)', type: 'number', req: 1 }, { k: 'gross', label: 'Gross weight (kg)', type: 'number', req: 1 },
        { k: 'gst', label: 'GST amount (₹)', type: 'number', hint: 'Added to the bill for this load. Leave blank if none.' },
        { k: 'rent', label: 'Rent (₹)', type: 'number', hint: 'Vehicle rent the party pays on this load' },
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
          { label: 'Material value (net tons × rate)', value: M(d.amount(o)) },
          { label: 'GST + rent', value: M((+f.gst || 0) + (+f.rent || 0)) },
          { label: 'Bill', value: M(d.amount(o) + (+f.gst || 0) + (+f.rent || 0)) },
        ];
      },
      foot: (rows) => 'Filtered tonnage ' + T(rows.reduce((s, o) => s + d.net(o), 0)) + ' t · value ' + M(rows.reduce((s, o) => s + d.amount(o), 0)),
    };
  }

  if (mod === 'bunks' || mod === 'vendors') {
    const bunk = mod === 'bunks';
    const what = bunk ? 'A fuel bunk' : 'A company';
    return {
      key: 'creditors', add: bunk ? 'New fuel bunk' : 'New spares company', defaults: { kind: bunk ? 'bunk' : 'vendor' },
      cols: [{ k: 'name', label: 'Name' }],
      fields: [
        { k: 'name', label: bunk ? 'Bunk name' : 'Company name', req: 1, span: 'span 2' }, { k: 'owner', label: 'Owner / contact person' },
        { k: 'contact', label: 'Contact number', placeholder: '98430 22417' },
        { k: 'upi', label: 'UPI ID / number', hint: 'Where UPI payments are sent' },
        { k: 'gstin', label: 'GSTIN' },
        { k: 'address', label: 'Address', span: 'span 2' },
        { k: 'status', label: 'Status', type: 'select', options: opts(['Active', 'Inactive']) },
        { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
      ],
      validate: (f, id) => ({ ...uniqueName((D.creditors || []).filter((c) => c.kind === (bunk ? 'bunk' : 'vendor')), f, id, what), ...checkContact(f) }),
    };
  }

  if (mod === 'fuelBills' || mod === 'spareBills') {
    const fuel = mod === 'fuelBills';
    const accounts = (D.creditors || []).filter((c) => c.kind === (fuel ? 'bunk' : 'vendor') && c.status !== 'Inactive').map((c) => ({ v: c.id, l: c.name }));
    return {
      key: 'crBills', add: fuel ? 'Fuel taken' : 'New purchase bill',
      cols: [{ k: 'date', label: 'Date' }],
      fields: fuel ? [
        { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'time', label: 'Time', type: 'time' },
        { k: 'creditorId', label: 'Bunk', type: 'select', options: accounts, req: 1 },
        { k: 'billNo', label: 'Slip / indent no.' },
        { k: 'forType', label: 'Fuel for', type: 'select', options: [{ v: 'own', l: 'Our vehicle' }, { v: 'tanker', l: 'Our tanker' }, { v: 'other', l: 'Someone else' }] },
        { k: 'vehicle', label: 'Vehicle number' },
        { k: 'forName', label: 'Name (someone else)', hint: 'Only when fuel is for someone else' },
        { k: 'litres', label: 'Litres', type: 'number' },
        { k: 'rate', label: 'Price per litre (₹)', type: 'number' },
        { k: 'amount', label: 'Amount (₹)', type: 'number', hint: 'Leave blank to use litres × price' },
        { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
      ] : [
        { k: 'date', label: 'Bill date', type: 'date', req: 1 }, { k: 'time', label: 'Time', type: 'time' },
        { k: 'creditorId', label: 'Company', type: 'select', options: accounts, req: 1 },
        { k: 'billNo', label: 'Bill no.' },
        { k: 'items', label: 'What was bought', req: 1, span: 'span 2', placeholder: 'e.g. Jaw plate, 2 nos; conveyor belt 10 m' },
        { k: 'amount', label: 'Amount (₹)', type: 'number', req: 1 },
        { k: 'gst', label: 'GST amount (₹)', type: 'number', hint: 'Leave blank if none' },
        { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
      ],
      validate: (f) => {
        const e = {};
        if (fuel) {
          const byLitres = +f.litres > 0 && +f.rate > 0;
          if (!byLitres && !(+f.amount > 0)) e.amount = 'Enter litres and price per litre, or the amount.';
          if ((+f.litres > 0) !== (+f.rate > 0) && !(+f.amount > 0)) e.rate = 'Enter both litres and price per litre.';
          if (f.forType === 'other' && !String(f.forName || '').trim()) e.forName = 'Type who took the fuel.';
        } else if (String(f.amount ?? '').trim() && !(+f.amount > 0)) e.amount = 'Enter the bill amount.';
        if (String(f.gst ?? '').trim() && !(+f.gst >= 0)) e.gst = 'Enter an amount, or leave it blank.';
        return e;
      },
      calc: (f) => {
        const b = { litres: f.litres, rate: f.rate, amount: f.amount, gst: f.gst };
        return fuel
          ? [{ label: +f.amount > 0 ? 'Amount typed' : (+f.litres || 0).toFixed(2) + ' L × ₹' + (+f.rate || 0), value: M(d.crBillValue(b)) }]
          : [{ label: 'Amount', value: M(+f.amount || 0) }, { label: 'GST', value: M(+f.gst || 0) }, { label: 'Bill total', value: M(d.crBillValue(b)) }];
      },
    };
  }

  if (mod === 'expenses') return {
    key: 'expenses', add: 'New expense / income', dateKey: 'date', statusKey: '_t', statuses: ['All', 'Expense', 'Income'],
    cols: [
      { k: 'date', label: 'Date' }, { k: 'time', label: 'Time' }, { k: '_t', label: 'Type', t: 'tag', get: (x) => (x.type === 'Credit' ? 'Income' : 'Expense') },
      { k: '_h', label: 'Head', get: (x) => expenseHead(x) }, { k: 'desc', label: 'Description' },
      { k: 'amount', label: 'Amount', t: 'money' }, { k: '_m', label: 'Mode', get: (x) => modeName(x.mode) }, { k: 'party', label: 'Paid to / from' },
    ],
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'time', label: 'Time', type: 'time' },
      { k: 'type', label: 'Type', type: 'select', options: [{ v: 'Debit', l: 'Expense — money going out' }, { v: 'Credit', l: 'Other income — money coming in' }] },
      { k: 'head', label: 'Head', type: 'select', req: 1, options: [...new Set(EXPENSE_HEADS.concat(INCOME_HEADS, (D.expenses || []).map((x) => x.head).filter(Boolean)))].map((h) => ({ v: h, l: h })) },
      { k: 'headOther', label: 'Head name (for Other)', hint: 'Only when the head is Other / Other income' },
      { k: 'amount', label: 'Amount (₹)', type: 'number', req: 1 },
      { k: 'mode', label: 'Paid by', type: 'select', options: BOOK_MODES.map((m) => ({ v: m, l: modeName(m) })) },
      { k: 'party', label: 'Paid to / received from' },
      { k: 'desc', label: 'Description / remarks', span: 'span 2', hint: 'Optional' },
    ],
    validate: (f) => {
      const e = {};
      if (String(f.amount ?? '').trim() && !(+f.amount > 0)) e.amount = 'Enter an amount greater than zero.';
      if ((f.head === 'Other' || f.head === 'Other income') && !String(f.headOther || '').trim()) e.headOther = 'Type what this was for.';
      return e;
    },
    foot: (rows) => {
      const dr = rows.filter((x) => x.type === 'Debit').reduce((s, x) => s + x.amount, 0);
      const cr = rows.filter((x) => x.type === 'Credit').reduce((s, x) => s + x.amount, 0);
      return 'Debit ' + M(dr) + ' · Credit ' + M(cr) + ' · Net ' + M(dr - cr);
    },
  };

  if (mod === 'employees') {
    const P = createPeople(D);
    return {
      key: 'employees', add: 'New worker', statusKey: 'status', statuses: ['All', 'Active', 'Left'],
      cols: [
        { k: 'code', label: 'Code' }, { k: 'name', label: 'Name' }, { k: 'role', label: 'Work' }, { k: 'phone', label: 'Phone' },
        { k: 'wage', label: 'Daily wage', t: 'money' }, { k: '_ad', label: 'Advance due', t: 'money', get: (e) => Math.max(0, P.advanceDue(e.id)) },
        { k: 'status', label: 'Status', t: 'tag' }, { k: 'remarks', label: 'Remarks' },
      ],
      fields: [
        { k: 'name', label: 'Name', req: 1, span: 'span 2' }, { k: 'role', label: 'Work / role' }, { k: 'phone', label: 'Phone' },
        { k: 'wage', label: 'Daily wage (₹)', type: 'number', req: 1, hint: 'A changed wage applies to days marked after saving' },
        { k: 'status', label: 'Status', type: 'select', options: opts(['Active', 'Left']) },
        { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
      ],
      validate: (f, id) => ({
        ...uniqueName(D.employees, f, id, 'A worker'),
        ...(String(f.wage ?? '').trim() && !(+f.wage > 0) ? { wage: 'Enter the daily wage.' } : {}),
      }),
      foot: (rows) => 'Daily wage bill (active): ' + M(rows.filter((e) => e.status !== 'Left').reduce((s, e) => s + (+e.wage || 0), 0)),
    };
  }

  if (mod === 'advances') {
    const P = createPeople(D);
    return {
      key: 'advances', add: 'Give advance', dateKey: 'date', statusKey: '_e', statuses: ['All'].concat((D.employees || []).map((e) => e.name)),
      cols: [
        { k: 'date', label: 'Date' }, { k: 'time', label: 'Time' }, { k: '_e', label: 'Worker', get: (a) => P.emp(a.empId).name },
        { k: 'amount', label: 'Advance', t: 'money' }, { k: 'mode', label: 'Paid by' }, { k: 'remarks', label: 'Remarks' },
        { k: '_due', label: 'Worker owes now', t: 'money', get: (a) => Math.max(0, P.advanceDue(a.empId)) },
      ],
      fields: [
        { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'time', label: 'Time', type: 'time' },
        { k: 'empId', label: 'Worker', type: 'select', options: (D.employees || []).filter((e) => e.status !== 'Left').map((e) => ({ v: e.id, l: e.name })), req: 1 },
        { k: 'amount', label: 'Amount (₹)', type: 'number', req: 1 },
        { k: 'mode', label: 'Paid by', type: 'select', options: opts(['Cash', 'UPI']) },
        { k: 'remarks', label: 'Remarks', span: 'span 2', hint: 'Optional' },
      ],
      validate: (f) => (String(f.amount ?? '').trim() && !(+f.amount > 0) ? { amount: 'Enter an amount greater than zero.' } : {}),
      foot: (rows) => 'Advanced in the filtered rows: ' + M(rows.reduce((s, a) => s + (+a.amount || 0), 0)) + ' · recovered from Saturday salaries',
    };
  }

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
    expenses: () => [
      { label: 'Debit', value: M(debit()), note: 'Money out' },
      { label: 'Credit', value: M(credit()), note: 'Money in' },
      { label: 'Net burn', value: M(debit() - credit()), note: 'Filtered range' },
    ],
    customers: () => [
      { label: 'Customers', value: String(rows.length), note: rows.filter((x) => x.status === 'On hold').length + ' on hold' },
      { label: 'Outstanding', value: M(sum(rows, d.outstanding)), note: rows.filter((x) => d.outstanding(x) > 0).length + ' customers owe us' },
      { label: 'With their own rates', value: String(rows.filter((x) => D.rates.some((r) => r.custId === x.id)).length), note: 'Others pay the standard rate' },
      { label: 'Details missing', value: String(rows.filter((x) => !x.owner || !x.contact || !x.address).length), note: 'No owner, contact or address yet' },
    ],
    purchases: () => [
      { label: 'Soling loads', value: String(rows.length), note: 'Filtered period' },
      { label: 'Net boulders', value: T(sum(rows, d.net)) + ' t', note: 'Loaded − empty truck' },
      { label: 'Value', value: M(sum(rows, d.solValue)), note: 'Including extra charges' },
      { label: 'Without a rate', value: String(rows.filter((u) => !d.solRate(u).rate).length), note: 'Edit the load to add its rate' },
    ],
    materials: () => [
      { label: 'Materials', value: String(rows.length), note: rows.filter((x) => x.status === 'Paused').length + ' paused' },
      { label: 'We sell', value: String(rows.filter((x) => x.kind !== 'purchase').length), note: 'Priced per ton' },
      { label: 'We buy', value: String(rows.filter((x) => x.kind === 'purchase').length), note: 'Soling (boulder)' },
    ],
    employees: () => [
      { label: 'Workers', value: String(rows.filter((x) => x.status !== 'Left').length), note: rows.filter((x) => x.status === 'Left').length + ' left' },
      { label: 'Daily wage bill', value: M(sum(rows.filter((x) => x.status !== 'Left'), (x) => +x.wage || 0)), note: 'If everyone works a full day' },
      { label: 'Advances due', value: M(sum(D.employees || [], (x) => Math.max(0, createPeople(D).advanceDue(x.id)))), note: 'Recovered from Saturday salaries' },
    ],
    advances: () => [
      { label: 'Advanced', value: M(sum(rows, (x) => +x.amount || 0)), note: rows.length + ' entries' },
      { label: 'Still due from workers', value: M(sum(D.employees || [], (x) => Math.max(0, createPeople(D).advanceDue(x.id)))), note: 'All workers' },
    ],
  };
  return (K[mod] || (() => []))();
}
