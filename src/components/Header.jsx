import { TODAY_LABEL } from '../config';
import { pad2 } from '../lib/format';

export default function Header({ meta, scaleKg, onsite, tons, now, onWeighbridge, quickLabel, onQuick }) {
  return (
    <header
      className="ag-hdr"
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', padding: '26px var(--space-8) 22px',
        gap: 'var(--space-6)', borderBottom: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(22px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.5)', backgroundColor: '#F3F1F18C',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="ag-kicker">{meta.group} / {meta.label}</div>
        <h1 style={{ fontSize: 31, lineHeight: 1.08, letterSpacing: '-0.035em', margin: '6px 0 0' }}>{meta.title}</h1>
        <div style={{ fontSize: 13.5, color: 'var(--color-neutral-700)', marginTop: 5, maxWidth: '62ch', textWrap: 'pretty' }}>{meta.sub}</div>
      </div>

      <div
        className="ag-pulse ag-fade"
        aria-label="Weighbridge status"
        style={{
          display: 'flex', alignItems: 'stretch', flex: '1 1 300px', maxWidth: 520, minWidth: 0, border: '1px solid rgba(255,255,255,0.85)',
          borderRadius: 'var(--ag-r)', background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(22px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.5)', overflow: 'hidden',
        }}
      >
        <div className="ag-strip-cell" style={{ flex: '1.25 1 0', position: 'relative', overflow: 'hidden' }}>
          <div className="ag-scan" />
          <div className="ag-strip-label" style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            <span className="ag-dot ag-dot-round" style={{ width: 6, height: 6 }} />Platform
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 3, position: 'relative' }}>
            <span className="ag-strip-value">{scaleKg}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-600)' }}>kg</span>
          </div>
        </div>
        <div className="ag-strip-rule" />
        <div className="ag-strip-cell">
          <div className="ag-strip-label">On bridge</div>
          <div className="ag-strip-value" style={{ marginTop: 3 }}>{onsite}</div>
        </div>
        <div className="ag-strip-rule" />
        <div className="ag-strip-cell" style={{ flex: '1.15 1 0' }}>
          <div className="ag-strip-label">Today</div>
          <div className="ag-strip-value" style={{ marginTop: 3 }}>{tons}</div>
        </div>
      </div>

      <div className="ag-hdr-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: '0 0 auto' }}>
        <div style={{ textAlign: 'right', minWidth: 104 }}>
          <div className="ag-strip-label">{TODAY_LABEL}</div>
          <time
            dateTime={now.toISOString()}
            style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}
          >
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 21, letterSpacing: '-0.035em', lineHeight: 1 }}>
              {pad2(now.getHours())}:{pad2(now.getMinutes())}
            </span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 13, letterSpacing: '-0.02em', color: 'var(--color-neutral-600)', lineHeight: 1 }}>
              :{pad2(now.getSeconds())}
            </span>
          </time>
        </div>
        <div style={{ width: 1, height: 34, background: 'var(--color-neutral-300)' }} />
        <button type="button" className="btn btn-secondary" onClick={onWeighbridge}>Weighbridge</button>
        <button type="button" className="btn btn-primary" onClick={onQuick}>{quickLabel}</button>
      </div>
    </header>
  );
}
