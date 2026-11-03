import { useState } from 'react'
import { formatPrice } from '@fino/shared'

export function CookActions({ order, onReady, busy }) {
  return <button type="button" className="big-btn b-ready" disabled={busy} onClick={() => onReady(order)}>Listo para retirar</button>
}

/** Entregar (con confirmación de cobro si paga en el local) y "No lo retiró". */
export function ReadyActions({ order, onDeliver, onNotPickedUp, busy }) {
  const [mode, setMode] = useState(null) // null | 'cobro' | 'noretiro'
  const cash = order.metodoPago === 'local'
  if (mode === 'cobro') {
    return (
      <div className="confirm">
        <p>¿Cobraste <b>{formatPrice(order.total)}</b>?</p>
        <div><button type="button" className="big-btn b-ghost" onClick={() => setMode(null)}>Volver</button><button type="button" className="big-btn b-done" disabled={busy} onClick={() => onDeliver(order, true)}>Sí, entregar</button></div>
      </div>
    )
  }
  if (mode === 'noretiro') {
    return (
      <div className="confirm">
        <p>¿Marcar que no lo retiró?</p>
        <div><button type="button" className="big-btn b-ghost" onClick={() => setMode(null)}>Volver</button><button type="button" className="big-btn b-ready" disabled={busy} onClick={() => onNotPickedUp(order)}>Sí, no lo retiró</button></div>
      </div>
    )
  }
  return (
    <>
      <button type="button" className="big-btn b-done" disabled={busy} onClick={() => (cash ? setMode('cobro') : onDeliver(order, false))}>Entregar</button>
      <button type="button" className="linkish" onClick={() => setMode('noretiro')}>No lo retiró</button>
    </>
  )
}
