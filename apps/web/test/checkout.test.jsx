import { test, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, USER, STORE_OK, ORDER, FINO_LINE, VEGGIE_LINE, seedCart } from './utils.jsx'

vi.mock('../src/api/socket.js', () => ({ connectSocket: () => ({ close() {} }), subscribeOrder: () => () => {} }))

const ME = { 'GET /api/auth/me': () => [200, { user: USER }] }

test('pago en el local en efectivo manda el body correcto y va al seguimiento', async () => {
  seedCart([{ ...FINO_LINE, aclaracion: 'Sin pepinillos', extras: ['dlula'], extrasNombres: ['Dip Lula'], precioUnitario: 16500 }])
  const calls = mockApi({ ...ME, 'POST /api/orders': () => [201, { order: { ...ORDER, total: 16500 } }], 'GET /api/orders/o1': () => [200, { order: ORDER }] })
  renderApp('/checkout')
  await userEvent.click(await screen.findByRole('radio', { name: /Pagar al retirar/ }))
  await userEvent.click(screen.getByRole('radio', { name: 'Efectivo' }))
  await userEvent.type(screen.getByLabelText('¿Con cuánto pagás?'), '20000')
  expect(screen.getByText('Tu vuelto: $3.500')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Nota para el local'), 'Paso en moto')
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido · $16.500' }))
  const post = calls.find((c) => c.method === 'POST' && c.path === '/api/orders')
  expect(post.body).toEqual({
    items: [{ productId: 'fino', cantidad: 1, aclaracion: 'Sin pepinillos', sinTacc: false, extras: ['dlula'] }],
    metodoPago: 'local', detallePagoLocal: 'efectivo', pagaCon: 20000, nota: 'Paso en moto', totalEsperado: 16500,
  })
  expect(await screen.findByText(/Pedido #0427/)).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('fino.cart.v1'))).toEqual([])
})

test('pago con MP redirige al initPoint', async () => {
  seedCart([FINO_LINE])
  const redirect = vi.fn()
  mockApi({ ...ME, 'POST /api/orders': () => [201, { order: { ...ORDER, estado: 'pendiente_pago', metodoPago: 'mp' }, initPoint: 'https://mp.test/checkout/o1' }] })
  renderApp('/checkout', { redirect })
  await userEvent.click(await screen.findByRole('button', { name: 'Confirmar pedido · $14.500' }))
  await vi.waitFor(() => expect(redirect).toHaveBeenCalledWith('https://mp.test/checkout/o1'))
})

test('productos agotados se marcan y bloquean confirmar hasta quitarlos', async () => {
  seedCart([FINO_LINE, VEGGIE_LINE])
  mockApi({ ...ME, 'POST /api/orders': () => [422, { error: { code: 'productos_no_disponibles', message: 'x', details: { productos: ['veggie'] } } }] })
  renderApp('/checkout')
  await userEvent.click(await screen.findByRole('button', { name: /Confirmar pedido/ }))
  expect(await screen.findByText('Ya no está disponible')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Algunos productos se agotaron. Quitalos para seguir.')
  expect(screen.getByRole('button', { name: /Confirmar pedido/ })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Quitar' }))
  expect(screen.getByRole('button', { name: 'Confirmar pedido · $14.500' })).toBeEnabled()
})

test('total cambiado pide reconfirmar y reenvía con el total nuevo', async () => {
  seedCart([FINO_LINE])
  let n = 0
  const calls = mockApi({ ...ME,
    'POST /api/orders': () => (++n === 1 ? [409, { error: { code: 'total_cambio', message: 'x', details: { total: 15000 } } }] : [201, { order: { ...ORDER, total: 15000 } }]),
    'GET /api/orders/o1': () => [200, { order: ORDER }] })
  renderApp('/checkout')
  await userEvent.click(await screen.findByRole('button', { name: /Confirmar pedido/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Los precios cambiaron. El total ahora es $15.000.')
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar con el nuevo total · $15.000' }))
  const posts = calls.filter((c) => c.method === 'POST' && c.path === '/api/orders')
  expect(posts.map((p) => p.body.totalEsperado)).toEqual([14500, 15000])
})

test('local pausado deshabilita confirmar y muestra el aviso', async () => {
  seedCart([FINO_LINE])
  mockApi({ ...ME, 'GET /api/store': () => [200, { ...STORE_OK, pausado: true, aceptaPedidos: false }] })
  renderApp('/checkout')
  expect(await screen.findByText(/no está tomando pedidos/)).toHaveAttribute('role', 'status')
  expect(screen.getByRole('button', { name: /Confirmar pedido/ })).toBeDisabled()
})

test('local cerró durante la compra: muestra el mensaje de la API', async () => {
  seedCart([FINO_LINE])
  mockApi({ ...ME, 'POST /api/orders': () => [409, { error: { code: 'local_no_disponible', message: 'Fino no está tomando pedidos en este momento.' } }] })
  renderApp('/checkout')
  await userEvent.click(await screen.findByRole('button', { name: /Confirmar pedido/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Fino no está tomando pedidos en este momento.')
})

test('carrito vacío en checkout ofrece volver al menú', async () => {
  mockApi(ME)
  renderApp('/checkout')
  expect(await screen.findByRole('link', { name: 'Ver el menú' })).toBeInTheDocument()
})
