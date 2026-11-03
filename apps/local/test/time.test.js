import { test, expect } from 'vitest'
import { ageState, dueState, waitState, mmss, hhmm } from '../src/lib/time.js'

const now = new Date('2026-11-04T00:14:00.000Z')
const ago = (s) => new Date(now.getTime() - s * 1000).toISOString()
const ahead = (s) => new Date(now.getTime() + s * 1000).toISOString()

test('ageState: amarillo desde 3 min, rojo desde 5', () => {
  expect(ageState(ago(179), now).state).toBe('ok')
  expect(ageState(ago(180), now)).toEqual({ state: 'warn', label: 'Hace 3 min' })
  expect(ageState(ago(300), now).state).toBe('late')
  expect(ageState(ago(20), now).label).toBe('Recién')
})

test('dueState: amarillo con 5 min o menos, rojo atrasado', () => {
  expect(dueState(ahead(301), now).state).toBe('ok')
  expect(dueState(ahead(300), now)).toEqual({ state: 'warn', label: 'Faltan 05:00' })
  expect(dueState(ago(1), now)).toEqual({ state: 'late', label: 'Atrasado 00:01' })
  expect(dueState(ago(122), now).label).toBe('Atrasado 02:02')
})

test('waitState: amarillo desde 5 min, rojo desde 10', () => {
  expect(waitState(ago(299), now).state).toBe('ok')
  expect(waitState(ago(300), now).state).toBe('warn')
  expect(waitState(ago(600), now)).toEqual({ state: 'late', label: 'Espera 10 min' })
})

test('formatos', () => {
  expect(mmss(-125000)).toBe('02:05')
  expect(hhmm(now)).toBe('21:14')
})
