import { test, expect, afterAll } from 'vitest'
import { prisma, resetDb } from './helpers.js'

afterAll(() => prisma.$disconnect())

test('seed carga el menú real de FINO', async () => {
  await resetDb(prisma)
  const fino = await prisma.product.findFirst({ where: { nombre: 'Fino' } })
  expect(fino.precioBase).toBe(14500)
  expect(fino.sinTacc).toBe(true)
  const cb = await prisma.product.findFirst({ where: { nombre: 'Cheesebacon' }, include: { variants: true } })
  expect(cb.variants.map((v) => v.precio).sort((a, b) => a - b)).toEqual([10500, 14500, 17500])
  expect(await prisma.extra.count()).toBe(3)
  expect(await prisma.category.count()).toBe(4)
  const store = await prisma.storeSettings.findUnique({ where: { id: 1 } })
  expect(store.demoraBaseMin).toBe(10)
  expect(store.horario['0']).toEqual([['20:00', '00:30']])
  expect(await prisma.user.count({ where: { rol: 'staff' } })).toBe(1)
})

test('resetDb deja el contador de pedidos en 1', async () => {
  await resetDb(prisma)
  expect(await prisma.order.count()).toBe(0)
})
