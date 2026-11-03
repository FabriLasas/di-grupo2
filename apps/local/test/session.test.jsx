import { test, expect } from 'vitest'
import { screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, makeClock, order } from './utils.jsx'

const dinger = { unlocked: true, unlock() {}, ding() {} }

test('si la sesión venció, una acción lleva al login', async () => {
  mockApi({ 'POST /api/staff/orders/o22/ready': () => [401, { error: { code: 'no_autenticado', message: 'Iniciá sesión para continuar.' } }] })
  renderApp('/', { clock: makeClock(), dinger })
  await userEvent.click(within(await screen.findByRole('article', { name: 'Pedido #0422' })).getByRole('button', { name: 'Listo para retirar' }))
  expect(await screen.findByRole('heading', { name: 'Comandas' })).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toBeInTheDocument()
})

test('si el socket rechaza la sesión, lleva al login', async () => {
  mockApi()
  renderApp('/', { clock: makeClock(), dinger })
  await screen.findAllByRole('article')
  act(() => globalThis.__sock.serverEmit('connect_error', new Error('no_autenticado')))
  expect(await screen.findByLabelText('Email')).toBeInTheDocument()
})

test('el resumen del historial usa singular con un pedido', async () => {
  mockApi({ 'GET /api/staff/orders/history': () => [200, { items: [order('h1', 401, { estado: 'entregado' })], total: 1, page: 1, pageSize: 50, resumen: { cantidad: 1, totalEntregado: 14500 } }] })
  renderApp('/', { clock: makeClock(), dinger })
  await userEvent.click(await screen.findByRole('tab', { name: 'Historial' }))
  await screen.findByRole('table', { name: 'Pedidos' })
  await vi_wait(() => expect(document.querySelector('.hsum').textContent).toBe('1 pedido · $14.500 entregado'))
})
async function vi_wait(fn) { const { vi } = await import('vitest'); return vi.waitFor(fn) }
