import { test, expect, vi } from 'vitest'
import { screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, makeClock, board, order, NOW } from './utils.jsx'
import { createDinger } from '../src/state/alerts.js'

const lane = (name) => screen.getByRole('region', { name })
const fakeDinger = () => ({ unlock: vi.fn(), ding: vi.fn(), unlocked: true })
const emit = (ev, data) => act(() => globalThis.__sock.serverEmit(ev, data))

test('order:new agrega la tarjeta, suena y destella la columna', async () => {
  mockApi()
  const dinger = fakeDinger()
  renderApp('/', { clock: makeClock(), dinger })
  await screen.findAllByRole('article')
  emit('order:new', order('o30', 430, { creadoEn: NOW.toISOString(), cliente: { nombre: 'Rocío Benítez', telefono: '1122904471' } }))
  expect(within(lane('Por aceptar')).getByRole('article', { name: 'Pedido #0430' })).toBeInTheDocument()
  expect(dinger.ding).toHaveBeenCalledTimes(1)
  expect(lane('Por aceptar')).toHaveClass('alert')
})

test('evento duplicado o de un pedido ya cargado no duplica tarjetas', async () => {
  mockApi()
  renderApp('/', { clock: makeClock(), dinger: fakeDinger() })
  await screen.findAllByRole('article')
  const o = order('o30', 430, { creadoEn: NOW.toISOString() })
  emit('order:new', o); emit('order:new', o)
  emit('order:updated', board().porAceptar[0])
  expect(within(lane('Por aceptar')).getAllByRole('article')).toHaveLength(3)
})

test('si el cliente cancela el pedido abierto, la hoja avisa y no deja aceptar', async () => {
  mockApi()
  renderApp('/', { clock: makeClock(), dinger: fakeDinger() })
  await userEvent.click(within(await screen.findByRole('article', { name: 'Pedido #0427' })).getByRole('button', { name: 'Ver pedido' }))
  emit('order:updated', { ...board().porAceptar[0], estado: 'cancelado' })
  const d = screen.getByRole('dialog')
  expect(within(d).getByRole('alert')).toHaveTextContent('El cliente canceló este pedido.')
  expect(within(d).getByRole('button', { name: /^Aceptar/ })).toBeDisabled()
  expect(within(lane('Por aceptar')).queryByRole('article', { name: 'Pedido #0427' })).toBeNull()
})

test('desconexión muestra el banner y la reconexión recarga el tablero', async () => {
  const calls = mockApi()
  renderApp('/', { clock: makeClock(), dinger: fakeDinger() })
  await screen.findAllByRole('article')
  emit('disconnect')
  expect(screen.getByText('Sin conexión. Reintentando…')).toBeInTheDocument()
  emit('connect')
  expect(screen.queryByText('Sin conexión. Reintentando…')).toBeNull()
  await vi.waitFor(() => expect(calls.filter((c) => c.path === '/api/staff/orders')).toHaveLength(2))
})

test('pausar llama a la API y muestra el aviso; store:updated lo refleja', async () => {
  const calls = mockApi({ 'PATCH /api/staff/store': (b) => [200, { abierto: true, pausado: b.pausado, aceptaPedidos: !b.pausado, demoraMin: 20, horario: {} }] })
  renderApp('/', { clock: makeClock(), dinger: fakeDinger() })
  await userEvent.click(await screen.findByRole('button', { name: 'Recibiendo' }))
  expect(calls.find((c) => c.method === 'PATCH').body).toEqual({ pausado: true })
  expect(await screen.findByRole('button', { name: 'Pausado' })).toBeInTheDocument()
  expect(screen.getByText(/Pedidos pausados/)).toBeInTheDocument()
  emit('store:updated', { abierto: true, pausado: false, aceptaPedidos: true, demoraMin: 30, horario: {} })
  expect(screen.getByRole('button', { name: 'Recibiendo' })).toBeInTheDocument()
  expect(screen.getByText('30 min')).toBeInTheDocument()
})

test('vuelve a sonar cada 60 s si hay pedidos de 5 min o más sin aceptar', async () => {
  mockApi()
  const clock = makeClock()
  const dinger = fakeDinger()
  renderApp('/', { clock, dinger })
  await screen.findAllByRole('article')
  act(() => clock.tick(30000))
  expect(dinger.ding).not.toHaveBeenCalled()         // #0427 tiene 4:30
  act(() => clock.tick(30000))
  expect(dinger.ding).toHaveBeenCalledTimes(1)       // 5:00 y pasaron 60 s
  act(() => clock.tick(30000))
  expect(dinger.ding).toHaveBeenCalledTimes(1)
  act(() => clock.tick(30000))
  expect(dinger.ding).toHaveBeenCalledTimes(2)
})

test('createDinger no suena hasta desbloquear', () => {
  const started = []
  const ctx = { currentTime: 0, destination: {}, resume: vi.fn(),
    createOscillator: () => ({ frequency: { value: 0 }, connect() {}, start() { started.push(this.frequency.value) }, stop() {} }),
    createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }) }
  const d = createDinger(() => ctx)
  d.ding()
  expect(started).toEqual([])
  d.unlock(); d.ding()
  expect(started).toEqual([880, 660])
})
