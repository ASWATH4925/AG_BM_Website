import { useState } from 'react';
import Panel from '../components/Panel';
import Tag from '../components/Tag';
import { LEVELS, TASKS, TEMPLATES } from '../lib/access';

const TH = { cursor: 'default' };
const R = { textAlign: 'right' };
const ERR = { display: 'block', fontSize: 11.5, color: 'var(--color-accent-700)', fontWeight: 600, marginTop: 3 };
const TABS = ['Staff & rights', 'Devices', 'Sign-out'];
const LEVEL_TONE = { allow: '#1d6b3a', approve: '#8a5207', deny: '#a3241a' };
const when = (iso) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—');

function LevelPicker({ value, task, onChange }) {
  const levels = task.view ? LEVELS.filter((l) => l.v !== 'approve') : task.ownerGate ? LEVELS.filter((l) => l.v !== 'allow') : LEVELS;
  return (
    <div role="radiogroup" aria-label={task.l} style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {levels.map((l) => {
        const on = value === l.v;
        return (
          <button
            key={l.v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(l.v)}
            style={{
              padding: '5px 10px', borderRadius: 8, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              border: '1px solid ' + (on ? LEVEL_TONE[l.v] : 'rgba(32,30,29,.18)'), background: on ? LEVEL_TONE[l.v] + '1f' : 'transparent',
              color: on ? LEVEL_TONE[l.v] : 'var(--color-neutral-700)',
            }}
          >
            {l.l}
          </button>
        );
      })}
    </div>
  );
}

