import { test, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, makeClock, order } from './utils.jsx'

const delivered = order('h11', 411, { estado: 'entregado', cliente: { nombre: 'Ignacio Ferreyra', telefono: '1130529930' }, total: 61500, creadoEn: '2026-11-03T23:10:00.000Z' })
const rejected = order('h15', 415, { estado: 'rechazado', cliente: { nombre: 'Santino Rey', telefono: '1155871290' }, total: 22500, creadoEn: '2026-11-03T23:44:00.000Z', motivoRechazo: 'sin_stock', pago: { estado: 'devuelto', mpPaymentId: '1' } })
const page = (items, extra = {}) => ({ items, total: items.length, page: 1, pageSize: 50, resumen: { cantidad: items.length, totalEntregado: 61500 }, ...extra })
const detail = {
  ...delivered,
  eventos: [
    { tipo: 'creado', actor: 'Ignacio Ferreyra', detalle: null, creadoEn: '2026-11-03T23:10:00.000Z' },
    { tipo: 'pago_aprobado', actor: null, detalle: null, creadoEn: '2026-11-03T23:10:30.000Z' },
    { tipo: 'aceptar', actor: 'Fabri', detalle: { minutos: 25 }, creadoEn: '2026-11-03T23:11:00.000Z' },
    { tipo: 'listo', actor: 'Fabri', detalle: null, creadoEn: '2026-11-03T23:33:00.000Z' },
    { tipo: 'entregar', actor: 'Agus', detalle: { cobroConfirmado: false }, creadoEn: '2026-11-03T23:38:00.000Z' },
    { tipo: 'nota', actor: 'Fabri', detalle: { texto: 'Faltaba un dip Ranch' }, creadoEn: '2026-11-03T23:41:00.000Z' },
  ],
  notas: [{ texto: 'Faltaba un dip Ranch', autor: 'Fabri', creadoEn: '2026-11-03T23:41:00.000Z' }],
}
const ROUTES = {
  'GET /api/staff/orders/history': () => [200, page([rejected, delivered])],
  'GET /api/staff/orders/h11': () => [200, { order: detail }],
  'GET /api/staff/orders/h15': () => [200, { order: { ...rejected, eventos: [], notas: [] } }],
}
const toHistory = async () => { await userEvent.click(await screen.findByRole('tab', { name: 'Historial' })) }

test('lista el historial de hoy con resumen', async () => {
  const calls = mockApi(ROUTES)
  renderApp('/', { clock: makeClock() })
  await toHistory()
  const table = await screen.findByRole('table', { name: 'Pedidos' })
  expect(within(table).getAllByRole('row')).toHaveLength(3)
  expect(within(table).getByText('Ignacio Ferreyra')).toBeInTheDocument()
  expect(within(table).getByText('Rechazado')).toBeInTheDocument()
  expect(document.querySelector('.hsum').textContent).toBe('2 pedidos · $61.500 entregado')
  expect(calls.find((c) => c.path === '/api/staff/orders/history').query).toEqual({ desde: '2026-11-03', hasta: '2026-11-03', page: '1' })
})

test('buscar manda q recortado y filtra por estado y fecha', async () => {
  const calls = mockApi(ROUTES)
  renderApp('/', { clock: makeClock() })
  await toHistory()
  await screen.findByRole('table', { name: 'Pedidos' })
  await userEvent.type(screen.getByLabelText('Buscar pedido'), '  #0411 ')
  await vi.waitFor(() => expect(calls.at(-1).query.q).toBe('#0411'), { timeout: 2000 })
  await userEvent.click(screen.getByRole('button', { name: 'Rechazados' }))
  await vi.waitFor(() => expect(calls.at(-1).query).toMatchObject({ estado: 'rechazado', q: '#0411' }))
  await userEvent.selectOptions(screen.getByLabelText('Fecha'), 'Últimos 7 días')
  await vi.waitFor(() => expect(calls.at(-1).query).toMatchObject({ desde: '2026-10-28', hasta: '2026-11-03' }))
})

