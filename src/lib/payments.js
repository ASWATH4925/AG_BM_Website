// How a sale was paid: on credit, in one payment, or split across several.
// A payment line is cash, UPI (sent to a soling supplier, a fuel bunk / spares company, the company or someone else) or into the company's bank account.

export const PAY_MODES = ['Credit', 'Cash', 'UPI', 'Account', 'Split'];
export const LINE_METHODS = ['Cash', 'UPI', 'Account'];
export const METHOD_LABEL = { Credit: 'Credit', Cash: 'Cash', UPI: 'UPI', Account: 'Bank / Account', Split: 'Split' };

export const emptyLine = (method = 'Cash', amount = '') => ({ method, amount, toType: method === 'UPI' ? 'supplier' : 'company', supplierId: '', creditorId: '', toName: '', remarks: '' });

export const round2 = (n) => Math.round((+n || 0) * 100) / 100;

// Default payment for a sale: credit parties go on credit, cash-serial / walk-in sales are paid in full in cash.
export function defaultPay(bill, { walkIn, cashSerial }) {
  if (walkIn || cashSerial) return { mode: 'Cash', lines: [emptyLine('Cash', round2(bill))], roundOff: '', remarks: '' };
  return { mode: 'Credit', lines: [], roundOff: '', remarks: '' };
}

// Checks a payment against the bill. Returns field errors plus what was paid and what stays on credit.
export function checkPay(pay, bill, { walkIn }) {
  const errors = {};
  const lines = pay.mode === 'Credit' ? [] : pay.lines;
  let paid = 0;
  lines.forEach((l, i) => {
    const a = +l.amount;
    if (!(a > 0)) errors['amount' + i] = 'Enter an amount greater than zero.';
    else paid += a;
    if (l.method === 'UPI' && l.toType === 'supplier' && !l.supplierId) errors['to' + i] = 'Choose who received it.';
    if (l.method === 'UPI' && l.toType === 'creditor' && !l.creditorId) errors['to' + i] = 'Choose who received it.';
    if (l.method === 'UPI' && l.toType === 'other' && !String(l.toName || '').trim()) errors['to' + i] = 'Type who received it.';
  });
  if (pay.mode === 'Split' && lines.length < 2) errors.lines = 'A split needs at least two payment lines.';
  const roundOff = +pay.roundOff || 0;
  if (roundOff < 0) errors.roundOff = 'Round-off cannot be negative.';
  paid = round2(paid);
  const credit = round2(bill - paid - roundOff);
  if (credit < -0.005) errors.total = 'Paid plus round-off is more than the bill.';
  else if (walkIn && credit > 0.005) errors.total = 'A walk-in customer has no credit account — the payment must cover the bill (use round-off for a small difference).';
  return { errors: Object.keys(errors).length ? errors : null, paid, roundOff, credit: Math.max(0, credit) };
}

// Short label for lists: "Credit", "Cash", "UPI", "Split", or e.g. "Cash + credit".
export function payLabel(pay, credit) {
  if (pay.mode === 'Credit') return 'Credit';
  const base = METHOD_LABEL[pay.mode];
  return credit > 0.005 ? base + ' + credit' : base;
}

// Tickets saved before payments were recorded line by line: a non-credit method meant paid in full.
export const isPaidMethod = (m) => m === 'Cash' || m === 'UPI' || m === 'Account' || m === 'Bank Transfer';

// Turns an edited payment into stored payment records for a ticket.
export function toRecords(pay, ticket, by) {
  if (pay.mode === 'Credit') return [];
  return pay.lines.map((l, i) => ({
    id: 'Y' + Date.now() + '-' + i,
    date: ticket.date, time: ticket.time || '', ticketId: ticket.id, custId: ticket.custId || '', walkIn: ticket.walkIn || '',
    method: l.method, amount: round2(l.amount),
    toType: l.method === 'UPI' ? l.toType : 'company',
    supplierId: l.method === 'UPI' && l.toType === 'supplier' ? l.supplierId : '',
    creditorId: l.method === 'UPI' && l.toType === 'creditor' ? l.creditorId : '',
    toName: l.method === 'UPI' && l.toType === 'other' ? String(l.toName).trim() : '',
    remarks: String(l.remarks || '').trim(), by,
  }));
}

// Rebuilds the editable payment from a ticket and its stored records.
export function fromRecords(ticket, records) {
  const lines = records.map((r) => ({
    method: r.method, amount: r.amount, toType: r.toType || 'company', supplierId: r.supplierId || '', creditorId: r.creditorId || '', toName: r.toName || '', remarks: r.remarks || '',
  }));
  const mode = !lines.length ? 'Credit' : lines.length > 1 ? 'Split' : lines[0].method;
  return { mode, lines, roundOff: ticket.roundOff ? String(ticket.roundOff) : '', remarks: ticket.payRemarks || '' };
}

// Where a payment went, for the company's own view. creditorName gives a fuel bunk's or spares company's name and kind.
export function paidToLabel(r, supplierName, creditorName = () => '—') {
  if (r.toType === 'supplier') return supplierName(r.supplierId) + ' (soling)';
  if (r.toType === 'creditor') return creditorName(r.creditorId);
  if (r.toType === 'other') return r.toName + ' (other)';
  if (r.method === 'UPI') return 'Company UPI';
  return r.method === 'Account' ? 'Company account' : 'Company (cash)';
}
