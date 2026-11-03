import { apiFetch } from './client.js'

export const getMenu = () => apiFetch('/api/menu')
export const getStore = () => apiFetch('/api/store')
export const me = () => apiFetch('/api/auth/me')
export const login = (body) => apiFetch('/api/auth/login', { method: 'POST', body })
export const register = (body) => apiFetch('/api/auth/register', { method: 'POST', body })
export const logout = () => apiFetch('/api/auth/logout', { method: 'POST' })
export const createOrder = (body) => apiFetch('/api/orders', { method: 'POST', body })
export const getOrder = (id) => apiFetch(`/api/orders/${encodeURIComponent(id)}`)
export const myOrders = () => apiFetch('/api/orders/mine')
export const cancelOrder = (id) => apiFetch(`/api/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
