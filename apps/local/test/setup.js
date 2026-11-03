import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

/** Socket falso: emite eventos del server con sock.serverEmit(ev, data). */
class FakeSocket {
  constructor() { this.handlers = {}; this.connected = true; this.closed = false }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); return this }
  off(ev, fn) { this.handlers[ev] = (this.handlers[ev] || []).filter((f) => f !== fn); return this }
  emit() { return this }
  close() { this.closed = true }
  serverEmit(ev, data) { for (const fn of this.handlers[ev] || []) fn(data) }
}
vi.mock('../src/api/socket.js', () => ({ connectSocket: () => globalThis.__sock }))

beforeEach(() => { globalThis.__sock = new FakeSocket() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {}
Element.prototype.animate = Element.prototype.animate || function () { return { finished: Promise.resolve(), cancel() {} } }
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }))
