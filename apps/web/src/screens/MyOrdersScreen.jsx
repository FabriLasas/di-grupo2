import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatPrice } from '@fino/shared'
import { myOrders } from '../api/endpoints.js'
import { useStore } from '../state/store.jsx'
import { useCart, unitPrice } from '../state/cart.jsx'

const ESTADO = {
  pendiente_pago: 'Esperando el pago', por_aceptar: 'Esperando al local', en_cocina: 'En preparación', para_retirar: 'Listo para retirar',
  entregado: 'Entregado', rechazado: 'Rechazado', cancelado: 'Cancelado', no_retirado: 'No retirado',
}
const fecha = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Arma líneas de carrito con los precios actuales; deja afuera lo que ya no está. */
export function rebuildLines(order, productById, extras) {
  const lines = []
  let missing = 0
  for (const i of order.items) {
    const p = productById(i.productId)
    const variantOk = !i.variantId || p?.variantes.some((v) => v.id === i.variantId)
    const extrasOk = i.extraIds.every((id) => extras.some((e) => e.id === id))
    if (!p || p.agotado || !variantOk || !extrasOk) { missing += i.cantidad; continue }
    lines.push({
      productId: p.id, variantId: i.variantId, extras: i.extraIds, sinTacc: i.sinTacc && p.sinTacc, aclaracion: i.aclaracion ?? '', cantidad: i.cantidad,
      nombre: p.nombre, varianteNombre: p.variantes.find((v) => v.id === i.variantId)?.nombre ?? null,
      extrasNombres: i.extraIds.map((id) => extras.find((e) => e.id === id).nombre),
      precioUnitario: unitPrice(p, i.variantId, i.extraIds, extras),
    })
  }
  return { lines, missing }
}

export function MyOrdersScreen() {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState(null)
  const { productById, menu } = useStore()
  const { add } = useCart()
  const nav = useNavigate()

  useEffect(() => { myOrders().then((r) => setOrders(r.orders)).catch(setError) }, [])

  const repeat = (o) => {
    const { lines, missing } = rebuildLines(o, productById, menu?.extras ?? [])
    lines.forEach(add)
    const notice = missing ? `${missing} producto${missing > 1 ? 's' : ''} ${missing > 1 ? 'no están disponibles y no se agregaron' : 'no está disponible y no se agregó'}.` : null
    nav('/carrito', { state: { notice } })
  }

  if (error) return <section className="card center"><p className="lead">{error.message}</p></section>
  if (!orders) return <section className="card" aria-busy="true"><div className="skeleton" /><div className="skeleton" /></section>

  return (
    <section className="card">
      <h1 className="h-sm">Mis pedidos</h1>
      {!orders.length && <div className="center"><p className="lead">Todavía no hiciste pedidos.</p><Link className="btn" to="/">Ver el menú</Link></div>}
      <div className="orders">
        {orders.map((o) => (
          <article key={o.id} className="order" aria-label={`Pedido ${o.numeroLabel}`}>
            <div className="o-top"><b>{o.numeroLabel}</b><span className={`chip-st st-${o.estado}`}>{ESTADO[o.estado]}</span></div>
            <p className="o-items">{o.items.map((i) => `${i.cantidad}× ${i.producto}${i.variante ? ` ${i.variante}` : ''}`).join(', ')}</p>
            <div className="o-foot">
              <span className="o-date">{fecha.format(new Date(o.creadoEn))}</span>
              <span className="o-tot">{formatPrice(o.total)}</span>
            </div>
            <div className="o-act">
              <Link className="btn ghost" to={`/pedido/${o.id}`}>Ver detalle</Link>
              <button className="btn" type="button" onClick={() => repeat(o)} disabled={!menu}>Repetir</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
