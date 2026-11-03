import { test, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, makeClock, board } from './utils.jsx'

const pos = (d) => d.querySelector('.pos').textContent

const open = async (num = '#0427') => {
  const card = await screen.findByRole('article', { name: `Pedido ${num}` })
  await userEvent.click(within(card).getByRole('button', { name: 'Ver pedido' }))
  return screen.getByRole('dialog', { name: /Pedido/ })
}

test('muestra el detalle completo, el sugerido y navega entre pendientes', async () => {
  mockApi()
  renderApp('/', { clock: makeClock() })
  const d = await open()
  expect(pos(d)).toBe('Pedido 1 de 2 por aceptar')
  expect(within(d).getByRole('heading', { name: 'Pedido #0427' })).toBeInTheDocument()
  expect(within(d).getByText('1 sin pepinillos')).toBeInTheDocument()
  expect(within(d).getByText('“Somos 3, separen la sin pepinillos”')).toBeInTheDocument()
  expect(within(d).getByText('Pagado online')).toBeInTheDocument()
  expect(within(d).getByText('Op. 89231457760')).toBeInTheDocument()
  expect(within(d).getByRole('button', { name: /25 min/ })).toHaveAttribute('aria-pressed', 'true')
  expect(within(d).getByRole('button', { name: /25 min/ })).toHaveTextContent('SUGERIDO')
  expect(within(d).getByRole('button', { name: 'Aceptar · retiro 21:39' })).toBeInTheDocument()
  await userEvent.click(within(d).getByRole('button', { name: 'Pedido siguiente' }))
  expect(within(d).getByRole('heading', { name: 'Pedido #0428' })).toBeInTheDocument()
  expect(within(d).getByText('Efectivo · paga con $40.000 · vuelto $1.500')).toBeInTheDocument()
  expect(within(d).getByRole('button', { name: 'Pedido siguiente' })).toBeDisabled()
})

test('aceptar manda los minutos elegidos y abre el siguiente', async () => {
  const calls = mockApi({ 'POST /api/staff/orders/o27/accept': (b) => [200, { order: { ...board().porAceptar[0], estado: 'en_cocina', minutosRetiro: b.minutos, retiroEstimado: '2026-11-04T00:44:00.000Z' } }] })
  renderApp('/', { clock: makeClock() })
  const d = await open()
  await userEvent.click(within(d).getByRole('button', { name: 'Sumar 5 minutos' }))
  expect(within(d).getByLabelText('Minutos elegidos')).toHaveTextContent('30 min')
  await userEvent.click(within(d).getByRole('button', { name: 'Aceptar · retiro 21:44' }))
  expect(calls.find((c) => c.path === '/api/staff/orders/o27/accept').body).toEqual({ minutos: 30 })
  await within(d).findByRole('heading', { name: 'Pedido #0428' })
  expect(pos(d)).toBe('Pedido 1 de 1 por aceptar')
  expect(within(d).getByRole('heading', { name: 'Pedido #0428' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('#0427 aceptado. Tomás retira a las 21:44.')
  expect(within(screen.getByRole('region', { name: 'En cocina' })).getByRole('article', { name: 'Pedido #0427' })).toBeInTheDocument()
})

test('rechazar exige elegir motivo y manda el elegido', async () => {
  const calls = mockApi({ 'POST /api/staff/orders/o27/reject': () => [200, { order: { ...board().porAceptar[0], estado: 'rechazado' } }] })
  renderApp('/', { clock: makeClock() })
  const d = await open()
  await userEvent.click(within(d).getByRole('button', { name: 'Rechazar' }))
  expect(calls.some((c) => c.path.endsWith('/reject'))).toBe(false)
  await userEvent.click(within(d).getByRole('button', { name: 'Sin stock' }))
  expect(calls.find((c) => c.path.endsWith('/reject')).body).toEqual({ motivo: 'sin_stock' })
  expect(await screen.findByRole('status')).toHaveTextContent('#0427 rechazado')
  expect(screen.queryByRole('article', { name: 'Pedido #0427' })).toBeNull()
})

test('409 al aceptar avisa que lo tomó otra persona y sigue con el próximo', async () => {
  mockApi({ 'POST /api/staff/orders/o27/accept': () => [409, { error: { code: 'transicion_invalida', message: 'x', details: { estadoActual: 'en_cocina' } } }] })
  renderApp('/', { clock: makeClock() })
  const d = await open()
  await userEvent.click(within(d).getByRole('button', { name: /^Aceptar/ }))
  expect(await screen.findByRole('status')).toHaveTextContent('Ya lo tomó otra persona.')
  expect(within(d).getByRole('heading', { name: 'Pedido #0428' })).toBeInTheDocument()
})

test('los minutos no bajan de 5 ni pasan de 90', async () => {
  mockApi()
  renderApp('/', { clock: makeClock() })
  const d = await open()
  const minus = within(d).getByRole('button', { name: 'Restar 5 minutos' })
  for (let i = 0; i < 6; i++) await userEvent.click(minus)
  expect(within(d).getByLabelText('Minutos elegidos')).toHaveTextContent('5 min')
  expect(minus).toBeDisabled()
  const plus = within(d).getByRole('button', { name: 'Sumar 5 minutos' })
  for (let i = 0; i < 20; i++) await userEvent.click(plus)
  expect(within(d).getByLabelText('Minutos elegidos')).toHaveTextContent('90 min')
  expect(plus).toBeDisabled()
})

test('Escape cierra la hoja', async () => {
  mockApi()
  renderApp('/', { clock: makeClock() })
  await open()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
})
