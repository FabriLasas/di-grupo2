import { useState } from 'react'
import { AuthProvider, useAuth } from './state/auth.jsx'
import { BoardProvider, useBoard, selectLanes } from './state/board.jsx'
import { systemClock, useNow } from './state/clock.js'
import { LoginScreen } from './screens/LoginScreen.jsx'
import { BoardScreen } from './screens/BoardScreen.jsx'
import { TopBar } from './ui/TopBar.jsx'

function Live({ clock }) {
  const { logout } = useAuth()
  const { state } = useBoard()
  const now = useNow(clock)
  const [tab, setTab] = useState('live')
  const [query, setQuery] = useState('')
  const all = selectLanes(state, '')
  const active = all.porAceptar.length + all.enCocina.length + all.paraRetirar.length
  return (
    <div className="app">
      <TopBar tab={tab} onTab={setTab} active={active} query={query} onQuery={setQuery} delayMin={state.demoraMin} paused={false} onTogglePause={() => {}} now={now} onLogout={logout} />
      <div />
      <div />
      <BoardScreen query={query} now={now} />
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
