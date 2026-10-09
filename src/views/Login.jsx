import { useEffect, useRef, useState } from 'react';
import { settings } from '../config';
import { brandMark } from '../lib/format';
import '../styles/login.css';

const PANEL_STATS = [
  { value: '412 t', label: 'Weighed today' },
  { value: '18', label: 'Open tickets' },
  { value: '99.4%', label: 'Ticket accuracy' },
];

const LABEL = { display: 'block', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', fontWeight: 700, marginBottom: 7 };
const GLASS = {
  border: '1px solid rgba(255,255,255,.85)', borderRadius: 'var(--ag-r)', background: 'rgba(255,255,255,.66)',
  backdropFilter: 'blur(22px) saturate(1.5)', WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
  boxShadow: '0 1px 2px rgba(32,30,29,.05), 0 10px 30px -16px rgba(32,30,29,.22)',
};

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const Check = ({ size, width }) => <svg {...svg} strokeWidth={width} width={size} height={size}><path d="M20 6 9 17l-5-5" /></svg>;

function FieldError({ children }) {
  return (
    <div role="alert" className="ag-fade" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-accent-800)', marginTop: 7 }}>
      <svg {...svg} strokeWidth="2.2" width="13" height="13"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
      {children}
    </div>
  );
}

function Mark({ size, font, radius }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, flex: `0 0 ${size}px`, background: 'var(--color-accent)', borderRadius: radius, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: font, color: '#fff',
      }}
    >
      {brandMark(settings.companyName)}
    </div>
  );
}

