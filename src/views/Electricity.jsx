import { useState } from 'react';
import Panel from '../components/Panel';
import Segmented from '../components/Segmented';
import StatTile from '../components/StatTile';
import { TODAY } from '../config';
import { M } from '../lib/format';

const TH = { cursor: 'default' };
const R = { textAlign: 'right' };
const monthName = (ym) => new Date(ym + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const num = (v) => (+v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const ERR = { display: 'block', fontSize: 11, color: 'var(--color-accent-700)', fontWeight: 600, marginTop: 3 };

// EB (one meter): units used and power factor noted every day; at month end, the government (TNEB) and private power bills.
const VIEWS = [['daily', 'Daily reading'], ['monthly', 'Monthly reading'], ['report', 'Report']];

export default function Electricity({ d, onSaveReading, onDeleteReading, onSaveBill, onDeleteBill, onReport }) {
  const [view, setView] = useState('daily');
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const blank = { date: TODAY, units: '', pf: '', remarks: '' };
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState({});
  const [billForm, setBillForm] = useState(null);
  const readings = (d.db.ebReadings || []).filter((r) => r.date.slice(0, 7) === month).sort((a, b) => a.date.localeCompare(b.date));
  const bill = (d.db.ebBills || []).find((b) => b.month === month);
  const units = readings.reduce((s, r) => s + (+r.units || 0), 0);
  const pfs = readings.filter((r) => +r.pf > 0);
  const avgPf = pfs.length ? pfs.reduce((s, r) => s + +r.pf, 0) / pfs.length : 0;
  const lowPf = pfs.filter((r) => +r.pf < 0.9).length;
  const billTotal = bill ? (+bill.govt || 0) + (+bill.private || 0) : 0;
  // The Thar plant runs on our meter; its share is not our cost.
  const tharAmt = bill ? +bill.tharAmount || 0 : 0;
  const tharUnits = bill ? +bill.tharUnits || 0 : 0;
  const ourCost = billTotal - tharAmt;
  const ourUnits = units - tharUnits;
  const existing = (d.db.ebReadings || []).find((r) => r.date === form.date);

  const save = () => {
    const e = {};
    if (!form.date) e.date = 'Required.';
    if (String(form.units).trim() === '' || !(+form.units >= 0)) e.units = 'Enter the units used.';
    if (String(form.pf).trim() && !(+form.pf > 0 && +form.pf <= 1)) e.pf = 'PF is between 0 and 1 (e.g. 0.95).';
    setErr(e);
    if (Object.keys(e).length) return;
    onSaveReading({ date: form.date, units: +form.units, pf: String(form.pf).trim() ? +form.pf : '', remarks: String(form.remarks || '').trim() });
    setForm({ ...blank, date: form.date });
  };
  const saveBill = () => {
    const e = {};
    ['govt', 'private', 'tharUnits', 'tharAmount'].forEach((k) => { if (String(billForm[k] ?? '').trim() && !(+billForm[k] >= 0)) e[k] = 'Enter a number.'; });
    if (!(+billForm.govt > 0) && !(+billForm.private > 0) && !(+billForm.tharAmount > 0) && !(+billForm.tharUnits > 0)) e.govt = 'Enter the bill, or the Thar plant figures.';
    setErr(e);
    if (Object.keys(e).length) return;
    onSaveBill({ month, govt: +billForm.govt || 0, private: +billForm.private || 0, tharUnits: +billForm.tharUnits || 0, tharAmount: +billForm.tharAmount || 0, remarks: String(billForm.remarks || '').trim() });
    setBillForm(null);
  };
  const field = (label, k, placeholder) => (
    <label className="field" style={{ flex: '1 1 150px', minWidth: 0 }}>
      <span className="ag-label ag-field-label">{label}</span>
      <input className="input" type="number" step="any" value={form[k]} placeholder={placeholder} aria-invalid={err[k] ? true : undefined} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      {err[k] && <span role="alert" style={ERR}>{err[k]}</span>}
    </label>
  );

  const monthPicker = (
    <input className="input" type="month" aria-label="Month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} style={{ width: 170 }} />
  );
  const tiles = (
    <div className="ag-stagger ag-quad">
      <StatTile label="Units this month" value={num(units) + ' kWh'} note={readings.length + ' days recorded'} />
      <StatTile label="Average PF" value={avgPf ? avgPf.toFixed(3) : '—'} note={lowPf ? lowPf + ' day(s) below 0.90' : 'No day below 0.90'} />
      <StatTile label="Our electricity cost" value={bill ? M(ourCost) : 'Not entered'} note={bill ? 'Bill ' + M(billTotal) + (tharAmt ? ' − Thar plant ' + M(tharAmt) : '') : 'Enter at month end'} />
      <StatTile label="Our cost per unit" value={bill && ourUnits > 0 ? '₹' + (ourCost / ourUnits).toFixed(2) : '—'} note={tharUnits ? 'Our units ' + num(ourUnits) + ' (Thar ' + num(tharUnits) + ')' : 'Bill ÷ units recorded'} />
    </div>
  );

  return (
    <section aria-label="Electricity">
      <div className="ag-fade" style={{ marginBottom: 'var(--space-6)' }}>
        <Segmented label="Electricity views" value={view} onChange={setView} options={VIEWS.map(([v, l]) => ({ v, l }))} controls={(v) => 'eb-' + v} />
      </div>

      {view === 'daily' && (
      <div id="eb-daily" role="tabpanel">
      <Panel className="ag-rise" title="EB reading for the day" sub={existing ? 'A reading for ' + form.date + ' is saved — saving again replaces it' : 'Units used and power factor for the day'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end', padding: 'var(--space-4) var(--space-6) var(--space-6)' }}>
          <label className="field" style={{ flex: '0 1 170px', minWidth: 0 }}>
            <span className="ag-label ag-field-label">Date</span>
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(e) => {
                const r = (d.db.ebReadings || []).find((x) => x.date === e.target.value);
                setForm(r ? { date: r.date, units: r.units, pf: r.pf, remarks: r.remarks || '' } : { ...blank, date: e.target.value });
              }}
            />
          </label>
          {field('Units consumed (kWh)', 'units', '1250')}
          {field('Power factor (PF)', 'pf', '0.95')}
          <label className="field" style={{ flex: '2 1 220px', minWidth: 0 }}>
            <span className="ag-label ag-field-label">Remarks</span>
            <input className="input" value={form.remarks} placeholder="Optional — e.g. power cut 2 hrs" onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </label>
          <button type="button" className="btn btn-primary" onClick={save}>{existing ? 'Update reading' : 'Save reading'}</button>
        </div>
      </Panel>
      <Panel className="ag-rise" style={{ marginTop: 'var(--space-6)' }} title="Daily readings" sub={monthName(month)} action={monthPicker}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: 680 }}>
            <thead>
              <tr><th style={TH}>Date</th><th style={{ ...TH, ...R }}>Units (kWh)</th><th style={{ ...TH, ...R }}>PF</th><th style={TH}>Remarks</th><th style={TH}>By</th><th style={{ ...TH, ...R }}>Actions</th></tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id}>
                  <td className="ag-tabular">{r.date} · {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}</td>
                  <td className="ag-tabular" style={{ ...R, fontWeight: 600 }}>{num(r.units)}</td>
                  <td className="ag-tabular" style={{ ...R, color: +r.pf && +r.pf < 0.9 ? 'var(--color-accent-700)' : 'inherit' }}>{+r.pf ? (+r.pf).toFixed(3) : '—'}</td>
                  <td style={{ whiteSpace: 'normal', minWidth: 160, color: 'var(--color-neutral-700)' }}>{r.remarks || '—'}</td>
                  <td style={{ color: 'var(--color-neutral-700)' }}>{r.by || '—'}</td>
                  <td style={{ ...R, whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => { setForm({ date: r.date, units: r.units, pf: r.pf, remarks: r.remarks || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                    <button type="button" className="btn btn-ghost" onClick={() => onDeleteReading(r)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {readings.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ padding: '12px 24px' }}>{readings.length} days</td>
                  <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{num(units)}</td>
                  <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{avgPf ? avgPf.toFixed(3) : '—'}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {readings.length === 0 && <div style={{ padding: 'var(--space-6)', fontSize: 13, color: 'var(--color-neutral-700)' }}>No readings for this month yet.</div>}
      </Panel>
      </div>
      )}

      {view === 'monthly' && (
      <div id="eb-monthly" role="tabpanel">
      {tiles}

      <Panel
        className="ag-rise"
        style={{ marginTop: 'var(--space-6)' }}
        title={'Month end — ' + monthName(month)}
        sub="Government (TNEB) and private power amounts for the month, and the Thar plant's units and amount. Our cost in the profit report = bill − Thar plant amount."
        action={(
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }}>
            {monthPicker}
            {!billForm && <>
            <button type="button" className="btn btn-primary" onClick={() => setBillForm(bill ? { govt: bill.govt, private: bill.private, tharUnits: bill.tharUnits || '', tharAmount: bill.tharAmount || '', remarks: bill.remarks || '' } : { govt: '', private: '', tharUnits: '', tharAmount: '', remarks: '' })}>{bill ? 'Edit month end' : 'Enter month end'}</button>
            {bill && <button type="button" className="btn btn-ghost" onClick={() => onDeleteBill(bill)}>Delete</button>}
            </>}
          </div>
        )}
      >
        {billForm ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end', padding: 'var(--space-4) var(--space-6) var(--space-6)' }}>
            {[['Government (TNEB) amount (₹)', 'govt'], ['Private power amount (₹)', 'private'], ['Thar plant — units used (kWh)', 'tharUnits'], ['Thar plant — amount (₹)', 'tharAmount']].map(([label, k]) => (
              <label key={k} className="field" style={{ flex: '1 1 180px', minWidth: 0 }}>
                <span className="ag-label ag-field-label">{label}</span>
                <input className="input" type="number" step="any" value={billForm[k]} onChange={(e) => setBillForm({ ...billForm, [k]: e.target.value })} />
                {err[k] && <span role="alert" style={ERR}>{err[k]}</span>}
              </label>
            ))}
            <label className="field" style={{ flex: '2 1 220px', minWidth: 0 }}>
              <span className="ag-label ag-field-label">Remarks</span>
              <input className="input" value={billForm.remarks} placeholder="Optional — bill no., due date" onChange={(e) => setBillForm({ ...billForm, remarks: e.target.value })} />
            </label>
            <button type="button" className="btn btn-primary" onClick={saveBill}>Save bill</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setBillForm(null); setErr({}); }}>Cancel</button>
          </div>
        ) : (
          <div style={{ padding: 'var(--space-4) var(--space-6) var(--space-6)', fontSize: 13.5 }}>
            {bill
              ? <>Government <strong>{M(bill.govt)}</strong> + private <strong>{M(bill.private)}</strong> = <strong>{M(billTotal)}</strong>{(tharAmt || tharUnits) ? <> · Thar plant <strong>{num(tharUnits)} kWh</strong>, <strong>{M(tharAmt)}</strong> · our cost <strong>{M(ourCost)}</strong></> : null}{bill.remarks ? ' · ' + bill.remarks : ''}{bill.by ? <span style={{ color: 'var(--color-neutral-600)' }}> · entered by {bill.by}</span> : null}</>
              : <span style={{ color: 'var(--color-neutral-700)' }}>No bill entered for this month yet.</span>}
          </div>
        )}
      </Panel>
      </div>
      )}

      {view === 'report' && (
      <div id="eb-report" role="tabpanel">
      {tiles}
      <Panel className="ag-rise" style={{ marginTop: 'var(--space-6)' }} title={'Electricity report — ' + monthName(month)} sub="Daily units and power factor, the month-end bill and the Thar plant share, as a PDF or Excel file.">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6) var(--space-6)' }}>
          {monthPicker}
          <button type="button" className="btn btn-primary" onClick={() => onReport(month)}>Generate report</button>
          <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>
            {readings.length} day(s) recorded · {bill ? 'month-end bill entered' : 'month-end bill not entered yet'}
          </span>
        </div>
      </Panel>
      </div>
      )}

    </section>
  );
}
