import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatPrice } from '@fino/shared'
import { useCart } from '../state/cart.jsx'
import { useStore, closedMessage } from '../state/store.jsx'
import { createOrder } from '../api/endpoints.js'
import { CartLines } from './CartScreen.jsx'

const toItem = (l) => ({
  productId: l.productId,
  ...(l.variantId ? { variantId: l.variantId } : {}),
  cantidad: l.cantidad,
  ...(l.aclaracion ? { aclaracion: l.aclaracion } : {}),
  sinTacc: !!l.sinTacc,
  extras: l.extras,
})

const defaultRedirect = (url) => window.location.assign(url)

export function CheckoutScreen({ redirect = defaultRedirect }) {
  const { lines, total, clear, flagUnavailable } = useCart()
  const { store } = useStore()
  const nav = useNavigate()
  const [metodo, setMetodo] = useState('mp')
  const [detalle, setDetalle] = useState('efectivo')
  const [pagaCon, setPagaCon] = useState('')
  const [nota, setNota] = useState('')
  const [newTotal, setNewTotal] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setNewTotal(null) }, [total])

  const notice = closedMessage(store)
  const hasGone = lines.some((l) => l.unavailable)
  const shownTotal = newTotal ?? total
  const pagaConN = Number(pagaCon.replace(/\D/g, '')) || null
  const vuelto = metodo === 'local' && detalle === 'efectivo' && pagaConN && pagaConN >= shownTotal ? pagaConN - shownTotal : null

  if (!lines.length) {
    return (
      <section className="card center">
        <h1 className="h-sm">Confirmá tu pedido</h1>
        <p className="lead">Tu pedido está vacío</p>
        <Link className="btn" to="/">Ver el menú</Link>
      </section>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const body = {
      items: lines.map(toItem),
      metodoPago: metodo,
      ...(metodo === 'local' ? { detallePagoLocal: detalle } : {}),
      ...(metodo === 'local' && detalle === 'efectivo' && pagaConN ? { pagaCon: pagaConN } : {}),
      ...(nota.trim() ? { nota: nota.trim() } : {}),
      totalEsperado: shownTotal,
    }
    try {
      const r = await createOrder(body)
      clear()
      if (r.initPoint) redirect(r.initPoint)
      else nav(`/pedido/${r.order.id}`, { replace: true })
    } catch (err) {
      if (err.code === 'productos_no_disponibles') { flagUnavailable(err.details?.productos ?? []); setMsg('Algunos productos se agotaron. Quitalos para seguir.') }
      else if (err.code === 'total_cambio') { setNewTotal(err.details.total); setMsg(`Los precios cambiaron. El total ahora es ${formatPrice(err.details.total)}.`) }
      else if (err.code === 'sin_conexion') setMsg('No hay conexión. Probá de nuevo.')
      else setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  const label = busy ? 'Enviando…' : newTotal != null ? `Confirmar con el nuevo total · ${formatPrice(newTotal)}` : `Confirmar pedido · ${formatPrice(shownTotal)}`

  return (
    <form className="card" onSubmit={submit}>
      <h1 className="h-sm">Confirmá tu pedido</h1>
      {notice && <p className="notice" role="status">{notice}</p>}
      <CartLines />
      <div className="sum"><span>Total</span><b>{formatPrice(shownTotal)}</b></div>

      <fieldset className="opts">
        <legend>¿Cómo pagás?</legend>
        <label className="opt"><input type="radio" name="metodo" checked={metodo === 'mp'} onChange={() => setMetodo('mp')} /><span>Pagar ahora con Mercado Pago</span></label>
        <label className="opt"><input type="radio" name="metodo" checked={metodo === 'local'} onChange={() => setMetodo('local')} /><span>Pagar al retirar</span></label>
      </fieldset>

      {metodo === 'local' && (
        <fieldset className="opts sub">
          <legend className="sr">Medio de pago en el local</legend>
          <label className="opt"><input type="radio" name="detalle" checked={detalle === 'efectivo'} onChange={() => setDetalle('efectivo')} /><span>Efectivo</span></label>
          <label className="opt"><input type="radio" name="detalle" checked={detalle === 'tarjeta'} onChange={() => setDetalle('tarjeta')} /><span>Tarjeta en el local</span></label>
          {detalle === 'efectivo' && (
            <label className="field" htmlFor="pagaCon">
              <span>¿Con cuánto pagás?</span>
              <input id="pagaCon" inputMode="numeric" value={pagaCon} onChange={(e) => setPagaCon(e.target.value)} placeholder="Opcional, para tener el vuelto listo" />
              {vuelto != null && <span className="ok-text">Tu vuelto: {formatPrice(vuelto)}</span>}
            </label>
          )}
        </fieldset>
      )}

      <label className="field" htmlFor="nota">
        <span>Nota para el local</span>
        <textarea id="nota" rows={2} maxLength={280} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
      </label>

      {msg && <p className="form-err" role="alert">{msg}</p>}
      <button className="btn block big" type="submit" disabled={busy || hasGone || !store?.aceptaPedidos}>{label}</button>
    </form>
  )
}
