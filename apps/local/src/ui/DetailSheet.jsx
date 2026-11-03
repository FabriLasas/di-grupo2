import { useEffect, useRef, useState } from 'react'
import { formatPrice, suggestMinutes } from '@fino/shared'
import { hhmm } from '../lib/time.js'
import { itemDetail } from './OrderCard.jsx'

const BASE_OPTS = [10, 15, 20, 25, 30, 45]
const REASONS = [['sin_stock', 'Sin stock'], ['local_cerrando', 'Local cerrando'], ['demasiados_pedidos', 'Demasiados pedidos'], ['otro', 'Otro motivo']]
const units = (o) => o.items.reduce((a, i) => a + i.cantidad, 0)

export function suggestedFor(o, demoraMin) {
  return o.sugeridoMin ?? suggestMinutes({ delay: demoraMin ?? 15, units: units(o) })
}

function payText(o) {
  if (o.metodoPago === 'mp') return null
  if (o.detallePagoLocal === 'tarjeta') return 'Tarjeta en el local'
  return ['Efectivo', o.pagaCon ? `paga con ${formatPrice(o.pagaCon)}` : null, o.vuelto ? `vuelto ${formatPrice(o.vuelto)}` : null].filter(Boolean).join(' · ')
}

/** Hoja superpuesta para revisar un pedido y aceptarlo con tiempo de retiro o rechazarlo. */
export function DetailSheet({ order: o, position, demoraMin, now, warning, busy, onPrev, onNext, onClose, onAccept, onReject }) {
  const sug = suggestedFor(o, demoraMin)
  const [min, setMin] = useState(sug)
  const [showReasons, setShowReasons] = useState(false)
  const ref = useRef(null)
  useEffect(() => { setMin(sug); setShowReasons(false) }, [o.id, sug])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const opts = [...new Set([...BASE_OPTS, sug])].sort((a, b) => a - b)
  const readyAt = hhmm(new Date(now.getTime() + min * 60000))
  const disabled = busy || !!warning

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-label={`Pedido ${o.numeroLabel}`} ref={ref} tabIndex={-1}>
        <div className="sh">
          <button type="button" className="icon" aria-label="Cerrar" onClick={onClose}>✕</button>
          <span className="pos">Pedido <b>{position.index + 1} de {position.total}</b> por aceptar</span>
          <div className="nav">
            <button type="button" className="icon" aria-label="Pedido anterior" onClick={onPrev} disabled={position.index <= 0}>‹</button>
            <button type="button" className="icon" aria-label="Pedido siguiente" onClick={onNext} disabled={position.index >= position.total - 1}>›</button>
          </div>
        </div>
        {warning ? <p className="sheet-warn" role="alert">{warning}</p> : <div />}
        <div className="sb">
          <div className="sl">
            <div className="dh"><h2>Pedido {o.numeroLabel}</h2><p><b>{o.cliente.nombre}</b> · {o.cliente.telefono} · ingresó {hhmm(o.creadoEn)}</p></div>
            <div className="ticket">
              <table className="tbl">
                <thead><tr><th>Cant.</th><th>Producto</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr></thead>
                <tbody>
                  {o.items.map((i, n) => (
                    <tr key={n}>
                      <td className="q">{i.cantidad}</td>
                      <td className="p"><b>{i.producto}</b>{itemDetail(i) && <small>{itemDetail(i)}</small>}{i.aclaracion && <span className="mod">{i.aclaracion}</span>}</td>
                      <td className="s">{formatPrice(i.subtotal)}{i.cantidad > 1 && <small>{i.cantidad} × {formatPrice(i.precioUnitario)}</small>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="tsum"><span>{units(o)} productos</span><b>{formatPrice(o.total)}</b></div>
            </div>
            {o.nota && <p className="note">“{o.nota}”</p>}
          </div>
          <div className="sr-col">
            <div className="blk">
              <h3>Forma de pago</h3>
              <div className="payline">
                {o.metodoPago === 'mp' ? <span className="pill paid">Pagado online</span> : <span className="pill cash">Paga al retirar</span>}
                {payText(o) && <span>{payText(o)}</span>}
                {o.metodoPago === 'mp' && o.pago?.mpPaymentId && <span className="mono">Op. {o.pago.mpPaymentId}</span>}
              </div>
            </div>
            <div className="blk">
              <h3>¿En cuánto lo retira?</h3>
              <div className="chips">
                {opts.map((m) => (
                  <button key={m} type="button" aria-pressed={m === min} onClick={() => setMin(m)}>{m} min{m === sug && <span className="sug">SUGERIDO</span>}</button>
                ))}
              </div>
              <div className="fine">
                <button type="button" className="icon" aria-label="Restar 5 minutos" onClick={() => setMin((m) => Math.max(5, m - 5))} disabled={min <= 5}>−</button>
                <span aria-label="Minutos elegidos">{min} min</span>
                <button type="button" className="icon" aria-label="Sumar 5 minutos" onClick={() => setMin((m) => Math.min(90, m + 5))} disabled={min >= 90}>+</button>
              </div>
            </div>
            <div className="readyat"><span>Listo para retirar a las</span><b>{readyAt}</b></div>
            <div className="decide">
              <button type="button" className="b-accept" disabled={disabled} onClick={() => onAccept(o, min)}>Aceptar · retiro {readyAt}</button>
              <button type="button" className="b-reject" disabled={disabled} onClick={() => setShowReasons((v) => !v)} aria-expanded={showReasons}>Rechazar</button>
              {showReasons && (
                <div className="reasons">
                  {REASONS.map(([code, label]) => <button key={code} type="button" disabled={disabled} onClick={() => onReject(o, code)}>{label}</button>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
