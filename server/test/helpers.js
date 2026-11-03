import { PrismaClient } from '@prisma/client'
import { seed } from '../prisma/seed.js'

export const prisma = new PrismaClient()

const TABLES = ['OrderItemExtra', 'OrderItem', 'OrderEvent', 'OrderNote', 'Payment', 'Order', 'Variant', 'Product', 'Category', 'Extra', 'StoreSettings', 'User']

/** Vacía todas las tablas, reinicia secuencias y vuelve a sembrar. */
export async function resetDb(db = prisma) {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
  await seed(db)
}

import { vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { createFakeGateway } from '../src/payments/fake.js'

/** Reloj controlable. Por defecto: martes 3/11/2026 21:14 en Buenos Aires (local abierto). */
export function makeClock(iso = '2026-11-03T21:14:00-03:00') {
  let t = new Date(iso).getTime()
  return { now: () => new Date(t), set: (d) => { t = new Date(d).getTime() }, advance: (ms) => { t += ms } }
}

export function makeTestApp(overrides = {}) {
  const deps = {
    prisma,
    payments: createFakeGateway(),
    realtime: { emitOrder: vi.fn(), emitStore: vi.fn() },
    clock: makeClock(),
    config: loadConfig({ ...process.env, NODE_ENV: 'test' }),
    ...overrides,
  }
  return { app: createApp(deps), deps }
}

let seq = 0
/** Devuelve un supertest.agent logueado. cliente: registra uno nuevo; staff/admin: usuarios del seed. */
export async function agentAs(app, rol, extra = {}) {
  const a = request.agent(app)
  if (rol === 'cliente') {
    seq++
    const r = await a.post('/api/auth/register').send({ nombre: extra.nombre || `Cliente ${seq}`, email: `cliente${seq}-${Date.now()}@x.com`, telefono: extra.telefono || `11${String(40000000 + seq)}`, password: 'secreta123' })
    a.user = r.body.user
  } else {
    const email = extra.email || (rol === 'admin' ? 'admin@fino.test' : 'staff@fino.test')
    const r = await a.post('/api/auth/login').send({ email, password: extra.password || 'fino1234' })
    a.user = r.body.user
  }
  return a
}

/** ids del menú por nombre: { productos: {Fino: {id, variants: {Doble: id}}}, extras: {'Dip Lula': id} } */
export async function menuIds(db = prisma) {
  const ps = await db.product.findMany({ include: { variants: true } })
  const es = await db.extra.findMany()
  return {
    p: Object.fromEntries(ps.map((p) => [p.nombre, { id: p.id, v: Object.fromEntries(p.variants.map((v) => [v.nombre, v.id])) }])),
    e: Object.fromEntries(es.map((e) => [e.nombre, e.id])),
  }
}

/** Crea un pedido "pago en el local" de 1 Fino ($14.500) y devuelve el OrderDTO. */
export async function createCashOrder(agent, overrides = {}) {
  const ids = await menuIds()
  const body = { items: [{ productId: ids.p.Fino.id, cantidad: 1 }], metodoPago: 'local', detallePagoLocal: 'efectivo', totalEsperado: 14500, ...overrides }
  const r = await agent.post('/api/orders').send(body)
  if (r.status !== 201) throw new Error(`createCashOrder: ${r.status} ${JSON.stringify(r.body)}`)
  return r.body.order
}
