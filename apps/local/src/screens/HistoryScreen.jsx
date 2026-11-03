import { useCallback, useEffect, useState } from 'react'
import { formatPrice } from '@fino/shared'
import * as api from '../api/endpoints.js'
import { hhmm, businessDay, shiftDay } from '../lib/time.js'
import { itemDetail } from '../ui/OrderCard.jsx'

const FILTERS = [['', 'Todos'], ['entregado', 'Entregados'], ['rechazado', 'Rechazados'], ['cancelado', 'Cancelados'], ['no_retirado', 'No retirados']]
const ESTADO = { entregado: 'Entregado', rechazado: 'Rechazado', cancelado: 'Cancelado', no_retirado: 'No retirado' }
const MOTIVO = { sin_stock: 'sin stock', local_cerrando: 'local cerrando', demasiados_pedidos: 'demasiados pedidos', otro: 'otro motivo' }
const dayFmt = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'numeric' })

export function eventLabel(e) {
  const d = e.detalle ?? {}
  switch (e.tipo) {
    case 'creado': return 'Ingresó'
    case 'pago_aprobado': return 'Pago aprobado'
    case 'pago_fallido': return 'Pago no aprobado'
    case 'aceptar': return `Aceptado por ${e.actor ?? 'el local'}${d.minutos ? ` · retiro en ${d.minutos} min` : ''}`
    case 'rechazar': return `Rechazado por ${e.actor ?? 'el local'}: ${MOTIVO[d.motivo] ?? d.motivo}`
    case 'listo': return 'Listo'
    case 'entregar': return `${d.cobroConfirmado ? 'Cobrado y entregado' : 'Entregado'}${e.actor ? ` por ${e.actor}` : ''}`
    case 'no_retirado': return 'Marcado como no retirado'
    case 'cancelar': return 'Cancelado por el cliente'
    case 'devolucion': return 'Pago devuelto'
    case 'nota': return `Nota de ${e.actor ?? 'el local'}: ${d.texto ?? ''}`
    default: return e.tipo
  }
}

function range(kind, now) {
  const today = businessDay(now)
  if (kind === 'ayer') { const y = shiftDay(today, -1); return { desde: y, hasta: y } }
  if (kind === '7') return { desde: shiftDay(today, -6), hasta: today }
  return { desde: today, hasta: today }
}

function Detail({ id, onToast, onChanged }) {
  const [o, setO] = useState(null)
  const [noting, setNoting] = useState(false)
  const [text, setText] = useState('')
  const [confirmRefund, setConfirmRefund] = useState(false)
  const load = useCallback(() => api.getDetail(id).then((r) => setO(r.order)).catch((e) => onToast({ text: e.message, bad: true })), [id, onToast])
  useEffect(() => { setO(null); setNoting(false); setConfirmRefund(false); load() }, [load])
  if (!o) return <aside className="hp" aria-label="Detalle del pedido"><p className="none">Cargando…</p></aside>

  const canRefund = o.metodoPago === 'mp' && ['aprobado', 'devolucion_pendiente'].includes(o.pago?.estado)
  const saveNote = async () => {
    try { await api.addNote(o.id, text.trim()); setText(''); setNoting(false); onToast({ text: 'Nota guardada.' }); load(); onChanged() } catch (e) { onToast({ text: e.message, bad: true }) }
  }
  const doRefund = async () => {
    try { await api.refund(o.id); onToast({ text: `Devolución de ${formatPrice(o.total)} hecha para ${o.numeroLabel}.` }); load(); onChanged() } catch (e) { onToast({ text: e.message, bad: true }) } finally { setConfirmRefund(false) }
  }

  return (
    <aside className="hp" aria-label="Detalle del pedido">
      <div className="hph"><h3>{o.numeroLabel}</h3><span className={`spill s-${o.estado}`}>{ESTADO[o.estado] ?? o.estado}</span></div>
      <p><b>{o.cliente.nombre}</b><br />{o.cliente.telefono}</p>
      {o.notas?.length > 0 && <div className="issue">{o.notas.map((n) => n.texto).join(' · ')}</div>}
      <div className="hitems">
        {o.items.map((i, n) => <div key={n}><span><b>{i.cantidad}×</b> {i.producto}{itemDetail(i) ? ` (${itemDetail(i)})` : ''}</span><span>{formatPrice(i.subtotal)}</span></div>)}
        <div className="htot"><span>Total</span><span>{formatPrice(o.total)}</span></div>
      </div>
      <p className="payline">{o.metodoPago === 'mp' ? <span className="pill paid">Mercado Pago</span> : <span className="pill cash">Pago en el local</span>}<span>{o.pago?.estado === 'devuelto' ? 'Pago devuelto' : o.pago?.estado === 'devolucion_pendiente' ? 'Devolución pendiente' : o.metodoPago === 'local' ? (o.detallePagoLocal === 'tarjeta' ? 'Tarjeta' : 'Efectivo') : ''}</span></p>
      <ol className="tl" aria-label="Línea de tiempo">
        {(o.eventos ?? []).map((e, n) => <li key={n}><time>{hhmm(e.creadoEn)}</time>{eventLabel(e)}</li>)}
      </ol>
      <div className="hact">
        <button type="button" className="big-btn b-ready" onClick={() => window.print()}>Reimprimir ticket</button>
        {canRefund && !confirmRefund && <button type="button" className="big-btn b-ghost" onClick={() => setConfirmRefund(true)}>Devolver pago</button>}
        {canRefund && confirmRefund && (
          <div className="confirm"><p>¿Devolver el pago completo?</p><div><button type="button" className="big-btn b-ghost" onClick={() => setConfirmRefund(false)}>Volver</button><button type="button" className="big-btn b-ready" onClick={doRefund}>Sí, devolver {formatPrice(o.total)}</button></div></div>
        )}
        {!noting && <button type="button" className="big-btn b-ghost" onClick={() => setNoting(true)}>Agregar nota</button>}
        {noting && (
          <div className="confirm">
            <label className="field" htmlFor="nota"><span>Nota</span><textarea id="nota" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej.: reclamó que faltaba un dip" /></label>
            <div><button type="button" className="big-btn b-ghost" onClick={() => setNoting(false)}>Cancelar</button><button type="button" className="big-btn b-done" disabled={!text.trim()} onClick={saveNote}>Guardar nota</button></div>
          </div>
        )}
      </div>
      <div className="print-ticket" aria-hidden="true">
        <p>FINO · {o.numeroLabel}</p><p>{o.cliente.nombre} · {o.cliente.telefono}</p>
        {o.items.map((i, n) => <p key={n}>{i.cantidad}x {i.producto} {itemDetail(i)} {i.aclaracion ?? ''} {formatPrice(i.subtotal)}</p>)}
        <p>TOTAL {formatPrice(o.total)}</p>
      </div>
    </aside>
  )
}