test('detalle muestra la línea de tiempo legible y las notas', async () => {
  mockApi(ROUTES)
  renderApp('/', { clock: makeClock() })
  await toHistory()
  await userEvent.click(within(await screen.findByRole('table', { name: 'Pedidos' })).getByText('Ignacio Ferreyra'))
  const panel = await screen.findByRole('complementary', { name: 'Detalle del pedido' })
  const tl = within(panel).getByRole('list', { name: 'Línea de tiempo' })
  expect(within(tl).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    '20:10Ingresó', '20:10Pago aprobado', '20:11Aceptado por Fabri · retiro en 25 min', '20:33Listo', '20:38Entregado por Agus', '20:41Nota de Fabri: Faltaba un dip Ranch',
  ])
})

test('agregar nota la guarda y aparece', async () => {
  const calls = mockApi({ ...ROUTES, 'POST /api/staff/orders/h11/notes': () => [201, { note: {} }] })
  renderApp('/', { clock: makeClock() })
  await toHistory()
  await userEvent.click(within(await screen.findByRole('table', { name: 'Pedidos' })).getByText('Ignacio Ferreyra'))
  const panel = await screen.findByRole('complementary', { name: 'Detalle del pedido' })
  await userEvent.click(within(panel).getByRole('button', { name: 'Agregar nota' }))
  await userEvent.type(within(panel).getByLabelText('Nota'), 'Llamó para reclamar')
  await userEvent.click(within(panel).getByRole('button', { name: 'Guardar nota' }))
  expect(calls.find((c) => c.path.endsWith('/notes')).body).toEqual({ texto: 'Llamó para reclamar' })
  await vi.waitFor(() => expect(calls.filter((c) => c.path === '/api/staff/orders/h11')).toHaveLength(2))
})

test('devolver pago pide confirmación', async () => {
  const calls = mockApi({ ...ROUTES, 'POST /api/staff/orders/h11/refund': () => [200, { order: { ...delivered, pago: { estado: 'devuelto' } } }] })
  renderApp('/', { clock: makeClock() })
  await toHistory()
  await userEvent.click(within(await screen.findByRole('table', { name: 'Pedidos' })).getByText('Ignacio Ferreyra'))
  const panel = await screen.findByRole('complementary', { name: 'Detalle del pedido' })
  await userEvent.click(within(panel).getByRole('button', { name: 'Devolver pago' }))
  expect(calls.some((c) => c.path.endsWith('/refund'))).toBe(false)
  await userEvent.click(within(panel).getByRole('button', { name: 'Sí, devolver $61.500' }))
  expect(calls.some((c) => c.path.endsWith('/refund'))).toBe(true)
  expect(await screen.findByRole('status')).toHaveTextContent('Devolución de $61.500 hecha para #0411.')
})

test('reimprimir abre la impresión', async () => {
  mockApi(ROUTES)
  window.print = vi.fn()
  renderApp('/', { clock: makeClock() })
  await toHistory()
  await userEvent.click(within(await screen.findByRole('table', { name: 'Pedidos' })).getByText('Ignacio Ferreyra'))
  await userEvent.click(await screen.findByRole('button', { name: 'Reimprimir ticket' }))
  expect(window.print).toHaveBeenCalled()
})

test('cargar más pide la página 2 y suma filas', async () => {
  const calls = mockApi({ ...ROUTES, 'GET /api/staff/orders/history': (_b, _c, u) => [200, u.searchParams.get('page') === '2' ? page([order('h01', 401, { estado: 'entregado' })], { total: 3, page: 2 }) : page([rejected, delivered], { total: 3 })] })
  renderApp('/', { clock: makeClock() })
  await toHistory()
  await userEvent.click(await screen.findByRole('button', { name: 'Cargar más' }))
  await vi.waitFor(() => expect(within(screen.getByRole('table', { name: 'Pedidos' })).getAllByRole('row')).toHaveLength(4))
  expect(calls.at(-1).query.page).toBe('2')
  expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull()
})
