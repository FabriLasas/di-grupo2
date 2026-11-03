import { test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, STAFF } from './utils.jsx'

const NO_SESSION = { 'GET /api/auth/me': () => [401, { error: { code: 'no_autenticado', message: 'x' } }] }

test('staff ingresa y ve el tablero', async () => {
  const calls = mockApi({ ...NO_SESSION, 'POST /api/auth/login': () => [200, { user: STAFF }] })
  renderApp('/')
  await userEvent.type(await screen.findByLabelText('Email'), 'staff@fino.test')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'fino1234')
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  expect(await screen.findByRole('heading', { name: 'Por aceptar' })).toBeInTheDocument()
  expect(calls.find((c) => c.path === '/api/auth/login').body).toEqual({ email: 'staff@fino.test', password: 'fino1234' })
})

test('cuenta de cliente no entra y se cierra la sesión', async () => {
  const calls = mockApi({ ...NO_SESSION, 'POST /api/auth/login': () => [200, { user: { ...STAFF, rol: 'cliente' } }], 'POST /api/auth/logout': () => [204, null] })
  renderApp('/')
  await userEvent.type(await screen.findByLabelText('Email'), 'cliente@x.com')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123')
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Esta cuenta no es del local.')
  expect(calls.some((c) => c.path === '/api/auth/logout')).toBe(true)
})

test('credenciales malas muestran el error', async () => {
  mockApi({ ...NO_SESSION, 'POST /api/auth/login': () => [401, { error: { code: 'credenciales_invalidas', message: 'x' } }] })
  renderApp('/')
  await userEvent.type(await screen.findByLabelText('Email'), 'staff@fino.test')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'mala')
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.')
})

test('con sesión de cliente guardada vuelve al login', async () => {
  mockApi({ 'GET /api/auth/me': () => [200, { user: { ...STAFF, rol: 'cliente' } }] })
  renderApp('/')
  expect(await screen.findByRole('heading', { name: 'Comandas' })).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toBeInTheDocument()
})
