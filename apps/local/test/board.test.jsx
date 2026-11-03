import { test, expect } from 'vitest'
import { screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, makeClock } from './utils.jsx'
import { boardReducer, selectLanes } from '../src/state/board.jsx'

const lane = (name) => screen.getByRole('region', { name })
const ids = (name) => within(lane(name)).queryAllByRole('article').map((a) => a.getAttribute('aria-label'))

test('carga el tablero y ordena cada columna por urgencia', async () => {
  mockApi()
  renderApp('/', { clock: makeClock() })
  await screen.findAllByRole('article')
  expect(ids('Por aceptar')).toEqual(['Pedido #0427', 'Pedido #0428'])
  expect(ids('En cocina')).toEqual(['Pedido #0422', 'Pedido #0423'])
  expect(ids('Para retirar')).toEqual(['Pedido #0419', 'Pedido #0420'])
  expect(within(lane('Por aceptar')).getByText('2')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /En curso/ })).toHaveTextContent('6')
  expect(screen.getByText('20 min')).toBeInTheDocument()
})

test('cocina muestra los productos, variante, dips, sin TACC y aclaraciones', async () => {
  mockApi()
  renderApp('/', { clock: makeClock() })
  const card = await screen.findByRole('article', { name: 'Pedido #0422' })
  const w = within(card)
  expect(w.getByText('Cheeseburger')).toBeInTheDocument()
  expect(w.getByText('Simple · Dip Lula · Pan sin TACC')).toBeInTheDocument()
  expect(w.getByText('1 sin pepinillos')).toBeInTheDocument()
  expect(w.getByText('Retira el hermano')).toBeInTheDocument()
  expect(w.getByText('Atrasado 02:00')).toBeInTheDocument()
  expect(card).toHaveClass('late')
})

test('para retirar en efectivo muestra cuánto cobrar', async () => {
  mockApi()
  renderApp('/', { clock: makeClock() })
  const card = await screen.findByRole('article', { name: 'Pedido #0419' })
  expect(within(card).getByText(/Cobrar \$28\.000/)).toBeInTheDocument()
  expect(within(card).getByText('Espera 6 min')).toBeInTheDocument()
  expect(within(screen.getByRole('article', { name: 'Pedido #0420' })).getByText('Pagado online')).toBeInTheDocument()
})

test('buscador filtra por #número y por nombre sin importar mayúsculas', async () => {
  mockApi()
  renderApp('/', { clock: makeClock() })
  await screen.findAllByRole('article')
  await userEvent.type(screen.getByLabelText('Buscar pedido'), '#0419')
  expect(ids('Para retirar')).toEqual(['Pedido #0419'])
  expect(ids('Por aceptar')).toEqual([])
  expect(within(lane('Por aceptar')).getByText('Ningún pedido coincide con "#0419".')).toBeInTheDocument()
  await userEvent.clear(screen.getByLabelText('Buscar pedido'))
  await userEvent.type(screen.getByLabelText('Buscar pedido'), '  LUCÍA ')
  expect(ids('Para retirar')).toEqual(['Pedido #0419'])
  expect(screen.getByRole('article', { name: 'Pedido #0419' })).toHaveClass('match')
})

test('los colores de tiempo cambian con el reloj', async () => {
  mockApi()
  const clock = makeClock()
  renderApp('/', { clock })
  const card = await screen.findByRole('article', { name: 'Pedido #0428' })
  expect(card).not.toHaveClass('warn')
  act(() => clock.tick(60000))
  expect(card).toHaveClass('warn')
  expect(within(card).getByText('Hace 3 min')).toBeInTheDocument()
})

test('reducer: upsert de estado terminal o pendiente_pago lo quita; no duplica', () => {
  let s = boardReducer(undefined, { type: 'load', porAceptar: [{ id: 'a', estado: 'por_aceptar', creadoEn: '2026-11-04T00:00:00Z' }], enCocina: [], paraRetirar: [], demoraMin: 15 })
  s = boardReducer(s, { type: 'upsert', order: { id: 'a', estado: 'por_aceptar', creadoEn: '2026-11-04T00:00:00Z' } })
  expect(Object.keys(s.byId)).toEqual(['a'])
  s = boardReducer(s, { type: 'upsert', order: { id: 'b', estado: 'pendiente_pago' } })
  expect(Object.keys(s.byId)).toEqual(['a'])
  s = boardReducer(s, { type: 'upsert', order: { id: 'a', estado: 'cancelado' } })
  expect(selectLanes(s, '').porAceptar).toEqual([])
})
