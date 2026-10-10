import { useState } from 'react';
import Select from '../components/Select';
import { M } from '../lib/format';

const TH = { cursor: 'default' };

// Everything deleted anywhere, with who removed it, when and why. Any entry can be restored.
export default function VoidedEntries({ d, onRestore, onReinstate }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const marked = d.db.orders.filter((o) => o.status === 'Void').map((o) => ({
    id: 'V-' + o.id, at: o.date + 'T' + (o.time || '00:00'), by: o.by || '—', reason: o.reason || '—', kind: 'Load marked void',
    label: o.ticket + ' · ' + d.partyLabel(o) + ' · ' + d.matLabel(o), amount: d.billTotal(o), order: o,
  }));
  const all = (d.db.voided || []).concat(marked).sort((a, b) => b.at.localeCompare(a.at));
  const kinds = ['All'].concat([...new Set(all.map((e) => e.kind))]);
  const needle = q.trim().toLowerCase();
  const rows = all.filter((e) => (kind === 'All' || e.kind === kind)
    && (!needle || [e.label, e.reason, e.by, e.kind].some((x) => String(x || '').toLowerCase().includes(needle)))
    && (!from || e.at.slice(0, 10) >= from) && (!to || e.at.slice(0, 10) <= to));

  return (
    <section aria-label="Voided entries">
      <div className="ag-glass ag-rise">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end', padding: 'var(--space-6) var(--space-6) var(--space-4)' }}>
          <label className="field" style={{ flex: '1 1 220px', minWidth: 0 }}>
            <span className="ag-label ag-field-label">Search</span>
            <input className="input" type="search" placeholder="Ticket, party, reason…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="field" style={{ flex: '0 1 200px', minWidth: 0 }}>
            <span className="ag-label ag-field-label">Type</span>
            <Select label="Type" value={kind} options={kinds.map((k) => ({ v: k, l: k }))} onChange={setKind} />
          </div>
          <label className="field" style={{ flex: '0 1 150px', minWidth: 0 }}>
            <span className="ag-label ag-field-label">From</span>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field" style={{ flex: '0 1 150px', minWidth: 0 }}>
            <span className="ag-label ag-field-label">To</span>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={TH}>Voided on</th><th style={TH}>Type</th><th style={TH}>Entry</th><th style={{ ...TH, textAlign: 'right' }}>Amount</th>
                <th style={TH}>Reason</th><th style={TH}>By</th><th style={{ ...TH, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="ag-tabular">{e.at.slice(0, 16).replace('T', ' ')}</td>
                  <td style={{ fontWeight: 600 }}>{e.kind}</td>
                  <td style={{ whiteSpace: 'normal', minWidth: 220 }}>{e.label}</td>
                  <td className="ag-tabular" style={{ textAlign: 'right' }}>{e.amount ? M(e.amount) : '—'}</td>
                  <td style={{ whiteSpace: 'normal', minWidth: 160, color: 'var(--color-neutral-700)' }}>{e.reason || '—'}</td>
                  <td>{e.by}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => (e.order ? onReinstate(e.order) : onRestore(e))}>Restore</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div style={{ padding: 'var(--space-6)', borderTop: '1px solid rgba(32,30,29,.10)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>Nothing voided{all.length ? ' matches these filters' : ' yet'}</div>
            <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 2 }}>Anything deleted — loads, payments, parties, rates, import rows — is kept here and can be restored.</div>
          </div>
        )}
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid rgba(32,30,29,.10)', fontSize: 12, color: 'var(--color-neutral-700)' }}>
          {rows.length} of {all.length} voided entries
        </div>
      </div>
    </section>
  );
}
