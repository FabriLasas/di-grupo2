import { useState } from 'react'
import { AuthProvider, useAuth } from './state/auth.jsx'
import { LoginScreen } from './screens/LoginScreen.jsx'
import { BoardScreen } from './screens/BoardScreen.jsx'
import { TopBar } from './ui/TopBar.jsx'

function Shell() {
  const { user, loading, logout } = useAuth()
  const [tab, setTab] = useState('live')
  const [query, setQuery] = useState('')
  if (loading) return <main className="login" aria-busy="true" />
  if (!user) return <LoginScreen />
  return (
    <div className="app">
      <TopBar tab={tab} onTab={setTab} query={query} onQuery={setQuery} now={new Date()} onLogout={logout} />
      <BoardScreen />
    </div>
  )
}

export default function App() {
  return <AuthProvider><Shell /></AuthProvider>
}
