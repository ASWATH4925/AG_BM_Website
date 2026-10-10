import { TONS_PER_UNIT } from './format';
import { dayBook, expenseHead, expenseSummary, modeName, profitSummary, salesSummary, solingSummary } from './books';

// Period reports, described once and written out as PDF or Excel.
// Column formats: 'm' money, 't' tons, 'u' units, '' text. Excel keeps the numbers; the PDF formats them.

export const REPORTS = [
  { v: 'daybook', l: 'Day book', sub: 'Every rupee in and out — cash and bank — with opening and closing balances' },
  { v: 'materials', l: 'Sales by material', sub: 'Units, tons, loads and value for each material' },
  { v: 'parties', l: 'Sales by party', sub: 'Loads, value, paid and on credit for each credit party and walk-ins' },
  { v: 'collections', l: 'Collections', sub: 'Every payment received, and money parties sent straight to others' },
  { v: 'soling', l: 'Soling purchases', sub: 'Loads, tons, value and payments for each soling supplier' },
  { v: 'expenses', l: 'Expenses', sub: 'Every expense and other income, with totals by head' },
  { v: 'profit', l: 'Profit summary', sub: 'Sales − soling bought − wages − expenses + other income' },
];

const r2 = (n) => Math.round((+n || 0) * 100) / 100;
const units = (t) => r2(t / TONS_PER_UNIT);
const period = (from, to) => (from || 'the beginning') + ' to ' + (to || 'now');
const stamp = (from, to) => (from || 'start') + '-to-' + (to || 'now');
const rs = (n) => 'Rs. ' + r2(n).toLocaleString('en-IN');

