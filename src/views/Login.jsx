import { useRef, useState } from 'react';
import { settings } from '../config';
import { TEMPLATES } from '../lib/access';
import { brandMark, N } from '../lib/format';
import '../styles/login.css';

const PIN_MAX = 6;
const PIN_RE = /^\d{4,6}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
// Weighbridge indicators step in 20 kg divisions; the readout rounds the same way.
const DIVISION_KG = 20;

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const Alert = () => <svg {...svg} strokeWidth="2.2" width="13" height="13"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>;
const Clock = () => <svg {...svg} strokeWidth="2.2" width="24" height="24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
const Shield = () => <svg {...svg} strokeWidth="2" width="16" height="16"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>;
const Eye = ({ off }) => (
  <svg {...svg} strokeWidth="2" width="17" height="17">
    {off ? (
      <>
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <path d="m2 2 20 20" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      </>
    ) : (
      <><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" /><circle cx="12" cy="12" r="3" /></>
    )}
  </svg>
);

const initials = (name) => name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const easyPin = (p) => /^(\d)\1+$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p);
const roleLabel = (u) => (u.role === 'owner' ? 'Owner' : (TEMPLATES[u.template] || {}).l || 'Staff');

function FieldError({ id, children }) {
  if (!children) return null;
  return <div id={id} role="alert" className="lg-err ag-fade"><Alert />{children}</div>;
}

// Restart the card's shake animation after a failed submit.
function shake(el) {
  if (!el) return;
  el.classList.remove('ag-shake');
  void el.offsetWidth;
  el.classList.add('ag-shake');
}

// ── Brand panel: the live bridge readout, the last ticket printed, and today's totals ──
function BridgePanel({ scaleKg, scaleStable, lastTicket, stats }) {
  const shown = Math.round((scaleKg || 0) / DIVISION_KG) * DIVISION_KG;
  return (
    <aside className="lg-panel" aria-label={settings.companyName + ' weighbridge'}>
      <div className="lg-brand"><div className="lg-mark" aria-hidden="true">{brandMark(settings.companyName)}</div><b>{settings.companyName}</b></div>

      <div>
        <div className="lg-eyebrow">Weighbridge console</div>
        <h1>Every load, weighed and <em>accounted.</em></h1>
      </div>

      <div className="lg-scale">
        <div className="lg-readout">
          <div className="lg-ro-top">
            <span>BRIDGE · LIVE</span>
            <span className="lg-stable" data-on={scaleStable ? '1' : '0'}><i />{scaleStable ? 'STABLE' : 'SETTLING'}</span>
          </div>
          <div className="lg-digits" aria-label={'Bridge weight ' + N(shown) + ' kilograms'}><span>{N(shown)}</span><small>KG</small></div>
        </div>

        {lastTicket && (
          <div className="lg-slip" aria-label="Last ticket">
            <div className="lg-slip-head"><span>{lastTicket.ticket}</span><span>{lastTicket.time}</span></div>
            <dl>
              <dt>Vehicle</dt><dd>{lastTicket.vehicle || '—'}</dd>
              <dt>Material</dt><dd>{lastTicket.material}</dd>
              <dt>Gross</dt><dd>{N(lastTicket.gross)} kg</dd>
              <dt>Tare</dt><dd>{N(lastTicket.tare)} kg</dd>
            </dl>
            <dl className="lg-net"><dt>Net</dt><dd>{N(Math.max(0, lastTicket.gross - lastTicket.tare))} kg</dd></dl>
          </div>
        )}
      </div>

      <div className="lg-stats ag-stagger">
        {stats.map((p) => <div key={p.label}><b>{p.value}</b><span>{p.label}</span></div>)}
      </div>
    </aside>
  );
}

