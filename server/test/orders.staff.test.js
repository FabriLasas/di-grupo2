import { test, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { prisma, resetDb, makeTestApp, agentAs, createCashOrder, menuIds } from './helpers.js'

let app, deps, cliente, staff
beforeEach(async () => {
  await resetDb(); ({ app, deps } = makeTestApp())
  cliente = await agentAs(app, 'cliente', { nombre: 'Camila Vázquez' })
  staff = await agentAs(app, 'staff')
})
afterAll(() => prisma.$disconnect())

const accept = (id, minutos = 20, a = staff) => a.post(`/api/staff/orders/${id}/accept`).send({ minutos })

test('aceptar fija retiroEstimado = now + minutos y aceptadoPorId', async () => {
  const o = await createCashOrder(cliente)
  const r = await accept(o.id, 20)
  expect(r.status).toBe(200)
  expect(r.body.order.estado).toBe('en_cocina')
  expect(r.body.order.minutosRetiro).toBe(20)
  expect(new Date(r.body.order.retiroEstimado) - new Date(r.body.order.aceptadoEn)).toBe(20 * 60000)
  expect(new Date(r.body.order.aceptadoEn).toISOString()).toBe(deps.clock.now().toISOString())
  const db = await prisma.order.findUnique({ where: { id: o.id } })
  expect(db.aceptadoPorId).toBe(staff.user.id)
})

test('minutos inválidos → 400', async () => {
  const o = await createCashOrder(cliente)
  expect((await accept(o.id, 22)).status).toBe(400)
})

test('doble aceptación concurrente: una 200 y otra 409, un solo evento aceptar', async () => {
  const o = await createCashOrder(cliente)
  const staff2 = await agentAs(app, 'staff')
  const [a, b] = await Promise.all([accept(o.id, 20), accept(o.id, 25, staff2)])
  expect([a.status, b.status].sort()).toEqual([200, 409])
  const loser = a.status === 409 ? a : b
  expect(loser.body.error).toMatchObject({ code: 'transicion_invalida', details: { estadoActual: 'en_cocina' } })
  expect(await prisma.orderEvent.count({ where: { pedidoId: o.id, tipo: 'aceptar' } })).toBe(1)
})

test('pedido inexistente → 404', async () => {
  expect((await accept('nope')).status).toBe(404)
})

test('listo y entregar en efectivo exige cobroConfirmado', async () => {
  const o = await createCashOrder(cliente)
  await accept(o.id)
  deps.clock.advance(15 * 60000)
  const l = await staff.post(`/api/staff/orders/${o.id}/ready`)
  expect(l.body.order.estado).toBe('para_retirar')
  expect(new Date(l.body.order.listoEn).toISOString()).toBe(deps.clock.now().toISOString())
  const bad = await staff.post(`/api/staff/orders/${o.id}/deliver`).send({ cobroConfirmado: false })
  expect(bad.status).toBe(400)
  expect(bad.body.error.code).toBe('cobro_no_confirmado')
  const ok = await staff.post(`/api/staff/orders/${o.id}/deliver`).send({ cobroConfirmado: true })
  expect(ok.body.order.estado).toBe('entregado')
  expect(ok.body.order.entregadoEn).toBeTruthy()
})

test('rechazar exige motivo válido y guarda motivoRechazo', async () => {
  const o = await createCashOrder(cliente)
  expect((await staff.post(`/api/staff/orders/${o.id}/reject`).send({ motivo: 'porque_si' })).status).toBe(400)
  const r = await staff.post(`/api/staff/orders/${o.id}/reject`).send({ motivo: 'sin_stock' })
  expect(r.body.order).toMatchObject({ estado: 'rechazado', motivoRechazo: 'sin_stock' })
})

test('no retirado solo desde para_retirar', async () => {
  const o = await createCashOrder(cliente)
  expect((await staff.post(`/api/staff/orders/${o.id}/not-picked-up`)).status).toBe(409)
  await accept(o.id); await staff.post(`/api/staff/orders/${o.id}/ready`)
  expect((await staff.post(`/api/staff/orders/${o.id}/not-picked-up`)).body.order.estado).toBe('no_retirado')
})

test('transición inválida → 409 (listo sobre por_aceptar)', async () => {
  const o = await createCashOrder(cliente)
  const r = await staff.post(`/api/staff/orders/${o.id}/ready`)
  expect(r.status).toBe(409)
  expect(r.body.error.details.estadoActual).toBe('por_aceptar')
})

test('tablero agrupa y ordena por urgencia, con sugerido', async () => {
  const a = await createCashOrder(cliente); deps.clock.advance(60000)
  const b = await createCashOrder(cliente); deps.clock.advance(60000)
  const c = await createCashOrder(cliente)
  await accept(b.id, 30); await accept(c.id, 10)
  const r = await staff.get('/api/staff/orders')
  expect(r.body.porAceptar.map((o) => o.id)).toEqual([a.id])
  expect(r.body.enCocina.map((o) => o.id)).toEqual([c.id, b.id])  // c retira antes
  expect(r.body.paraRetirar).toEqual([])
  expect(r.body.demoraMin).toBe(15)
  expect(r.body.porAceptar[0].sugeridoMin).toBe(15)
})

test('sugerido suma 5 con 6 o más unidades', async () => {
  const ids = await menuIds()
  await createCashOrder(cliente, { items: [{ productId: ids.p.Fino.id, cantidad: 6 }], totalEsperado: 87000 })
  const r = await staff.get('/api/staff/orders')
  expect(r.body.porAceptar[0].sugeridoMin).toBe(20)
})

test('cada acción emite order:updated', async () => {
  const o = await createCashOrder(cliente)
  deps.realtime.emitOrder.mockClear()
  await accept(o.id)
  expect(deps.realtime.emitOrder).toHaveBeenCalledWith(expect.objectContaining({ id: o.id, estado: 'en_cocina' }), 'order:updated')
})

test('notas: crea nota y evento', async () => {
  const o = await createCashOrder(cliente)
  const r = await staff.post(`/api/staff/orders/${o.id}/notes`).send({ texto: 'Reclamó que faltaba un dip' })
  expect(r.status).toBe(201)
  expect(await prisma.orderNote.count({ where: { pedidoId: o.id } })).toBe(1)
  expect(await prisma.orderEvent.count({ where: { pedidoId: o.id, tipo: 'nota' } })).toBe(1)
})

test('cliente no accede a /staff/* → 403; sin sesión → 401', async () => {
  expect((await cliente.get('/api/staff/orders')).status).toBe(403)
  expect((await request(app).get('/api/staff/orders')).status).toBe(401)
})

test('cliente cancela en por_aceptar; en en_cocina → 409', async () => {
  const o = await createCashOrder(cliente)
  const r = await cliente.post(`/api/orders/${o.id}/cancel`)
  expect(r.body.order.estado).toBe('cancelado')
  const o2 = await createCashOrder(cliente)
  await accept(o2.id)
  expect((await cliente.post(`/api/orders/${o2.id}/cancel`)).status).toBe(409)
})

test('cliente no puede cancelar pedido ajeno → 404', async () => {
  const o = await createCashOrder(cliente)
  const otro = await agentAs(app, 'cliente')
  expect((await otro.post(`/api/orders/${o.id}/cancel`)).status).toBe(404)
})
