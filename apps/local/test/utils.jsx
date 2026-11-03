import { vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import App from '../src/App.jsx'

export const STAFF = { id: 's1', nombre: 'Fabri', email: 'staff@fino.test', telefono: '1100000001', rol: 'staff' }
export const NOW = new Date('2026-11-04T00:14:00.000Z') // 21:14 en Buenos Aires
const min = (m) => new Date(NOW.getTime() + m * 60000).toISOString()

const item = (cantidad, producto, extra = {}) => ({ cantidad, producto, variante: null, aclaracion: null, sinTacc: false, extras: [], precioUnitario: 14500, subtotal: 14500 * cantidad, productId: 'p', variantId: null, extraIds: [], ...extra })
export function order(id, numero, over = {}) {
  return {
    id, numero, numeroLabel: '#' + String(numero).padStart(4, '0'), estado: 'por_aceptar',
    cliente: { nombre: 'Tomás Rodríguez', telefono: '1154328817' }, metodoPago: 'mp', detallePagoLocal: null, pagaCon: null, vuelto: null,
    total: 14500, nota: null, minutosRetiro: null, retiroEstimado: null, motivoRechazo: null, creadoEn: min(-1), aceptadoEn: null, listoEn: null, entregadoEn: null,
    items: [item(1, 'Fino')], pago: { estado: 'aprobado', mpPaymentId: '89231457760' }, ...over,
  }
}
export function board() {
  return {
    porAceptar: [
      order('o27', 427, { creadoEn: min(-4), cliente: { nombre: 'Tomás Rodríguez', telefono: '1154328817' }, nota: 'Somos 3, separen la sin pepinillos', total: 63500, sugeridoMin: 25,
        items: [item(2, 'Fino', { aclaracion: '1 sin pepinillos' }), item(1, 'Cheesebacon', { variante: 'Doble' }), item(2, 'Dip', { extras: [] })] }),
      order('o28', 428, { creadoEn: min(-2), cliente: { nombre: 'Camila Vázquez', telefono: '1161203349' }, metodoPago: 'local', detallePagoLocal: 'efectivo', pagaCon: 40000, vuelto: 1500, total: 38500, pago: null, sugeridoMin: 20 }),
    ],
    enCocina: [
      order('o23', 423, { estado: 'en_cocina', cliente: { nombre: 'Joaquín Pereyra', telefono: '1140217765' }, retiroEstimado: min(3), aceptadoEn: min(-17), minutosRetiro: 20 }),
      order('o22', 422, { estado: 'en_cocina', cliente: { nombre: 'Martina Gómez', telefono: '1133981204' }, retiroEstimado: min(-2), aceptadoEn: min(-22), minutosRetiro: 20,
        items: [item(2, 'Cheeseburger', { variante: 'Simple', aclaracion: '1 sin pepinillos', extras: ['Dip Lula'], sinTacc: true })], nota: 'Retira el hermano' }),
    ],
    paraRetirar: [
      order('o19', 419, { estado: 'para_retirar', cliente: { nombre: 'Lucía Martínez', telefono: '1169341187' }, metodoPago: 'local', detallePagoLocal: 'efectivo', total: 28000, pago: null, listoEn: min(-6) }),
      order('o20', 420, { estado: 'para_retirar', cliente: { nombre: 'Nicolás Fernández', telefono: '1130527718' }, listoEn: min(-1) }),
    ],
    demoraMin: 20,
  }
}

export function mockApi(routes = {}) {
  const calls = []
  const all = {
    'GET /api/auth/me': () => [200, { user: STAFF }],
    'GET /api/staff/orders': () => [200, board()],
    'GET /api/store': () => [200, { abierto: true, pausado: false, aceptaPedidos: true, demoraMin: 20, horario: {} }],
    ...routes,
  }
  global.fetch = vi.fn(async (url, init = {}) => {
    const u = new URL(url, 'http://localhost')
    const method = init.method || 'GET'
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ method, path: u.pathname, query: Object.fromEntries(u.searchParams), body })
    const h = all[`${method} ${u.pathname}`]
    if (!h) return new Response(JSON.stringify({ error: { code: 'no_encontrado', message: 'sin mock' } }), { status: 404 })
    const [status, json] = h(body, calls, u)
    return new Response(status === 204 ? null : JSON.stringify(json), { status })
  })
  return calls
}

export const renderApp = (path = '/', props = {}) => render(<MemoryRouter initialEntries={[path]}><App {...props} /></MemoryRouter>)
