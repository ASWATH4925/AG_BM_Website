import { useState } from 'react';
import Panel from '../components/Panel';
import StatTile from '../components/StatTile';
import Tag from '../components/Tag';
import { M } from '../lib/format';
import { METHOD_LABEL } from '../lib/payments';
import { BackLink, Empty, Info, RangeBar, rangeStamps } from './PartyDetail';

const TH = { cursor: 'default' };
const R = { textAlign: 'right' };
const methodName = (m) => METHOD_LABEL[m] || m;
const L = (n) => (+n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// One fuel bunk or spares company: what we took on credit, what was paid, and what we still owe.
export default function CreditorDetail({ d, cr, tab, setTab, onBack, onEdit, onAddBill, onEditBill, onDeleteBill, onPay, onDeletePay, onOpenParty, onReport }) {
  const bunk = cr.kind === 'bunk';
  const TABS = [bunk ? 'Fuel taken' : 'Purchase bills', 'Payments', 'Statement', 'Details'];
  const [range, setRange] = useState({ fromDate: '', fromTime: '', toDate: '', toTime: '' });
  const { from, to } = rangeStamps(range);
  const Lg = d.crLedger(cr.id, from, to);
  const bills = Lg.rows.filter((r) => r.kind === 'bill').map((r) => r.b);
  const pays = Lg.rows.filter((r) => r.kind === 'pay');
  const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);
  const current = TABS.includes(tab) ? tab : TABS[0];
  const owe = d.crOwed(cr);
  const allBills = d.crBillsOf(cr.id);
  const byParties = d.creditorPaysOf(cr.id).filter((x) => x.source === 'party');
  const foot = { ...R, padding: '12px 24px' };
  const reportBtn = (type) => <button type="button" className="btn btn-primary" onClick={() => onReport(type, range)}>Generate report</button>;
  const forLabel = (b) => (b.forType === 'tanker' ? 'Our tanker' : b.forType === 'other' ? b.forName || 'Someone else' : 'Our vehicle');

  return (
    <section aria-label={cr.name}>
      <BackLink label={bunk ? 'All fuel bunks' : 'All spares companies'} onClick={onBack} />

      <div className="ag-glass ag-rise">
        <div className="ag-head ag-head-row" style={{ flexWrap: 'wrap' }}>
          <div>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 19 }}>{cr.name} <Tag>{cr.status}</Tag></h4>
            <div className="ag-head-sub">{[bunk ? 'Fuel bunk' : 'Spares company', cr.code, cr.owner, cr.contact, cr.upi && 'UPI ' + cr.upi].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={() => onReport('statement', range)}>Generate report</button>
            <button type="button" className="btn btn-secondary" onClick={onAddBill}>{bunk ? 'Add fuel taken' : 'Add purchase bill'}</button>
            <button type="button" className="btn btn-primary" onClick={onPay}>{bunk ? 'Pay bunk' : 'Pay company'}</button>
          </div>
        </div>
        <div className="ag-stagger ag-quad" style={{ padding: 'var(--space-6)' }}>
          <StatTile label={owe < -0.5 ? 'Paid ahead' : 'We owe'} value={M(Math.abs(owe))} note={'Last payment ' + (d.creditorPaysOf(cr.id).map((x) => x.p.date).sort().pop() || '—')} />
          <StatTile label={bunk ? 'Fuel taken' : 'Bills'} value={bunk ? L(sum(allBills, (b) => +b.litres || 0)) + ' L' : String(allBills.length)} note={allBills.length + (bunk ? ' fills' : ' bills') + ' in all'} />
          <StatTile label="Billed" value={M(d.crBilled(cr))} note={bunk ? 'Litres × price, or amount typed' : 'Amount + GST'} />
          <StatTile label="Paid" value={M(d.crPaid(cr))} note={byParties.length ? M(sum(byParties, (x) => x.p.amount)) + ' paid by customers' : 'By the company'} />
        </div>
      </div>

      <div role="tablist" aria-label="Account sections" style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid rgba(32,30,29,.10)', margin: 'var(--space-6) 0' }}>
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={current === t} className="ag-tab" data-on={current === t ? '1' : '0'} onClick={() => setTab(t)}>
            {t}<i />
          </button>
        ))}
      </div>

      {current === TABS[0] && (
        <div className="ag-glass ag-rise">
          <RangeBar range={range} setRange={setRange}>
            <button type="button" className="btn btn-secondary" onClick={onAddBill}>{bunk ? 'Add fuel taken' : 'Add purchase bill'}</button>
            {reportBtn('bills')}
          </RangeBar>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: bunk ? 1100 : 980 }}>
              <thead>
                {bunk ? (
                  <tr>
                    <th style={TH}>Date / time</th><th style={TH}>Slip / indent</th><th style={TH}>Fuel for</th><th style={TH}>Vehicle</th>
                    <th style={{ ...TH, ...R }}>Litres</th><th style={{ ...TH, ...R }}>Price / L</th><th style={{ ...TH, ...R }}>Amount</th>
                    <th style={TH}>Remarks</th><th style={{ ...TH, ...R }}>Actions</th>
                  </tr>
                ) : (
                  <tr>
                    <th style={TH}>Date</th><th style={TH}>Bill no.</th><th style={TH}>What was bought</th>
                    <th style={{ ...TH, ...R }}>Amount</th><th style={{ ...TH, ...R }}>GST</th><th style={{ ...TH, ...R }}>Total</th>
                    <th style={TH}>Remarks</th><th style={{ ...TH, ...R }}>Actions</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id}>
                    <td className="ag-tabular">{b.date} {b.time}</td>
                    <td style={{ fontWeight: 600 }}>{b.billNo || '—'}</td>
                    {bunk ? (
                      <>
                        <td>{forLabel(b)}</td>
                        <td className="ag-tabular">{b.vehicle || '—'}</td>
                        <td className="ag-tabular" style={R}>{+b.litres ? L(b.litres) : '—'}</td>
                        <td className="ag-tabular" style={R}>{+b.rate ? '₹' + L(b.rate) : '—'}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ whiteSpace: 'normal', minWidth: 220 }}>{b.items}</td>
                        <td className="ag-tabular" style={R}>{M(+b.amount || 0)}</td>
                        <td className="ag-tabular" style={R}>{+b.gst ? M(b.gst) : '—'}</td>
                      </>
                    )}
                    <td className="ag-tabular" style={{ ...R, fontWeight: 600 }}>{M(d.crBillValue(b))}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 140, color: 'var(--color-neutral-700)' }}>{b.remarks || '—'}</td>
                    <td style={{ ...R, whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => onEditBill(b)}>Edit</button>
                      <button type="button" className="btn btn-ghost" onClick={() => onDeleteBill(b)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {bills.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={bunk ? 4 : 3} style={{ padding: '12px 24px' }}>{bills.length} {bunk ? 'fills' : 'bills'}</td>
                    {bunk ? (
                      <>
                        <td className="ag-tabular" style={foot}>{L(sum(bills, (b) => +b.litres || 0))}</td>
                        <td />
                      </>
                    ) : (
                      <>
                        <td className="ag-tabular" style={foot}>{M(sum(bills, (b) => +b.amount || 0))}</td>
                        <td className="ag-tabular" style={foot}>{M(sum(bills, (b) => +b.gst || 0))}</td>
                      </>
                    )}
                    <td className="ag-tabular" style={foot}>{M(sum(bills, d.crBillValue))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {bills.length === 0 && <Empty>{bunk ? 'No fuel taken in this period.' : 'No bills in this period.'}</Empty>}
        </div>
      )}

      {current === 'Payments' && (
        <div className="ag-glass ag-rise">
          <RangeBar range={range} setRange={setRange}>
            <button type="button" className="btn btn-secondary" onClick={onPay}>{bunk ? 'Pay bunk' : 'Pay company'}</button>
            {reportBtn('payments')}
          </RangeBar>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 900 }}>
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
                    <td style={{ fontWeight: 600 }}>{r.by}{r.source === 'party' && <span style={{ fontWeight: 400, color: 'var(--color-neutral-600)' }}> · on our behalf</span>}</td>
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
              <span>{pays.length} payments · ones sent by customers are changed on that party&apos;s account</span>
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
                  <th style={{ ...TH, ...R }}>Billed</th><th style={{ ...TH, ...R }}>Paid</th><th style={{ ...TH, ...R }}>We owe</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td /><td style={{ fontWeight: 700 }}>Opening balance</td><td /><td />
                  <td className="ag-tabular" style={{ ...R, fontWeight: 700 }}>{M(Lg.opening)}</td>
                </tr>
                {Lg.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="ag-tabular">{r.ts}</td>
                    <td style={{ whiteSpace: 'normal' }}>
                      {r.kind === 'bill' && (bunk
                        ? <>Fuel {r.b.billNo ? <strong>{r.b.billNo}</strong> : ''} · {forLabel(r.b)}{r.b.vehicle ? ' · ' + r.b.vehicle : ''}{+r.b.litres ? ' · ' + L(r.b.litres) + ' L' + (+r.b.rate ? ' × ₹' + L(r.b.rate) : '') : ''}</>
                        : <>Bill {r.b.billNo ? <strong>{r.b.billNo}</strong> : ''} · {r.b.items}{+r.b.gst ? ' + GST ' + M(r.b.gst) : ''}</>)}
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
                  <td style={{ padding: '12px 24px' }}>{Lg.closing < 0 ? 'Closing — paid ahead' : 'Closing — we owe'}</td>
                  <td className="ag-tabular" style={foot}>{M(Lg.debit)}</td>
                  <td className="ag-tabular" style={foot}>{M(Lg.credit)}</td>
                  <td className="ag-tabular" style={foot}>{M(Lg.closing)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {current === 'Details' && (
        <Panel className="ag-rise" title="Details" sub="Used on statements and for UPI payments" action={<button type="button" className="btn btn-secondary" onClick={onEdit}>Edit details</button>}>
          <div style={{ padding: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(220px,100%),1fr))', gap: 'var(--space-6)' }}>
            <Info label={bunk ? 'Bunk name' : 'Company name'} value={cr.name} />
            <Info label="Owner / contact person" value={cr.owner} />
            <Info label="Contact number" value={cr.contact} />
            <Info label="UPI ID / number" value={cr.upi} />
            <Info label="GSTIN" value={cr.gstin} />
            <Info label="Address" value={cr.address} />
            <Info label="Status" value={cr.status} />
            <Info label="Remarks" value={cr.remarks} />
          </div>
        </Panel>
      )}
    </section>
  );
}
