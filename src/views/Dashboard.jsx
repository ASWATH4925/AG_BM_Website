import { useState } from 'react';
import Panel from '../components/Panel';
import StatTile, { MinorTile } from '../components/StatTile';
import Tag from '../components/Tag';
import { TODAY } from '../config';
import { isoDate, M, N, T, U } from '../lib/format';
import { isPaidMethod, METHOD_LABEL } from '../lib/payments';

const TABS = ['Overview', 'Yard', 'Ledger'];

function deltaOf(now, was) {
  if (!was) return {};
  const p = Math.round(((now - was) / was) * 100);
  return { delta: (p >= 0 ? '+' : '') + p + '%', deltaTag: p >= 0 ? 'ag-t-ok' : 'ag-t-bad' };
}

const dayLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Dashboard({ d, tab, setTab, go, onOpenParty }) {
  const D = d.db;
  const [day, setDay] = useState(TODAY);
  const isToday = day === TODAY;
  const dayName = isToday ? 'today' : 'on ' + dayLabel(day);
  const done = D.orders.filter((o) => o.status !== 'Void');
  const todays = done.filter((o) => o.date === day);
  const tons = todays.reduce((a, o) => a + d.net(o), 0);
  const rev = todays.reduce((a, o) => a + d.billTotal(o), 0);
  const outs = D.customers.reduce((a, c) => a + d.outstanding(c), 0);
  const burn = D.expenses.filter((x) => x.type === 'Debit').reduce((a, x) => a + x.amount, 0)
    - D.expenses.filter((x) => x.type === 'Credit').reduce((a, x) => a + x.amount, 0);
  const duePay = D.payroll.filter((p) => p.status !== 'Paid').reduce((a, p) => a + d.payLine(p).net, 0);
  const prevDate = done.map((o) => o.date).filter((x) => x < day).sort().pop() || null;
  const prev = prevDate ? done.filter((o) => o.date === prevDate) : [];
  const prevTons = prev.reduce((a, o) => a + d.net(o), 0);
  const prevRev = prev.reduce((a, o) => a + d.billTotal(o), 0);

  // Money credit parties paid on the chosen day: payments on loads, receipts on account,
  // and older loads marked paid without payment records (counted on the load's date).
  const voidIds = new Set(D.orders.filter((o) => o.status === 'Void').map((o) => o.id));
  const partyPays = (D.payments || []).filter((p) => p.custId && p.date === day && !voidIds.has(p.ticketId))
    .map((p) => ({ custId: p.custId, amount: p.amount, method: p.method, p }))
    .concat(todays.filter((o) => o.custId && !d.paymentsFor(o.id).length && isPaidMethod(o.method))
      .map((o) => ({ custId: o.custId, amount: d.billTotal(o), method: o.method, p: null })));
  const payers = Object.values(partyPays.reduce((acc, x) => {
    const g = acc[x.custId] || (acc[x.custId] = { c: d.cust(x.custId), total: 0, methods: {}, toSup: [], count: 0 });
    g.total += x.amount;
    g.count += 1;
    g.methods[x.method] = (g.methods[x.method] || 0) + x.amount;
    if (x.p && x.p.toType === 'supplier') g.toSup.push(M(x.amount) + ' → ' + d.supplier(x.p.supplierId).name);
    return acc;
  }, {})).sort((a, b) => b.total - a.total);
  const collected = payers.reduce((a, g) => a + g.total, 0);
  const maxPay = Math.max(...payers.map((g) => g.total), 1);

  const heroKpis = [
    { label: 'Sold ' + dayName, value: U(tons) + ' units', note: T(tons) + ' t · ' + todays.length + (todays.length === 1 ? ' load' : ' loads') + (prevDate ? ' · ' + U(prevTons) + ' units on ' + dayLabel(prevDate) : ''), ...deltaOf(tons, prevTons) },
    { label: 'Billed ' + dayName, value: M(rev), note: 'Material value + GST + rent', ...deltaOf(rev, prevRev) },
    { label: 'Paid by parties ' + dayName, value: M(collected), note: payers.length + ' credit part' + (payers.length === 1 ? 'y' : 'ies') + ' paid' },
    { label: 'Outstanding credit', value: M(outs), note: D.customers.filter((c) => d.outstanding(c) > 0).length + ' accounts carrying a balance' },
  ];
  const oweSup = (D.suppliers || []).reduce((t, p) => t + Math.max(0, d.owed(p)), 0);
  const minorKpis = [
    { label: 'On the bridge', value: String(D.onsite.length), note: D.onsite.length ? 'Awaiting weigh-out' : 'Platform clear' },
    { label: 'We owe suppliers', value: M(oweSup), note: 'Soling, after payments' },
    { label: 'Payroll due', value: M(duePay), note: 'net of advances' },
    { label: 'Expense burn', value: M(burn), note: 'Sept to date' },
  ];
  const ledgerKpis = [
    { label: 'Outstanding credit', value: M(outs), note: 'Across every account on terms' },
    { label: 'Payroll due', value: M(duePay), note: 'Aug cycle, net of advances' },
    { label: 'Expense burn', value: M(burn), note: 'September to date, net' },
    { label: 'We owe suppliers', value: M(oweSup), note: (D.suppliers || []).filter((p) => d.owed(p) > 0.5).length + ' soling suppliers' },
  ];

  const owing = D.customers.filter((c) => d.outstanding(c) > 0);
  const exposureNote = owing.length ? owing.length + ' of ' + D.customers.length + ' credit parties owe us' : 'No credit party owes anything';
  const byOutstanding = D.customers.slice().sort((a, b) => d.outstanding(b) - d.outstanding(a));

  // Materials sold on the chosen day (credit and walk-in), in units of 4 tons.
  const byMat = {};
  todays.forEach((o) => {
    const k = o.matId === 'M10' && o.matName ? 'M10:' + o.matName : o.matId;
    const g = byMat[k] || (byMat[k] = { label: d.matLabel(o), tons: 0, loads: 0, value: 0 });
    g.tons += d.net(o);
    g.loads += 1;
    g.value += d.billTotal(o);
  });
  const mats = Object.entries(byMat).sort((a, b) => b[1].tons - a[1].tons);
  const maxM = Math.max(...mats.map(([, g]) => g.tons), 1);

  return (
    <section aria-label="Dashboard">
      <div role="tablist" aria-label="Dashboard views" className="ag-fade" style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid rgba(32,30,29,.10)', marginBottom: 'var(--space-6)' }}>
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="ag-tab" data-on={tab === t ? '1' : '0'} onClick={() => setTab(t)}>
            {t}<i />
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>
            {isToday && <span className="ag-dot" />}Showing
            <input className="input" type="date" value={day} max={isoDate() > TODAY ? isoDate() : TODAY} onChange={(e) => setDay(e.target.value || TODAY)} style={{ width: 160, letterSpacing: 0, textTransform: 'none' }} aria-label="Dashboard date" />
          </label>
          {!isToday && <button type="button" className="btn btn-ghost" onClick={() => setDay(TODAY)}>Today</button>}
        </div>
      </div>

      {tab === 'Overview' && (
        <>
          <div className="ag-stagger ag-quad">
            {heroKpis.map((k) => <StatTile key={k.label} size="hero" {...k} />)}
          </div>
          <div className="ag-stagger ag-quad" style={{ marginTop: 'var(--space-6)' }}>
            {minorKpis.map((k) => <MinorTile key={k.label} {...k} />)}
          </div>
          <div className="ag-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(330px,100%),1fr))', gap: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
            <Panel className="ag-card" style={{ minWidth: 0 }} title={'Materials sold ' + dayName} sub={U(tons) + ' units · ' + T(tons) + ' t across ' + todays.length + (todays.length === 1 ? ' load' : ' loads') + ' · 1 unit = 4 t'}>
              <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {mats.map(([k, g]) => (
                  <div className="ag-listrow" key={k}>
                    <div className="ag-bar-row">
                      <span>{g.label}</span>
                      <span className="ag-tabular"><strong>{U(g.tons)} units</strong> <span style={{ color: 'var(--color-neutral-700)' }}>· {T(g.tons)} t</span></span>
                    </div>
                    <div className="ag-track ag-track-bar">
                      <div className="ag-fill" style={{ background: 'var(--color-accent)', width: Math.round((g.tons / maxM) * 100) + '%' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 4 }}>{g.loads} load{g.loads === 1 ? '' : 's'} · billed {M(g.value)}</div>
                  </div>
                ))}
                {mats.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>No material was sold {dayName}.</div>}
              </div>
            </Panel>

            <Panel
              className="ag-card"
              style={{ minWidth: 0 }}
              title={'Paid by credit parties ' + dayName}
              sub={payers.length ? M(collected) + ' from ' + payers.length + ' part' + (payers.length === 1 ? 'y' : 'ies') : 'No credit party paid ' + dayName}
              action={<button type="button" className="btn btn-ghost" onClick={() => go('customers')}>Credit parties</button>}
            >
              <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {payers.map((g) => (
                  <button type="button" className="ag-listrow" key={g.c.id || g.c.name} onClick={() => g.c.id && onOpenParty(g.c.id)} style={{ display: 'block', width: '100%', background: 'none', border: 0, padding: 0, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
                    <div className="ag-bar-row">
                      <span style={{ fontWeight: 600 }}>{g.c.name}</span>
                      <span className="ag-tabular" style={{ fontWeight: 700 }}>{M(g.total)}</span>
                    </div>
                    <div className="ag-track ag-track-bar">
                      <div className="ag-fill" style={{ background: 'var(--color-accent)', width: Math.round((g.total / maxPay) * 100) + '%' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 4 }}>
                      {Object.entries(g.methods).map(([m, a]) => (METHOD_LABEL[m] || m) + ' ' + M(a)).join(' · ')}
                      {g.toSup.length ? ' · ' + g.toSup.join(', ') : ''} · owes {M(d.outstanding(g.c))} now
                    </div>
                  </button>
                ))}
                {payers.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Pick another date above to see who paid that day.</div>}
              </div>
            </Panel>
          </div>
        </>
      )}

      {tab === 'Yard' && (
        <>
          <Panel
            className="ag-rise"
            title="On the weighbridge now"
            sub="Open tickets holding a tare weight"
            action={<button type="button" className="btn btn-primary" onClick={() => go('weighbridge')}>Go to station</button>}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(250px,100%),1fr))', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
              {D.onsite.map((v) => (
                <div className="ag-stat" key={v.id} style={{ padding: 'var(--space-6)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>{v.vehicle}</div>
                    <Tag cls="ag-t-info">Tare captured</Tag>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 8, fontWeight: 600 }}>{d.cust(v.custId).name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 2 }}>{d.mat(v.matId).name} · tare {N(v.tare)} kg</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 6 }}>In at {v.inAt}</div>
                </div>
              ))}
              {D.onsite.length === 0 && (
                <div className="ag-glass" style={{ padding: '26px var(--space-4)', fontSize: 13, color: 'var(--color-neutral-700)' }}>
                  No vehicle on the platform. Capture a tare weight to open a ticket.
                </div>
              )}
            </div>
          </Panel>

          <Panel
            className="ag-rise"
            style={{ marginTop: 'var(--space-6)' }}
            title="Latest tickets"
            sub="Six most recent movements"
            action={<button type="button" className="btn btn-ghost" onClick={() => go('orders')}>All orders</button>}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Ticket</th><th>Customer</th><th>Material</th><th>Vehicle</th>
                    <th style={{ textAlign: 'right' }}>Net (t)</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {D.orders.slice(0, 6).map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600 }}>{o.ticket}</td>
                      <td>{d.cust(o.custId).name}</td>
                      <td>{d.mat(o.matId).name}</td>
                      <td className="ag-tabular">{o.vehicle}</td>
                      <td className="ag-tabular" style={{ textAlign: 'right' }}>{T(d.net(o))}</td>
                      <td className="ag-tabular" style={{ textAlign: 'right', fontWeight: 600 }}>{M(d.amount(o))}</td>
                      <td><Tag>{o.status}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {tab === 'Ledger' && (
        <>
          <div className="ag-stagger ag-quad">
            {ledgerKpis.map((k) => <StatTile key={k.label} {...k} />)}
          </div>
          <Panel
            className="ag-rise"
            style={{ marginTop: 'var(--space-6)' }}
            title="Account balances"
            sub={exposureNote}
            action={<button type="button" className="btn btn-primary" onClick={() => go('payments')}>Record payment</button>}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>Credit party</th><th style={{ textAlign: 'right' }}>Outstanding</th><th style={{ textAlign: 'right' }}>Billed</th>
                    <th style={{ textAlign: 'right' }}>Received</th><th>Last receipt</th><th>Standing</th>
                  </tr>
                </thead>
                <tbody>
                  {byOutstanding.map((c) => {
                    const o = d.outstanding(c);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td className="ag-tabular" style={{ textAlign: 'right', fontWeight: 600 }}>{M(o)}</td>
                        <td className="ag-tabular" style={{ textAlign: 'right', color: 'var(--color-neutral-700)' }}>{M(d.billed(c))}</td>
                        <td className="ag-tabular" style={{ textAlign: 'right', color: 'var(--color-neutral-700)' }}>{M(d.received(c))}</td>
                        <td style={{ color: 'var(--color-neutral-700)' }}>{d.lastReceipt(c)}</td>
                        <td><Tag>{o > 0 ? 'Due' : 'Clear'}</Tag></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </section>
  );
}
