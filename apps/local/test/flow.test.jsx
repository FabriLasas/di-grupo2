import { test, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, makeClock, board, NOW } from './utils.jsx'

const lane = (name) => screen.getByRole('region', { name })
const card = (num) => screen.findByRole('article', { name: `Pedido ${num}` })

test('listo mueve la tarjeta a Para retirar', async () => {
  const b = board()
  const calls = mockApi({ 'POST /api/staff/orders/o22/ready': () => [200, { order: { ...b.enCocina[1], estado: 'para_retirar', listoEn: NOW.toISOString() } }] })
  renderApp('/', { clock: makeClock() })
  await userEvent.click(within(await card('#0422')).getByRole('button', { name: 'Listo para retirar' }))
  expect(calls.some((c) => c.method === 'POST' && c.path === '/api/staff/orders/o22/ready')).toBe(true)
  expect(await within(lane('Para retirar')).findByRole('article', { name: 'Pedido #0422' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('#0422 listo. Le avisamos a Martina.')
})

test('entregar efectivo pide confirmar el cobro', async () => {
  const b = board()
  const calls = mockApi({ 'POST /api/staff/orders/o19/deliver': () => [200, { order: { ...b.paraRetirar[0], estado: 'entregado' } }] })
  renderApp('/', { clock: makeClock() })
  const c = await card('#0419')
  await userEvent.click(within(c).getByRole('button', { name: 'Entregar' }))
  expect(calls.some((x) => x.path.endsWith('/deliver'))).toBe(false)
  expect(within(c).getByText(/¿Cobraste/)).toHaveTextContent('¿Cobraste $28.000?')
  await userEvent.click(within(c).getByRole('button', { name: 'Volver' }))
  await userEvent.click(within(c).getByRole('button', { name: 'Entregar' }))
  await userEvent.click(within(c).getByRole('button', { name: 'Sí, entregar' }))
  expect(calls.find((x) => x.path.endsWith('/deliver')).body).toEqual({ cobroConfirmado: true })
  await screen.findByText('#0419 entregado.')
  expect(screen.queryByRole('article', { name: 'Pedido #0419' })).toBeNull()
})

test('entregar pagado online no pide confirmación', async () => {
  const b = board()
  const calls = mockApi({ 'POST /api/staff/orders/o20/deliver': () => [200, { order: { ...b.paraRetirar[1], estado: 'entregado' } }] })
  renderApp('/', { clock: makeClock() })
  await userEvent.click(within(await card('#0420')).getByRole('button', { name: 'Entregar' }))
  expect(calls.find((x) => x.path.endsWith('/deliver')).body).toEqual({ cobroConfirmado: false })
})

test('no lo retiró pide confirmación', async () => {
  const b = board()
  const calls = mockApi({ 'POST /api/staff/orders/o20/not-picked-up': () => [200, { order: { ...b.paraRetirar[1], estado: 'no_retirado' } }] })
  renderApp('/', { clock: makeClock() })
  const c = await card('#0420')
  await userEvent.click(within(c).getByRole('button', { name: 'No lo retiró' }))
  expect(calls.some((x) => x.path.endsWith('/not-picked-up'))).toBe(false)
  await userEvent.click(within(c).getByRole('button', { name: 'Sí, no lo retiró' }))
  expect(calls.some((x) => x.path.endsWith('/not-picked-up'))).toBe(true)
  await screen.findByText('#0420 marcado como no retirado.')
})

test('un error de la API se muestra y la tarjeta queda', async () => {
  mockApi({ 'POST /api/staff/orders/o22/ready': () => [500, { error: { code: 'error_interno', message: 'Algo salió mal.' } }] })
  renderApp('/', { clock: makeClock() })
  await userEvent.click(within(await card('#0422')).getByRole('button', { name: 'Listo para retirar' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Algo salió mal.')
  expect(within(lane('En cocina')).getByRole('article', { name: 'Pedido #0422' })).toBeInTheDocument()
})
