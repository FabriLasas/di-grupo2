import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { ACTIVE_STATES } from '@fino/shared'
import { getBoard } from '../api/endpoints.js'

const INITIAL = { byId: {}, demoraMin: null, loaded: false, error: null }

export function boardReducer(state = INITIAL, action) {
  switch (action.type) {
    case 'load': {
      const byId = {}
      for (const o of [...action.porAceptar, ...action.enCocina, ...action.paraRetirar]) byId[o.id] = o
      return { ...state, byId, demoraMin: action.demoraMin, loaded: true, error: null }
    }
    case 'upsert': {
      const { order } = action
      const byId = { ...state.byId }
      if (ACTIVE_STATES.includes(order.estado)) byId[order.id] = { ...byId[order.id], ...order }
      else delete byId[order.id]
      return { ...state, byId }
    }
    case 'remove': {
      const byId = { ...state.byId }
      delete byId[action.id]
      return { ...state, byId }
    }
    case 'delay': return { ...state, demoraMin: action.demoraMin }
    case 'error': return { ...state, error: action.error }
    default: return state
  }
}

const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/** ¿El pedido coincide con la búsqueda? Número con o sin #, nombre o teléfono. */
export function matches(o, query) {
  const q = norm(query).replace(/^#/, '')
  if (!q) return true
  const digits = q.replace(/\D/g, '')
  return String(o.numero).padStart(4, '0').includes(q) || String(o.numero) === q || norm(o.cliente.nombre).includes(q) || (digits.length >= 3 && o.cliente.telefono.includes(digits))
}

const t = (iso) => (iso ? new Date(iso).getTime() : 0)

export function selectLanes(state, query = '') {
  const all = Object.values(state.byId).filter((o) => matches(o, query))
  return {
    porAceptar: all.filter((o) => o.estado === 'por_aceptar').sort((a, b) => t(a.creadoEn) - t(b.creadoEn)),
    enCocina: all.filter((o) => o.estado === 'en_cocina').sort((a, b) => t(a.retiroEstimado) - t(b.retiroEstimado)),
    paraRetirar: all.filter((o) => o.estado === 'para_retirar').sort((a, b) => t(a.listoEn) - t(b.listoEn)),
  }
}

const Ctx = createContext(null)

export function BoardProvider({ children }) {
  const [state, dispatch] = useReducer(boardReducer, INITIAL)
  const reload = useCallback(async () => {
    try { dispatch({ type: 'load', ...(await getBoard()) }) } catch (error) { dispatch({ type: 'error', error }) }
  }, [])
  useEffect(() => { reload() }, [reload])
  const value = useMemo(() => ({ state, dispatch, reload }), [state, reload])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useBoard() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useBoard fuera de BoardProvider')
  return v
}
