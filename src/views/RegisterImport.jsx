import { useRef, useState } from 'react';
import Panel from '../components/Panel';
import Select from '../components/Select';
import StatTile from '../components/StatTile';
import Tag from '../components/Tag';
import { M, T } from '../lib/format';
import { checkPay, payLabel } from '../lib/payments';

const TH = { cursor: 'default' };

// What a staged sale will be billed: the register amount when it has one, otherwise net tons × rate card.
export function rowBill(d, row) {
  const tons = row.net / 1000;
  const card = d.rateFor(row.custId, row.matId, row.date);
  const cardAmount = tons * card.rate;
  const bill = row.amount > 0 ? row.amount : cardAmount;
  return { bill, cardAmount, card, mismatch: row.amount > 0 && card.rate > 0 && Math.abs(cardAmount - row.amount) > 1 };
}

export function saleStatus(d, row) {
  if (row.dup) return { label: 'Already imported', cls: 'ag-t-mute', ready: false };
  if (!(row.net > 0)) return { label: 'Zero weight', cls: 'ag-t-bad', ready: false };
  if (!row.custId && !row.walkIn) return { label: 'Choose party', cls: 'ag-t-warn', ready: false };
  const { bill } = rowBill(d, row);
  if (!(bill > 0)) return { label: 'No rate', cls: 'ag-t-warn', ready: false };
  if (!row.pay || checkPay(row.pay, bill, { walkIn: !row.custId }).errors) return { label: 'Check payment', cls: 'ag-t-warn', ready: false };
  return { label: 'Ready', cls: 'ag-t-ok', ready: true };
}

export function solingStatus(row) {
  if (row.dup) return { label: 'Already imported', cls: 'ag-t-mute', ready: false };
  if (!row.supplierId) return { label: 'Choose supplier', cls: 'ag-t-warn', ready: false };
  return { label: 'Ready', cls: 'ag-t-ok', ready: true };
}

