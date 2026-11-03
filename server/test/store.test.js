import { test, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { prisma, resetDb, makeTestApp, agentAs } from './helpers.js'
import { isOpenAt } from '../src/store/service.js'

let app, deps
beforeEach(async () => { await resetDb(); ({ app, deps } = makeTestApp()) })
afterAll(() => prisma.$disconnect())

test('horario que cruza medianoche', () => {
  const s = { abierto: true, horario: { 1: [['20:00', '00:30']] } } // lunes
  expect(isOpenAt(s, new Date('2026-11-02T20:05:00-03:00'))).toBe(true)  // lunes 20:05
  expect(isOpenAt(s, new Date('2026-11-03T00:15:00-03:00'))).toBe(true)  // martes 00:15, franja del lunes
  expect(isOpenAt(s, new Date('2026-11-03T00:45:00-03:00'))).toBe(false)
  expect(isOpenAt(s, new Date('2026-11-02T19:59:00-03:00'))).toBe(false)
  expect(isOpenAt({ ...s, abierto: false }, new Date('2026-11-02T20:05:00-03:00'))).toBe(false)
})

test('franja dentro del mismo día', () => {
  const s = { abierto: true, horario: { 2: [['12:00', '15:00']] } } // martes
  expect(isOpenAt(s, new Date('2026-11-03T13:00:00-03:00'))).toBe(true)
  expect(isOpenAt(s, new Date('2026-11-03T15:00:00-03:00'))).toBe(false)
})

test('GET /store informa abierto, demora y aceptaPedidos', async () => {
  const r = await request(app).get('/api/store')
  expect(r.status).toBe(200)
  expect(r.body).toMatchObject({ abierto: true, pausado: false, aceptaPedidos: true, demoraMin: 15 })
})

test('fuera de horario aceptaPedidos=false', async () => {
  deps.clock.set('2026-11-03T18:00:00-03:00')
  const r = await request(app).get('/api/store')
  expect(r.body.abierto).toBe(false)
  expect(r.body.aceptaPedidos).toBe(false)
})

test('pausar desde staff emite store:updated y aceptaPedidos=false', async () => {
  const staff = await agentAs(app, 'staff')
  const r = await staff.patch('/api/staff/store').send({ pausado: true })
  expect(r.status).toBe(200)
  expect(r.body.aceptaPedidos).toBe(false)
  expect(deps.realtime.emitStore).toHaveBeenCalledWith(expect.objectContaining({ pausado: true }))
  const cliente = await agentAs(app, 'cliente')
  expect((await cliente.patch('/api/staff/store').send({ pausado: false })).status).toBe(403)
})

test('admin cambia demoraBaseMin y horario', async () => {
  const admin = await agentAs(app, 'admin')
  const r = await admin.patch('/api/admin/store').send({ demoraBaseMin: 20, horario: { 2: [['20:00', '23:00']] } })
  expect(r.status).toBe(200)
  expect(r.body.demoraMin).toBe(20)
})

test('horario con formato inválido → 400', async () => {
  const admin = await agentAs(app, 'admin')
  expect((await admin.patch('/api/admin/store').send({ horario: { 2: [['25:00', '23:00']] } })).status).toBe(400)
})
