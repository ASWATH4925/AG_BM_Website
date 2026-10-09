import Panel from '../components/Panel';
import RateBoard from '../components/RateBoard';
import StatTile from '../components/StatTile';
import Tag from '../components/Tag';
import { M, T } from '../lib/format';

const TABS = ['Rates', 'Tickets'];

function BackLink({ label, onClick }) {
  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{ padding: '6px 8px', marginBottom: 'var(--space-4)', color: 'var(--color-neutral-700)' }}
      onClick={onClick}
    >
      ← {label}
    </button>
  );
}

function Info({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="ag-label">{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4, overflowWrap: 'anywhere', color: value ? 'var(--color-text)' : 'var(--color-neutral-600)' }}>
        {value || 'Not added yet'}
      </div>
    </div>
  );
}

// One credit party: who they are, their rate periods and their tickets.
export default function PartyDetail({ d, party, tab, setTab, onBack, onEdit, onAddRate, onEndRate, onDeleteRate, onOpenSuppliers }) {
  const tickets = d.db.orders.filter((o) => o.custId === party.id).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const credit = tickets.filter((o) => o.method === 'Credit' && o.status !== 'Void');
  const supplier = (d.db.suppliers || []).find((p) => p.linkedCustId === party.id);

  return (
    <section aria-label={party.name}>
      <BackLink label="All credit parties" onClick={onBack} />

      <div className="ag-glass ag-rise">
        <div className="ag-head ag-head-row">
          <div>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {party.name} <Tag>{party.status}</Tag>
            </h4>
            <div className="ag-head-sub">{party.code} · Credit party</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onEdit}>Edit details</button>
        </div>
        <div style={{ padding: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(200px,100%),1fr))', gap: 'var(--space-4)' }}>
          <Info label="Owner" value={party.owner} />
          <Info label="Contact" value={party.contact} />
          <Info label="Address" value={party.address} />
          <Info label="GSTIN" value={party.gst} />
        </div>
        {(party.remarks || supplier) && (
          <div style={{ padding: '0 var(--space-6) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {party.remarks && (
              <div style={{ fontSize: 13, color: 'var(--color-neutral-800)' }}>
                <span className="ag-label" style={{ marginRight: 8 }}>Remarks</span>{party.remarks}
              </div>
            )}
            {supplier && (
              <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 'var(--ag-r-sm)', background: 'rgba(47,79,212,.07)', border: '1px solid rgba(47,79,212,.2)', color: '#1f3a9e' }}>
                Also supplies soling as <strong>{supplier.name}</strong> ({supplier.code}). That is a separate account — what we owe them is never set against what they owe us.{' '}
                <button type="button" className="btn btn-ghost" style={{ padding: '2px 6px' }} onClick={onOpenSuppliers}>Soling suppliers</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ag-stagger ag-quad" style={{ marginTop: 'var(--space-6)' }}>
        <StatTile label="Outstanding" value={M(d.outstanding(party))} note="Billed minus received" />
        <StatTile label="Billed" value={M(d.billed(party))} note={credit.length + ' credit tickets'} />
        <StatTile label="Received" value={M(party.received || 0)} note={'Last receipt ' + (party.last || '—')} />
        <StatTile label="Tonnage" value={T(credit.reduce((s, o) => s + d.net(o), 0)) + ' t'} note="On credit tickets" />
      </div>

      <div role="tablist" aria-label="Party sections" style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid rgba(32,30,29,.10)', margin: 'var(--space-6) 0' }}>
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="ag-tab" data-on={tab === t ? '1' : '0'} onClick={() => setTab(t)}>
            {t}<i />
          </button>
        ))}
      </div>

      {tab === 'Rates' && <RateBoard d={d} custId={party.id} onAdd={onAddRate} onEnd={onEndRate} onDelete={onDeleteRate} />}

      {tab === 'Tickets' && (
        <Panel className="ag-rise" title="Tickets" sub="Every load weighed for this party, priced at the rate in force on its date">
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 820 }}>
              <thead>
                <tr>
                  <th style={{ cursor: 'default' }}>Date</th><th style={{ cursor: 'default' }}>Ticket</th><th style={{ cursor: 'default' }}>Material</th>
                  <th style={{ cursor: 'default' }}>Vehicle</th><th style={{ textAlign: 'right', cursor: 'default' }}>Net (t)</th>
                  <th style={{ textAlign: 'right', cursor: 'default' }}>Rate / t</th><th style={{ cursor: 'default' }}>Rate from</th>
                  <th style={{ textAlign: 'right', cursor: 'default' }}>Amount</th><th style={{ cursor: 'default' }}>Method</th><th style={{ cursor: 'default' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((o) => {
                  const r = d.orderRate(o);
                  return (
                    <tr key={o.id}>
                      <td className="ag-tabular">{o.date}{o.time ? ' ' + o.time : ''}</td>
                      <td style={{ fontWeight: 600 }}>{o.ticket}</td>
                      <td>{d.matLabel(o)}</td>
                      <td className="ag-tabular">{o.vehicle}</td>
                      <td className="ag-tabular" style={{ textAlign: 'right' }}>{T(d.net(o))}</td>
                      <td className="ag-tabular" style={{ textAlign: 'right' }}>{M(r.rate)}</td>
                      <td style={{ color: 'var(--color-neutral-700)' }}>{r.src}</td>
                      <td className="ag-tabular" style={{ textAlign: 'right', fontWeight: 600 }}>{M(d.amount(o))}</td>
                      <td>{o.method}</td>
                      <td><Tag>{o.status}</Tag></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tickets.length === 0 && (
            <div style={{ padding: 'var(--space-6)', borderTop: '1px solid rgba(32,30,29,.10)', fontSize: 13, color: 'var(--color-neutral-700)' }}>
              No tickets for this party yet.
            </div>
          )}
        </Panel>
      )}
    </section>
  );
}

export function StandardRates({ d, onBack, onAddRate, onEndRate, onDeleteRate }) {
  return (
    <section aria-label="Standard rates">
      <BackLink label="Materials" onClick={onBack} />
      <RateBoard d={d} custId="" onAdd={onAddRate} onEnd={onEndRate} onDelete={onDeleteRate} />
    </section>
  );
}
