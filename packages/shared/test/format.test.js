import { test, expect } from 'vitest'
import { formatPrice, formatOrderNumber } from '../src/index.js'

test('formatPrice usa separador de miles es-AR', () => {
  expect(formatPrice(14500)).toBe('$14.500')
  expect(formatPrice(0)).toBe('$0')
  expect(formatPrice(1234567)).toBe('$1.234.567')
})

test('formatOrderNumber rellena a 4 dígitos', () => {
  expect(formatOrderNumber(427)).toBe('#0427')
  expect(formatOrderNumber(12345)).toBe('#12345')
})
