import { test, expect, beforeEach, afterAll } from 'vitest'
import crypto from 'node:crypto'
import request from 'supertest'
import { prisma, resetDb, makeTestApp, agentAs, menuIds } from './helpers.js'
import { reconcilePending } from '../src/payments/reconcile.js'
import { createMercadoPagoGateway } from '../src/payments/mercadopago.js'

let app, deps, cliente, staff, ids
beforeEach(async () => {
  await resetDb(); ({ app, deps } = makeTestApp()); ids = await menuIds()
  cliente = await agentAs(app, 'cliente'); staff = await agentAs(app, 'staff')
})
afterAll(() => prisma.$disconnect())

async function mpOrder(total = 14500) {
  const r = await cliente.post('/api/orders').send({ items: [{ productId: ids.p.Fino.id, cantidad: 1 }], metodoPago: 'mp', totalEsperado: total })
  return r.body.order
}
const hook = (paymentId, sig = 'ok') => request(app).post(`/api/payments/webhook?data.id=${paymentId}&type=payment`)
  .set('x-signature', sig).set('x-request-id', 'req-1').send({ type: 'payment', data: { id: String(paymentId) } })

test('webhook aprobado pasa a por_aceptar y emite order:new', async () => {
  const o = await mpOrder()
  deps.payments.setPayment({ id: 111, status: 'approved', externalReference: o.id, amount: 14500 })
  const r = await hook(111)
  expect(r.status).toBe(200)
  const db = await prisma.order.findUnique({ where: { id: o.id }, include: { payments: true } })
  expect(db.estado).toBe('por_aceptar')
  expect(db.payments[0]).toMatchObject({ mpPaymentId: '111', estado: 'aprobado' })
  expect(deps.realtime.emitOrder).toHaveBeenCalledWith(expect.objectContaining({ id: o.id, estado: 'por_aceptar' }), 'order:new')
})

test('webhook repetido no duplica eventos ni pagos', async () => {
  const o = await mpOrder()
  deps.payments.setPayment({ id: 111, status: 'approved', externalReference: o.id, amount: 14500 })
  await hook(111); await hook(111)
  expect(await prisma.orderEvent.count({ where: { pedidoId: o.id, tipo: 'pago_aprobado' } })).toBe(1)
  expect(await prisma.payment.count({ where: { pedidoId: o.id } })).toBe(1)
})

test('firma inválida → 401 y la base no cambia', async () => {
  const o = await mpOrder()
  deps.payments.setPayment({ id: 111, status: 'approved', externalReference: o.id, amount: 14500 })
  const r = await hook(111, 'falsa')
  expect(r.status).toBe(401)
  expect(r.body.error.code).toBe('firma_invalida')
  expect((await prisma.order.findUnique({ where: { id: o.id } })).estado).toBe('pendiente_pago')
})

test('pago rechazado cancela el pedido', async () => {
  const o = await mpOrder()
  deps.payments.setPayment({ id: 222, status: 'rejected', externalReference: o.id, amount: 14500 })
  await hook(222)
  expect((await prisma.order.findUnique({ where: { id: o.id } })).estado).toBe('cancelado')
})

test('pago aprobado por un monto menor no aprueba el pedido', async () => {
  const o = await mpOrder()
  deps.payments.setPayment({ id: 333, status: 'approved', externalReference: o.id, amount: 100 })
  await hook(333)
  expect((await prisma.order.findUnique({ where: { id: o.id } })).estado).toBe('pendiente_pago')
})

test('webhook de otro tipo se ignora con 200', async () => {
  const r = await request(app).post('/api/payments/webhook?type=merchant_order').set('x-signature', 'ok').send({ type: 'merchant_order' })
  expect(r.status).toBe(200)
})

async function paidOrder() {
  const o = await mpOrder()
  deps.payments.setPayment({ id: 111, status: 'approved', externalReference: o.id, amount: 14500 })
  await hook(111)
  return o
}

test('rechazar un pedido pagado → pago devuelto y evento devolucion', async () => {
  const o = await paidOrder()
  const r = await staff.post(`/api/staff/orders/${o.id}/reject`).send({ motivo: 'sin_stock' })
  expect(r.body.order.estado).toBe('rechazado')
  expect(r.body.order.pago.estado).toBe('devuelto')
  expect(deps.payments.refunds).toEqual(['111'])
  expect(await prisma.orderEvent.count({ where: { pedidoId: o.id, tipo: 'devolucion' } })).toBe(1)
})

test('falla la devolución → devolucion_pendiente, el rechazo igual ocurre', async () => {
  const o = await paidOrder()
  deps.payments.failRefunds = true
  const r = await staff.post(`/api/staff/orders/${o.id}/reject`).send({ motivo: 'local_cerrando' })
  expect(r.status).toBe(200)
  expect(r.body.order).toMatchObject({ estado: 'rechazado', pago: { estado: 'devolucion_pendiente' } })
})

test('devolución manual desde historial; sin pago aprobado → 409', async () => {
  const o = await paidOrder()
  await staff.post(`/api/staff/orders/${o.id}/accept`).send({ minutos: 20 })
  await staff.post(`/api/staff/orders/${o.id}/ready`)
  await staff.post(`/api/staff/orders/${o.id}/deliver`).send({ cobroConfirmado: false })
  const r = await staff.post(`/api/staff/orders/${o.id}/refund`)
  expect(r.status).toBe(200)
  expect(r.body.order.pago.estado).toBe('devuelto')
  const again = await staff.post(`/api/staff/orders/${o.id}/refund`)
  expect(again.status).toBe(409)
  expect(again.body.error.code).toBe('sin_pago_aprobado')
})

test('reconcile: aprobado encontrado por referencia → por_aceptar', async () => {
  const o = await mpOrder()
  deps.payments.setPayment({ id: 444, status: 'approved', externalReference: o.id, amount: 14500 })
  deps.clock.advance(3 * 60000)
  await reconcilePending(deps)
  expect((await prisma.order.findUnique({ where: { id: o.id } })).estado).toBe('por_aceptar')
})

test('reconcile: 10 min sin pago sigue pendiente; 31 min → cancelado', async () => {
  const o = await mpOrder()
  deps.clock.advance(10 * 60000)
  await reconcilePending(deps)
  expect((await prisma.order.findUnique({ where: { id: o.id } })).estado).toBe('pendiente_pago')
  deps.clock.advance(21 * 60000)
  await reconcilePending(deps)
  expect((await prisma.order.findUnique({ where: { id: o.id } })).estado).toBe('cancelado')
})

test('gateway real: verifySignature valida el HMAC de Mercado Pago', () => {
  const secret = 's3cr3t'
  const now = 1762214040000
  const gw = createMercadoPagoGateway({ accessToken: 'TEST-x', webhookSecret: secret, now: () => now })
  const ts = String(Math.floor(now / 1000))
  const v1 = crypto.createHmac('sha256', secret).update(`id:123;request-id:req-1;ts:${ts};`).digest('hex')
  expect(gw.verifySignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-1', dataId: '123' })).toBe(true)
  expect(gw.verifySignature({ xSignature: `ts=${ts},v1=${'0'.repeat(64)}`, xRequestId: 'req-1', dataId: '123' })).toBe(false)
  expect(gw.verifySignature({ xSignature: undefined, xRequestId: 'req-1', dataId: '123' })).toBe(false)
})
