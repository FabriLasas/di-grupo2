import { test, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { prisma, resetDb, makeTestApp, agentAs } from './helpers.js'

let app
beforeEach(async () => { await resetDb(); ({ app } = makeTestApp()) })
afterAll(() => prisma.$disconnect())

test('GET /menu agrupa por categoría en orden y oculta inactivos', async () => {
  await prisma.product.updateMany({ where: { nombre: 'Oreo' }, data: { activo: false } })
  const r = await request(app).get('/api/menu')
  expect(r.status).toBe(200)
  expect(r.body.categorias.map((c) => c.nombre)).toEqual(['Hamburguesas', 'Sides', 'Milkshakes', 'Bebidas'])
  const shakes = r.body.categorias[2].productos.map((p) => p.nombre)
  expect(shakes).toEqual(['Cheesecake', 'Chocotorta'])
  const cb = r.body.categorias[0].productos.find((p) => p.nombre === 'Cheesebacon')
  expect(cb.variantes.map((v) => v.nombre)).toEqual(['Simple', 'Doble', 'Triple'])
  expect(r.body.extras).toHaveLength(3)
})

test('producto agotado se informa con agotado:true', async () => {
  await prisma.product.updateMany({ where: { nombre: 'Veggie' }, data: { agotado: true } })
  const r = await request(app).get('/api/menu')
  expect(r.body.categorias[0].productos.find((p) => p.nombre === 'Veggie').agotado).toBe(true)
})

test('admin cambia precio de variante; cliente recibe 403', async () => {
  const v = await prisma.variant.findFirst({ where: { nombre: 'Doble', producto: { nombre: 'Cheeseburger' } } })
  const cliente = await agentAs(app, 'cliente')
  expect((await cliente.patch(`/api/admin/variants/${v.id}`).send({ precio: 14000 })).status).toBe(403)
  const admin = await agentAs(app, 'admin')
  const r = await admin.patch(`/api/admin/variants/${v.id}`).send({ precio: 14000 })
  expect(r.status).toBe(200)
  expect((await prisma.variant.findUnique({ where: { id: v.id } })).precio).toBe(14000)
})

test('admin crea producto y marca agotado', async () => {
  const admin = await agentAs(app, 'admin')
  const cat = await prisma.category.findFirst({ where: { nombre: 'Sides' } })
  const c = await admin.post('/api/admin/products').send({ categoriaId: cat.id, nombre: 'Aros de cebolla', precioBase: 5500 })
  expect(c.status).toBe(201)
  const u = await admin.patch(`/api/admin/products/${c.body.product.id}`).send({ agotado: true })
  expect(u.body.product.agotado).toBe(true)
})

test('PATCH de producto inexistente → 404', async () => {
  const admin = await agentAs(app, 'admin')
  expect((await admin.patch('/api/admin/products/nope').send({ agotado: true })).status).toBe(404)
})
