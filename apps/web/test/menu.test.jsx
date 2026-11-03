import { test, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, MENU, STORE_OK } from './utils.jsx'

test('muestra categorías, productos y precios con formato', async () => {
  mockApi()
  renderApp('/')
  expect(await screen.findByText('Fino')).toBeInTheDocument()
  expect(screen.getByText('$14.500')).toBeInTheDocument()
  const chips = screen.getByRole('navigation', { name: 'Categorías' })
  expect(within(chips).getByRole('button', { name: 'Hamburguesas' })).toBeInTheDocument()
  expect(within(chips).getByRole('button', { name: 'Sides' })).toBeInTheDocument()
  expect(screen.getByText('Retirás en ~20 min')).toBeInTheDocument()
})

test('producto con variantes muestra "desde"', async () => {
  mockApi()
  renderApp('/')
  expect(await screen.findByText('desde $9.500')).toBeInTheDocument()
})

test('agotado se ve sin botón para agregar', async () => {
  const menu = structuredClone(MENU)
  menu.categorias[0].productos[1].agotado = true
  mockApi({ 'GET /api/menu': () => [200, menu] })
  renderApp('/')
  await screen.findByText('Veggie')
  expect(screen.queryByRole('button', { name: 'Agregar Veggie' })).toBeNull()
  expect(screen.getByText('Agotado')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Agregar Fino' })).toBeInTheDocument()
})

test('local pausado muestra el aviso', async () => {
  mockApi({ 'GET /api/store': () => [200, { ...STORE_OK, pausado: true, aceptaPedidos: false }] })
  renderApp('/')
  expect(await screen.findByRole('status')).toHaveTextContent('no está tomando pedidos')
})

test('local cerrado muestra el horario', async () => {
  const horario = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [['20:00', '00:30']]]))
  mockApi({ 'GET /api/store': () => [200, { ...STORE_OK, abierto: false, aceptaPedidos: false, horario }] })
  renderApp('/')
  expect(await screen.findByRole('status')).toHaveTextContent('Abrimos todos los días de 20:00 a 00:30')
})

test('error de red muestra reintentar y vuelve a pedir', async () => {
  let fail = true
  const calls = mockApi({ 'GET /api/menu': () => (fail ? [500, { error: { code: 'error_interno', message: 'x' } }] : [200, MENU]) })
  renderApp('/')
  const retry = await screen.findByRole('button', { name: 'Reintentar' })
  expect(screen.getByText('No pudimos cargar el menú.')).toBeInTheDocument()
  fail = false
  await userEvent.click(retry)
  expect(await screen.findByText('Fino')).toBeInTheDocument()
  expect(calls.filter((c) => c.path === '/api/menu')).toHaveLength(2)
})

test('tocar un chip lleva a la sección', async () => {
  mockApi()
  renderApp('/')
  await screen.findByText('Fino')
  const target = document.getElementById('cat-c2')
  let scrolled = false
  target.scrollIntoView = () => { scrolled = true }
  await userEvent.click(screen.getByRole('button', { name: 'Sides' }))
  expect(scrolled).toBe(true)
})
