export function Lane({ id, kind, title, sort, count, empty, query, alert, children }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <section className={`lane${alert ? ' alert' : ''}`} data-s={kind} aria-labelledby={`h-${id}`}>
      <div className="lh"><h2 id={`h-${id}`}>{title}</h2><span className="n">{count}</span><span className="sort">{sort}</span></div>
      <div className="cards">
        {has ? children : <p className="none">{query ? `Ningún pedido coincide con "${query}".` : empty}</p>}
      </div>
    </section>
  )
}
