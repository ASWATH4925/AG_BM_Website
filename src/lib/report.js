import { settings } from '../config';
import { METHOD_LABEL, paidToLabel } from './payments';

// PDF statements for credit parties. jsPDF is loaded only when a report is generated.
// The built-in PDF fonts have no ₹ glyph, so amounts are written as "Rs.".

const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tons = (n) => Number(n || 0).toFixed(2);
const nowLabel = () => new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const range = (from, to) => (from || 'the beginning') + '  to  ' + (to || 'now');
const fileSafe = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function newDoc(orientation) {
  const { jsPDF } = await import('jspdf');
  const at = await import('jspdf-autotable');
  const autoTable = at.autoTable || at.default;
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  return { doc, autoTable };
}

function header(doc, title, lines) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(236, 48, 19);
  doc.rect(40, 36, 26, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AG', 53, 53, { align: 'center' });
  doc.setTextColor(32, 30, 29);
  doc.setFontSize(15);
  doc.text(settings.companyName, 74, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(96, 93, 93);
  doc.text('Aswath Transports', 74, 62);
  doc.text('Generated ' + nowLabel(), w - 40, 50, { align: 'right' });
  doc.setTextColor(32, 30, 29);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, 40, 92);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  let y = 108;
  lines.filter(Boolean).forEach((l) => { doc.text(l, 40, y); y += 13; });
  return y + 6;
}

function footer(doc) {
  const pages = doc.internal.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(125, 121, 121);
    doc.text(settings.companyName + ' · computer-generated statement', 40, h - 24);
    doc.text('Page ' + i + ' of ' + pages, w - 40, h - 24, { align: 'right' });
  }
}

const TABLE = {
  theme: 'grid',
  styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: [32, 30, 29], lineColor: [215, 211, 211], lineWidth: 0.4 },
  headStyles: { fillColor: [45, 43, 43], textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: [234, 231, 231], textColor: [32, 30, 29], fontStyle: 'bold' },
  margin: { left: 40, right: 40 },
};

function partyLines(party, from, to) {
  return [
    'Party: ' + party.name + '  (' + party.code + ')',
    [party.owner && 'Owner: ' + party.owner, party.contact && 'Contact: ' + party.contact].filter(Boolean).join('    '),
    party.address && 'Address: ' + party.address,
    'Period: ' + range(from, to),
  ];
}

function loadText(d, o) {
  const r = d.orderRate(o);
  let t = 'Load ' + o.ticket + ' · ' + d.matLabel(o) + ' · ' + tons(d.net(o)) + ' t x Rs.' + money(r.rate);
  if (+o.gst) t += ' + GST ' + money(o.gst);
  if (+o.rent) t += ' + rent ' + money(o.rent);
  return t;
}

const payTo = (d, p, company) => (company && p ? ' -> ' + paidToLabel(p, (id) => d.supplier(id).name) : '');

