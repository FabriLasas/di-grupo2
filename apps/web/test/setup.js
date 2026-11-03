import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => { cleanup(); vi.restoreAllMocks(); try { localStorage.clear() } catch {} })

// jsdom no implementa scrollIntoView ni animate
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {}
Element.prototype.animate = Element.prototype.animate || function () { return { finished: Promise.resolve(), onfinish: null, cancel() {} } }
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }))
