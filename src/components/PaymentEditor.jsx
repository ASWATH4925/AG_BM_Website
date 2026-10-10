import { useEffect, useRef, useState } from 'react';
import { M } from '../lib/format';
import { checkPay, emptyLine, LINE_METHODS, METHOD_LABEL, PAY_MODES, round2 } from '../lib/payments';
import Field from './Field';
import Select from './Select';

const ERR = { display: 'block', fontSize: 11, color: 'var(--color-accent-700)', fontWeight: 600, marginTop: 3 };

// Records how a sale was paid: credit, cash, UPI (to a soling supplier, the company or someone else),
// bank / account, or a split across several of these, with an optional round-off and remarks.
export default function PaymentEditor({ title, sub, bill, walkIn, initial, suppliers, onSave, onClose }) {
  const [pay, setPay] = useState(initial);
  const [tried, setTried] = useState(false);
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    ref.current?.querySelector('.ag-seg-on')?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.ag-menu-float')) closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const result = checkPay(pay, bill, { walkIn });
  const errs = tried && result.errors ? result.errors : {};

  const setMode = (mode) => setPay((p) => {
    if (mode === 'Credit') return { ...p, mode, lines: [] };
    if (mode === 'Split') {
      const first = p.lines[0] || emptyLine('Cash', '');
      return { ...p, mode, lines: p.lines.length >= 2 ? p.lines : [first, emptyLine('UPI', '')] };
    }
    const amount = p.lines[0] && p.lines[0].amount !== '' ? p.lines[0].amount : round2(bill);
    return { ...p, mode, lines: [{ ...emptyLine(mode, amount), remarks: (p.lines[0] || {}).remarks || '' }] };
  });
  const setLine = (i, patch) => setPay((p) => ({ ...p, lines: p.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const toOptions = [
    ...suppliers.map((s) => ({ v: 'S:' + s.id, l: s.name + ' (soling supplier)' })),
    { v: 'company', l: 'Company UPI' },
    { v: 'other', l: 'Someone else…' },
  ];
  const toValue = (l) => (l.toType === 'supplier' ? (l.supplierId ? 'S:' + l.supplierId : '') : l.toType);

  const submit = (e) => {
    e.preventDefault();
    setTried(true);
    if (!result.errors) onSave(pay, result);
  };

  return (
    <div
      className="dialog-backdrop ag-fade"
      style={{
        position: 'fixed', inset: 0, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 'var(--space-4)', zIndex: 40, background: 'color-mix(in srgb, var(--color-neutral-900) 55%, transparent)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-title"
        className="dialog elev-lg ag-pop"
        style={{ width: 'min(820px,96vw)', maxHeight: '90vh', overflow: 'auto', background: 'var(--color-bg)', border: '2px solid var(--color-text)' }}
        onSubmit={submit}
        noValidate
      >
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid rgba(32,30,29,.10)' }}>
          <div className="ag-kicker">Payment</div>
          <h3 id="pay-title" style={{ margin: '4px 0 0', fontSize: 24, letterSpacing: '-0.03em' }}>{title}</h3>
          {sub && <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>{sub}</div>}
        </div>

        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <span className="ag-label ag-field-label">How was it paid?</span>
            <div role="radiogroup" aria-label="Payment type" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PAY_MODES.map((m) => {
                const disabled = m === 'Credit' && walkIn;
                const on = pay.mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={disabled}
                    title={disabled ? 'Walk-in customers have no credit account' : undefined}
                    className={'btn ' + (on ? 'btn-primary ag-seg-on' : 'btn-secondary')}
                    onClick={() => setMode(m)}
                  >
                    {METHOD_LABEL[m]}
                  </button>
                );
              })}
            </div>
          </div>

          {pay.mode === 'Credit' && (
            <div style={{ fontSize: 13.5, padding: '10px 12px', borderRadius: 'var(--ag-r-sm)', background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-300)' }}>
              The full {M(bill)} goes on the party&apos;s credit account.
            </div>
          )}

          {pay.lines.map((l, i) => (
            <div
              key={i}
              style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(170px,100%),1fr))', gap: 'var(--space-3)', alignItems: 'start',
                padding: pay.mode === 'Split' ? 'var(--space-3)' : 0, borderRadius: 'var(--ag-r-sm)',
                border: pay.mode === 'Split' ? '1px solid var(--color-neutral-300)' : 0,
              }}
            >
              {pay.mode === 'Split' && (
                <Field label={'Line ' + (i + 1) + ' — method'}>
                  <Select
                    label={'Line ' + (i + 1) + ' method'}
                    value={l.method}
                    options={LINE_METHODS.map((x) => ({ v: x, l: METHOD_LABEL[x] }))}
                    onChange={(v) => setLine(i, { method: v, toType: v === 'UPI' ? 'supplier' : 'company', supplierId: '', toName: '' })}
                  />
                </Field>
              )}
              <Field label="Amount (₹)" as="label">
                <input className="input" type="number" min="0" step="0.01" value={l.amount} aria-invalid={errs['amount' + i] ? true : undefined} onChange={(e) => setLine(i, { amount: e.target.value })} />
                {errs['amount' + i] && <span role="alert" style={ERR}>{errs['amount' + i]}</span>}
              </Field>
              {l.method === 'UPI' && (
                <Field label="UPI paid to">
                  <Select
                    label="UPI paid to"
                    value={toValue(l)}
                    placeholder="Choose who received it…"
                    options={toOptions}
                    onChange={(v) => setLine(i, v.startsWith('S:') ? { toType: 'supplier', supplierId: v.slice(2), toName: '' } : { toType: v, supplierId: '', toName: '' })}
                  />
                  {l.toType !== 'other' && errs['to' + i] && <span role="alert" style={ERR}>{errs['to' + i]}</span>}
                </Field>
              )}
              {l.method === 'UPI' && l.toType === 'other' && (
                <Field label="Received by" as="label">
                  <input className="input" value={l.toName} placeholder="Name of the person" onChange={(e) => setLine(i, { toName: e.target.value })} />
                  {errs['to' + i] && <span role="alert" style={ERR}>{errs['to' + i]}</span>}
                </Field>
              )}
              <Field label="Remarks" as="label">
                <input className="input" value={l.remarks} placeholder="Optional" onChange={(e) => setLine(i, { remarks: e.target.value })} />
              </Field>
              {pay.mode === 'Split' && pay.lines.length > 2 && (
                <button type="button" className="btn btn-ghost" style={{ alignSelf: 'end' }} onClick={() => setPay((p) => ({ ...p, lines: p.lines.filter((_, j) => j !== i) }))}>
                  Remove line
                </button>
              )}
            </div>
          ))}
          {pay.mode === 'Split' && (
            <div>
              <button type="button" className="btn btn-secondary" onClick={() => setPay((p) => ({ ...p, lines: p.lines.concat([emptyLine('Cash', '')]) }))}>Add payment line</button>
              {errs.lines && <span role="alert" style={ERR}>{errs.lines}</span>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(210px,100%),1fr))', gap: 'var(--space-3)' }}>
            {pay.mode !== 'Credit' && (
              <Field label="Round-off / discount (₹)" as="label">
                <input className="input" type="number" min="0" step="0.01" value={pay.roundOff} placeholder="0" onChange={(e) => setPay((p) => ({ ...p, roundOff: e.target.value }))} />
                <span style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 3 }}>e.g. billed 3,620, took 3,600 → 20</span>
                {errs.roundOff && <span role="alert" style={ERR}>{errs.roundOff}</span>}
              </Field>
            )}
            <Field label="Remarks for this sale" as="label">
              <input className="input" value={pay.remarks} placeholder="Optional" onChange={(e) => setPay((p) => ({ ...p, remarks: e.target.value }))} />
            </Field>
          </div>

          <div style={{ border: '1px solid var(--color-neutral-300)', padding: 'var(--space-3)', background: 'var(--color-neutral-100)' }}>
            {[
              ['Bill', M(bill)],
              ['Paid now', M(result.paid)],
              ...(result.roundOff ? [['Round-off', '− ' + M(result.roundOff)]] : []),
              [walkIn ? 'Still to collect' : 'On credit', M(result.credit)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', fontSize: 14, padding: '3px 0' }}>
                <span style={{ color: 'var(--color-neutral-800)' }}>{k}</span>
                <span className="ag-tabular" style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            {errs.total && <span role="alert" style={ERR}>{errs.total}</span>}
          </div>
        </div>

        <div className="dialog-actions" style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-start', padding: 'var(--space-4)', borderTop: '1px solid rgba(32,30,29,.10)' }}>
          <button type="submit" className="btn btn-primary">Save payment</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
