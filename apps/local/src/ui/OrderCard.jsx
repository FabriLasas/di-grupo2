import { formatPrice } from '@fino/shared'
import { ageState, dueState, waitState, hhmm } from '../lib/time.js'

const short = (n) => { const p = n.split(' '); return p[0] + (p[1] ? ` ${p[1][0]}.` : '') }
const units = (o) => o.items.reduce((a, i) => a + i.cantidad, 0)
export const itemDetail = (i) => [i.variante, ...i.extras, i.sinTacc ? 'Pan sin TACC' : null].filter(Boolean).join(' · ')

function PayPill({ o }) {
  return o.metodoPago === 'mp' ? <span className="pill paid">Pagado</span> : <span className="pill cash">Paga al retirar</span>
}

export function OrderCard({ order: o, kind, now, highlight, onOpen, actions }) {
  const time = kind === 'new' ? ageState(o.creadoEn, now) : kind === 'cook' ? dueState(o.retiroEstimado, now) : waitState(o.listoEn, now)
  const cls = ['card', time.state !== 'ok' && time.state, highlight && 'match', o._fresh && 'enter'].filter(Boolean).join(' ')
  return (
    <article className={cls} aria-label={`Pedido ${o.numeroLabel}`}>
      <div className="top"><span className="id">{o.numeroLabel}</span><span className={`tpill ${time.state}`}>{time.label}</span></div>
      {kind === 'new' && (
        <>
          <div className="meta"><b>{short(o.cliente.nombre)}</b><span>{units(o)} productos · {formatPrice(o.total)}</span></div>
          <PayPill o={o} />
          <button type="button" className="big-btn b-open" onClick={() => onOpen(o.id)}>Ver pedido</button>
        </>
      )}
      {kind === 'cook' && (
        <>
          <div className="meta"><b>{short(o.cliente.nombre)}</b><span>Retira {hhmm(o.retiroEstimado)}</span></div>
          <ul className="items">
            {o.items.map((i, n) => (
              <li key={n}>
                <span className="q">{i.cantidad}</span><span>{i.producto}</span>
                {itemDetail(i) && <small>{itemDetail(i)}</small>}
                {i.aclaracion && <span className="mod">{i.aclaracion}</span>}
              </li>
            ))}
          </ul>
          {o.nota && <p className="knote">{o.nota}</p>}
          {actions}
        </>
      )}
      {kind === 'ready' && (
        <>
          <div className="meta"><b>{o.cliente.nombre}</b><span>{units(o)} productos</span></div>
          {o.metodoPago === 'mp'
            ? <div className="collect paid">Pagado online</div>
            : <div className="collect cash">Cobrar {formatPrice(o.total)}<small>{o.detallePagoLocal === 'tarjeta' ? 'Tarjeta' : 'Efectivo'}</small></div>}
          {actions}
        </>
      )}
    </article>
  )
}
