import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header';
import Modal, { Toast } from './components/Modal';
import Sidebar from './components/Sidebar';
import { IDLE_SCALE_KG, settings, TODAY } from './config';
import { seedDb } from './data/seed';
import { createDomain } from './lib/domain';
import { hhmm, isoDate, M, N, T } from './lib/format';
import { MODS, moduleConfig } from './lib/modules';
import Dashboard from './views/Dashboard';
import ListModule from './views/ListModule';
import Login from './views/Login';
import Profile from './views/Profile';
import Weighbridge from './views/Weighbridge';

const NUMERIC_FIELDS = ['limit', 'rate', 'stock', 'amount', 'salary', 'tare', 'gross', 'days', 'ot', 'recovered', 'received'];
const FILTERS_CLEAR = { q: '', status: 'All', from: '', to: '', sortK: null };
const RECEIPT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Credit note'].map((x) => ({ v: x, l: x }));

const isWide = () => window.innerWidth >= 900;

function initialState() {
  return {
    mod: 'dashboard', dashTab: 'Overview', now: new Date(),
    ...FILTERS_CLEAR, sortDir: 1,
    modal: null, form: {}, errors: {}, toast: null, wide: isWide(),
    scale: IDLE_SCALE_KG, target: IDLE_SCALE_KG,
    wb: { vehicle: '', custId: 'C02', matId: 'M01', method: 'Credit', outId: null, err: '' },
    seq: 24121, // WB-24119 and WB-24120 are already on the bridge in the seed data
    db: seedDb(),
  };
}

// Routes live under "#/…"; other hashes (e.g. the sign-in page's #help) are in-page anchors and keep the current view.
const routeOf = (hash) => (hash === '#/profile' ? 'profile' : hash === '#/login' ? 'login' : 'app');

