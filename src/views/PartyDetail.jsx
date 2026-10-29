import { useState } from 'react';
import Panel from '../components/Panel';
import RateBoard from '../components/RateBoard';
import StatTile from '../components/StatTile';
import Tag from '../components/Tag';
import { M, T } from '../lib/format';
import { touches } from '../lib/access';
import { METHOD_LABEL, paidToLabel } from '../lib/payments';
import { ChangeDetail } from './Activity';

const TABS = ['Loads taken', 'Payment history', 'Statement', 'Rates', 'Contact details'];
const TH = { cursor: 'default' };
const R = { textAlign: 'right' };
const methodName = (m) => METHOD_LABEL[m] || m;

export function BackLink({ label, onClick }) {
  return (
    <button type="button" className="btn btn-ghost" style={{ padding: '6px 8px', marginBottom: 'var(--space-4)', color: 'var(--color-neutral-700)' }} onClick={onClick}>
      ← {label}
    </button>
  );
}

export function Info({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="ag-label">{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, overflowWrap: 'anywhere', color: value ? 'var(--color-text)' : 'var(--color-neutral-600)' }}>
        {value || 'Not added yet'}
      </div>
    </div>
  );
}

// From / to date and time; blank means open-ended.
export function RangeBar({ range, setRange, children }) {
  const field = (k, type, label) => (
    <label className="field" style={{ flex: '0 1 150px', minWidth: 0 }}>
      <span className="ag-label ag-field-label">{label}</span>
      <input className="input" type={type} value={range[k]} onChange={(e) => setRange({ ...range, [k]: e.target.value })} />
    </label>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end', padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid rgba(32,30,29,.10)' }}>
      {field('fromDate', 'date', 'From date')}
      {field('fromTime', 'time', 'From time')}
      {field('toDate', 'date', 'To date')}
      {field('toTime', 'time', 'To time')}
      <button type="button" className="btn btn-secondary" onClick={() => setRange({ fromDate: '', fromTime: '', toDate: '', toTime: '' })}>All time</button>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto', flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

export const rangeStamps = (r) => ({
  from: r.fromDate ? r.fromDate + ' ' + (r.fromTime || '00:00') : '',
  to: r.toDate ? r.toDate + ' ' + (r.toTime || '23:59') : '',
});

export function Empty({ children }) {
  return <div style={{ padding: 'var(--space-6)', borderTop: '1px solid rgba(32,30,29,.10)', fontSize: 13, color: 'var(--color-neutral-700)' }}>{children}</div>;
}

