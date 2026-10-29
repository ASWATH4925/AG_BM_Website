import { useState } from 'react';
import Field from '../components/Field';
import Panel from '../components/Panel';
import Select from '../components/Select';
import { settings } from '../config';
import { cameInLoaded, OTHER_MATERIAL } from '../lib/domain';
import { M, N, T } from '../lib/format';

// Card tint per entry type: blue-grey for vehicles that came in empty, warm amber for ones that came in loaded.
const ENTRY_TINT = {
  empty: { bg: 'rgba(47,79,212,.06)', edge: 'rgba(47,79,212,.55)', tag: 'ag-t-info', label: 'In empty' },
  loaded: { bg: 'rgba(176,110,18,.08)', edge: 'rgba(176,110,18,.6)', tag: 'ag-t-warn', label: 'In loaded' },
};
// The bridge is a 60 t platform; anything heavier is a typing mistake.
const MAX_KG = 60000;
const has = (x) => x !== null && x !== undefined;
const kgOrDash = (x) => (has(x) ? N(x) + ' kg' : '--');

// Checks a proposed pair of weights; returns an error message, or '' when the pair is fine.
function weightsError(tare, gross) {
  const bad = (x) => has(x) && (!Number.isInteger(x) || x <= 0 || x > MAX_KG);
  if (bad(tare) || bad(gross)) return 'Weights are whole kilograms between 1 and ' + N(MAX_KG) + '.';
  if (has(tare) && has(gross) && gross <= tare) return 'Loaded weight must be more than the empty weight.';
  return '';
}

// One weight: Capture writes the live reading; clicking the number edits it in place, saved on Enter or click-away.
function WeightCard({ label, sub, value, scale, onSave }) {
  const [draft, setDraft] = useState(null); // null when not editing
  const [err, setErr] = useState('');
  const editing = draft !== null;

  const commit = () => {
    if (!editing) return;
    const next = draft.trim() === '' ? null : Number(draft);
    if (next === value) { setDraft(null); setErr(''); return; }
    const e = onSave(next);
    if (e) { setErr(e); return; }
    setDraft(null); setErr('');
  };
  const capture = () => {
    const e = onSave(scale);
    setErr(e || '');
    if (!e) setDraft(null);
  };

  return (
    <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--ag-r-sm)', background: 'rgba(255,255,255,.55)', border: '1px solid ' + (err ? 'var(--color-accent)' : 'rgba(32,30,29,.10)'), minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <div className="ag-label">{label} <span style={{ color: 'var(--color-neutral-600)' }}>· {sub}</span></div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ height: 28, padding: '0 12px', fontSize: 12 }}
          title={'Take ' + N(scale) + ' kg from the live reading'}
          onMouseDown={(e) => e.preventDefault()} // keep an open edit from committing its draft first
          onClick={capture}
        >
          Capture
        </button>
      </div>
      {editing ? (
        <input
          className="input ag-tabular"
          inputMode="numeric"
          autoFocus
          aria-label={label + ' in kilograms'}
          aria-invalid={err ? true : undefined}
          placeholder="--"
          value={draft}
          onChange={(e) => { setDraft(e.target.value.replace(/\D/g, '')); setErr(''); }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { setDraft(null); setErr(''); }
          }}
          style={{ width: '100%', marginTop: 6, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18 }}
        />
      ) : (
        <button
          type="button"
          aria-label={'Edit ' + label.toLowerCase() + ', now ' + kgOrDash(value)}
          onClick={() => setDraft(has(value) ? String(value) : '')}
          className="ag-tabular"
          style={{ display: 'block', width: '100%', marginTop: 6, padding: '4px 0', border: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'text', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em' }}
        >
          {kgOrDash(value)}
        </button>
      )}
      {err && <div role="alert" style={{ marginTop: 6, fontSize: 12, color: 'var(--color-accent-800)' }}>{err}</div>}
    </div>
  );
}

