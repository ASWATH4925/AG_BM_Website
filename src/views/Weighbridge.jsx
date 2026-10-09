import Field from '../components/Field';
import Panel from '../components/Panel';
import Select from '../components/Select';
import { settings } from '../config';
import { OTHER_MATERIAL } from '../lib/domain';
import { M, N, T } from '../lib/format';

export default function Weighbridge({ d, scale, wb, setWb, onCapture, onWeighOut, onConfirm, onVoid, onCancel }) {
  const D = d.db;
  const sel = wb.outId ? D.onsite.find((x) => x.id === wb.outId) || null : null;
  const netKg = sel ? Math.max(0, scale - sel.tare) : 0;
  const steps = [
    { l: 'Tare', v: sel ? N(sel.tare) + ' kg' : D.onsite.length ? 'Ticket open' : 'On entry', on: !!sel || D.onsite.length > 0 },
    { l: 'Gross', v: sel ? N(scale) + ' kg' : 'On exit', on: !!sel },
    { l: 'Net', v: sel && netKg > 0 ? T(netKg / 1000) + ' t' : '—', on: !!sel && netKg > 0 },
    { l: 'Value', v: sel && netKg > 0 ? M((netKg / 1000) * d.rateFor(sel.custId, sel.matId).rate) : '—', on: !!sel && netKg > 0 },
  ];
  const rate = d.rateFor(wb.custId, wb.matId);

  let out = null;
  if (sel) {
    const o = { custId: sel.custId, matId: sel.matId, tare: sel.tare, gross: scale };
    const rr = d.rateFor(sel.custId, sel.matId);
    const amt = d.amount(o);
    out = {
      weights: [
        { label: 'Tare', value: N(sel.tare), unit: 'kg · captured ' + sel.inAt },
        { label: 'Gross', value: N(scale), unit: 'kg · live' },
        { label: 'Net', value: T(d.net(o)), unit: 'tonnes' },
      ],
      lines: [
        { label: 'Party', value: d.cust(sel.custId).name },
        { label: 'Material', value: d.mat(sel.matId).name },
        { label: 'Rate (' + rr.src + ')', value: rr.rate ? M(rr.rate) + ' / t' : 'Not set' },
      ],
      total: M(amt),
    };
  }

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
              {wb.outId ? 'Loaded vehicle on the platform. Confirm to take this as the gross weight.' : 'Empty vehicle on the platform. Confirm to take this as the tare weight.'}
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
              <button type="button" className="btn btn-primary" onClick={onCapture}>Capture tare · open ticket</button>
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
        </Panel>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Panel className="ag-rise ag-card" title={'On site — awaiting weigh-out (' + D.onsite.length + ')'} sub="Open tickets holding a tare weight">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {D.onsite.map((v) => (
                <div
                  key={v.id}
                  className="ag-listrow"
                  style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid rgba(32,30,29,.10)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>
                      {v.vehicle}{' '}
                      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>{v.ticket}</span>
                    </div>
                    <div style={{ fontSize: 13 }}>{d.cust(v.custId).name} · {d.mat(v.matId).name}</div>
                    <div className="ag-tabular" style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Tare {N(v.tare)} kg · in at {v.inAt}</div>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => onWeighOut(v.id)}>Weigh out</button>
                </div>
              ))}
              {D.onsite.length === 0 && <div style={{ padding: 'var(--space-6)', fontSize: 13, color: 'var(--color-neutral-700)' }}>Platform clear.</div>}
            </div>
          </Panel>

          {sel && out && (
            <div className="ag-pop" style={{ border: '1px solid var(--color-accent)', borderRadius: 'var(--ag-r)', overflow: 'hidden', background: 'var(--color-bg)' }}>
              <div style={{ padding: 'var(--space-4) var(--space-6)', background: 'var(--color-accent)', color: 'var(--color-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                <h4 style={{ margin: 0, fontSize: 15.5, letterSpacing: '-0.02em', color: 'var(--color-bg)' }}>Weigh-out — {sel.vehicle}</h4>
                <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{sel.ticket}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 'var(--space-4)', padding: 'var(--space-6)', borderBottom: '1px solid rgba(32,30,29,.10)' }}>
                {out.weights.map((w) => (
                  <div className="ag-stat" key={w.label} style={{ padding: 'var(--space-4) var(--space-6)' }}>
                    <div className="ag-label">{w.label}</div>
                    <div className="ag-big" style={{ fontSize: 24, letterSpacing: '-0.035em', marginTop: 7 }}><span className="ag-num">{w.value}</span></div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 4 }}>{w.unit}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: 'var(--space-6)' }}>
                {out.lines.map((l) => (
                  <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', padding: '5px 0', fontSize: 14, borderBottom: '1px solid rgba(32,30,29,.10)' }}>
                    <span style={{ color: 'var(--color-neutral-800)' }}>{l.label}</span>
                    <span className="ag-tabular" style={{ fontWeight: 600 }}>{l.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-3) 0 0' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>Bill (net tons × rate)</span>
                  <span className="ag-tabular" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22 }}>{out.total}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                  <button type="button" className="btn btn-primary" onClick={onConfirm}>Confirm · record payment</button>
                  <button type="button" className="btn btn-secondary" onClick={onVoid}>Void load</button>
                  <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 'var(--space-3)' }}>
                  Gross is taken from the live reading at confirmation, then you record how the load was paid. Voiding files the ticket under Void Orders with nothing billed.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
