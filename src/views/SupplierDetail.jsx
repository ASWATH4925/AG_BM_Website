import { useState } from 'react';
import Panel from '../components/Panel';
import StatTile from '../components/StatTile';
import Tag from '../components/Tag';
import { rateStatus } from '../lib/domain';
import { isoDate, M, N, T } from '../lib/format';
import { METHOD_LABEL } from '../lib/payments';
import { BackLink, Empty, Info, RangeBar, rangeStamps } from './PartyDetail';

const TABS = ['Loads supplied', 'Payments made', 'Statement', 'Rates', 'Contact details'];
const TH = { cursor: 'default' };
const R = { textAlign: 'right' };
const methodName = (m) => METHOD_LABEL[m] || m;

// One soling supplier's account: what they brought, what has been paid to them, and what we still owe.
export default function SupplierDetail({
  d, sup, tab, setTab, onBack, onEdit, onAddLoad, onEditLoad, onDeleteLoad, onPay, onDeletePay, onOpenParty,
  onAddRate, onEndRate, onDeleteRate, onReport,
}) {
  const [range, setRange] = useState({ fromDate: '', fromTime: '', toDate: '', toTime: '' });
  const { from, to } = rangeStamps(range);
  const L = d.supLedger(sup.id, from, to);
  const loads = L.rows.filter((r) => r.kind === 'load').map((r) => r.u);
  const pays = L.rows.filter((r) => r.kind === 'pay');
  const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);
  const current = tab && TABS.includes(tab) ? tab : TABS[0];
  const owe = d.owed(sup);
  const allLoads = d.solLoadsOf(sup.id);
  const byParties = d.supplierPaysOf(sup.id).filter((x) => x.source === 'party');
  const linked = sup.linkedCustId ? d.db.customers.find((c) => c.id === sup.linkedCustId) : null;
  const reportBtn = (type) => <button type="button" className="btn btn-primary" onClick={() => onReport(type, range)}>Generate report</button>;
  const foot = { ...R, padding: '12px 24px' };
  const today = isoDate();
  const rateCards = (d.db.solRates || []).filter((r) => r.supplierId === sup.id).sort((a, b) => b.from.localeCompare(a.from));
  const nowRate = d.solRateFor(sup.id, today);

  return (
    <section aria-label={sup.name}>
      <BackLink label="All soling suppliers" onClick={onBack} />

      <div className="ag-glass ag-rise">
        <div className="ag-head ag-head-row" style={{ flexWrap: 'wrap' }}>
          <div>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 19 }}>{sup.name} <Tag>{sup.status}</Tag></h4>
            <div className="ag-head-sub">{[sup.code, sup.owner, sup.contact, sup.upi && 'UPI ' + sup.upi].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={() => onReport('statement', range)}>Generate report</button>
            <button type="button" className="btn btn-secondary" onClick={onAddLoad}>Add soling load</button>
            <button type="button" className="btn btn-primary" onClick={onPay}>Pay supplier</button>
          </div>
        </div>
        <div className="ag-stagger ag-quad" style={{ padding: 'var(--space-6)' }}>
          <StatTile label={owe < -0.5 ? 'Paid ahead' : 'We owe'} value={M(Math.abs(owe))} note={nowRate.rate ? 'Rate today ' + M(nowRate.rate) + ' / t' : 'No rate set for today'} />
          <StatTile label="Loads supplied" value={String(allLoads.length)} note={T(sum(allLoads, d.net)) + ' t of boulders'} />
          <StatTile label="Supplied value" value={M(d.supplied(sup))} note="Net tons × rate + extras" />
          <StatTile label="Paid to them" value={M(d.paidToSupplier(sup))} note={byParties.length ? M(sum(byParties, (x) => x.p.amount)) + ' sent by parties' : 'Last payment ' + d.lastSupplierPay(sup)} />
        </div>
      </div>

      <div role="tablist" aria-label="Account sections" style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid rgba(32,30,29,.10)', margin: 'var(--space-6) 0' }}>
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={current === t} className="ag-tab" data-on={current === t ? '1' : '0'} onClick={() => setTab(t)}>
            {t}<i />
          </button>
        ))}
      </div>

      {current === 'Loads supplied' && (
        <div className="ag-glass ag-rise">
          <RangeBar range={range} setRange={setRange}>
            <button type="button" className="btn btn-secondary" onClick={onAddLoad}>Add soling load</button>
            {reportBtn('loads')}
          </RangeBar>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 1180 }}>
              <thead>
                <tr>
                  <th style={TH}>Date / time</th><th style={TH}>Serial</th><th style={TH}>Vehicle</th>
                  <th style={{ ...TH, ...R }}>Empty (kg)</th><th style={{ ...TH, ...R }}>Loaded (kg)</th><th style={{ ...TH, ...R }}>Net (t)</th>
                  <th style={{ ...TH, ...R }}>Rate / t</th><th style={{ ...TH, ...R }}>Amount</th><th style={{ ...TH, ...R }}>Extra</th><th style={{ ...TH, ...R }}>We owe</th>
                  <th style={TH}>Remarks</th><th style={{ ...TH, ...R }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loads.map((u) => {
                  const r = d.solRate(u);
                  return (
                    <tr key={u.id}>
                      <td className="ag-tabular">{u.date} {u.time}</td>
                      <td style={{ fontWeight: 600 }}>{u.serial || '—'}</td>
                      <td className="ag-tabular">{u.vehicle}</td>
                      <td className="ag-tabular" style={R}>{N(u.tare)}</td>
                      <td className="ag-tabular" style={R}>{N(u.gross)}</td>
                      <td className="ag-tabular" style={R}>{T(d.net(u))}</td>
                      <td className="ag-tabular" style={{ ...R, color: r.rate ? 'inherit' : 'var(--color-accent-700)' }} title={r.src}>{r.rate ? M(r.rate) : 'No rate'}</td>
                      <td className="ag-tabular" style={R}>{M(d.solAmount(u))}</td>
                      <td className="ag-tabular" style={R}>{+u.extra ? M(u.extra) : '—'}</td>
                      <td className="ag-tabular" style={{ ...R, fontWeight: 600 }}>{M(d.solValue(u))}</td>
                      <td style={{ whiteSpace: 'normal', minWidth: 140, color: 'var(--color-neutral-700)' }}>{u.remarks || '—'}</td>
                      <td style={{ ...R, whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => onEditLoad(u)}>Edit</button>
                        <button type="button" className="btn btn-ghost" onClick={() => onDeleteLoad(u)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {loads.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={5} style={{ padding: '12px 24px' }}>{loads.length} loads</td>
                    <td className="ag-tabular" style={foot}>{T(sum(loads, d.net))}</td>
                    <td />
                    <td className="ag-tabular" style={foot}>{M(sum(loads, d.solAmount))}</td>
                    <td className="ag-tabular" style={foot}>{M(sum(loads, (u) => +u.extra || 0))}</td>
                    <td className="ag-tabular" style={foot}>{M(sum(loads, d.solValue))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {loads.length === 0 && <Empty>No soling loads in this period.</Empty>}
        </div>
      )}

      {current === 'Payments made' && (
        <div className="ag-glass ag-rise">
          <RangeBar range={range} setRange={setRange}>
            <button type="button" className="btn btn-secondary" onClick={onPay}>Pay supplier</button>
            {reportBtn('payments')}
          </RangeBar>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 940 }}>
              <thead>
                <tr>
                  <th style={TH}>Date / time</th><th style={TH}>Paid by</th><th style={TH}>Method</th><th style={{ ...TH, ...R }}>Amount</th>
                  <th style={TH}>Reference</th><th style={TH}>Remarks</th><th style={{ ...TH, ...R }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pays.map((r) => (
                  <tr key={r.p.id}>
                    <td className="ag-tabular">{r.ts}</td>
                    <td style={{ fontWeight: 600 }}>{r.source === 'company' ? 'Company' : r.by}{r.source === 'party' && <span style={{ fontWeight: 400, color: 'var(--color-neutral-600)' }}> · on our behalf</span>}</td>
                    <td>{methodName(r.method)}</td>
                    <td className="ag-tabular" style={{ ...R, fontWeight: 600 }}>{M(r.credit)}</td>
                    <td>{r.p.ref || '—'}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 160, color: 'var(--color-neutral-700)' }}>{r.p.remarks || '—'}</td>
                    <td style={{ ...R, whiteSpace: 'nowrap' }}>
                      {r.source === 'company'
                        ? <button type="button" className="btn btn-ghost" onClick={() => onDeletePay(r.p)}>Delete</button>
                        : r.p.custId && <button type="button" className="btn btn-ghost" onClick={() => onOpenParty(r.p.custId)}>Open party</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pays.length === 0 && <Empty>No payments in this period.</Empty>}
          {pays.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-6)', borderTop: '1px solid rgba(32,30,29,.10)', fontSize: 13 }}>
              <span>{pays.length} payments · ones sent by credit parties are changed on that party&apos;s account</span>
              <strong className="ag-tabular">{M(sum(pays, (r) => r.credit))}</strong>
            </div>
          )}
        </div>
      )}

      {current === 'Statement' && (
        <div className="ag-glass ag-rise">
          <RangeBar range={range} setRange={setRange}>{reportBtn('statement')}</RangeBar>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={TH}>Date / time</th><th style={TH}>Particulars</th>
                  <th style={{ ...TH, ...R }}>Supplied</th><th style={{ ...TH, ...R }}>Paid</th><th style={{ ...TH, ...R }}>We owe</th>
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
                      {r.kind === 'load' && <>Soling <strong>{r.ref}</strong> · {r.u.vehicle} · {T(d.net(r.u))} t × {M(d.solRate(r.u).rate)}{+r.u.extra ? ' + extra ' + M(r.u.extra) : ''}</>}
                      {r.kind === 'pay' && <>Paid by {r.source === 'company' ? 'company' : r.by} · {methodName(r.method)}{r.p.ref ? ' · ' + r.p.ref : ''}</>}
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
                  <td style={{ padding: '12px 24px' }}>{L.closing < 0 ? 'Closing — paid ahead' : 'Closing — we owe'}</td>
                  <td className="ag-tabular" style={foot}>{M(L.debit)}</td>
                  <td className="ag-tabular" style={foot}>{M(L.credit)}</td>
                  <td className="ag-tabular" style={foot}>{M(L.closing)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {current === 'Rates' && (
        <Panel
          className="ag-rise"
          title="Soling rate — ₹ per ton"
          sub="What we pay this supplier per net ton of boulders on each date. A manual rate on a load overrides it."
          action={<button type="button" className="btn btn-primary" onClick={onAddRate}>Add rate period</button>}
        >
          <div style={{ padding: 'var(--space-6) var(--space-6) var(--space-4)' }}>
            <div className="ag-label" style={{ marginBottom: 6 }}>In force today · {today}</div>
            <div className="ag-big" style={{ fontSize: 24, letterSpacing: '-0.03em' }}>{nowRate.rate ? M(nowRate.rate) + ' / t' : 'Not set'}</div>
            {nowRate.card && <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 4 }}>since {nowRate.card.from}</div>}
          </div>
          <div style={{ overflowX: 'auto', borderTop: '1px solid rgba(32,30,29,.10)' }}>
            <table className="table" style={{ width: '100%', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={TH}>From</th><th style={TH}>To</th><th style={{ ...TH, ...R }}>Rate / t</th><th style={TH}>Status</th>
                  <th style={TH}>Remarks</th><th style={TH}>Set by</th><th style={{ ...TH, ...R }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rateCards.map((r) => (
                  <tr key={r.id}>
                    <td className="ag-tabular">{r.from}</td>
                    <td className="ag-tabular">{r.to || 'Ongoing'}</td>
                    <td className="ag-tabular" style={{ ...R, fontWeight: 600 }}>{M(r.rate)}</td>
                    <td><Tag>{rateStatus(r, today)}</Tag></td>
                    <td style={{ whiteSpace: 'normal', minWidth: 180, color: 'var(--color-neutral-700)' }}>{r.remarks || '—'}</td>
                    <td style={{ color: 'var(--color-neutral-700)' }}>{r.by}</td>
                    <td style={{ ...R, whiteSpace: 'nowrap' }}>
                      {!r.to && <button type="button" className="btn btn-ghost" onClick={() => onEndRate(r)}>End</button>}
                      <button type="button" className="btn btn-ghost" onClick={() => onDeleteRate(r)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rateCards.length === 0 && <Empty>No rate periods yet. Add one so soling loads are valued, or type a manual rate on each load.</Empty>}
        </Panel>
      )}

      {current === 'Contact details' && (
        <Panel className="ag-rise" title="Contact details" sub="Used on statements and for UPI payments" action={<button type="button" className="btn btn-secondary" onClick={onEdit}>Edit details</button>}>
          <div style={{ padding: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(220px,100%),1fr))', gap: 'var(--space-6)' }}>
            <Info label="Supplier name" value={sup.name} />
            <Info label="Owner" value={sup.owner} />
            <Info label="Contact number" value={sup.contact} />
            <Info label="UPI ID / number" value={sup.upi} />
            <Info label="Address" value={sup.address} />
            <Info label="Status" value={sup.status} />
            <Info label="Supplier code" value={sup.code} />
            <Info label="Remarks" value={sup.remarks} />
          </div>
          {linked && (
            <div style={{ margin: '0 var(--space-6) var(--space-6)', fontSize: 13, padding: '10px 12px', borderRadius: 'var(--ag-r-sm)', background: 'rgba(47,79,212,.07)', border: '1px solid rgba(47,79,212,.2)', color: '#1f3a9e' }}>
              Also a credit party as <strong>{linked.name}</strong>, who owes us {M(d.outstanding(linked))}. That is a separate account — the two are never set against each other.{' '}
              <button type="button" className="btn btn-ghost" style={{ padding: '2px 6px' }} onClick={() => onOpenParty(linked.id)}>Open party</button>
            </div>
          )}
        </Panel>
      )}
    </section>
  );
}
