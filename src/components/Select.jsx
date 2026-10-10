import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from './Icons';

const MENU_MAX = 300;

// Glass dropdown (.ag-sel trigger + .ag-menu listbox) with a search box.
// The list is drawn in a layer on top of the page, so table rows and cards never cover it.
export default function Select({ value, options, onChange, placeholder = 'Select…', label }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState(null);
  const trigger = useRef(null);
  const search = useRef(null);
  const id = useId();
  const cur = options.find((o) => String(o.v) === String(value));
  const shown = q.trim() ? options.filter((o) => o.l.toLowerCase().includes(q.trim().toLowerCase())) : options;

  const place = () => {
    const r = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < MENU_MAX + 16 && r.top > below;
    const width = Math.min(Math.max(r.width, 220), window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos({ left, width, top: up ? 'auto' : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : 'auto' });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => { window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setHi(Math.max(0, options.findIndex((o) => String(o.v) === String(value))));
    setTimeout(() => search.current?.focus(), 0);
  }, [open]);

  const close = (refocus) => { setOpen(false); if (refocus) trigger.current?.focus(); };
  const choose = (o) => { close(true); onChange(o.v); };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(shown.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[hi]) choose(shown[hi]); }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={trigger}
        type="button"
        className="ag-sel"
        data-open={open ? '1' : '0'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{cur ? cur.l : placeholder}</span>
        <ChevronDown />
      </button>
      {open && pos && createPortal(
        <>
          <div onMouseDown={() => close(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
          <div
            className="ag-menu ag-menu-float"
            style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, zIndex: 1001, maxHeight: MENU_MAX, display: 'flex', flexDirection: 'column' }}
            onKeyDown={onKey}
          >
            <input
              ref={search}
              className="ag-menu-search"
              type="search"
              placeholder="Search…"
              aria-label={'Search ' + (label || 'options')}
              value={q}
              onChange={(e) => { setQ(e.target.value); setHi(0); }}
            />
            <div role="listbox" id={id} aria-label={label} style={{ overflowY: 'auto', minHeight: 0 }}>
              {shown.map((o, i) => {
                const on = String(o.v) === String(value);
                return (
                  <button
                    key={o.v}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className="ag-opt"
                    data-on={on ? '1' : '0'}
                    data-hi={i === hi ? '1' : '0'}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => choose(o)}
                  >
                    {o.l}
                  </button>
                );
              })}
              {shown.length === 0 && <div style={{ padding: '9px 10px', fontSize: 13, color: 'var(--color-neutral-600)' }}>No match for “{q}”</div>}
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
