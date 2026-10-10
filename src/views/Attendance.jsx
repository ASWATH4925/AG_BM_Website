import { useState } from 'react';
import Panel from '../components/Panel';
import Tag from '../components/Tag';
import { TODAY } from '../config';
import { M } from '../lib/format';
import { addDays, dayCount, MARKS, MARK_SHORT } from '../lib/people';

const TH = { cursor: 'default' };
const R = { textAlign: 'right' };
const MARK_STYLE = {
  Present: { on: '#1d6b3a', bg: 'rgba(29,107,58,.12)' },
  'Half day': { on: '#8a5207', bg: 'rgba(197,123,10,.14)' },
  Absent: { on: '#a3241a', bg: 'rgba(236,48,19,.12)' },
};
const longDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// One day's sheet: every worker on one screen, a mark and remarks each, saved together. Past days open for editing.
function DaySheet({ d, P, date, onSave, onAdvance }) {
  const D = d.db;
  const saved = (D.attendance || []).filter((a) => a.date === date);
  const savedOf = (id) => saved.find((a) => a.empId === id);
  const workers = (D.employees || []).filter((e) => e.status !== 'Left' || savedOf(e.id));
  const [rows, setRows] = useState(() => Object.fromEntries(workers.map((e) => {
    const a = savedOf(e.id);
    return [e.id, { status: a ? a.status : '', remarks: a ? a.remarks || '' : '' }];
  })));
  const put = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const allTo = (status) => setRows((r) => Object.fromEntries(Object.entries(r).map(([id, v]) => [id, { ...v, status }])));
  const changed = workers.some((e) => {
    const a = savedOf(e.id);
    const v = rows[e.id];
    return (a ? a.status : '') !== v.status || (a ? a.remarks || '' : '') !== v.remarks;
  });
  const wageOf = (e) => { const a = savedOf(e.id); return a ? +a.wage || 0 : +e.wage || 0; };
  const counts = MARKS.map((m) => [m, workers.filter((e) => rows[e.id].status === m).length]);
  const unmarked = workers.filter((e) => !rows[e.id].status).length;
  const wages = workers.reduce((s, e) => s + dayCount(rows[e.id]) * wageOf(e), 0);
  const lastBy = saved.map((a) => a.by).filter(Boolean)[0];

  return (
    <Panel
      className="ag-rise"
      title={longDate(date)}
      sub={saved.length ? 'Marked' + (lastBy ? ' by ' + lastBy : '') + ' — change any mark or remark and save again' : 'Not marked yet'}
      action={(
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => allTo('Present')}>Mark all present</button>
          <button type="button" className="btn btn-primary" disabled={!changed} onClick={() => onSave(date, workers.map((e) => ({ emp: e, ...rows[e.id] })))}>
            {saved.length ? 'Save changes' : 'Save attendance'}
          </button>
        </div>
      )}
    >
      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={TH}>Worker</th><th style={{ ...TH, ...R }}>Daily wage</th><th style={TH}>Mark</th><th style={TH}>Remarks</th>
              <th style={{ ...TH, ...R }}>Advance today</th><th style={{ ...TH, ...R }}>Advance due</th><th style={{ ...TH, ...R }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((e) => {
              const v = rows[e.id];
              const advToday = P.advancesOn(e.id, date).reduce((s, a) => s + (+a.amount || 0), 0);
              return (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{e.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>{[e.role, e.status === 'Left' && 'left'].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="ag-tabular" style={R}>{M(wageOf(e))}</td>
                  <td>
                    <div role="radiogroup" aria-label={'Attendance for ' + e.name} style={{ display: 'inline-flex', gap: 4 }}>
                      {MARKS.map((m) => {
                        const on = v.status === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            title={m}
                            onClick={() => put(e.id, { status: on ? '' : m })}
                            style={{
                              minWidth: 44, height: 34, borderRadius: 8, font: 'inherit', fontWeight: 800, cursor: 'pointer',
                              border: '1px solid ' + (on ? MARK_STYLE[m].on : 'rgba(32,30,29,.18)'),
                              background: on ? MARK_STYLE[m].bg : 'transparent', color: on ? MARK_STYLE[m].on : 'var(--color-neutral-700)',
                            }}
                          >
                            {MARK_SHORT[m]}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{ minWidth: 220 }}>
                    <input className="input" style={{ width: '100%' }} placeholder="Optional" value={v.remarks} aria-label={'Remarks for ' + e.name} onChange={(ev) => put(e.id, { remarks: ev.target.value })} />
                  </td>
                  <td className="ag-tabular" style={R}>{advToday ? M(advToday) : '—'}</td>
                  <td className="ag-tabular" style={R}>{P.advanceDue(e.id) > 0 ? M(P.advanceDue(e.id)) : '—'}</td>
                  <td style={R}><button type="button" className="btn btn-ghost" onClick={() => onAdvance(e.id, date)}>Give advance</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {workers.length === 0 && <div style={{ padding: 'var(--space-6)', fontSize: 13, color: 'var(--color-neutral-700)' }}>No workers yet — add them on the Employees page with their daily wage.</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-6)', borderTop: '1px solid rgba(32,30,29,.10)', fontSize: 13 }}>
        <span style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          {counts.map(([m, n]) => <Tag key={m} cls={m === 'Present' ? 'ag-t-ok' : m === 'Absent' ? 'ag-t-bad' : 'ag-t-warn'}>{m + ' ' + n}</Tag>)}
          {unmarked > 0 && <Tag cls="ag-t-mute">{'Not marked ' + unmarked}</Tag>}
        </span>
        <span>Wages for the day <strong className="ag-tabular">{M(wages)}</strong>{changed && <span style={{ color: '#8a5207' }}> · unsaved changes</span>}</span>
      </div>
    </Panel>
  );
}

export default function Attendance({ d, P, onSave, onAdvance }) {
  const [date, setDate] = useState(TODAY);
  const marked = new Set((d.db.attendance || []).map((a) => a.date));
  return (
    <section aria-label="Attendance">
      <div className="ag-glass ag-rise" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-6)' }}>
        <button type="button" className="btn btn-secondary" onClick={() => setDate(addDays(date, -1))}>← Previous day</button>
        <label className="field" style={{ flex: '0 1 170px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">Date</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || TODAY)} />
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => setDate(addDays(date, 1))}>Next day →</button>
        {date !== TODAY && <button type="button" className="btn btn-ghost" onClick={() => setDate(TODAY)}>Today</button>}
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--color-neutral-700)' }}>
          {marked.has(date) ? 'This day is marked — you can edit it.' : 'Tap P, ½ or A for each worker, then save.'}
        </span>
      </div>
      <DaySheet key={date} d={d} P={P} date={date} onSave={onSave} onAdvance={onAdvance} />
    </section>
  );
}
