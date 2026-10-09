import { useEffect, useRef } from 'react';
import Field from './Field';
import Select from './Select';

// Create / edit / receipt form, or a confirmation, in the reference's bordered dialog.
export default function Modal({ modal, fields, form, errors, setField, calcLines, onConfirm, onClose }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement;
    const first = ref.current?.querySelector('input, button.ag-sel') || ref.current?.querySelector('.btn-primary');
    first?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !ref.current?.querySelector('.ag-menu')) closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);

  const isForm = fields.length > 0;

  return (
    <div
      className="dialog-backdrop ag-fade"
      style={{
        position: 'fixed', inset: 0, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 'var(--space-4)', zIndex: 40, background: 'color-mix(in srgb, var(--color-neutral-900) 55%, transparent)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ag-dialog-title"
        className="dialog elev-lg ag-pop"
        style={{ width: 'min(760px,94vw)', maxHeight: '88vh', overflow: 'auto', background: 'var(--color-bg)', border: '2px solid var(--color-text)' }}
        onSubmit={(e) => { e.preventDefault(); onConfirm(); }}
        noValidate
      >
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid rgba(32,30,29,.10)' }}>
          <div className="ag-kicker">{modal.kicker}</div>
          <h3 id="ag-dialog-title" style={{ margin: '4px 0 0', fontSize: 24, letterSpacing: '-0.03em' }}>{modal.title}</h3>
        </div>

        <div style={{ padding: 'var(--space-4)' }}>
          {!isForm && <p style={{ margin: 0, fontSize: 14 }}>{modal.message}</p>}
          {isForm && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(210px,100%),1fr))', gap: 'var(--space-3)' }}>
                {fields.map((f) => {
                  const value = form[f.k] == null ? '' : form[f.k];
                  const err = errors[f.k];
                  return (
                    <Field key={f.k} label={f.label} as={f.type === 'select' ? 'div' : 'label'} style={{ gridColumn: f.span || 'auto' }}>
                      {f.type === 'select' ? (
                        <Select label={f.label} value={value} options={f.options || []} onChange={(v) => setField(f.k, v)} />
                      ) : (
                        <input
                          className="input"
                          style={{ width: '100%' }}
                          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                          placeholder={f.placeholder || ''}
                          value={value}
                          aria-invalid={err ? true : undefined}
                          onChange={(e) => setField(f.k, e.target.value)}
                        />
                      )}
                      {f.hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 3 }}>{f.hint}</span>}
                      {err && <span role="alert" style={{ display: 'block', fontSize: 11, color: 'var(--color-accent-700)', fontWeight: 600, marginTop: 3 }}>{err}</span>}
                    </Field>
                  );
                })}
              </div>
              {calcLines && (
                <div style={{ marginTop: 'var(--space-4)', border: '1px solid var(--color-neutral-300)', padding: 'var(--space-3)', background: 'var(--color-neutral-100)' }}>
                  <div className="ag-kicker" style={{ marginBottom: 6 }}>Calculated</div>
                  {calcLines.map((l) => (
                    <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', fontSize: 14, padding: '3px 0' }}>
                      <span style={{ color: 'var(--color-neutral-800)' }}>{l.label}</span>
                      <span className="ag-tabular" style={{ fontWeight: 600 }}>{l.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="dialog-actions" style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-start', padding: 'var(--space-4)', borderTop: '1px solid rgba(32,30,29,.10)' }}>
          <button type="submit" className="btn btn-primary">{modal.confirmLabel}</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="ag-toast"
      style={{
        position: 'fixed', left: 'var(--space-6)', bottom: 'var(--space-6)', zIndex: 50, background: 'var(--color-text)', color: 'var(--color-bg)',
        padding: 'var(--space-3) var(--space-4)', borderLeft: '4px solid var(--color-accent)', maxWidth: 'min(420px,86vw)', fontSize: 14, fontWeight: 500,
      }}
    >
      {message}
    </div>
  );
}
