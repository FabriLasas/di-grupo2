/** Demora actual en minutos: base + 2,5 por pedido en cocina, redondeado a 5, entre 15 y 45. */
export function calcDelay({ cookCount, baseMin }) {
  const raw = Math.round((baseMin + cookCount * 2.5) / 5) * 5
  return Math.min(45, Math.max(15, raw))
}

/** Tiempo sugerido para aceptar: la demora, +5 si el pedido tiene 6 o más unidades. */
export function suggestMinutes({ delay, units }) {
  return units >= 6 ? delay + 5 : delay
}
