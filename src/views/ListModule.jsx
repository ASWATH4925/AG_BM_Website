import Field from '../components/Field';
import Select from '../components/Select';
import StatTile from '../components/StatTile';
import Tag from '../components/Tag';
import { M, N, T } from '../lib/format';
import { listKpis, moduleConfig, MODS } from '../lib/modules';

const NUMERIC = ['money', 'num', 'num2'];
const valueOf = (r, col) => (col.get ? col.get(r) : r[col.k]);

export function filterRows(c, f, db) {
  let rows = (db[c.key] || []).slice();
  if (c.only) rows = rows.filter(c.only);
  const q = f.q.trim().toLowerCase();
  if (q) rows = rows.filter((r) => c.cols.some((col) => String(valueOf(r, col) ?? '').toLowerCase().includes(q)));
  if (c.statusKey && f.status !== 'All') {
    const col = c.cols.find((x) => x.k === c.statusKey);
    rows = rows.filter((r) => String(col && col.get ? col.get(r) : r[c.statusKey]) === f.status);
  }
  if (c.dateKey) {
    if (f.from) rows = rows.filter((r) => r[c.dateKey] >= f.from);
    if (f.to) rows = rows.filter((r) => r[c.dateKey] <= f.to);
  }
  if (f.sortK) {
    const col = c.cols.find((x) => x.k === f.sortK);
    if (col) {
      rows.sort((a, b) => {
        const x = valueOf(a, col);
        const y = valueOf(b, col);
        const n = typeof x === 'number' && typeof y === 'number';
        return (n ? x - y : String(x).localeCompare(String(y))) * f.sortDir;
      });
    }
  }
  return rows;
}

function Cell({ r, col }) {
  const raw = valueOf(r, col);
  const t = col.t || 'text';
  const style = {
    fontVariantNumeric: 'tabular-nums',
    textAlign: NUMERIC.includes(t) ? 'right' : undefined,
    fontWeight: col.k === 'name' || col.k === '_c' || col.k === '_e' ? 600 : undefined,
  };
  if (t === 'tag') return <td style={style}><Tag>{String(raw)}</Tag></td>;
  const v = t === 'money' ? M(raw) : t === 'num2' ? T(raw) : t === 'num' ? N(raw) : raw == null || raw === '' ? '—' : String(raw);
  return <td style={style}>{v}</td>;
}

export default function ListModule({ mod, d, f, setF, onAdd, onEdit, onDelete, onReceipt, onReinstate }) {
  const c = moduleConfig(mod, d);
  const meta = MODS[mod];
  const rows = filterRows(c, f, d.db);
  const all = c.only ? (d.db[c.key] || []).filter(c.only) : d.db[c.key] || [];
  const kpis = listKpis(mod, rows, d);
  const rowAction = mod === 'voids' ? { label: 'Reinstate', run: onReinstate } : c.rowAction ? { label: c.rowAction, run: onReceipt } : null;

  const sortBy = (k) => setF((s) => ({ sortK: k, sortDir: s.sortK === k ? -s.sortDir : 1 }));

  return (
    <section aria-label={meta.title}>
      {kpis.length > 0 && (
        <div className="ag-stagger ag-quad" style={{ marginBottom: 'var(--space-6)' }}>
          {kpis.map((k) => <StatTile key={k.label} {...k} />)}
        </div>
      )}

      <div className="ag-glass ag-rise">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end', padding: 'var(--space-6) var(--space-6) var(--space-4)' }}>
          <Field label="Search" as="label" style={{ flex: '1 1 220px' }}>
            <input
              className="input"
              type="search"
              style={{ width: '100%' }}
              placeholder={'Search ' + meta.label.toLowerCase() + '…'}
              value={f.q}
              onChange={(e) => setF({ q: e.target.value })}
            />
          </Field>
          {c.statusKey && (
            <Field label="Status" style={{ flex: '0 1 170px' }}>
              <Select label="Status" value={f.status} options={c.statuses.map((x) => ({ v: x, l: x }))} onChange={(v) => setF({ status: v })} />
            </Field>
          )}
          {c.dateKey && (
            <>
              <Field label="From" as="label" style={{ flex: '0 1 150px' }}>
                <input className="input" style={{ width: '100%' }} type="date" value={f.from} max={f.to || undefined} onChange={(e) => setF({ from: e.target.value })} />
              </Field>
              <Field label="To" as="label" style={{ flex: '0 1 150px' }}>
                <input className="input" style={{ width: '100%' }} type="date" value={f.to} min={f.from || undefined} onChange={(e) => setF({ to: e.target.value })} />
              </Field>
            </>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setF({ q: '', status: 'All', from: '', to: '', sortK: null })}>Reset</button>
            <button type="button" className="btn btn-primary" onClick={onAdd}>{c.add}</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: 840 }}>
            <thead>
              <tr>
                {c.cols.map((col) => {
                  const active = f.sortK === col.k;
                  return (
                    <th
                      key={col.k}
                      scope="col"
                      tabIndex={0}
                      aria-sort={active ? (f.sortDir === 1 ? 'ascending' : 'descending') : 'none'}
                      style={{ textAlign: NUMERIC.includes(col.t) ? 'right' : 'left' }}
                      onClick={() => sortBy(col.k)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortBy(col.k); } }}
                    >
                      {col.label}{active ? (f.sortDir === 1 ? ' ↑' : ' ↓') : ''}
                    </th>
                  );
                })}
                <th scope="col" style={{ textAlign: 'right', cursor: 'default' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {c.cols.map((col) => <Cell key={col.k} r={r} col={col} />)}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {rowAction && <button type="button" className="btn btn-ghost" onClick={() => rowAction.run(r)}>{rowAction.label}</button>}
                    <button type="button" className="btn btn-ghost" onClick={() => onEdit(r)}>Edit</button>
                    <button type="button" className="btn btn-ghost" onClick={() => onDelete(r)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div style={{ padding: 'var(--space-6)', textAlign: 'left', borderTop: '1px solid rgba(32,30,29,.10)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>Nothing matches these filters</div>
            <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 2 }}>Clear the search or widen the date range.</div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid rgba(32,30,29,.10)', fontSize: 12, color: 'var(--color-neutral-700)' }}>
          <span>{rows.length} of {all.length} records{f.sortK ? ' · sorted' : ''}</span>
          <span className="ag-tabular" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{c.foot(rows)}</span>
        </div>
      </div>
    </section>
  );
}
