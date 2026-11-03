import { test, expect } from 'vitest'
import { calcDelay, suggestMinutes } from '../src/index.js'

test('calcDelay redondea a 5 y limita 15..45', () => {
  expect(calcDelay({ cookCount: 0, baseMin: 10 })).toBe(15)
  expect(calcDelay({ cookCount: 5, baseMin: 10 })).toBe(25)
  expect(calcDelay({ cookCount: 30, baseMin: 10 })).toBe(45)
})

test('suggestMinutes suma 5 desde 6 unidades', () => {
  expect(suggestMinutes({ delay: 25, units: 8 })).toBe(30)
  expect(suggestMinutes({ delay: 25, units: 6 })).toBe(30)
  expect(suggestMinutes({ delay: 25, units: 3 })).toBe(25)
})
