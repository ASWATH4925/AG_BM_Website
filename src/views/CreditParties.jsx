import { useState } from 'react';
import Select from '../components/Select';
import Tag from '../components/Tag';
import { M } from '../lib/format';

const SORTS = [
  { v: 'name', l: 'Name A–Z' },
  { v: 'owe', l: 'Most outstanding' },
  { v: 'recent', l: 'Latest load' },
];
const SHOW = [
  { v: 'all', l: 'All parties' },
  { v: 'owing', l: 'Owing money' },
  { v: 'clear', l: 'Nothing due' },
  { v: 'hold', l: 'On hold' },
];

// Credit parties as simple cards: name, what they owe, last load. Opening a card shows the full account.
export default function CreditParties({ d, onOpen, onAdd, onReport }) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState('all');
  const [sort, setSort] = useState('name');
  const lastLoad = (c) => d.loadsOf(c.id).map((o) => o.date + ' ' + (o.time || '')).sort().pop() || '';

  let parties = d.db.customers.map((c) => ({ c, owe: d.outstanding(c), last: lastLoad(c), loads: d.loadsOf(c.id).length }));
  const needle = q.trim().toLowerCase();
  if (needle) parties = parties.filter(({ c }) => [c.name, c.owner, c.contact, c.code].some((x) => String(x || '').toLowerCase().includes(needle)));
  if (show === 'owing') parties = parties.filter((p) => p.owe > 0);
  if (show === 'clear') parties = parties.filter((p) => p.owe === 0);
  if (show === 'hold') parties = parties.filter((p) => p.c.status === 'On hold');
  parties.sort((a, b) => (sort === 'owe' ? b.owe - a.owe : sort === 'recent' ? b.last.localeCompare(a.last) : a.c.name.localeCompare(b.c.name)));

  const total = d.db.customers.reduce((s, c) => s + d.outstanding(c), 0);
  const owing = d.db.customers.filter((c) => d.outstanding(c) > 0).length;

  return (
    <section aria-label="Credit parties">
      <div className="ag-glass ag-rise" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '1 1 240px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">Search</span>
          <input className="input" type="search" placeholder="Party, owner or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
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
          <button type="button" className="btn btn-secondary" onClick={onReport}>All-parties report</button>
          <button type="button" className="btn btn-primary" onClick={onAdd}>New credit party</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'space-between', alignItems: 'baseline', margin: 'var(--space-6) 0 var(--space-3)' }}>
        <div className="ag-label">{parties.length} of {d.db.customers.length} parties</div>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
          <strong className="ag-tabular" style={{ color: 'var(--color-text)' }}>{M(total)}</strong> outstanding across {owing} parties
        </div>
      </div>

      <div className="ag-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(230px,100%),1fr))', gap: 'var(--space-4)' }}>
        {parties.map(({ c, owe, last, loads }) => (
          <button key={c.id} type="button" className="ag-stat ag-party-card" onClick={() => onOpen(c.id)} aria-label={'Open ' + c.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', textAlign: 'left', overflowWrap: 'anywhere' }}>{c.name}</span>
              {c.status !== 'Active' && <Tag>{c.status}</Tag>}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 2, textAlign: 'left' }}>{c.owner || c.code}</div>
            <div className="ag-big" style={{ fontSize: 22, letterSpacing: '-0.035em', marginTop: 14, textAlign: 'left', color: owe > 0 ? 'var(--color-text)' : 'var(--color-neutral-600)' }}>
              {owe > 0 ? M(owe) : 'Nothing due'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--color-neutral-700)', marginTop: 6, textAlign: 'left' }}>
              {loads ? loads + ' load' + (loads === 1 ? '' : 's') + ' · last ' + last.slice(0, 10) : 'No loads yet'}
            </div>
          </button>
        ))}
      </div>
      {parties.length === 0 && (
        <div className="ag-glass" style={{ padding: 'var(--space-6)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>No party matches</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 2 }}>Clear the search or change “Show”.</div>
        </div>
      )}
    </section>
  );
}
