import { useState } from 'react';
import Panel from '../components/Panel';
import Tag from '../components/Tag';
import { conflicts, fieldChanges, NOUN, taskLabel } from '../lib/access';

const TH = { cursor: 'default' };
const R = { textAlign: 'right' };
const when = (iso) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—');
const show = (v) => (v === '' || v == null ? '—' : typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v));

// The record-by-record detail of one change.
export function ChangeDetail({ ops }) {
  const shown = ops.filter((o) => o.coll !== 'voided'); // archive from older saves
  return (
    <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {shown.slice(0, 12).map((o, i) => {
        const r = o.after || o.before || {};
        const name = r.name || r.ticket || r.serial || r.billNo || (+r.amount ? '₹' + (+r.amount).toLocaleString('en-IN') : '') || r.date || r.month || '';
        const f = fieldChanges(o);
        return (
          <div key={i}>
            <strong>{o.op === 'add' ? 'Added' : o.op === 'del' ? 'Removed' : 'Changed'}</strong> {NOUN[o.coll] || o.coll} {name}
            {f.length > 0 && <span>: {f.slice(0, 6).map((c) => c.field + ' ' + show(c.from) + ' → ' + show(c.to)).join(', ')}</span>}
          </div>
        );
      })}
      {shown.length > 12 && <div>… and {shown.length - 12} more</div>}
    </div>
  );
}

