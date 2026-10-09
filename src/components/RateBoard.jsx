import { isoDate, M } from '../lib/format';
import { OTHER_MATERIAL, rateStatus } from '../lib/domain';
import Panel from './Panel';
import Tag from './Tag';

// Rate periods (₹ per ton) for one party, or the standard rates when custId is ''.
export default function RateBoard({ d, custId, onAdd, onEnd, onDelete }) {
  const today = isoDate();
  const mats = d.salesMaterials();
  const order = (id) => mats.findIndex((m) => m.id === id);
  const cards = d.db.rates
    .filter((r) => r.custId === custId)
    .sort((a, b) => order(a.matId) - order(b.matId) || b.from.localeCompare(a.from));
  const isParty = !!custId;

  return (
    <Panel
      className="ag-rise"
      title={isParty ? 'Rate cards — ₹ per ton' : 'Standard rates — ₹ per ton'}
      sub={isParty
        ? 'A party rate overrides the standard rate on its dates. Every amount is net tons × rate.'
        : 'Used for any party without its own rate on that date. Every amount is net tons × rate.'}
      action={<button type="button" className="btn btn-primary" onClick={() => onAdd('')}>Add rate period</button>}
    >
      <div style={{ padding: 'var(--space-6) var(--space-6) var(--space-4)' }}>
        <div className="ag-label" style={{ marginBottom: 10 }}>In force today · {today}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(170px,100%),1fr))', gap: 'var(--space-3)' }}>
          {mats.map((m) => {
            const r = d.rateFor(custId, m.id, today);
            const std = isParty ? d.rateFor('', m.id, today) : null;
            const other = m.id === OTHER_MATERIAL;
            return (
              <div key={m.id} className="ag-stat" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{m.name}</span>
                  {!other && r.rate > 0 && isParty && <Tag cls={r.src === 'party rate' ? 'ag-t-info' : 'ag-t-mute'}>{r.src === 'party rate' ? 'Own' : 'Std'}</Tag>}
                </div>
                <div className="ag-big" style={{ fontSize: 19, letterSpacing: '-0.03em', marginTop: 8 }}>
                  {other ? 'Per ticket' : r.rate ? M(r.rate) : 'Not set'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 4 }}>
                  {other ? 'Rate typed on each ticket'
                    : r.rate && isParty && r.src === 'party rate' ? 'Standard ' + (std.rate ? M(std.rate) : 'not set')
                      : r.rate ? 'since ' + r.card.from
                        : 'Add a rate period'}
                </div>
                {!other && (
                  <button type="button" className="btn btn-ghost" style={{ marginTop: 6, padding: '4px 6px', fontSize: 12 }} onClick={() => onAdd(m.id)}>
                    {r.rate ? 'Change rate' : 'Set rate'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderTop: '1px solid rgba(32,30,29,.10)' }}>
        <table className="table" style={{ width: '100%', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ cursor: 'default' }}>Material</th>
              <th style={{ cursor: 'default' }}>From</th>
              <th style={{ cursor: 'default' }}>To</th>
              <th style={{ textAlign: 'right', cursor: 'default' }}>Rate / t</th>
              <th style={{ cursor: 'default' }}>Status</th>
              <th style={{ cursor: 'default' }}>Remarks</th>
              <th style={{ cursor: 'default' }}>Set by</th>
              <th style={{ textAlign: 'right', cursor: 'default' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((r) => {
              const st = rateStatus(r, today);
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{d.mat(r.matId).name}</td>
                  <td className="ag-tabular">{r.from}</td>
                  <td className="ag-tabular">{r.to || 'Ongoing'}</td>
                  <td className="ag-tabular" style={{ textAlign: 'right', fontWeight: 600 }}>{M(r.rate)}</td>
                  <td><Tag>{st}</Tag></td>
                  <td style={{ whiteSpace: 'normal', minWidth: 180, color: 'var(--color-neutral-700)' }}>{r.remarks || '—'}</td>
                  <td style={{ color: 'var(--color-neutral-700)' }}>{r.by}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {!r.to && <button type="button" className="btn btn-ghost" onClick={() => onEnd(r)}>End</button>}
                    <button type="button" className="btn btn-ghost" onClick={() => onDelete(r)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {cards.length === 0 && (
        <div style={{ padding: 'var(--space-6)', borderTop: '1px solid rgba(32,30,29,.10)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>No rate periods yet</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 2 }}>
            {isParty ? 'This party pays the standard rate. Add a period to give them their own rate.' : 'Add a period to set the standard rate for a material.'}
          </div>
        </div>
      )}
    </Panel>
  );
}
