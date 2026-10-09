import { useState } from 'react';
import Field from '../components/Field';
import { Avatar } from '../components/Sidebar';
import { settings } from '../config';
import { brandMark } from '../lib/format';

// Profile and sign-in pages linked from the sidebar account card, built from the same system.
function Shell({ children }) {
  return (
    <main
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6) var(--space-4)',
        background: 'linear-gradient(180deg, #F8F4F4A9, #B0B0B0)', fontSize: 14, letterSpacing: '-0.011em',
      }}
    >
      <div className="ag-glass ag-pop" style={{ width: 'min(440px, 100%)' }}>{children}</div>
    </main>
  );
}

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        aria-hidden="true"
        style={{
          width: 30, height: 30, flex: '0 0 30px', background: 'var(--color-accent)', borderRadius: 2, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 12, color: 'var(--color-neutral-100)',
        }}
      >
        {brandMark(settings.companyName)}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{settings.companyName}</div>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>Aswath Transports</div>
      </div>
    </div>
  );
}

const PROFILE = [
  ['Name', 'A. Gopalakrishnan'],
  ['Role', 'Owner'],
  ['Access', 'Full access · all modules'],
  ['Company', settings.companyName],
  ['Business unit', 'Aswath Transports'],
];

export function Profile({ onBack }) {
  return (
    <Shell>
      <div className="ag-head"><Brand /></div>
      <div style={{ padding: 'var(--space-6)' }}>
        <div className="ag-kicker">Account</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 'var(--space-3)' }}>
          <Avatar size={48} font={16} />
          <div>
            <h1 style={{ fontSize: 24, letterSpacing: '-0.03em', margin: 0 }}>A. Gopalakrishnan</h1>
            <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 2 }}>Owner · full access</div>
          </div>
        </div>
        <dl style={{ margin: 'var(--space-6) 0 0' }}>
          {PROFILE.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', padding: '7px 0', borderBottom: '1px solid rgba(32,30,29,.10)', fontSize: 14 }}>
              <dt style={{ color: 'var(--color-neutral-700)' }}>{k}</dt>
              <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', padding: '0 var(--space-6) var(--space-6)' }}>
        <button type="button" className="btn btn-primary" onClick={onBack}>Back to dashboard</button>
        <a className="btn btn-secondary" href="#/login">Log out</a>
      </div>
    </Shell>
  );
}

export function Login({ onSignIn }) {
  const [form, setForm] = useState({ user: '', pass: '' });
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: null }));
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.user.trim()) errs.user = 'Enter your username.';
    if (!form.pass) errs.pass = 'Enter your password.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSignIn();
  };

  return (
    <Shell>
      <div className="ag-head"><Brand /></div>
      <form onSubmit={submit} noValidate style={{ padding: 'var(--space-6)' }}>
        <div className="ag-kicker">Signed out</div>
        <h1 style={{ fontSize: 24, letterSpacing: '-0.03em', margin: '4px 0 0' }}>Sign in to the yard</h1>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 5 }}>Weighbridge, orders, credit and payroll in one place.</div>
        <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
          <Field label="Username" as="label">
            <input className="input" autoComplete="username" value={form.user} onChange={set('user')} aria-invalid={errors.user ? true : undefined} />
            {errors.user && <span role="alert" style={{ display: 'block', fontSize: 11, color: 'var(--color-accent-700)', fontWeight: 600, marginTop: 3 }}>{errors.user}</span>}
          </Field>
          <Field label="Password" as="label">
            <input className="input" type="password" autoComplete="current-password" value={form.pass} onChange={set('pass')} aria-invalid={errors.pass ? true : undefined} />
            {errors.pass && <span role="alert" style={{ display: 'block', fontSize: 11, color: 'var(--color-accent-700)', fontWeight: 600, marginTop: 3 }}>{errors.pass}</span>}
          </Field>
        </div>
        <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--space-6)', width: '100%' }}>Sign in</button>
      </form>
    </Shell>
  );
}
