import { useState } from 'react';
import Select from '../components/Select';
import Tag from '../components/Tag';
import { M } from '../lib/format';

const SORTS = [
  { v: 'name', l: 'Name A–Z' },
  { v: 'owe', l: 'We owe most' },
  { v: 'recent', l: 'Latest load' },
];
const SHOW = [
  { v: 'all', l: 'All suppliers' },
  { v: 'owe', l: 'We owe them' },
  { v: 'clear', l: 'Settled' },
  { v: 'ahead', l: 'Paid ahead' },
];

// Soling suppliers as cards: what we owe each one and their last load. Opening a card shows the full account.
export default function SolingSuppliers({ d, onOpen, onAdd, onReport }) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState('all');
  const [sort, setSort] = useState('name');
  const all = d.db.suppliers || [];
  const lastLoad = (p) => d.solLoadsOf(p.id).map((u) => u.date + ' ' + (u.time || '')).sort().pop() || '';

  let list = all.map((p) => ({ p, owe: d.owed(p), last: lastLoad(p), loads: d.solLoadsOf(p.id).length }));
  const needle = q.trim().toLowerCase();
  if (needle) list = list.filter(({ p }) => [p.name, p.owner, p.contact, p.code, p.upi].some((x) => String(x || '').toLowerCase().includes(needle)));
  if (show === 'owe') list = list.filter((x) => x.owe > 0.5);
  if (show === 'clear') list = list.filter((x) => Math.abs(x.owe) <= 0.5);
  if (show === 'ahead') list = list.filter((x) => x.owe < -0.5);
  list.sort((a, b) => (sort === 'owe' ? b.owe - a.owe : sort === 'recent' ? b.last.localeCompare(a.last) : a.p.name.localeCompare(b.p.name)));

  const total = all.reduce((s, p) => s + Math.max(0, d.owed(p)), 0);
  const owing = all.filter((p) => d.owed(p) > 0.5).length;

  return (
    <section aria-label="Soling suppliers">
      <div className="ag-glass ag-rise" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '1 1 240px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">Search</span>
          <input className="input" type="search" placeholder="Supplier, owner, phone or UPI…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="field" style={{ flex: '0 1 180px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">Show</span>
          <Select label="Show" value={show} options={SHOW} onChange={setShow} />
        </div>
        <div className="field" style={{ flex: '0 1 180px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">Sort</span>
          <Select label="Sort" value={sort} options={SORTS} onChange={setSort} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onReport}>All-suppliers report</button>
          <button type="button" className="btn btn-primary" onClick={onAdd}>New soling supplier</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'space-between', alignItems: 'baseline', margin: 'var(--space-6) 0 var(--space-3)' }}>
        <div className="ag-label">{list.length} of {all.length} suppliers</div>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
          We owe <strong className="ag-tabular" style={{ color: 'var(--color-text)' }}>{M(total)}</strong> across {owing} supplier{owing === 1 ? '' : 's'}
        </div>
      </div>

      <div className="ag-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(230px,100%),1fr))', gap: 'var(--space-4)' }}>
        {list.map(({ p, owe, last, loads }) => (
          <button key={p.id} type="button" className="ag-stat ag-party-card" onClick={() => onOpen(p.id)} aria-label={'Open ' + p.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', textAlign: 'left', overflowWrap: 'anywhere' }}>{p.name}</span>
              {p.status !== 'Active' && <Tag>{p.status}</Tag>}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 2, textAlign: 'left' }}>
              {[p.owner || p.code, p.linkedCustId && 'also a credit party'].filter(Boolean).join(' · ')}
            </div>
            <div className="ag-big" style={{ fontSize: 22, letterSpacing: '-0.035em', marginTop: 14, textAlign: 'left', color: owe > 0.5 ? 'var(--color-text)' : 'var(--color-neutral-600)' }}>
              {owe > 0.5 ? M(owe) : owe < -0.5 ? M(-owe) + ' ahead' : 'Settled'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--color-neutral-700)', marginTop: 6, textAlign: 'left' }}>
              {loads ? loads + ' load' + (loads === 1 ? '' : 's') + ' · last ' + last.slice(0, 10) : 'No soling loads yet'}
            </div>
          </button>
        ))}
      </div>
      {list.length === 0 && (
        <div className="ag-glass" style={{ padding: 'var(--space-6)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>{all.length ? 'No supplier matches' : 'No soling suppliers yet'}</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 2 }}>{all.length ? 'Clear the search or change “Show”.' : 'Add one, or pick “Add as a soling supplier” on a register row.'}</div>
        </div>
      )}
    </section>
  );
}
