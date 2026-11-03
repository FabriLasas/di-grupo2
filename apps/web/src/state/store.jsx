import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getMenu, getStore } from '../api/endpoints.js'

const Ctx = createContext(null)

/** Menú y estado del local, cargados una vez y recargables. */
export function StoreProvider({ children }) {
  const [state, setState] = useState({ menu: null, store: null, loading: true, error: null })

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const [menu, store] = await Promise.all([getMenu(), getStore()])
      setState({ menu, store, loading: false, error: null })
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }))
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const value = useMemo(() => {
    const byId = new Map()
    for (const c of state.menu?.categorias ?? []) for (const p of c.productos) byId.set(p.id, { ...p, categoria: c.nombre })
    return { ...state, reload, setStore: (store) => setState((s) => ({ ...s, store })), productById: (id) => byId.get(id) ?? null }
  }, [state, reload])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore fuera de StoreProvider')
  return v
}

/** Texto del aviso cuando el local no toma pedidos. */
export function closedMessage(store) {
  if (!store || store.aceptaPedidos) return null
  if (store.abierto && store.pausado) return 'Fino no está tomando pedidos ahora. Probá de nuevo en unos minutos.'
  const days = Object.values(store.horario ?? {})
  const first = JSON.stringify(days[0])
  if (days.length === 7 && days.every((d) => JSON.stringify(d) === first) && days[0]?.length === 1) {
    const [[a, b]] = days[0]
    return `Fino está cerrado ahora. Abrimos todos los días de ${a} a ${b}.`
  }
  return 'Fino está cerrado ahora. Podés mirar el menú y pedir cuando abramos.'
}
