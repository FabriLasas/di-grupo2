import { test, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, makeClock } from './utils.jsx'

test('pide wake lock de pantalla si el navegador lo soporta', async () => {
  mockApi()
  const request = vi.fn(async () => ({ release: vi.fn(), addEventListener() {} }))
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
  renderApp('/', { clock: makeClock(), dinger: { unlocked: true, unlock() {}, ding() {} } })
  await screen.findAllByRole('article')
  expect(request).toHaveBeenCalledWith('screen')
  delete navigator.wakeLock
})

test('sin soporte de wake lock la app funciona igual', async () => {
  mockApi()
  renderApp('/', { clock: makeClock(), dinger: { unlocked: true, unlock() {}, ding() {} } })
  expect(await screen.findAllByRole('article')).not.toHaveLength(0)
})

test('activar sonido desbloquea el audio y oculta la capa', async () => {
  mockApi()
  const dinger = { unlocked: false, unlock: vi.fn(function () { this.unlocked = true }), ding() {} }
  renderApp('/', { clock: makeClock(), dinger })
  await userEvent.click(await screen.findByRole('button', { name: 'Tocá para activar el sonido' }))
  expect(dinger.unlock).toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Tocá para activar el sonido' })).toBeNull()
})
