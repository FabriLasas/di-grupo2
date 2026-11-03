import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { ACTIVE_STATES } from '@fino/shared'
import { getBoard, getStore } from '../api/endpoints.js'
import { connectSocket } from '../api/socket.js'

const INITIAL = { byId: {}, gone: {}, demoraMin: null, paused: false, online: true, loaded: false, error: null, fresh: null }

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
      const gone = { ...state.gone }
      if (ACTIVE_STATES.includes(order.estado)) { byId[order.id] = { ...byId[order.id], ...order }; delete gone[order.id] }
      else { delete byId[order.id]; gone[order.id] = order.estado }
      return { ...state, byId, gone, fresh: action.fresh ? order.id : state.fresh }
    }
    case 'remove': {
      const byId = { ...state.byId }
      delete byId[action.id]
      return { ...state, byId }
    }
    case 'delay': return { ...state, demoraMin: action.demoraMin }
    case 'store': return { ...state, paused: action.store.pausado, demoraMin: action.store.demoraMin ?? state.demoraMin }
    case 'online': return { ...state, online: action.online }
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

/** Carga el tablero y lo mantiene al día con el socket. onNew se llama con cada pedido nuevo. */
export function BoardProvider({ children, onNew }) {
  const [state, dispatch] = useReducer(boardReducer, INITIAL)
  const onNewRef = useRef(onNew)
  onNewRef.current = onNew
  const reload = useCallback(async () => {
    try { dispatch({ type: 'load', ...(await getBoard()) }) } catch (error) { dispatch({ type: 'error', error }) }
  }, [])
  useEffect(() => {
    reload()
    getStore().then((store) => dispatch({ type: 'store', store })).catch(() => {})
    const socket = connectSocket()
    let wasDown = false
    const handlers = {
      'order:new': (order) => { dispatch({ type: 'upsert', order, fresh: true }); onNewRef.current?.(order) },
      'order:updated': (order) => dispatch({ type: 'upsert', order }),
      'store:updated': (store) => dispatch({ type: 'store', store }),
      disconnect: () => { wasDown = true; dispatch({ type: 'online', online: false }) },
      connect_error: (err) => { if (err?.message === 'no_autenticado') window.dispatchEvent(new Event('fino:unauthorized')) },
      connect: () => { dispatch({ type: 'online', online: true }); if (wasDown) { wasDown = false; reload() } },
    }
    for (const [ev, fn] of Object.entries(handlers)) socket.on(ev, fn)
    return () => { for (const [ev, fn] of Object.entries(handlers)) socket.off(ev, fn); socket.close() }
  }, [reload])
  const value = useMemo(() => ({ state, dispatch, reload }), [state, reload])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useBoard() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useBoard fuera de BoardProvider')
  return v
}
