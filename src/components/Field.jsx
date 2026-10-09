// Uppercase-labelled form field used by the station form, filters and dialogs.
export default function Field({ label, as: Tag = 'div', style, children }) {
  return (
    <Tag className="field" style={{ display: 'block', minWidth: 0, ...style }}>
      <span className="ag-label ag-field-label">{label}</span>
      {children}
    </Tag>
  );
}