export default function RegisterImport({ d, onFile, onParty, onSupplier, onEditPay, onRemove, onPostSales, onPostSoling, onClear }) {
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const staging = d.db.staging || [];
  const sales = staging.filter((r) => r.kind === 'sale');
  const soling = staging.filter((r) => r.kind === 'soling');
  const readySales = sales.filter((r) => saleStatus(d, r).ready);
  const readySoling = soling.filter((r) => solingStatus(r).ready);
  const lastBatch = (d.db.imports || [])[0];

  const partyOptions = (row) => [
    ...d.db.customers.map((c) => ({ v: c.id, l: c.name })),
    { v: '__walkin', l: 'Walk-in customer (cash) — ' + row.name },
    { v: '__new', l: '+ Add "' + row.name + '" as a credit party' },
  ];
  const supplierOptions = (row) => [
    ...(d.db.suppliers || []).map((p) => ({ v: p.id, l: p.name })),
    { v: '__new', l: '+ Add "' + row.name + '" as a soling supplier' },
  ];

  const pick = (files) => { if (files && files[0]) onFile(files[0]); };
  const totals = readySales.reduce((acc, r) => {
    const { bill } = rowBill(d, r);
    const res = checkPay(r.pay, bill, { walkIn: !r.custId });
    return { bill: acc.bill + bill, credit: acc.credit + res.credit, paid: acc.paid + res.paid };
  }, { bill: 0, credit: 0, paid: 0 });

  return (
    <section aria-label="Register import">
      <div
        className="ag-glass ag-rise"
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
        style={{ padding: 'var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center', justifyContent: 'space-between', outline: drag ? '2px dashed var(--color-accent)' : 'none', outlineOffset: -6 }}
      >
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <h4 style={{ margin: 0, fontSize: 15.5, letterSpacing: '-0.02em' }}>Load a collection register</h4>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>
            The .xls / .xlsx the weighbridge software exports. Drop it here or choose it. CR rows start on credit, CA rows as cash, soling rows go to purchases.
          </div>
          {lastBatch && (
            <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 6 }}>
              Last loaded: {lastBatch.file} · {lastBatch.from}{lastBatch.to && lastBatch.to !== lastBatch.from ? ' to ' + lastBatch.to : ''} · {lastBatch.rows} rows
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {staging.length > 0 && <button type="button" className="btn btn-secondary" onClick={onClear}>Clear pending</button>}
          <button type="button" className="btn btn-primary" onClick={() => input.current.click()}>Choose register file</button>
          <input
            ref={input}
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: 'none' }}
            aria-label="Register file"
            onChange={(e) => { pick(e.target.files); e.target.value = ''; }}
          />
        </div>
      </div>

      {staging.length > 0 && (
        <div className="ag-stagger ag-quad" style={{ marginTop: 'var(--space-6)' }}>
          <StatTile label="Sales pending" value={String(sales.length)} note={readySales.length + ' ready to post'} />
          <StatTile label="Ready to bill" value={M(totals.bill)} note={M(totals.paid) + ' paid now'} />
          <StatTile label="Goes on credit" value={M(totals.credit)} note="From the ready rows" />
          <StatTile label="Soling loads" value={String(soling.length)} note={readySoling.length + ' ready to save'} />
        </div>
      )}

      {sales.length > 0 && (
        <Panel
          className="ag-rise"
          style={{ marginTop: 'var(--space-6)' }}
          title="Sales to check"
          sub="Pick the party where the name did not match, then record how each sale was paid. Remarks are optional."
          action={<button type="button" className="btn btn-primary" disabled={!readySales.length} onClick={onPostSales}>Post {readySales.length} ready sale{readySales.length === 1 ? '' : 's'}</button>}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={TH}>Serial</th><th style={TH}>Date / time</th><th style={TH}>Vehicle</th><th style={TH}>Register name → party</th>
                  <th style={TH}>Material</th><th style={{ ...TH, textAlign: 'right' }}>Net (t)</th><th style={{ ...TH, textAlign: 'right' }}>Bill</th>
                  <th style={TH}>Payment</th><th style={TH}>Status</th><th style={{ ...TH, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((r) => {
                  const st = saleStatus(d, r);
                  const b = rowBill(d, r);
                  const res = r.pay ? checkPay(r.pay, b.bill, { walkIn: !r.custId }) : null;
                  return (
                    <tr key={r.key}>
                      <td style={{ fontWeight: 600 }}>{r.serial}</td>
                      <td className="ag-tabular">{r.date} {r.time}</td>
                      <td className="ag-tabular">{r.vehicle}</td>
                      <td style={{ minWidth: 230, whiteSpace: 'normal' }}>
                        <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginBottom: 4 }}>{r.name}</div>
                        <Select
                          label={'Party for ' + r.serial}
                          value={r.custId || (r.walkIn ? '__walkin' : '')}
                          placeholder="Choose party…"
                          options={partyOptions(r)}
                          onChange={(v) => onParty(r.key, v)}
                        />
                      </td>
                      <td>{r.matId === 'M10' ? (r.matName || r.material) + ' (other)' : d.mat(r.matId).name}</td>
                      <td className="ag-tabular" style={{ textAlign: 'right' }}>{T(r.net / 1000)}</td>
                      <td className="ag-tabular" style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600 }}>{b.bill ? M(b.bill) : '—'}</div>
                        {b.mismatch && <div style={{ fontSize: 11, color: '#8a5207' }}>Rate card {M(b.cardAmount)}</div>}
                        {!r.amount && b.card.rate > 0 && <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>at {M(b.card.rate)}/t</div>}
                      </td>
                      <td style={{ whiteSpace: 'normal', minWidth: 150 }}>
                        {r.pay ? payLabel(r.pay, res ? res.credit : 0) : '—'}
                        {res && res.credit > 0 && r.pay.mode !== 'Credit' && <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{M(res.credit)} on credit</div>}
                        {r.pay && r.pay.remarks && <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{r.pay.remarks}</div>}
                      </td>
                      <td><Tag cls={st.cls}>{st.label}</Tag></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {!r.dup && r.net > 0 && (r.custId || r.walkIn) && <button type="button" className="btn btn-ghost" onClick={() => onEditPay(r.key)}>Payment</button>}
                        <button type="button" className="btn btn-ghost" onClick={() => onRemove(r.key)}>Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {soling.length > 0 && (
        <Panel
          className="ag-rise"
          style={{ marginTop: 'var(--space-6)' }}
          title="Soling loads (purchases)"
          sub="Boulders bought from suppliers. Net boulders = register Net − Gross (the truck comes in loaded), valued at the supplier's rate on that date."
          action={<button type="button" className="btn btn-primary" disabled={!readySoling.length} onClick={onPostSoling}>Save {readySoling.length} soling load{readySoling.length === 1 ? '' : 's'}</button>}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 1080 }}>
              <thead>
                <tr>
                  <th style={TH}>Serial</th><th style={TH}>Date / time</th><th style={TH}>Vehicle</th><th style={TH}>Register name → supplier</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Empty (Gross)</th><th style={{ ...TH, textAlign: 'right' }}>Loaded (Net)</th><th style={{ ...TH, textAlign: 'right' }}>Boulders (t)</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Rate / t</th><th style={{ ...TH, textAlign: 'right' }}>We owe</th>
                  <th style={TH}>Status</th><th style={{ ...TH, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {soling.map((r) => {
                  const st = solingStatus(r);
                  const u = { supplierId: r.supplierId, date: r.date, tare: r.gross, gross: r.net };
                  const rate = r.supplierId ? d.solRate(u).rate : 0;
                  return (
                    <tr key={r.key}>
                      <td style={{ fontWeight: 600 }}>{r.serial}</td>
                      <td className="ag-tabular">{r.date} {r.time}</td>
                      <td className="ag-tabular">{r.vehicle}</td>
                      <td style={{ minWidth: 230, whiteSpace: 'normal' }}>
                        <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginBottom: 4 }}>{r.name}</div>
                        <Select label={'Supplier for ' + r.serial} value={r.supplierId} placeholder="Choose supplier…" options={supplierOptions(r)} onChange={(v) => onSupplier(r.key, v)} />
                      </td>
                      <td className="ag-tabular" style={{ textAlign: 'right' }}>{r.gross.toLocaleString('en-IN')}</td>
                      <td className="ag-tabular" style={{ textAlign: 'right' }}>{r.net.toLocaleString('en-IN')}</td>
                      <td className="ag-tabular" style={{ textAlign: 'right', fontWeight: 600 }}>{T(d.net(u))}</td>
                      <td className="ag-tabular" style={{ textAlign: 'right' }}>{rate ? M(rate) : '—'}</td>
                      <td className="ag-tabular" style={{ textAlign: 'right' }}>{rate ? M(d.solValue(u)) : r.supplierId ? 'No rate' : '—'}</td>
                      <td><Tag cls={st.cls}>{st.label}</Tag></td>
                      <td style={{ textAlign: 'right' }}><button type="button" className="btn btn-ghost" onClick={() => onRemove(r.key)}>Remove</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {staging.length === 0 && (
        <div className="ag-glass" style={{ marginTop: 'var(--space-6)', padding: 'var(--space-6)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>Nothing waiting to be posted</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 2 }}>
            Load a register to check its rows. Rows you have not posted yet stay here, even after closing the browser.
          </div>
        </div>
      )}
    </section>
  );
}