// type: 'statement' | 'loads' | 'payments'; copy: 'party' hides who received the money, 'company' shows it.
export async function partyReport({ d, party, type, from, to, copy }) {
  const company = copy === 'company';
  const titles = { statement: 'Account statement', loads: 'Loads taken', payments: 'Payment history' };
  const wide = type === 'loads';
  const { doc, autoTable } = await newDoc(wide ? 'landscape' : 'portrait');
  const y = header(doc, titles[type] + (company ? ' (company copy)' : ''), partyLines(party, from, to));
  const L = d.ledger(party.id, from, to);

  if (type === 'statement') {
    const body = [['', 'Opening balance', '', '', money(L.opening)]];
    L.rows.forEach((r) => {
      const text = r.kind === 'load' ? loadText(d, r.o)
        : r.kind === 'round' ? 'Round-off on ' + r.ref
          : r.kind === 'receipt' ? 'Receipt · ' + (METHOD_LABEL[r.method] || r.method) + (r.p.ref ? ' · ' + r.p.ref : '') + payTo(d, r.p, company)
            : 'Paid on ' + r.ref + ' · ' + (METHOD_LABEL[r.method] || r.method) + payTo(d, r.p, company);
      body.push([r.ts, text, r.debit ? money(r.debit) : '', r.credit ? money(r.credit) : '', money(r.balance)]);
    });
    autoTable(doc, {
      ...TABLE, startY: y,
      head: [['Date / time', 'Particulars', 'Debit (Rs.)', 'Credit (Rs.)', 'Balance (Rs.)']],
      body,
      foot: [['', 'Totals for the period', money(L.debit), money(L.credit), money(L.closing)]],
      columnStyles: { 0: { cellWidth: 78 }, 2: { halign: 'right', cellWidth: 70 }, 3: { halign: 'right', cellWidth: 70 }, 4: { halign: 'right', cellWidth: 74 } },
    });
    const end = doc.lastAutoTable.finalY + 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text((L.closing > 0 ? 'Balance due: Rs. ' : 'Balance: Rs. ') + money(Math.abs(L.closing)) + (L.closing < 0 ? ' (advance)' : ''), 40, end);
  }

  if (type === 'loads') {
    const loads = L.rows.filter((r) => r.kind === 'load').map((r) => r.o);
    const sum = (f) => loads.reduce((s, o) => s + f(o), 0);
    autoTable(doc, {
      ...TABLE, startY: y,
      head: [['Date / time', 'Ticket', 'Vehicle', 'Material', 'Net t', 'Rate/t', 'Amount', 'GST', 'Rent', 'Bill', 'Paid', 'On credit', 'Payment']],
      body: loads.map((o) => [
        o.date + ' ' + (o.time || ''), o.ticket, o.vehicle, d.matLabel(o), tons(d.net(o)), money(d.orderRate(o).rate), money(d.amount(o)),
        +o.gst ? money(o.gst) : '', +o.rent ? money(o.rent) : '', money(d.billTotal(o)), money(d.paidOn(o)), money(d.onCredit(o)), METHOD_LABEL[o.method] || o.method,
      ]),
      foot: [['Totals', loads.length + ' loads', '', '', tons(sum(d.net)), '', money(sum(d.amount)), money(sum((o) => +o.gst || 0)), money(sum((o) => +o.rent || 0)),
        money(sum(d.billTotal)), money(sum(d.paidOn)), money(sum(d.onCredit)), '']],
      columnStyles: Object.fromEntries([4, 5, 6, 7, 8, 9, 10, 11].map((i) => [i, { halign: 'right' }])),
    });
  }

  if (type === 'payments') {
    const pays = L.rows.filter((r) => r.kind === 'pay' || r.kind === 'receipt');
    const head = ['Date / time', 'Against', 'Method', 'Amount (Rs.)', ...(company ? ['Paid to'] : []), 'Reference', 'Remarks'];
    autoTable(doc, {
      ...TABLE, startY: y,
      head: [head],
      body: pays.map((r) => [
        r.ts, r.kind === 'receipt' ? 'Account receipt' : 'Load ' + r.ref, METHOD_LABEL[r.method] || r.method, money(r.credit),
        ...(company ? [r.p ? paidToLabel(r.p, (id) => d.supplier(id).name) : 'Company'] : []),
        (r.p && r.p.ref) || '', (r.p && r.p.remarks) || '',
      ]),
      foot: [['Total', pays.length + ' payments', '', money(pays.reduce((s, r) => s + r.credit, 0)), ...(company ? [''] : []), '', '']],
      columnStyles: { 3: { halign: 'right' } },
    });
  }

  footer(doc);
  doc.save(fileSafe(party.name) + '-' + type + '-' + (from || 'start').slice(0, 10) + '-to-' + (to || 'now').slice(0, 10) + '.pdf');
}

// One line per credit party for a period: opening, billed, paid, closing.
export async function allPartiesReport({ d, from, to }) {
  const { doc, autoTable } = await newDoc('portrait');
  const y = header(doc, 'Credit parties — balances', ['Period: ' + range(from, to)]);
  const rows = d.db.customers.map((c) => ({ c, L: d.ledger(c.id, from, to) }))
    .filter(({ L }) => L.opening || L.rows.length)
    .sort((a, b) => b.L.closing - a.L.closing);
  autoTable(doc, {
    ...TABLE, startY: y,
    head: [['Party', 'Contact', 'Opening (Rs.)', 'Loads billed (Rs.)', 'Paid (Rs.)', 'Closing (Rs.)']],
    body: rows.map(({ c, L }) => [c.name, c.contact || '', money(L.opening), money(L.debit), money(L.credit), money(L.closing)]),
    foot: [['Total', rows.length + ' parties', ...['opening', 'debit', 'credit', 'closing'].map((k) => money(rows.reduce((s, r) => s + r.L[k], 0)))]],
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  });
  footer(doc);
  doc.save('credit-parties-' + (from || 'start').slice(0, 10) + '-to-' + (to || 'now').slice(0, 10) + '.pdf');
}
