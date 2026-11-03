import { useCallback, useState } from 'react'
import { AuthProvider, useAuth } from './state/auth.jsx'
import { BoardProvider, useBoard, selectLanes } from './state/board.jsx'
import { systemClock, useNow } from './state/clock.js'
import * as api from './api/endpoints.js'
import { hhmm } from './lib/time.js'
import { LoginScreen } from './screens/LoginScreen.jsx'
import { BoardScreen } from './screens/BoardScreen.jsx'
import { TopBar } from './ui/TopBar.jsx'
import { DetailSheet } from './ui/DetailSheet.jsx'
import { Toast } from './ui/Toast.jsx'

const first = (n) => n.split(' ')[0]

function Live({ clock }) {
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
  const open = idx >= 0 ? pending[idx] : null

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

  return (
    <div className="app">
      <TopBar tab={tab} onTab={setTab} active={active} query={query} onQuery={setQuery} delayMin={state.demoraMin} paused={false} onTogglePause={() => {}} now={now} onLogout={logout} />
      <div />
      <div />
      <BoardScreen query={query} now={now} onOpen={setOpenId} />
      {open && (
        <DetailSheet
          order={open} position={{ index: idx, total: pending.length }} demoraMin={state.demoraMin} now={now} busy={busy}
          onPrev={() => setOpenId(pending[idx - 1].id)} onNext={() => setOpenId(pending[idx + 1].id)} onClose={() => setOpenId(null)}
          onAccept={(o, min) => decide(o, () => api.accept(o.id, min), (r) => `${o.numeroLabel} aceptado. ${first(o.cliente.nombre)} retira a las ${hhmm(r.retiroEstimado)}.`)}
          onReject={(o, motivo) => decide(o, () => api.reject(o.id, motivo), () => `${o.numeroLabel} rechazado.${o.metodoPago === 'mp' ? ' Se devuelve el pago.' : ''}`)}
        />
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  )
}

function Shell({ clock }) {
  const { user, loading } = useAuth()
  if (loading) return <main className="login" aria-busy="true" />
  if (!user) return <LoginScreen />
  return <BoardProvider><Live clock={clock} /></BoardProvider>
}

export default function App({ clock = systemClock }) {
  return <AuthProvider><Shell clock={clock} /></AuthProvider>
}
