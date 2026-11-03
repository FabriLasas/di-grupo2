import { test, expect, vi } from 'vitest'
import { apiFetch, ApiError } from '../src/api/client.js'

test('apiFetch devuelve JSON y manda cookies', async () => {
  global.fetch = vi.fn(async () => new Response(JSON.stringify({ a: 1 }), { status: 200 }))
  expect(await apiFetch('/api/x', { method: 'POST', body: { b: 2 } })).toEqual({ a: 1 })
  const [, init] = fetch.mock.calls[0]
  expect(init.credentials).toBe('include')
  expect(init.headers['content-type']).toBe('application/json')
  expect(JSON.parse(init.body)).toEqual({ b: 2 })
})

test('apiFetch lanza ApiError con code y details', async () => {
  global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'total_cambio', message: 'cambió', details: { total: 14500 } } }), { status: 409 }))
  const err = await apiFetch('/api/orders').catch((e) => e)
  expect(err).toBeInstanceOf(ApiError)
  expect(err).toMatchObject({ status: 409, code: 'total_cambio', message: 'cambió', details: { total: 14500 } })
})

test('apiFetch con respuesta no JSON → code red', async () => {
  global.fetch = vi.fn(async () => new Response('<html>', { status: 502 }))
  expect((await apiFetch('/api/x').catch((e) => e)).code).toBe('red')
})

test('apiFetch sin red → ApiError sin_conexion', async () => {
  global.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch') })
  const err = await apiFetch('/api/x').catch((e) => e)
  expect(err).toMatchObject({ status: 0, code: 'sin_conexion' })
})

test('204 devuelve null', async () => {
  global.fetch = vi.fn(async () => new Response(null, { status: 204 }))
  expect(await apiFetch('/api/auth/logout', { method: 'POST' })).toBeNull()
})
