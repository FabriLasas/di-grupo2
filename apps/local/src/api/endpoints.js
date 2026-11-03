import { apiFetch } from './client.js'

const id = (x) => encodeURIComponent(x)
export const me = () => apiFetch('/api/auth/me')
export const login = (body) => apiFetch('/api/auth/login', { method: 'POST', body })
export const logout = () => apiFetch('/api/auth/logout', { method: 'POST' })
export const getBoard = () => apiFetch('/api/staff/orders')
export const getStore = () => apiFetch('/api/store')
export const setPaused = (pausado) => apiFetch('/api/staff/store', { method: 'PATCH', body: { pausado } })
export const accept = (oid, minutos) => apiFetch(`/api/staff/orders/${id(oid)}/accept`, { method: 'POST', body: { minutos } })
export const reject = (oid, motivo) => apiFetch(`/api/staff/orders/${id(oid)}/reject`, { method: 'POST', body: { motivo } })
export const ready = (oid) => apiFetch(`/api/staff/orders/${id(oid)}/ready`, { method: 'POST' })
export const deliver = (oid, cobroConfirmado) => apiFetch(`/api/staff/orders/${id(oid)}/deliver`, { method: 'POST', body: { cobroConfirmado } })
export const notPickedUp = (oid) => apiFetch(`/api/staff/orders/${id(oid)}/not-picked-up`, { method: 'POST' })
export const refund = (oid) => apiFetch(`/api/staff/orders/${id(oid)}/refund`, { method: 'POST' })
export const addNote = (oid, texto) => apiFetch(`/api/staff/orders/${id(oid)}/notes`, { method: 'POST', body: { texto } })
export const getDetail = (oid) => apiFetch(`/api/staff/orders/${id(oid)}`)
export function getHistory(params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  return apiFetch(`/api/staff/orders/history?${qs}`)
}
