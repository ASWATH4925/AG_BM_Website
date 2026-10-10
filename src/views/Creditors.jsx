import { useState } from 'react';
import Tag from '../components/Tag';
import { M } from '../lib/format';

// Fuel bunks or spares companies as cards: what we owe each and their latest bill.
export default function Creditors({ d, kind, onOpen, onAdd, onReport }) {
  const [q, setQ] = useState('');
  const bunk = kind === 'bunk';
  const all = (d.db.creditors || []).filter((c) => c.kind === kind);
  const needle = q.trim().toLowerCase();
  const list = all
    .filter((c) => !needle || [c.name, c.owner, c.contact, c.code].some((x) => String(x || '').toLowerCase().includes(needle)))
    .map((c) => {
      const bills = d.crBillsOf(c.id);
      return { c, owe: d.crOwed(c), bills: bills.length, last: bills.map((b) => b.date).sort().pop() || '', litres: bills.reduce((s, b) => s + (+b.litres || 0), 0) };
    })
    .sort((a, b) => b.owe - a.owe || a.c.name.localeCompare(b.c.name));
  const total = all.reduce((s, c) => s + Math.max(0, d.crOwed(c)), 0);

  return (
    <section aria-label={bunk ? 'Fuel bunks' : 'Spares companies'}>
      <div className="ag-glass ag-rise" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '1 1 240px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">Search</span>
          <input className="input" type="search" placeholder={bunk ? 'Bunk, owner or phone…' : 'Company, contact or phone…'} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onReport}>{bunk ? 'Fuel report' : 'Purchases report'}</button>
          <button type="button" className="btn btn-primary" onClick={onAdd}>{bunk ? 'New fuel bunk' : 'New spares company'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'space-between', alignItems: 'baseline', margin: 'var(--space-6) 0 var(--space-3)' }}>
        <div className="ag-label">{list.length} of {all.length} {bunk ? 'bunks' : 'companies'}</div>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
          We owe <strong className="ag-tabular" style={{ color: 'var(--color-text)' }}>{M(total)}</strong>
        </div>
      </div>

      <div className="ag-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(230px,100%),1fr))', gap: 'var(--space-4)' }}>
        {list.map(({ c, owe, bills, last, litres }) => (
          <button key={c.id} type="button" className="ag-stat ag-party-card" onClick={() => onOpen(c.id)} aria-label={'Open ' + c.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', textAlign: 'left', overflowWrap: 'anywhere' }}>{c.name}</span>
              {c.status !== 'Active' && <Tag>{c.status}</Tag>}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 2, textAlign: 'left' }}>{c.owner || c.contact || c.code}</div>
            <div className="ag-big" style={{ fontSize: 22, letterSpacing: '-0.035em', marginTop: 14, textAlign: 'left', color: owe > 0.5 ? 'var(--color-text)' : 'var(--color-neutral-600)' }}>
              {owe > 0.5 ? M(owe) : owe < -0.5 ? M(-owe) + ' ahead' : 'Settled'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--color-neutral-700)', marginTop: 6, textAlign: 'left' }}>
              {bills ? bills + (bunk ? ' fills' : ' bills') + (bunk && litres ? ' · ' + Math.round(litres).toLocaleString('en-IN') + ' L' : '') + ' · last ' + last : bunk ? 'No fuel taken yet' : 'No bills yet'}
            </div>
          </button>
        ))}
      </div>
      {list.length === 0 && (
        <div className="ag-glass" style={{ padding: 'var(--space-6)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>{all.length ? 'Nothing matches' : bunk ? 'No fuel bunks yet' : 'No spares companies yet'}</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 2 }}>{all.length ? 'Clear the search.' : 'Add one to start recording ' + (bunk ? 'fuel taken on credit.' : 'purchase bills.')}</div>
        </div>
      )}
    </section>
  );
}
