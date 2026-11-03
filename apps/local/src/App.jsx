import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './state/auth.jsx'
import { BoardProvider, useBoard, selectLanes } from './state/board.jsx'
import { systemClock, useNow } from './state/clock.js'
import * as api from './api/endpoints.js'
import { hhmm } from './lib/time.js'
import { createDinger } from './state/alerts.js'
import { LoginScreen } from './screens/LoginScreen.jsx'
import { BoardScreen } from './screens/BoardScreen.jsx'
import { TopBar } from './ui/TopBar.jsx'
import { DetailSheet } from './ui/DetailSheet.jsx'
import { Toast } from './ui/Toast.jsx'
import { CookActions, ReadyActions } from './ui/CardActions.jsx'

const first = (n) => n.split(' ')[0]

const GONE_MSG = { cancelado: 'El cliente canceló este pedido.', en_cocina: 'Otra persona ya aceptó este pedido.', rechazado: 'Otra persona rechazó este pedido.' }

function Live({ clock, dinger, flash }) {
  const { logout } = useAuth()
  const { state, dispatch, reload } = useBoard()
  const now = useNow(clock)
  const [tab, setTab] = useState('live')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const clearToast = useCallback(() => setToast(null), [])

  const all = selectLanes(state, '')
  const pending = all.porAceptar
  const active = pending.length + all.enCocina.length + all.paraRetirar.length
  const idx = pending.findIndex((o) => o.id === openId)
  const lastOpen = useRef(null)
  if (idx >= 0) lastOpen.current = pending[idx]
  const goneState = openId && idx < 0 ? state.gone[openId] : null
  const open = idx >= 0 ? pending[idx] : goneState && lastOpen.current?.id === openId ? lastOpen.current : null
  const warning = goneState ? GONE_MSG[goneState] ?? 'Este pedido cambió de estado.' : null

  // Re-alerta: cada 60 s, si hay pedidos de 5 min o más sin aceptar.
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  useEffect(() => {
    let last = clock.now().getTime()
    return clock.subscribe(() => {
      const t = clock.now().getTime()
      if (t - last < 60000) return
      if (pendingRef.current.some((o) => t - new Date(o.creadoEn).getTime() >= 5 * 60000)) { last = t; dinger.ding() }
    })
  }, [clock, dinger])

  const togglePause = async () => {
    try { dispatch({ type: 'store', store: await api.setPaused(!state.paused) }) } catch (err) { setToast({ text: err.message, bad: true }) }
  }

  /** Después de decidir sobre `id`, abre el siguiente pendiente (o cierra). */
  const goNext = (id) => {
    const rest = pending.filter((o) => o.id !== id)
    const at = Math.min(Math.max(pending.findIndex((o) => o.id === id), 0), rest.length - 1)
    setOpenId(rest.length ? rest[at].id : null)
  }

  const decide = async (o, fn, ok) => {
    setBusy(true)
    try {
      const { order } = await fn()
      dispatch({ type: 'upsert', order })
      setToast({ text: ok(order) })
    } catch (err) {
      if (err.status === 409) { setToast({ text: 'Ya lo tomó otra persona.', bad: true }); reload() }
      else { setToast({ text: err.message, bad: true }); setBusy(false); return }
    }
    setBusy(false)
    goNext(o.id)
  }

  /** Acción simple sobre una tarjeta: llama a la API, actualiza el tablero y avisa. */
  const act = async (fn, ok) => {
    setBusy(true)
    try {
      const { order } = await fn()
      dispatch({ type: 'upsert', order })
      setToast({ text: ok(order) })
    } catch (err) {
      setToast({ text: err.message, bad: true })
      if (err.status === 409) reload()
    } finally {
      setBusy(false)
    }
  }
  const cookActions = (o) => <CookActions order={o} busy={busy} onReady={(x) => act(() => api.ready(x.id), () => `${x.numeroLabel} listo. Le avisamos a ${first(x.cliente.nombre)}.`)} />
  const readyActions = (o) => (
    <ReadyActions order={o} busy={busy}
      onDeliver={(x, cobro) => act(() => api.deliver(x.id, cobro), () => `${x.numeroLabel} entregado.`)}
      onNotPickedUp={(x) => act(() => api.notPickedUp(x.id), () => `${x.numeroLabel} marcado como no retirado.`)} />
  )

  return (
    <div className="app">
      <TopBar tab={tab} onTab={setTab} active={active} query={query} onQuery={setQuery} delayMin={state.demoraMin} paused={state.paused} onTogglePause={togglePause} now={now} onLogout={logout} />
      {state.paused ? <p className="banner paused">Pedidos pausados. La web le avisa a los clientes que Fino no está tomando pedidos por unos minutos.</p> : <div />}
      {!state.online ? <p className="banner offline" role="alert">Sin conexión. Reintentando…</p> : <div />}
      <BoardScreen query={query} now={now} onOpen={setOpenId} cookActions={cookActions} readyActions={readyActions} alertNew={flash} />
      {open && (
        <DetailSheet
          order={open} position={{ index: Math.max(idx, 0), total: Math.max(pending.length, 1) }} demoraMin={state.demoraMin} now={now} busy={busy} warning={warning}
          onPrev={() => idx > 0 && setOpenId(pending[idx - 1].id)} onNext={() => (idx >= 0 ? idx + 1 < pending.length && setOpenId(pending[idx + 1].id) : pending[0] && setOpenId(pending[0].id))} onClose={() => setOpenId(null)}
          onAccept={(o, min) => decide(o, () => api.accept(o.id, min), (r) => `${o.numeroLabel} aceptado. ${first(o.cliente.nombre)} retira a las ${hhmm(r.retiroEstimado)}.`)}
          onReject={(o, motivo) => decide(o, () => api.reject(o.id, motivo), () => `${o.numeroLabel} rechazado.${o.metodoPago === 'mp' ? ' Se devuelve el pago.' : ''}`)}
        />
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  )
}

function Shell({ clock, dinger }) {
  const { user, loading } = useAuth()
  const [flash, setFlash] = useState(0)
  const onNew = useCallback(() => { dinger.ding(); setFlash((n) => n + 1) }, [dinger])
  if (loading) return <main className="login" aria-busy="true" />
  if (!user) return <LoginScreen />
  return <BoardProvider onNew={onNew}><Live clock={clock} dinger={dinger} flash={flash} /></BoardProvider>
}

export default function App({ clock = systemClock, dinger: injected }) {
  const dinger = useMemo(() => injected ?? createDinger(), [injected])
  return <AuthProvider><Shell clock={clock} dinger={dinger} /></AuthProvider>
}
