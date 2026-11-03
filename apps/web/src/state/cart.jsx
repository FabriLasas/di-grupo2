import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'

const KEY = 'fino.cart.v1'
const Ctx = createContext(null)

/** Identidad de una línea: mismo producto, tamaño, dips, sin TACC y aclaración. */
export const lineKey = (l) => [l.productId, l.variantId ?? '', [...(l.extras ?? [])].sort().join('+'), l.sinTacc ? 1 : 0, (l.aclaracion ?? '').trim()].join('|')

/** Precio unitario: variante (o base) + dips. */
export function unitPrice(product, variantId, extraIds, extras) {
  const base = variantId ? product.variantes.find((v) => v.id === variantId)?.precio ?? product.precioBase : product.precioBase
  return base + extraIds.reduce((a, id) => a + (extras.find((e) => e.id === id)?.precio ?? 0), 0)
}

export function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const key = lineKey(action.line)
      const found = state.find((l) => l.key === key)
      if (found) return state.map((l) => (l.key === key ? { ...l, cantidad: Math.min(20, l.cantidad + action.line.cantidad) } : l))
      return [...state, { ...action.line, key }]
    }
    case 'inc': return state.map((l) => (l.key === action.key ? { ...l, cantidad: Math.min(20, l.cantidad + 1) } : l))
    case 'dec': return state.flatMap((l) => (l.key !== action.key ? [l] : l.cantidad > 1 ? [{ ...l, cantidad: l.cantidad - 1 }] : []))
    case 'remove': return state.filter((l) => l.key !== action.key)
    case 'clear': return []
    case 'flag': return state.map((l) => ({ ...l, unavailable: action.productIds.includes(l.productId) }))
    case 'replace': return action.lines.map((l) => ({ ...l, key: lineKey(l) }))
    default: return state
  }
}

const valid = (l) => l && typeof l.productId === 'string' && typeof l.nombre === 'string' && Number.isInteger(l.cantidad) && l.cantidad > 0 && Number.isInteger(l.precioUnitario) && Array.isArray(l.extras)

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) && raw.every(valid) ? raw.map((l) => ({ ...l, key: lineKey(l), unavailable: false })) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [lines, dispatch] = useReducer(cartReducer, undefined, load)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lines.map(({ key, unavailable, ...l }) => l))) } catch { /* almacenamiento bloqueado */ }
  }, [lines])

  const value = useMemo(() => ({
    lines,
    count: lines.reduce((a, l) => a + l.cantidad, 0),
    total: lines.reduce((a, l) => a + l.cantidad * l.precioUnitario, 0),
    add: (line) => dispatch({ type: 'add', line }),
    inc: (key) => dispatch({ type: 'inc', key }),
    dec: (key) => dispatch({ type: 'dec', key }),
    remove: (key) => dispatch({ type: 'remove', key }),
    clear: () => dispatch({ type: 'clear' }),
    replace: (newLines) => dispatch({ type: 'replace', lines: newLines }),
    flagUnavailable: (productIds) => dispatch({ type: 'flag', productIds }),
  }), [lines])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCart fuera de CartProvider')
  return v
}
