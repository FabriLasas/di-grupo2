import { test, expect } from 'vitest'
import { nextState, TRANSITIONS, TERMINAL_STATES, ORDER_STATES, ACTIVE_STATES } from '../src/index.js'

test('flujo feliz MP', () => {
  expect(nextState('pendiente_pago', 'pago_aprobado')).toBe('por_aceptar')
  expect(nextState('por_aceptar', 'aceptar')).toBe('en_cocina')
  expect(nextState('en_cocina', 'listo')).toBe('para_retirar')
  expect(nextState('para_retirar', 'entregar')).toBe('entregado')
})

test('cancelar solo antes de cocina', () => {
  expect(nextState('pendiente_pago', 'cancelar')).toBe('cancelado')
  expect(nextState('por_aceptar', 'cancelar')).toBe('cancelado')
  expect(nextState('en_cocina', 'cancelar')).toBeNull()
})

test('estados terminales no avanzan', () => {
  for (const s of TERMINAL_STATES) for (const e of Object.keys(TRANSITIONS)) expect(nextState(s, e)).toBeNull()
})

test('evento desconocido devuelve null', () => {
  expect(nextState('por_aceptar', 'volar')).toBeNull()
})

test('listas de estados', () => {
  expect(ORDER_STATES).toHaveLength(8)
  expect(ACTIVE_STATES).toEqual(['por_aceptar', 'en_cocina', 'para_retirar'])
})
