import { test, expect, beforeEach, afterEach, afterAll } from 'vitest'
import request from 'supertest'
import { io as ioClient } from 'socket.io-client'
import { prisma, resetDb, makeTestApp, createCashOrder } from './helpers.js'
import { createServer } from '../src/server.js'

let srv, base, deps
const sockets = []
beforeEach(async () => {
  await resetDb()
  const t = makeTestApp()
  deps = t.deps
  srv = createServer({ ...deps, realtime: undefined })
  await new Promise((r) => srv.httpServer.listen(0, r))
  base = `http://localhost:${srv.httpServer.address().port}`
})
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.close())
  await new Promise((r) => srv.io.close(() => r()))
})
afterAll(() => prisma.$disconnect())

async function login(kind) {
  const a = request.agent(base)
  const r = kind === 'staff'
    ? await a.post('/api/auth/login').send({ email: 'staff@fino.test', password: 'fino1234' })
    : await a.post('/api/auth/register').send({ nombre: 'Lucía Martínez', email: `l${Math.random()}@x.com`, telefono: '1169341187', password: 'secreta123' })
  a.cookie = r.headers['set-cookie'][0].split(';')[0]
  return a
}
function connect(cookie) {
  const s = ioClient(base, { transports: ['websocket'], extraHeaders: cookie ? { cookie } : {}, reconnection: false, forceNew: true })
  sockets.push(s)
  return s
}
const once = (s, ev, ms = 2000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), ms); s.once(ev, (d) => { clearTimeout(t); res(d) }) })
const connected = (s) => (s.connected ? Promise.resolve() : once(s, 'connect'))

test('staff recibe order:new al crear un pedido en el local', async () => {
  const staff = await login('staff'); const cliente = await login('cliente')
  const s = connect(staff.cookie); await connected(s)
  const got = once(s, 'order:new')
  const o = await createCashOrder(cliente)
  expect((await got).id).toBe(o.id)
})

test('cliente suscripto recibe order:updated al aceptar', async () => {
  const staff = await login('staff'); const cliente = await login('cliente')
  const o = await createCashOrder(cliente)
  const s = connect(cliente.cookie); await connected(s)
  const ack = await s.emitWithAck('order:subscribe', { orderId: o.id })
  expect(ack).toEqual({ ok: true })
  const got = once(s, 'order:updated')
  await staff.post(`/api/staff/orders/${o.id}/accept`).send({ minutos: 20 })
  expect(await got).toMatchObject({ id: o.id, estado: 'en_cocina' })
})

test('cliente no puede suscribirse a pedido ajeno', async () => {
  const c1 = await login('cliente'); const c2 = await login('cliente')
  const o = await createCashOrder(c1)
  const s = connect(c2.cookie); await connected(s)
  expect(await s.emitWithAck('order:subscribe', { orderId: o.id })).toEqual({ ok: false, error: 'no_encontrado' })
})

test('cliente no recibe eventos de la sala local', async () => {
  const cliente = await login('cliente')
  const s = connect(cliente.cookie); await connected(s)
  let got = false; s.on('order:new', () => { got = true })
  await createCashOrder(await login('cliente'))
  await new Promise((r) => setTimeout(r, 200))
  expect(got).toBe(false)
})

test('sin cookie la conexión se rechaza', async () => {
  const s = connect(null)
  const err = await once(s, 'connect_error')
  expect(err.message).toBe('no_autenticado')
})

test('pedido en pendiente_pago no llega a local pero sí a su sala', async () => {
  const staff = await login('staff')
  const s = connect(staff.cookie); await connected(s)
  let got = false; s.on('order:updated', () => { got = true }); s.on('order:new', () => { got = true })
  srv.realtime.emitOrder({ id: 'x', estado: 'pendiente_pago' }, 'order:updated')
  await new Promise((r) => setTimeout(r, 200))
  expect(got).toBe(false)
})

test('store:updated llega a todos los conectados', async () => {
  const cliente = await login('cliente')
  const s = connect(cliente.cookie); await connected(s)
  const got = once(s, 'store:updated')
  srv.realtime.emitStore({ pausado: true })
  expect(await got).toEqual({ pausado: true })
})