// One credit party's account: loads, payments, statement, rates and contact details.
export default function PartyDetail({
  d, party, tab, setTab, onBack, onEdit, onAddRate, onEndRate, onDeleteRate,
  onEditLoad, onPayLoad, onDeleteLoad, onReceipt, onDeleteReceipt, onReport, onAddLoad, showHistory, onDeleteAccount,
}) {
  const tabs = showHistory ? TABS.concat(['History']) : TABS;
  const history = showHistory ? (d.db.audit || []).filter((a) => a.ops.some((o) => touches(o, { custId: party.id }))).slice().sort((a, b) => b.at.localeCompare(a.at)) : [];
  const [range, setRange] = useState({ fromDate: '', fromTime: '', toDate: '', toTime: '' });
  const { from, to } = rangeStamps(range);
  const L = d.ledger(party.id, from, to);
  const loads = L.rows.filter((r) => r.kind === 'load').map((r) => r.o);
  const pays = L.rows.filter((r) => r.kind === 'pay' || r.kind === 'receipt');
  const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);
  const current = tab && tabs.includes(tab) ? tab : TABS[0];
  const reportBtn = (type, label) => <button type="button" className="btn btn-primary" onClick={() => onReport(type, range)}>{label}</button>;
  const foot = { ...R, padding: '12px 24px' };

  return (
    <section aria-label={party.name}>
      <BackLink label="All customers" onClick={onBack} />

      <div className="ag-glass ag-rise">
        <div className="ag-head ag-head-row" style={{ flexWrap: 'wrap' }}>
          <div>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 19 }}>{party.name} <Tag>{party.status}</Tag></h4>
            <div className="ag-head-sub">{[party.code, party.owner, party.contact].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={() => onReport('statement', range)}>Generate report</button>
            <button type="button" className="btn btn-secondary" onClick={onAddLoad}>Add load</button>
            <button type="button" className="btn btn-primary" onClick={onReceipt}>Record payment</button>
          </div>
        </div>
        <div className="ag-stagger ag-quad" style={{ padding: 'var(--space-6)' }}>
          <StatTile label="Outstanding" value={M(d.outstanding(party))} note="Pending from credit loads only" />
          <StatTile label="Loads taken" value={String(d.loadsOf(party.id).length)} note={T(sum(d.loadsOf(party.id), d.net)) + ' t in all'} />
          <StatTile label="Billed on credit" value={M(d.billed(party))} note="After payments made on the loads" />
          <StatTile label="Received on account" value={M(d.received(party))} note={'Last receipt ' + d.lastReceipt(party)} />
        </div>
      </div>

      <div role="tablist" aria-label="Account sections" style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid rgba(32,30,29,.10)', margin: 'var(--space-6) 0' }}>
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={current === t} className="ag-tab" data-on={current === t ? '1' : '0'} onClick={() => setTab(t)}>
            {t}<i />
          </button>
        ))}
      </div>

      {current === 'Loads taken' && (
        <div className="ag-glass ag-rise">
          <RangeBar range={range} setRange={setRange}>
            <button type="button" className="btn btn-secondary" onClick={onAddLoad}>Add load</button>
            {reportBtn('loads', 'Generate report')}
          </RangeBar>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 1280 }}>
              <thead>
                <tr>
                  <th style={TH}>Date / time</th><th style={TH}>Ticket</th><th style={TH}>Vehicle</th><th style={TH}>Material</th>
                  <th style={{ ...TH, ...R }}>Net (t)</th><th style={{ ...TH, ...R }}>Rate / t</th><th style={{ ...TH, ...R }}>Amount</th>
                  <th style={{ ...TH, ...R }}>GST</th><th style={{ ...TH, ...R }}>Rent</th><th style={{ ...TH, ...R }}>Bill</th>
                  <th style={TH}>Payment</th><th style={{ ...TH, ...R }}>Paid</th><th style={{ ...TH, ...R }}>On credit</th><th style={{ ...TH, ...R }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loads.map((o) => (
                  <tr key={o.id}>
                    <td className="ag-tabular">{o.date} {o.time}</td>
                    <td style={{ fontWeight: 600 }}>{o.ticket}</td>
                    <td className="ag-tabular">{o.vehicle}</td>
                    <td>{d.matLabel(o)}</td>
                    <td className="ag-tabular" style={R}>{T(d.net(o))}</td>
                    <td className="ag-tabular" style={R}>{M(d.orderRate(o).rate)}</td>
                    <td className="ag-tabular" style={R}>{M(d.amount(o))}</td>
                    <td className="ag-tabular" style={R}>{+o.gst ? M(o.gst) : '—'}</td>
                    <td className="ag-tabular" style={R}>{+o.rent ? M(o.rent) : '—'}</td>
                    <td className="ag-tabular" style={{ ...R, fontWeight: 600 }}>{M(d.billTotal(o))}</td>
                    <td>{methodName(o.method)}</td>
                    <td className="ag-tabular" style={R}>{M(d.paidOn(o))}</td>
                    <td className="ag-tabular" style={{ ...R, fontWeight: 600, color: d.onCredit(o) > 0 ? 'var(--color-accent-700)' : 'inherit' }}>{M(d.onCredit(o))}</td>
                    <td style={{ ...R, whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => onEditLoad(o)}>Edit</button>
                      <button type="button" className="btn btn-ghost" onClick={() => onPayLoad(o)}>Payment</button>
                      <button type="button" className="btn btn-ghost" onClick={() => onDeleteLoad(o)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {loads.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: '12px 24px' }}>{loads.length} loads</td>
                    <td className="ag-tabular" style={foot}>{T(sum(loads, d.net))}</td>
                    <td />
                    <td className="ag-tabular" style={foot}>{M(sum(loads, d.amount))}</td>
                    <td className="ag-tabular" style={foot}>{M(sum(loads, (o) => +o.gst || 0))}</td>
                    <td className="ag-tabular" style={foot}>{M(sum(loads, (o) => +o.rent || 0))}</td>
                    <td className="ag-tabular" style={foot}>{M(sum(loads, d.billTotal))}</td>
                    <td />
                    <td className="ag-tabular" style={foot}>{M(sum(loads, d.paidOn))}</td>
                    <td className="ag-tabular" style={foot}>{M(sum(loads, d.onCredit))}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {loads.length === 0 && <Empty>No loads in this period.</Empty>}
        </div>
      )}

      {current === 'Payment history' && (
        <div className="ag-glass ag-rise">
          <RangeBar range={range} setRange={setRange}>
            <button type="button" className="btn btn-secondary" onClick={onReceipt}>Record payment</button>
            {reportBtn('payments', 'Generate report')}
          </RangeBar>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 980 }}>
              <thead>
                <tr>
                  <th style={TH}>Date / time</th><th style={TH}>Against</th><th style={TH}>Method</th><th style={{ ...TH, ...R }}>Amount</th>
                  <th style={TH}>Paid to (company only)</th><th style={TH}>Reference</th><th style={TH}>Remarks</th><th style={{ ...TH, ...R }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pays.map((r, i) => (
                  <tr key={(r.p ? r.p.id : r.ref) + '-' + i}>
                    <td className="ag-tabular">{r.ts}</td>
                    <td style={{ fontWeight: 600 }}>{r.kind === 'receipt' ? 'Account receipt' : 'Load ' + r.ref}</td>
                    <td>{methodName(r.method)}</td>
                    <td className="ag-tabular" style={{ ...R, fontWeight: 600 }}>{M(r.credit)}</td>
                    <td>{r.p ? paidToLabel(r.p, d.creditorName) : 'Company'}</td>
                    <td>{(r.p && r.p.ref) || '—'}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 160, color: 'var(--color-neutral-700)' }}>{(r.p && r.p.remarks) || '—'}</td>
                    <td style={{ ...R, whiteSpace: 'nowrap' }}>
                      {r.kind === 'receipt'
                        ? <button type="button" className="btn btn-ghost" onClick={() => onDeleteReceipt(r.p)}>Delete</button>
                        : <button type="button" className="btn btn-ghost" onClick={() => onPayLoad(r.o)}>Edit on load</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pays.length === 0 && <Empty>No payments in this period.</Empty>}
          {pays.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-6)', borderTop: '1px solid rgba(32,30,29,.10)', fontSize: 13 }}>
              <span>{pays.length} payments</span>
              <strong className="ag-tabular">{M(sum(pays, (r) => r.credit))}</strong>
            </div>
          )}
        </div>
      )}

      {current === 'Statement' && (
        <div className="ag-glass ag-rise">
          <RangeBar range={range} setRange={setRange}>{reportBtn('statement', 'Generate report')}</RangeBar>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={TH}>Date / time</th><th style={TH}>Particulars</th>
                  <th style={{ ...TH, ...R }}>Debit</th><th style={{ ...TH, ...R }}>Credit</th><th style={{ ...TH, ...R }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td />
                  <td style={{ fontWeight: 700 }}>Opening balance</td>
                  <td /><td />
                  <td className="ag-tabular" style={{ ...R, fontWeight: 700 }}>{M(L.opening)}</td>
                </tr>
                {L.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="ag-tabular">{r.ts}</td>
                    <td style={{ whiteSpace: 'normal' }}>
                      {r.kind === 'load' && <>Load <strong>{r.ref}</strong> · {d.matLabel(r.o)} · {T(d.net(r.o))} t × {M(d.orderRate(r.o).rate)}{+r.o.gst ? ' + GST ' + M(r.o.gst) : ''}{+r.o.rent ? ' + rent ' + M(r.o.rent) : ''}</>}
                      {r.kind === 'pay' && <>Paid on {r.ref} · {methodName(r.method)}{r.p ? ' → ' + paidToLabel(r.p, d.creditorName) : ''}</>}
                      {r.kind === 'receipt' && <>Receipt · {methodName(r.method)}{r.p.ref ? ' · ' + r.p.ref : ''} → {paidToLabel(r.p, d.creditorName)}</>}
                      {r.kind === 'round' && <>Round-off on {r.ref}</>}
                    </td>
                    <td className="ag-tabular" style={R}>{r.debit ? M(r.debit) : ''}</td>
                    <td className="ag-tabular" style={R}>{r.credit ? M(r.credit) : ''}</td>
                    <td className="ag-tabular" style={{ ...R, fontWeight: 600 }}>{M(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ padding: '12px 24px' }} />
                  <td style={{ padding: '12px 24px' }}>Closing balance</td>
                  <td className="ag-tabular" style={foot}>{M(L.debit)}</td>
                  <td className="ag-tabular" style={foot}>{M(L.credit)}</td>
                  <td className="ag-tabular" style={foot}>{M(L.closing)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}


      {current === 'History' && (
        <Panel className="ag-rise" title="History" sub="Every change on this account — who made it and when">
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 760 }}>
              <thead><tr><th style={TH}>When</th><th style={TH}>Who</th><th style={TH}>What changed</th></tr></thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id}>
                    <td className="ag-tabular" style={{ whiteSpace: 'nowrap' }}>{a.at.slice(0, 16).replace('T', ' ')}</td>
                    <td style={{ fontWeight: 600 }}>{a.userName}{a.approvedBy ? <div style={{ fontWeight: 400, fontSize: 11.5, color: 'var(--color-neutral-600)' }}>approved by {a.approvedBy}</div> : null}{a.rolledBack ? <div style={{ fontWeight: 400, fontSize: 11.5, color: '#8a5207' }}>undone by {a.rolledBack.by}</div> : null}</td>
                    <td style={{ whiteSpace: 'normal' }}><strong>{a.label}</strong><ChangeDetail ops={a.ops.filter((o) => touches(o, { custId: party.id }))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.length === 0 && <Empty>No changes recorded on this account yet.</Empty>}
        </Panel>
      )}

      {current === 'Rates' && <RateBoard d={d} custId={party.id} onAdd={onAddRate} onEnd={onEndRate} onDelete={onDeleteRate} />}

      {current === 'Contact details' && (
        <Panel className="ag-rise" title="Contact details" sub="Used on statements sent to the party" action={<div style={{ display: 'flex', gap: 'var(--space-2)' }}><button type="button" className="btn btn-secondary" onClick={onEdit}>Edit details</button><button type="button" className="btn btn-ghost" onClick={onDeleteAccount}>Delete account</button></div>}>
          <div style={{ padding: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(220px,100%),1fr))', gap: 'var(--space-6)' }}>
            <Info label="Party name" value={party.name} />
            <Info label="Owner" value={party.owner} />
            <Info label="Contact number" value={party.contact} />
            <Info label="Address" value={party.address} />
            <Info label="GSTIN" value={party.gst} />
            <Info label="Status" value={party.status} />
            <Info label="Party code" value={party.code} />
            <Info label="Remarks" value={party.remarks} />
          </div>
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
