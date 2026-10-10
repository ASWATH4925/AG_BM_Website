import Panel from '../components/Panel';
import StatTile, { MinorTile } from '../components/StatTile';
import Tag from '../components/Tag';
import { TODAY, TODAY_LABEL } from '../config';
import { M, N, T } from '../lib/format';

const TABS = ['Overview', 'Yard', 'Ledger'];

function deltaOf(now, was) {
  if (!was) return {};
  const p = Math.round(((now - was) / was) * 100);
  return { delta: (p >= 0 ? '+' : '') + p + '%', deltaTag: p >= 0 ? 'ag-t-ok' : 'ag-t-bad' };
}

export default function Dashboard({ d, tab, setTab, go }) {
  const D = d.db;
  const done = D.orders.filter((o) => o.status !== 'Void');
  const todays = done.filter((o) => o.date === TODAY);
  const tons = todays.reduce((a, o) => a + d.net(o), 0);
  const rev = todays.reduce((a, o) => a + d.amount(o), 0);
  const outs = D.customers.reduce((a, c) => a + d.outstanding(c), 0);
  const voids = D.orders.filter((o) => o.status === 'Void').length;
  const collected = (D.payments || []).filter((p) => p.date === TODAY).reduce((a, p) => a + p.amount, 0);
  const burn = D.expenses.filter((x) => x.type === 'Debit').reduce((a, x) => a + x.amount, 0)
    - D.expenses.filter((x) => x.type === 'Credit').reduce((a, x) => a + x.amount, 0);
  const duePay = D.payroll.filter((p) => p.status !== 'Paid').reduce((a, p) => a + d.payLine(p).net, 0);
  const prevDate = done.map((o) => o.date).filter((x) => x < TODAY).sort().pop() || null;
  const prev = prevDate ? done.filter((o) => o.date === prevDate) : [];
  const prevTons = prev.reduce((a, o) => a + d.net(o), 0);
  const prevRev = prev.reduce((a, o) => a + d.amount(o), 0);

  const heroKpis = [
    { label: 'Tonnage today', value: T(tons) + ' t', note: todays.length + ' tickets closed' + (prevDate ? ' · against ' + T(prevTons) + ' t prior day' : ''), ...deltaOf(tons, prevTons) },
    { label: 'Billed today', value: M(rev), note: 'Material value, before GST', ...deltaOf(rev, prevRev) },
    { label: 'Outstanding credit', value: M(outs), note: D.customers.filter((c) => d.outstanding(c) > 0).length + ' accounts carrying a balance' },
    { label: 'On the bridge', value: String(D.onsite.length), note: D.onsite.length ? 'Awaiting weigh-out' : 'Platform clear', ...(D.onsite.length ? { delta: 'Live', deltaTag: 'ag-t-ok' } : {}) },
  ];
  const minorKpis = [
    { label: 'In transit', value: String(D.orders.filter((o) => o.status === 'In Transit').length), note: 'dispatched' },
    { label: 'Payroll due', value: M(duePay), note: 'net of advances' },
    { label: 'Expense burn', value: M(burn), note: 'Sept to date' },
    { label: 'Collected today', value: M(collected), note: 'Cash, UPI and account' },
  ];
  const ledgerKpis = [
    { label: 'Outstanding credit', value: M(outs), note: 'Across every account on terms' },
    { label: 'Payroll due', value: M(duePay), note: 'Aug cycle, net of advances' },
    { label: 'Expense burn', value: M(burn), note: 'September to date, net' },
    { label: 'Voided loads', value: String(voids), note: 'Nothing billed on voids' },
  ];

  const owing = D.customers.filter((c) => d.outstanding(c) > 0);
  const exposureNote = owing.length ? owing.length + ' of ' + D.customers.length + ' credit parties owe us' : 'No credit party owes anything';
  const byOutstanding = D.customers.slice().sort((a, b) => d.outstanding(b) - d.outstanding(a));
  const topOwing = byOutstanding.filter((c) => d.outstanding(c) > 0).slice(0, 8);

  const byMat = {};
  done.forEach((o) => { byMat[o.matId] = (byMat[o.matId] || 0) + d.net(o); });
  const maxM = Math.max(...Object.values(byMat), 1);
  const matBars = Object.keys(byMat).sort((a, b) => byMat[b] - byMat[a]).slice(0, 6)
    .map((k) => ({ key: k, label: d.mat(k).name, value: T(byMat[k]) + ' t', pct: Math.round((byMat[k] / maxM) * 100) }));
  const maxC = Math.max(...D.customers.map((c) => d.outstanding(c)), 1);

  return (
    <section aria-label="Dashboard">
      <div role="tablist" aria-label="Dashboard views" className="ag-fade" style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid rgba(32,30,29,.10)', marginBottom: 'var(--space-6)' }}>
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="ag-tab" data-on={tab === t ? '1' : '0'} onClick={() => setTab(t)}>
            {t}<i />
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 10px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>
          <span className="ag-dot" />Live · {TODAY_LABEL}
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
            <Panel className="ag-card" style={{ minWidth: 0 }} title="Tonnage by material" sub="Net weighed across all closed tickets">
              <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {matBars.map((b) => (
                  <div className="ag-listrow" key={b.key}>
                    <div className="ag-bar-row">
                      <span>{b.label}</span>
                      <span className="ag-tabular" style={{ color: 'var(--color-neutral-700)' }}>{b.value}</span>
                    </div>
                    <div className="ag-track ag-track-bar">
                      <div className="ag-fill" style={{ background: 'var(--color-accent)', width: b.pct + '%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              className="ag-card"
              style={{ minWidth: 0 }}
              title="Credit exposure"
              sub={exposureNote}
              action={<button type="button" className="btn btn-ghost" onClick={() => go('payments')}>Ledger</button>}
            >
              <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {topOwing.map((c, i) => {
                  const o = d.outstanding(c);
                  const share = Math.round((o / Math.max(outs, 1)) * 100);
                  const color = i < 3 ? 'var(--color-accent)' : 'var(--color-neutral-800)';
                  return (
                    <div className="ag-listrow" key={c.id}>
                      <div className="ag-bar-row">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{c.name}<Tag cls={i < 3 ? 'ag-t-warn' : 'ag-t-mute'}>{share + '%'}</Tag></span>
                        <span className="ag-tabular" style={{ color }}>{M(o)}</span>
                      </div>
                      <div className="ag-track ag-track-bar">
                        <div className="ag-fill" style={{ background: color, width: Math.round((o / maxC) * 100) + '%' }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 4 }}>{share}% of all outstanding · last receipt {d.lastReceipt(c)}</div>
                    </div>
                  );
                })}
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
