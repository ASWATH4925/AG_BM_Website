import { tagOf } from '../lib/domain';

// KPI tile (.ag-stat). Sizes follow the three variants used in the reference.
const SIZES = {
  hero: { pad: 'var(--space-6)', font: 36, ls: '-0.045em', mt: 12 },
  list: { pad: 'var(--space-6)', font: 30, ls: '-0.04em', mt: 11 },
};

export default function StatTile({ label, value, note, delta, deltaTag, size = 'list' }) {
  const s = SIZES[size];
  return (
    <div className="ag-stat" style={{ padding: s.pad }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <div className="ag-label">{label}</div>
        {delta && <span className={'tag ' + (deltaTag || tagOf(delta))}>{delta}</span>}
      </div>
      <div className="ag-big" style={{ fontSize: s.font, letterSpacing: s.ls, marginTop: s.mt }}>
        <span className="ag-num">{value}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', marginTop: 6, textWrap: 'pretty' }}>{note}</div>
    </div>
  );
}

export function MinorTile({ label, value, note }) {
  return (
    <div className="ag-stat" style={{ padding: 'var(--space-4) var(--space-6)' }}>
      <div className="ag-label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 7 }}>
        <div className="ag-big" style={{ fontSize: 21, letterSpacing: '-0.03em' }}>
          <span className="ag-num">{value}</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>{note}</div>
      </div>
    </div>
  );
}
