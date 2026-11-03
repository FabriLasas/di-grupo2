import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { formatPrice } from '@fino/shared'
import { getOrder, cancelOrder } from '../api/endpoints.js'
import { connectSocket, subscribeOrder } from '../api/socket.js'
import { useCart } from '../state/cart.jsx'
import { Mascot } from '../ui/Mascot.jsx'

const hhmm = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const STEP = { pendiente_pago: 1, por_aceptar: 1, en_cocina: 2, para_retirar: 3, entregado: 4, rechazado: 1, cancelado: 1, no_retirado: 3 }
const TITLE = {
  pendiente_pago: 'Esperando el pago', por_aceptar: 'Esperando al local', en_cocina: '¡Pedido aceptado!', para_retirar: '¡Tu pedido está listo!',
  entregado: '¡Que lo disfrutes!', rechazado: 'No pudimos tomar tu pedido', cancelado: 'Pedido cancelado', no_retirado: 'No pasaste a retirarlo',
}
const MOTIVO = {
  sin_stock: 'Se quedaron sin stock de uno de los productos.',
  local_cerrando: 'El local está cerrando.',
  demasiados_pedidos: 'El local tiene demasiados pedidos en este momento.',
  otro: 'El local no pudo tomarlo.',
}
const paymentFailed = (o) => o.estado === 'cancelado' && o.metodoPago === 'mp' && ['rechazado', 'pendiente'].includes(o.pago?.estado)

function Body({ o }) {
  switch (o.estado) {
    case 'pendiente_pago': return <p className="sub">Si ya pagaste, en unos segundos se confirma.</p>
    case 'por_aceptar': return <p className="sub">Fino está revisando tu pedido. En unos segundos te confirmamos la hora de retiro.</p>
    case 'en_cocina': return <><p className="sub">Pasá a retirarlo a las</p><p className="big">{hhmm.format(new Date(o.retiroEstimado))}</p></>
    case 'para_retirar': return <><p className="sub">Mostrá este número en el mostrador</p><p className="big">{o.numeroLabel}</p></>
    case 'entregado': return <p className="sub">Retiraste tu pedido. ¡Gracias por elegir Fino!</p>
    case 'rechazado': return <><p className="sub">{MOTIVO[o.motivoRechazo] ?? MOTIVO.otro}</p>{o.pago?.estado === 'devuelto' && <p className="sub ok-text">Te devolvimos el pago a Mercado Pago.</p>}{o.pago?.estado === 'devolucion_pendiente' && <p className="sub">Estamos devolviendo tu pago. Puede tardar unos minutos.</p>}</>
    case 'cancelado': return paymentFailed(o) ? <p className="sub">El pago no se aprobó.</p> : <p className="sub">{o.pago?.estado === 'devuelto' ? 'Te devolvimos el pago a Mercado Pago.' : 'No se te cobró nada.'}</p>
    default: return <p className="sub">Si tenés dudas, escribile al local.</p>
  }
}

export function OrderScreen() {
  const { id } = useParams()
  const nav = useNavigate()
  const { replace } = useCart()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const cardRef = useRef(null)
  const prevState = useRef(null)

  useEffect(() => {
    let alive = true
    getOrder(id).then((r) => alive && setOrder(r.order)).catch((e) => alive && setError(e))
    const socket = connectSocket()
    const off = subscribeOrder(socket, id, (dto) => alive && setOrder(dto))
    return () => { alive = false; off(); socket.close() }
  }, [id])

  useEffect(() => {
    if (order && prevState.current && prevState.current !== order.estado) {
      cardRef.current?.animate?.([{ transform: 'scale(.95)' }, { transform: 'scale(1.03)' }, { transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.34,1.56,.64,1)' })
    }
    prevState.current = order?.estado ?? null
  }, [order])

  if (error) return <section className="card center"><p className="lead">{error.message}</p></section>
  if (!order) return <section className="card" aria-busy="true"><div className="skeleton" /><div className="skeleton" /></section>

  const step = STEP[order.estado]
  const canCancel = order.estado === 'pendiente_pago' || order.estado === 'por_aceptar'

  const cancel = async () => {
    setBusy(true)
    try { setOrder((await cancelOrder(order.id)).order) } catch (e) { setError(e) } finally { setBusy(false); setConfirming(false) }
  }
  const retry = () => {
    replace(order.items.map((i) => ({
      productId: i.productId, variantId: i.variantId, extras: i.extraIds, sinTacc: i.sinTacc, aclaracion: i.aclaracion ?? '', cantidad: i.cantidad,
      nombre: i.producto, varianteNombre: i.variante, extrasNombres: i.extras, precioUnitario: i.precioUnitario,
    })))
    nav('/checkout')
  }

  return (
    <section className="card track" ref={cardRef} aria-live="polite">
      <Mascot className="masc-md" />
      <h1 className="st">{TITLE[order.estado]}</h1>
      <Body o={order} />
      <ol className="prog" aria-label="Progreso del pedido">
        {['Enviado', 'Aceptado', 'Listo', 'Retirado'].map((s, i) => <li key={s} data-done={i < step}><i /><span>{s}</span></li>)}
      </ol>
      <p className="num">Pedido {order.numeroLabel} · {formatPrice(order.total)} · {order.metodoPago === 'mp' ? 'Mercado Pago' : order.detallePagoLocal === 'tarjeta' ? 'Tarjeta en el local' : 'Efectivo en el local'}</p>
      {paymentFailed(order) && <button className="btn block" type="button" onClick={retry}>Volver a intentar</button>}
      {canCancel && !confirming && <button className="btn ghost block" type="button" onClick={() => setConfirming(true)}>Cancelar pedido</button>}
      {canCancel && confirming && (
        <div className="confirm-row">
          <p>¿Seguro que querés cancelarlo?</p>
          <button className="btn ghost" type="button" onClick={() => setConfirming(false)}>No</button>
          <button className="btn" type="button" onClick={cancel} disabled={busy}>Sí, cancelar</button>
        </div>
      )}
    </section>
  )
}