// Owner: every change by everyone, filters, and undo of a staff member's work over a period.
export default function Activity({ db, onRollback }) {
  const users = db.users || [];
  const [who, setWho] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState({});
  const [open, setOpen] = useState({});
  const needle = q.trim().toLowerCase();
  const list = (db.audit || [])
    .filter((a) => (!who || a.userId === who) && (!from || a.at.slice(0, 10) >= from) && (!to || a.at.slice(0, 10) <= to)
      && (!needle || (a.label + ' ' + a.userName).toLowerCase().includes(needle)))
    .slice().sort((a, b) => b.at.localeCompare(a.at));
  const undoable = list.filter((a) => !a.rolledBack && !a.rollback);
  const chosen = undoable.filter((a) => picked[a.id]);
  const reset = () => setPicked({});

  return (
    <section aria-label="Activity">
      <div className="ag-glass ag-rise" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '0 1 200px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">Who</span>
          <select className="input" value={who} onChange={(e) => { setWho(e.target.value); reset(); }}>
            <option value="">Everyone</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: '0 1 160px' }}>
          <span className="ag-label ag-field-label">From</span>
          <input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); reset(); }} />
        </label>
        <label className="field" style={{ flex: '0 1 160px' }}>
          <span className="ag-label ag-field-label">To</span>
          <input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); reset(); }} />
        </label>
        <label className="field" style={{ flex: '1 1 200px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">Search</span>
          <input className="input" type="search" placeholder="Party, ticket, action…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="ag-glass ag-rise" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
        <button type="button" className="btn btn-ghost" onClick={() => setPicked(Object.fromEntries(undoable.map((a) => [a.id, true])))}>Select all shown ({undoable.length})</button>
        <button type="button" className="btn btn-ghost" onClick={reset}>Clear</button>
        <button type="button" className="btn btn-primary" disabled={!chosen.length} onClick={() => onRollback(chosen.map((a) => a.id))}>Undo {chosen.length || ''} selected</button>
        <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', flex: '1 1 320px' }}>
          Undo reverses the changes: added items are removed, removed items come back, edits return to before.
          Register rows that were posted go back to Register Import as pending, so someone else can process them again.
        </span>
      </div>

      <Panel className="ag-rise" style={{ marginTop: 'var(--space-4)' }} title="Activity" sub={list.length + ' changes'}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: 900 }}>
            <thead><tr><th style={TH} /><th style={TH}>When</th><th style={TH}>Who</th><th style={TH}>What</th><th style={TH}>Task</th><th style={TH}>Status</th></tr></thead>
            <tbody>
              {list.map((a) => {
                const live = !a.rolledBack && !a.rollback;
                const c = live ? conflicts(db, a.ops, true).length : 0;
                return (
                  <tr key={a.id}>
                    <td style={{ width: 36 }}>
                      {live && <input type="checkbox" aria-label={'Select ' + a.label} checked={!!picked[a.id]} onChange={(e) => setPicked({ ...picked, [a.id]: e.target.checked })} />}
                    </td>
                    <td className="ag-tabular" style={{ whiteSpace: 'nowrap' }}>{when(a.at)}</td>
                    <td style={{ fontWeight: 600 }}>{a.userName}{a.approvedBy ? <div style={{ fontWeight: 400, fontSize: 11.5, color: 'var(--color-neutral-600)' }}>approved by {a.approvedBy}</div> : null}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 280 }}>
                      <button type="button" className="btn btn-ghost" style={{ padding: 0, textAlign: 'left', fontWeight: 600 }} onClick={() => setOpen({ ...open, [a.id]: !open[a.id] })}>{a.label}</button>
                      {open[a.id] && <ChangeDetail ops={a.ops} />}
                    </td>
                    <td style={{ whiteSpace: 'normal', fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{(a.keys || []).map(taskLabel).join(', ') || '—'}</td>
                    <td>
                      {a.rolledBack ? <Tag cls="ag-t-mute">{'Undone ' + when(a.rolledBack.at)}</Tag>
                        : a.rollback ? <Tag cls="ag-t-info">Undo by owner</Tag>
                          : c ? <Tag cls="ag-t-warn">{'Changed since (' + c + ')'}</Tag> : <Tag cls="ag-t-ok">Done</Tag>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <div style={{ padding: 'var(--space-6)', fontSize: 13, color: 'var(--color-neutral-700)' }}>No changes match.</div>}
      </Panel>
    </section>
  );
}

// Requests waiting for the owner. Staff see their own requests and what happened to them.
export function Approvals({ db, me, onDecide }) {
  const owner = me.role === 'owner';
  const list = (db.approvals || []).filter((a) => owner || a.userId === me.id).slice().sort((a, b) => b.at.localeCompare(a.at));
  const pending = list.filter((a) => a.status === 'pending');
  const done = list.filter((a) => a.status !== 'pending').slice(0, 50);
  const row = (a) => {
    const c = a.status === 'pending' ? conflicts(db, a.ops, false).length : 0;
    return (
      <tr key={a.id}>
        <td className="ag-tabular" style={{ whiteSpace: 'nowrap' }}>{when(a.at)}</td>
        <td style={{ fontWeight: 600 }}>{a.userName}</td>
        <td style={{ whiteSpace: 'normal', minWidth: 280 }}>
          <strong>{a.label}</strong>
          <ChangeDetail ops={a.ops} />
          {c > 0 && <div style={{ fontSize: 12, color: '#8a5207', marginTop: 4 }}>{c} record(s) changed since this was requested — approving will overwrite them.</div>}
        </td>
        <td style={{ whiteSpace: 'normal', fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{(a.keys || []).map(taskLabel).join(', ')}</td>
        <td style={{ ...R, whiteSpace: 'nowrap' }}>
          {a.status === 'pending'
            ? (owner
              ? <><button type="button" className="btn btn-primary" onClick={() => onDecide(a.id, true)}>Approve</button> <button type="button" className="btn btn-ghost" onClick={() => onDecide(a.id, false)}>Reject</button></>
              : <Tag cls="ag-t-warn">Waiting</Tag>)
            : <Tag cls={a.status === 'approved' ? 'ag-t-ok' : 'ag-t-bad'}>{(a.status === 'approved' ? 'Approved' : 'Rejected') + ' · ' + (a.decidedBy || '') + ' ' + when(a.decidedAt)}</Tag>}
        </td>
      </tr>
    );
  };
  const table = (rows) => (
    <div style={{ overflowX: 'auto' }}>
      <table className="table" style={{ width: '100%', minWidth: 860 }}>
        <thead><tr><th style={TH}>Asked</th><th style={TH}>By</th><th style={TH}>Change</th><th style={TH}>Task</th><th style={{ ...TH, ...R }}>{owner ? 'Decision' : 'Status'}</th></tr></thead>
        <tbody>{rows.map(row)}</tbody>
      </table>
    </div>
  );
  return (
    <section aria-label="Approvals">
      <Panel className="ag-rise" title={owner ? 'Waiting for your approval' : 'My requests waiting'} sub={pending.length ? pending.length + ' request(s)' : 'Nothing waiting'}>
        {pending.length ? table(pending) : <div style={{ padding: 'var(--space-6)', fontSize: 13, color: 'var(--color-neutral-700)' }}>No requests are waiting.</div>}
      </Panel>
      {done.length > 0 && (
        <Panel className="ag-rise" style={{ marginTop: 'var(--space-6)' }} title="Decided" sub="Most recent 50">
          {table(done)}
        </Panel>
      )}
    </section>
  );
}
