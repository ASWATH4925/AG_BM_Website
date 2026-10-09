import { settings } from '../config';
import { brandMark } from '../lib/format';
import { MODS, NAV_GROUPS } from '../lib/modules';
import { ChevronRight, LogOut } from './Icons';

export default function Sidebar({ wide, mod, onsiteCount, go }) {
  const keys = Object.keys(MODS);

  if (!wide) {
    return (
      <nav className="ag-side" data-narrow="1" aria-label="Modules" style={{ background: 'linear-gradient(180deg, #F8F4F4, #B0B0B0)' }}>
        {keys.map((k) => (
          <button key={k} type="button" className="ag-chip" aria-current={k === mod ? 'page' : undefined} onClick={() => go(k)}>
            {MODS[k].label}
          </button>
        ))}
      </nav>
    );
  }

  return (
    <aside className="ag-side" data-narrow="0" style={{ background: 'linear-gradient(180deg, #F8F4F4, #B0B0B0)' }}>
      <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid rgba(32,30,29,.10)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            aria-hidden="true"
            style={{
              width: 30, height: 30, flex: '0 0 30px', background: 'var(--color-accent)', borderRadius: 2, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 12,
              letterSpacing: '0.01em', color: 'var(--color-neutral-100)',
            }}
          >
            {brandMark(settings.companyName)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {settings.companyName}
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>Aswath Transports</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: 'var(--space-3) 0' }} aria-label="Modules">
        {NAV_GROUPS.map((g) => (
          <div key={g}>
            <div style={{ padding: 'var(--space-3) var(--space-4) var(--space-1)' }}>
              <div className="ag-kicker">{g}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {keys.filter((k) => MODS[k].group === g).map((k) => {
                const badge = k === 'weighbridge' && onsiteCount ? onsiteCount : null;
                return (
                  <button key={k} type="button" className="ag-navitem" aria-current={k === mod ? 'page' : undefined} onClick={() => go(k)}>
                    <span style={{ flex: '1 1 auto', textAlign: 'left' }}>{MODS[k].label}</span>
                    {badge && <span className="ag-badge" aria-label={badge + ' vehicles on the bridge'}>{badge}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', padding: 'var(--space-3)' }}>
        <div className="ag-acctcard">
          <a
            className="ag-acct"
            href="#/profile"
            style={{
              display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
              fontFamily: 'var(--font-body)', textDecoration: 'none', color: 'var(--color-text)',
            }}
          >
            <Avatar />
            <span style={{ flex: '1 1 auto', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                A. Gopalakrishnan
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-neutral-700)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Owner · full access
              </span>
            </span>
            <ChevronRight style={{ flex: '0 0 15px', color: 'var(--color-neutral-600)' }} />
          </a>
          <a className="ag-out" href="#/login">
            <LogOut style={{ flex: '0 0 14px' }} />
            Log out
          </a>
        </div>
      </div>
    </aside>
  );
}

export function Avatar({ size = 34, font = 12.5 }) {
  return (
    <span style={{ position: 'relative', flex: `0 0 ${size}px` }}>
      <span
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: 999,
          background: 'var(--color-neutral-900)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 800,
          fontSize: font, letterSpacing: '0.02em',
        }}
      >
        AG
      </span>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: 999, background: '#1f9d55',
          boxShadow: '0 0 0 2.5px rgba(255,255,255,.95)',
        }}
      />
    </span>
  );
}
