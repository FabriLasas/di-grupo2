import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import * as api from '../api/endpoints.js'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api.me().then((r) => alive && setUser(r.user)).catch(() => alive && setUser(null)).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    login: async (body) => { const r = await api.login(body); setUser(r.user); return r.user },
    register: async (body) => { const r = await api.register(body); setUser(r.user); return r.user },
    logout: async () => { try { await api.logout() } finally { setUser(null) } },
  }), [user, loading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fuera de AuthProvider')
  return v
}

/** Sin sesión, manda a /ingresar y vuelve a la ruta pedida. */
export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <section className="card" aria-busy="true"><div className="skeleton" /></section>
  if (!user) return <Navigate to={`/ingresar?volver=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return children
}
