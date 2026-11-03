import { test, expect, beforeEach, afterAll } from 'vitest'
import { prisma, resetDb, makeTestApp, agentAs, createCashOrder, menuIds } from './helpers.js'

let app, deps, staff, ids
beforeEach(async () => {
  await resetDb(); ({ app, deps } = makeTestApp()); ids = await menuIds()
  staff = await agentAs(app, 'staff')
})
afterAll(() => prisma.$disconnect())

async function delivered(agent, overrides) {
  const o = await createCashOrder(agent, overrides)
  await staff.post(`/api/staff/orders/${o.id}/accept`).send({ minutos: 20 })
  await staff.post(`/api/staff/orders/${o.id}/ready`)
  await staff.post(`/api/staff/orders/${o.id}/deliver`).send({ cobroConfirmado: true })
  return o
}
const search = (qs = '') => staff.get(`/api/staff/orders/history${qs}`)

test('busca por número con y sin #', async () => {
  const c = await agentAs(app, 'cliente')
  const o = await delivered(c)
  await delivered(c)
  for (const q of ['0001', '%230001', '1']) {
    const r = await search(`?q=${q}`)
    expect(r.body.items.map((x) => x.id)).toContain(o.id)
  }
  expect((await search('?q=%230001')).body.items).toHaveLength(1)
})

test('busca por teléfono parcial y por nombre', async () => {
  const santi = await agentAs(app, 'cliente', { nombre: 'Santiago López', telefono: '1155870932' })
  const otro = await agentAs(app, 'cliente', { nombre: 'Lucía Méndez', telefono: '1162034419' })
  const o = await delivered(santi); await delivered(otro)
  expect((await search('?q=5587')).body.items.map((x) => x.id)).toEqual([o.id])
  expect((await search('?q=santiago')).body.items.map((x) => x.id)).toEqual([o.id])
})

test('busca por producto sin importar mayúsculas', async () => {
  const c = await agentAs(app, 'cliente')
  const v = await delivered(c, { items: [{ productId: ids.p.Veggie.id, cantidad: 1 }], totalEsperado: 17500 })
  await delivered(c)
  expect((await search('?q=VEGGIE')).body.items.map((x) => x.id)).toEqual([v.id])
})

test('solo estados terminales, más reciente primero, con resumen de entregados', async () => {
  const c = await agentAs(app, 'cliente')
  const a = await delivered(c)
  deps.clock.advance(60000)
  const rej = await createCashOrder(c)
  await staff.post(`/api/staff/orders/${rej.id}/reject`).send({ motivo: 'sin_stock' })
  await createCashOrder(c) // activo: no aparece
  const r = await search()
  expect(r.body.items.map((x) => x.id)).toEqual([rej.id, a.id])
  expect(r.body.resumen).toEqual({ cantidad: 2, totalEntregado: 14500 })
  expect((await search('?estado=rechazado')).body.items.map((x) => x.id)).toEqual([rej.id])
})

test('pagina de a 50', async () => {
  const c = await agentAs(app, 'cliente')
  const now = deps.clock.now()
  await prisma.order.createMany({ data: Array.from({ length: 55 }, (_, i) => ({ clienteId: c.user.id, estado: 'entregado', metodoPago: 'local', detallePagoLocal: 'efectivo', total: 1000, creadoEn: new Date(now.getTime() - i * 1000) })) })
  const p1 = await search(); const p2 = await search('?page=2')
  expect(p1.body).toMatchObject({ total: 55, page: 1, pageSize: 50 })
  expect(p1.body.items).toHaveLength(50)
  expect(p2.body.items).toHaveLength(5)
  expect(p1.body.resumen.totalEntregado).toBe(55000)
})

test('el día de trabajo va de 06:00 a 06:00: a las 00:20 se ven los de la noche anterior', async () => {
  const c = await agentAs(app, 'cliente')
  deps.clock.set('2026-11-03T23:50:00-03:00')
  const o = await delivered(c)
  deps.clock.set('2026-11-04T00:20:00-03:00')
  expect((await search()).body.items.map((x) => x.id)).toEqual([o.id])
  deps.clock.set('2026-11-04T21:00:00-03:00')
  expect((await search()).body.items).toEqual([])
  expect((await search('?desde=2026-11-03&hasta=2026-11-03')).body.items.map((x) => x.id)).toEqual([o.id])
})

test('detalle staff trae la línea de tiempo en orden y las notas', async () => {
  const c = await agentAs(app, 'cliente')
  const o = await delivered(c)
  await staff.post(`/api/staff/orders/${o.id}/notes`).send({ texto: 'Faltaba un dip Ranch' })
  const r = await staff.get(`/api/staff/orders/${o.id}`)
  expect(r.status).toBe(200)
  expect(r.body.order.eventos.map((e) => e.tipo)).toEqual(['creado', 'aceptar', 'listo', 'entregar', 'nota'])
  expect(r.body.order.eventos[1].actor).toBe('Fabri')
  expect(r.body.order.notas).toEqual([expect.objectContaining({ texto: 'Faltaba un dip Ranch', autor: 'Fabri' })])
})

test('cliente no accede al historial del local', async () => {
  const c = await agentAs(app, 'cliente')
  expect((await c.get('/api/staff/orders/history')).status).toBe(403)
})

test('page inválida → 400', async () => {
  expect((await search('?page=0')).status).toBe(400)
})