// Radio cards for choosing a person; arrow keys move between them.
function PersonPicker({ people, value, onChange, labelId }) {
  const refs = useRef([]);
  const at = Math.max(0, people.findIndex((p) => p.id === value));
  const onKey = (e, i) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const n = (i + step + people.length) % people.length;
    onChange(people[n].id);
    refs.current[n] && refs.current[n].focus();
  };
  return (
    <div className="lg-people" role="radiogroup" aria-labelledby={labelId}>
      {people.map((p, i) => (
        <button
          key={p.id}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="radio"
          aria-checked={p.id === value}
          tabIndex={i === at ? 0 : -1}
          className="lg-person"
          onClick={() => onChange(p.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          <span className="lg-av">{initials(p.name)}</span>
          <span><b>{p.name}</b><small>{roleLabel(p)}</small></span>
        </button>
      ))}
    </div>
  );
}

// One real input under six display boxes, so paste, autofill and screen readers behave normally.
function PinInput({ id, value, onChange, bad, describedBy, inputRef }) {
  const n = value.length;
  return (
    <div className="lg-pin" data-bad={bad ? '1' : '0'}>
      <input
        id={id}
        ref={inputRef}
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        maxLength={PIN_MAX}
        aria-invalid={bad || undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX))}
      />
      {Array.from({ length: PIN_MAX }, (_, i) => <i key={i} className={(i < n ? 'dot' : '') + (i === Math.min(n, PIN_MAX - 1) ? ' cur' : '')} />)}
    </div>
  );
}

// ── Sign in: staff with a PIN, the owner with the password ──
function SignInPane({ users, onSignIn, reason, cardRef }) {
  const active = users.filter((u) => u.active !== false);
  const staff = active.filter((u) => u.role !== 'owner');
  const owners = active.filter((u) => u.role === 'owner');
  const [mode, setMode] = useState(staff.length ? 'staff' : 'owner');
  const [id, setId] = useState('');
  const [secret, setSecret] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const pinRef = useRef(null);

  const list = mode === 'staff' ? staff : owners;
  const user = list.length === 1 ? list[0] : list.find((u) => u.id === id);
  const isOwner = mode === 'owner';

  const switchMode = (m) => { setMode(m); setId(''); setSecret(''); setErr({}); setShowPw(false); };
  const pickPerson = (pid) => { setId(pid); setSecret(''); setErr({}); if (pinRef.current) pinRef.current.focus(); };

  const attempt = async (value) => {
    if (busy) return;
    const e = {};
    if (!user) e.person = 'Tap your name first.';
    if (isOwner && !value) e.secret = 'Enter the owner password.';
    if (!isOwner && !PIN_RE.test(value)) e.secret = 'Enter your 4–6 digit PIN.';
    if (Object.keys(e).length) { setErr(e); shake(cardRef.current); return; }
    setBusy(true);
    let ok = false;
    try {
      ok = await onSignIn(user.id, value);
    } catch {
      setBusy(false);
      setErr({ secret: 'This browser could not check the ' + (isOwner ? 'password' : 'PIN') + '. Open the app from its usual address and try again.' });
      return;
    }
    if (ok) return; // App switches to the console.
    setBusy(false);
    setSecret('');
    setErr({ secret: isOwner ? 'That password is not right.' : 'That PIN is not right for ' + user.name + '.' });
    shake(cardRef.current);
  };

  const onPin = (v) => {
    setSecret(v); setErr({});
    if (v.length === PIN_MAX && user) attempt(v);
  };

  return (
    <section className="lg-pane ag-rise" id="lg-pane-in" role="tabpanel" aria-labelledby="lg-tab-in">
      <div className="lg-eyebrow">Console access</div>
      <h2>{isOwner ? 'Owner sign-in' : 'Who is working?'}</h2>
      <p className="lg-sub">{isOwner ? 'Full access: staff rights, approvals, devices and undo.' : 'Tap your name and enter your PIN.'}</p>
      {reason && <div className="lg-notice" role="status">{reason}</div>}

      {staff.length > 0 && (
        <div className="lg-who" role="group" aria-label="Sign in as">
          <button type="button" aria-pressed={!isOwner} onClick={() => switchMode('staff')}>Staff PIN</button>
          <button type="button" aria-pressed={isOwner} onClick={() => switchMode('owner')}>Owner password</button>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); attempt(secret); }} noValidate className="lg-form">
        {list.length > 1 ? (
          <div>
            <span className="lg-label" id="lg-people-l">{isOwner ? 'Owner' : 'Your name'}</span>
            <PersonPicker people={list} value={user ? user.id : ''} onChange={pickPerson} labelId="lg-people-l" />
            <FieldError>{err.person}</FieldError>
          </div>
        ) : user && (
          <div className="lg-one">
            <span className="lg-av">{initials(user.name)}</span>
            <span><b>{user.name}</b><small>{roleLabel(user)}</small></span>
          </div>
        )}

        {isOwner ? (
          <div>
            <label className="lg-label" htmlFor="lg-pw">Password</label>
            <div className="lg-pw">
              <input
                id="lg-pw"
                className="lg-in"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus
                aria-invalid={err.secret ? true : undefined}
                aria-describedby="lg-e-secret"
                value={secret}
                onChange={(e) => { setSecret(e.target.value); setErr({}); }}
              />
              <button type="button" className="lg-eye" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((v) => !v)}><Eye off={showPw} /></button>
            </div>
            <FieldError id="lg-e-secret">{err.secret}</FieldError>
          </div>
        ) : (
          <div>
            <label className="lg-label" htmlFor="lg-pin">PIN</label>
            <PinInput id="lg-pin" inputRef={pinRef} value={secret} onChange={onPin} bad={!!err.secret} describedBy="lg-e-secret" />
            <FieldError id="lg-e-secret">{err.secret}</FieldError>
          </div>
        )}

        <button type="submit" className="lg-btn" disabled={busy}>
          {busy && <span className="ag-spin" />}
          {busy ? (isOwner ? 'Checking password…' : 'Checking PIN…') : user ? 'Sign in as ' + user.name : 'Sign in'}
        </button>
        {!isOwner && <p className="lg-hint">Forgot your PIN? The owner can set a new one under Staff &amp; access.</p>}
      </form>
    </section>
  );
}