export function buildReport(kind, d, from, to) {
  const lines = ['Period: ' + period(from, to)];
  const file = (name) => 'agbm-' + name + '-' + stamp(from, to);

  if (kind === 'daybook') {
    const b = dayBook(d, from, to);
    let bal = b.opening.cash + b.opening.bank;
    const rows = b.rows.map((f) => {
      bal += f.dir === 'in' ? f.amount : -f.amount;
      return [f.date + ' ' + f.time, f.what, f.who, modeName(f.mode), f.dir === 'in' ? f.amount : '', f.dir === 'out' ? f.amount : '', bal, f.ref || f.remarks];
    });
    return {
      title: 'Day book', file: file('day-book'), orientation: 'landscape',
      lines: lines.concat([
        'Opening — cash ' + rs(b.opening.cash) + ', bank & UPI ' + rs(b.opening.bank),
        'Closing — cash ' + rs(b.closing.cash) + ', bank & UPI ' + rs(b.closing.bank),
      ]),
      sections: [
        {
          heading: 'Money in and out', fmt: ['', '', '', '', 'm', 'm', 'm', ''],
          head: ['Date / time', 'Particulars', 'Party / paid to', 'Mode', 'In', 'Out', 'Balance', 'Reference / remarks'],
          body: rows,
          foot: ['Totals', '', '', '', b.totals.cash.in + b.totals.bank.in, b.totals.cash.out + b.totals.bank.out, b.closing.cash + b.closing.bank, ''],
        },
        {
          heading: 'By mode', fmt: ['', 'm', 'm', 'm', 'm'],
          head: ['Mode', 'Opening', 'In', 'Out', 'Closing'],
          body: [
            ['Cash', b.opening.cash, b.totals.cash.in, b.totals.cash.out, b.closing.cash],
            ['Bank & UPI', b.opening.bank, b.totals.bank.in, b.totals.bank.out, b.closing.bank],
          ],
        },
        {
          heading: 'Paid by parties straight to others (not in our cash or bank)', fmt: ['', '', '', '', 'm'],
          head: ['Date / time', 'Paid by', 'Paid to', 'Mode', 'Amount'],
          body: b.direct.map((x) => [x.date + ' ' + x.time, x.who, x.to, modeName(x.mode), x.amount]),
        },
      ],
    };
  }

  if (kind === 'materials' || kind === 'parties') {
    const s = salesSummary(d, from, to);
    if (kind === 'materials') {
      return {
        title: 'Sales by material', file: file('sales-by-material'), lines: lines.concat(['1 unit = ' + TONS_PER_UNIT + ' tons']),
        sections: [{
          fmt: ['', '', 'u', 't', 'm'],
          head: ['Material', 'Loads', 'Units', 'Tons', 'Value (Rs.)'],
          body: s.byMat.map((m) => [m.label, m.loads, units(m.tons), m.tons, m.value]),
          foot: ['Total', s.loads.length, units(s.tons), s.tons, s.value],
        }],
      };
    }
    return {
      title: 'Sales by party', file: file('sales-by-party'), orientation: 'landscape', lines,
      sections: [{
        fmt: ['', '', '', 'u', 't', 'm', 'm', 'm'],
        head: ['Party', 'Type', 'Loads', 'Units', 'Tons', 'Billed (Rs.)', 'Paid on loads (Rs.)', 'On credit (Rs.)'],
        body: s.byParty.map((p) => [p.name, p.credit ? 'Credit party' : 'Walk-in', p.loads, units(p.tons), p.tons, p.value, p.paid, p.onCredit]),
        foot: ['Total', '', s.loads.length, units(s.tons), s.tons, s.value, s.byParty.reduce((a, p) => a + p.paid, 0), s.onCredit],
      }],
    };
  }

  if (kind === 'collections') {
    const b = dayBook(d, from, to);
    const ins = b.rows.filter((f) => f.dir === 'in' && f.kind !== 'Other income');
    return {
      title: 'Collections', file: file('collections'), orientation: 'landscape', lines,
      sections: [
        {
          heading: 'Received by the company', fmt: ['', '', '', '', 'm', ''],
          head: ['Date / time', 'Paid by', 'Against', 'Mode', 'Amount (Rs.)', 'Reference / remarks'],
          body: ins.map((f) => [f.date + ' ' + f.time, f.who, f.what, modeName(f.mode), f.amount, f.ref || f.remarks]),
          foot: ['Total', ins.length + ' payments', '', '', ins.reduce((a, f) => a + f.amount, 0), ''],
        },
        {
          heading: 'Sent straight to soling suppliers or others', fmt: ['', '', '', '', 'm', ''],
          head: ['Date / time', 'Paid by', 'Paid to', 'Mode', 'Amount (Rs.)', 'Reference / remarks'],
          body: b.direct.map((x) => [x.date + ' ' + x.time, x.who, x.to, modeName(x.mode), x.amount, x.ref || x.remarks]),
          foot: ['Total', b.direct.length + ' payments', '', '', b.direct.reduce((a, x) => a + x.amount, 0), ''],
        },
      ],
    };
  }

  if (kind === 'soling') {
    const s = solingSummary(d, from, to);
    return {
      title: 'Soling purchases', file: file('soling-purchases'), orientation: 'landscape', lines,
      sections: [
        {
          heading: 'By supplier', fmt: ['', '', 't', 'm', 'm'],
          head: ['Supplier', 'Loads', 'Tons', 'Value (Rs.)', 'Paid in period (Rs.)'],
          body: s.bySup.map((g) => [g.name, g.loads, g.tons, g.value, g.paid]),
          foot: ['Total', s.loads.length, s.tons, s.value, s.paid],
        },
        {
          heading: 'Loads', fmt: ['', '', '', '', 't', 'm', 'm', 'm'],
          head: ['Date / time', 'Serial', 'Supplier', 'Vehicle', 'Tons', 'Rate / t', 'Extra', 'Value (Rs.)'],
          body: s.loads.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
            .map((u) => [u.date + ' ' + (u.time || ''), u.serial || '', d.supplier(u.supplierId).name, u.vehicle, d.net(u), d.solRate(u).rate, +u.extra || 0, d.solValue(u)]),
        },
      ],
    };
  }

  if (kind === 'expenses') {
    const e = expenseSummary(d, from, to);
    return {
      title: 'Expenses', file: file('expenses'), orientation: 'landscape', lines: lines.concat(['Other income in the period: ' + rs(e.incomeTotal)]),
      sections: [
        {
          heading: 'By head', fmt: ['', 'm'],
          head: ['Head', 'Spent (Rs.)'],
          body: e.byHead.map(([h, a]) => [h, a]),
          foot: ['Total spent', e.spentTotal],
        },
        {
          heading: 'Entries', fmt: ['', '', '', '', '', '', 'm'],
          head: ['Date / time', 'Type', 'Head', 'Description', 'Paid to / from', 'Mode', 'Amount (Rs.)'],
          body: e.list.map((x) => [x.date + ' ' + (x.time || ''), x.type === 'Credit' ? 'Income' : 'Expense', expenseHead(x), x.desc || '', x.party || '', modeName(x.mode), +x.amount || 0]),
        },
      ],
    };
  }

  // profit
  const p = profitSummary(d, from, to);
  return {
    title: 'Profit summary', file: file('profit-summary'), lines: lines.concat(['A rough figure: soling is counted when bought, not when crushed.']),
    sections: [{
      fmt: ['', 'm'],
      head: ['', 'Amount (Rs.)'],
      body: [['Sales billed', p.sales], ['Less soling bought', -p.soling], ['Less wages (salaries paid)', -p.wages], ['Less expenses', -p.expenses], ['Add other income', p.income]],
      foot: [p.net >= 0 ? 'Profit' : 'Loss', p.net],
    }],
  };
}