// Shown in place of the entry form while an on-site vehicle is selected.
function SelectedVehicle({ d, v, scale, onUpdateWeights, onConfirm, onVoid, onCancel }) {
  const t = ENTRY_TINT[cameInLoaded(v) ? 'loaded' : 'empty'];
  const both = has(v.tare) && has(v.gross);
  const o = { custId: v.custId, matId: v.matId, tare: v.tare, gross: v.gross };
  const rr = d.rateFor(v.custId, v.matId);
  const save = (side) => (val) => {
    const next = { tare: v.tare ?? null, gross: v.gross ?? null, [side]: val };
    if (!has(cameInLoaded(v) ? next.gross : next.tare)) return 'The ' + (cameInLoaded(v) ? 'loaded' : 'empty') + ' weight was captured on entry and cannot be cleared.';
    const e = weightsError(next.tare, next.gross);
    if (e) return e;
    onUpdateWeights(v.id, { [side]: val });
    return '';
  };

  return (
    <div className="ag-fade" style={{ padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>{v.vehicle}</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>{v.ticket}</span>
        <span className={'tag ' + t.tag}>{t.label}</span>
      </div>
      <div style={{ fontSize: 13, marginTop: 2 }}>
        {d.cust(v.custId).name} · {d.mat(v.matId).name} · {rr.rate ? M(rr.rate) + '/t' : 'no rate'} <span style={{ color: 'var(--color-neutral-700)' }}>· in at {v.inAt}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(200px,100%),1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        <WeightCard key={'t' + v.id + v.tare} label="Empty weight" sub="Tare" value={v.tare ?? null} scale={scale} onSave={save('tare')} />
        <WeightCard key={'g' + v.id + v.gross} label="Loaded weight" sub="Gross" value={v.gross ?? null} scale={scale} onSave={save('gross')} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        <button type="button" className="btn btn-primary" disabled={!both} onClick={onConfirm}>Complete · record payment</button>
        <button type="button" className="btn btn-secondary" onClick={onVoid}>Void load</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Back to new entry</button>
        <span className="ag-tabular" style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>
          {both ? <>Net <strong>{T(d.net(o))} t</strong> · bill <strong>{M(d.amount(o))}</strong></> : 'Capture the ' + (has(v.tare) ? 'loaded' : 'empty') + ' weight to complete the ticket.'}
        </span>
      </div>
    </div>
  );
}

export default function Weighbridge({ d, scale, wb, setWb, onCapture, onWeighOut, onUpdateWeights, onConfirm, onVoid, onCancel }) {
  const D = d.db;
  const isEmpty = wb.empty !== false;
  const sel = wb.outId ? D.onsite.find((x) => x.id === wb.outId) || null : null;
  const selBoth = sel && has(sel.tare) && has(sel.gross);
  const selO = selBoth ? { custId: sel.custId, matId: sel.matId, tare: sel.tare, gross: sel.gross } : null;
  const steps = [
    { l: 'Tare', v: sel ? kgOrDash(sel.tare) : D.onsite.length ? 'Ticket open' : 'On entry', on: !!sel && has(sel.tare) },
    { l: 'Gross', v: sel ? kgOrDash(sel.gross) : 'On exit', on: !!sel && has(sel.gross) },
    { l: 'Net', v: selO ? T(d.net(selO)) + ' t' : '—', on: !!selO },
    { l: 'Value', v: selO ? M(d.amount(selO)) : '—', on: !!selO },
  ];
  const rate = d.rateFor(wb.custId, wb.matId);

  return (
    <section aria-label="Weighbridge">
      <div className="ag-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(340px,100%),1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
        <Panel
          className="ag-card"
          style={{ minWidth: 0 }}
          title="Bridge 1 — 60 t platform"
          sub="Tare on entry, gross on exit"
          action={(
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>
              <span className="ag-dot ag-dot-round" />{settings.liveScale ? 'Stable' : 'Held'}
            </span>
          )}
        >
          <div
            style={{
              margin: 'var(--space-6)', padding: 'var(--space-6)', background: 'var(--color-neutral-900)', borderRadius: 'var(--ag-r-sm)',
              border: '1px solid rgba(255,255,255,.10)', boxShadow: '0 1px 2px rgba(32,30,29,.06), 0 14px 34px -18px rgba(32,30,29,.45)',
              position: 'relative', overflow: 'hidden',
            }}
          >
            <div className="ag-scan" />
            <div className="ag-label" style={{ color: 'var(--color-neutral-400)', position: 'relative' }}>Live reading</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, position: 'relative' }}>
              <div
                className="ag-digits"
                style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'clamp(48px, 14vw, 72px)', lineHeight: 0.94, letterSpacing: '-0.05em', color: 'var(--color-neutral-100)', fontVariantNumeric: 'tabular-nums' }}
              >
                {N(scale)}
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-neutral-400)' }}>kg</div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-neutral-400)', marginTop: 10, minHeight: 17, position: 'relative' }}>
              {sel
                ? sel.vehicle + ' selected. Press Capture on a weight below to take this reading.'
                : (isEmpty ? 'Empty vehicle on the platform. Capture to take this as the tare weight.' : 'Loaded vehicle on the platform. Capture to take this as the gross weight.')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-6)', position: 'relative' }}>
              {steps.map((st) => (
                <div key={st.l} style={{ position: 'relative', paddingTop: 10, borderTop: '2px solid color-mix(in srgb, var(--color-neutral-100) 20%, transparent)' }}>
                  <i className="ag-step" style={{ position: 'absolute', top: -2, left: 0, height: 2, background: 'var(--color-accent)', width: (st.on ? 100 : 0) + '%' }} />
                  <div className="ag-label" style={{ color: st.on ? 'var(--color-accent)' : 'var(--color-neutral-500)' }}>{st.l}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-neutral-300)', fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>{st.v}</div>
                </div>
              ))}
            </div>
          </div>

          {sel ? (
            <SelectedVehicle key={sel.id} d={d} v={sel} scale={scale} onUpdateWeights={onUpdateWeights} onConfirm={onConfirm} onVoid={onVoid} onCancel={onCancel} />
          ) : (
            <div data-enter-scope>
              <div style={{ padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--space-3)' }}>
                <Field label="Vehicle number" as="label">
                  <input className="input" style={{ width: '100%' }} placeholder="TN 29 BX 4412" value={wb.vehicle} onChange={(e) => setWb({ vehicle: e.target.value, err: '' })} />
                </Field>
                <Field label="Customer">
                  <Select label="Customer" value={wb.custId} options={D.customers.map((c) => ({ v: c.id, l: c.name }))} onChange={(v) => setWb({ custId: v })} />
                </Field>
                <Field label="Material">
                  <Select label="Material" value={wb.matId} options={d.salesMaterials().filter((m) => m.id !== OTHER_MATERIAL).map((m) => { const r = d.rateFor(wb.custId, m.id).rate; return { v: m.id, l: m.name + (r ? ' · ' + M(r) + '/t' : ' · no rate') }; })} onChange={(v) => setWb({ matId: v })} />
                </Field>
              </div>

              <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={isEmpty} onChange={(e) => setWb({ empty: e.target.checked, err: '' })} style={{ width: 17, height: 17, accentColor: 'var(--color-accent)', margin: 0 }} />
                    Empty
                  </label>
                  <button type="button" className="btn btn-primary" data-enter-submit onClick={onCapture}>{isEmpty ? 'Capture tare' : 'Capture gross'} · open ticket</button>
                  <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                    Applied rate: <strong className="ag-tabular">{M(rate.rate)} / t</strong> ({rate.src})
                  </span>
                </div>
                {wb.err && (
                  <div role="alert" style={{ marginTop: 'var(--space-3)', borderLeft: '1px solid var(--color-accent)', background: 'var(--color-accent-100)', padding: 'var(--space-2) var(--space-3)', fontSize: 13, color: 'var(--color-accent-800)' }}>
                    {wb.err}
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Panel className="ag-rise ag-card" title={'On site — awaiting weigh-out (' + D.onsite.length + ')'} sub="Tap a vehicle to see and capture its weights · blue came in empty, amber came in loaded">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {D.onsite.map((v) => {
                const t = ENTRY_TINT[cameInLoaded(v) ? 'loaded' : 'empty'];
                const isSel = !!sel && sel.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className="ag-listrow"
                    aria-pressed={isSel}
                    onClick={() => (isSel ? onCancel() : onWeighOut(v.id))}
                    style={{
                      display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                      padding: 'var(--space-4) var(--space-6)', border: 0, borderBottom: '1px solid rgba(32,30,29,.10)', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer',
                      background: isSel ? 'color-mix(in srgb,' + t.edge + ' 16%, rgba(255,255,255,.5))' : t.bg,
                      boxShadow: 'inset ' + (isSel ? 5 : 3) + 'px 0 0 ' + t.edge,
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>
                        {v.vehicle}
                        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>{v.ticket}</span>
                        <span className={'tag ' + t.tag} style={{ fontFamily: 'var(--font-body)' }}>{t.label}</span>
                      </span>
                      <span style={{ display: 'block', fontSize: 13 }}>{d.cust(v.custId).name} · {d.mat(v.matId).name}</span>
                      <span className="ag-tabular" style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-700)' }}>
                        Empty {kgOrDash(v.tare)} · Loaded {kgOrDash(v.gross)} · in at {v.inAt}
                      </span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: isSel ? 'var(--color-accent)' : 'var(--color-neutral-600)' }}>
                      {isSel ? 'Selected' : 'Select'}
                    </span>
                  </button>
                );
              })}
              {D.onsite.length === 0 && <div style={{ padding: 'var(--space-6)', fontSize: 13, color: 'var(--color-neutral-700)' }}>Platform clear.</div>}
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}
