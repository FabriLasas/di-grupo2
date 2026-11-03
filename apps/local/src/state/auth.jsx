import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '../api/endpoints.js'
import { ApiError } from '../api/client.js'

const Ctx = createContext(null)
const isStaff = (u) => u && (u.rol === 'staff' || u.rol === 'admin')

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.me().then((r) => setUser(isStaff(r.user) ? r.user : null)).catch(() => setUser(null)).finally(() => setLoading(false))
    const out = () => setUser(null)
    window.addEventListener('fino:unauthorized', out)
    return () => window.removeEventListener('fino:unauthorized', out)
  }, [])
  const value = useMemo(() => ({
    user,
    loading,
    login: async (body) => {
      const { user: u } = await api.login(body)
      if (!isStaff(u)) {
        await api.logout().catch(() => {})
        throw new ApiError(403, 'no_es_local', 'Esta cuenta no es del local.')
      }
      setUser(u)
      return u
    },
    logout: async () => { try { await api.logout() } finally { setUser(null) } },
  }), [user, loading])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fuera de AuthProvider')
  return v
}
