// Segmented control: options share one track; a white thumb slides left or right to the chosen one.
// options: [{ v, l }]. The thumb's position comes from the chosen index, so the slide works however the value changes.
export default function Segmented({ label, options, value, onChange, block = true, controls }) {
  const at = Math.max(0, options.findIndex((o) => o.v === value));
  return (
    <div
      role="tablist"
      aria-label={label}
      className={'ag-seg' + (block ? ' ag-seg-block' : '')}
      style={{ '--seg-n': options.length, '--seg-i': at }}
    >
      <span className="ag-seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="tab"
          aria-selected={o.v === value}
          aria-controls={controls ? controls(o.v) : undefined}
          onClick={() => onChange(o.v)}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
