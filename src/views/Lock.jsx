import { useState } from 'react';
import { settings } from '../config';

const ERR = { display: 'block', fontSize: 12, color: 'var(--color-accent-700)', fontWeight: 600, marginTop: 6 };

function Shell({ kicker, title, sub, children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', background: 'linear-gradient(180deg, #F8F4F4, #B0B0B0)', fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
      <div className="ag-glass ag-rise" style={{ width: '100%', maxWidth: 420, padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-6)' }}>
          <div aria-hidden="true" style={{ width: 30, height: 30, background: 'var(--color-accent)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 12, color: '#fff' }}>AG</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15 }}>{settings.companyName}</div>
        </div>
        <div className="ag-kicker">{kicker}</div>
        <h1 style={{ margin: '6px 0 4px', fontSize: 24, letterSpacing: '-0.03em' }}>{title}</h1>
        {sub && <p style={{ margin: '0 0 var(--space-4)', fontSize: 13.5, color: 'var(--color-neutral-700)' }}>{sub}</p>}
        {children}
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="field" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
      <span className="ag-label ag-field-label">{label}</span>
      <input className="input" style={{ width: '100%' }} {...props} />
    </label>
  );
}

// First run: create the owner's sign-in. This device becomes the first approved device.
export function SetupOwner({ onCreate }) {
  const [f, setF] = useState({ name: '', password: '', again: '' });
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Enter your name.');
    if (f.password.length < 6) return setErr('Use a password of at least 6 characters.');
    if (f.password !== f.again) return setErr('The two passwords do not match.');
    await onCreate(f.name.trim(), f.password);
    return undefined;
  };
  return (
    <Shell kicker="First-time setup" title="Create the owner sign-in" sub="The owner can do everything, give rights to staff, approve devices and undo staff changes. Keep this password private.">
      <form onSubmit={submit}>
        <Input label="Owner name" value={f.name} autoFocus onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <Input label="Password again" type="password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} />
        {err && <span role="alert" style={ERR}>{err}</span>}
        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-3)' }}>Create owner and approve this device</button>
      </form>
    </Shell>
  );
}

// A device the owner has not approved: it can ask for approval, or the owner can approve it here with the password.
export function DeviceGate({ device, suggestedName, onRequest, onOwnerApprove }) {
  const [name, setName] = useState((device && device.name) || suggestedName);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const pending = device && device.status === 'pending';
  const revoked = device && device.status === 'revoked';
  const approve = async (e) => {
    e.preventDefault();
    const ok = await onOwnerApprove(pw, name.trim() || suggestedName);
    if (!ok) setErr('That is not the owner’s password.');
  };
  return (
    <Shell
      kicker="Device not approved"
      title={revoked ? 'This device was blocked' : pending ? 'Waiting for the owner' : 'Approve this device'}
      sub={revoked ? 'The owner removed this device. Only the owner can allow it again.' : 'Every computer and phone must be approved by the owner once before anyone can sign in on it.'}
    >
      {!pending && !revoked && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Input label="Name for this device" value={name} placeholder="Weighbridge PC" onChange={(e) => setName(e.target.value)} />
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => onRequest(name.trim() || suggestedName)}>Ask the owner to approve</button>
        </div>
      )}
      {pending && <p style={{ fontSize: 13.5, margin: '0 0 var(--space-6)' }}>Approval requested as <strong>{device.name}</strong>. The owner can approve it under Staff &amp; access → Devices, or right here.</p>}
      <form onSubmit={approve} style={{ borderTop: '1px solid rgba(32,30,29,.10)', paddingTop: 'var(--space-4)' }}>
        <div className="ag-label" style={{ marginBottom: 8 }}>Owner — approve now</div>
        <Input label="Owner password" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }} />
        {err && <span role="alert" style={ERR}>{err}</span>}
        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-2)' }}>Approve this device</button>
      </form>
    </Shell>
  );
}

// Sign in: pick your name, then the owner's password or your PIN.
export function SignIn({ users, onSignIn, reason }) {
  const active = users.filter((u) => u.active !== false);
  const [id, setId] = useState(active.length === 1 ? active[0].id : '');
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState('');
  const user = active.find((u) => u.id === id);
  const submit = async (e) => {
    e.preventDefault();
    if (!user) return setErr('Choose your name.');
    const ok = await onSignIn(user.id, secret);
    if (!ok) { setErr(user.role === 'owner' ? 'Wrong password.' : 'Wrong PIN.'); setSecret(''); }
    return undefined;
  };
  return (
    <Shell kicker="Sign in" title="Who is working?" sub={reason || 'Choose your name and enter your PIN (owner: password).'}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--space-4)' }}>
        {active.map((u) => (
          <button key={u.id} type="button" className={'btn ' + (u.id === id ? 'btn-primary' : 'btn-secondary')} onClick={() => { setId(u.id); setSecret(''); setErr(''); }}>
            {u.name}{u.role === 'owner' ? ' · owner' : ''}
          </button>
        ))}
      </div>
      {user && (
        <form onSubmit={submit}>
          <Input
            label={user.role === 'owner' ? 'Password' : 'PIN'}
            type="password"
            inputMode={user.role === 'owner' ? undefined : 'numeric'}
            autoFocus
            value={secret}
            onChange={(e) => { setSecret(e.target.value); setErr(''); }}
          />
          {err && <span role="alert" style={ERR}>{err}</span>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-2)' }}>Sign in as {user.name}</button>
        </form>
      )}
    </Shell>
  );
}
