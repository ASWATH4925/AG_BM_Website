import { useState } from 'react';
import Panel from '../components/Panel';
import Select from '../components/Select';
import StatTile from '../components/StatTile';
import Tag from '../components/Tag';
import { TODAY } from '../config';
import { bucketOf, dayBook, modeName } from '../lib/books';
import { buildReport, reportExcel, reportPdf } from '../lib/exports';
import { M } from '../lib/format';

const TH = { cursor: 'default' };
const R = { textAlign: 'right' };
const SHOW = [
  { v: 'all', l: 'Cash, bank & UPI' },
  { v: 'cash', l: 'Cash only' },
  { v: 'bank', l: 'Bank & UPI only' },
];
const KIND_TAG = { 'Credit party': 'ag-t-ok', 'Walk-in': 'ag-t-info', 'Other income': 'ag-t-ok', Expense: 'ag-t-bad', 'Soling supplier': 'ag-t-warn', Wages: 'ag-t-warn', 'Fuel bunk': 'ag-t-warn', Spares: 'ag-t-warn' };

// Cash book: every rupee in and out for a day or a period, with cash-in-hand and bank balances.
export default function DayBook({ d, onSetOpening, onAddExpense, onEditExpense, onDeleteExpense, onOpenParty, onOpenSupplier }) {
  const [from, setFrom] = useState(TODAY);
  const [to, setTo] = useState(TODAY);
  const [show, setShow] = useState('all');
  const [busy, setBusy] = useState('');
  const b = dayBook(d, from, to);
  const keep = (f) => show === 'all' || bucketOf(f.mode) === show;
  const rows = b.rows.filter(keep);
  const open = show === 'all' ? b.opening.cash + b.opening.bank : b.opening[show];
  let bal = open;
  const lines = rows.map((f) => { bal += f.dir === 'in' ? f.amount : -f.amount; return { f, bal }; });
  const tin = rows.filter((f) => f.dir === 'in').reduce((s, f) => s + f.amount, 0);
  const tout = rows.filter((f) => f.dir === 'out').reduce((s, f) => s + f.amount, 0);
  const st = d.db.settings || {};
  const one = from && from === to;

  const download = async (kind) => {
    setBusy(kind);
    try {
      const rep = buildReport('daybook', d, from, to);
      if (kind === 'pdf') await reportPdf(rep); else await reportExcel(rep);
    } finally { setBusy(''); }
  };
  const openWho = (f) => {
    if ((f.src === 'payments' || f.src === 'orders') && f.rec.custId) onOpenParty(f.rec.custId);
    else if (f.src === 'supPayments') onOpenSupplier(f.rec.supplierId);
  };

  return (
    <section aria-label="Day book">
      <div className="ag-glass ag-rise" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '0 1 160px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">From</span>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field" style={{ flex: '0 1 160px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">To</span>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="field" style={{ flex: '0 1 200px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">Show</span>
          <Select label="Show" value={show} options={SHOW} onChange={setShow} />
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => { setFrom(TODAY); setTo(TODAY); }}>Today</button>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onSetOpening}>Opening balances</button>
          <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => download('xlsx')}>{busy === 'xlsx' ? 'Preparing…' : 'Excel'}</button>
          <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => download('pdf')}>{busy === 'pdf' ? 'Preparing…' : 'PDF'}</button>
          <button type="button" className="btn btn-primary" onClick={onAddExpense}>Add expense / income</button>
        </div>
      </div>

      <div className="ag-stagger ag-quad" style={{ marginTop: 'var(--space-6)' }}>
        <StatTile label={'Cash in hand ' + (one ? 'at start of day' : 'at start')} value={M(b.opening.cash)} note={'Bank & UPI ' + M(b.opening.bank)} />
        <StatTile label="Money in" value={M(b.totals.cash.in + b.totals.bank.in)} note={'Cash ' + M(b.totals.cash.in) + ' · bank & UPI ' + M(b.totals.bank.in)} />
        <StatTile label="Money out" value={M(b.totals.cash.out + b.totals.bank.out)} note={'Cash ' + M(b.totals.cash.out) + ' · bank & UPI ' + M(b.totals.bank.out)} />
        <StatTile label={'Cash in hand ' + (one ? 'at end of day' : 'at end')} value={M(b.closing.cash)} note={'Bank & UPI ' + M(b.closing.bank)} />
      </div>
      {!st.startDate && !(+st.cashStart) && (
        <div style={{ marginTop: 'var(--space-3)', fontSize: 12.5, color: '#8a5207' }}>
          Balances start from ₹0. Use “Opening balances” to enter the cash in hand and bank balance on the day you start using the day book.
        </div>
      )}

      <Panel className="ag-rise" style={{ marginTop: 'var(--space-6)' }} title="Money in and out" sub={rows.length + ' entries · in ' + M(tin) + ' · out ' + M(tout)}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={TH}>Date / time</th><th style={TH}>Type</th><th style={TH}>Particulars</th><th style={TH}>Party / paid to</th><th style={TH}>Mode</th>
                <th style={{ ...TH, ...R }}>In</th><th style={{ ...TH, ...R }}>Out</th><th style={{ ...TH, ...R }}>Balance</th><th style={TH}>Reference / remarks</th><th style={{ ...TH, ...R }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td /><td /><td style={{ fontWeight: 700 }}>Opening balance</td><td /><td /><td /><td />
                <td className="ag-tabular" style={{ ...R, fontWeight: 700 }}>{M(open)}</td><td /><td />
              </tr>
              {lines.map(({ f, bal: running }, i) => (
                <tr key={f.src + (f.rec.id || i)}>
                  <td className="ag-tabular">{f.date} {f.time}</td>
                  <td><Tag cls={KIND_TAG[f.kind]}>{f.kind}</Tag></td>
                  <td style={{ fontWeight: 600 }}>{f.what}</td>
                  <td>
                    {(f.rec.custId || f.src === 'supPayments')
                      ? <button type="button" className="btn btn-ghost" style={{ padding: '2px 4px' }} onClick={() => openWho(f)}>{f.who}</button>
                      : f.who}
                  </td>
                  <td>{modeName(f.mode)}</td>
                  <td className="ag-tabular" style={{ ...R, color: '#1d6b3a' }}>{f.dir === 'in' ? M(f.amount) : ''}</td>
                  <td className="ag-tabular" style={{ ...R, color: 'var(--color-accent-700)' }}>{f.dir === 'out' ? M(f.amount) : ''}</td>
                  <td className="ag-tabular" style={{ ...R, fontWeight: 600 }}>{M(running)}</td>
                  <td style={{ whiteSpace: 'normal', minWidth: 150, color: 'var(--color-neutral-700)' }}>{f.ref || f.remarks || '—'}</td>
                  <td style={{ ...R, whiteSpace: 'nowrap' }}>
                    {f.src === 'expenses' && (
                      <>
                        <button type="button" className="btn btn-ghost" onClick={() => onEditExpense(f.rec)}>Edit</button>
                        <button type="button" className="btn btn-ghost" onClick={() => onDeleteExpense(f.rec)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={5} style={{ padding: '12px 24px' }}>Closing balance</td>
                <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{M(tin)}</td>
                <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{M(tout)}</td>
                <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{M(open + tin - tout)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        {rows.length === 0 && <div style={{ padding: 'var(--space-6)', borderTop: '1px solid rgba(32,30,29,.10)', fontSize: 13, color: 'var(--color-neutral-700)' }}>No money came in or went out in this period.</div>}
      </Panel>

      {b.direct.length > 0 && (
        <Panel className="ag-rise" style={{ marginTop: 'var(--space-6)' }} title="Paid straight to others" sub="Parties paid these to a soling supplier or someone else — not in our cash or bank, but settled on their accounts">
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 760 }}>
              <thead>
                <tr><th style={TH}>Date / time</th><th style={TH}>Paid by</th><th style={TH}>Paid to</th><th style={TH}>Mode</th><th style={{ ...TH, ...R }}>Amount</th><th style={TH}>Reference</th></tr>
              </thead>
              <tbody>
                {b.direct.map((x) => (
                  <tr key={x.rec.id}>
                    <td className="ag-tabular">{x.date} {x.time}</td>
                    <td style={{ fontWeight: 600 }}>{x.who}</td>
                    <td>{x.to}</td>
                    <td>{modeName(x.mode)}</td>
                    <td className="ag-tabular" style={{ ...R, fontWeight: 600 }}>{M(x.amount)}</td>
                    <td>{x.ref || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </section>
  );
}
