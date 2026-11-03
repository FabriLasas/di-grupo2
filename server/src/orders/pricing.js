import { HttpError } from '../lib/errors.js'

/**
 * Calcula precios en el servidor. Devuelve las líneas listas para guardar, el total
 * y los productos no disponibles (inexistentes, inactivos o agotados).
 * @returns {Promise<{lines: Array<{productId: string, variantId: string|null, cantidad: number, precioUnitario: number, aclaracion: string|null, sinTacc: boolean, extras: Array<{extraId: string, precio: number}>}>, total: number, unavailable: string[]}>}
 */
export async function priceItems(prisma, items) {
  const productIds = [...new Set(items.map((i) => i.productId))]
  const extraIds = [...new Set(items.flatMap((i) => i.extras ?? []))]
  const products = new Map((await prisma.product.findMany({ where: { id: { in: productIds } }, include: { variants: true } })).map((p) => [p.id, p]))
  const extras = new Map((await prisma.extra.findMany({ where: { id: { in: extraIds }, activo: true } })).map((e) => [e.id, e]))

  const unavailable = productIds.filter((id) => { const p = products.get(id); return !p || !p.activo || p.agotado })
  if (unavailable.length) return { lines: [], total: 0, unavailable }

  const lines = items.map((it) => {
    const p = products.get(it.productId)
    let base = p.precioBase
    let variantId = null
    if (p.variants.length) {
      if (!it.variantId) throw new HttpError(400, 'variante_requerida', `Elegí el tamaño de ${p.nombre}.`, { productId: p.id })
      const v = p.variants.find((x) => x.id === it.variantId)
      if (!v) throw new HttpError(400, 'variante_invalida', `Ese tamaño no existe para ${p.nombre}.`, { productId: p.id })
      base = v.precio
      variantId = v.id
    }
    if (it.sinTacc && !p.sinTacc) throw new HttpError(400, 'sin_tacc_no_disponible', `${p.nombre} no tiene opción sin TACC.`, { productId: p.id })
    const ex = (it.extras ?? []).map((id) => {
      const e = extras.get(id)
      if (!e) throw new HttpError(400, 'extra_invalido', 'Uno de los extras no está disponible.', { extraId: id })
      return { extraId: e.id, precio: e.precio }
    })
    const precioUnitario = base + ex.reduce((a, e) => a + e.precio, 0)
    return { productId: p.id, variantId, cantidad: it.cantidad, precioUnitario, aclaracion: it.aclaracion || null, sinTacc: !!it.sinTacc, extras: ex }
  })
  const total = lines.reduce((a, l) => a + l.precioUnitario * l.cantidad, 0)
  return { lines, total, unavailable: [] }
}
