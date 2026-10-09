import { useEffect, useRef, useState } from 'react';
import '../styles/profile.css';

const TABS = ['Details', 'Security', 'Activity'];
const STEPS = ['form', 'otp', 'done'];

const STATS = [
  { label: 'Tickets closed', value: '1,284', note: 'Since April 2024' },
  { label: 'Payments recorded', value: '₹4.6 Cr', note: 'Across 92 accounts' },
  { label: 'Voids approved', value: '17', note: 'All with a stated reason' },
  { label: 'Last sign-in', value: 'Today', note: '07:42 · bridge terminal 1' },
];

const MODULES = ['Dashboard', 'Credit Parties', 'Soling Suppliers', 'Materials', 'Orders', 'Weighbridge', 'Void Orders', 'Payments', 'Employees', 'Attendance', 'Advances', 'Payroll', 'Expenses']
  .map((m) => ({ label: m, cls: m === 'Credit Parties' || m === 'Void Orders' || m === 'Payroll' ? 'ag-t-warn' : 'ag-t-ok' }));

const FIELDS = [['name', 'Full name'], ['email', 'Work email'], ['phone', 'Phone'], ['yard', 'Home yard'], ['employeeId', 'Employee ID']];

const TOGGLES = [
  ['twoFA', 'Two-factor authentication', 'A code to your phone on every new terminal.'],
  ['pinLock', 'PIN lock on the bridge', 'Six-digit PIN before confirming a weigh-out.'],
  ['alerts', 'Credit-limit alerts', 'Notify me when an account passes 80% of its limit.'],
];

const ALL_SESSIONS = [
  { device: 'Bridge terminal 1', where: 'Hosur Road yard', when: 'Active now', state: 'This device', cls: 'ag-t-ok' },
  { device: 'Office desktop', where: 'Hosur Road yard', when: 'Yesterday, 18:20', state: 'Idle', cls: 'ag-t-mute' },
  { device: 'iPhone 15', where: 'Bengaluru', when: '8 Sept, 09:05', state: 'Signed in', cls: 'ag-t-info' },
];

const ACTIVITY = [
  { when: 'Today 09:14', what: 'Confirmed weigh-out', ref: 'TKT-2291', state: 'Completed', cls: 'ag-t-ok' },
  { when: 'Today 08:52', what: 'Recorded payment', ref: 'PAY-0417', state: 'Cleared', cls: 'ag-t-ok' },
  { when: 'Today 08:31', what: 'Blocked at credit limit', ref: 'Nandi Infra', state: 'At limit', cls: 'ag-t-bad' },
  { when: 'Yesterday 17:40', what: 'Voided order', ref: 'TKT-2274', state: 'Void', cls: 'ag-t-bad' },
  { when: 'Yesterday 15:02', what: 'Updated contract rate', ref: 'RATE-M20', state: 'Pending', cls: 'ag-t-warn' },
  { when: '8 Sept 11:26', what: 'Dispatched order', ref: 'TKT-2258', state: 'In Transit', cls: 'ag-t-info' },
];

const EMPTY_OTP = ['', '', '', '', '', ''];

function strength(v) {
  if (!v) return { pct: 0, label: '—', color: 'var(--color-neutral-600)', hint: 'Eight characters minimum.' };
  let n = 0;
  if (v.length >= 8) n++;
  if (v.length >= 12) n++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) n++;
  if (/\d/.test(v)) n++;
  if (/[^A-Za-z0-9]/.test(v)) n++;
  if (v.length < 8) return { pct: 18, label: 'Too short', color: 'var(--color-accent)', hint: 'Eight characters minimum.' };
  if (n <= 2) return { pct: 38, label: 'Weak', color: 'var(--color-accent)', hint: 'Add a number or a symbol.' };
  if (n === 3) return { pct: 64, label: 'Fair', color: '#8a5207', hint: 'Mix upper and lower case.' };
  if (n === 4) return { pct: 84, label: 'Strong', color: '#2c6b12', hint: 'Good to go.' };
  return { pct: 100, label: 'Very strong', color: '#2c6b12', hint: 'Good to go.' };
}