// ── Request access: a new person asks the owner for a sign-in ──
function RequestPane({ users, requests, onRequestAccess, onSent, cardRef }) {
  const [f, setF] = useState({ name: '', phone: '', template: '', pin: '', pin2: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const edit = (patch) => { setF((x) => ({ ...x, ...patch })); setErr({}); };
  const digits = f.phone.replace(/\D/g, '');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const name = f.name.trim();
    const taken = (n) => n.trim().toLowerCase() === name.toLowerCase();
    const x = {};
    if (name.length < 2) x.name = 'Enter your name as the owner knows it.';
    else if (users.some((u) => taken(u.name))) x.name = 'Someone already signs in with this name. Add your initial.';
    else if (requests.some((r) => r.status === 'pending' && taken(r.name))) x.name = 'A request with this name is already waiting for the owner.';
    if (!MOBILE_RE.test(digits)) x.phone = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.';
    if (!f.template) x.template = 'Choose the work you will do.';
    if (!PIN_RE.test(f.pin)) x.pin = 'Your PIN needs 4 to 6 digits.';
    else if (easyPin(f.pin)) x.pin = 'Pick a PIN that is harder to guess than ' + f.pin + '.';
    else if (f.pin !== f.pin2) x.pin = 'The two PINs do not match.';
    if (Object.keys(x).length) { setErr(x); shake(cardRef.current); return; }
    setBusy(true);
    try {
      const req = await onRequestAccess({ name, phone: digits, template: f.template, pin: f.pin });
      onSent(req);
    } catch {
      setBusy(false);
      setErr({ pin: 'This browser could not save the request. Open the app from its usual address and try again.' });
    }
  };

  const templates = Object.entries(TEMPLATES);
  return (
    <section className="lg-pane ag-rise" id="lg-pane-up" role="tabpanel" aria-labelledby="lg-tab-up">
      <div className="lg-eyebrow">New to the yard</div>
      <h2>Request access</h2>
      <p className="lg-sub">Send your details to the owner. Your name appears on the sign-in list once they approve you.</p>

      <form onSubmit={submit} noValidate className="lg-form">
        <div>
          <label className="lg-label" htmlFor="lg-u-name">Full name</label>
          <input id="lg-u-name" className="lg-in" autoComplete="name" placeholder="e.g. Ravi Kumar" aria-invalid={err.name ? true : undefined} value={f.name} onChange={(e) => edit({ name: e.target.value })} />
          <FieldError>{err.name}</FieldError>
        </div>
        <div>
          <label className="lg-label" htmlFor="lg-u-phone">Mobile number</label>
          <div className="lg-pre">
            <span>+91</span>
            <input
              id="lg-u-phone"
              className="lg-in"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              aria-invalid={err.phone ? true : undefined}
              value={f.phone}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 10); edit({ phone: d.length > 5 ? d.slice(0, 5) + ' ' + d.slice(5) : d }); }}
            />
          </div>
          <FieldError>{err.phone}</FieldError>
        </div>
        <div>
          <span className="lg-label" id="lg-roles-l">What will you do?</span>
          <div className="lg-roles" role="radiogroup" aria-labelledby="lg-roles-l">
            {templates.map(([k, t]) => (
              <button key={k} type="button" role="radio" aria-checked={f.template === k} onClick={() => edit({ template: k })}>{t.l}</button>
            ))}
          </div>
          <FieldError>{err.template}</FieldError>
        </div>
        <div>
          <div className="lg-two">
            <div>
              <label className="lg-label" htmlFor="lg-u-pin">Choose a PIN</label>
              <input id="lg-u-pin" className="lg-in" type="password" inputMode="numeric" autoComplete="new-password" maxLength={PIN_MAX} placeholder="4–6 digits" value={f.pin} onChange={(e) => edit({ pin: e.target.value.replace(/\D/g, '') })} />
            </div>
            <div>
              <label className="lg-label" htmlFor="lg-u-pin2">Repeat PIN</label>
              <input id="lg-u-pin2" className="lg-in" type="password" inputMode="numeric" autoComplete="new-password" maxLength={PIN_MAX} placeholder="4–6 digits" value={f.pin2} onChange={(e) => edit({ pin2: e.target.value.replace(/\D/g, '') })} />
            </div>
          </div>
          <FieldError>{err.pin}</FieldError>
        </div>
        <div className="lg-note"><Shield /><span>The owner decides what you can open. Changes they mark for approval wait in their inbox before they count.</span></div>
        <button type="submit" className="lg-btn" disabled={busy}>
          {busy && <span className="ag-spin" />}
          {busy ? 'Sending…' : 'Send request to owner'}
        </button>
      </form>
    </section>
  );
}

