import { Link } from 'react-router'
import { formatPrice } from '@fino/shared'
import { useCart } from '../state/cart.jsx'
import { Mascot } from '../ui/Mascot.jsx'

export function lineDetail(l) {
  return [l.varianteNombre, ...l.extrasNombres, l.sinTacc ? 'Pan sin TACC' : null, l.aclaracion ? `“${l.aclaracion}”` : null].filter(Boolean).join(' · ')
}

/** Lista editable del pedido. `footer` permite reutilizarla en el checkout. */
export function CartLines({ readOnly = false }) {
  const { lines, inc, dec, remove } = useCart()
  return (
    <ul className="lines">
      {lines.map((l) => (
        <li key={l.key} className={l.unavailable ? 'gone' : ''}>
          <div className="ln-main">
            <b>{l.nombre}</b>
            {lineDetail(l) && <small>{lineDetail(l)}</small>}
            {l.unavailable && <span className="gone-tag">Ya no está disponible</span>}
          </div>
          {readOnly ? <span className="qty">{l.cantidad}×</span> : l.unavailable ? (
            <button type="button" className="link" onClick={() => remove(l.key)}>Quitar</button>
          ) : (
            <div className="stepper small">
              <button type="button" aria-label={`Quitar uno de ${l.nombre}`} onClick={() => dec(l.key)}>−</button>
              <output>{l.cantidad}</output>
              <button type="button" aria-label={`Sumar uno de ${l.nombre}`} onClick={() => inc(l.key)}>+</button>
            </div>
          )}
          <span className="ln-pr">{formatPrice(l.cantidad * l.precioUnitario)}</span>
        </li>
      ))}
    </ul>
  )
}

export function CartScreen() {
  const { lines, total } = useCart()
  if (!lines.length) {
    return (
      <section className="card center empty">
        <h1 className="h-sm">Tu pedido</h1>
        <Mascot className="masc-lg" />
        <p className="lead">Tu pedido está vacío</p>
        <Link className="btn" to="/">Ver el menú</Link>
      </section>
    )
  }
  return (
    <section className="card">
      <h1 className="h-sm">Tu pedido</h1>
      <CartLines />
      <div className="sum"><span>Total</span><b>{formatPrice(total)}</b></div>
      <Link className="btn block" to="/checkout">Continuar</Link>
      <Link className="btn ghost block" to="/">Seguir pidiendo</Link>
    </section>
  )
}
