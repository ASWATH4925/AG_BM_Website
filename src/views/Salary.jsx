import { useState } from 'react';
import Panel from '../components/Panel';
import StatTile from '../components/StatTile';
import Tag from '../components/Tag';
import { TODAY } from '../config';
import { modeName } from '../lib/books';
import { M } from '../lib/format';
import { addDays, dayName, MARK_SHORT, shortDate, weekEndOf } from '../lib/people';

const TH = { cursor: 'default' };
const R = { textAlign: 'right' };
const CELL = { Present: '#1d6b3a', 'Half day': '#8a5207', Absent: '#a3241a' };

// Saturday salary sheet: the week's attendance, wages earned, this week's advance, the older advance still due,
// how much of it to recover now, and the pay. Each payment is saved (and can be undone).
export default function Salary({ d, P, onPay, onPayAll, onUndo, onStatement }) {
  const [weekEnd, setWeekEnd] = useState(weekEndOf(TODAY));
  const [recover, setRecover] = useState({});
  const lines = P.weekLines(weekEnd);
  const days = lines[0] ? lines[0].days : [];
  const recOf = (l) => recover[weekEnd + l.emp.id] ?? '';
  const view = (l) => (l.paid
    ? { cutWeek: l.paid.cutWeek, cutOld: l.paid.cutOld, net: l.paid.net, earned: l.paid.earned }
    : { ...P.settle(l, recOf(l)), earned: l.earned });
  const due = lines.filter((l) => !l.paid && l.earned > 0);
  const sum = (f) => lines.reduce((s, l) => s + f(l), 0);
  const paidNet = lines.filter((l) => l.paid).reduce((s, l) => s + l.paid.net, 0);

  return (
    <section aria-label="Weekly salary">
      <div className="ag-glass ag-rise" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={() => setWeekEnd(addDays(weekEnd, -7))}>← Previous week</button>
        <label className="field" style={{ flex: '0 1 190px', minWidth: 0 }}>
          <span className="ag-label ag-field-label">Week ending Saturday</span>
          <input className="input" type="date" value={weekEnd} onChange={(e) => e.target.value && setWeekEnd(weekEndOf(e.target.value))} />
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => setWeekEnd(addDays(weekEnd, 7))}>Next week →</button>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => onStatement(weekEnd, Object.fromEntries(lines.map((l) => [l.emp.id, recOf(l)])))}>Salary statement (PDF)</button>
          <button type="button" className="btn btn-primary" disabled={!due.length} onClick={() => onPayAll(due.map((l) => ({ line: l, recover: recOf(l) })))}>Pay all due ({due.length})</button>
        </div>
      </div>

      <div className="ag-stagger ag-quad" style={{ marginTop: 'var(--space-6)' }}>
        <StatTile label="Wages earned" value={M(sum((l) => view(l).earned))} note={shortDate(days[0] || weekEnd) + ' – ' + shortDate(weekEnd)} />
        <StatTile label="This week's advance" value={M(sum((l) => l.weekAdv))} note="Taken off this Saturday" />
        <StatTile label="Older advance due" value={M(sum((l) => l.oldDue))} note="Recover what you choose" />
        <StatTile label={due.length ? 'To pay' : 'Paid'} value={M(due.length ? due.reduce((s, l) => s + view(l).net, 0) : paidNet)} note={due.length ? due.length + ' workers unpaid' + (paidNet ? ' · ' + M(paidNet) + ' paid' : '') : 'Everyone is paid for this week'} />
      </div>

      <Panel className="ag-rise" style={{ marginTop: 'var(--space-6)' }} title={'Week ending Saturday ' + shortDate(weekEnd)} sub="P present · ½ half day · A absent · * has a remark · Sunday work counts toward the following Saturday">
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: 1320 }}>
            <thead>
              <tr>
                <th style={TH}>Worker</th><th style={{ ...TH, ...R }}>Wage / day</th>
                {days.map((x) => <th key={x} style={{ ...TH, textAlign: 'center', padding: '10px 6px' }}>{dayName(x)}<div style={{ fontWeight: 400, fontSize: 10.5 }}>{shortDate(x)}</div></th>)}
                <th style={{ ...TH, ...R }}>Days</th><th style={{ ...TH, ...R }}>Earned</th><th style={{ ...TH, ...R }}>Week advance</th>
                <th style={{ ...TH, ...R }}>Overall advance</th><th style={{ ...TH, ...R }}>Recover now</th><th style={{ ...TH, ...R }}>Net pay</th><th style={{ ...TH, ...R }}>Pay</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const v = view(l);
                return (
                  <tr key={l.emp.id}>
                    <td style={{ fontWeight: 700 }}>{l.emp.name}<div style={{ fontWeight: 400, fontSize: 11.5, color: 'var(--color-neutral-600)' }}>{l.emp.role}</div></td>
                    <td className="ag-tabular" style={R}>{M(l.emp.wage)}</td>
                    {l.days.map((x) => {
                      const m = l.marks[x];
                      return (
                        <td key={x} title={m ? m.status + (m.remarks ? ' — ' + m.remarks : '') : 'Not marked'} style={{ textAlign: 'center', padding: '10px 6px', fontWeight: 800, color: m ? CELL[m.status] : 'var(--color-neutral-500)' }}>
                          {m ? MARK_SHORT[m.status] : '·'}{m && m.remarks ? '*' : ''}
                        </td>
                      );
                    })}
                    <td className="ag-tabular" style={R}>{l.worked}</td>
                    <td className="ag-tabular" style={{ ...R, fontWeight: 600 }}>{M(v.earned)}</td>
                    <td className="ag-tabular" style={R} title={l.weekAdvList.map((a) => a.date + ' ' + M(a.amount)).join(', ')}>
                      {l.weekAdv ? '− ' + M(v.cutWeek) : '—'}
                      {l.weekAdv > v.cutWeek ? <div style={{ fontSize: 11, color: '#8a5207' }}>{M(l.weekAdv - v.cutWeek)} carried</div> : null}
                    </td>
                    <td className="ag-tabular" style={R}>{l.oldDue ? M(l.oldDue) : '—'}</td>
                    <td style={{ ...R, minWidth: 120 }}>
                      {l.paid
                        ? <span className="ag-tabular">{v.cutOld ? '− ' + M(v.cutOld) : '—'}</span>
                        : (l.oldDue > 0 || l.weekAdv > l.earned)
                          ? <input className="input ag-tabular" type="number" min="0" style={{ width: 110, textAlign: 'right' }} placeholder="0" aria-label={'Recover from ' + l.emp.name} value={recOf(l)} onChange={(e) => setRecover((r) => ({ ...r, [weekEnd + l.emp.id]: e.target.value }))} />
                          : '—'}
                    </td>
                    <td className="ag-tabular" style={{ ...R, fontWeight: 800 }}>{M(v.net)}</td>
                    <td style={{ ...R, whiteSpace: 'nowrap' }}>
                      {l.paid ? (
                        <>
                          <Tag cls="ag-t-ok">Paid</Tag>
                          <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 2 }}>{l.paid.date} · {modeName(l.paid.mode)}</div>
                          <button type="button" className="btn btn-ghost" style={{ padding: '2px 6px' }} onClick={() => onUndo(l.paid)}>Undo</button>
                        </>
                      ) : l.earned > 0 ? (
                        <button type="button" className="btn btn-secondary" onClick={() => onPay(l, recOf(l))}>Pay</button>
                      ) : <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>Nothing earned</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={9} style={{ padding: '12px 24px' }}>{lines.length} workers</td>
                  <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{sum((l) => l.worked)}</td>
                  <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{M(sum((l) => view(l).earned))}</td>
                  <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{M(sum((l) => view(l).cutWeek))}</td>
                  <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{M(sum((l) => l.oldDue))}</td>
                  <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{M(sum((l) => view(l).cutOld))}</td>
                  <td className="ag-tabular" style={{ ...R, padding: '12px 24px' }}>{M(sum((l) => view(l).net))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {lines.length === 0 && <div style={{ padding: 'var(--space-6)', fontSize: 13, color: 'var(--color-neutral-700)' }}>No workers yet — add them on the Employees page with their daily wage.</div>}
      </Panel>
    </section>
  );
}
