import { test, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp } from './utils.jsx'
import { cartReducer, lineKey } from '../src/state/cart.jsx'

const bar = () => screen.getByRole('region', { name: 'Tu pedido' })

test('agregar sin opciones suma al carrito y actualiza la barra', async () => {
  mockApi()
  renderApp('/')
  await userEvent.click(await screen.findByRole('button', { name: 'Agregar Gaseosa (línea coca)' }))
  expect(within(bar()).getByTestId('count')).toHaveTextContent('1')
  expect(within(bar()).getByText('$4.000')).toBeInTheDocument()
})

test('dos agregados iguales suman cantidad; con aclaración distinta son líneas separadas', () => {
  const base = { productId: 'fino', variantId: null, extras: ['dlula'], sinTacc: false, aclaracion: '', cantidad: 1, nombre: 'Fino', extrasNombres: ['Dip Lula'], precioUnitario: 16500 }
  let s = cartReducer([], { type: 'add', line: base })
  s = cartReducer(s, { type: 'add', line: { ...base, extras: ['dlula'] } })
  expect(s).toHaveLength(1)
  expect(s[0].cantidad).toBe(2)
  s = cartReducer(s, { type: 'add', line: { ...base, aclaracion: 'Sin pepinillos' } })
  expect(s).toHaveLength(2)
  expect(lineKey({ ...base, extras: ['b', 'a'] })).toBe(lineKey({ ...base, extras: ['a', 'b'] }))
})

test('producto con variantes abre la hoja y exige tamaño', async () => {
  mockApi()
  renderApp('/')
  await userEvent.click(await screen.findByRole('button', { name: 'Agregar Cheeseburger' }))
  const dialog = screen.getByRole('dialog', { name: 'Cheeseburger' })
  const add = within(dialog).getByRole('button', { name: /^Agregar/ })
  expect(add).toBeDisabled()
  await userEvent.click(within(dialog).getByRole('radio', { name: /Doble/ }))
  expect(add).toBeEnabled()
  expect(add).toHaveTextContent('$13.500')
  await userEvent.click(add)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(within(bar()).getByText('$13.500')).toBeInTheDocument()
})

test('dip suma al precio unitario y la cantidad multiplica', async () => {
  mockApi()
  renderApp('/')
  await userEvent.click(await screen.findByRole('button', { name: 'Agregar Fino' }))
  const dialog = screen.getByRole('dialog', { name: 'Fino' })
  await userEvent.click(within(dialog).getByRole('checkbox', { name: /Dip Lula/ }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Sumar uno' }))
  expect(within(dialog).getByRole('button', { name: /^Agregar/ })).toHaveTextContent('$33.000')
  await userEvent.type(within(dialog).getByLabelText('Aclaración'), 'Sin pepinillos')
  await userEvent.click(within(dialog).getByRole('button', { name: /^Agregar/ }))
  expect(within(bar()).getByTestId('count')).toHaveTextContent('2')
})

test('Escape cierra la hoja sin agregar', async () => {
  mockApi()
  renderApp('/')
  await userEvent.click(await screen.findByRole('button', { name: 'Agregar Fino' }))
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(within(bar()).getByText('Tu pedido está vacío')).toBeInTheDocument()
})

test('en el carrito, restar a cero quita la línea y muestra vacío', async () => {
  mockApi()
  renderApp('/')
  await userEvent.click(await screen.findByRole('button', { name: 'Agregar Gaseosa (línea coca)' }))
  await userEvent.click(within(bar()).getByRole('link', { name: 'Ver pedido' }))
  expect(await screen.findByRole('heading', { name: 'Tu pedido' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Quitar uno de Gaseosa (línea coca)' }))
  expect(screen.getByText('Tu pedido está vacío')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ver el menú' })).toBeInTheDocument()
})

test('persiste en localStorage', async () => {
  mockApi()
  const { unmount } = renderApp('/')
  await userEvent.click(await screen.findByRole('button', { name: 'Agregar Gaseosa (línea coca)' }))
  expect(JSON.parse(localStorage.getItem('fino.cart.v1'))).toHaveLength(1)
  unmount()
  renderApp('/')
  expect(within(await screen.findByRole('region', { name: 'Tu pedido' })).getByTestId('count')).toHaveTextContent('1')
})

test('tolera datos corruptos en localStorage', async () => {
  localStorage.setItem('fino.cart.v1', '{malo')
  mockApi()
  renderApp('/')
  expect(within(await screen.findByRole('region', { name: 'Tu pedido' })).getByText('Tu pedido está vacío')).toBeInTheDocument()
})

test('ignora líneas guardadas con forma inválida', async () => {
  localStorage.setItem('fino.cart.v1', JSON.stringify([{ productId: 'x' }]))
  mockApi()
  renderApp('/')
  expect(within(await screen.findByRole('region', { name: 'Tu pedido' })).getByText('Tu pedido está vacío')).toBeInTheDocument()
})
