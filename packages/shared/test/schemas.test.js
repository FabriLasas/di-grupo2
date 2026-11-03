import { test, expect } from 'vitest'
import { acceptSchema, rejectSchema, createOrderSchema, registerSchema, deliverSchema, historyQuerySchema } from '../src/index.js'

test('acceptSchema: 5..90 múltiplo de 5', () => {
  expect(acceptSchema.safeParse({ minutos: 22 }).success).toBe(false)
  expect(acceptSchema.safeParse({ minutos: 95 }).success).toBe(false)
  expect(acceptSchema.safeParse({ minutos: 0 }).success).toBe(false)
  expect(acceptSchema.safeParse({ minutos: 25 }).success).toBe(true)
})

test('rejectSchema acepta solo motivos del spec', () => {
  expect(rejectSchema.safeParse({ motivo: 'sin_stock' }).success).toBe(true)
  expect(rejectSchema.safeParse({ motivo: 'me_aburri' }).success).toBe(false)
})

test('createOrderSchema exige items y detallePagoLocal si paga en el local', () => {
  expect(createOrderSchema.safeParse({ items: [], metodoPago: 'mp', totalEsperado: 0 }).success).toBe(false)
  expect(createOrderSchema.safeParse({ items: [{ productId: 'p', cantidad: 1 }], metodoPago: 'local', totalEsperado: 1 }).success).toBe(false)
  expect(createOrderSchema.safeParse({ items: [{ productId: 'p', cantidad: 1 }], metodoPago: 'local', detallePagoLocal: 'efectivo', totalEsperado: 1 }).success).toBe(true)
  expect(createOrderSchema.safeParse({ items: [{ productId: 'p', cantidad: 21 }], metodoPago: 'mp', totalEsperado: 1 }).success).toBe(false)
})

test('registerSchema valida email y largo de clave', () => {
  expect(registerSchema.safeParse({ nombre: 'Tomás', email: 'no-email', telefono: '1154328817', password: 'secreta123' }).success).toBe(false)
  expect(registerSchema.safeParse({ nombre: 'Tomás', email: 't@x.com', telefono: '1154328817', password: 'corta' }).success).toBe(false)
  expect(registerSchema.safeParse({ nombre: 'Tomás', email: 't@x.com', telefono: '1154328817', password: 'secreta123' }).success).toBe(true)
})

test('deliverSchema exige booleano y history page por defecto 1', () => {
  expect(deliverSchema.safeParse({}).success).toBe(false)
  expect(historyQuerySchema.parse({}).page).toBe(1)
  expect(historyQuerySchema.parse({ page: '3' }).page).toBe(3)
})
