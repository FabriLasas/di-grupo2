import { test, expect, beforeEach, afterAll } from 'vitest'
import { prisma, resetDb, makeTestApp, agentAs, menuIds, createCashOrder } from './helpers.js'

let app, deps, ids, cliente
beforeEach(async () => {
  await resetDb(); ({ app, deps } = makeTestApp()); ids = await menuIds()
  cliente = await agentAs(app, 'cliente', { nombre: 'Tomás Rodríguez', telefono: '1154328817' })
})
afterAll(() => prisma.$disconnect())

test('pedido en el local: total del servidor, vuelto, por_aceptar y emite order:new', async () => {
  const r = await cliente.post('/api/orders').send({
    items: [{ productId: ids.p.Fino.id, cantidad: 1, extras: [ids.e['Dip Lula']], aclaracion: 'Sin pepinillos' }, { productId: ids.p.Fino.id, cantidad: 1 }],
    metodoPago: 'local', detallePagoLocal: 'efectivo', pagaCon: 40000, totalEsperado: 31000,
  })
  expect(r.status).toBe(201)
  const o = r.body.order
  expect(o.total).toBe(31000)
  expect(o.vuelto).toBe(9000)
  expect(o.estado).toBe('por_aceptar')
  expect(o.numeroLabel).toBe('#0001')
  expect(o.cliente).toEqual({ nombre: 'Tomás Rodríguez', telefono: '1154328817' })
  expect(o.items[0]).toMatchObject({ cantidad: 1, producto: 'Fino', aclaracion: 'Sin pepinillos', extras: ['Dip Lula'], precioUnitario: 16500, subtotal: 16500 })
  expect(deps.realtime.emitOrder).toHaveBeenCalledWith(expect.objectContaining({ id: o.id }), 'order:new')
  expect(await prisma.orderEvent.count({ where: { pedidoId: o.id, tipo: 'creado' } })).toBe(1)
})

test('variante: usa el precio de la variante y la cantidad', async () => {
  const r = await cliente.post('/api/orders').send({
    items: [{ productId: ids.p.Cheesebacon.id, variantId: ids.p.Cheesebacon.v.Triple, cantidad: 2 }],
    metodoPago: 'local', detallePagoLocal: 'tarjeta', totalEsperado: 35000,
  })
  expect(r.status).toBe(201)
  expect(r.body.order.items[0]).toMatchObject({ variante: 'Triple', precioUnitario: 17500, subtotal: 35000 })
  expect(r.body.order.vuelto).toBeNull()
})