function maskEmail(e) {
  const at = e.indexOf('@');
  if (at < 1) return e;
  const u = e.slice(0, at);
  const d = e.slice(at);
  return (u.length <= 2 ? u[0] + '•' : u.slice(0, 2) + '•'.repeat(Math.max(3, u.length - 3)) + u.slice(-1)) + d;
}

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const Check = ({ size, width }) => <svg {...svg} strokeWidth={width} width={size} height={size}><path d="M20 6 9 17l-5-5" /></svg>;
const KICKER = { fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', fontWeight: 700 };
const LABEL = { ...KICKER, display: 'block', marginBottom: 7 };
const ERR = { fontSize: 12, color: 'var(--color-accent-800)', marginTop: 6 };

function CardHead({ title, sub, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', padding: '16px var(--space-6)', borderBottom: '1px solid rgba(32,30,29,.10)' }}>
      <div>
        <h4 style={{ margin: 0, fontSize: 15.5, letterSpacing: '-0.02em' }}>{title}</h4>
        <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 3 }}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

// Account page: identity header, stats, Details / Security / Activity tabs and the change-password flow with OTP.
export default function Profile({ onSignOut }) {
  const [s, setS] = useState({
    tab: 'Details', editing: false, toast: '', twoFA: true, pinLock: true, alerts: false, sessionsEnded: false,
    profile: { name: 'A. Gopalakrishnan', email: 'gopal@agbluemetals.in', phone: '+91 98450 22119', yard: 'Hosur Road yard, Bengaluru', employeeId: 'AG-0001' },
    draft: null, pwOpen: false, pwStep: 'form', curPw: '', newPw: '', confPw: '', pwErr: {},
    sending: false, verifying: false, otp: EMPTY_OTP, otpErr: '', code: '', cooldown: 0, pwChangedOn: '14 June 2026',
  });
  const set = (patch) => setS((st) => ({ ...st, ...(typeof patch === 'function' ? patch(st) : patch) }));
  const otpRefs = useRef([]);
  const timers = useRef({});

  useEffect(() => () => {
    clearTimeout(timers.current.toast);
    clearTimeout(timers.current.step);
    clearTimeout(timers.current.out);
    clearInterval(timers.current.cool);
  }, []);

  const flash = (msg) => {
    clearTimeout(timers.current.toast);
    set({ toast: msg });
    timers.current.toast = setTimeout(() => set({ toast: '' }), 2600);
  };

  const startCooldown = () => {
    clearInterval(timers.current.cool);
    set({ cooldown: 30 });
    timers.current.cool = setInterval(() => set((st) => {
      if (st.cooldown <= 1) { clearInterval(timers.current.cool); return { cooldown: 0 }; }
      return { cooldown: st.cooldown - 1 };
    }), 1000);
  };

  const issueCode = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    set({ code, otp: EMPTY_OTP, otpErr: '' });
    startCooldown();
  };

  const focusOtp = (i) => {
    const el = otpRefs.current[i];
    if (el) { el.focus(); el.select(); }
  };

  const setOtpAt = (i, ch) => set((st) => {
    const o = st.otp.slice();
    o[i] = ch;
    return { otp: o, otpErr: '' };
  });

  const closePw = () => { clearInterval(timers.current.cool); set({ pwOpen: false, cooldown: 0 }); };
  const openPw = () => set({ pwOpen: true, pwStep: 'form', curPw: '', newPw: '', confPw: '', pwErr: {}, otpErr: '' });

  useEffect(() => {
    if (!s.pwOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closePw(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const p = s.editing ? s.draft : s.profile;
  const initials = p.name.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const str = strength(s.newPw);
  const masked = maskEmail(s.profile.email);
  const stepIndex = STEPS.indexOf(s.pwStep);

  const sendOtp = () => {
    const err = {};
    if (!s.curPw) err.cur = 'Enter your current password.';
    if (!s.newPw || s.newPw.length < 8) err.conf = 'New password must be at least eight characters.';
    else if (s.newPw === s.curPw) err.conf = 'The new password must differ from the current one.';
    else if (s.newPw !== s.confPw) err.conf = 'The two passwords do not match.';
    if (Object.keys(err).length) { set({ pwErr: err }); return; }
    set({ sending: true, pwErr: {} });
    timers.current.step = setTimeout(() => {
      issueCode();
      set({ sending: false, pwStep: 'otp' });
      flash('Code sent to ' + masked);
      setTimeout(() => focusOtp(0), 60);
    }, 1100);
  };

  const verify = () => {
    const entered = s.otp.join('');
    if (entered.length < 6) { set({ otpErr: 'Enter all six digits.' }); return; }
    if (entered !== s.code) { set({ otpErr: 'That code is not right. Check the email and try again.' }); return; }
    set({ verifying: true });
    timers.current.step = setTimeout(() => {
      clearInterval(timers.current.cool);
      set({
        verifying: false, pwStep: 'done', sessionsEnded: true, cooldown: 0, curPw: '', newPw: '', confPw: '',
        pwChangedOn: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      });
      flash('Password changed');
    }, 1100);
  };

  const signOut = () => {
    flash('Signed out');
    timers.current.out = setTimeout(onSignOut, 900);
  };

  const sessions = s.sessionsEnded ? ALL_SESSIONS.slice(0, 1) : ALL_SESSIONS;

  return (
    <div
      className="pg-profile"
      style={{ minHeight: '100vh', background: 'linear-gradient(157deg,#fcfbfa 0%,#f3f2f2 38%,#e9e5e3 74%,#ded8d5 100%)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', letterSpacing: '-0.011em' }}
    >
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '34px 24px 64px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <a href="#/" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>
            <svg {...svg} strokeWidth="2.2" width="15" height="15"><path d="m15 18-6-6 6-6" /></svg>
            Back to console
          </a>
          <span style={KICKER}>Account</span>
        </div>

        <section
          className="ag-rise"
          aria-label="Account summary"
          style={{
            position: 'relative', overflow: 'hidden', borderRadius: 'var(--ag-r)', background: 'var(--color-neutral-900)', color: 'var(--color-neutral-100)', padding: 30,
            marginTop: 18, border: '1px solid rgba(255,255,255,.10)', boxShadow: '0 1px 2px rgba(32,30,29,.06), 0 16px 40px -20px rgba(32,30,29,.5)',
          }}
        >
          <div className="ag-scan" />
          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-6)' }}>
            <span style={{ position: 'relative', flex: '0 0 78px' }}>
              <span
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 78, height: 78, borderRadius: 999, background: 'var(--color-accent)', color: '#fff',
                  fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 27, letterSpacing: '0.01em', boxShadow: '0 6px 20px -6px rgba(236,48,19,.7)',
                }}
              >
                {initials}
              </span>
              <span aria-hidden="true" style={{ position: 'absolute', right: 3, bottom: 3, width: 15, height: 15, borderRadius: 999, background: '#2fbe6d', boxShadow: '0 0 0 3px var(--color-neutral-900)' }} />
            </span>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 31, lineHeight: 1.06, letterSpacing: '-0.04em', margin: 0 }}>{p.name}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9, marginTop: 11 }}>
                <span className="ag-rolechip">Owner · full access</span>
                <span style={{ fontSize: 13, color: 'var(--color-neutral-300)' }}>{p.email}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: 40, padding: '0 18px', fontWeight: 700 }}
                onClick={() => set((st) => ({ editing: true, tab: 'Details', draft: { ...st.profile } }))}
              >
                {s.editing ? 'Editing…' : 'Edit profile'}
              </button>
              <button
                type="button"
                className="btn"
                style={{ height: 40, padding: '0 18px', fontWeight: 600, border: '1px solid rgba(255,255,255,.24)', background: 'transparent', color: 'var(--color-neutral-100)' }}
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
          </div>
        </section>

        <div className="ag-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
          {STATS.map((k) => (
            <div key={k.label} className="ag-stat" style={{ padding: '18px var(--space-6) 20px' }}>
              <div style={KICKER}>{k.label}</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.04em', marginTop: 10, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                <span className="ag-num">{k.value}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 5 }}>{k.note}</div>
            </div>
          ))}
        </div>

        <div role="tablist" aria-label="Account sections" style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid rgba(32,30,29,.14)', margin: '30px 0 22px' }}>
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={s.tab === t} className="ag-tab" data-on={s.tab === t ? '1' : '0'} onClick={() => set({ tab: t })}>
              {t}<i />
            </button>
          ))}
        </div>

        {s.tab === 'Details' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(330px,100%),1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
            <div className="ag-card">
              <CardHead title="Account details" sub="How you appear on tickets and receipts">
                {s.editing && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-ghost" style={{ height: 32, padding: '0 13px', fontSize: 12.5 }} onClick={() => set({ editing: false, draft: null })}>Cancel</button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ height: 32, padding: '0 14px', fontSize: 12.5, fontWeight: 700 }}
                      onClick={() => { set((st) => ({ profile: { ...st.draft }, editing: false, draft: null })); flash('Profile updated'); }}
                    >
                      Save
                    </button>
                  </div>
                )}
              </CardHead>
              <div>
                {FIELDS.map(([k, label]) => (
                  <div key={k} className="ag-row">
                    <label htmlFor={'pf-' + k} style={{ ...KICKER, flex: '0 0 122px' }}>{label}</label>
                    {s.editing ? (
                      <input
                        id={'pf-' + k}
                        className="ag-in"
                        style={{ flex: '1 1 180px', width: 'auto' }}
                        value={p[k]}
                        onChange={(e) => { const v = e.target.value; set((st) => ({ draft: { ...st.draft, [k]: v } })); }}
                      />
                    ) : (
                      <span style={{ flex: '1 1 auto', textAlign: 'right', fontSize: 13.5, fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{p[k]}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="ag-card">
              <CardHead title="Module access" sub="All thirteen modules, plus rate and void authority" />
              <div style={{ padding: 'var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                {MODULES.map((m) => <span key={m.label} className={'tag ' + m.cls}>{m.label}</span>)}
              </div>
              <div style={{ padding: '0 var(--space-6) var(--space-6)' }}>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>
                  Full access is granted by the site administrator. Void and rate changes are always logged against your name.
                </div>
              </div>
            </div>
          </div>
        )}

        {s.tab === 'Security' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(330px,100%),1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
            <div className="ag-card">
              <CardHead title="Sign-in and security" sub="Protects rate edits, voids and payroll" />
              <div>
                {TOGGLES.map(([k, label, note]) => (
                  <div key={k} className="ag-row" style={{ alignItems: 'center' }}>
                    <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{label}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 2, textWrap: 'pretty' }}>{note}</span>
                    </span>
                    <button
                      type="button"
                      className="ag-sw"
                      role="switch"
                      aria-checked={s[k]}
                      aria-label={label}
                      data-on={s[k] ? '1' : '0'}
                      onClick={() => { flash(label + (s[k] ? ' turned off' : ' turned on')); set((st) => ({ [k]: !st[k] })); }}
                    >
                      <i />
                    </button>
                  </div>
                ))}
                <div className="ag-row" style={{ alignItems: 'center' }}>
                  <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>Password</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 2 }}>Last changed {s.pwChangedOn}</span>
                  </span>
                  <button type="button" className="btn btn-ghost" style={{ height: 34, padding: '0 14px', fontSize: 12.5 }} onClick={openPw}>Change</button>
                </div>
              </div>
            </div>

            <div className="ag-card">
              <CardHead title="Active sessions" sub="Terminals currently holding your account" />
              <div>
                {sessions.map((x) => (
                  <div key={x.device} className="ag-row" style={{ alignItems: 'center' }}>
                    <span style={{ flex: '1 1 180px', minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{x.device}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 2 }}>{x.where} · {x.when}</span>
                    </span>
                    <span className={'tag ' + x.cls}>{x.state}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid rgba(32,30,29,.10)' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ height: 34, padding: '0 14px', fontSize: 12.5 }}
                  onClick={() => { set({ sessionsEnded: true }); flash('Other sessions ended'); }}
                >
                  End all other sessions
                </button>
              </div>
            </div>
          </div>
        )}

        {s.tab === 'Activity' && (
          <div className="ag-card">
            <CardHead title="Recent activity" sub="Actions recorded against your account" />
            <div style={{ overflowX: 'auto' }}>
              <table className="ag-tb" style={{ minWidth: 640 }}>
                <thead>
                  <tr><th>When</th><th>Action</th><th>Reference</th><th>Result</th></tr>
                </thead>
                <tbody>
                  {ACTIVITY.map((a) => (
                    <tr key={a.ref + a.when}>
                      <td style={{ color: 'var(--color-neutral-700)', fontVariantNumeric: 'tabular-nums' }}>{a.when}</td>
                      <td style={{ fontWeight: 600 }}>{a.what}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-700)' }}>{a.ref}</td>
                      <td><span className={'tag ' + a.cls}>{a.state}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {s.pwOpen && (
        <div className="ag-back">
          <div onClick={closePw} style={{ position: 'absolute', inset: 0 }} />
          <div className="ag-modal" role="dialog" aria-modal="true" aria-labelledby="pf-pw-title" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', padding: '22px 24px 18px', borderBottom: '1px solid rgba(32,30,29,.10)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={KICKER}>{s.pwStep === 'done' ? 'Confirmed' : 'Security'}</div>
                <h3 id="pf-pw-title" style={{ margin: '7px 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 21, letterSpacing: '-0.03em' }}>
                  {s.pwStep === 'form' ? 'Change password' : s.pwStep === 'otp' ? 'Verify it is you' : 'All set'}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--color-neutral-700)', margin: '6px 0 0', textWrap: 'pretty' }}>
                  {s.pwStep === 'form' ? 'Choose a new password for this account.'
                    : s.pwStep === 'otp' ? 'Enter the six-digit code sent to ' + masked + '.'
                      : 'Your password was changed just now.'}
                </p>
              </div>
              <button type="button" className="ag-x" aria-label="Close" onClick={closePw}>
                <svg {...svg} strokeWidth="2.2" width="17" height="17"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, padding: '14px 24px 0' }} aria-hidden="true">
              {STEPS.map((k, i) => (
                <span key={k} style={{ flex: '1 1 0', height: 3, borderRadius: 999, background: stepIndex >= i ? 'var(--color-accent)' : 'rgba(32,30,29,.14)', transition: 'background .4s var(--ag-ease)' }} />
              ))}
            </div>

            {s.pwStep === 'form' && (
              <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 15 }}>
                <div>
                  <label htmlFor="pw-cur" style={LABEL}>Current password</label>
                  <input
                    id="pw-cur"
                    className="ag-in"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={s.curPw}
                    onChange={(e) => { const v = e.target.value; set((st) => ({ curPw: v, pwErr: { ...st.pwErr, cur: null } })); }}
                  />
                  {s.pwErr.cur && <div role="alert" className="ag-fade" style={ERR}>{s.pwErr.cur}</div>}
                </div>
                <div>
                  <label htmlFor="pw-new" style={LABEL}>New password</label>
                  <input
                    id="pw-new"
                    className="ag-in"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least eight characters"
                    value={s.newPw}
                    onChange={(e) => { const v = e.target.value; set((st) => ({ newPw: v, pwErr: { ...st.pwErr, conf: null } })); }}
                  />
                  <div className="ag-meter"><i style={{ width: str.pct + '%', background: str.color }} /></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', fontSize: 11.5, color: 'var(--color-neutral-700)', marginTop: 6 }}>
                    <span>{str.hint}</span>
                    <span style={{ fontWeight: 700, color: str.color }}>{str.label}</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="pw-conf" style={LABEL}>Confirm new password</label>
                  <input
                    id="pw-conf"
                    className="ag-in"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat it"
                    value={s.confPw}
                    onChange={(e) => { const v = e.target.value; set((st) => ({ confPw: v, pwErr: { ...st.pwErr, conf: null } })); }}
                  />
                  {s.pwErr.conf && <div role="alert" className="ag-fade" style={ERR}>{s.pwErr.conf}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 13px', borderRadius: 12, background: 'rgba(47,79,212,.07)', border: '1px solid rgba(47,79,212,.2)' }}>
                  <svg {...svg} stroke="#2f4fd4" strokeWidth="2" width="16" height="16" style={{ flex: '0 0 16px', marginTop: 1 }}>
                    <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span style={{ fontSize: 12.5, color: '#1f3a9e', lineHeight: 1.45, textWrap: 'pretty' }}>
                    We will email a six-digit code to <strong>{masked}</strong> to confirm this change.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', height: 44, fontSize: 14, fontWeight: 700, marginTop: 3 }}
                  disabled={s.sending}
                  onClick={sendOtp}
                >
                  {s.sending && <span className="ag-spin" />}
                  {s.sending ? 'Sending code…' : 'Send verification code'}
                </button>
              </div>
            )}

            {s.pwStep === 'otp' && (
              <div style={{ padding: '20px 24px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 8 }}>
                  {s.otp.map((v, i) => (
                    <input
                      key={'d' + i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      className="ag-otp"
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={'Digit ' + (i + 1)}
                      data-filled={v ? '1' : '0'}
                      data-bad={s.otpErr ? '1' : '0'}
                      value={v}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const dgt = (e.target.value || '').replace(/\D/g, '').slice(-1);
                        setOtpAt(i, dgt);
                        if (dgt && i < 5) setTimeout(() => focusOtp(i + 1), 0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !s.otp[i] && i > 0) { e.preventDefault(); setOtpAt(i - 1, ''); focusOtp(i - 1); }
                        else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); focusOtp(i - 1); }
                        else if (e.key === 'ArrowRight' && i < 5) { e.preventDefault(); focusOtp(i + 1); }
                      }}
                      onPaste={(e) => {
                        const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                        if (!t) return;
                        e.preventDefault();
                        const o = EMPTY_OTP.slice();
                        for (let j = 0; j < t.length; j++) o[j] = t[j];
                        set({ otp: o, otpErr: '' });
                        setTimeout(() => focusOtp(Math.min(t.length, 5)), 0);
                      }}
                    />
                  ))}
                </div>
                {s.otpErr && (
                  <div role="alert" className="ag-fade" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-accent-800)', marginTop: 12 }}>
                    <svg {...svg} strokeWidth="2.2" width="14" height="14"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
                    {s.otpErr}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginTop: 16 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>
                    {s.cooldown > 0 ? 'Resend available in ' + s.cooldown + 's' : 'Did not get the email?'}
                  </span>
                  <button
                    type="button"
                    className="ag-linkbtn"
                    disabled={s.cooldown > 0}
                    onClick={() => { issueCode(); flash('New code sent'); setTimeout(() => focusOtp(0), 60); }}
                  >
                    Resend code
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 9, marginTop: 20 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ height: 44, padding: '0 18px', fontSize: 13.5 }}
                    onClick={() => { clearInterval(timers.current.cool); set({ pwStep: 'form', cooldown: 0, otpErr: '' }); }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, flex: '1 1 auto', height: 44, fontSize: 14, fontWeight: 700 }}
                    disabled={s.verifying}
                    onClick={verify}
                  >
                    {s.verifying && <span className="ag-spin" />}
                    {s.verifying ? 'Verifying…' : 'Verify and update'}
                  </button>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-neutral-700)', marginTop: 14, textWrap: 'pretty' }}>
                  Demo build — the code is shown here instead of sent: <strong style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.08em' }}>{s.code}</strong>
                </div>
              </div>
            )}

            {s.pwStep === 'done' && (
              <div style={{ padding: '30px 24px 26px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, margin: '0 auto', borderRadius: 999, background: 'rgba(44,107,18,.12)', color: '#2c6b12' }}>
                  <Check size={24} width={2.5} />
                </div>
                <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 19, letterSpacing: '-0.03em', margin: '16px 0 0' }}>Password updated</h4>
                <p style={{ fontSize: 13, color: 'var(--color-neutral-700)', margin: '7px 0 0', textWrap: 'pretty' }}>
                  Other terminals were signed out. Use the new password next time you sign in.
                </p>
                <button type="button" className="btn btn-primary" style={{ height: 42, padding: '0 22px', fontSize: 13.5, fontWeight: 700, marginTop: 20 }} onClick={closePw}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {s.toast && (
        <div
          role="status"
          className="ag-toast"
          style={{
            position: 'fixed', left: 24, bottom: 24, zIndex: 50, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderRadius: 'var(--ag-r-pill)',
            background: 'var(--color-text)', color: 'var(--color-bg)', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 30px -10px rgba(32,30,29,.6)',
          }}
        >
          <Check size={15} width={2.6} />
          {s.toast}
        </div>
      )}
    </div>
  );
}