function useHashRoute() {
  const [route, setRoute] = useState(() => routeOf(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      const h = window.location.hash;
      if (h && !h.startsWith('#/')) return;
      setRoute(routeOf(h));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const route = useHashRoute();
  const [s, setS] = useState(initialState);
  const set = useCallback((patch) => setS((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) })), []);
  const d = useMemo(() => createDomain(s.db), [s.db]);
  const toastTimer = useRef(null);

  // Live scale: eases toward the target weight with a little noise, like a load cell settling.
  useEffect(() => {
    if (route !== 'app' || !settings.liveScale) return undefined;
    const tick = setInterval(() => {
      setS((st) => {
        const noise = (Math.random() - 0.5) * 26;
        const next = st.scale + (st.target + noise - st.scale) * 0.32;
        return { ...st, scale: Math.max(0, Math.round(next)) };
      });
    }, 110);
    return () => clearInterval(tick);
  }, [route]);

  useEffect(() => {
    const clock = setInterval(() => set({ now: new Date() }), 1000);
    const onResize = () => set((st) => (isWide() === st.wide ? {} : { wide: isWide() }));
    window.addEventListener('resize', onResize);
    return () => { clearInterval(clock); window.removeEventListener('resize', onResize); clearTimeout(toastTimer.current); };
  }, [set]);

  const toast = (msg) => {
    clearTimeout(toastTimer.current);
    set({ toast: msg });
    toastTimer.current = setTimeout(() => set({ toast: null }), 2800);
  };

  const go = (mod) => set({ mod, ...FILTERS_CLEAR, modal: null });
  const setWb = (patch) => set((st) => ({ wb: { ...st.wb, ...patch } }));
  const closeModal = () => set({ modal: null, errors: {} });

  // ---- weighbridge ----
  const captureTare = () => {
    const wb = s.wb;
    const vehicle = wb.vehicle.trim();
    if (!vehicle) return setWb({ err: 'Enter the vehicle number before capturing tare.' });
    if (s.db.onsite.some((v) => v.vehicle.toLowerCase() === vehicle.toLowerCase())) return setWb({ err: 'That vehicle is already on site awaiting weigh-out.' });
    const c = d.cust(wb.custId);
    if (wb.method === 'Credit' && d.outstanding(c) >= c.limit) return setWb({ err: c.name + ' is at its credit limit. Take cash, UPI or a bank transfer.' });
    const ticket = 'WB-' + s.seq;
    const row = {
      id: 'S' + Date.now(), ticket, vehicle: vehicle.toUpperCase(), custId: wb.custId, matId: wb.matId, tare: s.scale,
      load: 15000 + Math.round(Math.random() * 5000), inAt: hhmm(), method: wb.method,
    };
    set((st) => ({ seq: st.seq + 1, db: { ...st.db, onsite: st.db.onsite.concat([row]) }, wb: { ...st.wb, vehicle: '', err: '' } }));
    toast(ticket + ' opened — tare ' + N(row.tare) + ' kg captured for ' + row.vehicle + '.');
    return undefined;
  };

  const weighOut = (id) => {
    const v = s.db.onsite.find((x) => x.id === id);
    set((st) => ({ wb: { ...st.wb, outId: id }, target: v.tare + v.load }));
  };
  const cancelOut = () => set((st) => ({ wb: { ...st.wb, outId: null }, target: IDLE_SCALE_KG }));

  const ticketFromOnsite = (v, patch) => ({
    id: 'O' + Date.now(), ticket: v.ticket, date: isoDate(), custId: v.custId, matId: v.matId, vehicle: v.vehicle, dir: 'OUT',
    tare: v.tare, method: v.method || 'Credit', by: 'Murugan R', ...patch,
  });

  const confirmOut = () => {
    const v = s.db.onsite.find((x) => x.id === s.wb.outId);
    if (!v) return;
    const o = ticketFromOnsite(v, { gross: s.scale, status: 'Completed', reason: '' });
    const amt = d.payable(o);
    set((st) => ({
      db: {
        ...st.db,
        orders: [o].concat(st.db.orders),
        onsite: st.db.onsite.filter((x) => x.id !== v.id),
        customers: st.db.customers.map((c) => (c.id === v.custId && o.method === 'Credit' ? { ...c, invoiced: c.invoiced + Math.round(amt) } : c)),
      },
      wb: { ...st.wb, outId: null },
      target: IDLE_SCALE_KG,
    }));
    toast(v.ticket + ' completed — ' + T(d.net(o)) + ' t, ' + M(amt) + ' ' + (o.method === 'Credit' ? 'to account' : 'collected') + '.');
  };

  const askVoid = () => {
    const v = s.db.onsite.find((x) => x.id === s.wb.outId);
    if (!v) return;
    set({
      modal: {
        kind: 'void', id: v.id, title: 'Void ' + v.ticket + '?', kicker: 'Confirm', confirmLabel: 'Void the load',
        message: 'The load will be filed under Void Orders against ' + d.cust(v.custId).name + ', and the loading charge of ' + M(d.loading()) + ' stays billable. This cannot be undone from the station.',
      },
    });
  };

  const doVoid = () => {
    const v = s.db.onsite.find((x) => x.id === s.modal.id);
    if (!v) return;
    const o = ticketFromOnsite(v, { gross: v.tare, status: 'Void', reason: 'Voided at weigh-out' });
    set((st) => ({
      db: { ...st.db, orders: [o].concat(st.db.orders), onsite: st.db.onsite.filter((x) => x.id !== v.id) },
      wb: { ...st.wb, outId: null }, modal: null, target: IDLE_SCALE_KG,
    }));
    toast(v.ticket + ' voided. Loading charge ' + M(d.loading()) + ' retained.');
  };

  // ---- list modules ----
  const cfg = s.mod !== 'dashboard' && s.mod !== 'weighbridge' ? moduleConfig(s.mod, d) : null;

  const openReceipt = (c) => set({
    modal: { kind: 'receipt', id: c.id, title: 'Record receipt — ' + c.name, kicker: 'Payments', confirmLabel: 'Post receipt' },
    form: { amount: '', method: 'Bank Transfer', date: isoDate(), ref: '' }, errors: {},
  });

  const openAdd = () => {
    if (!cfg) return;
    if (s.mod === 'payments') { openReceipt(s.db.customers[0]); return; }
    const f = {};
    cfg.fields.forEach((x) => {
      f[x.k] = x.type === 'select' ? (x.options[0] ? x.options[0].v : '') : x.type === 'date' ? isoDate() : '';
    });
    set({ modal: { kind: 'form', title: cfg.add, kicker: 'Create', confirmLabel: 'Save' }, form: f, errors: {} });
  };

  const openEdit = (row) => {
    const f = {};
    cfg.fields.forEach((x) => { f[x.k] = row[x.k] == null ? '' : row[x.k]; });
    set({ modal: { kind: 'form', id: row.id, title: 'Edit record', kicker: 'Update', confirmLabel: 'Save changes' }, form: f, errors: {} });
  };

  const askDelete = (row) => set({
    modal: {
      kind: 'delete', id: row.id, key: cfg.key, title: 'Delete this record?', kicker: 'Confirm', confirmLabel: 'Delete',
      message: 'This removes the entry from ' + MODS[s.mod].title + '. Linked reports will recalculate.',
    },
  });

  const doDelete = () => {
    const m = s.modal;
    set((st) => ({ db: { ...st.db, [m.key]: st.db[m.key].filter((r) => r.id !== m.id) }, modal: null }));
    toast('Record deleted.');
  };

  const postReceipt = () => {
    const m = s.modal;
    const f = s.form;
    const amt = +f.amount;
    const c = d.cust(m.id);
    if (!amt || amt <= 0) return set({ errors: { amount: 'Enter an amount greater than zero.' } });
    if (amt > d.outstanding(c)) return set({ errors: { amount: 'Exceeds the outstanding balance of ' + M(d.outstanding(c)) + '.' } });
    set((st) => ({
      db: { ...st.db, customers: st.db.customers.map((x) => (x.id === m.id ? { ...x, received: x.received + amt, last: f.date } : x)) },
      modal: null,
    }));
    toast(M(amt) + ' received from ' + c.name + ' by ' + f.method + '.');
    return undefined;
  };

  const save = () => {
    const f = s.form;
    const m = s.modal;
    const errs = {};
    cfg.fields.forEach((x) => { if (x.req && String(f[x.k] ?? '').trim() === '') errs[x.k] = 'Required.'; });
    if (s.mod === 'orders' && f.status === 'Void' && !String(f.reason || '').trim()) errs.reason = 'A void needs a reason.';
    if (s.mod === 'orders' && +f.gross && +f.tare && +f.gross <= +f.tare) errs.gross = 'Gross must exceed tare.';
    if (Object.keys(errs).length) { set({ errors: errs }); return; }
    const rec = { ...f };
    NUMERIC_FIELDS.forEach((k) => { if (rec[k] !== undefined && rec[k] !== '') rec[k] = +rec[k]; });
    set((st) => {
      const list = st.db[cfg.key] || [];
      if (m.id) return { db: { ...st.db, [cfg.key]: list.map((r) => (r.id === m.id ? { ...r, ...rec } : r)) }, modal: null };
      const extra = cfg.key === 'orders' ? { ticket: 'WB-' + st.seq, by: 'A. Gopalakrishnan' }
        : cfg.key === 'customers' ? { code: 'CU-' + (1040 + list.length + 1), invoiced: 0, received: 0, last: '—' }
          : cfg.key === 'materials' ? { code: 'MT-NEW' }
            : cfg.key === 'employees' ? { code: 'EM-' + String(list.length + 1).padStart(2, '0') } : {};
      return {
        db: { ...st.db, [cfg.key]: [{ id: 'N' + Date.now(), ...extra, ...rec }].concat(list) },
        modal: null,
        seq: cfg.key === 'orders' ? st.seq + 1 : st.seq,
      };
    });
    toast(m.id ? 'Changes saved.' : 'Record created.');
  };

  const reinstate = (o) => {
    set((st) => ({ db: { ...st.db, orders: st.db.orders.map((x) => (x.id === o.id ? { ...x, status: 'Completed', reason: '' } : x)) } }));
    toast(o.ticket + ' reinstated as Completed.');
  };

  // ---- modal wiring ----
  let modalProps = null;
  if (s.modal) {
    const m = s.modal;
    const fields = m.kind === 'form' ? cfg.fields
      : m.kind === 'receipt' ? [
        { k: 'amount', label: 'Amount received', type: 'number', hint: 'Outstanding ' + M(d.outstanding(d.cust(m.id))) },
        { k: 'method', label: 'Method', type: 'select', options: RECEIPT_METHODS },
        { k: 'date', label: 'Receipt date', type: 'date' },
        { k: 'ref', label: 'Reference / UTR', span: 'span 2' },
      ] : [];
    modalProps = {
      modal: m,
      fields,
      form: s.form,
      errors: s.errors,
      setField: (k, v) => set((st) => ({ form: { ...st.form, [k]: v }, errors: { ...st.errors, [k]: null } })),
      calcLines: m.kind === 'form' && cfg.calc ? cfg.calc(s.form) : null,
      onConfirm: m.kind === 'delete' ? doDelete : m.kind === 'void' ? doVoid : m.kind === 'receipt' ? postReceipt : save,
      onClose: closeModal,
    };
  }

  if (route === 'profile') return <Profile onSignOut={() => { window.location.hash = '#/login'; }} />;
  if (route === 'login') return <Login onEnter={() => go('dashboard')} />;

  const meta = MODS[s.mod];
  const atStation = s.mod === 'weighbridge' || s.mod === 'dashboard';
  const filters = { q: s.q, status: s.status, from: s.from, to: s.to, sortK: s.sortK, sortDir: s.sortDir };
  const tonsToday = s.db.orders.filter((o) => o.status !== 'Void' && o.date === TODAY).reduce((a, o) => a + d.net(o), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: 14, letterSpacing: '-0.011em' }}>
      <div style={s.wide ? { display: 'flex', alignItems: 'stretch', minHeight: '100vh' } : { display: 'block' }}>
        <Sidebar wide={s.wide} mod={s.mod} onsiteCount={s.db.onsite.length} go={go} />

        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', containerType: 'inline-size', containerName: 'shell' }}>
          <Header
            meta={meta}
            scaleKg={N(s.scale)}
            onsite={String(s.db.onsite.length)}
            tons={T(tonsToday) + ' t'}
            now={s.now}
            onWeighbridge={() => go('weighbridge')}
            quickLabel={atStation ? 'Order book' : 'New entry'}
            onQuick={atStation ? () => go('orders') : openAdd}
          />
          <main
            className="ag-main"
            style={{ padding: 'var(--space-6) var(--space-8) 72px', flex: '1 1 auto', minWidth: 0, containerType: 'inline-size', background: 'linear-gradient(180deg, #F8F4F4A9, #B0B0B0)' }}
          >
            {s.mod === 'dashboard' && <Dashboard d={d} tab={s.dashTab} setTab={(t) => set({ dashTab: t })} go={go} />}
            {s.mod === 'weighbridge' && (
              <Weighbridge
                d={d}
                scale={s.scale}
                wb={s.wb}
                setWb={setWb}
                onCapture={captureTare}
                onWeighOut={weighOut}
                onConfirm={confirmOut}
                onVoid={askVoid}
                onCancel={cancelOut}
              />
            )}
            {cfg && (
              <ListModule
                key={s.mod}
                mod={s.mod}
                d={d}
                f={filters}
                setF={set}
                onAdd={openAdd}
                onEdit={openEdit}
                onDelete={askDelete}
                onReceipt={openReceipt}
                onReinstate={reinstate}
              />
            )}
          </main>
        </div>
      </div>

      {modalProps && <Modal {...modalProps} />}
      <Toast message={s.toast} />
    </div>
  );
}