test('pedido MP queda pendiente_pago, devuelve initPoint y no avisa al local', async () => {
  const r = await cliente.post('/api/orders').send({ items: [{ productId: ids.p.Fino.id, cantidad: 1 }], metodoPago: 'mp', totalEsperado: 14500 })
  expect(r.status).toBe(201)
  expect(r.body.order.estado).toBe('pendiente_pago')
  expect(r.body.initPoint).toMatch(/^https:\/\/mp\.test\/checkout\//)
  expect(deps.realtime.emitOrder).not.toHaveBeenCalled()
  const pay = await prisma.payment.findFirst({ where: { pedidoId: r.body.order.id } })
  expect(pay).toMatchObject({ estado: 'pendiente', monto: 14500, mpPreferenceId: `pref_${r.body.order.id}` })
})

test('variante requerida para Cheeseburger → 400 variante_requerida', async () => {
  const r = await cliente.post('/api/orders').send({ items: [{ productId: ids.p.Cheeseburger.id, cantidad: 1 }], metodoPago: 'mp', totalEsperado: 9500 })
  expect(r.status).toBe(400)
  expect(r.body.error.code).toBe('variante_requerida')
})

test('variante de otro producto → 400 variante_invalida', async () => {
  const r = await cliente.post('/api/orders').send({ items: [{ productId: ids.p.Cheeseburger.id, variantId: ids.p.Cheesebacon.v.Doble, cantidad: 1 }], metodoPago: 'mp', totalEsperado: 14500 })
  expect(r.status).toBe(400)
  expect(r.body.error.code).toBe('variante_invalida')
})

test('sin TACC en un producto que no lo ofrece → 400', async () => {
  const r = await cliente.post('/api/orders').send({ items: [{ productId: ids.p['Papas fritas'].id, cantidad: 1, sinTacc: true }], metodoPago: 'mp', totalEsperado: 4000 })
  expect(r.body.error.code).toBe('sin_tacc_no_disponible')
})

test('producto agotado → 422 productos_no_disponibles con su id', async () => {
  await prisma.product.update({ where: { id: ids.p.Veggie.id }, data: { agotado: true } })
  const r = await cliente.post('/api/orders').send({ items: [{ productId: ids.p.Veggie.id, cantidad: 1 }, { productId: ids.p.Fino.id, cantidad: 1 }], metodoPago: 'mp', totalEsperado: 32000 })
  expect(r.status).toBe(422)
  expect(r.body.error.details.productos).toEqual([ids.p.Veggie.id])
})

test('producto inexistente → 422', async () => {
  const r = await cliente.post('/api/orders').send({ items: [{ productId: 'nope', cantidad: 1 }], metodoPago: 'mp', totalEsperado: 1 })
  expect(r.status).toBe(422)
  expect(r.body.error.details.productos).toEqual(['nope'])
})

test('totalEsperado distinto → 409 total_cambio con el total nuevo', async () => {
  const r = await cliente.post('/api/orders').send({ items: [{ productId: ids.p.Fino.id, cantidad: 1 }], metodoPago: 'mp', totalEsperado: 13000 })
  expect(r.status).toBe(409)
  expect(r.body.error.code).toBe('total_cambio')
  expect(r.body.error.details.total).toBe(14500)
  expect(await prisma.order.count()).toBe(0)
})

test('local pausado o cerrado → 409 local_no_disponible', async () => {
  await prisma.storeSettings.update({ where: { id: 1 }, data: { pausado: true } })
  const r = await cliente.post('/api/orders').send({ items: [{ productId: ids.p.Fino.id, cantidad: 1 }], metodoPago: 'mp', totalEsperado: 14500 })
  expect(r.status).toBe(409)
  expect(r.body.error.code).toBe('local_no_disponible')
})

test('sin sesión no se puede pedir', async () => {
  const { default: request } = await import('supertest')
  expect((await request(app).post('/api/orders').send({})).status).toBe(401)
})

test('GET /orders/mine trae los del cliente, más reciente primero', async () => {
  const a = await createCashOrder(cliente)
  deps.clock.advance(60000)
  const b = await createCashOrder(cliente)
  const otro = await agentAs(app, 'cliente')
  await createCashOrder(otro)
  const r = await cliente.get('/api/orders/mine')
  expect(r.body.orders.map((o) => o.id)).toEqual([b.id, a.id])
})

test('otro cliente pide GET /orders/:id ajeno → 404; staff sí puede', async () => {
  const o = await createCashOrder(cliente)
  const otro = await agentAs(app, 'cliente')
  expect((await otro.get(`/api/orders/${o.id}`)).status).toBe(404)
  expect((await cliente.get(`/api/orders/${o.id}`)).body.order.id).toBe(o.id)
  const staff = await agentAs(app, 'staff')
  expect((await staff.get(`/api/orders/${o.id}`)).status).toBe(200)
})

test('pagaCon menor al total → 400 paga_con_insuficiente', async () => {
  const r = await cliente.post('/api/orders').send({ items: [{ productId: ids.p.Fino.id, cantidad: 1 }], metodoPago: 'local', detallePagoLocal: 'efectivo', pagaCon: 10000, totalEsperado: 14500 })
  expect(r.status).toBe(400)
  expect(r.body.error.code).toBe('paga_con_insuficiente')
})