// Owner only: staff sign-ins and what each may do, approved devices, and the idle sign-out time.
export default function Access({ db, me, thisDevice, onSaveUser, onDevice, onSettings }) {
  const [tab, setTab] = useState(TABS[0]);
  const users = db.users || [];
  const staff = users.filter((u) => u.role !== 'owner');
  const blank = { name: '', phone: '', active: true, perms: { ...TEMPLATES.operator.perms } };
  const [selId, setSelId] = useState(staff[0] ? staff[0].id : 'new');
  const [draft, setDraft] = useState(staff[0] ? { ...staff[0] } : blank);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState({});
  const [saved, setSaved] = useState('');
  const pick = (id) => {
    const u = users.find((x) => x.id === id);
    setSelId(id); setDraft(u ? { ...u } : blank); setPin(''); setErr({}); setSaved('');
  };
  const edit = (patch) => { setDraft((x) => ({ ...x, ...patch })); setSaved(''); };
  const setPerm = (k, v) => { setDraft((x) => ({ ...x, perms: { ...x.perms, [k]: v } })); setSaved(''); };
  const save = async () => {
    const e = {};
    if (!String(draft.name || '').trim()) e.name = 'Enter the name.';
    else if (users.some((u) => u.id !== draft.id && u.name.trim().toLowerCase() === draft.name.trim().toLowerCase())) e.name = 'Someone already has this name.';
    if (!draft.id && !/^\d{4,6}$/.test(pin)) e.pin = 'Give a 4–6 digit PIN.';
    if (draft.id && pin && !/^\d{4,6}$/.test(pin)) e.pin = 'The PIN must be 4–6 digits.';
    setErr(e);
    if (Object.keys(e).length) return;
    const id = await onSaveUser({ ...draft, name: draft.name.trim(), role: 'staff' }, pin);
    setSelId(id); setDraft((x) => ({ ...x, id })); setPin(''); setSaved('Saved.');
  };
  const order = { pending: 0, approved: 1, revoked: 2 };
  const devices = (db.devices || []).slice().sort((a, b) => order[a.status] - order[b.status]);

  return (
    <section aria-label="Staff and access">
      <div role="tablist" aria-label="Access sections" style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid rgba(32,30,29,.10)', marginBottom: 'var(--space-6)' }}>
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="ag-tab" data-on={tab === t ? '1' : '0'} onClick={() => setTab(t)}>
            {t}{t === 'Devices' && devices.some((x) => x.status === 'pending') ? ' •' : ''}<i />
          </button>
        ))}
      </div>

      {tab === 'Staff & rights' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
          <Panel className="ag-rise" title="Staff" sub={'Owner: ' + me.name + ' — always has full access'} action={<button type="button" className="btn btn-primary" onClick={() => pick('new')}>Add staff</button>}>
            <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {staff.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => pick(u.id)}
                  className="ag-stat"
                  style={{ textAlign: 'left', font: 'inherit', cursor: 'pointer', padding: '10px 12px', border: '1px solid ' + (u.id === selId ? 'var(--color-accent)' : 'rgba(32,30,29,.12)') }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{u.name}</strong>
                    {u.active === false ? <Tag cls="ag-t-bad">Blocked</Tag> : <Tag cls="ag-t-ok">Active</Tag>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 2 }}>{u.phone || 'No phone'} · last sign-in {when(u.lastSignIn)}</div>
                </button>
              ))}
              {staff.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', padding: 8 }}>No staff yet. Add each person who will use the app — they sign in with a PIN.</div>}
            </div>
          </Panel>

          <Panel className="ag-rise" style={{ gridColumn: 'span 2', minWidth: 0 }} title={draft.id ? draft.name : 'New staff member'} sub="Choose what this person may do. Changes apply the next time they act.">
            <div style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
              <label className="field" style={{ flex: '1 1 180px', minWidth: 0 }}>
                <span className="ag-label ag-field-label">Name</span>
                <input className="input" value={draft.name} onChange={(e) => edit({ name: e.target.value })} />
                {err.name && <span role="alert" style={ERR}>{err.name}</span>}
              </label>
              <label className="field" style={{ flex: '1 1 150px', minWidth: 0 }}>
                <span className="ag-label ag-field-label">Phone</span>
                <input className="input" value={draft.phone || ''} onChange={(e) => edit({ phone: e.target.value })} />
              </label>
              <label className="field" style={{ flex: '1 1 150px', minWidth: 0 }}>
                <span className="ag-label ag-field-label">{draft.id ? 'New PIN (blank = keep)' : 'PIN (4–6 digits)'}</span>
                <input className="input" type="password" inputMode="numeric" value={pin} onChange={(e) => { setPin(e.target.value); setSaved(''); }} />
                {err.pin && <span role="alert" style={ERR}>{err.pin}</span>}
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, paddingBottom: 10 }}>
                <input type="checkbox" checked={draft.active !== false} onChange={(e) => edit({ active: e.target.checked })} />
                Can sign in
              </label>
            </div>
            <div style={{ padding: '0 var(--space-6) var(--space-3)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
              <span className="ag-label">Start from</span>
              {Object.entries(TEMPLATES).map(([k, t]) => (
                <button key={k} type="button" className="btn btn-ghost" onClick={() => edit({ perms: { ...t.perms } })}>{t.l}</button>
              ))}
            </div>
            <div style={{ overflowX: 'auto', borderTop: '1px solid rgba(32,30,29,.10)' }}>
              <table className="table" style={{ width: '100%', minWidth: 640 }}>
                <tbody>
                  {TASKS.map((g) => [
                    <tr key={g.group}><td colSpan={2} style={{ fontWeight: 800, background: 'rgba(32,30,29,.04)' }}>{g.group}</td></tr>,
                    ...g.items.map((t) => (
                      <tr key={t.k}>
                        <td style={{ whiteSpace: 'normal' }}>
                          {t.l}
                          {t.ownerGate && <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>Always needs the owner’s approval</div>}
                        </td>
                        <td style={{ ...R, minWidth: 300 }}><LevelPicker task={t} value={(draft.perms || {})[t.k] || 'deny'} onChange={(v) => setPerm(t.k, v)} /></td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid rgba(32,30,29,.10)' }}>
              <button type="button" className="btn btn-primary" onClick={save}>{draft.id ? 'Save changes' : 'Add staff member'}</button>
              {saved && <span style={{ fontSize: 13, color: '#1d6b3a', fontWeight: 600 }}>{saved}</span>}
            </div>
          </Panel>
        </div>
      )}

      {tab === 'Devices' && (
        <Panel className="ag-rise" title="Devices" sub="Every computer and phone must be approved once by the owner. Blocked devices cannot sign in.">
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 760 }}>
              <thead><tr><th style={TH}>Device</th><th style={TH}>Status</th><th style={TH}>Requested</th><th style={TH}>Approved</th><th style={TH}>Last used</th><th style={{ ...TH, ...R }}>Actions</th></tr></thead>
              <tbody>
                {devices.map((x) => (
                  <tr key={x.id}>
                    <td style={{ fontWeight: 700 }}>{x.name}{x.id === thisDevice ? <span style={{ fontWeight: 400, color: 'var(--color-neutral-600)' }}> · this device</span> : null}</td>
                    <td><Tag cls={x.status === 'approved' ? 'ag-t-ok' : x.status === 'pending' ? 'ag-t-warn' : 'ag-t-bad'}>{x.status === 'approved' ? 'Approved' : x.status === 'pending' ? 'Waiting' : 'Blocked'}</Tag></td>
                    <td className="ag-tabular">{when(x.requestedAt)}</td>
                    <td className="ag-tabular">{when(x.approvedAt)}{x.approvedBy ? ' · ' + x.approvedBy : ''}</td>
                    <td className="ag-tabular">{when(x.lastUsed)}</td>
                    <td style={{ ...R, whiteSpace: 'nowrap' }}>
                      {x.status !== 'approved' && <button type="button" className="btn btn-primary" onClick={() => onDevice(x.id, 'approved')}>Approve</button>}
                      {x.status !== 'revoked' && x.id !== thisDevice && <button type="button" className="btn btn-ghost" onClick={() => onDevice(x.id, 'revoked')}>Block</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'Sign-out' && (
        <Panel className="ag-rise" title="Automatic sign-out" sub="On shared computers, sign people out after they stop using the app.">
          <div style={{ padding: 'var(--space-4) var(--space-6) var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            {[['idleStaff', 'Staff — minutes idle', '15'], ['idleOwner', 'Owner — minutes idle', '60']].map(([k, l, ph]) => (
              <label key={k} className="field" style={{ flex: '0 1 200px' }}>
                <span className="ag-label ag-field-label">{l}</span>
                <input className="input" type="number" min="1" value={(db.settings || {})[k] || ''} placeholder={ph} onChange={(e) => onSettings({ [k]: e.target.value ? Math.max(1, +e.target.value) : '' })} />
              </label>
            ))}
          </div>
        </Panel>
      )}
    </section>
  );
}
