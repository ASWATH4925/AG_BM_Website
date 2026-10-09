// Glass card with the reference's title/subtitle header and an optional header action.
export default function Panel({ title, sub, action, className = '', style, children }) {
  return (
    <div className={'ag-glass ' + className} style={style}>
      <div className={'ag-head' + (action ? ' ag-head-row' : '')}>
        <div>
          <h4>{title}</h4>
          {sub && <div className="ag-head-sub">{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
