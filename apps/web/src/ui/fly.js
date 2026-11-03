/** Bolita mostaza que vuela del botón al contador del carrito. */
export function flyToCart(fromEl, toEl, onDone = () => {}) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduce || !fromEl || !toEl) return onDone()
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect()
  const dot = document.createElement('span')
  dot.className = 'flyer'
  document.body.appendChild(dot)
  const x0 = a.left + a.width / 2 - 11, y0 = a.top + a.height / 2 - 11
  const x1 = b.left + b.width / 2 - 11, y1 = b.top + b.height / 2 - 11
  const anim = dot.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(1)` },
    { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 90}px) scale(1.2)`, offset: 0.5 },
    { transform: `translate(${x1}px, ${y1}px) scale(.5)` },
  ], { duration: 650, easing: 'cubic-bezier(.5,0,.5,1)' })
  const end = () => { dot.remove(); onDone() }
  if (anim?.finished) anim.finished.then(end, end); else end()
}
