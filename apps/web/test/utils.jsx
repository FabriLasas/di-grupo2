import { vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import App from '../src/App.jsx'

export const STORE_OK = { abierto: true, pausado: false, aceptaPedidos: true, demoraMin: 20, horario: {} }
export const MENU = {
  categorias: [
    { id: 'c1', nombre: 'Hamburguesas', productos: [
      { id: 'fino', nombre: 'Fino', descripcion: 'Doble carne, cheddar, pepinillos, cebolla brunoise marcada, salsa fino.', precioBase: 14500, sinTacc: true, agotado: false, variantes: [] },
      { id: 'veggie', nombre: 'Veggie', descripcion: 'Medallón de portobellos', precioBase: 17500, sinTacc: true, agotado: false, variantes: [] },
      { id: 'cheese', nombre: 'Cheeseburger', descripcion: null, precioBase: 9500, sinTacc: true, agotado: false, variantes: [{ id: 'cs', nombre: 'Simple', precio: 9500 }, { id: 'cd', nombre: 'Doble', precio: 13500 }, { id: 'ct', nombre: 'Triple', precio: 16500 }] },
    ] },
    { id: 'c2', nombre: 'Sides', productos: [{ id: 'papas', nombre: 'Papas fritas', descripcion: null, precioBase: 4000, sinTacc: false, agotado: false, variantes: [] }] },
    { id: 'c3', nombre: 'Bebidas', productos: [{ id: 'gaseosa', nombre: 'Gaseosa (línea coca)', descripcion: null, precioBase: 4000, sinTacc: false, agotado: false, variantes: [] }] },
  ],
  extras: [{ id: 'dfino', nombre: 'Dip Fino', precio: 2000 }, { id: 'dlula', nombre: 'Dip Lula', precio: 2000 }, { id: 'dranch', nombre: 'Dip Ranch', precio: 2000 }],
}
export const USER = { id: 'u1', nombre: 'Tomás Rodríguez', email: 'tomas@x.com', telefono: '1154328817', rol: 'cliente' }

/**
 * Reemplaza fetch. routes: { 'GET /api/menu': (body) => [status, json] }.
 * Devuelve la lista de llamadas {method, path, body}.
 */
export function mockApi(routes = {}) {
  const calls = []
  const all = {
    'GET /api/menu': () => [200, MENU],
    'GET /api/store': () => [200, STORE_OK],
    'GET /api/auth/me': () => [401, { error: { code: 'no_autenticado', message: 'Iniciá sesión' } }],
    ...routes,
  }
  global.fetch = vi.fn(async (url, init = {}) => {
    const path = new URL(url, 'http://localhost').pathname
    const method = init.method || 'GET'
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ method, path, body, init })
    const h = all[`${method} ${path}`]
    if (!h) return new Response(JSON.stringify({ error: { code: 'no_encontrado', message: 'sin mock' } }), { status: 404 })
    const [status, json] = h(body, calls)
    return new Response(status === 204 ? null : JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } })
  })
  return calls
}

export function renderApp(path = '/', props = {}) {
  return render(<MemoryRouter initialEntries={[path]}><App {...props} /></MemoryRouter>)
}
