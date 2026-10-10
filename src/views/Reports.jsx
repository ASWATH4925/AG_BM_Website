import { useState } from 'react';
import Panel from '../components/Panel';
import StatTile from '../components/StatTile';
import { TODAY } from '../config';
import { profitSummary, salesSummary } from '../lib/books';
import { buildReport, exportAll, reportExcel, reportPdf, REPORTS } from '../lib/exports';
import { M, pad2, T, U } from '../lib/format';

const TH = { cursor: 'default' };
const R = { textAlign: 'right' };

// Quick ranges, counted from the yard's today. The financial year starts on 1 April.
function presets() {
  const [y, m] = TODAY.split('-').map(Number);
  const last = (yy, mm) => new Date(yy, mm, 0).getDate();
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  const fy = m >= 4 ? y : y - 1;
  return [
    { l: 'Today', from: TODAY, to: TODAY },
    { l: 'This month', from: y + '-' + pad2(m) + '-01', to: TODAY },
    { l: 'Last month', from: py + '-' + pad2(pm) + '-01', to: py + '-' + pad2(pm) + '-' + pad2(last(py, pm)) },
    { l: 'This financial year', from: fy + '-04-01', to: TODAY },
    { l: 'All time', from: '', to: '' },
  ];
}

export default function Reports({ d, onToast }) {
  const ranges = presets();
  const [from, setFrom] = useState(ranges[1].from);
  const [to, setTo] = useState(ranges[1].to);
  const [busy, setBusy] = useState('');
  const p = profitSummary(d, from, to);
  const s = salesSummary(d, from, to);

  const run = async (kind, as) => {
    setBusy(kind + as);
    try {
      const rep = buildReport(kind, d, from, to);
      if (as === 'pdf') await reportPdf(rep); else await reportExcel(rep);
      onToast(rep.title + ' downloaded.');
    } catch (err) {
      onToast('Could not make the report: ' + err.message);
    } finally { setBusy(''); }
  };
  const backup = async () => {
    setBusy('backup');
    try { await exportAll(d.db, TODAY); onToast('Backup downloaded — keep the file somewhere safe.'); } finally { setBusy(''); }
  };

  return (
    <section aria-label="Reports">
      <div className="ag-glass ag-rise" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '0 1 160px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">From</span>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field" style={{ flex: '0 1 160px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">To</span>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {ranges.map((r) => (
            <button key={r.l} type="button" className={'btn ' + (r.from === from && r.to === to ? 'btn-primary' : 'btn-ghost')} onClick={() => { setFrom(r.from); setTo(r.to); }}>{r.l}</button>
          ))}
        </div>
      </div>

      <div className="ag-stagger ag-quad" style={{ marginTop: 'var(--space-6)' }}>
        <StatTile label="Sales billed" value={M(p.sales)} note={U(s.tons) + ' units · ' + T(s.tons) + ' t · ' + s.loads.length + ' loads'} />
        <StatTile label="Soling bought" value={M(p.soling)} note="Boulders from suppliers" />
        <StatTile label="Expenses" value={M(p.expenses)} note={'Other income ' + M(p.income)} />
        <StatTile label={p.net >= 0 ? 'Profit (rough)' : 'Loss (rough)'} value={M(Math.abs(p.net))} note="Sales − soling − expenses + income" />
      </div>

      <Panel className="ag-rise" style={{ marginTop: 'var(--space-6)' }} title="Download reports" sub={'For ' + (from || 'the beginning') + ' to ' + (to || 'now') + ' · PDF to print or send, Excel to work with the numbers'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap: 'var(--space-4)', padding: 'var(--space-6)' }}>
          {REPORTS.map((r) => (
            <div key={r.v} className="ag-stat" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15.5 }}>{r.l}</div>
              <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', flex: 1 }}>{r.sub}</div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => run(r.v, 'pdf')}>{busy === r.v + 'pdf' ? 'Preparing…' : 'PDF'}</button>
                <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => run(r.v, 'xlsx')}>{busy === r.v + 'xlsx' ? 'Preparing…' : 'Excel'}</button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="ag-rise" style={{ marginTop: 'var(--space-6)' }} title="Sales by material" sub="1 unit = 4 tons">
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: 620 }}>
            <thead>
              <tr><th style={TH}>Material</th><th style={{ ...TH, ...R }}>Loads</th><th style={{ ...TH, ...R }}>Units</th><th style={{ ...TH, ...R }}>Tons</th><th style={{ ...TH, ...R }}>Value</th></tr>
            </thead>
            <tbody>
              {s.byMat.map((m) => (
                <tr key={m.label}>
                  <td style={{ fontWeight: 600 }}>{m.label}</td>
                  <td className="ag-tabular" style={R}>{m.loads}</td>
                  <td className="ag-tabular" style={{ ...R, fontWeight: 600 }}>{U(m.tons)}</td>
                  <td className="ag-tabular" style={R}>{T(m.tons)}</td>
                  <td className="ag-tabular" style={R}>{M(m.value)}</td>
                </tr>
              ))}
            </tbody>
            {s.byMat.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ padding: '12px 24px' }}>Total</td>
                  <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{s.loads.length}</td>
                  <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{U(s.tons)}</td>
                  <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{T(s.tons)}</td>
                  <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{M(s.value)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {s.byMat.length === 0 && <div style={{ padding: 'var(--space-6)', borderTop: '1px solid rgba(32,30,29,.10)', fontSize: 13, color: 'var(--color-neutral-700)' }}>No sales in this period.</div>}
      </Panel>

      <Panel
        className="ag-rise"
        style={{ marginTop: 'var(--space-6)' }}
        title="Backup"
        sub="All records are kept in this browser for now. Download a full copy regularly (every sheet of the workbook is one kind of record)."
        action={<button type="button" className="btn btn-primary" disabled={!!busy} onClick={backup}>{busy === 'backup' ? 'Preparing…' : 'Download full backup (Excel)'}</button>}
      >
        <div style={{ padding: 'var(--space-3) var(--space-6) var(--space-6)', fontSize: 12.5, color: 'var(--color-neutral-700)' }}>
          {d.db.orders.length} loads · {(d.db.payments || []).length} payments · {(d.db.purchases || []).length} soling loads · {(d.db.expenses || []).length} expenses · {d.db.customers.length} credit parties
        </div>
      </Panel>
    </section>
  );
}