export function HistoryScreen({ query, now, onToast }) {
  const [estado, setEstado] = useState('')
  const [fecha, setFecha] = useState('hoy')
  const [q, setQ] = useState(query.trim())
  const [data, setData] = useState(null)
  const [sel, setSel] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => { const t = setTimeout(() => setQ(query.trim()), 300); return () => clearTimeout(t) }, [query])

  const fetchPage = useCallback((page) => api.getHistory({ q, estado, ...range(fecha, now), page }), [q, estado, fecha, now])
  // now se usa solo al cambiar filtros; no recargar cada segundo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { let alive = true; fetchPage(1).then((r) => alive && setData(r)).catch((e) => onToast({ text: e.message, bad: true })); return () => { alive = false } }, [q, estado, fecha, tick])

  const more = async () => {
    try { const r = await fetchPage(data.page + 1); setData((d) => ({ ...r, items: [...d.items, ...r.items] })) } catch (e) { onToast({ text: e.message, bad: true }) }
  }

  return (
    <div className="hist">
      <div className="hl">
        <div className="htools">
          <div className="hf">{FILTERS.map(([v, l]) => <button key={l} type="button" aria-pressed={estado === v} onClick={() => setEstado(v)}>{l}</button>)}</div>
          <label className="field" htmlFor="fecha"><span>Fecha</span>
            <select id="fecha" value={fecha} onChange={(e) => setFecha(e.target.value)}><option value="hoy">Hoy</option><option value="ayer">Ayer</option><option value="7">Últimos 7 días</option></select>
          </label>
        </div>
        {data && <p className="hsum"><b>{data.resumen.cantidad}</b> {data.resumen.cantidad === 1 ? 'pedido' : 'pedidos'} · <b>{formatPrice(data.resumen.totalEntregado)}</b> entregado</p>}
        <div className="htable">
          <table aria-label="Pedidos">
            <thead><tr><th>Pedido</th><th>Hora</th><th>Cliente</th><th className="r">Total</th><th>Pago</th><th>Estado</th></tr></thead>
            <tbody>
              {data?.items.length === 0 && <tr><td colSpan={6} className="none">No hay pedidos con ese filtro.</td></tr>}
              {data?.items.map((o) => (
                <tr key={o.id} tabIndex={0} aria-selected={sel === o.id} onClick={() => setSel(o.id)} onKeyDown={(e) => e.key === 'Enter' && setSel(o.id)}>
                  <td className="hid">{o.numeroLabel}</td>
                  <td className="mono">{fecha === 'hoy' ? '' : `${dayFmt.format(new Date(o.creadoEn))} `}{hhmm(o.creadoEn)}</td>
                  <td>{o.cliente.nombre}<small>{o.cliente.telefono}</small></td>
                  <td className="mono r">{formatPrice(o.total)}</td>
                  <td><span className={`pill ${o.metodoPago === 'mp' ? 'paid' : 'cash'}`}>{o.metodoPago === 'mp' ? 'MP' : 'Local'}</span></td>
                  <td><span className={`spill s-${o.estado}`}>{ESTADO[o.estado] ?? o.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.items.length < data.total && <button type="button" className="big-btn b-ghost more" onClick={more}>Cargar más</button>}
      </div>
      {sel ? <Detail id={sel} onToast={onToast} onChanged={() => setTick((n) => n + 1)} /> : <aside className="hp" aria-label="Detalle del pedido"><p className="none">Elegí un pedido de la lista para ver el detalle.</p></aside>}
    </div>
  )
}
