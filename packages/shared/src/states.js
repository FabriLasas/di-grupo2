/** Estados posibles de un pedido. */
export const ORDER_STATES = [
  'pendiente_pago', 'por_aceptar', 'en_cocina', 'para_retirar',
  'entregado', 'rechazado', 'cancelado', 'no_retirado',
]
export const ACTIVE_STATES = ['por_aceptar', 'en_cocina', 'para_retirar']
export const TERMINAL_STATES = ['entregado', 'rechazado', 'cancelado', 'no_retirado']

/** @type {Record<string, {from: string[], to: string}>} */
export const TRANSITIONS = {
  pago_aprobado: { from: ['pendiente_pago'], to: 'por_aceptar' },
  pago_fallido: { from: ['pendiente_pago'], to: 'cancelado' },
  aceptar: { from: ['por_aceptar'], to: 'en_cocina' },
  rechazar: { from: ['por_aceptar'], to: 'rechazado' },
  listo: { from: ['en_cocina'], to: 'para_retirar' },
  entregar: { from: ['para_retirar'], to: 'entregado' },
  no_retirado: { from: ['para_retirar'], to: 'no_retirado' },
  cancelar: { from: ['pendiente_pago', 'por_aceptar'], to: 'cancelado' },
}

/**
 * @param {string} estado
 * @param {string} evento
 * @returns {string|null}
 */
export function nextState(estado, evento) {
  const t = TRANSITIONS[evento]
  return t && t.from.includes(estado) ? t.to : null
}

export const REJECT_REASONS = ['sin_stock', 'local_cerrando', 'demasiados_pedidos', 'otro']
