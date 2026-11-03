import { test, expect, vi, beforeEach } from 'vitest'
import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, USER, ORDER } from './utils.jsx'

const sock = vi.hoisted(() => ({ onUpdate: null, subscribed: [] }))
vi.mock('../src/api/socket.js', () => ({
  connectSocket: () => ({ close() {} }),
  subscribeOrder: (_s, id, cb) => { sock.subscribed.push(id); sock.onUpdate = cb; return () => {} },
}))
beforeEach(() => { sock.onUpdate = null; sock.subscribed = [] })

const ME = { 'GET /api/auth/me': () => [200, { user: USER }] }

test('carga el estado por REST antes del socket', async () => {
  mockApi({ ...ME, 'GET /api/orders/o1': () => [200, { order: { ...ORDER, estado: 'en_cocina', retiroEstimado: '2026-11-04T00:39:00.000Z' } }] })
  renderApp('/pedido/o1')
  expect(await screen.findByRole('heading', { name: '¡Pedido aceptado!' })).toBeInTheDocument()
  expect(screen.getByText('Pasá a retirarlo a las')).toBeInTheDocument()
  expect(screen.getByText('21:39')).toBeInTheDocument()
  expect(sock.subscribed).toEqual(['o1'])
})

test('actualiza al recibir order:updated', async () => {
  mockApi({ ...ME, 'GET /api/orders/o1': () => [200, { order: ORDER }] })
  renderApp('/pedido/o1')
  expect(await screen.findByRole('heading', { name: 'Esperando al local' })).toBeInTheDocument()
  await act(async () => sock.onUpdate({ ...ORDER, estado: 'para_retirar' }))
  expect(screen.getByRole('heading', { name: '¡Tu pedido está listo!' })).toBeInTheDocument()
  expect(screen.getByText('Mostrá este número en el mostrador')).toBeInTheDocument()
  expect(screen.getAllByText('#0427').length).toBeGreaterThan(0)
  expect(screen.getByRole('list', { name: 'Progreso del pedido' }).querySelectorAll('[data-done="true"]')).toHaveLength(3)
})

test('cancelar pide confirmación y llama a la API', async () => {
  const calls = mockApi({ ...ME, 'GET /api/orders/o1': () => [200, { order: ORDER }], 'POST /api/orders/o1/cancel': () => [200, { order: { ...ORDER, estado: 'cancelado' } }] })
  renderApp('/pedido/o1')
  await userEvent.click(await screen.findByRole('button', { name: 'Cancelar pedido' }))
  expect(calls.some((c) => c.path === '/api/orders/o1/cancel')).toBe(false)
  await userEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }))
  expect(await screen.findByRole('heading', { name: 'Pedido cancelado' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).toBeNull()
})

test('pedido rechazado muestra el motivo y la devolución', async () => {
  mockApi({ ...ME, 'GET /api/orders/o1': () => [200, { order: { ...ORDER, estado: 'rechazado', motivoRechazo: 'sin_stock', metodoPago: 'mp', pago: { estado: 'devuelto' } } }] })
  renderApp('/pedido/o1')
  expect(await screen.findByRole('heading', { name: 'No pudimos tomar tu pedido' })).toBeInTheDocument()
  expect(screen.getByText(/se quedaron sin stock/i)).toBeInTheDocument()
  expect(screen.getByText('Te devolvimos el pago a Mercado Pago.')).toBeInTheDocument()
})

test('pago rechazado ofrece volver a intentar con el mismo pedido', async () => {
  mockApi({ ...ME, 'GET /api/orders/o1': () => [200, { order: { ...ORDER, estado: 'cancelado', metodoPago: 'mp', pago: { estado: 'rechazado' } } }] })
  renderApp('/pedido/o1')
  expect(await screen.findByText('El pago no se aprobó.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Volver a intentar' }))
  expect(await screen.findByRole('heading', { name: 'Confirmá tu pedido' })).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('fino.cart.v1'))).toEqual([expect.objectContaining({ productId: 'fino', cantidad: 1, precioUnitario: 14500 })])
})

test('pedido inexistente muestra mensaje', async () => {
  mockApi({ ...ME, 'GET /api/orders/nope': () => [404, { error: { code: 'no_encontrado', message: 'No encontramos ese pedido.' } }] })
  renderApp('/pedido/nope')
  expect(await screen.findByText('No encontramos ese pedido.')).toBeInTheDocument()
})