// Sign-in page: split layout with the dark brand panel, glass card with validation, demo credential check.
export default function Login({ onEnter }) {
  const [s, setS] = useState({ email: '', pw: '', showPw: false, remember: true, busy: false, done: false, err: {} });
  const set = (patch) => setS((st) => ({ ...st, ...(typeof patch === 'function' ? patch(st) : patch) }));
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const submit = (e) => {
    e.preventDefault();
    if (s.busy) return;
    const err = {};
    const em = s.email.trim();
    if (!em) err.email = 'Enter your work email.';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(em)) err.email = 'That does not look like an email address.';
    if (!s.pw) err.pw = 'Enter your password.';
    else if (s.pw.length < 6) err.pw = 'Passwords are at least six characters.';
    if (Object.keys(err).length) { set({ err }); return; }
    set({ busy: true, err: {} });
    timer.current = setTimeout(() => set({ busy: false, done: true }), 1300);
  };

  const usePin = () => set({ email: 'operator@agbluemetals.in', pw: '', showPw: false, err: { pw: 'Enter the six-digit terminal PIN.' } });

  return (
    <div
      className="pg-login"
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'stretch', background: 'linear-gradient(157deg,#fcfbfa 0%,#f3f2f2 38%,#e9e5e3 74%,#ded8d5 100%)',
        color: 'var(--color-text)', fontFamily: 'var(--font-body)', letterSpacing: '-0.011em',
      }}
    >
      <aside
        className="lg-panel"
        style={{
          flex: '0 0 44%', maxWidth: 620, minWidth: 0, position: 'relative', overflow: 'hidden', background: 'var(--color-neutral-900)',
          color: 'var(--color-neutral-100)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 44,
        }}
      >
        <div className="ag-scan" />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11 }}>
          <Mark size={32} font={13} radius="var(--ag-r-sm)" />
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>{settings.companyName}</div>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-neutral-400)' }}>Weighbridge operations</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'clamp(34px,4.2vw,52px)', lineHeight: 1.02, letterSpacing: '-0.045em', margin: '16px 0 0', maxWidth: '11ch', textWrap: 'pretty' }}>
            Every load, weighed and accounted.
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--color-neutral-400)', margin: '18px 0 0', maxWidth: '38ch', textWrap: 'pretty' }}>
            Tare to gross, rate to receipt. One console for the yard, the ledger and the payroll.
          </p>
        </div>

        <div className="ag-stagger" style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 'var(--space-4)' }}>
          {PANEL_STATS.map((p) => (
            <div key={p.label} style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.16)' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{p.value}</div>
              <div style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-neutral-400)', marginTop: 6 }}>{p.label}</div>
            </div>
          ))}
        </div>
      </aside>

      <main style={{ flex: '1 1 0', minWidth: 0, display: 'grid', placeItems: 'center', padding: '44px 24px' }}>
        <div style={{ width: 'min(400px,100%)' }}>
          <div className="lg-mark" style={{ alignItems: 'center', gap: 11, marginBottom: 26 }}>
            <Mark size={34} font={13.5} radius="var(--ag-r-sm)" />
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.025em' }}>{settings.companyName}</div>
          </div>

          {s.done ? (
            <div className="ag-pop" style={{ ...GLASS, padding: '38px 30px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, margin: '0 auto', borderRadius: 999, background: 'rgba(44,107,18,.12)', color: '#2c6b12' }}>
                <Check size={24} width={2.5} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em', margin: '18px 0 0' }}>Signed in</h2>
              <p style={{ fontSize: 13.5, color: 'var(--color-neutral-700)', margin: '7px 0 0' }}>Opening the console for {s.email.trim() || 'your account'}.</p>
              <div style={{ marginTop: 22 }}>
                <a
                  className="btn btn-primary"
                  href="#/"
                  onClick={onEnter}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 44, padding: '0 22px', color: '#fff' }}
                >
                  Go to console
                </a>
              </div>
              <button type="button" className="ag-alt" style={{ marginTop: 10 }} onClick={() => set({ done: false, pw: '', err: {} })}>Sign in as someone else</button>
            </div>
          ) : (
            <div className="ag-rise" style={{ ...GLASS, padding: '32px 30px 30px' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-neutral-700)' }}>Console access</div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 27, lineHeight: 1.1, letterSpacing: '-0.035em', margin: '9px 0 0' }}>Sign in</h2>
              <p style={{ fontSize: 13.5, color: 'var(--color-neutral-700)', margin: '7px 0 0', textWrap: 'pretty' }}>Use the work account issued by your site administrator.</p>

              <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 26 }}>
                <div>
                  <label htmlFor="ag-email" style={LABEL}>Work email</label>
                  <input
                    id="ag-email"
                    className="ag-in"
                    type="email"
                    autoComplete="username"
                    placeholder="name@agbluemetals.in"
                    data-bad={s.err.email ? '1' : '0'}
                    aria-invalid={s.err.email ? true : undefined}
                    value={s.email}
                    onChange={(e) => set({ email: e.target.value, err: {} })}
                  />
                  {s.err.email && <FieldError>{s.err.email}</FieldError>}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 7 }}>
                    <label htmlFor="ag-pw" style={{ ...LABEL, display: 'inline', marginBottom: 0 }}>Password</label>
                    <a href="#reset" style={{ fontSize: 12, fontWeight: 600 }}>Forgot?</a>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="ag-pw"
                      className="ag-in"
                      style={{ paddingRight: 46 }}
                      type={s.showPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      data-bad={s.err.pw ? '1' : '0'}
                      aria-invalid={s.err.pw ? true : undefined}
                      value={s.pw}
                      onChange={(e) => set({ pw: e.target.value, err: {} })}
                    />
                    <button type="button" className="ag-eye" aria-label={s.showPw ? 'Hide password' : 'Show password'} onClick={() => set((st) => ({ showPw: !st.showPw }))}>
                      {s.showPw ? (
                        <svg {...svg} strokeWidth="2" width="17" height="17">
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                          <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                          <path d="m2 2 20 20" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        </svg>
                      ) : (
                        <svg {...svg} strokeWidth="2" width="17" height="17">
                          <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" /><circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {s.err.pw && <FieldError>{s.err.pw}</FieldError>}
                </div>

                <button
                  type="button"
                  className="ag-remember"
                  role="checkbox"
                  aria-checked={s.remember}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)', alignSelf: 'flex-start' }}
                  onClick={() => set((st) => ({ remember: !st.remember }))}
                >
                  <span className="ag-check" data-on={s.remember ? '1' : '0'}><Check size={12} width={3.4} /></span>
                  Keep me signed in on this terminal
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', height: 46, fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 2 }}
                  disabled={s.busy}
                >
                  {s.busy && <span className="ag-spin" />}
                  {s.busy ? 'Checking credentials…' : 'Sign in'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: '22px 0 16px' }}>
                <span style={{ flex: '1 1 auto', height: 1, background: 'rgba(32,30,29,.12)' }} />
                <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-neutral-700)' }}>or</span>
                <span style={{ flex: '1 1 auto', height: 1, background: 'rgba(32,30,29,.12)' }} />
              </div>

              <button type="button" className="ag-alt" onClick={usePin}>
                <svg {...svg} strokeWidth="2" width="16" height="16"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                Operator PIN for the weighbridge
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginTop: 20, fontSize: 12, color: 'var(--color-neutral-700)' }}>
            <span>Bridge terminal 1 · Hosur Road yard</span>
            <a href="#help">Need help?</a>
          </div>
        </div>
      </main>
    </div>
  );
}
