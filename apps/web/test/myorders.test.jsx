import { test, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, USER, ORDER, MENU } from './utils.jsx'

vi.mock('../src/api/socket.js', () => ({ connectSocket: () => ({ close() {} }), subscribeOrder: () => () => {} }))
const ME = { 'GET /api/auth/me': () => [200, { user: USER }] }

const delivered = { ...ORDER, estado: 'entregado', total: 31500, items: [
  { ...ORDER.items[0] },
  { cantidad: 1, producto: 'Veggie', variante: null, aclaracion: null, sinTacc: true, extras: [], precioUnitario: 17500, subtotal: 17500, productId: 'veggie', variantId: null, extraIds: [] },
] }

test('lista pedidos y lleva al seguimiento', async () => {
  mockApi({ ...ME, 'GET /api/orders/mine': () => [200, { orders: [delivered] }], 'GET /api/orders/o1': () => [200, { order: delivered }] })
  renderApp('/mis-pedidos')
  const item = await screen.findByRole('article', { name: 'Pedido #0427' })
  expect(within(item).getByText('Entregado')).toBeInTheDocument()
  expect(within(item).getByText('$31.500')).toBeInTheDocument()
  await userEvent.click(within(item).getByRole('link', { name: 'Ver detalle' }))
  expect(await screen.findByRole('heading', { name: '¡Que lo disfrutes!' })).toBeInTheDocument()
})

test('repetir agrega los productos disponibles y avisa los que faltan', async () => {
  const menu = structuredClone(MENU)
  menu.categorias[0].productos[1].agotado = true
  mockApi({ ...ME, 'GET /api/menu': () => [200, menu], 'GET /api/orders/mine': () => [200, { orders: [delivered] }] })
  renderApp('/mis-pedidos')
  await userEvent.click(await screen.findByRole('button', { name: 'Repetir' }))
  expect(await screen.findByRole('heading', { name: 'Tu pedido' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('1 producto no está disponible y no se agregó.')
  const saved = JSON.parse(localStorage.getItem('fino.cart.v1'))
  expect(saved).toEqual([expect.objectContaining({ productId: 'fino', precioUnitario: 14500 })])
})

test('sin pedidos muestra estado vacío', async () => {
  mockApi({ ...ME, 'GET /api/orders/mine': () => [200, { orders: [] }] })
  renderApp('/mis-pedidos')
  expect(await screen.findByText('Todavía no hiciste pedidos.')).toBeInTheDocument()
})