function Sent({ req, onBack }) {
  const rows = [
    ['Reference', req.ref],
    ['Name', req.name],
    ['Mobile', '+91 ' + req.phone.slice(0, 5) + ' ' + req.phone.slice(5)],
    ['Work', (TEMPLATES[req.template] || {}).l || req.template],
    ['Status', 'Waiting for owner'],
  ];
  return (
    <section className="lg-done ag-pop" aria-live="polite">
      <div className="lg-badge"><Clock /></div>
      <h2>Request sent</h2>
      <p className="lg-sub">Ask the owner to approve you under Staff &amp; access. Then sign in here with your name and PIN.</p>
      <dl className="lg-receipt">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <button type="button" className="lg-btn lg-ghost" autoFocus onClick={onBack}>Back to sign in</button>
    </section>
  );
}

// Sign-in screen for an approved device: staff PIN, owner password, or a request for a new sign-in.
export default function Login({ users, requests = [], onSignIn, onRequestAccess, reason, deviceName, scaleKg, scaleStable, lastTicket, stats = [] }) {
  const [tab, setTab] = useState('in');
  const [sent, setSent] = useState(null);
  const cardRef = useRef(null);
  const tabRefs = { in: useRef(null), up: useRef(null) };
  const go = (t) => { setTab(t); setSent(null); };
  const onTabKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = tab === 'in' ? 'up' : 'in';
    go(next);
    tabRefs[next].current.focus();
  };
  const tabProps = (t, label) => ({
    ref: tabRefs[t], id: 'lg-tab-' + t, role: 'tab', type: 'button', className: 'lg-tab', 'aria-controls': 'lg-pane-' + t,
    'aria-selected': tab === t, tabIndex: tab === t ? 0 : -1, onClick: () => go(t), onKeyDown: onTabKey, children: label,
  });

  return (
    <div className="pg-login">
      <BridgePanel scaleKg={scaleKg} scaleStable={scaleStable} lastTicket={lastTicket} stats={stats} />

      <main className="lg-main">
        <div className="lg-col">
          <div className="lg-card" ref={cardRef}>
            {sent ? <Sent req={sent} onBack={() => go('in')} /> : (
              <>
                <div className="lg-tabs" role="tablist" aria-label="Account">
                  <button {...tabProps('in', 'Sign in')} />
                  <button {...tabProps('up', 'Request access')} />
                </div>
                {tab === 'in'
                  ? <SignInPane users={users} onSignIn={onSignIn} reason={reason} cardRef={cardRef} />
                  : <RequestPane users={users} requests={requests} onRequestAccess={onRequestAccess} onSent={setSent} cardRef={cardRef} />}
              </>
            )}
          </div>
          <div className="lg-foot">
            <span className="lg-dev"><i />This device is approved{deviceName ? ' · ' + deviceName : ''}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
