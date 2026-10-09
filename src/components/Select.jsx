import { useEffect, useId, useState } from 'react';
import { ChevronDown } from './Icons';

// Glass dropdown from the reference (.ag-sel trigger + .ag-menu listbox).
export default function Select({ value, options, onChange, placeholder = 'Select…', label }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const cur = options.find((o) => String(o.v) === String(value));

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
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
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
          <div className="ag-menu" role="listbox" id={id}>
            {options.map((o) => {
              const on = String(o.v) === String(value);
              return (
                <button
                  key={o.v}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className="ag-opt"
                  data-on={on ? '1' : '0'}
                  onClick={() => { setOpen(false); onChange(o.v); }}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
