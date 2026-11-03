const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/** @param {number} n pesos enteros */
export const formatPrice = (n) => '$' + nf.format(n)

/** @param {number} n */
export const formatOrderNumber = (n) => '#' + String(n).padStart(4, '0')