const fmtPdf = (v, f) => {
  if (v === '' || v == null) return '';
  if (f === 'm') return r2(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (f === 't' || f === 'u') return (+v).toFixed(2);
  return String(v);
};

export async function reportPdf(rep) {
  const { tablesPdf } = await import('./report');
  await tablesPdf({
    ...rep,
    sections: rep.sections.map((s) => ({
      ...s,
      body: s.body.map((row) => row.map((v, i) => fmtPdf(v, s.fmt[i]))),
      foot: s.foot && s.foot.map((v, i) => fmtPdf(v, s.fmt[i])),
      right: s.fmt.map((f, i) => (f ? i : -1)).filter((i) => i >= 0),
    })),
  });
}

export async function reportExcel(rep) {
  const X = await import('xlsx');
  const aoa = [[rep.title], ...rep.lines.map((l) => [l]), []];
  rep.sections.forEach((s) => {
    if (s.heading) aoa.push([s.heading]);
    aoa.push(s.head);
    s.body.forEach((row) => aoa.push(row.map((v, i) => (s.fmt[i] && v !== '' ? r2(v) : v))));
    if (s.foot) aoa.push(s.foot.map((v, i) => (s.fmt[i] && typeof v === 'number' ? r2(v) : v)));
    aoa.push([]);
  });
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), rep.title.slice(0, 31));
  X.writeFile(wb, rep.file + '.xlsx');
}

// Backup: every collection on its own sheet (nested values written as JSON).
export async function exportAll(db, today) {
  const X = await import('xlsx');
  const wb = X.utils.book_new();
  Object.entries(db).forEach(([name, value]) => {
    const list = Array.isArray(value) ? value : [value || {}];
    const rows = list.map((r) => Object.fromEntries(Object.entries(r || {}).map(([k, v]) => [k, v && typeof v === 'object' ? JSON.stringify(v) : v])));
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows.length ? rows : [{}]), name.slice(0, 31));
  });
  X.writeFile(wb, 'agbm-backup-' + today + '.xlsx');
}

// Saturday salary statement: days, earned, this week's advance, overall advance, recovered and net pay per worker.
// recovers: { empId: amount staff typed } for workers not yet paid.
export function buildSalaryStatement(P, weekEnd, days, recovers = {}) {
  const lines = P.weekLines(weekEnd);
  const short = (iso) => iso.slice(8) + '/' + iso.slice(5, 7);
  const mark = { Present: 'P', 'Half day': '1/2', Absent: 'A' };
  const body = lines.map((l) => {
    const v = l.paid ? l.paid : { ...P.settle(l, recovers[l.emp.id]), earned: l.earned };
    return [
      l.emp.name, +l.emp.wage || 0, ...days.map((x) => (l.marks[x] ? mark[l.marks[x].status] : '-')), l.worked, v.earned,
      l.weekAdv, l.oldDue, v.cutWeek + v.cutOld, Math.max(0, P.advanceDue(l.emp.id) - (l.paid ? 0 : v.cutWeek + v.cutOld)), v.net,
      l.paid ? 'Paid ' + l.paid.date : 'Due',
    ];
  });
  const total = (i) => body.reduce((s, r) => s + (+r[i] || 0), 0);
  const n = days.length;
  return {
    title: 'Salary statement — week ending ' + weekEnd, file: 'agbm-salary-week-' + weekEnd, orientation: 'landscape',
    lines: ['Week: ' + days[0] + ' to ' + weekEnd + '  (P present, 1/2 half day, A absent)', 'Advance balance after = all advances still due once this week is paid.'],
    sections: [{
      fmt: ['', 'm', ...days.map(() => ''), '', 'm', 'm', 'm', 'm', 'm', 'm', ''],
      head: ['Worker', 'Wage/day', ...days.map(short), 'Days', 'Earned', 'Week advance', 'Overall advance', 'Recovered', 'Advance balance after', 'Net pay', 'Status'],
      body,
      foot: ['Total', '', ...days.map(() => ''), total(n + 2), total(n + 3), total(n + 4), total(n + 5), total(n + 6), total(n + 7), total(n + 8), ''],
    }],
  };
}
