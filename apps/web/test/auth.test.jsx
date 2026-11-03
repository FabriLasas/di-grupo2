import { test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, USER } from './utils.jsx'

test('checkout sin sesión redirige a ingresar y vuelve después del login', async () => {
  const calls = mockApi({ 'POST /api/auth/login': () => [200, { user: USER }] })
  renderApp('/checkout')
  expect(await screen.findByRole('heading', { name: 'Ingresá para pedir' })).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Email'), 'tomas@x.com')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123')
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  expect(calls.find((c) => c.path === '/api/auth/login').body).toEqual({ email: 'tomas@x.com', password: 'secreta123' })
  expect(await screen.findByRole('heading', { name: 'Confirmá tu pedido' })).toBeInTheDocument()
})

test('registro manda los datos y muestra error de email en uso', async () => {
  const calls = mockApi({ 'POST /api/auth/register': () => [409, { error: { code: 'email_en_uso', message: 'Ya hay una cuenta con ese email.' } }] })
  renderApp('/ingresar')
  await userEvent.click(await screen.findByRole('tab', { name: 'Crear cuenta' }))
  await userEvent.type(screen.getByLabelText('Nombre y apellido'), 'Tomás Rodríguez')
  await userEvent.type(screen.getByLabelText('Teléfono'), '1154328817')
  await userEvent.type(screen.getByLabelText('Email'), 'tomas@x.com')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123')
  await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Ya hay una cuenta con ese email. Ingresá con tu contraseña.')
  expect(calls.find((c) => c.path === '/api/auth/register').body).toEqual({ nombre: 'Tomás Rodríguez', telefono: '1154328817', email: 'tomas@x.com', password: 'secreta123' })
})

test('login incorrecto muestra mensaje claro', async () => {
  mockApi({ 'POST /api/auth/login': () => [401, { error: { code: 'credenciales_invalidas', message: 'x' } }] })
  renderApp('/ingresar')
  await userEvent.type(await screen.findByLabelText('Email'), 'tomas@x.com')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'mala')
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.')
})

test('errores de validación aparecen debajo del campo', async () => {
  mockApi({ 'POST /api/auth/register': () => [400, { error: { code: 'validacion', message: 'x', details: [{ path: 'password', message: 'Too small' }] } }] })
  renderApp('/ingresar')
  await userEvent.click(await screen.findByRole('tab', { name: 'Crear cuenta' }))
  await userEvent.type(screen.getByLabelText('Nombre y apellido'), 'To')
  await userEvent.type(screen.getByLabelText('Teléfono'), '11543288')
  await userEvent.type(screen.getByLabelText('Email'), 't@x.com')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'corta')
  await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  expect(await screen.findByText('Usá al menos 8 caracteres.')).toBeInTheDocument()
})

test('con sesión la cabecera muestra Mis pedidos y Salir', async () => {
  const calls = mockApi({ 'GET /api/auth/me': () => [200, { user: USER }], 'POST /api/auth/logout': () => [204, null] })
  renderApp('/')
  expect(await screen.findByRole('link', { name: 'Mis pedidos' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Salir' }))
  expect(await screen.findByRole('link', { name: 'Ingresar' })).toBeInTheDocument()
  expect(calls.some((c) => c.path === '/api/auth/logout')).toBe(true)
})

test('volver a un dominio externo se ignora y va al menú', async () => {
  mockApi({ 'POST /api/auth/login': () => [200, { user: USER }] })
  renderApp('/ingresar?volver=%2F%2Fevil.com')
  await userEvent.type(await screen.findByLabelText('Email'), 'tomas@x.com')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123')
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  expect(await screen.findByRole('heading', { name: 'Menú Fino' })).toBeInTheDocument()
})
