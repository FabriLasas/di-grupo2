import { formatPrice } from '@fino/shared'
import { useStore, closedMessage } from '../state/store.jsx'

function priceLabel(p) {
  if (!p.variantes.length) return formatPrice(p.precioBase)
  return `desde ${formatPrice(Math.min(...p.variantes.map((v) => v.precio)))}`
}

/** Menú Tablero: tarjeta crema con chips, líneas punteadas y botón "+". */
export function MenuScreen({ onAdd = () => {} }) {
  const { menu, store, loading, error, reload } = useStore()
  const notice = closedMessage(store)

  if (error && !menu) {
    return (
      <section className="card center" aria-live="polite">
        <p className="lead">No pudimos cargar el menú.</p>
        <button className="btn" onClick={reload}>Reintentar</button>
      </section>
    )
  }
  if (loading && !menu) {
    return (
      <section className="card" aria-busy="true" aria-label="Cargando menú">
        <h1>Menú Fino</h1>
        {[0, 1, 2].map((i) => <div key={i} className="skeleton" />)}
      </section>
    )
  }

  const go = (id) => document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <>
      {notice && <p className="notice" role="status">{notice}</p>}
      <section className="card">
        <h1>Menú Fino</h1>
        <nav className="chips" aria-label="Categorías">
          {menu.categorias.map((c) => <button key={c.id} type="button" onClick={() => go(c.id)}>{c.nombre}</button>)}
        </nav>
        {menu.categorias.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="cat" aria-labelledby={`h-${c.id}`}>
            <h2 id={`h-${c.id}`}>{c.nombre}</h2>
            {c.productos.map((p) => (
              <article key={p.id} className={`item${p.agotado ? ' off' : ''}`}>
                <div className="row">
                  <b>{p.nombre}</b><span className="dash" aria-hidden="true" /><span className="pr">{priceLabel(p)}</span>
                </div>
                {p.descripcion && <p className="desc">{p.descripcion}</p>}
                {p.agotado
                  ? <span className="sold">Agotado</span>
                  : <button className="add" type="button" aria-label={`Agregar ${p.nombre}`} onClick={(e) => onAdd(p, e.currentTarget)}>+</button>}
              </article>
            ))}
          </section>
        ))}
        <p className="tacc">*Disponible opción pan sin TACC</p>
      </section>
    </>
  )
}
